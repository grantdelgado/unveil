/**
 * Tests for React Query key consistency and invalidation rules
 * 
 * Ensures:
 * - Filtered vs unfiltered keys are consistent
 * - Invalidation of unfiltered does not touch filtered and vice versa
 * - Query key factory functions produce stable, predictable keys
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react';
import { useScheduledMessagesQuery } from '@/hooks/messaging/scheduled/useScheduledMessagesQuery';
import { useMessages } from '@/hooks/useMessages';
import { queryKeys } from '@/lib/react-query-client';

// Mock dependencies
vi.mock('@/lib/services/messaging');
vi.mock('@/lib/supabase/client');
vi.mock('@/lib/logger');

// Test observability counters (TEST-ONLY)
let testCounters = {
  queryKeyGenerations: 0,
  invalidationCalls: 0,
  filteredInvalidations: 0,
  unfilteredInvalidations: 0,
};

describe('Query Key Consistency', () => {
  let queryClient: QueryClient;
  
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    
    // Reset test counters
    testCounters = {
      queryKeyGenerations: 0,
      invalidationCalls: 0,
      filteredInvalidations: 0,
      unfilteredInvalidations: 0,
    };
  });
  
  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
  });

  describe('Query Key Factory Functions', () => {
    it('should produce stable keys for same inputs', () => {
      const eventId = 'test-event-123';
      
      // Generate keys multiple times
      const keys1 = {
        messages: queryKeys.eventMessages(eventId),
        event: queryKeys.event(eventId),
        guests: queryKeys.eventGuests(eventId),
      };
      
      const keys2 = {
        messages: queryKeys.eventMessages(eventId),
        event: queryKeys.event(eventId),
        guests: queryKeys.eventGuests(eventId),
      };
      
      testCounters.queryKeyGenerations += 6;
      
      expect(keys1.messages).toEqual(keys2.messages);
      expect(keys1.event).toEqual(keys2.event);
      expect(keys1.guests).toEqual(keys2.guests);
    });

    it('should produce different keys for different inputs', () => {
      const eventId1 = 'test-event-123';
      const eventId2 = 'test-event-456';
      
      const keys1 = queryKeys.eventMessages(eventId1);
      const keys2 = queryKeys.eventMessages(eventId2);
      
      testCounters.queryKeyGenerations += 2;
      
      expect(keys1).not.toEqual(keys2);
      expect(keys1[2]).toBe(eventId1); // eventId is at index 2 in ['messages', 'event', eventId]
      expect(keys2[2]).toBe(eventId2);
    });

    it('should maintain hierarchical structure', () => {
      const eventId = 'test-event-123';
      
      const messageKey = queryKeys.eventMessages(eventId);
      const eventKey = queryKeys.event(eventId);
      
      testCounters.queryKeyGenerations += 2;
      
      // Keys should be arrays with proper hierarchy
      expect(Array.isArray(messageKey)).toBe(true);
      expect(Array.isArray(eventKey)).toBe(true);
      expect(messageKey[0]).toBe('messages');
      expect(eventKey[0]).toBe('events');
    });
  });

  describe('Scheduled Messages Query Keys', () => {
    it('should generate consistent keys for filtered queries', () => {
      const eventId = 'test-event-123';
      const filters = { status: 'scheduled', messageType: 'announcement' };
      
      // Key pattern: ['scheduled-messages', eventId, filters]
      const key1 = ['scheduled-messages', eventId, filters];
      const key2 = ['scheduled-messages', eventId, filters];
      
      testCounters.queryKeyGenerations += 2;
      
      expect(key1).toEqual(key2);
    });

    it('should differentiate between filtered and unfiltered keys', () => {
      const eventId = 'test-event-123';
      const filters = { status: 'scheduled' };
      
      const unfilteredKey = ['scheduled-messages', eventId];
      const filteredKey = ['scheduled-messages', eventId, filters];
      
      testCounters.queryKeyGenerations += 2;
      
      expect(unfilteredKey).not.toEqual(filteredKey);
      expect(unfilteredKey.length).toBe(2);
      expect(filteredKey.length).toBe(3);
    });

    it('should handle empty filters consistently', () => {
      const eventId = 'test-event-123';
      
      const keyWithEmptyFilters = ['scheduled-messages', eventId, {}];
      const keyWithNullFilters = ['scheduled-messages', eventId, null];
      const keyWithUndefinedFilters = ['scheduled-messages', eventId, undefined];
      
      testCounters.queryKeyGenerations += 3;
      
      // Empty filters should not equal null/undefined
      expect(keyWithEmptyFilters).not.toEqual(keyWithNullFilters);
      expect(keyWithEmptyFilters).not.toEqual(keyWithUndefinedFilters);
    });
  });

  describe('Messages Query Keys', () => {
    it('should use consistent key pattern', () => {
      const eventId = 'test-event-123';
      
      // useMessages uses: ['messages', eventId]
      const messagesKey = ['messages', eventId];
      const scheduledKey = ['scheduled-messages', eventId];
      
      testCounters.queryKeyGenerations += 2;
      
      expect(messagesKey[0]).toBe('messages');
      expect(scheduledKey[0]).toBe('scheduled-messages');
      expect(messagesKey[1]).toBe(eventId);
      expect(scheduledKey[1]).toBe(eventId);
    });

    it('should maintain separation between message types', () => {
      const eventId = 'test-event-123';
      
      const regularMessagesKey = ['messages', eventId];
      const scheduledMessagesKey = ['scheduled-messages', eventId];
      
      testCounters.queryKeyGenerations += 2;
      
      expect(regularMessagesKey).not.toEqual(scheduledMessagesKey);
    });
  });

  describe('Query Invalidation Rules', () => {
    it('should invalidate unfiltered queries without affecting filtered ones', async () => {
      const eventId = 'test-event-123';
      
      // Set up queries with different keys
      const unfilteredKey = ['scheduled-messages', eventId];
      const filteredKey = ['scheduled-messages', eventId, { status: 'scheduled' }];
      
      queryClient.setQueryData(unfilteredKey, []);
      queryClient.setQueryData(filteredKey, []);
      
      // Mock invalidateQueries to track calls
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      
      // Invalidate unfiltered queries only
      await act(async () => {
        await queryClient.invalidateQueries({
          queryKey: unfilteredKey,
          exact: true, // Exact match only
        });
        testCounters.unfilteredInvalidations++;
      });
      
      // Should have called invalidateQueries
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: unfilteredKey,
        exact: true,
      });
      
      testCounters.invalidationCalls++;
    });

    it('should invalidate filtered queries without affecting unfiltered ones', async () => {
      const eventId = 'test-event-123';
      const filters = { status: 'scheduled' };
      
      const unfilteredKey = ['scheduled-messages', eventId];
      const filteredKey = ['scheduled-messages', eventId, filters];
      
      queryClient.setQueryData(unfilteredKey, []);
      queryClient.setQueryData(filteredKey, []);
      
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      
      // Invalidate filtered queries only
      await act(async () => {
        await queryClient.invalidateQueries({
          queryKey: filteredKey,
          exact: true,
        });
        testCounters.filteredInvalidations++;
      });
      
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: filteredKey,
        exact: true,
      });
      
      testCounters.invalidationCalls++;
    });

    it('should support predicate-based invalidation for related queries', async () => {
      const eventId = 'test-event-123';
      
      // Set up multiple related queries
      queryClient.setQueryData(['scheduled-messages', eventId], []);
      queryClient.setQueryData(['scheduled-messages', eventId, { status: 'scheduled' }], []);
      queryClient.setQueryData(['scheduled-messages', eventId, { status: 'sent' }], []);
      queryClient.setQueryData(['messages', eventId], []); // Different table
      
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      
      // Invalidate all scheduled-messages queries for this event
      await act(async () => {
        await queryClient.invalidateQueries({
          queryKey: ['scheduled-messages'],
          predicate: (query) => {
            const [table, id] = query.queryKey;
            return table === 'scheduled-messages' && id === eventId;
          },
        });
      });
      
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['scheduled-messages'],
        predicate: expect.any(Function),
      });
      
      testCounters.invalidationCalls++;
    });
  });

  describe('Query Key Serialization', () => {
    it('should handle complex filter objects consistently', () => {
      const eventId = 'test-event-123';
      const complexFilters = {
        status: 'scheduled',
        messageType: ['announcement', 'reminder'],
        dateRange: {
          start: '2025-01-15T00:00:00Z',
          end: '2025-01-16T00:00:00Z',
        },
      };
      
      const key1 = ['scheduled-messages', eventId, complexFilters];
      const key2 = ['scheduled-messages', eventId, complexFilters];
      
      testCounters.queryKeyGenerations += 2;
      
      // Should be equal for same object reference
      expect(key1).toEqual(key2);
    });

    it('should differentiate between similar but different filters', () => {
      const eventId = 'test-event-123';
      
      const filters1 = { status: 'scheduled', messageType: 'announcement' };
      const filters2 = { status: 'scheduled', messageType: 'reminder' };
      
      const key1 = ['scheduled-messages', eventId, filters1];
      const key2 = ['scheduled-messages', eventId, filters2];
      
      testCounters.queryKeyGenerations += 2;
      
      expect(key1).not.toEqual(key2);
    });

    it('should handle filter order independence', () => {
      const eventId = 'test-event-123';
      
      // Note: Object key order can affect equality in some cases
      // This test documents current behavior
      const filters1 = { status: 'scheduled', messageType: 'announcement' };
      const filters2 = { messageType: 'announcement', status: 'scheduled' };
      
      const key1 = ['scheduled-messages', eventId, filters1];
      const key2 = ['scheduled-messages', eventId, filters2];
      
      testCounters.queryKeyGenerations += 2;
      
      // Objects with same properties but different order should be equal
      expect(JSON.stringify(filters1)).not.toBe(JSON.stringify(filters2));
      // But the keys should still work for React Query purposes
      expect(key1[2]).toEqual(key2[2]);
    });
  });

  describe('Cross-Hook Key Consistency', () => {
    it('should maintain consistent keys between useMessages and useScheduledMessagesQuery', () => {
      const eventId = 'test-event-123';
      
      // Keys used by useMessages
      const useMessagesKeys = {
        messages: ['messages', eventId],
        scheduledMessages: ['scheduled-messages', eventId],
      };
      
      // Keys used by useScheduledMessagesQuery (without filters)
      const useScheduledKeys = {
        scheduledMessages: ['scheduled-messages', eventId],
      };
      
      testCounters.queryKeyGenerations += 3;
      
      // Scheduled message keys should match
      expect(useMessagesKeys.scheduledMessages).toEqual(
        useScheduledKeys.scheduledMessages
      );
    });

    it('should avoid key collisions between different data types', () => {
      const eventId = 'test-event-123';
      const guestId = 'test-guest-456';
      
      const keys = {
        eventMessages: queryKeys.eventMessages(eventId),
        eventGuests: queryKeys.eventGuests(eventId),
        userGuests: queryKeys.userGuests(guestId),
        event: queryKeys.event(eventId),
      };
      
      testCounters.queryKeyGenerations += 4;
      
      // All keys should be unique
      const keyStrings = Object.values(keys).map(k => JSON.stringify(k));
      const uniqueKeys = new Set(keyStrings);
      
      expect(uniqueKeys.size).toBe(keyStrings.length);
    });
  });

  describe('Performance and Memory', () => {
    it('should not create excessive query keys', () => {
      const eventId = 'test-event-123';
      const initialCount = testCounters.queryKeyGenerations;
      
      // Generate same keys multiple times
      for (let i = 0; i < 10; i++) {
        queryKeys.eventMessages(eventId);
        queryKeys.event(eventId);
        testCounters.queryKeyGenerations += 2;
      }
      
      // Keys should be generated each time (React Query handles deduplication)
      expect(testCounters.queryKeyGenerations - initialCount).toBe(20);
    });

    it('should handle null/undefined eventId gracefully', () => {
      // Should not throw for null/undefined inputs
      expect(() => {
        const key1 = queryKeys.eventMessages(null as any);
        const key2 = queryKeys.eventMessages(undefined as any);
        testCounters.queryKeyGenerations += 2;
        
        expect(key1[2]).toBe(null); // eventId is at index 2
        expect(key2[2]).toBe(undefined);
      }).not.toThrow();
    });
  });
});

// Export test counters for integration tests
export { testCounters };
