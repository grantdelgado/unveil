'use client';

import { useState } from 'react';

import { logAuth, logAuthError } from '@/lib/logger';
import { validatePhoneNumber } from '@/lib/validations';
import { supabase } from '@/lib/supabase/client';
import { usePostAuthRedirect } from '@/hooks/usePostAuthRedirect';
import { 
  PageWrapper,
  CardContainer,
  LogoContainer,
  PageTitle,
  SubTitle,
  FieldLabel,
  PhoneNumberInput,
  OTPInput,
  PrimaryButton,
  SecondaryButton,
  MicroCopy,
  LoadingSpinner
} from '@/components/ui';

// Login flow steps
type LoginStep = 'phone' | 'otp';

export default function LoginPage() {
  const [step, setStep] = useState<LoginStep>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { handlePostAuthRedirect } = usePostAuthRedirect();

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setError('');

    // Validate phone number
    const validation = validatePhoneNumber(phone);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid phone number');
      return;
    }

    // Use the normalized phone number for Supabase (E.164 format)
    const normalizedPhone = validation.normalized!;
    setLoading(true);

    try {
      logAuth('Sending OTP to phone', { phone: normalizedPhone });

      // Production SMS flow
      const { error } = await supabase.auth.signInWithOtp({
        phone: normalizedPhone,
        options: {
          data: { phone: normalizedPhone },
        },
      });

      if (error) {
        logAuthError('Failed to send OTP', error.message);
        setError('Failed to send verification code. Please try again.');
        setLoading(false);
      } else {
        logAuth('OTP sent successfully');
        setStep('otp');
        setLoading(false);
      }
    } catch (err) {
      logAuthError('Unexpected OTP send error', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setError('');

    // Validate OTP format
    if (!/^\d{6}$/.test(otp)) {
      setError('Please enter a 6-digit verification code');
      return;
    }

    setLoading(true);

    try {
      // Get normalized phone number for verification
      const validation = validatePhoneNumber(phone);
      const normalizedPhone = validation.normalized || phone;
      
      logAuth('Verifying OTP for phone', { phone: normalizedPhone });

      // Production OTP verification
      const { data, error } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: otp,
        type: 'sms',
      });

      if (error) {
        logAuthError('Failed to verify OTP', error.message);
        setError('Invalid verification code. Please try again.');
      } else if (data.user) {
        logAuth('Authentication successful');
        // Use new post-auth redirect flow
        await handlePostAuthRedirect({
          phone: normalizedPhone,
          userId: data.user.id,
        });
      } else {
        logAuthError('No user data returned after verification');
        setError('Authentication failed. Please try again.');
      }
    } catch (err) {
      logAuthError('Unexpected OTP verification error', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToPhone = () => {
    setStep('phone');
    setOtp('');
    setError('');
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleOtpChange = (value: string) => {
    setOtp(value);
    // Clear error when user starts typing
    if (error) setError('');
  };

  // Handle OTP completion (auto-submit when 6 digits entered)
  const handleOtpComplete = async (value: string) => {
    if (loading) return; // Prevent double submission
    
    // Validate OTP format
    if (!/^\d{6}$/.test(value)) {
      setError('Please enter a 6-digit verification code');
      return;
    }

    setLoading(true);

    try {
      // Get normalized phone number for verification
      const validation = validatePhoneNumber(phone);
      const normalizedPhone = validation.normalized || phone;
      
      logAuth('Verifying OTP for phone', { phone: normalizedPhone });

      // Production OTP verification
      const { data, error } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: value,
        type: 'sms',
      });

      if (error) {
        logAuthError('Failed to verify OTP', error.message);
        setError('Invalid verification code. Please try again.');
      } else if (data.user) {
        logAuth('Authentication successful');
        // Use new post-auth redirect flow
        await handlePostAuthRedirect({
          phone: normalizedPhone,
          userId: data.user.id,
        });
      } else {
        logAuthError('No user data returned after verification');
        setError('Authentication failed. Please try again.');
      }
    } catch (err) {
      logAuthError('Unexpected OTP verification error', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && step === 'phone' && phone) {
    return (
      <PageWrapper>
        <LoadingSpinner size="lg" text="Authenticating..." />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <CardContainer>
        {/* Header with Logo */}
        <div className="text-center mb-6">
          <LogoContainer />
          <PageTitle>Welcome to Unveil</PageTitle>
          {step === 'phone' ? (
            <SubTitle>Enter your phone number to continue</SubTitle>
          ) : (
            <div>
              <SubTitle className="mb-2">
                Enter the verification code sent to
              </SubTitle>
              <p className="text-gray-900 font-medium">{phone}</p>
            </div>
          )}
        </div>

        {step === 'phone' ? (
          <form onSubmit={handlePhoneSubmit} className="space-y-5">
            <div>
              <FieldLabel htmlFor="phone" required>
                Phone Number
              </FieldLabel>
              <PhoneNumberInput
                id="phone"
                value={phone}
                onChange={handlePhoneChange}
                disabled={loading}
                error={error}
                autoFocus={true}
              />
            </div>

            <PrimaryButton
              type="submit"
              disabled={loading || !phone.trim()}
              loading={loading}
            >
              Continue
            </PrimaryButton>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit} className="space-y-5">
            <div>
              <FieldLabel htmlFor="otp" required>
                Verification Code
              </FieldLabel>
              <OTPInput
                id="otp"
                value={otp}
                onChange={handleOtpChange}
                onComplete={handleOtpComplete}
                disabled={loading}
                error={error}
                autoFocus={true}
              />
            </div>

            <div className="space-y-3">
              <PrimaryButton
                type="submit"
                disabled={loading || otp.length !== 6}
                loading={loading}
              >
                Verify Code
              </PrimaryButton>

              <SecondaryButton
                type="button"
                onClick={handleBackToPhone}
                disabled={loading}
              >
                Change Phone Number
              </SecondaryButton>
            </div>
          </form>
        )}

        {/* Microcopy */}
        <div className="mt-6">
          <MicroCopy>
            {step === 'phone' 
              ? "First time here? Just enter your phone — we'll set everything up for you automatically."
              : "Code will verify automatically when entered. Didn't receive it? Wait 60 seconds and try again."
            }
          </MicroCopy>
        </div>
      </CardContainer>
    </PageWrapper>
  );
}
