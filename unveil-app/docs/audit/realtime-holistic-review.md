# Realtime Module — Idle/Reconnect Holistic Review

## Executive Summary

## Risk Rating: MEDIUM

The realtime module demonstrates sophisticated architecture with comprehensive error handling, but exhibits several
stability issues under long-tab scenarios, offline/online transitions, and JWT refresh cycles. The system shows good
recovery mechanisms but suffers from timeout storms, reconnect loops, and inconsistent state management during edge cases.

**Key Findings:**

- ✅ Strong architectural foundation with centralized subscription management
- ⚠️ Timeout storms during background/foreground transitions (30s default timeout)
- ⚠️ Potential duplicate subscriptions during React StrictMode and HMR
- ⚠️ JWT refresh coordination issues between auth and realtime layers
- ⚠️ Inconsistent pooling implementation (currently disabled)
- ✅ Good telemetry and health monitoring systems

---

## Architecture Overview

### Core Components

| Component | Purpose | Status |
|-----------|---------|--------|
| `SubscriptionManager.ts` | Centralized subscription lifecycle | ✅ Robust |
| `SubscriptionProvider.tsx` | React context integration | ✅ Good auth handling |
| `useRealtimeSubscription.ts` | Hook-based subscriptions | ⚠️ Pooling disabled |
| `RealtimeTelemetry` | Monitoring & metrics | ✅ Well implemented |
| `useRealtimeHealth.ts` | Health monitoring | ✅ Development ready |

### Key Configuration Values

```typescript
// SubscriptionManager.ts - Lines 146-151
DEFAULT_TIMEOUT = 30000;        // 30 seconds - POTENTIAL ISSUE
HEARTBEAT_INTERVAL = 15000;     // 15 seconds
MAX_RETRIES = 3;
DEFAULT_BACKOFF_DELAY = 2000;   // 2 seconds
MAX_BACKOFF_DELAY = 30000;      // 30 seconds
CONNECTION_TIMEOUT = 15000;     // 15 seconds
```

---

## Detailed Findings

### 🔴 HIGH SEVERITY

#### H1: Timeout Storm During Background/Foreground Transitions

**Evidence:** `SubscriptionManager.ts:852-866`

```typescript
if (document.hidden) {
  logger.realtime('📱 Tab backgrounded, maintaining minimal subscriptions');
  // Don't destroy subscriptions, just log the state change
} else {
  logger.realtime('📱 Tab foregrounded, checking connection health');
  setTimeout(() => {
    if (stats.healthScore < 50 && stats.activeSubscriptions > 0) {
      logger.realtime('🔄 Poor health after backgrounding, triggering reconnect');
      this.reconnectAll(); // POTENTIAL STORM
    }
  }, 2000);
}
```

**Root Cause:** 30-second timeout remains active during backgrounding, causing multiple timeout events when tab is
inactive. No adaptive timeout based on `document.hidden` state.

**Impact:** Console noise, unnecessary reconnection attempts, potential server load.

#### H2: JWT Refresh Race Condition

**Evidence:** `SubscriptionProvider.tsx:70-96` and `SubscriptionManager.ts:804-810`

```typescript
// Provider handles token refresh
if (event === 'TOKEN_REFRESHED' && session) {
  supabase.realtime.setAuth(session.access_token);
  // Manager ALSO handles token refresh independently
}

// Manager also listens for token refresh
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED' && session) {
    this.updateRealtimeAuth(session.access_token);
  }
});
```

**Root Cause:** Dual token refresh handling between Provider and Manager can cause race conditions or duplicate
`setAuth` calls.

**Impact:** Potential connection instability during token refresh cycles.

### 🟡 MEDIUM SEVERITY

#### M1: Subscription Pooling Disabled

**Evidence:** `useRealtimeSubscription.ts:109`

```typescript
// TODO: Refactor this to use the hook-based approach properly
logger.warn('Pooled subscriptions temporarily disabled - using individual subscriptions');
const unsubscribe = () => {}; // No-op cleanup
```

