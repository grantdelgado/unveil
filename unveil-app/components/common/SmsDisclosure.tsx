'use client';

import { cn } from '@/lib/utils';

interface SmsDisclosureProps {
  className?: string;
}

export function SmsDisclosure({ className }: SmsDisclosureProps) {
  return (
    <p
      role="note"
      aria-label="SMS consent notice"
      className={cn(
        'text-xs text-muted-foreground leading-snug border-t pt-3 mt-3',
        className,
      )}
    >
      By continuing, you agree to receive SMS passcodes and event notifications
      (RSVPs, reminders, updates) from Unveil. Msg&Data rates may apply. Reply
      STOP to unsubscribe or HELP for help. See our{' '}
      <a
        href="https://www.sendunveil.com/policies"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Privacy Policy"
        className="text-muted-foreground underline hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1 rounded-sm"
      >
        Privacy Policy
      </a>
      .
    </p>
  );
}
