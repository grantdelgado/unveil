import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/app/reference/supabase.types';

type Event = Database['public']['Tables']['events']['Row'];
type EventInsert = Database['public']['Tables']['events']['Insert'];
type EventUpdate = Database['public']['Tables']['events']['Update'];

interface UseEventsReturn {
  // Queries
  events: Event[] | null;
  currentEvent: Event | null;
  loading: boolean;
  error: Error | null;
  
  // Actions
  createEvent: (eventData: EventInsert) => Promise<Event>;
  updateEvent: (id: string, updates: EventUpdate) => Promise<Event>;
  deleteEvent: (id: string) => Promise<void>;
  getEventById: (id: string) => Promise<Event | null>;
  getUserEvents: () => Promise<Event[]>;
  getHostEvents: () => Promise<Event[]>;
  refreshEvents: () => Promise<void>;
}

export function useEvents(): UseEventsReturn {
  const queryClient = useQueryClient();
  
  // Get all events for current user
  const { data: events, isLoading: loading, error } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          host:users!events_host_user_id_fkey(*)
        `)
        .order('event_date', { ascending: true });
      
      if (error) throw new Error(error.message);
      return data as Event[];
    },
  });

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async (eventData: EventInsert): Promise<Event> => {
      const { data, error } = await supabase
        .from('events')
        .insert(eventData)
        .select('*')
        .single();
      
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });

  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: EventUpdate }): Promise<Event> => {
      const { data, error } = await supabase
        .from('events')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();
      
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);
      
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });

  // Helper functions
  const getEventById = useCallback(async (id: string): Promise<Event | null> => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) return null;
    return data;
  }, []);

  const getUserEvents = useCallback(async (): Promise<Event[]> => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: true });
    
    if (error) throw new Error(error.message);
    return data;
  }, []);

  const getHostEvents = useCallback(async (): Promise<Event[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('host_user_id', user.id)
      .order('event_date', { ascending: true });
    
    if (error) throw new Error(error.message);
    return data;
  }, []);

  const refreshEvents = useCallback(async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['events'] });
  }, [queryClient]);

  return {
    events: events || null,
    currentEvent: null, // Can be enhanced later for single event queries
    loading,
    error: error as Error | null,
    createEvent: createEventMutation.mutateAsync,
    updateEvent: (id: string, updates: EventUpdate) => 
      updateEventMutation.mutateAsync({ id, updates }),
    deleteEvent: deleteEventMutation.mutateAsync,
    getEventById,
    getUserEvents,
    getHostEvents,
    refreshEvents,
  };
} 