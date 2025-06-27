'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  getEventTags, 
  getEventGuests, 
  createTag, 
  updateTag, 
  deleteTag, 
  assignTagsToGuests, 
  removeTagsFromGuests,
  getGuestsByTags,
  bulkTagOperation,
  type TagStats,
  type TagAssignmentResult,
  type BulkTagAssignment
} from '@/services/messaging/tags';
import { useRealtimeSubscription } from '@/hooks/realtime/useRealtimeSubscription';
import type { Tables } from '@/app/reference/supabase.types';

type EventGuest = Tables<'event_guests'>;

interface UseGuestTagsOptions {
  enableRealtime?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseGuestTagsReturn {
  // Data
  tags: string[];
  tagStats: TagStats[];
  guests: EventGuest[];
  loading: boolean;
  error: string | null;

  // CRUD Operations
  createTag: (tagName: string, initialGuestIds?: string[]) => Promise<void>;
  updateTag: (oldTag: string, newTag: string) => Promise<void>;
  deleteTag: (tagName: string) => Promise<void>;

  // Tag Assignment
  assignTagsToGuests: (guestIds: string[], tags: string[]) => Promise<TagAssignmentResult>;
  removeTagsFromGuests: (guestIds: string[], tags: string[]) => Promise<TagAssignmentResult>;
  bulkTagOperation: (operation: BulkTagAssignment) => Promise<TagAssignmentResult>;

  // Queries
  getGuestsByTags: (tags: string[], requireAllTags?: boolean) => EventGuest[];
  getTagUsageCount: (tagName: string) => number;
  getGuestTags: (guestId: string) => string[];

  // Utilities
  refresh: () => Promise<void>;
  reset: () => void;
}

export function useGuestTags(
  eventId: string,
  options: UseGuestTagsOptions = {}
): UseGuestTagsReturn {
  const {
    enableRealtime = true,
    autoRefresh = false,
    refreshInterval = 30000 // 30 seconds
  } = options;

  // State
  const [tagStats, setTagStats] = useState<TagStats[]>([]);
  const [guests, setGuests] = useState<EventGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Derived data
  const tags = useMemo(() => 
    tagStats.map(stat => stat.tag).sort(),
    [tagStats]
  );

  // Load initial data
  const loadData = useCallback(async () => {
    if (!eventId) return;

    try {
      setLoading(true);
      setError(null);

      const [tagsData, guestsData] = await Promise.all([
        getEventTags(eventId),
        getEventGuests(eventId)
      ]);

      setTagStats(tagsData);
      setGuests(guestsData);
    } catch (err) {
      console.error('Error loading tag data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tags');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  // Refresh data
  const refresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  // Reset state
  const reset = useCallback(() => {
    setTagStats([]);
    setGuests([]);
    setLoading(false);
    setError(null);
  }, []);

  // Real-time subscription for guest changes
  useRealtimeSubscription({
    subscriptionId: `guest-tags-${eventId}`,
    enabled: enableRealtime && !!eventId,
    table: 'event_guests',
    event: '*',
    filter: `event_id=eq.${eventId}`,
    onDataChange: (payload) => {
      // Refresh data on any change to event_guests table
      refresh();
    },
    onError: (error) => {
      console.error('Real-time subscription error:', error);
      setError(error.message);
    }
  });

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh || !eventId) return;

    const interval = setInterval(refresh, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refresh, eventId]);

  // Load data on mount or eventId change
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Tag CRUD operations with optimistic updates
  const handleCreateTag = useCallback(async (
    tagName: string, 
    initialGuestIds?: string[]
  ): Promise<void> => {
    try {
      const newTagStat = await createTag(eventId, tagName, initialGuestIds);
      
      // Optimistic update
      setTagStats(prev => [...prev, newTagStat].sort((a, b) => b.guestCount - a.guestCount));
      
      // Refresh to ensure consistency
      setTimeout(refresh, 100);
    } catch (err) {
      console.error('Error creating tag:', err);
      throw err;
    }
  }, [eventId, refresh]);

  const handleUpdateTag = useCallback(async (
    oldTag: string, 
    newTag: string
  ): Promise<void> => {
    try {
      const updatedTagStat = await updateTag(eventId, oldTag, newTag);
      
      // Optimistic update
      setTagStats(prev => 
        prev.map(stat => 
          stat.tag === oldTag 
            ? { ...stat, tag: updatedTagStat.tag }
            : stat
        )
      );
      
      // Update guests optimistically
      setGuests(prev => 
        prev.map(guest => ({
          ...guest,
          guest_tags: guest.guest_tags?.map(tag => 
            tag === oldTag ? newTag : tag
          ) || null
        }))
      );
      
      // Refresh to ensure consistency
      setTimeout(refresh, 100);
    } catch (err) {
      console.error('Error updating tag:', err);
      // Revert optimistic update on error
      refresh();
      throw err;
    }
  }, [eventId, refresh]);

  const handleDeleteTag = useCallback(async (tagName: string): Promise<void> => {
    try {
      await deleteTag(eventId, tagName);
      
      // Optimistic update
      setTagStats(prev => prev.filter(stat => stat.tag !== tagName));
      setGuests(prev => 
        prev.map(guest => ({
          ...guest,
          guest_tags: guest.guest_tags?.filter(tag => tag !== tagName) || null
        }))
      );
      
      // Refresh to ensure consistency
      setTimeout(refresh, 100);
    } catch (err) {
      console.error('Error deleting tag:', err);
      // Revert optimistic update on error
      refresh();
      throw err;
    }
  }, [eventId, refresh]);

  // Tag assignment operations
  const handleAssignTagsToGuests = useCallback(async (
    guestIds: string[], 
    tagsToAssign: string[]
  ): Promise<TagAssignmentResult> => {
    try {
      const result = await assignTagsToGuests(eventId, guestIds, tagsToAssign);
      
      // Refresh data after successful assignment
      if (result.success) {
        setTimeout(refresh, 100);
      }
      
      return result;
    } catch (err) {
      console.error('Error assigning tags:', err);
      throw err;
    }
  }, [eventId, refresh]);

  const handleRemoveTagsFromGuests = useCallback(async (
    guestIds: string[], 
    tagsToRemove: string[]
  ): Promise<TagAssignmentResult> => {
    try {
      const result = await removeTagsFromGuests(eventId, guestIds, tagsToRemove);
      
      // Refresh data after successful removal
      if (result.success) {
        setTimeout(refresh, 100);
      }
      
      return result;
    } catch (err) {
      console.error('Error removing tags:', err);
      throw err;
    }
  }, [eventId, refresh]);

  const handleBulkTagOperation = useCallback(async (
    operation: BulkTagAssignment
  ): Promise<TagAssignmentResult> => {
    try {
      const result = await bulkTagOperation(eventId, operation);
      
      // Refresh data after successful operation
      if (result.success) {
        setTimeout(refresh, 100);
      }
      
      return result;
    } catch (err) {
      console.error('Error in bulk tag operation:', err);
      throw err;
    }
  }, [eventId, refresh]);

  // Query utilities
  const getGuestsByTagsLocal = useCallback((
    tagsToMatch: string[], 
    requireAllTags = false
  ): EventGuest[] => {
    if (tagsToMatch.length === 0) return [];

    const normalizedTags = tagsToMatch.map(tag => tag.toLowerCase());

    return guests.filter(guest => {
      if (!guest.guest_tags || guest.guest_tags.length === 0) return false;

      const guestTags = guest.guest_tags.map(tag => tag.toLowerCase());

      if (requireAllTags) {
        return normalizedTags.every(tag => guestTags.includes(tag));
      } else {
        return normalizedTags.some(tag => guestTags.includes(tag));
      }
    });
  }, [guests]);

  const getTagUsageCount = useCallback((tagName: string): number => {
    const tagStat = tagStats.find(stat => stat.tag.toLowerCase() === tagName.toLowerCase());
    return tagStat?.guestCount || 0;
  }, [tagStats]);

  const getGuestTags = useCallback((guestId: string): string[] => {
    const guest = guests.find(g => g.id === guestId);
    return guest?.guest_tags || [];
  }, [guests]);

  return {
    // Data
    tags,
    tagStats,
    guests,
    loading,
    error,

    // CRUD Operations
    createTag: handleCreateTag,
    updateTag: handleUpdateTag,
    deleteTag: handleDeleteTag,

    // Tag Assignment
    assignTagsToGuests: handleAssignTagsToGuests,
    removeTagsFromGuests: handleRemoveTagsFromGuests,
    bulkTagOperation: handleBulkTagOperation,

    // Queries
    getGuestsByTags: getGuestsByTagsLocal,
    getTagUsageCount,
    getGuestTags,

    // Utilities
    refresh,
    reset
  };
} 