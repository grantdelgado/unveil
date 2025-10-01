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
  rsvp_status?: string | null; // DEPRECATED: Phase 1 - will be removed in Phase 2
  last_invited_at?: string | null;
}): RSVPStatus {
  // PHASE 1: Use declined_at as primary source of truth
  if (guest.declined_at) {
    return 'declined';
  }
  
  // If guest has been invited and hasn't declined, they're attending
  if (guest.last_invited_at) {
    return 'attending';
  }
  
  // If guest hasn't been invited yet, show pending
  return 'pending';
}
