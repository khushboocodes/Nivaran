import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Bot, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SignupInputSchema } from '@nivaran/shared';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';
import { useAuth } from '../../auth/AuthProvider';

const FormSchema = SignupInputSchema.extend({
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Passwords do not match',
});
type FormValues = z.infer<typeof FormSchema>;

export default function CitizenSignup() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { language: 'en' },
  });
  const isPending = isSubmitting;

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await signup({
        name: values.name,
        email: values.email,
        phone: values.phone || undefined,
        city: values.city || undefined,
        password: values.password,
        language: 'en',
      });
      navigate('/citizen/dashboard');
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined;
      setServerError(
        code === 'email_in_use'
          ? 'That email is already registered. Try logging in instead.'
          : 'Account creation failed. Please try again.',
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#E5E7EB_1px,transparent_1px),linear-gradient(to_bottom,#E5E7EB_1px,transparent_1px)] bg-[size:32px_32px] opacity-20" />

      {/* Background Glows */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#DBEAFE] rounded-full blur-3xl opacity-20" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#DBEAFE] rounded-full blur-3xl opacity-15" />

      {/* Auth Card */}
      <Card className="w-full max-w-[450px] p-10 border-[#E2E8F0] bg-white relative z-10 rounded-3xl" style={{boxShadow: '0 8px 30px rgba(15, 23, 42, 0.08)'}}>
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-8">
          <Link to="/" className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#1D4ED8] flex items-center justify-center">
              <span className="text-white font-bold text-lg">N</span>
            </div>
            <span className="font-bold text-[#0F172A] text-xl">NIVARAN</span>
          </Link>
          <Badge variant="secondary" className="bg-[#DBEAFE] text-[#1D4ED8] hover:bg-[#DBEAFE] border-0 text-xs px-2.5 py-1">
            <Bot className="w-3 h-3 mr-1" />
            AI POWERED
          </Badge>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-xs text-[#64748B] mb-2 uppercase tracking-wide font-semibold">Citizen Registration</p>
          <h2 className="text-2xl font-bold text-[#0F172A] mb-2">Create Your Account</h2>
          <p className="text-sm text-[#64748B]">Register to file and track grievances securely.</p>
        </div>

        {/* Form */}
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          {/* Full Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#0F172A]">Full Name</label>
            <Input
              type="text"
              placeholder="Enter your full name"
              className="h-[52px] border-[#E2E8F0] rounded-xl focus:ring-2 focus:ring-[#1D4ED8] focus:border-transparent"
              {...register('name')}
            />
            {errors.name && <p className="text-xs text-[#EF4444] mt-1">{errors.name.message}</p>}
          </div>

          {/* Email Address */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#0F172A]">Email Address</label>
            <Input
              type="email"
              placeholder="citizen@example.com"
              className="h-[52px] border-[#E2E8F0] rounded-xl focus:ring-2 focus:ring-[#1D4ED8] focus:border-transparent"
              {...register('email')}
            />
            {errors.email && <p className="text-xs text-[#EF4444] mt-1">{errors.email.message}</p>}
          </div>

          {/* Mobile Number */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#0F172A]">Mobile Number</label>
            <Input
              type="tel"
              placeholder="+91 98765 43210"
              className="h-[52px] border-[#E2E8F0] rounded-xl focus:ring-2 focus:ring-[#1D4ED8] focus:border-transparent"
              {...register('phone', { setValueAs: (v) => (v === '' ? undefined : v) })}
            />
            {errors.phone && <p className="text-xs text-[#EF4444] mt-1">{errors.phone.message}</p>}
          </div>

          {/* City / Ward */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#0F172A]">City / Ward <span className="text-xs text-[#94A3B8]">(Optional)</span></label>
            <Input
              type="text"
              placeholder="Enter your city or ward"
              className="h-[52px] border-[#E2E8F0] rounded-xl focus:ring-2 focus:ring-[#1D4ED8] focus:border-transparent"
              {...register('city', { setValueAs: (v) => (v === '' ? undefined : v) })}
            />
            {errors.city && <p className="text-xs text-[#EF4444] mt-1">{errors.city.message}</p>}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#0F172A]">Password</label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a password"
                className="h-[52px] border-[#E2E8F0] rounded-xl pr-12 focus:ring-2 focus:ring-[#1D4ED8] focus:border-transparent"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A] transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-[#EF4444] mt-1">{errors.password.message}</p>}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#0F172A]">Confirm Password</label>
            <div className="relative">
              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                className="h-[52px] border-[#E2E8F0] rounded-xl pr-12 focus:ring-2 focus:ring-[#1D4ED8] focus:border-transparent"
                {...register('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A] transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-xs text-[#EF4444] mt-1">{errors.confirmPassword.message}</p>}
          </div>

          {/* Terms & Privacy */}
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 mt-0.5 rounded border-[#E2E8F0] text-[#1D4ED8] focus:ring-[#1D4ED8]" />
            <span className="text-sm text-[#64748B]">
              I agree to the <a href="#" className="text-[#1D4ED8] hover:underline">Terms & Privacy Policy</a>
            </span>
          </label>

          {serverError && <p className="text-xs text-[#EF4444]">{serverError}</p>}

          {/* Signup Button */}
          <Button
            type="submit"
            disabled={isPending}
            className="w-full h-[52px] bg-gradient-to-r from-[#1D4ED8] to-[#3B82F6] hover:from-[#1e40af] hover:to-[#2563eb] text-white rounded-xl shadow-lg hover:shadow-xl transition-all"
          >
            {isPending ? 'Creating account…' : 'Create Citizen Account'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </form>

        {/* Footer */}
        <p className="text-center text-sm text-[#64748B] mt-6">
          Already have an account? <Link to="/login" className="text-[#1D4ED8] hover:underline">Login</Link>
        </p>
      </Card>
    </div>
  );
}
