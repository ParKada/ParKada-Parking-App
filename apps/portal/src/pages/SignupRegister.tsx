import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Mail, Lock, UserPlus, ArrowLeft } from 'lucide-react';

export default function SignupRegister() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (showOtp) {
      return handleVerifyOtp();
    }
    
    if (password !== confirmPassword) {
      return toast.error('Passwords do not match');
    }
    
    if (password.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        toast.error('This email is already registered. Please log in.');
        navigate('/login');
        return;
      }
      
      toast.success('Registration successful! Please check your email for the verification code.');
      setShowOtp(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to register');
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
            <UserPlus size={32} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Create Account</h1>
          <p className="text-gray-500 mt-2">Start your ParKada partnership journey</p>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
          {showOtp ? (
            <form onSubmit={handleRegister} className="space-y-5">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700">Verification Code</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-mono tracking-widest text-center"
                    placeholder="Enter code"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-3 text-center">We sent a verification code to <span className="font-semibold">{email}</span></p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-primary text-white font-semibold rounded-xl shadow-md hover:bg-primary/90 focus:ring-4 focus:ring-primary/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? 'Verifying...' : 'Verify Email'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-5">
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
                <label className="text-sm font-semibold text-gray-700">Password</label>
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
              
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Log in here
            </Link>
          </div>
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
