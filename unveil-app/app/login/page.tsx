'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { logAuth, logAuthError, logDev } from '@/lib/logger';
import { sendOTP, verifyOTP, validatePhoneNumber } from '@/services/auth';
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
  DevModeBox,
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
  const [isDev, setIsDev] = useState(false);
  const router = useRouter();

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

    setLoading(true);

    try {
      logAuth('Sending OTP to phone', { phone });

      const result = await sendOTP(phone);

      if (result.success) {
        logAuth('OTP sent successfully', {
          isDev: result.isDev,
        });

        if (result.isDev) {
          // Dev phone authenticated directly
          logDev('Development mode: Direct authentication successful', {
            isNewUser: result.isNewUser,
          });
          setError(''); // Clear any previous errors

          // For dev authentication, show a success message and let AuthSessionWatcher handle routing
          // Don't immediately clear loading state as we want to show "Authenticating..." until redirect
          logDev('Waiting for AuthSessionWatcher to handle routing...');

          // Force redirect after a short delay as a fallback
          setTimeout(() => {
            logDev(
              '3-second timeout reached, forcing redirect to /select-event',
            );
            router.replace('/select-event');
            setLoading(false);
          }, 3000); // 3 second timeout

          return;
        }

        // Regular flow - show OTP input
        setIsDev(result.isDev);
        setStep('otp');
        setLoading(false); // Only clear loading for regular OTP flow
      } else {
        logAuthError('Failed to send OTP', result.error);

        // Better error messages for development mode
        let errorMessage =
          result.error || 'Failed to send verification code. Please try again.';

        if (result.isDev && result.error?.includes('Database error')) {
          errorMessage =
            'Development authentication failed. Please check your Supabase configuration.';
        } else if (result.isDev) {
          errorMessage = `Development authentication error: ${result.error}`;
        }

        setError(errorMessage);
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
      logAuth('Verifying OTP for phone', { phone });

      const result = await verifyOTP(phone, otp);

      if (result.success) {
        logAuth('Authentication successful', {
          userId: result.userId || 'unknown',
          isNewUser: result.isNewUser,
        });

        // Success - route based on user status
        if (result.isNewUser) {
          router.push('/setup');
        } else {
          router.push('/select-event');
        }
      } else {
        logAuthError('OTP verification failed', result.error);
        setError(
          result.error || 'Invalid verification code. Please try again.',
        );
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
    setIsDev(false);
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
      logAuth('Verifying OTP for phone', { phone });

      const result = await verifyOTP(phone, value);

      if (result.success) {
        logAuth('Authentication successful', {
          userId: result.userId || 'unknown',
          isNewUser: result.isNewUser,
        });

        // Success - route based on user status
        if (result.isNewUser) {
          router.push('/setup');
        } else {
          router.push('/select-event');
        }
      } else {
        logAuthError('OTP verification failed', result.error);
        setError(
          result.error || 'Invalid verification code. Please try again.',
        );
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

            {isDev && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <strong>Development Mode:</strong> Enter any 6-digit code to
                continue
              </div>
            )}

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

        {/* Development Mode */}
        <DevModeBox>
          <p>Use test numbers for instant authentication:</p>
          <p className="font-mono text-blue-800">(555) 000-0001 • (555) 000-0002 • (555) 000-0003</p>
          <p className="mt-2">Using phone-based OTP authentication — test phones: +15550000001, +15550000002, +15550000003</p>
        </DevModeBox>
      </CardContainer>
    </PageWrapper>
  );
}
