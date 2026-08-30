import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Mail, Lock, LogIn, ArrowLeft } from 'lucide-react';

export default function SignupLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      return toast.error("Please enter your email address");
    }
    
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/change-password`,
      });
      if (error) throw error;
      
      toast.success("Password reset link sent! Please check your email.");
      setShowForgotPassword(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset link");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (showOtp) {
      return handleVerifyOtp();
    }
    
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Email not confirmed')) {
          toast.error('Please enter the verification code sent to your email.');
          setShowOtp(true);
          // Optional: Resend OTP here if needed, but they probably just received it
          await supabase.auth.resend({ type: 'signup', email });
          return;
        }
        throw error;
      }
      
      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'signup'
      });
      
      if (error) throw error;
      
      toast.success('Email verified successfully! You are now logged in.');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Failed to verify OTP');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-primary/5 rounded-b-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md p-8 relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-white mb-4 shadow-lg shadow-primary/30">
            <LogIn size={32} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Partner Portal</h1>
          <p className="text-gray-500 mt-2">Sign in to manage your parking establishment</p>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
          {showForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700">Reset your password</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="Enter your email"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">We will send you an email with a link to reset your password.</p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-primary text-white font-semibold rounded-xl shadow-md hover:bg-primary/90 focus:ring-4 focus:ring-primary/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? 'Sending Link...' : 'Send Reset Link'}
              </button>
              
              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className="w-full py-2 px-4 text-gray-500 font-semibold text-sm hover:text-gray-900 transition-colors mt-2"
              >
                Back to Login
              </button>
            </form>
          ) : showOtp ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700">Verification Code</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-mono tracking-widest text-center"
                    placeholder="Enter 8-digit code"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-3 text-center">We resent a code to <span className="font-semibold">{email}</span></p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-primary text-white font-semibold rounded-xl shadow-md hover:bg-primary/90 focus:ring-4 focus:ring-primary/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? 'Verifying...' : 'Verify & Login'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="you@example.com"
                    required
                  />
                </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-700">Password</label>
                <button 
                  type="button" 
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-primary text-white font-semibold rounded-xl shadow-md hover:bg-primary/90 focus:ring-4 focus:ring-primary/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          )}

          {!showForgotPassword && (
            <div className="mt-6 text-center text-sm text-gray-500">
              Don't have an account?{' '}
              <Link to="/register" className="font-semibold text-primary hover:underline">
                Register here
              </Link>
            </div>
          )}
        </div>
        
        <div className="mt-8 text-center">
          <a href="https://parkada.site" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft size={16} /> Back to ParKada website
          </a>
        </div>
      </div>
    </div>
  );
}
