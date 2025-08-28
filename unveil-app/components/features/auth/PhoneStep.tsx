import React from 'react';
import { PrimaryButton } from '@/components/ui';
import { PhoneNumberInput } from '@/components/ui/UnveilInput';
import { FieldLabel, MicroCopy } from '@/components/ui/Typography';
import { SmsDisclosure } from '@/components/common/SmsDisclosure';

interface PhoneStepProps {
  phone: string;
  onPhoneChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  error: string;
}

export const PhoneStep: React.FC<PhoneStepProps> = ({
  phone,
  onPhoneChange,
  onSubmit,
  loading,
  error,
}) => {
  return (
    <>
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <FieldLabel htmlFor="phone" required>
            Phone Number
          </FieldLabel>
          <PhoneNumberInput
            id="phone"
            value={phone}
            onChange={onPhoneChange}
            disabled={loading}
            error={error}
            autoFocus={true}
          />
        </div>

        <PrimaryButton
          type="submit"
          disabled={loading || !phone.trim()}
          loading={loading}
          className="w-full min-h-[44px]"
        >
          {loading ? 'Sending Code...' : 'Continue'}
        </PrimaryButton>
      </form>

      <div className="mt-6 space-y-3">
        <MicroCopy>
          First time here? Just enter your phone &mdash; we&apos;ll set
          everything up for you automatically.
        </MicroCopy>
        <SmsDisclosure />
      </div>
    </>
  );
};

PhoneStep.displayName = 'PhoneStep';
