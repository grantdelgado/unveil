import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { resolveMessageRecipients } from '@/lib/services/messaging';
import type { 
  RecipientFilter, 
  FilteredGuest, 
  RecipientPreviewData, 
  GuestWithDisplayName,
  RSVP_STATUSES 
} from '@/lib/types/messaging';

interface UseRecipientPreviewOptions {
  eventId: string;
  filter: RecipientFilter;
  debounceMs?: number;
}

interface UseRecipientPreviewReturn {
  previewData: RecipientPreviewData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for real-time recipient preview based on filter criteria
 * Provides debounced updates and performance optimization for large guest lists
 */
export function useRecipientPreview({ 
  eventId, 
  filter, 
  debounceMs = 300 
}: UseRecipientPreviewOptions): UseRecipientPreviewReturn {
  const [allGuests, setAllGuests] = useState<GuestWithDisplayName[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debounceTimeout, setDebounceTimeout] = useState<NodeJS.Timeout | null>(null);

  /**
   * Fetch all event guests with computed display names
   */
  const fetchGuests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: guests, error: guestsError } = await supabase
        .from('event_guests')
        .select(`
          *,
          users(*),
          declined_at,
          decline_reason
        `)
        .eq('event_id', eventId);

      if (guestsError) throw guestsError;

      // Transform guests with computed display names
      const guestsWithDisplayNames: GuestWithDisplayName[] = guests?.map(guest => {
        // For authenticated users, check users.phone; for non-authenticated guests, check guest.phone
        const effectivePhone = guest.users?.phone || guest.phone;
        return {
          ...guest,
          displayName: getGuestDisplayName(guest),
          hasValidPhone: Boolean(effectivePhone && effectivePhone.trim()),
          isOptedOut: Boolean(guest.sms_opt_out)
        };
      }) || [];

      setAllGuests(guestsWithDisplayNames);
    } catch (err) {
      console.error('Error fetching guests for preview:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch guests');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  /**
   * Get guest display name with fallback logic
   */
  const getGuestDisplayName = (guest: any): string => {
    // Priority: user full_name → guest_name → phone (last resort)
    return guest.users?.full_name || 
           guest.guest_name || 
           guest.display_name ||
           guest.phone?.slice(-4) || 
           'Unknown Guest';
  };

  /**
   * Filter guests based on current filter criteria
   * Optimized with memoization for performance
   */
  const previewData = useMemo((): RecipientPreviewData => {
    if (!allGuests.length) {
      return {
        guests: [],
        totalCount: 0,
        validRecipientsCount: 0,
        tagCounts: {},
        rsvpStatusCounts: {}
      };
    }

    let filteredGuests = allGuests;

    // RSVP-Lite: Exclude declined guests by default unless explicitly included
    // Check if filter specifically includes declined guests
    const includeDeclined = filter.rsvpStatuses?.includes('declined') || 
                           filter.type === 'individual' ||
                           (filter as any).includeDeclined === true;
    
    if (!includeDeclined) {
      filteredGuests = filteredGuests.filter(guest => !guest.declined_at);
    }

    // Apply filtering logic
    if (filter.type === 'all') {
      // No additional filtering needed (declined already handled above)
    } else if (filter.type === 'individual' && filter.guestIds) {
      filteredGuests = allGuests.filter(guest => 
        filter.guestIds!.includes(guest.id)
      );
    } else {
      // Apply RSVP status filter
      if (filter.rsvpStatuses && filter.rsvpStatuses.length > 0) {
        filteredGuests = filteredGuests.filter(guest => {
          // RSVP-Lite: Map attendance status to filter
          const attendanceStatus = guest.declined_at ? 'declined' : 'attending';
          return filter.rsvpStatuses!.includes(attendanceStatus);
        });
      }

      // Apply tag filter
      if (filter.tags && filter.tags.length > 0) {
        filteredGuests = filteredGuests.filter(guest => {
          const guestTags = guest.guest_tags || [];
          
          if (filter.requireAllTags) {
            // Guest must have ALL specified tags (AND logic)
            return filter.tags!.every(tag => guestTags.includes(tag));
          } else {
            // Guest must have ANY of the specified tags (OR logic)
            return filter.tags!.some(tag => guestTags.includes(tag));
          }
        });
      }
    }

    // Convert to FilteredGuest format
    const guests: FilteredGuest[] = filteredGuests.map(guest => ({
      id: guest.id,
      displayName: guest.displayName,
      tags: guest.guest_tags || [],
      rsvpStatus: guest.declined_at ? 'declined' : 'attending',
      hasPhone: guest.hasValidPhone
    }));

    // Calculate statistics - exclude opted-out guests from valid recipients
    const validRecipientsCount = filteredGuests.filter(g => g.hasValidPhone && !g.isOptedOut).length;
    
    const tagCounts: Record<string, number> = {};
    const rsvpStatusCounts: Record<string, number> = {};

    guests.forEach(guest => {
      // Count tags
      guest.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });

      // Count RSVP statuses
      const status = guest.rsvpStatus || 'pending';
      rsvpStatusCounts[status] = (rsvpStatusCounts[status] || 0) + 1;
    });

    return {
      guests,
      totalCount: guests.length,
      validRecipientsCount,
      tagCounts,
      rsvpStatusCounts
    };
  }, [allGuests, filter]);

  /**
   * Refresh guest data
   */
  const refresh = useCallback(async () => {
    await fetchGuests();
  }, [fetchGuests]);

  // Initial data fetch
  useEffect(() => {
    if (eventId) {
      fetchGuests();
    }
  }, [eventId, fetchGuests]);

  // Set up real-time subscription for guest updates
  useEffect(() => {
    if (!eventId) return;

    const subscription = supabase
      .channel(`event_guests:${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_guests',
          filter: `event_id=eq.${eventId}`
        },
        (payload) => {
          console.log('Guest data updated:', payload);
          // Debounce the refresh to avoid excessive re-renders
          if (debounceTimeout) {
            clearTimeout(debounceTimeout);
          }
          
          const timeout = setTimeout(() => {
            fetchGuests();
          }, debounceMs);
          
          setDebounceTimeout(timeout);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      subscription.unsubscribe();
    };
  }, [eventId, debounceMs, debounceTimeout, fetchGuests]);

  return {
    previewData,
    loading,
    error,
    refresh
  };
}

/**
 * Simplified hook for getting available tags in an event
 * Optimized for filter UI components
 */
export function useAvailableTags(eventId: string) {
  const [tags, setTags] = useState<string[]>([]);
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;

    async function fetchTags() {
      try {
        setLoading(true);
        setError(null);

        // TODO: Create get_event_tag_stats RPC function for efficient tag statistics
        // For now, use manual calculation as fallback
        {
          // Manual calculation of tag statistics
          const { data: guests, error: fallbackError } = await supabase
            .from('event_guests')
            .select('guest_tags')
            .eq('event_id', eventId)
            .not('guest_tags', 'is', null);

          if (fallbackError) throw fallbackError;

          const tagMap = new Map<string, number>();
          guests?.forEach(guest => {
            guest.guest_tags?.forEach(tag => {
              tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
            });
          });

          setTags(Array.from(tagMap.keys()).sort());
          setTagCounts(Object.fromEntries(tagMap));
        }
      } catch (err) {
        console.error('Error fetching available tags:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch tags');
      } finally {
        setLoading(false);
      }
    }

    fetchTags();
  }, [eventId]);

  return {
    tags,
    tagCounts,
    loading,
    error
  };
}
