import React, { useState, useEffect, useCallback } from 'react';
import { SecondaryButton } from '@/components/ui';
import { logAuth, logAuthError } from '@/lib/logger';

interface ResendOTPButtonProps {
  phone: string;
  disabled?: boolean;
  onResendSuccess?: () => void;
  onResendError?: (error: string) => void;
  className?: string;
  initialCooldownSeconds?: number;
}

interface ResendState {
  isResending: boolean;
  cooldownEndsAt: number | null;
  remainingSeconds: number;
  canResend: boolean;
}

export const ResendOTPButton: React.FC<ResendOTPButtonProps> = ({
  phone,
  disabled = false,
  onResendSuccess,
  onResendError,
  className,
  initialCooldownSeconds = 30,
}) => {
  const [resendState, setResendState] = useState<ResendState>({
    isResending: false,
    cooldownEndsAt: Date.now() + (initialCooldownSeconds * 1000), // Start with initial cooldown
    remainingSeconds: initialCooldownSeconds,
    canResend: false,
  });

  // Update countdown timer
  useEffect(() => {
    if (!resendState.cooldownEndsAt) return;

    const updateCountdown = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((resendState.cooldownEndsAt! - now) / 1000));
      
      setResendState(prev => ({
        ...prev,
        remainingSeconds: remaining,
        canResend: remaining === 0,
      }));

      if (remaining === 0) {
        setResendState(prev => ({
          ...prev,
          cooldownEndsAt: null,
        }));
      }
    };

    // Update immediately
    updateCountdown();

    // Continue updating every second
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [resendState.cooldownEndsAt]);

  const handleResend = useCallback(async () => {
    if (!resendState.canResend || resendState.isResending || disabled) {
      return;
    }

    setResendState(prev => ({ ...prev, isResending: true }));

    try {
      logAuth('Requesting OTP resend', { phone: phone.slice(0, 6) + '...' });

      const response = await fetch('/api/auth/otp/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone,
          context: 'login',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
          const cooldownEndsAt = Date.now() + (retryAfter * 1000);
          
          setResendState(prev => ({
            ...prev,
            isResending: false,
            cooldownEndsAt,
            remainingSeconds: retryAfter,
            canResend: false,
          }));

          const errorMessage = data.retryAfter 
            ? `Please wait ${data.retryAfter} seconds before trying again`
            : 'Too many attempts. Please wait before trying again.';
          
          logAuthError('OTP resend rate limited', { retryAfter });
          onResendError?.(errorMessage);
          return;
        }

        throw new Error(data.error || 'Failed to resend code');
      }

      // Success - start new cooldown period
      const cooldownEndsAt = Date.now() + (30 * 1000); // 30 second cooldown
      setResendState(prev => ({
        ...prev,
        isResending: false,
        cooldownEndsAt,
        remainingSeconds: 30,
        canResend: false,
      }));

      logAuth('OTP resend successful');
      onResendSuccess?.();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to resend code';
      logAuthError('OTP resend failed', errorMessage);
      
      setResendState(prev => ({ ...prev, isResending: false }));
      onResendError?.(errorMessage);
    }
  }, [phone, resendState.canResend, resendState.isResending, disabled, onResendSuccess, onResendError]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `0:${secs.toString().padStart(2, '0')}`;
  };

  const getButtonText = (): string => {
    if (resendState.isResending) {
      return 'Sending...';
    }
    
    if (!resendState.canResend && resendState.remainingSeconds > 0) {
      return `Resend in ${formatTime(resendState.remainingSeconds)}`;
    }
    
    return 'Resend Code';
  };

  const isButtonDisabled = disabled || resendState.isResending || !resendState.canResend;

  return (
    <SecondaryButton
      type="button"
      onClick={handleResend}
      disabled={isButtonDisabled}
      loading={resendState.isResending}
      className={`w-full min-h-[44px] ${className || ''}`}
      aria-disabled={isButtonDisabled}
      aria-label={
        !resendState.canResend && resendState.remainingSeconds > 0
          ? `Resend code available in ${resendState.remainingSeconds} seconds`
          : 'Resend verification code'
      }
    >
      {getButtonText()}
    </SecondaryButton>
  );
};

ResendOTPButton.displayName = 'ResendOTPButton';
