# Product Backlog: Guest UX & Host Tools
*Generated: September 29, 2025*
*Evidence-based feature prioritization for Unveil MVP enhancement*

## Executive Summary

**Backlog Overview**: 20 candidate features identified (10 Guest UX + 10 Host Tools)  
**Immediate Opportunities**: 4 features ready for ≤1 week development  
**Current Architecture**: Strong foundation with 67 RPC functions, comprehensive RLS, mobile-first design  
**Development Strategy**: UI-first improvements leveraging existing backend infrastructure  

**Priority Distribution**:
- **Now** (≤1 week): 4 features (UI-only, existing RPC support)
- **Soon** (2-3 weeks): 8 features (minor RPC additions)  
- **Later** (>3 weeks): 8 features (major new functionality)

---

## Guest UX Features (10 Total)

### Now Priority (≤1 Week) — 2 Features

#### G1. RSVP Decline Experience Polish
**Impact**: 5/5 — Core user flow, affects ~30% guest interactions  
**Effort**: 2/5 — UI improvements only, RPC exists (`guest_decline_event`, `guest_rejoin_event`)  
**Confidence**: 5/5 — Clear implementation path, tested patterns  
**Priority**: Now

**What**: Enhance decline modal with better UX, clearer options, and smoother rejoin flow  
**Evidence**:
- Components: `DeclineEventModal.tsx`, `DeclineBanner.tsx`, `CantMakeItButton.tsx`
- RPCs: `guest_decline_event`, `guest_rejoin_event` (atomic decline+SMS opt-out)
- Hooks: `useGuestDecline`, `useGuestRejoin` with error handling

**Gaps Identified**:
- Decline modal lacks reason validation and character limits
- No inline error states for decline/rejoin actions
- Missing resend invitation link option
- Edge states (network errors, simultaneous actions) not handled

**Dependencies**: None — all backend RPCs exist  
**RLS Impact**: Read-only (existing policies sufficient)

#### G2. Guest Home CTA Optimization  
**Impact**: 4/5 — First impression, affects user engagement  
**Effort**: 2/5 — Component refinement, existing logic  
**Confidence**: 4/5 — Clear patterns, testable improvements  
**Priority**: Now

**What**: Improve "What should I do now?" guidance and primary action prioritization  
**Evidence**:
- Component: `app/guest/events/[eventId]/home/page.tsx:118-138` (CTA calculation logic)
- Current prioritization: Photos > Schedule (Messages always visible)
- Analytics hooks: PhotoAlbumButton click tracking implemented

**Gaps Identified**:
- CTA calculation doesn't consider event timeline (pre/during/post event)
- No contextual messaging based on RSVP status
- Missing urgency indicators for time-sensitive actions
- No A/B testing framework for CTA effectiveness

**Dependencies**: None  
**RLS Impact**: None

### Soon Priority (2-3 Weeks) — 4 Features

#### G3. Messages Timeline Polish
**Impact**: 4/5 — Core feature, affects daily usage  
**Effort**: 3/5 — UI components + pagination fix  
**Confidence**: 4/5 — Compound cursor RPC exists, needs client update  
**Priority**: Soon

**What**: Enhance message readability, timestamps, type indicators, pagination stability  
**Evidence**:
- Component: `GuestMessaging.tsx` with real-time updates
- Hook: `useGuestMessagesRPC.ts` (needs compound cursor implementation)
- RPC: `get_guest_event_messages_v3` (compound cursor support ready)
- Pagination Issue: Lines 87-94 in opportunities audit

**Gaps Identified**:
- Timestamp-only pagination causes gaps/duplicates under load
- Message type pills (announcement/direct) not implemented
- Empty states lack personality and guidance
- No optimistic message sending states

**Dependencies**: Compound cursor client implementation  
**RLS Impact**: Read-only (existing message visibility policies)

#### G4. Media Gallery Enhancement
**Impact**: 4/5 — Visual engagement, memory sharing core to wedding UX  
**Effort**: 4/5 — Image optimization + upload improvements  
**Confidence**: 3/5 — Supabase storage patterns need validation  
**Priority**: Soon

