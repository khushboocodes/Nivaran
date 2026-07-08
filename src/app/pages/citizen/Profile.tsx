import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Save, KeyRound, Loader2 } from 'lucide-react';

import CitizenLayout from '../../components/layouts/CitizenLayout';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../auth/AuthProvider';
import { apiClient, ApiError } from '../../../lib/api/client';
import i18n, { SUPPORTED_LANGUAGES, LANGUAGE_DISPLAY } from '../../../lib/i18n';

const ProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  phone: z.string().min(7).max(20).optional().or(z.literal('')),
  city: z.string().max(120).optional().or(z.literal('')),
  language: z.enum(['en', 'hi', 'ta', 'te', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'ur']),
});
type ProfileValues = z.infer<typeof ProfileSchema>;

const PasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
type PasswordValues = z.infer<typeof PasswordSchema>;

interface MeResponse {
  user: {
    id: string;
    email: string;
    name: string;
    phone: string | null;
    city: string | null;
    language: string;
    role: string;
  } | null;
}

export default function CitizenProfile() {
  const { user } = useAuth();
  const { t: tc } = useTranslation('citizen');
  const queryClient = useQueryClient();

  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    reset: resetProfile,
    formState: { errors: profileErrors, isSubmitting: profileSaving },
  } = useForm<ProfileValues>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: {
      name: user?.name ?? '',
      phone: user?.phone ?? '',
      city: user?.city ?? '',
      language: (user?.language as ProfileValues['language']) ?? 'en',
    },
  });

  // Reset form values when the auth user finishes loading.
  useEffect(() => {
    if (user) {
      resetProfile({
        name: user.name,
        phone: user.phone ?? '',
        city: user.city ?? '',
        language: (user.language as ProfileValues['language']) ?? 'en',
      });
    }
  }, [user, resetProfile]);

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    formState: { errors: passwordErrors, isSubmitting: passwordSaving },
  } = useForm<PasswordValues>({ resolver: zodResolver(PasswordSchema) });

  const onProfileSubmit = async (values: ProfileValues) => {
    setProfileSaved(false);
    setProfileError(null);
    try {
      const res = await apiClient.patch<MeResponse>('/users/me', {
        name: values.name,
        phone: values.phone || null,
        city: values.city || null,
        language: values.language,
      });
      if (res.user) {
        // Sync UI language with the persisted choice.
        if (res.user.language && i18n.language !== res.user.language) {
          void i18n.changeLanguage(res.user.language);
        }
        queryClient.setQueryData(['auth', 'me'], { user: res.user });
        await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      }
      setProfileSaved(true);
      window.setTimeout(() => setProfileSaved(false), 1500);
    } catch (err) {
      setProfileError(
        err instanceof ApiError && err.code === 'invalid_input'
          ? 'Some fields are invalid. Please review and try again.'
          : 'Could not save your profile. Please try again.',
      );
    }
  };

  const onPasswordSubmit = async (values: PasswordValues) => {
    setPasswordSaved(false);
    setPasswordError(null);
    try {
      await apiClient.post<{ ok: true }>('/users/me/password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      resetPassword({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordSaved(true);
      window.setTimeout(() => setPasswordSaved(false), 1500);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      setPasswordError(
        code === 'invalid_password'
          ? 'Your current password is incorrect.'
          : 'Could not change your password. Please try again.',
      );
    }
  };

  return (
    <CitizenLayout>
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="text-[10px] text-[#6B7280] uppercase tracking-wider font-semibold mb-1">
            {tc('portalEyebrow', { defaultValue: 'Citizen Portal' })}
          </div>
          <h1 className="text-3xl font-bold text-[#0B1220]">My Profile</h1>
          <p className="text-sm text-[#6B7280] mt-1">Update your account details and language preference.</p>
        </div>

        {/* Profile Card */}
        <Card className="p-6 border-[#E5E7EB] bg-white shadow-sm mb-6">
          <form className="space-y-5" onSubmit={handleProfileSubmit(onProfileSubmit)}>
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-[#0B1220] mb-2 block">Email</Label>
              <Input id="email" value={user?.email ?? ''} disabled className="h-11 border-[#E5E7EB] rounded-xl" />
              <p className="text-xs text-[#94A3B8] mt-1">Email cannot be changed for now.</p>
            </div>

            <div>
              <Label htmlFor="name" className="text-sm font-medium text-[#0B1220] mb-2 block">Full Name</Label>
              <Input id="name" {...registerProfile('name')} className="h-11 border-[#E5E7EB] rounded-xl focus:ring-2 focus:ring-[#2952E3] focus:border-transparent" />
              {profileErrors.name && <p className="text-xs text-[#EF4444] mt-1">{profileErrors.name.message}</p>}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone" className="text-sm font-medium text-[#0B1220] mb-2 block">Phone</Label>
                <Input id="phone" {...registerProfile('phone')} placeholder="+91 98765 43210" className="h-11 border-[#E5E7EB] rounded-xl focus:ring-2 focus:ring-[#2952E3] focus:border-transparent" />
                {profileErrors.phone && <p className="text-xs text-[#EF4444] mt-1">{profileErrors.phone.message}</p>}
              </div>
              <div>
                <Label htmlFor="city" className="text-sm font-medium text-[#0B1220] mb-2 block">City / Ward</Label>
                <Input id="city" {...registerProfile('city')} className="h-11 border-[#E5E7EB] rounded-xl focus:ring-2 focus:ring-[#2952E3] focus:border-transparent" />
                {profileErrors.city && <p className="text-xs text-[#EF4444] mt-1">{profileErrors.city.message}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="language" className="text-sm font-medium text-[#0B1220] mb-2 block">Language</Label>
              <select
                id="language"
                {...registerProfile('language')}
                className="w-full h-11 px-4 border border-[#E5E7EB] rounded-xl bg-white text-[#0B1220] focus:ring-2 focus:ring-[#2952E3] focus:border-transparent text-sm"
              >
                {SUPPORTED_LANGUAGES.map((lng) => (
                  <option key={lng} value={lng}>{LANGUAGE_DISPLAY[lng]}</option>
                ))}
              </select>
            </div>

            {profileError && <p className="text-xs text-[#EF4444]">{profileError}</p>}

            <Button type="submit" disabled={profileSaving} className="bg-[#2952E3] hover:bg-[#1e3a8a] text-white rounded-xl h-11 px-5 font-medium">
              {profileSaving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" strokeWidth={2} />Saving…</>
              ) : (
                <><Save className="w-4 h-4 mr-2" strokeWidth={2} />{profileSaved ? 'Saved ✓' : 'Save changes'}</>
              )}
            </Button>
          </form>
        </Card>

        {/* Password Card */}
        <Card className="p-6 border-[#E5E7EB] bg-white shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-[#F59E0B]" strokeWidth={2} />
            </div>
            <div>
              <h3 className="font-semibold text-[#0B1220]">Change password</h3>
              <p className="text-xs text-[#6B7280]">Use a strong password you don't reuse anywhere else.</p>
            </div>
          </div>

          <form className="space-y-5" onSubmit={handlePasswordSubmit(onPasswordSubmit)}>
            <div>
              <Label htmlFor="currentPassword" className="text-sm font-medium text-[#0B1220] mb-2 block">Current password</Label>
              <Input id="currentPassword" type="password" {...registerPassword('currentPassword')} className="h-11 border-[#E5E7EB] rounded-xl focus:ring-2 focus:ring-[#2952E3] focus:border-transparent" />
              {passwordErrors.currentPassword && <p className="text-xs text-[#EF4444] mt-1">{passwordErrors.currentPassword.message}</p>}
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="newPassword" className="text-sm font-medium text-[#0B1220] mb-2 block">New password</Label>
                <Input id="newPassword" type="password" {...registerPassword('newPassword')} className="h-11 border-[#E5E7EB] rounded-xl focus:ring-2 focus:ring-[#2952E3] focus:border-transparent" />
                {passwordErrors.newPassword && <p className="text-xs text-[#EF4444] mt-1">{passwordErrors.newPassword.message}</p>}
              </div>
              <div>
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-[#0B1220] mb-2 block">Confirm new password</Label>
                <Input id="confirmPassword" type="password" {...registerPassword('confirmPassword')} className="h-11 border-[#E5E7EB] rounded-xl focus:ring-2 focus:ring-[#2952E3] focus:border-transparent" />
                {passwordErrors.confirmPassword && <p className="text-xs text-[#EF4444] mt-1">{passwordErrors.confirmPassword.message}</p>}
              </div>
            </div>

            {passwordError && <p className="text-xs text-[#EF4444]">{passwordError}</p>}

            <Button type="submit" disabled={passwordSaving} className="bg-[#2952E3] hover:bg-[#1e3a8a] text-white rounded-xl h-11 px-5 font-medium">
              {passwordSaving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" strokeWidth={2} />Updating…</>
              ) : (
                <><KeyRound className="w-4 h-4 mr-2" strokeWidth={2} />{passwordSaved ? 'Updated ✓' : 'Update password'}</>
              )}
            </Button>
          </form>
        </Card>
      </div>
    </CitizenLayout>
  );
}
