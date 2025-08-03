/**
 * Centralized Real-time Guest Store
 * 
 * This hook provides a single source of truth for guest data with real-time updates.
 * It replaces multiple individual subscriptions with a single, shared subscription
 * that efficiently distributes updates to all consumers.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { useRealtimeSubscription } from '@/hooks/realtime';
import { getGuestStatusCounts, normalizeRSVPStatus, type RSVPStatus } from '@/lib/types/rsvp';

// Define types locally to avoid circular dependencies
interface OptimizedGuest {
  id: string;
  event_id: string;
  user_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  phone: string;
  rsvp_status: RSVPStatus | null;
  notes: string | null;
  guest_tags: string[] | null;
  role: string;
  created_at: string | null;
  updated_at: string | null;
  users?: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
  } | null;
}

interface GuestStatusCounts {
  total: number;
  attending: number;
  maybe: number;
  declined: number;
  pending: number;
  confirmed: number;
  responded: number;
}

interface GuestStoreState {
  guests: OptimizedGuest[];
  statusCounts: GuestStatusCounts;
  lastUpdated: Date;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  error: Error | null;
}

interface GuestStoreActions {
  refreshGuests: () => Promise<void>;
  updateGuestOptimistically: (guestId: string, updates: Partial<OptimizedGuest>) => void;
  rollbackGuestUpdate: (guestId: string, originalGuest: OptimizedGuest) => void;
  invalidateCache: () => void;
}

type GuestStoreReturn = GuestStoreState & GuestStoreActions;

// Global store instance for sharing state across components
const guestStores = new Map<string, GuestStoreState>();
const storeSubscribers = new Map<string, Set<(state: GuestStoreState) => void>>();

/**
 * Centralized real-time guest store with intelligent update distribution
 */
