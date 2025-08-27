# Unveil App Cleanup Audit Report

*Generated on: $(date)*  
*Purpose: Comprehensive review for safe architectural cleanup*

## Executive Summary

This audit identifies obsolete routes, unused RPCs, hook duplication, error handling inconsistencies, and testing gaps across the Unveil codebase. The findings are categorized by safety level to enable systematic cleanup without breaking functionality.

---

## 1. Obsolete Routes Analysis

### 🔴 **SAFE TO REMOVE** - Confirmed Obsolete Routes

| Route | Status | Evidence | Risk Level |
|-------|--------|----------|------------|
| `/dashboard` | **OBSOLETE** | Static placeholder page with no functionality. All references redirect to proper host dashboard | **LOW** |
| `/guest/home` | **OBSOLETE** | Generic placeholder. All guest flows use `/guest/events/[eventId]/home` | **LOW** |

#### Detailed Analysis

**`/app/dashboard/page.tsx`**
- **Purpose**: Static MVP placeholder page
- **Content**: Basic UI with "Start Building Features" button
- **Usage**: No active navigation references found
- **Recommendation**: **SAFE TO DELETE**

**`/app/guest/home/page.tsx`**
- **Purpose**: Generic guest home placeholder
- **Content**: Static RSVP and photo upload buttons (non-functional)
- **Usage**: Referenced in `lib/constants.ts` but no active navigation
- **Recommendation**: **SAFE TO DELETE** (update constants.ts)

### ✅ **ACTIVE ROUTES** - Keep All Others

All other 18 routes are actively used and properly integrated into the navigation flow.

---

## 2. RPC Functions Audit

### 🔴 **RISKY RPCs** - Violate Guardrails

| RPC Function | Risk Level | Issue | Usage Count | Recommendation |
|--------------|------------|-------|-------------|----------------|
| `backfill_announcement_deliveries` | **HIGH** | Violates data integrity guardrails | 2 test files only | **DISABLE IN PRODUCTION** |
| `preview_missing_announcement_deliveries` | **MEDIUM** | Diagnostic only, but enables risky backfill | 1 test file only | **REVIEW NECESSITY** |

#### Detailed RPC Analysis

**High-Risk RPCs:**
- `backfill_announcement_deliveries(p_event_id, p_dry_run)` 
  - **Issue**: Can modify historical delivery records
  - **Usage**: Only in `__tests__/integration/announcement-backfill-safety.test.ts`
  - **Guardrail Violation**: Modifies immutable delivery history
  - **Action**: Add production safety check or remove entirely

### ✅ **ACTIVE RPCs** - Well-Used Functions

| RPC Function | Usage Count | Primary Consumers |
|--------------|-------------|-------------------|
| `get_guest_event_messages_v2` | 58 files | Guest messaging system |
| `resolve_message_recipients` | 8 files | Message composition |
| `is_event_host` | 6 files | Authorization checks |
| `get_invitable_guest_ids` | 4 files | Bulk invitations |
| `soft_delete_guest` | 2 files | Guest management |
| `update_scheduled_message` | 3 files | Message scheduling |

### 🟡 **DEPRECATED RPCs** - Legacy Stubs

| RPC Function | Status | Action Needed |
|--------------|--------|---------------|
| `get_guest_event_messages_legacy` | Deprecated stub | Safe to remove after migration verification |
| `get_message_rollups` | Deprecated stub | Safe to remove after migration verification |

---

## 3. Hook Duplication Analysis

### 🔴 **MESSAGING HOOKS** - Significant Overlap

#### Current State
- **`useMessages`** (272 lines): Generic message CRUD with React Query
- **`useGuestMessagesRPC`** (794 lines): Specialized guest messaging with real-time
- **`useScheduledMessages`** (459 lines): Scheduled message management
- **`useMessagingRecipients`** (164 lines): Recipient selection logic
- **`useRecipientPreview`** (unknown): Message recipient preview

#### Duplication Issues
1. **State Management**: Multiple hooks manage similar message state
2. **Error Handling**: Inconsistent patterns across hooks
3. **Real-time Logic**: Duplicated subscription management
4. **Caching**: Overlapping React Query keys

#### Consolidation Recommendation
```typescript
// Proposed unified structure
useMessaging({
  eventId: string,
  mode: 'host' | 'guest',
  features: ['messages', 'scheduled', 'recipients']
})
```

