import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/app/reference/supabase.types';

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
  importGuests: (eventId: string, guests: EventGuestInsert[]) => Promise<EventGuest[]>;
  refreshGuests: (eventId: string) => Promise<void>;
}

export function useGuests(eventId?: string): UseGuestsReturn {
  const queryClient = useQueryClient();
  
  // Get guests for a specific event
  const { data: guests, isLoading: loading, error } = useQuery({
    queryKey: ['guests', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      
      const { data, error } = await supabase
        .from('event_guests')
        .select(`
          *,
          users:user_id(*)
        `)
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
      const { data, error } = await supabase
        .from('event_guests')
        .insert(guestData)
        .select('*')
        .single();
      
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['guests', variables.event_id] });
    },
  });

  // Update guest mutation
  const updateGuestMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: EventGuestUpdate }): Promise<EventGuest> => {
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
      queryClient.invalidateQueries({ queryKey: ['guests'] });
    },
  });

  // Remove guest mutation
  const removeGuestMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('event_guests')
        .delete()
        .eq('id', id);
      
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guests'] });
    },
  });

  // Import multiple guests using canonical add_or_restore_guest RPC
  const importGuestsMutation = useMutation({
    mutationFn: async ({ eventId, guests }: { eventId: string; guests: EventGuestInsert[] }): Promise<EventGuest[]> => {
      const results: EventGuest[] = [];
      
      // Process each guest individually using canonical RPC
      for (const guest of guests) {
        const { data: result, error } = await supabase
          .rpc('add_or_restore_guest', {
            p_event_id: eventId,
            p_phone: guest.phone,
            p_name: guest.guest_name,
            p_email: guest.guest_email,
            p_role: guest.role || 'guest'
          });

        if (error) {
          throw new Error(`Failed to add guest ${guest.guest_name || guest.phone}: ${error.message}`);
        }

        // Fetch the created/updated guest record to return
        const { data: guestRecord, error: fetchError } = await supabase
          .from('event_guests')
          .select('*')
          .eq('id', result.guest_id)
          .single();

        if (fetchError) {
          throw new Error(`Failed to fetch guest record: ${fetchError.message}`);
        }

        results.push(guestRecord);
      }
      
      return results;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['guests', variables.eventId] });
    },
  });

  // Helper functions
  const getEventGuests = useCallback(async (eventId: string): Promise<EventGuest[]> => {
    const { data, error } = await supabase
      .from('event_guests')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    
    if (error) throw new Error(error.message);
    return data;
  }, []);

  const updateRSVP = useCallback(async (id: string, status: string): Promise<EventGuest> => {
    const { data, error } = await supabase
      .from('event_guests')
      .update({ rsvp_status: status })
      .eq('id', id)
      .select('*')
      .single();
    
    if (error) throw new Error(error.message);
    return data;
  }, []);

  const refreshGuests = useCallback(async (eventId: string): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['guests', eventId] });
  }, [queryClient]);

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
