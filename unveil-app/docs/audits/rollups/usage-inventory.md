# Rollups Revert - Usage Inventory

## Rollup-Specific Code (TO BE REMOVED)

### UI Components

- **hooks/messaging/useMessageRollups.ts** - Complete file, rollup hook
- **components/features/messaging/host/RecentMessages.tsx** - Import and usage of useMessageRollups, getMessageRollup

### Database Objects  

- **message_delivery_rollups_v1** - View (exists in DB)
- **get_message_rollups(uuid)** - RPC function (exists in DB)  
- **final_status** - Generated column in message_deliveries (exists in DB)
- **idx_md_message_final** - Index (exists in DB)
- **idx_md_message_final_updated** - Index (exists in DB)

### Migration Files

- **supabase/migrations/20250130000030_message_rollups_view.sql** - Complete rollup implementation

### Documentation

- **docs/changes/message-rollups-summary.md** - Implementation summary
- **docs/audits/message-rollups/** - Audit directory with db-inventory.md, usage-inventory.md

## delivered_count / failed_count Usage Analysis

### UI Usage (ACTIVE - Cannot Remove Columns)

- **components/features/messaging/host/RecentMessages.tsx:458-460** - Uses rollup.delivered_count, rollup.failed_count for display
- **hooks/queries/useEventMessages.ts:112-113** - Sets default values delivered_count: 0, failed_count: 0

### Types (ACTIVE - Part of Schema)

- **app/reference/supabase.types.ts** - TypeScript definitions for messages table
- **types/supabase.ts** - TypeScript definitions for messages table

### Server/API (INACTIVE - Comment Only)

- **app/api/webhooks/twilio/route.ts:267** - TODO comment about fields not existing (outdated)

### Cron/Edge (NONE FOUND)

- No cron jobs or edge functions using these fields

### Tests (NONE FOUND)  

- No test files directly testing delivered_count/failed_count functionality

### Other Context Usage (DIFFERENT DOMAIN)

- **lib/services/eventCreation.ts** - Uses failed_count for guest import results (unrelated to message delivery)
- **components/features/events/GuestImportStep.tsx** - Displays guest import failed_count (unrelated)

## Schema Dependencies

### messages.delivered_count

- **USED BY**: RecentMessages component (via rollup), useEventMessages hook defaults
- **INDEXED BY**: idx_messages_delivered_count (WHERE delivered_count > 0)

### messages.failed_count  

- **USED BY**: RecentMessages component (via rollup), useEventMessages hook defaults
- **NO INDEXES**: No specific indexes found

### messages.delivered_at

- **USED BY**: RecentMessages component (via rollup), useEventMessages hook defaults  
- **NO INDEXES**: No specific indexes found

## Verdict

**CANNOT SAFELY REMOVE delivered_count/failed_count** - Active usage in UI components and hooks.

**CAN REMOVE**: All rollup-specific objects (view, RPC, generated column, indexes) as they are only used by the rollup system being reverted.

**KEEP**: messages.delivered_count, messages.failed_count, messages.delivered_at columns due to active UI dependencies.
