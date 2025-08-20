# Realtime Subscription Management

This directory contains the centralized realtime subscription management system for Unveil's Supabase integration. The system provides stable, self-healing WebSocket connections with comprehensive error recovery and monitoring.

## Architecture Overview

### Core Components

- **`SubscriptionManager.ts`** - Centralized subscription management with token refresh, error recovery, and health monitoring
- **`subscriptions.ts`** - Utility functions and helper methods for subscription management
- **`../hooks/realtime/`** - React hooks that interface with the subscription manager

### Key Features

- ✅ **Token Refresh Integration** - Automatic `supabase.realtime.setAuth()` calls on token refresh
- ✅ **Network State Handling** - Auto-reconnection on online/offline changes
- ✅ **Visibility Management** - Mobile Safari backgrounding support
- ✅ **Error Recovery** - Exponential backoff with intelligent retry logic
- ✅ **Health Monitoring** - Real-time connection health scoring
- ✅ **Memory Management** - Automatic cleanup and leak prevention
- ✅ **Development Tools** - Debug panel and test utilities (dev-only)

## Usage Patterns

### Basic Subscription

```typescript
import { getSubscriptionManager } from '@/lib/realtime/SubscriptionManager';

const subscriptionManager = getSubscriptionManager();

const unsubscribe = subscriptionManager.subscribe('my-subscription', {
  table: 'messages',
  event: 'INSERT',
  schema: 'public',
  filter: 'event_id=eq.123',
  callback: (payload) => {
    console.log('New message:', payload);
  },
  onError: (error) => {
    console.error('Subscription error:', error);
  },
  onStatusChange: (status) => {
    console.log('Connection status:', status);
  },
  // Stability configuration
  enableBackoff: true,
  maxRetries: 3,
  timeoutMs: 30000,
  retryOnTimeout: true
});

// Always clean up
unsubscribe();
```

### React Hook Integration

```typescript
import { useEventSubscription } from '@/hooks/realtime';

function MyComponent({ eventId }: { eventId: string }) {
  useEventSubscription({
    eventId,
    table: 'messages',
    event: 'INSERT',
    filter: `event_id=eq.${eventId}`,
    onDataChange: (payload) => {
      // Handle new data
    },
    enabled: Boolean(eventId),
    performanceOptions: {
      enablePooling: true, // Use shared connections
      eventId
    }
  });
}
```

### Guest-Specific Subscriptions

For guest dashboard subscriptions, always use event and user-specific filtering:

```typescript
// ✅ Good - Specific filtering
useEventSubscription({
  eventId,
  table: 'event_guests',
  event: '*',
  filter: `event_id=eq.${eventId}.and.user_id=eq.${userId}`,
  // ...
});

// ❌ Bad - Too broad, will receive unrelated updates
useEventSubscription({
  eventId,
  table: 'event_guests',
  event: '*',
  // No filter - receives all guest updates
});
```

## Extending for New Tables

### 1. Add New Table Subscription

```typescript
// In your component or hook
const unsubscribe = subscriptionManager.subscribe(`my-new-table-${eventId}`, {
  table: 'my_new_table',
  event: 'INSERT',
  schema: 'public',
  filter: `event_id=eq.${eventId}`, // Always filter by event
  callback: handleNewData,
  onError: handleError,
  // Use standard stability config
  enableBackoff: true,
  maxRetries: 3,
  timeoutMs: 30000
});
```

### 2. Create Reusable Hook

```typescript
// hooks/realtime/useMyNewTableSubscription.ts
import { useEventSubscription } from '@/hooks/realtime';

export function useMyNewTableSubscription({
  eventId,
  onDataChange,
  enabled = true
}: {
  eventId: string;
  onDataChange: (payload: any) => void;
  enabled?: boolean;
}) {
  return useEventSubscription({
    eventId,
    table: 'my_new_table',
    event: '*',
    filter: `event_id=eq.${eventId}`,
    onDataChange,
    enabled,
    performanceOptions: {
      enablePooling: true,
      eventId
    }
  });
}
```

### 3. Add to Guest Dashboard (if applicable)

```typescript
// In guest component
const { } = useMyNewTableSubscription({
  eventId,
  onDataChange: (payload) => {
    // Handle guest-specific updates
  },
  enabled: Boolean(eventId && currentUserId)
});
```

## Testing & Validation

### Playwright Stability Tests

Run comprehensive stability tests:

```bash
# Run all realtime stability tests
npx playwright test tests/realtime/subscription-stability.spec.ts

# Run with UI for debugging
npx playwright test tests/realtime/subscription-stability.spec.ts --ui

# Run specific test
npx playwright test tests/realtime/subscription-stability.spec.ts -g "idle period"
```

Test coverage includes:
- ✅ 15+ minute idle behavior
- ✅ Network offline/online recovery  
- ✅ Page visibility changes
- ✅ Duplicate subscription prevention
- ✅ Token refresh handling

### Development Test Utilities

In development mode, access manual testing utilities:

```javascript
// Available in browser console (development only)
window.realtimeTests.runAllStabilityTests();
window.realtimeTests.testNetworkStateHandling();
window.realtimeTests.testVisibilityHandling();
```

Or use the debug panel:
- Open guest dashboard in development
- Look for debug panel in bottom-right corner
- Click "Run Stability Tests" button