### 🔴 **GUEST HOOKS** - Action Pattern Duplication

#### Current State
- **`useGuestDecline`** (91 lines): Handles event decline
- **`useGuestRejoin`** (83 lines): Handles event rejoin  
- **`useAutoJoinGuests`** (107 lines): Handles auto-joining
- **`usePhoneDuplicateCheck`**: Phone validation

#### Duplication Issues
1. **Similar Patterns**: All follow same async action pattern
2. **Error Handling**: Identical error state management
3. **Loading States**: Repeated loading/success/error logic

#### Consolidation Recommendation
```typescript
// Proposed unified structure
useGuestActions(eventId: string) {
  return {
    decline: (reason?: string) => Promise<Result>,
    rejoin: () => Promise<Result>,
    autoJoin: (userId: string, phone?: string) => Promise<Result>
  }
}
```

---

## 4. Error Handling Patterns Assessment

### 🔴 **INCONSISTENT PATTERNS** - Multiple Approaches

#### Current Error Handling Approaches

1. **Try-Catch with Alerts** (2 instances)
   ```typescript
   try {
     // operation
   } catch {
     alert('Failed to delete message'); // ❌ Poor UX
   }
   ```

2. **Try-Catch with State** (Most common)
   ```typescript
   try {
     // operation
   } catch (error) {
     setError(error instanceof Error ? error.message : 'Network error');
   }
   ```

3. **Error Boundaries** (3 implementations)
   - `ErrorBoundary` (global)
   - `GuestManagementErrorBoundary` (feature-specific)
   - `MessagingErrorFallback` (messaging-specific)

4. **Silent Failures** (Console warnings)
   ```typescript
   catch (error) {
     console.warn('Failed to fetch event timezone:', error); // ❌ Silent to user
   }
   ```

### 🟡 **STANDARDIZATION OPPORTUNITIES**

#### Recommended Unified Pattern
```typescript
// Centralized error handling hook
const useErrorHandler = () => ({
  handleError: (error: unknown, context: string) => {
    // Log for debugging
    logger.error(`Error in ${context}:`, error);
    
    // Show user-friendly message
    showToast({
      type: 'error',
      message: getErrorMessage(error),
      action: getErrorAction(error, context)
    });
  }
});
```

---

## 5. Testing Coverage Gaps

### ✅ **WELL-TESTED AREAS**

| Area | Test Count | Coverage Quality |
|------|------------|------------------|
| **RPC Functions** | 15+ integration tests | **EXCELLENT** |
| **Messaging System** | 20+ tests (unit + integration) | **EXCELLENT** |
| **Real-time Subscriptions** | 8+ tests | **GOOD** |
| **SMS Formatting** | 6+ tests | **GOOD** |
| **Database Triggers** | 3+ tests | **GOOD** |

### 🔴 **CRITICAL GAPS** - High-Risk Areas

| Area | Risk Level | Current Coverage | Recommendation |
|------|------------|------------------|----------------|
| **Authentication Flow** | **HIGH** | No automated tests | Add E2E auth tests |
| **Route Guards** | **HIGH** | No automated tests | Add RLS policy tests |
| **Error Boundaries** | **MEDIUM** | No automated tests | Add error simulation tests |
| **Hook State Management** | **MEDIUM** | Limited unit tests | Add hook testing library tests |
| **Navigation Flows** | **MEDIUM** | Limited E2E tests | Add user journey tests |

### 🟡 **MODERATE GAPS** - Medium Risk

| Area | Current State | Needed Coverage |
|------|---------------|-----------------|
| **Guest Management UI** | 1 component test | Add interaction tests |
| **Event Creation** | 1 service test | Add E2E flow tests |
| **Media Upload** | No tests | Add upload flow tests |
| **Scheduled Messages** | Good integration tests | Add UI interaction tests |

---

## 6. Safety Risks Assessment

### 🔴 **HIGH RISK** - Potential Breaking Changes

1. **RPC Function Removal**
   - **Risk**: Breaking active consumers
   - **Mitigation**: Cross-reference all usage before removal
   - **Safe Approach**: Deprecate first, remove after verification

2. **Hook Consolidation**
   - **Risk**: Breaking component dependencies
   - **Mitigation**: Gradual migration with backward compatibility
   - **Safe Approach**: Create new unified hooks alongside existing ones

