# System Review — Ranked Opportunities
*Generated: September 26, 2025*
*Single-path, reversible improvements — no product behavior changes*

## Executive Summary

**System Health**: 🟢 Strong (Architecture: 8.5/10, Security: 8.5/10, Mobile UX: 8/10)
**Primary Focus**: Performance optimization and security hardening
**Risk Level**: Low — All recommendations are incremental improvements

## Top 15 Ranked Opportunities

---

### 🔴 Critical Priority (Fix Immediately)

#### 1. SECURITY DEFINER Search Path Vulnerability
**Context**: All 67 database functions lack `SET search_path = ''`  
**Impact**: 5/5 — Potential privilege escalation via schema manipulation  
**Effort**: M (Medium) — Apply to all functions systematically  
**Guardrails**: Database security, function integrity  
**Owner**: Database/Backend team  
**Next File**: `supabase/migrations/` directory  

**Change Sketch**:
```sql
-- Fix all SECURITY DEFINER functions
ALTER FUNCTION public.is_event_host(uuid) SET search_path = '';
ALTER FUNCTION public.is_event_guest(uuid) SET search_path = '';
-- Apply to all 67 DEFINER functions
```

#### 2. Landing Page Performance Crisis
**Context**: 40+ second LCP due to artificial 1.5s delay  
**Impact**: 5/5 — Severe user experience degradation  
**Effort**: S (Small) — Remove/reduce setTimeout delay  
**Guardrails**: Core user flows, authentication UX  
**Owner**: Frontend team  
**Next File**: `app/page.tsx`  

**Change Sketch**:
```javascript
// Replace 1500ms delay with minimal UX-aware timeout
await waitMinDisplay(); // 1500ms → 300ms or remove entirely
```

---

### 🟡 High Priority (Within 2 Weeks)

#### 3. Dynamic Viewport Height Implementation  
**Context**: Missing `100dvh` usage causes mobile browser chrome issues  
**Impact**: 4/5 — Mobile UX degradation on scroll  
**Effort**: S (Small) — Update Tailwind config and global styles  
**Guardrails**: Mobile UX, layout stability  
**Owner**: Frontend/Design team  
**Next File**: `tailwind.config.ts`  

**Change Sketch**:
```css
/* Add to global CSS */
.min-h-screen { 
  min-height: 100dvh; 
  min-height: 100vh; /* fallback */ 
}
```

#### 4. Bundle Size Optimization — Main App
**Context**: 676KB main-app bundle exceeds 400KB target by 69%  
**Impact**: 4/5 — Mobile loading performance impact  
**Effort**: M (Medium) — Audit React Query devtools, dynamic imports  
**Guardrails**: Development experience, functionality  
**Owner**: Frontend team  
**Next File**: `next.config.ts`, dynamic imports analysis  

**Change Sketch**:
```javascript
// Move React Query devtools to dev-only
// Convert PerformanceMonitor to dynamic import
// Optimize @tanstack/react-query bundle impact
```

#### 5. Pagination Boundary Logic Fix
**Context**: Compound cursor needed for stable message pagination  
**Impact**: 4/5 — Message pagination gaps/duplicates  
**Effort**: M (Medium) — Update RPC function and hook interfaces  
**Guardrails**: Message read-model integrity, no Twilio changes  
**Owner**: Backend team  
**Next File**: `supabase/migrations/`, `get_guest_event_messages_v2`  

**Change Sketch**:
```sql
-- Replace timestamp-only cursor
WHERE (p_before IS NULL OR m.created_at < p_before)
-- With compound cursor  
WHERE (p_before_timestamp IS NULL) 
   OR (m.created_at < p_before_timestamp)
   OR (m.created_at = p_before_timestamp AND m.id < p_before_id)
```

---

### 🟢 Medium Priority (Within 1 Month)

#### 6. PhotoGallery Dynamic Import
**Context**: Heavy photo gallery loads on every page visit  
**Impact**: 3/5 — ~20KB initial bundle reduction  
**Effort**: S (Small) — Convert to dynamic import with loading state  
**Guardrails**: UX smoothness, photo viewing experience  
**Owner**: Frontend team  
**Next File**: `components/features/media/GuestPhotoGallery.tsx`  

**Change Sketch**:
```javascript
const PhotoGallery = dynamic(() => import('./GuestPhotoGallery'), {
  loading: () => <PhotoGallerySkeleton />,
  ssr: false
});
```