### Debug Panel

The debug panel (development only) shows:
- Active subscription count and health scores
- Connection state and error counts  
- Individual subscription details
- Manual reconnect and test buttons

## Production Readiness Checklist

### Before Deployment

- [ ] All subscriptions use specific filters (no global listeners)
- [ ] Error handling implemented for all subscription callbacks
- [ ] Cleanup functions called on component unmount
- [ ] No raw `supabase.channel()` calls (use SubscriptionManager)
- [ ] Debug utilities excluded from production build

### Health Monitoring

Check these metrics in production:

1. **Connection Stability**
   ```typescript
   const stats = subscriptionManager.getStats();
   console.log('Health Score:', stats.healthScore); // Should be >80
   console.log('Error Rate:', stats.errorCount); // Should be low
   ```

2. **Memory Usage**
   - Monitor for memory leaks during long sessions
   - Check that subscriptions are properly cleaned up

3. **Console Logs**
   - Should see minimal errors (only unrecoverable issues)
   - Recoverable errors appear as warnings/info
   - No repeated connection failures

### Performance Benchmarks

Expected performance characteristics:

- **Connection Time**: <2 seconds for initial subscription
- **Recovery Time**: 5-30 seconds after network restoration  
- **Memory Usage**: <5MB additional for realtime connections
- **CPU Impact**: <1% during normal operation
- **Idle Stability**: No errors after 15+ minutes idle

## Troubleshooting

### Common Issues

**1. Subscriptions Not Connecting**
```bash
# Check auth state
supabase.auth.getSession()

# Check RLS policies
# Ensure user has SELECT permissions on subscribed tables
```

**2. Frequent Disconnections**
```typescript
// Check health score
const stats = subscriptionManager.getStats();
if (stats.healthScore < 50) {
  // Investigate network or auth issues
}
```

**3. Memory Leaks**
```typescript
// Ensure cleanup in useEffect
useEffect(() => {
  const unsubscribe = subscriptionManager.subscribe(/*...*/);
  return unsubscribe; // ✅ Always return cleanup function
}, []);
```

**4. Duplicate Subscriptions**
```typescript
// Use stable subscription IDs
const subscriptionId = `messages-${eventId}-${userId}`; // ✅ Deterministic
const subscriptionId = `messages-${Math.random()}`; // ❌ Creates duplicates
```

### Debug Commands

```typescript
// Get detailed subscription info
subscriptionManager.getSubscriptionDetails();

// Force reconnect all subscriptions
subscriptionManager.reconnectAll();

// Get health statistics
subscriptionManager.getStats();
```

## Migration Guide

### From Raw Channels

If you have existing raw Supabase channels:

```typescript
// ❌ Old pattern - Raw channels
const channel = supabase
  .channel('my-channel')
  .on('postgres_changes', { /*...*/ }, callback)
  .subscribe();

// ✅ New pattern - Managed subscriptions
const unsubscribe = subscriptionManager.subscribe('my-channel', {
  table: 'my_table',
  event: 'INSERT',
  callback,
  enableBackoff: true,
  maxRetries: 3
});
```

### From Legacy Hooks

Replace legacy hooks with managed equivalents:

```typescript
// ❌ Old - Direct channel usage
import { useGuestMessages } from './useGuestMessages'; // Removed

// ✅ New - Managed subscription
import { useGuestMessagesRPC } from './useGuestMessagesRPC'; // Uses SubscriptionManager
```

## Architecture Decisions

### Why Centralized Management?

1. **Token Refresh**: Single point to update auth tokens
2. **Connection Pooling**: Reduce WebSocket overhead
3. **Error Recovery**: Consistent retry logic across all subscriptions
4. **Monitoring**: Centralized health tracking and debugging
5. **Memory Management**: Prevent leaks from orphaned subscriptions

### Why Exponential Backoff?

Prevents overwhelming the server during outages while ensuring quick recovery:
- Start: 2 seconds
- Max: 30 seconds  
- Global cooldown: 30 seconds between mass reconnects

### Why Separate Guest/Host Patterns?

- **Guest subscriptions**: User-specific, event-scoped, minimal data
- **Host subscriptions**: Broader access, management operations, bulk data
- Different performance and security requirements

## Contributing

### Adding New Features

1. **Update SubscriptionManager** for core functionality
2. **Create React hooks** for component integration  
3. **Add tests** in `tests/realtime/`
4. **Update documentation** in this README
5. **Test in development** with debug panel

### Code Style

- Use TypeScript strict mode
- Include comprehensive JSDoc comments
- Add error boundaries for all subscription callbacks
- Follow existing naming conventions
- Test both happy path and error scenarios

---

## Quick Reference

| Task | Command/Code |
|------|-------------|
| Create subscription | `subscriptionManager.subscribe(id, config)` |
| React hook | `useEventSubscription({ eventId, table, ... })` |
| Run tests | `npx playwright test tests/realtime/` |
| Debug in dev | Open debug panel or `window.realtimeTests` |
| Check health | `subscriptionManager.getStats()` |
| Force reconnect | `subscriptionManager.reconnectAll()` |

For questions or issues, refer to the comprehensive JSDoc in `SubscriptionManager.ts` or run the stability tests to validate your implementation.