3. **Route Removal**
   - **Risk**: Breaking deep links or bookmarks
   - **Mitigation**: Add redirects for removed routes
   - **Safe Approach**: 301 redirects to appropriate pages

### 🟡 **MEDIUM RISK** - Requires Careful Planning

1. **Error Handling Standardization**
   - **Risk**: Changing user-visible error messages
   - **Mitigation**: Maintain error message consistency
   - **Safe Approach**: Gradual rollout with A/B testing

2. **Testing Infrastructure Changes**
   - **Risk**: Breaking CI/CD pipeline
   - **Mitigation**: Test changes in isolated environment
   - **Safe Approach**: Incremental test additions

---

## 7. Cleanup Recommendations by Priority

### 🚀 **PHASE 1: IMMEDIATE SAFE WINS** (Low Risk)

1. **Remove Obsolete Routes**
   - Delete `/app/dashboard/page.tsx`
   - Delete `/app/guest/home/page.tsx`
   - Update `lib/constants.ts` references
   - Add redirects if needed

2. **Disable Risky RPCs**
   - Add production guard to `backfill_announcement_deliveries`
   - Review necessity of `preview_missing_announcement_deliveries`

3. **Fix Alert-Based Error Handling**
   - Replace `alert()` calls with proper error states
   - Files: `ScheduledMessagesList.tsx` (2 instances)

### 🔧 **PHASE 2: STRUCTURAL IMPROVEMENTS** (Medium Risk)

1. **Standardize Error Handling**
   - Create `useErrorHandler` hook
   - Migrate components gradually
   - Maintain error message consistency

2. **Consolidate Messaging Hooks**
   - Design unified `useMessaging` interface
   - Implement with backward compatibility
   - Migrate components incrementally

3. **Add Critical Tests**
   - Authentication flow E2E tests
   - Route guard integration tests
   - Error boundary simulation tests

### 🏗️ **PHASE 3: ARCHITECTURAL CLEANUP** (Higher Risk)

1. **Consolidate Guest Hooks**
   - Design unified `useGuestActions` interface
   - Implement with feature flags
   - Migrate components with thorough testing

2. **Remove Deprecated RPCs**
   - Verify no active usage of legacy stubs
   - Remove after migration verification
   - Update database migration scripts

---

## 8. Implementation Safety Checklist

### Before Making Changes

- [ ] **Backup Database**: Full backup before RPC changes
- [ ] **Feature Flags**: Implement for major hook changes
- [ ] **Monitoring**: Set up alerts for error rate increases
- [ ] **Rollback Plan**: Document rollback procedures

### During Implementation

- [ ] **Gradual Rollout**: Use feature flags for user-facing changes
- [ ] **Monitoring**: Watch error rates and user feedback
- [ ] **Testing**: Run full test suite after each change
- [ ] **Documentation**: Update API docs and architecture diagrams

### After Implementation

- [ ] **Verification**: Confirm all functionality works as expected
- [ ] **Performance**: Check for performance regressions
- [ ] **Cleanup**: Remove old code after successful migration
- [ ] **Documentation**: Update cleanup audit report

---

## 9. Estimated Impact

### Development Velocity
- **Phase 1**: +15% (reduced cognitive load from obsolete code)
- **Phase 2**: +25% (standardized patterns, better error handling)
- **Phase 3**: +35% (unified hooks, cleaner architecture)

### Maintenance Burden
- **Current**: High (multiple patterns, duplicated logic)
- **After Cleanup**: Medium (standardized patterns, consolidated hooks)

### Risk Mitigation
- **Current Risk**: Medium (inconsistent error handling, untested critical paths)
- **After Cleanup**: Low (comprehensive testing, standardized patterns)

---

## 10. Conclusion

The Unveil codebase shows signs of rapid development with some architectural debt. The identified cleanup opportunities are significant but manageable with a phased approach. The highest impact improvements are:

1. **Remove obsolete routes** (immediate win)
2. **Standardize error handling** (user experience improvement)
3. **Consolidate messaging hooks** (developer experience improvement)
4. **Add critical test coverage** (reliability improvement)

**Recommended Timeline**: 3-4 weeks for complete cleanup, with Phase 1 completable in 1 week.

---

*This audit provides a roadmap for systematic cleanup while maintaining system stability. All recommendations include safety measures to prevent breaking changes.*