**Root Cause:** Pooling system exists but is disabled due to architectural mismatch between class-based pool and
hook-based manager.

**Impact:** Higher WebSocket connection count, reduced efficiency.

#### M2: React StrictMode Double-Mount Protection Incomplete

**Evidence:** `useRealtimeSubscription.ts:334-340`

```typescript
if (unsubscribeRef.current) {
  logger.realtime(`⚠️ Subscription already exists for ${subscriptionId}, skipping`);
  return;
}
```

**Root Cause:** Protection exists but may not handle all StrictMode scenarios, particularly with component ID generation.

**Impact:** Potential duplicate subscriptions during development.

#### M3: Global Reconnect Cooldown Too Aggressive

**Evidence:** `SubscriptionManager.ts:142-143`

```typescript
private globalReconnectCooldown = 30000; // 30 seconds between global reconnects
```

**Root Cause:** 30-second cooldown may be too long for legitimate reconnection needs after network changes.

**Impact:** Delayed recovery from network issues.

### 🟢 LOW SEVERITY

#### L1: Error Counter Reset Logic

**Evidence:** `SubscriptionManager.ts:965-970`

```typescript
if (stats.healthScore > 80 && this.globalConsecutiveErrors > 0) {
  this.globalConsecutiveErrors = 0;
  logger.realtime('✅ Connection stability restored, resetting error counters');
}
```

**Root Cause:** Error counters reset based on health score, but individual subscription error counts may persist.

**Impact:** Minor inconsistency in error tracking.

#### L2: Memory Cleanup Timing

**Evidence:** `SubscriptionManager.ts:1014-1021`

```typescript
if (timeSinceError > 10 * 60 * 1000) { // 10 minutes
  subscription.lastError = null;
}
```

**Root Cause:** 10-minute cleanup interval may be too long for active debugging.

**Impact:** Minor memory usage during development.

---

## Reproduction Scenarios

### Scenario 1: Long Tab Idle (30-45 minutes)

**Steps:**

1. Open guest messages page
2. Background tab for 30-45 minutes
3. Foreground tab and observe console

**Expected Behavior:**

- Single orchestrated reconnect
- No timeout storms
- Quick recovery

**Observed Issues:**

- Multiple timeout warnings during background period
- Potential reconnect storm on foreground
- 30-second timeout not adapted for background state

**Console Patterns:**

```text
⏰ Subscription timeout: messages-event-123 (30000ms) - retrying connection
📱 Tab backgrounded, maintaining minimal subscriptions
📱 Tab foregrounded, checking connection health
🔄 Poor health after backgrounding, triggering reconnect
```

### Scenario 2: Offline/Online Toggle (45-90 seconds)

**Steps:**

1. Open app with active subscriptions
2. Toggle DevTools offline for 45-90 seconds
3. Toggle back online
4. Observe reconnection behavior

**Expected Behavior:**

- Clean offline detection
- Single reconnect attempt when online
- No connection storms

**Observed Issues:**

- Multiple reconnection attempts
- Potential timeout accumulation during offline period
- Global cooldown may delay legitimate reconnects

### Scenario 3: JWT Refresh Cycle

**Steps:**

1. Reduce JWT TTL in local environment
2. Wait for token refresh event
3. Monitor realtime connection stability

**Expected Behavior:**

- Seamless token update
- No connection interruption
- Single `setAuth` call

**Observed Issues:**

- Potential dual `setAuth` calls from Provider and Manager
- Race condition between auth layers
- Connection stability depends on timing

---

## Recommended Fixes (Not Implemented)

### Priority 1: Adaptive Timeout Management

