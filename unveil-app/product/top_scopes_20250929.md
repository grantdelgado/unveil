# Top 10 Feature Scopes — Ready-to-Run Development
*Generated: September 29, 2025*
*Cursor-ready mini-prompts for immediate development*

## Guest UX Features (Top 5)

### 1. RSVP Decline Experience Polish

**TITLE**: RSVP Decline UX Enhancement — Guest Experience Polish  

**INTENT**: Enhance guest decline flow with better error states, validation, and rejoin experience for smoother user interactions.  

**REVIEW FIRST** (no code changes yet):
- Components: `components/features/guest/DeclineEventModal.tsx`, `components/features/guest/DeclineBanner.tsx`, `components/features/guest/CantMakeItButton.tsx`
- Hooks: `hooks/guests/useGuestDecline.ts`, `hooks/guests/useGuestRejoin.ts` 
- RPCs: `guest_decline_event`, `guest_rejoin_event` (atomic decline+SMS opt-out)
- UI patterns: Modal validation, inline error states, loading indicators

**CHANGE REQUEST**:
- Add reason validation with 200 character limit and helpful prompts
- Implement inline error states for decline/rejoin failures
- Add "resend invitation link" option post-decline
- Handle edge states: network errors, simultaneous decline/rejoin
- Improve modal copy for clarity and empathy
- Add confirmation step for decline action

**TESTS**: Decline modal validation, error state display, rejoin flow success, character limit enforcement

**ACCEPTANCE**:
- Decline reason limited to 200 characters with live counter
- Network errors show retry button with clear messaging
- Rejoin button shows loading state and success feedback
- Modal copy uses empathetic, non-judgmental language
- Simultaneous actions handled gracefully (loading states)

**NON-GOALS**: Schema changes, SMS flow modifications, RSVP status tracking changes

---

### 2. Guest Home CTA Optimization

**TITLE**: Guest Home CTA Enhancement — What Should I Do Now Guidance

**INTENT**: Improve primary action prioritization and contextual guidance on guest home page for better user engagement.

**REVIEW FIRST** (no code changes yet):
- File: `app/guest/events/[eventId]/home/page.tsx` lines 118-138 (CTA calculation)
- Components: `PhotoAlbumButton.tsx`, messaging display section
- Current logic: Photos > Schedule prioritization (Messages always visible)
- Analytics: PhotoAlbumButton click tracking implemented

**CHANGE REQUEST**:
- Add event timeline awareness (pre/during/post event) to CTA calculation
- Include RSVP status in CTA determination (declined users see different actions)
- Add urgency indicators for time-sensitive actions (e.g., "Event tomorrow!")
- Implement contextual messaging based on user state
- Add "Getting started" checklist for new guests
- Improve visual hierarchy of primary vs secondary actions

**TESTS**: CTA calculation logic, timeline awareness, RSVP-specific messaging, urgency indicators

**ACCEPTANCE**:
- CTA changes based on event timeline (7+ days vs 1 day vs day-of)
- Declined guests see rejoin option as primary action
- Time-sensitive events show urgency messaging
- New guests see onboarding-style guidance
- Primary CTA button visually distinct from secondary actions

**NON-GOALS**: A/B testing framework, backend analytics collection, major layout changes

---

### 3. Messages Timeline Polish

**TITLE**: Guest Messages Timeline Enhancement — Pagination & Readability  

**INTENT**: Fix pagination stability issues and enhance message readability with better timestamps and type indicators.

**REVIEW FIRST** (no code changes yet):
- Component: `components/features/messaging/guest/GuestMessaging.tsx`
- Hook: `hooks/messaging/useGuestMessagesRPC.ts` (needs compound cursor fix)
- RPC: `get_guest_event_messages_v3` (compound cursor support ready)
- Issue: Timestamp-only pagination causes gaps/duplicates under load

**CHANGE REQUEST**:
- Implement compound cursor pagination (created_at + id) in useGuestMessagesRPC
- Add message type pills/badges (announcement, direct, channel)
- Improve timestamp display with relative times ("2 minutes ago")
- Create contextual empty states with personality
- Add optimistic message sending states
- Implement smooth scroll-to-bottom for new messages

**TESTS**: Pagination stability under load, message type display, timestamp formatting, empty state rendering

**ACCEPTANCE**:
- No message gaps or duplicates during simultaneous message arrival
- Message types visually distinguished with subtle badges
- Timestamps show relative time for recent messages, absolute for older
- Empty state includes helpful copy and suggested actions
- Optimistic states show immediately when sending messages

**NON-GOALS**: Message editing, advanced formatting, read receipts

---

### 4. Media Gallery Enhancement

**TITLE**: Guest Media Gallery Polish — Upload Experience & Performance

**INTENT**: Enhance media gallery with better upload states, responsive grid, and performance optimizations.

