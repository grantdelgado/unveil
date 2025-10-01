# Database Object Code References

## Summary
Found **59 direct database references** across **50+ files** in the codebase.

## High-Level Patterns

### Table Usage Patterns
- **event_guests**: Most referenced (15+ files) - Core guest management
- **messages**: Heavy usage (10+ files) - Messaging system
- **message_deliveries**: Moderate usage (5+ files) - SMS/notification delivery
- **events**: Core entity (8+ files) - Event management
- **users**: Authentication/profile (6+ files) - User management
- **media**: Media uploads (3+ files) - Photo/video handling
- **scheduled_messages**: Scheduling system (3+ files) - Automated messaging

### Access Patterns
- **Direct Supabase queries**: `supabase.from('table_name')`
- **RPC calls**: `.rpc('function_name')`
- **Realtime subscriptions**: Channel-based real-time updates

## Detailed References by Object

### Core Tables (High Usage)

#### `event_guests` (15+ references)
- `hooks/useGuests.ts` - Primary guest management
- `app/test-support/api/create-session/route.ts` - Test data setup
- `app/guest/events/[eventId]/schedule/page.tsx` - Guest schedule access
- `hooks/events/useEventWithGuest.ts` - Guest-event relationships
- `hooks/messaging/useRecipientPreview.ts` - Message targeting
- Multiple test files for guest functionality

#### `messages` (10+ references) 
- `hooks/messaging/_core/useEventMessagesList.ts` - Message listing
- `hooks/messaging/_core/useMessageById.ts` - Single message queries
- `hooks/messaging/_core/useMessageMutations.ts` - Message CRUD
- `hooks/messaging/useGuestMessagesRPC.ts` - Guest message access
- `app/host/events/[eventId]/messages/page.tsx` - Host messaging UI

#### `message_deliveries` (8+ references)
- `hooks/messaging/_core/useDeliveriesByMessage.ts` - Delivery tracking
- `hooks/messaging/useGuestMessagesRPC.ts` - Guest delivery status
- Test files for delivery verification

#### `events` (8+ references)
- `hooks/useEvents.ts` - Event management
- `app/guest/events/[eventId]/schedule/page.tsx` - Event details
- `app/host/events/[eventId]/messages/page.tsx` - Host event access
- `components/features/messaging/host/MessageComposer.tsx` - Event context

### Specialized Tables (Moderate Usage)

#### `users` (6+ references)
- `app/(auth)/setup/page.tsx` - User onboarding
- `app/(auth)/profile/page.tsx` - Profile management
- `app/test-support/api/create-session/route.ts` - Authentication setup

#### `media` (4+ references)
- `hooks/useMedia.ts` - Media management
- `components/features/media/GuestPhotoGallery.tsx` - Photo gallery

#### `scheduled_messages` (3+ references)
- `hooks/messaging/_core/useMessageMutations.ts` - Scheduling
- `hooks/messaging/useScheduledMessages.ts` - Schedule management

### Utility Tables (Low Usage)

#### `rum_events` (2+ references)
- `app/api/rum/route.ts` - Performance metrics
- `scripts/rum-report.ts` - Analytics reporting

#### `event_schedule_items` (1 reference)
- `app/guest/events/[eventId]/schedule/page.tsx` - Schedule display

### Views

#### `rum_p75_7d` (2+ references)
- `app/api/rum/route.ts` - Performance dashboard
- `scripts/rum-report.ts` - Analytics queries

## Decommission Risk Assessment

### **HIGH RISK** (Active, Core Usage)
- `event_guests`, `messages`, `events`, `users` - **DO NOT REMOVE**
- Heavy integration across multiple modules

### **MEDIUM RISK** (Moderate Usage)
- `message_deliveries`, `media`, `scheduled_messages` - **CONSOLIDATE CAREFULLY**
- Used by specific features, removal would break functionality

### **LOW RISK** (Utility/Analytics)
- `rum_events`, `rum_p75_7d` - **SAFE TO DEPRECATE**
- Limited to reporting/analytics, minimal business impact

### **ZERO RISK** (Unused in Code)
- Auth-related tables (`refresh_tokens`, `sessions`, etc.) - **SUPABASE MANAGED**
- Partitioned message tables (`messages_2025_*`) - **ARCHIVAL/CLEANUP CANDIDATES**

## Recommendations

1. **Keep Core Tables**: `events`, `users`, `event_guests`, `messages`
2. **Audit Medium-Risk Tables**: Review `message_deliveries` for optimization opportunities
3. **Archive Old Partitions**: `messages_2025_*` tables appear unused in current code
4. **Monitor Analytics**: `rum_*` objects could be moved to separate analytics DB
