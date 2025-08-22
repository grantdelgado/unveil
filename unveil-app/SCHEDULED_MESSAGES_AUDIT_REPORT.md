# Scheduled Messages Audit Report

**Date:** August 21, 2025  
**Time:** 16:48 UTC  
**Issue:** Scheduled messages not being sent at their scheduled time

## Executive Summary

A comprehensive audit revealed that scheduled messages are failing to send due to **two critical issues**:

1. **PRIMARY ISSUE**: Vercel cron jobs are not executing in production
2. **SECONDARY ISSUE**: Missing `scheduled_message_id` column in the `messages` table

## Audit Findings

### 🔴 CONFIRMED DEFECTS

#### 1. Overdue Message Found

- **Message ID**: `1f61fb73-663b-4584-a963-a8f0aaea075e`
- **Scheduled Time**: `2025-08-21 16:38:00 UTC`
- **Current Time**: `2025-08-21 16:48:22 UTC`
- **Status**: Still `scheduled` (10+ minutes overdue)
- **Recipients**: 3 guests
- **Content**: "Testing scheduled message."

#### 2. Missing Database Column

- **Table**: `messages`
- **Missing Column**: `scheduled_message_id UUID REFERENCES scheduled_messages(id)`
- **Impact**: Worker cannot properly link processed scheduled messages to their source records

### ✅ WORKING COMPONENTS

#### 1. RPC Function

- **Function**: `get_scheduled_messages_for_processing` exists and works correctly
- **Test Result**: Successfully returns the overdue message when called with current UTC time
- **SQL Logic**: Correctly filters by `send_at <= p_current_time` and `status = 'scheduled'`

#### 2. Worker Route Logic

- **Path**: `/app/api/messages/process-scheduled/route.ts`
- **Authentication**: Properly handles multiple auth methods (Bearer, x-cron-key, x-vercel-cron-signature)
- **Processing Logic**: Comprehensive message processing with proper state transitions
- **Error Handling**: Robust error handling and logging

#### 3. Cron Configuration

- **File**: `vercel.json`
- **Schedule**: `*/1 * * * *` (every minute)
- **Path**: `/api/messages/process-scheduled`
- **Format**: Correct Vercel cron configuration

### 🔍 ROOT CAUSE ANALYSIS

**Primary Issue**: The Vercel cron job is not executing in production. Evidence:

- Message scheduled for 16:38 UTC still pending at 16:48 UTC (10+ minutes overdue)
- RPC function works correctly when tested manually
- Worker route logic is sound
- No execution logs in Supabase API logs

**Secondary Issue**: Missing `scheduled_message_id` column would cause processing failures even if cron executed.

## Implemented Fixes

### 1. Database Schema Fix ✅

```sql
-- Added to messages table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS scheduled_message_id UUID REFERENCES scheduled_messages(id);

CREATE INDEX IF NOT EXISTS idx_messages_scheduled_message_id
ON messages(scheduled_message_id);
```

### 2. Worker Route Enhancement ✅

- Updated message creation to set `scheduled_message_id: message.id`
- Added development-only diagnostic endpoint for troubleshooting
- Enhanced GET handler with detailed diagnostic information (dev only)

### 3. TypeScript Types Update ✅

- Regenerated and updated `supabase.types.ts`
- Added `scheduled_message_id` field to `messages` table types

## Remaining Issues

### 1. Cron Execution Problem

The primary issue remains: **Vercel cron jobs are not executing in production**.

**Possible Causes:**

- Missing or incorrect `CRON_SECRET` environment variable in Vercel
- Vercel cron not properly configured for the project
- Regional/deployment issues with Vercel cron execution

**Next Steps:**

1. Verify `CRON_SECRET` is set in Vercel production environment variables
2. Check Vercel dashboard for cron execution logs
3. Test manual API endpoint call with proper authentication
4. Consider alternative scheduling mechanisms if Vercel cron is unreliable

### 2. Validation Needed

Once cron execution is fixed, validate that:

- Scheduled messages transition from `scheduled` → `sending` → `sent`
- `messages` table records are created with proper `scheduled_message_id`
- `message_deliveries` table is populated correctly
- SMS delivery via Twilio succeeds

## Test Commands

### Manual Testing (Development)

```bash
# Get diagnostic info (development only)
GET /api/messages/process-scheduled

# Dry run processing
POST /api/messages/process-scheduled?dryRun=1
Headers: x-cron-key: <CRON_SECRET>

# Live processing (use with caution)
POST /api/messages/process-scheduled
Headers: x-cron-key: <CRON_SECRET>
```

### Database Validation

```sql
-- Check for overdue messages
SELECT now() AT TIME ZONE 'utc' AS utc_now;
SELECT id, send_at, status FROM scheduled_messages WHERE status = 'scheduled';

-- After processing, verify links
SELECT sm.id as scheduled_id, m.id as message_id, m.scheduled_message_id
FROM scheduled_messages sm
LEFT JOIN messages m ON m.scheduled_message_id = sm.id
WHERE sm.status = 'sent';
```

## Impact Assessment

- **Severity**: HIGH - Scheduled messages completely non-functional
- **User Impact**: Users scheduling messages see them stuck in "scheduled" status
- **Business Impact**: Core messaging feature not working as expected
- **Data Integrity**: No data loss, but missing audit trail for processed messages

## Success Criteria

✅ Database schema fixed (scheduled_message_id column added)  
✅ Worker route enhanced with proper message linking  
✅ TypeScript types updated  
⏳ Cron execution restored in production  
⏳ End-to-end message processing validated  
⏳ Overdue message `1f61fb73-663b-4584-a963-a8f0aaea075e` successfully processed

## Files Modified

1. `supabase/migrations/20250821164500_add_scheduled_message_id_to_messages.sql` (new)
2. `app/api/messages/process-scheduled/route.ts` (modified)
3. `app/reference/supabase.types.ts` (updated)
4. `SCHEDULED_MESSAGES_AUDIT_REPORT.md` (new)

## Next Actions Required

1. **URGENT**: Investigate and fix Vercel cron execution in production
2. Validate end-to-end processing once cron is restored
3. Monitor the specific overdue message for successful processing
4. Consider adding alerting for future cron execution failures