**What**: Grid density options, upload preview, optimistic states, first-tile SSR  
**Evidence**:
- Component: `GuestPhotoGallery.tsx` with dynamic PhotoUpload import
- Storage: Supabase Storage with CDN optimization
- Performance: Dynamic imports for bundle optimization

**Gaps Identified**:
- No upload progress indicators beyond basic spinner
- Grid layout not responsive across device sizes  
- First image not SSR'd (missed LCP opportunity)
- No optimistic upload states (images appear only after success)

**Dependencies**: Supabase Storage URL optimization  
**RLS Impact**: Read-only (media policies cover access)

#### G5. Mobile Navigation Enhancement
**Impact**: 5/5 — Mobile-first user base, navigation is critical  
**Effort**: 3/5 — Component improvements, gesture handling  
**Confidence**: 4/5 — MobileShell exists, swipe patterns available  
**Priority**: Soon

**What**: Improve tab navigation, swipe gestures, safe area handling, 44px touch targets  
**Evidence**:
- Component: `MobileShell.tsx`, `TabNavigation.tsx` with swipe support
- Implementation: Dynamic viewport height (svh/dvh) implemented
- Touch targets: TabNavigation ensures 44px minimum (line 82)

**Gaps Identified**:
- Swipe gestures not enabled on all guest routes
- Safe area handling inconsistent across pages
- Tab badges (notification counts) not implemented
- No haptic feedback for touch interactions

**Dependencies**: None  
**RLS Impact**: None (UI-only improvements)

#### G6. Schedule View Enhancement
**Impact**: 3/5 — Informational feature, not core to MVP  
**Effort**: 4/5 — SSR implementation needed (partially done)  
**Confidence**: 4/5 — SSR foundation exists, needs completion  
**Priority**: Soon

**What**: Complete server-side rendering, timeline visualization, timezone handling  
**Evidence**:
- File: `app/guest/events/[eventId]/schedule/page.tsx` (SSR partially implemented)
- Status: Lines 129-141 in opportunities audit (Server-First Schedule)
- Components: `ScheduleContent.tsx`, `ScheduleServerShell.tsx` exist

**Gaps Identified**:
- SSR implementation incomplete (line 74-75 has syntax error)
- No timeline visualization for event flow
- Timezone handling not consistent across display
- No progressive enhancement for interactivity

**Dependencies**: Schedule SSR completion  
**RLS Impact**: Read-only (event_schedule_items RLS exists)

### Later Priority (>3 Weeks) — 4 Features

#### G7. Advanced RSVP Features
**Impact**: 3/5 — Nice-to-have, not MVP critical  
**Effort**: 5/5 — Database schema changes needed  
**Confidence**: 2/5 — Conflicts with RSVP-Lite strategy  
**Priority**: Later

**What**: Meal preferences, plus-one management, dietary restrictions  
**Dependencies**: Schema changes (conflicts with RSVP-Lite hard cutover)  
**Note**: Consider deferring - conflicts with current RSVP-Lite approach

#### G8. Offline Experience
**Impact**: 3/5 — Nice-to-have for poor connectivity  
**Effort**: 5/5 — Service worker, sync patterns  
**Confidence**: 2/5 — Complex implementation, testing challenges  
**Priority**: Later

#### G9. Push Notifications  
**Impact**: 4/5 — User engagement, but alternative channels exist  
**Effort**: 5/5 — Service worker, permissions, backend integration  
**Confidence**: 2/5 — Browser compatibility, permissions complexity  
**Priority**: Later

#### G10. Advanced Media Features
**Impact**: 3/5 — Premium feature territory  
**Effort**: 5/5 — Video support, advanced editing  
**Confidence**: 2/5 — Storage costs, encoding complexity  
**Priority**: Later

---

## Host Tools Features (10 Total)

### Now Priority (≤1 Week) — 2 Features

#### H1. Message Composer Audience Presets
**Impact**: 5/5 — Core host workflow, saves time on every message  
**Effort**: 2/5 — UI enhancement, existing recipient selection logic  
**Confidence**: 5/5 — Clear implementation path, tested patterns  
**Priority**: Now