```typescript
// SubscriptionManager.ts - Enhanced visibility handling
private getAdaptiveTimeout(): number {
  if (typeof document !== 'undefined' && document.hidden) {
    return 90000; // 90s for background tabs
  }
  return this.DEFAULT_TIMEOUT; // 30s for active tabs
}

private handleVisibilityChange(): void {
  if (typeof document === 'undefined') return;
  
  if (document.hidden) {
    // Suppress timeout counters during background
    this.suppressTimeoutLogging = true;
  } else {
    this.suppressTimeoutLogging = false;
    // Single health check after 3 seconds
    setTimeout(() => this.performHealthCheck(), 3000);
  }
}
```

### Priority 2: JWT Refresh Coordination

```typescript
// SubscriptionProvider.tsx - Centralized token handling
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === 'TOKEN_REFRESHED' && session) {
        // Single point of token refresh
        await this.updateRealtimeAuth(session.access_token);
        // Notify manager without duplicate handling
        if (managerRef.current) {
          managerRef.current.notifyTokenRefresh();
        }
      }
    }
  );
  return () => subscription.unsubscribe();
}, []);
```

### Priority 3: Cold Reconnect After Failures

```typescript
// SubscriptionManager.ts - Circuit breaker pattern
private async performColdReconnect(): Promise<void> {
  if (this.consecutiveFailures >= 3) {
    logger.realtime('🔄 Performing cold reconnect');
    
    // Destroy current client
    this.destroyRealtimeClient();
    
    // Refresh JWT
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      supabase.realtime.setAuth(session.access_token);
    }
    
    // Recreate subscriptions
    this.recreateAllSubscriptions();
    
    // Reset failure count
    this.consecutiveFailures = 0;
  }
}
```

### Priority 4: Subscription Deduplication

```typescript
// useRealtimeSubscription.ts - Enhanced deduplication
const subscriptionKey = useMemo(() => {
  return `${table}-${event}-${filter}-${schema}`;
}, [table, event, filter, schema]);

const dedupedSubscriptionId = useMemo(() => {
  // Prevent React StrictMode duplicates
  return `${subscriptionKey}-${Date.now()}`;
}, [subscriptionKey]);
```

---

## Observability Summary

### Current Metrics Available

- **Health Score**: 0-100 based on connection stability
- **Error Counts**: Total and recent error tracking
- **Connection Times**: Average connection establishment time
- **Subscription Details**: Per-subscription health status

### Telemetry Events

- `realtime.token_refresh.success/fail`
- `realtime.manager.reinit`
- `realtime.subscribe.whileDestroyed`

### Missing Observability

- Timeout frequency by visibility state
- Cold reconnect success rates
- JWT refresh timing correlation
- Background/foreground transition metrics

---

## Non-Goals Confirmed

✅ **Twilio Integration**: No changes to SMS delivery path  
✅ **Direct Exposure**: Message read-model remains abstracted  
✅ **RLS Modifications**: Database security policies untouched  
✅ **Delivery Backfill**: No historical message delivery changes  

---

## Acceptance Criteria

- [x] **Architecture Mapped**: Core components and data flow documented
- [x] **Error Patterns Identified**: Console timeout and reconnect issues catalogued
- [x] **Auth Integration Verified**: JWT refresh coordination analyzed
- [x] **Reproduction Scenarios**: Idle, offline, and token refresh cases documented
- [x] **Severity Assessment**: High/Medium/Low findings with evidence
- [x] **Fix Recommendations**: Specific code changes proposed (not implemented)
- [x] **Observability Review**: Current metrics and gaps identified

---

## Next Steps

1. **Implement Priority 1 fixes** (adaptive timeouts) for immediate stability improvement
2. **Coordinate JWT refresh** to eliminate race conditions
3. **Re-enable subscription pooling** with proper hook integration
4. **Add background/foreground metrics** to telemetry system
5. **Test reproduction scenarios** after fixes to validate improvements

---

*Report generated: 2025-01-30*  
*Review scope: Realtime module stability under idle, offline, and auth refresh scenarios*  
*Risk level: Medium - Functional but needs stability improvements*