#### 7. Performance Monitor Conditional Loading
**Context**: PerformanceMonitor loads in production unnecessarily  
**Impact**: 3/5 — Bundle size and runtime overhead  
**Effort**: S (Small) — Gate behind environment flag  
**Guardrails**: Development debugging capability  
**Owner**: Frontend team  
**Next File**: `lib/providers/`, performance monitoring code  

**Change Sketch**:
```javascript
// Only load in development/staging
{process.env.NODE_ENV !== 'production' && <PerformanceMonitor />}
```

#### 8. Server-First Schedule View
**Context**: Guest schedule could be SSR with client enhancement  
**Impact**: 3/5 — Improved initial loading, better SEO  
**Effort**: M (Medium) — Convert to server component with client interactivity  
**Guardrails**: Guest event access, interactivity  
**Owner**: Frontend team  
**Next File**: `app/guest/events/[eventId]/schedule/page.tsx`  

**Change Sketch**:
```typescript
// Server component for initial render
export default function SchedulePage({ params }) {
  const scheduleData = await getScheduleData(params.eventId);
  return <ScheduleView data={scheduleData} />; // Client component for interactions
}
```

#### 9. Database Index Optimization
**Context**: Potential partial indexes and covering indexes  
**Impact**: 3/5 — Query performance for large datasets  
**Effort**: M (Medium) — Analyze query patterns, add selective indexes  
**Guardrails**: Database performance, migration safety  
**Owner**: Database team  
**Next File**: `supabase/migrations/`  

**Change Sketch**:
```sql
-- Partial indexes for active records
CREATE INDEX idx_event_guests_active ON event_guests (event_id, user_id) 
WHERE removed_at IS NULL;
-- Covering indexes for hot paths
CREATE INDEX idx_message_deliveries_user_status 
ON message_deliveries (user_id, event_id) INCLUDE (sms_status, created_at);
```

#### 10. Login Page LCP Detection Fix
**Context**: Lighthouse can't detect LCP on login page  
**Impact**: 3/5 — Performance monitoring blind spot  
**Effort**: S (Small) — Ensure visible content element for LCP measurement  
**Guardrails**: Authentication flow, form usability  
**Owner**: Frontend team  
**Next File**: `app/(auth)/login/page.tsx`  

**Change Sketch**:
```jsx
// Ensure main content is LCP-eligible
<main className="lcp-element"> {/* Explicit LCP target */}
  <CardContainer>
    {/* Login form content */}
  </CardContainer>
</main>
```

---

### 🔵 Low Priority (Next Quarter)

#### 11. Enhanced Loading Progress Indicators
**Context**: No progress indication during authentication flow  
**Impact**: 2/5 — User experience during auth transitions  
**Effort**: M (Medium) — Add progress states to auth provider  
**Guardrails**: Authentication UX, loading states  
**Owner**: Frontend/UX team  
**Next File**: `lib/auth/AuthProvider.tsx`  

**Change Sketch**:
```javascript
// Add progress context to auth flow
const [authProgress, setAuthProgress] = useState('idle');
// 'idle' → 'verifying' → 'redirecting' → 'complete'
```

#### 12. Force RLS Consistency Review
**Context**: Some tables allow SECURITY DEFINER bypass  
**Impact**: 2/5 — Security hardening opportunity  
**Effort**: M (Medium) — Review which functions need bypass capability  
**Guardrails**: Admin functions, data access patterns  
**Owner**: Database/Security team  
**Next File**: Database schema review  

**Change Sketch**:
```sql
-- Review and document why these tables allow bypass:
-- events, media, users (force_rls = false)
-- Consider enabling force RLS where appropriate
```

#### 13. Realtime Connection Monitoring
**Context**: No metrics for WebSocket connection health  
**Impact**: 2/5 — DevOps visibility into realtime stability  
**Effort**: M (Medium) — Add connection metrics and alerting  
**Guardrails**: User privacy, performance  
**Owner**: Backend/DevOps team  
**Next File**: `lib/realtime/SubscriptionProvider.tsx`  

**Change Sketch**:
```javascript
// Add connection health metrics
const connectionMetrics = {
  reconnectAttempts: 0,
  avgConnectionDuration: 0,
  failureRate: 0.0
};
```

