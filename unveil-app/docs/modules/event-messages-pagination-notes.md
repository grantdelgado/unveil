# Event Messages Pagination Implementation Notes

## Overview

The Guest View Event Messages module has been enhanced with:
1. **Polished "Jump to latest" control** with neutral/attention states
2. **Cursor-based pagination** for improved performance with large message histories

## Design Polish: "Jump to latest" Control

### Visual States

**Default State (Neutral):**
- `bg-stone-100 hover:bg-stone-200 text-stone-600` - Subtle, low visual weight
- `shadow-md` - Minimal shadow
- Text: "Jump to latest"

**Attention State (New Messages):**
- `bg-white hover:bg-stone-50 text-stone-700` - Elevated appearance
- `shadow-lg ring-1 ring-stone-200` - Enhanced shadow and ring
- `motion-safe:animate-pulse` - Respects `prefers-reduced-motion`
- Text: "New messages"
- Badge: Shows count (1-99, then "99+")

### Accessibility Features

- **ARIA Labels:** Dynamic labels include message count
- **Focus States:** `focus:ring-2 focus:ring-offset-2` with appropriate colors
- **Keyboard Navigation:** Standard tab order and focus management
- **Reduced Motion:** Animations only shown when `prefers-reduced-motion: no-preference`

## Pagination Implementation

### Configuration Constants

```typescript
const INITIAL_WINDOW_SIZE = 30; // Load most recent 30 messages initially
const OLDER_MESSAGES_BATCH_SIZE = 20; // Load 20 older messages per request
```

### Cursor Strategy

**Cursor Format:** `${created_at}:${id}`
- Uses composite key for stable pagination
- Avoids offset-based pagination performance issues
- Works reliably with concurrent inserts

### API Design

**Hook Interface:**
```typescript
const {
  messages,           // Message[] - chronologically ordered
  loading,           // boolean - initial load state
  error,             // string | null - error message
  hasMore,           // boolean - more messages available
  isFetchingOlder,   // boolean - loading older messages
  sendMessage,       // (content: string) => Promise<void>
  fetchOlderMessages // () => Promise<void>
} = useGuestMessages({ eventId, guestId });
```

### Scroll Preservation

When loading older messages:
1. Store `scrollHeight` before fetch
2. Calculate height difference after fetch
3. Adjust `scrollTop` to maintain user's position
4. No jarring jumps or lost context

### Real-time Behavior

**Initial Load:**
- Fetches recent window (30 messages)
- Auto-scrolls to bottom
- Sets up Supabase real-time subscription

**New Message Handling:**
- Fetches only latest message (avoids full refetch)
- Deduplicates by message ID
- Respects user scroll position for auto-scroll decision

**Auto-scroll Logic:**
- User at bottom + new message = auto-scroll
- User scrolled up + new message = show attention state
- User sends message = always auto-scroll

### Performance Optimizations

1. **Lazy Loading:** Only loads recent messages initially
2. **Efficient Real-time:** Single message fetch instead of full refetch
3. **Deduplication:** Prevents duplicate messages during concurrent updates
4. **Memory Management:** No aggressive pruning (messages stay in memory for session)

### Error Handling

**Pagination Errors:**
- Inline error message with retry button
- Non-blocking (main chat still functional)
- Specific error detection for older message failures

**Network Resilience:**
- Real-time subscription auto-reconnects via Supabase
- Retry mechanism for pagination failures
- Graceful degradation when offline

## Database Index Recommendation

For optimal performance at scale:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_pagination 
ON public.messages (event_id, created_at DESC, id);
```

This composite index supports:
- Event filtering (`event_id`)
- Cursor-based pagination (`created_at DESC, id`)
- Real-time latest message queries

## Known Limitations

1. **Memory Growth:** Messages accumulate in memory (no pruning)
2. **Large Batches:** No protection against extremely large message loads
3. **Timezone Handling:** Relies on database timezone consistency
4. **Concurrent Writes:** Edge case where cursor might skip messages (very rare)

## Testing Considerations

**Manual QA Scenarios:**
1. Load event with 100+ messages - verify pagination works
2. Send message while scrolled up - verify attention state
3. Load older messages multiple times - verify scroll preservation
4. Test on slow connection - verify loading states
5. Test reduced motion preference - verify no animations

**Performance Benchmarks:**
- Initial load: < 500ms for 30 messages
- Pagination: < 300ms for 20 additional messages
- Memory usage: ~50KB per 100 messages (rough estimate)

## Migration Notes

**Backward Compatibility:**
- No database schema changes required
- Existing real-time subscriptions continue working
- All RLS policies remain unchanged

**Rollback Strategy:**
- Can revert to previous `useGuestMessages` implementation
- No data loss or corruption risk
- Only UI behavior changes

---

**Implementation Date:** January 2025  
**Constants Location:** `hooks/messaging/useGuestMessages.ts`  
**Pagination Strategy:** Cursor-based with `(created_at, id)` composite key  
**Window Size:** 30 initial, 20 per batch (configurable)