**REVIEW FIRST** (no code changes yet):
- Component: `components/features/media/GuestPhotoGallery.tsx`
- Upload: PhotoUpload dynamically imported for performance
- Storage: Supabase Storage with CDN patterns
- Current: Basic upload with minimal progress feedback

**CHANGE REQUEST**:
- Add upload progress indicators with percentage and cancel option
- Implement responsive grid density (2-col mobile, 3-col tablet, 4-col desktop)
- Add optimistic upload states (show image immediately, mark as uploading)
- Optimize first tile for SSR/LCP improvement
- Add image compression before upload (client-side)
- Implement drag-and-drop upload area

**TESTS**: Upload progress display, grid responsiveness, optimistic states, image compression

**ACCEPTANCE**:
- Upload shows progress bar with cancel option
- Grid adapts to screen size with consistent aspect ratios
- Images appear immediately with uploading indicator
- First gallery image loads faster than subsequent images
- Upload accepts drag-and-drop and file selection
- Images under 2MB compress automatically before upload

**NON-GOALS**: Video support, advanced editing, batch upload, external storage

---

### 5. Mobile Navigation Enhancement

**TITLE**: Guest Mobile Navigation — Touch Targets & Gestures

**INTENT**: Improve mobile navigation with better touch targets, swipe gestures, and safe area handling.

**REVIEW FIRST** (no code changes yet):
- Component: `components/layout/MobileShell.tsx`, `components/features/host-dashboard/TabNavigation.tsx`
- Implementation: Dynamic viewport height (svh/dvh) implemented
- Touch targets: 44px minimum enforced in TabNavigation
- Swipe: Basic swipe gesture support exists

**CHANGE REQUEST**:
- Extend swipe gestures to all guest route tabs (home, messages, media, schedule)
- Improve safe area handling consistency across guest pages
- Add tab badges for notification counts (unread messages, new media)
- Implement haptic feedback for tab changes (where supported)
- Optimize touch target sizes for accessibility compliance
- Add visual swipe hints for new users

**TESTS**: Swipe gesture responsiveness, touch target sizes, badge display, safe area handling

**ACCEPTANCE**:
- All guest tabs support left/right swipe navigation
- Touch targets minimum 44px across all interactive elements
- Tab badges show counts for unread content
- Safe area insets properly handled on iPhone/Android
- Subtle visual cues indicate swipeable areas
- Navigation feels responsive on low-end devices

**NON-GOALS**: Advanced animations, custom gesture library, platform-specific UI patterns

---

## Host Tools Features (Top 5)

### 6. Message Composer Audience Presets

**TITLE**: Host Message Composer — Audience Preset Management

**INTENT**: Add save and reuse functionality for message audience selections to streamline host messaging workflow.

**REVIEW FIRST** (no code changes yet):
- Components: `components/features/messaging/host/MessageComposer.tsx`, `components/features/messaging/host/RecipientSelector.tsx`
- Hook: `hooks/messaging/useGuestSelection.ts` lines 47-50 (preselectionPreset support)
- Current: Basic audience selection with preselectionPreset parameter

**CHANGE REQUEST**:
- Add "Save Current Audience" button to recipient selector
- Create preset management modal (create, rename, delete presets)
- Add preset dropdown to quickly apply saved audiences
- Implement local storage persistence for presets
- Add preset validation (handle removed guests gracefully)
- Show preset descriptions with guest count and last used date

**TESTS**: Preset creation flow, local storage persistence, preset validation with removed guests

**ACCEPTANCE**:
- Hosts can save current audience selection with custom name
- Preset dropdown shows saved audiences with guest counts
- Presets persist across browser sessions via localStorage
- Invalid presets (removed guests) show warnings and auto-update
- Preset management modal allows rename/delete operations
- Maximum 10 presets to prevent UI clutter

**NON-GOALS**: Server-side preset storage, preset sharing between hosts, advanced preset scheduling

---

### 7. RSVP Status Visual Enhancement

**TITLE**: Host Guest Management — Visual Status System

**INTENT**: Enhance RSVP status display with visual chips, better filtering, and real-time updates.

**REVIEW FIRST** (no code changes yet):
- Component: `components/features/host-dashboard/GuestManagement.tsx`
- Hook: `hooks/guests/useUnifiedGuestCounts.ts` (provides accurate counts)
- Data: RSVP statuses in event_guests table (attending, declined, pending)
- Current: Text-only status display with basic filter dropdown

**CHANGE REQUEST**:
- Implement color-coded status chips (green=attending, red=declined, yellow=pending)
- Add status summary cards at top of guest list
- Make filters more prominent with badge counts
- Add real-time status count updates
- Create quick status filter buttons (one-click filtering)
- Add attendance percentage calculation and display

**TESTS**: Status chip rendering, real-time count updates, filter interaction, percentage calculation