#### 14. Comprehensive Interactive Testing
**Context**: Mobile UX testing limited to static pages  
**Impact**: 2/5 — Test coverage for touch interactions  
**Effort**: L (Large) — Extend Playwright tests for authenticated flows  
**Guardrails**: Test reliability, CI/CD performance  
**Owner**: QA/Frontend team  
**Next File**: `tests/`, Playwright configuration  

**Change Sketch**:
```javascript
// Add authenticated flow testing
test.describe('Interactive Mobile UX', () => {
  test.use({ storageState: 'auth.json' }); // Authenticated state
  test('Touch target validation on interactive pages', ...);
});
```

#### 15. Authentication Progress Enhancement
**Context**: Users may think system is unresponsive during auth  
**Impact**: 2/5 — User experience during magic link flow  
**Effort**: S (Small) — Add intermediate loading states  
**Guardrails**: Authentication security, UX clarity  
**Owner**: Frontend team  
**Next File**: Magic link components, auth flow  

**Change Sketch**:
```jsx
// Add progress steps to auth flow
<AuthProgress step={authStep} />
// 'sending' → 'sent' → 'verifying' → 'complete'
```

---

## Quick Wins (≤1 Hour Each)

### UI Polish Quick Wins
- **Dynamic viewport CSS**: Add `dvh` units to Tailwind config
- **Touch manipulation**: Add `touch-action: manipulation` utility class  
- **Font loading**: Add `font-display: swap` for better FOIT handling

### Performance Quick Wins  
- **PhotoGallery dynamic import**: Reduce initial bundle by ~20KB
- **PerformanceMonitor gating**: Environment-based loading
- **Dev server timeout**: Remove/reduce artificial landing page delay

### DevEx Quick Wins
- **Bundle analyzer CI**: Add to CI/CD for ongoing monitoring
- **LHCI integration**: Fix lighthouse-baseline.js module imports  
- **RLS test expansion**: Add automated DEFINER function testing

---

## Implementation Grouping

### Group A: Security & Stability (Critical)
- **Owner**: Database team
- **Dependencies**: None  
- **Files**: `supabase/migrations/*`
- **Timeline**: 1 week
- **Items**: #1, #5

### Group B: Performance Foundation (High Priority)
- **Owner**: Frontend team  
- **Dependencies**: Group A completion preferred
- **Files**: `app/page.tsx`, `tailwind.config.ts`, `next.config.ts`
- **Timeline**: 2 weeks  
- **Items**: #2, #3, #4, #6, #7

### Group C: UX Polish (Medium Priority)
- **Owner**: Frontend/UX team
- **Dependencies**: Group B for performance baseline
- **Files**: Schedule pages, auth components, mobile UX
- **Timeline**: 1 month
- **Items**: #8, #10, #11, #15

### Group D: Infrastructure (Low Priority)  
- **Owner**: DevOps/QA team
- **Dependencies**: Groups A-C for stable foundation
- **Files**: Testing infrastructure, monitoring
- **Timeline**: Next quarter
- **Items**: #9, #12, #13, #14

---

## Success Metrics

### Security Hardening
- ✅ Zero SECURITY DEFINER functions without search_path
- ✅ All critical RLS policies tested and documented

### Performance Targets
- 📊 Bundle size: Main-app <400KB (current: 676KB)
- 📊 Mobile LCP: <2.5s (current: 40s+ on landing)  
- 📊 Lighthouse score: >75 (current: 0-37)

### UX Improvements  
- 📱 100% dynamic viewport height usage
- 📱 Zero small touch targets (<44px)
- 📱 Smooth auth flow progress indication

### Development Experience
- 🔧 Automated bundle size monitoring  
- 🔧 LHCI integrated in CI/CD
- 🔧 Comprehensive mobile testing coverage

---

## Risk Assessment

**Overall Risk**: 🟢 Low — All changes are incremental improvements  

**Highest Risk Items**:
1. **Database migrations** (#1, #5) — Test thoroughly in staging
2. **Bundle optimization** (#4) — May affect development experience  
3. **Server-first conversions** (#8) — Verify no client state loss

**Mitigation Strategy**:
- Deploy database changes during maintenance windows
- Use feature flags for bundle optimizations  
- Implement progressive rollouts for UX changes

---

This ranked backlog provides 15 concrete, actionable improvements that will enhance Unveil's security posture, performance characteristics, and user experience while maintaining the system's current stability and functionality.
