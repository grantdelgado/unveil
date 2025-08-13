import React from 'react';
import { PrimaryButton, SecondaryButton } from '@/components/ui';
import { FieldLabel, MicroCopy } from '@/components/ui/Typography';
import { ModernOTPInput } from './ModernOTPInput';

interface OTPStepProps {
  otp: string;
  onOtpChange: (value: string) => void;
  onOtpComplete: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBackToPhone: () => void;
  loading: boolean;
  error: string;
  isDev: boolean;
}

export const OTPStep: React.FC<OTPStepProps> = ({
  otp,
  onOtpChange,
  onOtpComplete,
  onSubmit,
  onBackToPhone,
  loading,
  error,
  isDev,
}) => {
  return (
    <>
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <FieldLabel htmlFor="otp" required>
            Verification Code
          </FieldLabel>
          <ModernOTPInput
            id="otp"
            value={otp}
            onChange={onOtpChange}
            onComplete={onOtpComplete}
            disabled={loading}
            error={error}
            autoFocus={true}
          />
        </div>

        {isDev && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <strong>Development Mode:</strong> Enter any 6-digit code to continue
          </div>
        )}

        <div className="space-y-3">
          <PrimaryButton
            type="submit"
            disabled={loading || otp.length !== 6}
            loading={loading}
            className="w-full min-h-[44px]"
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </PrimaryButton>

          <SecondaryButton
            type="button"
            onClick={onBackToPhone}
            disabled={loading}
            className="w-full min-h-[44px]"
          >
            Change Phone Number
          </SecondaryButton>
        </div>
      </form>

      <div className="mt-6">
        <MicroCopy>
          Code will verify automatically when entered. Didn&apos;t receive it? Wait 60 seconds and try again.
        </MicroCopy>
      </div>
    </>
  );
};

OTPStep.displayName = 'OTPStep'; 