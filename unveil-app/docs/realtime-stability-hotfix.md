# Realtime Stability Hotfix

## Issues Addressed

Based on the console logs provided, several critical issues were identified and fixed:

### 1. "tried to subscribe multiple times" Error ❌→✅

**Problem**: The reconnection logic was attempting to subscribe on channels that were already subscribed, causing Supabase realtime errors.

**Root Cause**: 
- `cleanupExistingSubscription` was deleting the subscription from the map entirely
- Reconnection attempts were trying to reuse existing channel instances
- No proper check for existing active subscriptions before creating new ones

**Fix Applied**:
```typescript
// Added check before creating new subscriptions
const existingSubscription = this.subscriptions.get(subscriptionId);
if (existingSubscription?.channel && existingSubscription.channel.state !== 'closed') {
  logger.realtime(`⚠️ Subscription ${subscriptionId} already exists with state: ${existingSubscription.channel.state}`);
  return existingSubscription.unsubscribe || (() => {});
}

// Modified cleanup to preserve subscription metadata
private cleanupExistingSubscription(subscriptionId: string): void {
  const existing = this.subscriptions.get(subscriptionId);
  if (existing?.channel) {
    // Clear the channel reference but keep the subscription metadata for reconnection
    existing.channel = null;
    existing.isActive = false;
    existing.isReconnecting = false;
  }
}
```

### 2. Multiple Manager Reinit Events ❌→✅

**Problem**: Multiple duplicate manager reinitializations were happening, causing console spam and potential race conditions.

**Root Cause**: React effects were running multiple times without proper deduplication, especially during auth state changes.

**Fix Applied**:
```typescript
// Added operation mutex in SubscriptionProvider
const managerOperationInFlight = useRef(false);

useEffect(() => {
  // Prevent duplicate operations
  if (managerOperationInFlight.current) {
    logger.realtime('🔄 Manager operation already in flight, skipping duplicate');
    return;
  }
  
  if (wasAuthenticated !== isNowAuthenticated) {
    managerOperationInFlight.current = true;
    // ... auth state change logic
    
    // Reset flag after operation
    setTimeout(() => {
      managerOperationInFlight.current = false;
    }, 100);
  }
}, [isAuthenticated, session, version]);
```

### 3. Improved Error Counter Reset Logic ❌→✅

**Problem**: Global timeout counters weren't being reset properly, leading to unnecessary cold reconnects.

**Root Cause**: Error counters were only reset when health score was above 80 AND there were errors, missing cases where timeouts occurred without errors.

**Fix Applied**:
```typescript
// Reset timeout counter when any subscription succeeds
if (subscription) {
  // ... existing reset logic
  // Reset global timeout counter when any subscription succeeds
  this.consecutiveGlobalTimeouts = 0;
}

// Improved health check reset condition
if (stats.healthScore > 80 && (this.globalConsecutiveErrors > 0 || this.consecutiveGlobalTimeouts > 0)) {
  this.globalConsecutiveErrors = 0;
  this.consecutiveGlobalTimeouts = 0;
  logger.realtime('✅ Connection stability restored, resetting all error counters');
}
```

### 4. Enhanced TypeScript Safety ❌→✅

**Problem**: Type errors were occurring due to nullable channel references.

**Fix Applied**:
```typescript
// Updated interface to allow null channels
export interface SubscriptionState {
  // ... other properties
  channel: RealtimeChannel | null;
  unsubscribe?: () => void;
}

// Added null checks throughout
if (subscription.channel) {
  subscription.channel.unsubscribe();
  subscription.channel = null;
}
```

## Expected Improvements

With these fixes, you should see:

1. **No more "tried to subscribe multiple times" errors** - Proper channel lifecycle management
2. **Reduced console noise** - Eliminated duplicate manager reinit events
3. **Better reconnection stability** - Improved error counter reset logic
4. **Cleaner background/foreground transitions** - Adaptive timeout working correctly
5. **More reliable cold reconnect logic** - Only triggers when actually needed

## Monitoring

The existing telemetry will now provide cleaner metrics:
- `realtime.timeout.bg` / `realtime.timeout.fg` - Should show fewer false positives
- `realtime.cold_reconnect.invoked` - Should only fire when truly needed
- `realtime.setAuth.calls` / `realtime.setAuth.deduped` - Should show proper deduplication

## Testing Recommendations

1. **Background/Foreground Test**: Leave tab backgrounded for 5+ minutes, then foreground - should see single clean reconnect
2. **Network Interruption**: Briefly disconnect network - should recover without "subscribe multiple times" errors
3. **Extended Session**: Keep tab open for 30+ minutes - should not see excessive timeout storms

---

*Hotfix applied: 2025-01-30*  
*All changes maintain backward compatibility and existing feature flag behavior*
