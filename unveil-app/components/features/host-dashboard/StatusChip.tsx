'use client';

import { cn } from '@/lib/utils';

type RSVPStatus = 'attending' | 'declined' | 'pending' | 'no_response';

interface StatusChipProps {
  status: RSVPStatus;
  className?: string;
}

export function StatusChip({ status, className }: StatusChipProps) {
  const getStatusConfig = (status: RSVPStatus) => {
    switch (status) {
      case 'attending':
        return {
          text: 'Attending',
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
        };
      case 'declined':
        return {
          text: 'Declined',
          bgColor: 'bg-rose-100',
          textColor: 'text-rose-800',
        };
      case 'pending':
        return {
          text: 'Pending',
          bgColor: 'bg-amber-100',
          textColor: 'text-amber-800',
        };
      case 'no_response':
      default:
        return {
          text: 'No Response',
          bgColor: 'bg-slate-100',
          textColor: 'text-slate-700',
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
        config.bgColor,
        config.textColor,
        className,
      )}
    >
      {config.text}
    </span>
  );
}

// Helper function to determine RSVP status from guest data
export function getRSVPStatus(guest: {
  declined_at?: string | null;
  rsvp_status?: string | null;
  last_invited_at?: string | null;
}): RSVPStatus {
  // If guest has declined, show declined status
  if (guest.declined_at) {
    return 'declined';
  }
  
  // If guest has RSVP status of attending, show attending
  if (guest.rsvp_status === 'attending') {
    return 'attending';
  }
  
  // If guest was invited but hasn't responded, show no response
  if (guest.last_invited_at) {
    return 'no_response';
  }
  
  // If guest hasn't been invited yet, show pending
  return 'pending';
}