export function useRealtimeGuestStore(eventId: string): GuestStoreReturn {
  const [localState, setLocalState] = useState<GuestStoreState>(() => 
    guestStores.get(eventId) || {
      guests: [],
      statusCounts: {
        total: 0,
        attending: 0,
        maybe: 0,
        declined: 0,
        pending: 0,
        confirmed: 0,
        responded: 0,
      },
      lastUpdated: new Date(),
      connectionStatus: 'connecting',
      error: null,
    }
  );

  const subscriberRef = useRef<(state: GuestStoreState) => void | null>(null);

  // Subscribe to global state changes
  useEffect(() => {
    const subscriber = (state: GuestStoreState) => {
      setLocalState(state);
    };
    
    subscriberRef.current = subscriber;

    // Add to subscribers
    if (!storeSubscribers.has(eventId)) {
      storeSubscribers.set(eventId, new Set());
    }
    storeSubscribers.get(eventId)!.add(subscriber);

    return () => {
      storeSubscribers.get(eventId)?.delete(subscriber);
      if (storeSubscribers.get(eventId)?.size === 0) {
        storeSubscribers.delete(eventId);
        guestStores.delete(eventId);
      }
    };
  }, [eventId]);

  // Update global state and notify all subscribers
  const updateGlobalState = useCallback((updates: Partial<GuestStoreState>) => {
    const currentState = guestStores.get(eventId) || localState;
    const newState = { ...currentState, ...updates };
    
    guestStores.set(eventId, newState);
    
    // Notify all subscribers
    storeSubscribers.get(eventId)?.forEach(subscriber => {
      subscriber(newState);
    });
  }, [eventId, localState]);

  // Fetch guests from database
  const fetchGuests = useCallback(async (): Promise<OptimizedGuest[]> => {
    try {
      updateGlobalState({ connectionStatus: 'connecting', error: null });

      const { data, error } = await supabase
        .from('event_guests')
        .select(`
          *,
          users (
            id,
            full_name,
            email,
            phone,
            avatar_url
          )
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform and normalize data
      const guests: OptimizedGuest[] = data.map(guest => ({
        ...guest,
        rsvp_status: normalizeRSVPStatus(guest.rsvp_status),
      }));

      const statusCounts = getGuestStatusCounts(guests);

      updateGlobalState({
        guests,
        statusCounts,
        lastUpdated: new Date(),
        connectionStatus: 'connected',
        error: null,
      });

      logger.api('Guest data refreshed', { 
        eventId, 
        guestCount: guests.length,
        statusCounts 
      });

      return guests;
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to fetch guests', err);
      
      updateGlobalState({
        connectionStatus: 'error',
        error: err,
      });

      throw err;
    }
  }, [eventId, updateGlobalState]);

  // Initial data fetch
  useEffect(() => {
    // Only fetch if we don't have recent data
    const currentState = guestStores.get(eventId);
    const isStale = !currentState || 
      Date.now() - currentState.lastUpdated.getTime() > 30000; // 30 seconds

    if (isStale) {
      fetchGuests();
    }
  }, [eventId, fetchGuests]);

  // Real-time subscription with intelligent update handling
  const { } = useRealtimeSubscription({
    subscriptionId: `guest-store-${eventId}`,
    table: 'event_guests',
    event: '*',
    filter: `event_id=eq.${eventId}`,
    enabled: Boolean(eventId),
    performanceOptions: {
      enablePooling: true,
      eventId,
      enableBatching: true,
      batchDelay: 100,
      maxUpdatesPerSecond: 10,
    },
    onDataChange: useCallback(async (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      try {
        const currentState = guestStores.get(eventId);
        if (!currentState) return;

        let updatedGuests = [...currentState.guests];

        switch (payload.eventType) {
          case 'INSERT': {
            const newGuest = payload.new as unknown as OptimizedGuest;
            newGuest.rsvp_status = normalizeRSVPStatus(newGuest.rsvp_status);
            
            // Add new guest to the beginning of the list
            updatedGuests.unshift(newGuest);
            
            logger.realtime('Guest added', { 
              eventId, 
              guestId: newGuest.id,
              guestName: newGuest.guest_name 
            });
            break;
          }

          case 'UPDATE': {
            const updatedGuest = payload.new as unknown as OptimizedGuest;
            updatedGuest.rsvp_status = normalizeRSVPStatus(updatedGuest.rsvp_status);
            
            const index = updatedGuests.findIndex(g => g.id === updatedGuest.id);
            if (index !== -1) {
              updatedGuests[index] = updatedGuest;
              
              // Log significant RSVP changes
              const oldGuest = payload.old as unknown as OptimizedGuest;
              if (oldGuest.rsvp_status !== updatedGuest.rsvp_status) {
                logger.realtime('RSVP status changed', {
                  eventId,
                  guestId: updatedGuest.id,
                  oldStatus: oldGuest.rsvp_status,
                  newStatus: updatedGuest.rsvp_status,
                });
              }
            }
            break;
          }

          case 'DELETE': {
            const deletedGuest = payload.old as unknown as OptimizedGuest;
            updatedGuests = updatedGuests.filter(g => g.id !== deletedGuest.id);
            
            logger.realtime('Guest removed', { 
              eventId, 
              guestId: deletedGuest.id 
            });
            break;
          }
        }

        // Recalculate status counts
        const statusCounts = getGuestStatusCounts(updatedGuests);

        updateGlobalState({
          guests: updatedGuests,
          statusCounts,
          lastUpdated: new Date(),
          connectionStatus: 'connected',
        });

      } catch (error) {
        logger.error('Error processing real-time guest update', error);
        updateGlobalState({
          connectionStatus: 'error',
          error: error as Error,
        });
      }
    }, [eventId, updateGlobalState]),
    onError: useCallback((error: Error) => {
      logger.realtimeError('Guest store subscription error', error);
      updateGlobalState({
        connectionStatus: 'error',
        error,
      });
    }, [updateGlobalState]),
    onStatusChange: useCallback((status: string) => {
      updateGlobalState({
        connectionStatus: status === 'connected' ? 'connected' : 'disconnected',
      });
    }, [updateGlobalState]),
  });

  // Actions
  const refreshGuests = useCallback(async () => {
    await fetchGuests();
  }, [fetchGuests]);

  const updateGuestOptimistically = useCallback((guestId: string, updates: Partial<OptimizedGuest>) => {
    const currentState = guestStores.get(eventId);
    if (!currentState) return;

    const updatedGuests = currentState.guests.map(guest =>
      guest.id === guestId ? { ...guest, ...updates } : guest
    );

    const statusCounts = getGuestStatusCounts(updatedGuests);

    updateGlobalState({
      guests: updatedGuests,
      statusCounts,
      lastUpdated: new Date(),
    });
  }, [eventId, updateGlobalState]);

  const rollbackGuestUpdate = useCallback((guestId: string, originalGuest: OptimizedGuest) => {
    const currentState = guestStores.get(eventId);
    if (!currentState) return;

    const updatedGuests = currentState.guests.map(guest =>
      guest.id === guestId ? originalGuest : guest
    );

    const statusCounts = getGuestStatusCounts(updatedGuests);

    updateGlobalState({
      guests: updatedGuests,
      statusCounts,
      lastUpdated: new Date(),
    });
  }, [eventId, updateGlobalState]);

  const invalidateCache = useCallback(() => {
    updateGlobalState({
      guests: [],
      statusCounts: {
        total: 0,
        attending: 0,
        maybe: 0,
        declined: 0,
        pending: 0,
        confirmed: 0,
        responded: 0,
      },
      lastUpdated: new Date(),
      connectionStatus: 'connecting',
    });
    
    // Trigger fresh fetch
    fetchGuests();
  }, [updateGlobalState, fetchGuests]);

  return {
    ...localState,
    refreshGuests,
    updateGuestOptimistically,
    rollbackGuestUpdate,
    invalidateCache,
  };
}

/**
 * Hook for components that only need guest list data
 */
export function useGuestList(eventId: string) {
  const { guests, connectionStatus, error, refreshGuests } = useRealtimeGuestStore(eventId);
  
  return {
    guests,
    loading: connectionStatus === 'connecting',
    error,
    refresh: refreshGuests,
  };
}

/**
 * Hook for components that only need status counts
 */
export function useGuestStatusCounts(eventId: string) {
  const { statusCounts, connectionStatus, error } = useRealtimeGuestStore(eventId);
  
  return {
    statusCounts,
    loading: connectionStatus === 'connecting',
    error,
  };
}