**ACCEPTANCE**:
- Status chips use consistent color coding with accessible contrast
- Summary cards show total/attending/declined counts with percentages
- Filter badges show count of guests in each status category
- Status updates reflect immediately without page refresh
- One-click status filters work from summary cards
- Attendance percentage rounds to nearest whole number

**NON-GOALS**: Advanced analytics, export functionality, bulk status updates

---

### 8. Guest Tagging System

**TITLE**: Host Guest Management — Tag Organization System

**INTENT**: Implement guest tagging for organization, filtering, and targeted messaging capabilities.

**REVIEW FIRST** (no code changes yet):
- Component: `components/features/messaging/host/RecipientSelector.tsx` lines 287-299 (tag tab exists)
- Storage: JSON field in event_guests table for tag storage
- Interface: Tag filtering UI partially implemented but no creation/management

**CHANGE REQUEST**:
- Create tag creation modal with color picker and validation
- Add inline tag assignment to guest list items
- Implement tag-based filtering in guest list and message composer
- Add tag management interface (edit names, colors, delete)
- Enable bulk tag assignment via guest selection
- Store tags in event_guests.tags JSON field

**TESTS**: Tag creation flow, bulk assignment, JSON field storage, filter integration

**ACCEPTANCE**:
- Tags created with name (max 20 chars) and color selection
- Guests can have multiple tags displayed as colored chips
- Tag filters work in both guest list and message audience selection
- Tag management allows editing and deletion with confirmation
- Bulk tag assignment works with multi-select guest list
- Tags persist in database JSON field with RLS access control

**NON-GOALS**: Tag sharing between events, tag templates, advanced tag hierarchies

---

### 9. Message History Search & Filters

**TITLE**: Host Message Management — Search & Filter System

**INTENT**: Add search and filtering capabilities to message history for better message management and retrieval.

**REVIEW FIRST** (no code changes yet):
- Component: `components/features/messaging/host/RecentMessages.tsx`
- Hook: `hooks/useMessages.ts` (provides message list access)
- Data: Messages table with content, timestamps, sender info, message_type
- Current: Basic chronological message list display

**CHANGE REQUEST**:
- Add search input with real-time content filtering
- Implement date range picker for message filtering
- Add sender filter dropdown (show all message senders)
- Create message type filter (announcement, direct, channel)
- Add search result highlighting in message content
- Include message count and filtering summary

**TESTS**: Search functionality, date filtering, sender filtering, result highlighting

**ACCEPTANCE**:
- Search filters messages by content in real-time (debounced 300ms)
- Date picker allows custom range selection with presets (today, week, month)
- Sender filter shows dropdown of all users who've sent messages
- Message type filter toggles between announcement/direct/channel types
- Search terms highlighted in yellow within message content
- Filter summary shows "X of Y messages" with active filter count

**NON-GOALS**: Advanced search operators, message export, conversation threading

---

### 10. CSV Guest Export

**TITLE**: Host Guest Management — CSV Export Functionality

**INTENT**: Enable CSV export of guest list with RSVP status and contact information for external tools and backup.

**REVIEW FIRST** (no code changes yet):
- Hook: `hooks/useGuests.ts` (provides complete guest data)
- Component: `components/features/host-dashboard/GuestManagement.tsx`
- Data: Full guest information in event_guests table
- Current: Guest list display and filtering but no export capability

**CHANGE REQUEST**:
- Add "Export CSV" button to guest management header
- Create export configuration modal with column selection
- Generate CSV with guest name, phone, email, RSVP status, tags, notes
- Include current filter state in export (export only filtered guests)
- Add export progress indicator for large guest lists
- Implement client-side CSV generation and download

**TESTS**: CSV generation accuracy, column selection, filtered export, download trigger

**ACCEPTANCE**:
- Export button generates CSV file named "EventName_Guests_YYYYMMDD.csv"
- Column selection allows choosing which fields to include/exclude
- CSV includes headers and properly escaped content (commas, quotes)
- Export respects current filter state (only exports visible guests)
- Large guest lists (100+) show progress during generation
- File downloads automatically without requiring popup permission

**NON-GOALS**: Excel format export, advanced formatting, scheduled exports, cloud storage integration

---

## Development Notes

### Common Patterns
- All UI improvements leverage existing component structure
- Database access uses established RLS patterns
- Error handling follows existing useErrorHandler conventions
- Loading states use consistent LoadingSpinner components
- Mobile-first responsive design maintained throughout

### Technical Constraints
- No schema changes in immediate (Now) features
- Compound cursor implementation required for message pagination
- Local storage used for client-side data persistence
- Supabase RLS policies sufficient for all access control
- Bundle size budgets maintained through dynamic imports

### Testing Strategy  
- Unit tests for data transformation logic
- Component tests for UI interaction flows
- Integration tests for hook behavior
- E2E tests for complete user workflows
- Accessibility tests for touch targets and screen readers

These scopes provide clear, actionable development tasks with well-defined acceptance criteria and technical boundaries.