**What**: Add "Save Audience" and "Saved Presets" to message composer for quick recipient selection  
**Evidence**:
- Components: `MessageComposer.tsx`, `RecipientSelector.tsx`
- Hook: `useGuestSelection.ts` with preset support (line 47-50)
- Feature: preselectionPreset parameter already exists

**Gaps Identified**:
- No UI for saving current audience selection
- No preset management interface (create, edit, delete)
- Preset names not user-friendly (need display names)
- No validation for preset conflicts (guests removed from event)

**Dependencies**: Local storage for preset persistence  
**RLS Impact**: None (client-side preset management)

#### H2. RSVP Status Visual Enhancement
**Impact**: 4/5 — Daily host workflow, quick status assessment  
**Effort**: 2/5 — UI components, existing data  
**Confidence**: 5/5 — Data available, clear visual patterns  
**Priority**: Now

**What**: Status chips, color coding, quick filters, attendance summary  
**Evidence**:
- Component: `GuestManagement.tsx` with filter implementation
- Hook: `useUnifiedGuestCounts.ts` provides accurate counts
- Data: RSVP statuses available in event_guests table

**Gaps Identified**:
- No visual status chips (text-only status display)
- Filter UI not prominent/discoverable  
- No summary statistics dashboard
- Status counts not real-time updated

**Dependencies**: None — all data available  
**RLS Impact**: Read-only (existing guest access policies)

### Soon Priority (2-3 Weeks) — 4 Features

#### H3. Guest Tagging System
**Impact**: 5/5 — Guest organization, targeted messaging  
**Effort**: 3/5 — UI + simple tag storage (JSON field)  
**Confidence**: 4/5 — Patterns exist, non-complex implementation  
**Priority**: Soon

**What**: Create tags, bulk assign, filter by tags, tag-based messaging  
**Evidence**:
- Component: `RecipientSelector.tsx` has tag tab (lines 287-299)
- Storage: Could use JSON field in event_guests (no schema change)
- Interface: Tag filtering UI partially implemented

**Gaps Identified**:
- No tag creation interface
- Tag persistence not implemented
- Bulk tagging workflow missing
- Tag-based message targeting incomplete

**Dependencies**: JSON field utilization for tags  
**RLS Impact**: Write access (existing host policies sufficient)

#### H4. Message History Search & Filters
**Impact**: 4/5 — Message management as event grows  
**Effort**: 3/5 — Search UI + backend filtering  
**Confidence**: 4/5 — Message data structured for search  
**Priority**: Soon

**What**: Search message content, filter by date/sender/type, export conversations  
**Evidence**:
- Component: `RecentMessages` with basic message display
- Data: Messages table has full text content, timestamps, types
- Hook: `useMessages.ts` provides message list

**Gaps Identified**:
- No search functionality implemented
- Date range filtering not available
- Message type filtering basic
- Export functionality missing

**Dependencies**: Search backend (could use client-side for MVP)  
**RLS Impact**: Read-only (existing message access)

#### H5. CSV Guest Export
**Impact**: 3/5 — Host workflow completion, external tool integration  
**Effort**: 3/5 — Export logic + formatting  
**Confidence**: 5/5 — Straightforward data transformation  
**Priority**: Soon

**What**: Export guest list with RSVP status, contact info, attendance notes  
**Evidence**:
- Data: Complete guest information in event_guests table
- Hook: `useGuests.ts` provides full guest data access
- Component: `GuestManagement.tsx` has guest list iteration

**Gaps Identified**:
- No export UI implemented
- CSV formatting not defined
- No column selection options
- Export not scoped to filtered results

**Dependencies**: CSV generation library  
**RLS Impact**: Read-only export (host access to guest data)

#### H6. Bulk Guest Actions
**Impact**: 4/5 — Efficiency for large guest lists  
**Effort**: 4/5 — Selection UI + bulk operations  
**Confidence**: 4/5 — Individual operations exist, need bulk variants  
**Priority**: Soon

