'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
// import { useRouter } from 'next/navigation' // AuthSessionWatcher handles redirects

// Simplified development phone patterns
const DEV_PHONES = {
  '+15550000001': {
    name: 'Test Host',
    avatar: '👑',
    description: 'Event Host',
  },
  '+15550000002': {
    name: 'Test Guest',
    avatar: '🎉',
    description: 'Wedding Guest',
  },
  '+15550000003': {
    name: 'Test Admin',
    avatar: '⚙️',
    description: 'System Admin',
  },
};

const isDevelopment = process.env.NODE_ENV === 'development';

export default function SimplifiedLoginPage() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'verify' | 'dev-select'>('phone');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  // const router = useRouter() // AuthSessionWatcher handles redirects

  // Clean phone number input
  const cleanPhoneNumber = (input: string): string => {
    const digits = input.replace(/\D/g, '');
    if (digits.startsWith('1')) return `+${digits}`;
    return `+1${digits}`;
  };

  // Check if phone is development pattern
  const isDevPhone = (phoneNumber: string): boolean => {
    return isDevelopment && Object.keys(DEV_PHONES).includes(phoneNumber);
  };

  // Handle development phone selection
  const handleDevPhoneLogin = async (devPhone: string, name: string) => {
    setLoading(true);
    setMessage(`Signing in as ${name}...`);

    try {
      // Create deterministic password for consistent sessions
      const password = `dev-${devPhone.slice(-4)}-${Date.now().toString().slice(-6)}`;

      const { error } = await supabase.auth.signInWithPassword({
        email: `${devPhone.replace(/\D/g, '')}@dev.unveil.app`,
        password: password,
      });

      if (error) {
        // If user doesn't exist, create them
        const { error: signUpError } = await supabase.auth.signUp({
          email: `${devPhone.replace(/\D/g, '')}@dev.unveil.app`,
          password: password,
          options: {
            data: {
              phone: devPhone,
              full_name: name,
            },
          },
        });

        if (signUpError) throw signUpError;
      }

      setMessage(`Welcome ${name}! 🎉`);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // AuthSessionWatcher will handle redirect to /select-event
    } catch (error) {
      console.error('Dev login error:', error);
      setMessage(
        `Failed to sign in: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    setLoading(false);
  };

  // Handle SMS OTP flow
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const formattedPhone = cleanPhoneNumber(phone);

    if (formattedPhone.length < 10) {
      setMessage('Please enter a valid phone number');
      setLoading(false);
      return;
    }

    try {
      // Check if development phone
      if (isDevPhone(formattedPhone)) {
        setMessage('Development phone - SMS verification bypassed');
        setStep('verify');
        setOtp('123456'); // Auto-fill for dev
        setLoading(false);
        return;
      }

      // Production SMS flow
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
        options: {
          data: { phone: formattedPhone },
        },
      });

      if (error) {
        setMessage(`Failed to send verification code: ${error.message}`);
      } else {
        setMessage('Verification code sent!');
        setStep('verify');
      }
    } catch (error) {
      console.error('SMS error:', error);
      setMessage('Network error. Please try again.');
    }

    setLoading(false);
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const formattedPhone = cleanPhoneNumber(phone);

    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: 'sms',
      });

      if (error) {
        setMessage('Invalid verification code. Please try again.');
      } else {
        setMessage('Phone verified successfully!');
        // AuthSessionWatcher handles redirect
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      setMessage('Verification failed. Please try again.');
    }

    setLoading(false);
  };

  const formatPhoneDisplay = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (digits.length >= 10) {
      return `(${digits.slice(-10, -7)}) ${digits.slice(-7, -4)}-${digits.slice(-4)}`;
    }
    return value;
  };

  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneDisplay(e.target.value);
    setPhone(formatted);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-rose-50 to-purple-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">💍</div>
          <h1 className="text-2xl font-semibold text-stone-800 mb-2">
            Welcome to Unveil
          </h1>
          <p className="text-stone-600">Sign in with your phone number</p>
        </div>

        {/* Development Mode Toggle */}
        {isDevelopment && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-amber-800">
                Development Mode
              </span>
              <button
                onClick={() =>
                  setStep(step === 'dev-select' ? 'phone' : 'dev-select')
                }
                className="text-xs text-amber-700 hover:text-amber-900"
              >
                {step === 'dev-select' ? 'Use Real Phone' : 'Use Test Account'}
              </button>
            </div>

            {step === 'dev-select' && (
              <div className="space-y-2">
                {Object.entries(DEV_PHONES).map(([devPhone, user]) => (
                  <button
                    key={devPhone}
                    onClick={() => handleDevPhoneLogin(devPhone, user.name)}
                    disabled={loading}
                    className="w-full p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-lg">{user.avatar}</div>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-stone-800">
                          {user.name}
                        </div>
                        <div className="text-sm text-stone-600">
                          {user.description}
                        </div>
                        <div className="text-xs text-stone-500">{devPhone}</div>
                      </div>
                      {loading ? (
                        <div className="w-4 h-4 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin"></div>
                      ) : (
                        <span className="text-amber-600">→</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main Login Form */}
        {step !== 'dev-select' && (
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
            {step === 'phone' && (
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-medium text-stone-700 mb-2"
                  >
                    Phone Number
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={handlePhoneInput}
                    placeholder="(555) 123-4567"
                    className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !phone}
                  className="w-full py-3 bg-stone-800 text-white font-medium rounded-lg hover:bg-stone-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Sending...' : 'Send Verification Code'}
                </button>
              </form>
            )}

            {step === 'verify' && (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div>
                  <label
                    htmlFor="otp"
                    className="block text-sm font-medium text-stone-700 mb-2"
                  >
                    Verification Code
                  </label>
                  <input
                    id="otp"
                    type="text"
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    placeholder="123456"
                    className="w-full p-3 text-center text-lg font-mono border border-stone-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                    maxLength={6}
                    required
                  />
                  <p className="text-sm text-stone-600 mt-1">
                    Code sent to {formatPhoneDisplay(phone)}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full py-3 bg-stone-800 text-white font-medium rounded-lg hover:bg-stone-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Verifying...' : 'Verify Code'}
                </button>

                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="w-full py-2 text-stone-600 hover:text-stone-800 text-sm"
                >
                  ← Back to phone number
                </button>
              </form>
            )}

            {/* Status Messages */}
            {message && (
              <div
                className={`mt-4 p-3 rounded-lg text-sm text-center ${
                  message.includes('Failed') || message.includes('Invalid')
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}
              >
                {message}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-stone-500">
          <p>By signing in, you agree to our Terms of Service</p>
          {isDevelopment && (
            <p className="mt-2 text-amber-600">Development Mode Active</p>
          )}
        </div>
      </div>
    </div>
  );
}
