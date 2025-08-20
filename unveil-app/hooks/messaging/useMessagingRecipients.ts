/**
 * Unified Messaging Recipients Hook
 * 
 * Uses the same canonical scope as Guest Management to ensure consistency.
 * Replaces direct event_guests queries in messaging components.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

export interface MessagingRecipient {
  event_guest_id: string;
  guest_name: string | null;
  guest_email: string | null;
  phone: string | null;
  sms_opt_out: boolean;
  declined_at: string | null;
  role: string;
  invited_at: string | null;
  guest_tags: string[] | null;
  guest_display_name: string;
  user_full_name: string | null;
  user_phone: string | null;
  user_email: string | null;
  has_valid_phone: boolean;
}

interface UseMessagingRecipientsOptions {
  // includeHosts is now always true by default in the RPC
  // Keeping interface for backward compatibility but option is ignored
  includeHosts?: boolean;
}

interface UseMessagingRecipientsReturn {
  recipients: MessagingRecipient[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook that provides messaging recipients using the same canonical scope as Guest Management
 * Uses the get_messaging_recipients RPC to ensure consistency
 */
export function useMessagingRecipients(
  eventId: string, 
  options: UseMessagingRecipientsOptions = {}
): UseMessagingRecipientsReturn {
  const [recipients, setRecipients] = useState<MessagingRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecipients = useCallback(async () => {
    if (!eventId) {
      logger.warn('useMessagingRecipients: No eventId provided');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Always include hosts now (RPC defaults to true)
      const { data, error: rpcError } = await supabase
        .rpc('get_messaging_recipients', { 
          p_event_id: eventId,
          p_include_hosts: true  // Always true - hosts included by default
        });

      if (rpcError) {
        throw new Error(`Failed to fetch messaging recipients: ${rpcError.message}`);
      }

      const processedRecipients = (Array.isArray(data) ? data : []).map((recipient: any) => ({
        event_guest_id: recipient.event_guest_id,
        guest_name: recipient.guest_name,
        guest_email: recipient.guest_email,
        phone: recipient.phone,
        sms_opt_out: recipient.sms_opt_out || false,
        declined_at: recipient.declined_at,
        role: recipient.role,
        invited_at: recipient.invited_at,
        guest_tags: recipient.guest_tags || [],
        guest_display_name: recipient.guest_display_name,
        user_full_name: recipient.user_full_name,
        user_phone: recipient.user_phone,
        user_email: recipient.user_email,
        has_valid_phone: recipient.has_valid_phone || false,
      })) as MessagingRecipient[];

      setRecipients(processedRecipients);

            logger.info('Successfully fetched messaging recipients', {
        eventId, 
        count: processedRecipients.length,
        includeHosts: true  // Always true now
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      logger.error('Error fetching messaging recipients', { eventId, error: errorMessage });
      
      // Provide user-friendly error message
      let userFriendlyError = 'Unable to load recipients. Please try again.';
      if (errorMessage.includes('Could not find the function')) {
        userFriendlyError = 'Messaging service is temporarily unavailable. Please refresh the page.';
      } else if (errorMessage.includes('Access denied')) {
        userFriendlyError = 'You don&apos;t have permission to view recipients for this event.';
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        userFriendlyError = 'Network error. Please check your connection and try again.';
      }
      
      setError(userFriendlyError);
      setRecipients([]); // Set to empty array on error
    } finally {
      setLoading(false);
    }
  }, [eventId]); // options.includeHosts removed since it's always true now

  // Initial fetch on mount and when eventId changes
  useEffect(() => {
    fetchRecipients();
  }, [fetchRecipients]);

  return {
    recipients,
    loading,
    error,
    refresh: fetchRecipients,
  };
}
