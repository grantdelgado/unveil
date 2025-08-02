'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface GuestStats {
  total: number;
  attending: number;
  declined: number;
  pending: number;
  maybe: number;
}

interface ContextualActionBannerProps {
  eventId: string;
  onImportGuests?: () => void;
  onSwitchToMessages?: () => void;
  className?: string;
}

export function ContextualActionBanner({
  eventId,
  onImportGuests,
  onSwitchToMessages,
  className,
}: ContextualActionBannerProps) {
  const [guestStats, setGuestStats] = useState<GuestStats>({
    total: 0,
    attending: 0,
    declined: 0,
    pending: 0,
    maybe: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGuestStats = async () => {
      try {
        const { data, error } = await supabase
          .from('event_guests')
          .select('rsvp_status')
          .eq('event_id', eventId);

        if (error) throw error;

        const stats = data?.reduce((acc, guest) => {
          const status = guest.rsvp_status || 'pending';
          acc[status as keyof Omit<GuestStats, 'total'>] = (acc[status as keyof Omit<GuestStats, 'total'>] || 0) + 1;
          acc.total += 1;
          return acc;
        }, {
          attending: 0,
          declined: 0,
          pending: 0,
          maybe: 0,
          total: 0,
        }) || { attending: 0, declined: 0, pending: 0, maybe: 0, total: 0 };

        setGuestStats(stats);
      } catch (error) {
        console.error('Error fetching guest stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGuestStats();
  }, [eventId]);

  if (loading) {
    return (
      <div className={cn('animate-pulse', className)}>
        <div className="h-16 bg-gray-100 rounded-lg"></div>
      </div>
    );
  }

  // Determine which contextual action to show
  const getContextualAction = () => {
    // Case 1: No guests at all
    if (guestStats.total === 0) {
      return {
        type: 'import-guests' as const,
        title: '🚀 Get Started',
        message: 'Import your guest list to begin sending invitations and managing RSVPs',
        actionText: 'Import Guests',
        action: onImportGuests,
        variant: 'primary' as const,
      };
    }

    // Case 2: Many pending RSVPs (>50% or >5 guests pending)
    const pendingThreshold = Math.max(5, Math.floor(guestStats.total * 0.5));
    if (guestStats.pending >= pendingThreshold) {
      return {
        type: 'send-reminder' as const,
        title: '📧 Reminder Needed',
        message: `${guestStats.pending} guests haven't responded yet. Send a friendly reminder to get more RSVPs.`,
        actionText: 'Send RSVP Reminder',
        action: () => onSwitchToMessages?.(),
        variant: 'warning' as const,
      };
    }

    // Case 3: All guests have responded
    if (guestStats.pending === 0 && guestStats.total > 0) {
      return {
        type: 'all-responded' as const,
        title: '🎉 All Set!',
        message: `All ${guestStats.total} guests have responded. ${guestStats.attending} attending, ${guestStats.declined} declined.`,
        actionText: 'View Messages',
        action: onSwitchToMessages,
        variant: 'success' as const,
      };
    }

    // Case 4: Some pending but not many (subtle prompt)
    if (guestStats.pending > 0) {
      return {
        type: 'some-pending' as const,
        title: 'RSVP Progress',
        message: `${guestStats.pending} guests still need to respond`,
        actionText: 'Send Reminder',
        action: () => onSwitchToMessages?.(),
        variant: 'subtle' as const,
      };
    }

    return null;
  };

  const contextualAction = getContextualAction();

  if (!contextualAction) {
    return null;
  }

  const variantStyles = {
    primary: 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 text-purple-900',
    warning: 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 text-amber-900',
    success: 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 text-green-900',
    subtle: 'bg-gray-50 border-gray-200 text-gray-700',
  };

  const buttonStyles = {
    primary: 'bg-purple-600 hover:bg-purple-700 text-white',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white',
    subtle: 'bg-gray-600 hover:bg-gray-700 text-white',
  };

  return (
    <div className={cn('', className)}>
      <div
        className={cn(
          'p-4 rounded-lg border-2 transition-all duration-200 hover:shadow-md',
          variantStyles[contextualAction.variant]
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-1">
              {contextualAction.title}
            </h3>
            <p className="text-sm opacity-80 leading-relaxed">
              {contextualAction.message}
            </p>
          </div>
          
          {contextualAction.action && (
            <div className="flex-shrink-0">
              <button
                onClick={contextualAction.action}
                className={cn(
                  'px-4 py-2 rounded-lg font-medium text-sm transition-colors duration-200 min-h-[44px]',
                  buttonStyles[contextualAction.variant]
                )}
              >
                {contextualAction.actionText}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}