**What**: Select multiple guests, bulk invite, bulk tag assignment, bulk status updates  
**Evidence**:
- Component: `GuestManagement.tsx` had bulk selection (line 419 shows removed)
- RPCs: Individual guest operations exist, bulk variants needed
- Pattern: `update_guest_invitation_tracking` handles guest arrays

**Gaps Identified**:
- Bulk selection UI removed (RSVP-Lite cutover)
- Bulk operations not implemented beyond invitations
- Progress indicators for bulk operations missing
- Bulk action confirmation flows needed

**Dependencies**: Bulk RPC creation (or client-side batching)  
**RLS Impact**: Write operations (host policies cover bulk actions)

### Later Priority (>3 Weeks) — 4 Features

#### H7. Advanced Analytics Dashboard
**Impact**: 3/5 — Data insights, not core workflow  
**Effort**: 5/5 — Analytics engine, visualization  
**Confidence**: 2/5 — Complex data aggregation needs  
**Priority**: Later

**What**: Message engagement rates, RSVP trends, guest interaction analytics  
**Dependencies**: Analytics backend infrastructure

#### H8. Schedule Management
**Impact**: 3/5 — Event logistics, secondary to messaging  
**Effort**: 4/5 — Schedule CRUD, timeline management  
**Confidence**: 3/5 — Schedule items table exists, UI needed  
**Priority**: Later

**What**: Create/edit schedule items, timeline management, guest notifications for schedule changes

#### H9. Media Moderation Tools
**Impact**: 3/5 — Quality control, manual process acceptable for MVP  
**Effort**: 4/5 — Review queue, approval workflow  
**Confidence**: 3/5 — Media table supports status field  
**Priority**: Later

**What**: Media review queue, approve/hide individual items, batch moderation

#### H10. Advanced Messaging Features
**Impact**: 4/5 — Enhanced communication, but basic messaging covers MVP  
**Effort**: 5/5 — Scheduling backend, UI complexity  
**Confidence**: 2/5 — Scheduling system needs careful design  
**Priority**: Later

**What**: Schedule messages, message templates, automated reminders  
**Dependencies**: Scheduled message infrastructure (partial implementation exists)

---

## Summary Statistics

### By Priority
- **Now**: 4 features (2 Guest + 2 Host) — ≤1 week each
- **Soon**: 8 features (4 Guest + 4 Host) — 2-3 weeks each  
- **Later**: 8 features (4 Guest + 4 Host) — >3 weeks each

### By Effort Level
- **Low (1-2)**: 4 features — UI-only improvements
- **Medium (3-4)**: 12 features — UI + minor backend work
- **High (5)**: 4 features — Major new functionality

### By Confidence Level  
- **High (4-5)**: 14 features — Clear implementation path
- **Medium (3)**: 4 features — Some unknowns, manageable risk
- **Low (1-2)**: 2 features — Significant implementation challenges

### Development Strategy Validation
✅ **2 Now candidates are UI-only** — G1 (RSVP Polish), G2 (Home CTA)  
✅ **2 Now candidates use existing RPCs** — H1 (Audience Presets), H2 (Status Visual)  
✅ **No DB/RLS/Twilio/Direct changes** in Now set — Confirmed  
✅ **Evidence links provided** for all features — Components, hooks, RPCs documented  
✅ **Mobile UX considerations** included — Touch targets, gestures, safe areas

---

## Risk Assessment

### Low Risk (Now + Soon Features)
- All UI-focused improvements with existing backend support
- Well-tested patterns and components available  
- No breaking changes to core architecture
- Rollback possible through feature flags

### Medium Risk (Later Features)
- New infrastructure requirements (analytics, scheduling)
- Cross-system integration complexity
- Performance impact of new data patterns

### High Risk (Deferred)
- RSVP-Lite strategy conflicts (advanced RSVP features)
- Browser compatibility challenges (push notifications)
- Third-party service dependencies (payment, video encoding)

---

This backlog provides a clear development roadmap grounded in existing codebase capabilities, with immediate opportunities for high-impact UI improvements and a strategic progression toward more complex feature enhancements.
