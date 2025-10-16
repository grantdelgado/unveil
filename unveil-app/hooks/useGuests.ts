import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/app/reference/supabase.types';
import { qk } from '@/lib/queryKeys';
import { invalidate, smartInvalidate } from '@/lib/queryInvalidation';

type EventGuest = Database['public']['Tables']['event_guests']['Row'];
type EventGuestInsert = Database['public']['Tables']['event_guests']['Insert'];
type EventGuestUpdate = Database['public']['Tables']['event_guests']['Update'];

interface UseGuestsReturn {
  // Queries
  guests: EventGuest[] | null;
  loading: boolean;
  error: Error | null;

  // Actions
  getEventGuests: (eventId: string) => Promise<EventGuest[]>;
  addGuest: (guestData: EventGuestInsert) => Promise<EventGuest>;
  updateGuest: (id: string, updates: EventGuestUpdate) => Promise<EventGuest>;
  removeGuest: (id: string) => Promise<void>;
  updateRSVP: (id: string, status: string) => Promise<EventGuest>;
  importGuests: (
    eventId: string,
    guests: EventGuestInsert[],
  ) => Promise<EventGuest[]>;
  refreshGuests: (eventId: string) => Promise<void>;
}

export function useGuests(eventId?: string): UseGuestsReturn {
  const queryClient = useQueryClient();

  // Get guests for a specific event
  const {
    data: guests,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: qk.eventGuests.list(eventId || ''),
    queryFn: async () => {
      if (!eventId) return [];

      const { data, error } = await supabase
        .from('event_guests')
        .select(
          `
          *,
          users:user_id(*)
        `,
        )
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!eventId,
  });

  // Add guest mutation
  const addGuestMutation = useMutation({
    mutationFn: async (guestData: EventGuestInsert): Promise<EventGuest> => {
      // Ensure user is authenticated
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('event_guests')
        .insert(guestData)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      smartInvalidate(queryClient).guestMutation(variables.event_id);
    },
  });

  // Update guest mutation
  const updateGuestMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: EventGuestUpdate;
    }): Promise<EventGuest> => {
      // Ensure user is authenticated
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('event_guests')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      // Note: We invalidate all guest queries since we don't have eventId in this context
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === 'eventGuests' 
      });
    },
  });

  // Remove guest mutation - use soft delete RPC
  const removeGuestMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      // Ensure user is authenticated
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Use soft delete RPC instead of hard delete
      const { error } = await supabase.rpc('soft_delete_guest', {
        p_guest_id: id,
      });

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      // Note: We invalidate all guest queries since we don't have eventId in this context
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === 'eventGuests' 
      });
    },
  });

  // Import multiple guests using canonical add_or_restore_guest RPC
  const importGuestsMutation = useMutation({
    mutationFn: async ({
      eventId,
      guests,
    }: {
      eventId: string;
      guests: EventGuestInsert[];
    }): Promise<EventGuest[]> => {
      // Ensure user is authenticated before making RPC calls
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const results: EventGuest[] = [];

      // Process each guest individually using canonical RPC
      for (const guest of guests) {
        const { data: result, error } = await supabase.rpc(
          'add_or_restore_guest',
          {
            p_event_id: eventId,
            p_phone: guest.phone || '',
            p_name: guest.guest_name || undefined,
            // p_email removed - no longer used in current implementation
            p_role: guest.role || 'guest',
          },
        );

        if (error) {
          throw new Error(
            `Failed to add guest ${guest.guest_name || guest.phone}: ${error.message}`,
          );
        }

        const resultData = result as {
          success: boolean;
          guest_id: string;
          operation: 'restored' | 'updated' | 'inserted';
          event_id: string;
          phone: string;
          name: string;
          email: string;
          role: string;
        };

        if (!result || !resultData.guest_id) {
          throw new Error(
            `Invalid result from add_or_restore_guest: ${JSON.stringify(result)}`,
          );
        }

        // Fetch the created/updated guest record to return
        const { data: guestRecord, error: fetchError } = await supabase
          .from('event_guests')
          .select('*')
          .eq('id', resultData.guest_id)
          .single();

        if (fetchError) {
          throw new Error(
            `Failed to fetch guest record: ${fetchError.message}`,
          );
        }

        results.push(guestRecord);
      }

      return results;
    },
    onSuccess: (_, variables) => {
      smartInvalidate(queryClient).guestMutation(variables.eventId);
    },
  });

  // Helper functions
  const getEventGuests = useCallback(
    async (eventId: string): Promise<EventGuest[]> => {
      // Ensure user is authenticated
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('event_guests')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data;
    },
    [],
  );

  const updateRSVP = useCallback(
    async (id: string, status: string): Promise<EventGuest> => {
      // Ensure user is authenticated
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // RSVP-Lite: rsvp_status column removed, use declined_at instead
      // This function is deprecated - use useHostGuestDecline hook instead
      const { data, error } = await supabase
        .from('event_guests')
        .update({ 
          declined_at: status === 'declined' ? new Date().toISOString() : null 
        })
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    [],
  );

  const refreshGuests = useCallback(
    async (eventId: string): Promise<void> => {
      const inv = invalidate(queryClient);
      await inv.guests.allLists(eventId);
    },
    [queryClient],
  );

  return {
    guests: guests || null,
    loading,
    error: error as Error | null,
    getEventGuests,
    addGuest: addGuestMutation.mutateAsync,
    updateGuest: (id: string, updates: EventGuestUpdate) =>
      updateGuestMutation.mutateAsync({ id, updates }),
    removeGuest: removeGuestMutation.mutateAsync,
    updateRSVP,
    importGuests: (eventId: string, guests: EventGuestInsert[]) =>
      importGuestsMutation.mutateAsync({ eventId, guests }),
    refreshGuests,
  };
}
