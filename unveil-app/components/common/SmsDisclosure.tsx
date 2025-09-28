'use client';

import { cn } from '@/lib/utils';
import { SMS_AUTH_FOOTER_COPY, PRIVACY_URL } from '@/lib/compliance/smsConsent';

interface SmsDisclosureProps {
  className?: string;
}

export function SmsDisclosure({ className }: SmsDisclosureProps) {
  // Split the text at "Privacy Policy" to insert the link
  const parts = SMS_AUTH_FOOTER_COPY.split('Privacy Policy');
  const beforeLink = parts[0];
  const afterLink = parts[1] || '';

  return (
    <p
      role="note"
      aria-label="SMS consent notice"
      className={cn(
        'text-xs text-muted-foreground leading-snug border-t pt-3 mt-3',
        className,
      )}
    >
      {beforeLink}
      <a
        href={PRIVACY_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Privacy Policy"
        className="text-muted-foreground underline hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1 rounded-sm"
      >
        Privacy Policy
      </a>
      {afterLink}
    </p>
  );
}
