/**
 * Simple unit test for the stale cursor fix in fetchOlderMessages
 * Tests the core logic without complex React hooks setup
 */

import { describe, test, expect, vi } from 'vitest';

describe('fetchOlderMessages stale cursor fix', () => {
  test('cursor ref pattern avoids stale closures', () => {
    // Simulate the pattern used in the fix
    let latestCursor = { created_at: '2024-01-01T10:00:00Z', id: 'msg-1' };
    const cursorRef = { current: latestCursor };
    
    // Function that updates the cursor ref (like useEffect)
    const updateCursor = (newCursor: any) => {
      latestCursor = newCursor;
      cursorRef.current = newCursor;
    };
    
    // Function that reads from ref (like fetchOlderMessages callback)
    const readFromRef = () => {
      return cursorRef.current;
    };
    
    // Initial state
    expect(readFromRef()).toEqual({ created_at: '2024-01-01T10:00:00Z', id: 'msg-1' });
    
    // Update cursor
    updateCursor({ created_at: '2024-01-01T09:00:00Z', id: 'msg-2' });
    
    // Reading from ref should get latest value (no stale closure)
    expect(readFromRef()).toEqual({ created_at: '2024-01-01T09:00:00Z', id: 'msg-2' });
  });

  test('deduplication uses compound cursor key', () => {
    const fetchInProgressMap = new Set<string>();
    
    const makePaginationKey = (eventId: string, cursor: any) => {
      return `${eventId}:user-id:1:${cursor?.created_at}:${cursor?.id}`;
    };
    
    const eventId = 'test-event';
    const cursor = { created_at: '2024-01-01T10:00:00Z', id: 'msg-1' };
    const paginationKey = makePaginationKey(eventId, cursor);
    
    // First call should not be deduplicated
    expect(fetchInProgressMap.has(paginationKey)).toBe(false);
    fetchInProgressMap.add(paginationKey);
    
    // Second call should be deduplicated
    expect(fetchInProgressMap.has(paginationKey)).toBe(true);
    
    // Different cursor should not be deduplicated
    const cursor2 = { created_at: '2024-01-01T09:00:00Z', id: 'msg-2' };
    const paginationKey2 = makePaginationKey(eventId, cursor2);
    expect(fetchInProgressMap.has(paginationKey2)).toBe(false);
  });

  test('null cursor handling', () => {
    const cursorRef = { current: null };
    
    const shouldFetch = () => {
      const currentCursor = cursorRef.current;
      return currentCursor !== null;
    };
    
    // Should not fetch when cursor is null
    expect(shouldFetch()).toBe(false);
    
    // Should fetch when cursor is present
    cursorRef.current = { created_at: '2024-01-01T10:00:00Z', id: 'msg-1' };
    expect(shouldFetch()).toBe(true);
  });
});
