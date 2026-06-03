import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, Shield } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LoginInputSchema, type LoginInput } from '@nivaran/shared';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';
import { useAuth } from '../../auth/AuthProvider';
import DemoCredentials from '../../components/DemoCredentials';

const FormSchema = LoginInputSchema.pick({ email: true, password: true }).extend({
  department: z.string().optional(),
});
type FormValues = z.infer<typeof FormSchema>;

export default function AdminLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(FormSchema) });
  const isPending = isSubmitting;

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await login({ email: values.email, password: values.password } as LoginInput);
      navigate('/admin/dashboard');
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined;
      if (code === 'invalid_credentials') {
        setServerError('Invalid email or password.');
      } else if (code === 'twofa_required' || code === 'invalid_totp') {
        setServerError('Verify with your authenticator app to continue.');
      } else if (code === 'forbidden') {
        setServerError('Your account does not have admin access.');
      } else {
        setServerError('Login failed. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F1F63] to-[#0A0F2E] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1E3A8A_1px,transparent_1px),linear-gradient(to_bottom,#1E3A8A_1px,transparent_1px)] bg-[size:32px_32px] opacity-10" />

      {/* Background Glows */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#2F5BFF] rounded-full blur-3xl opacity-10" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#2F5BFF] rounded-full blur-3xl opacity-5" />

      {/* Auth Card */}
      <Card className="w-full max-w-[450px] p-7 border-[#E2E8F0] bg-white relative z-10 rounded-3xl" style={{boxShadow: '0 8px 30px rgba(15, 23, 42, 0.12)'}}>
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-5">
          <Link to="/" className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#2F5BFF] flex items-center justify-center">
              <span className="text-white font-bold text-lg">N</span>
            </div>
            <span className="font-bold text-[#0F172A] text-xl">NIVARAN</span>
          </Link>
          <Badge variant="secondary" className="bg-[#EEF4FF] text-[#2F5BFF] hover:bg-[#EEF4FF] border-0 text-xs px-2.5 py-1">
            AI Governance Intelligence
          </Badge>
        </div>

        {/* Header */}
        <div className="text-center mb-5">
          <p className="text-xs text-[#64748B] mb-2 uppercase tracking-wide font-semibold">Administration Access</p>
          <h2 className="text-2xl font-bold text-[#0F172A] mb-2">Sign In</h2>
          <p className="text-sm text-[#64748B]">Authorized government personnel only.</p>
        </div>

        {/* Form */}
        <form className="space-y-3.5" onSubmit={handleSubmit(onSubmit)}>
          {/* Official Email */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#0F172A]">Official Email</label>
            <Input
              type="email"
              placeholder="officer@gov.in"
              className="h-11 border-[#E2E8F0] rounded-xl focus:ring-2 focus:ring-[#2F5BFF] focus:border-transparent"
              {...register('email')}
            />
            {errors.email && <p className="text-xs text-[#EF4444] mt-1">{errors.email.message}</p>}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#0F172A]">Password</label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                className="h-11 border-[#E2E8F0] rounded-xl pr-12 focus:ring-2 focus:ring-[#2F5BFF] focus:border-transparent"
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

          {/* Department */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#0F172A]">Department</label>
            <select
              className="w-full h-11 px-4 border border-[#E2E8F0] rounded-xl bg-white text-[#0F172A] text-sm focus:ring-2 focus:ring-[#2F5BFF] focus:border-transparent"
              {...register('department')}
            >
              <option value="">Select your department</option>
              <option value="municipal">Municipal Corporation</option>
              <option value="electricity">Electricity Department</option>
              <option value="water">Water Supply Board</option>
              <option value="public-works">Public Works Department</option>
              <option value="sanitation">Sanitation Department</option>
              <option value="healthcare">Healthcare Department</option>
            </select>
          </div>

          {/* Options */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-[#E2E8F0] text-[#2F5BFF] focus:ring-[#2F5BFF]" />
              <span className="text-sm text-[#64748B]">Remember device</span>
            </label>
            <Link to="/admin/forgot-password" className="text-sm text-[#2F5BFF] hover:underline">
              Forgot password?
            </Link>
          </div>

          {serverError && <p className="text-xs text-[#EF4444]">{serverError}</p>}

          {/* Login Button */}
          <Button
            type="submit"
            disabled={isPending}
            className="w-full h-11 bg-gradient-to-r from-[#2F5BFF] to-[#1D4ED8] hover:from-[#2549D9] hover:to-[#1e40af] text-white rounded-xl shadow-lg hover:shadow-xl transition-all"
          >
            {isPending ? 'Signing in…' : 'Access Admin Console'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>

          {/* Security Badge */}
          <div className="flex items-center justify-center gap-2 pt-2">
            <Shield className="w-4 h-4 text-[#14B86A]" strokeWidth={2} />
            <span className="text-xs text-[#64748B]">2FA enabled for enhanced security</span>
          </div>
        </form>

        <DemoCredentials
          variant="navy"
          email="admin@demo.nivaran.in"
          password="Admin@2026"
          onUse={() => {
            setValue('email', 'admin@demo.nivaran.in', { shouldValidate: true, shouldDirty: true });
            setValue('password', 'Admin@2026', { shouldValidate: true, shouldDirty: true });
          }}
        />

        {/* Footer */}
        <p className="text-center text-xs text-[#64748B] mt-4 pt-4 border-t border-[#E2E8F0]">
          All activities are monitored and securely logged.
        </p>
      </Card>
    </div>
  );
}
