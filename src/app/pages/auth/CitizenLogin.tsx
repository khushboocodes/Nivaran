import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Bot, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginInputSchema, type LoginInput } from '@nivaran/shared';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';
import { useAuth } from '../../auth/AuthProvider';
import DemoCredentials from '../../components/DemoCredentials';

const FormSchema = LoginInputSchema.pick({ email: true, password: true });
type FormValues = { email: string; password: string };

export default function CitizenLogin() {
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
      await login(values as LoginInput);
      navigate('/citizen/dashboard');
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined;
      setServerError(code === 'invalid_credentials' ? 'Invalid email or password.' : 'Login failed. Please try again.');
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
      <Card className="w-full max-w-[450px] p-7 border-[#E2E8F0] bg-white relative z-10 rounded-3xl" style={{boxShadow: '0 8px 30px rgba(15, 23, 42, 0.08)'}}>
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-5">
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
        <div className="text-center mb-5">
          <p className="text-xs text-[#64748B] mb-2 uppercase tracking-wide font-semibold">Citizen Access</p>
          <h2 className="text-2xl font-bold text-[#0F172A] mb-2">Welcome Back</h2>
          <p className="text-sm text-[#64748B]">Login to continue managing your complaints.</p>
        </div>

        {/* Form */}
        <form className="space-y-3.5" onSubmit={handleSubmit(onSubmit)}>
          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#0F172A]">Email Address</label>
            <Input
              type="email"
              placeholder="citizen@example.com"
              className="h-11 border-[#E2E8F0] rounded-xl focus:ring-2 focus:ring-[#1D4ED8] focus:border-transparent"
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
                className="h-11 border-[#E2E8F0] rounded-xl pr-12 focus:ring-2 focus:ring-[#1D4ED8] focus:border-transparent"
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

          {/* Options */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-[#E2E8F0] text-[#1D4ED8] focus:ring-[#1D4ED8]" />
              <span className="text-sm text-[#64748B]">Remember me</span>
            </label>
            <Link to="/forgot-password" className="text-sm text-[#1D4ED8] hover:underline">
              Forgot password?
            </Link>
          </div>

          {serverError && <p className="text-xs text-[#EF4444]">{serverError}</p>}

          {/* Login Button */}
          <Button
            type="submit"
            disabled={isPending}
            className="w-full h-11 bg-gradient-to-r from-[#1D4ED8] to-[#3B82F6] hover:from-[#1e40af] hover:to-[#2563eb] text-white rounded-xl shadow-lg hover:shadow-xl transition-all"
          >
            {isPending ? 'Logging in…' : 'Login to Citizen Portal'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E2E8F0]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-[#64748B]">OR</span>
            </div>
          </div>

          {/* Signup Button */}
          <Link to="/signup">
            <Button variant="outline" className="w-full h-11 border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC]">
              Create Citizen Account
            </Button>
          </Link>
        </form>

        <DemoCredentials
          variant="blue"
          email="citizen@demo.nivaran.in"
          password="Citizen@2026"
          onUse={() => {
            setValue('email', 'citizen@demo.nivaran.in', { shouldValidate: true, shouldDirty: true });
            setValue('password', 'Citizen@2026', { shouldValidate: true, shouldDirty: true });
          }}
        />

        {/* Footer */}
        <p className="text-center text-sm text-[#64748B] mt-4">
          Need help? <a href="#" className="text-[#1D4ED8] hover:underline">Contact civic support</a>
        </p>
      </Card>
    </div>
  );
}
