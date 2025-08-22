# RPC Ambiguity Fix Report

**Date:** August 21, 2025  
**Issue:** RPC function ambiguity blocking scheduled message processing  
**Error:** "Could not choose the best candidate function between: public.get_scheduled_messages_for_processing(p_current_time => text, p_limit => integer), public.get_scheduled_messages_for_processing(p_limit => integer, p_current_time => timestamptz)"

## Functions Found/Removed

### Before Fix

**Found 2 conflicting overloads:**

1. **TIMESTAMPTZ Overload (Keep)**:

   - **Signature**: `p_limit integer DEFAULT 100, p_current_time timestamptz DEFAULT now()`
   - **Return Type**: `SETOF scheduled_messages`
   - **Implementation**: Simple SQL query with proper locking

2. **TEXT Overload (Remove)**:
   - **Signature**: `p_current_time text DEFAULT NULL::text, p_limit integer DEFAULT 100`
   - **Return Type**: `TABLE(...)` with explicit column definitions
   - **Implementation**: Complex PL/pgSQL with text parsing

### After Fix

**Single canonical function:**

```sql
CREATE OR REPLACE FUNCTION public.get_scheduled_messages_for_processing(
  p_limit integer DEFAULT 100,
  p_current_time timestamptz DEFAULT now()
)
RETURNS SETOF scheduled_messages
```

## Final Signature Details

- **Function Name**: `get_scheduled_messages_for_processing`
- **Parameters**:
  - `p_limit integer DEFAULT 100`
  - `p_current_time timestamptz DEFAULT now()`
- **Return Type**: `SETOF scheduled_messages`
- **Security**: `SECURITY DEFINER`
- **Language**: `sql`
- **Permissions**: Granted to `authenticated` and `service_role`

## Function Body (Preserved)

```sql
SELECT * FROM scheduled_messages
WHERE status = 'scheduled'
  AND send_at <= p_current_time
ORDER BY send_at ASC
LIMIT p_limit
FOR UPDATE SKIP LOCKED;
```

## Code Callsite Verification

**File**: `app/api/messages/process-scheduled/route.ts`

**RPC Calls Found**: 2 locations

1. **Main Processing** (Line 53):

```typescript
const { data: readyMessages, error: fetchError } = await supabase.rpc(
  'get_scheduled_messages_for_processing',
  {
    p_limit: 100,
    p_current_time: new Date().toISOString(),
  },
);
```

2. **Development Diagnostics** (Line 501):

```typescript
const { data: pendingMessages, error: pendingError } = await supabase.rpc(
  'get_scheduled_messages_for_processing',
  {
    p_limit: 10,
    p_current_time: new Date().toISOString(),
  },
);
```

**✅ Verification Result**: Both calls use correct named parameters that match the canonical signature.

## RPC Function Test Result

**Direct SQL Test**: `SELECT * FROM get_scheduled_messages_for_processing(100, now());`

**Result**: ✅ SUCCESS

- **Messages Found**: 1 overdue message
- **Message ID**: `1f61fb73-663b-4584-a963-a8f0aaea075e`
- **Send Time**: `2025-08-21 16:38:00+00` (UTC)
- **Status**: `scheduled` (overdue)
- **Recipients**: 3 guests
- **Content**: "Testing scheduled message."

## Dry-Run Endpoint Test

**Note**: Unable to test deployed endpoint directly without deployment URL.

**Manual Test Instructions**:

```bash
# Replace YOUR_DEPLOYMENT_URL with actual Vercel deployment URL
# Replace YOUR_CRON_SECRET with actual CRON_SECRET value

curl -X POST "https://YOUR_DEPLOYMENT_URL/api/messages/process-scheduled?dryRun=1" \
  -H "x-cron-key: YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

**Expected Response** (based on RPC test):

```json
{
  "success": true,
  "timestamp": "2025-08-21T16:50:00.000Z",
  "totalProcessed": 0,
  "successful": 0,
  "failed": 0,
  "details": [
    {
      "messageId": "1f61fb73-663b-4584-a963-a8f0aaea075e",
      "eventId": "24caa3a8-020e-4a80-9899-35ff2797dcc0",
      "sendAt": "2025-08-21 16:38:00+00",
      "content": "Testing scheduled message...",
      "recipientCount": 3,
      "scheduledTz": "America/Denver",
      "scheduledLocal": "2025-08-21T10:38:00"
    }
  ],
  "isDryRun": true,
  "message": "Would process 1 scheduled messages"
}
```

## Resolution Status

- ✅ **RPC Ambiguity Resolved**: TEXT overload dropped, single canonical function remains
- ✅ **Function Signature Verified**: Matches worker route expectations
- ✅ **Permissions Granted**: `authenticated` and `service_role` have execute access
- ✅ **Code Callsites Verified**: Worker route uses correct named parameters
- ✅ **Function Tested**: Returns 1 overdue message successfully
- ⏳ **Endpoint Test**: Requires deployment URL for full end-to-end verification

## Next Steps

1. **Test Deployed Endpoint**: Use actual deployment URL to run dry-run test
2. **Process Overdue Message**: If dry-run shows dueCount > 0, execute live processing
3. **Monitor**: Verify scheduled message processing works end-to-end

## Files Modified

1. **Migration Applied**: `fix_scheduled_messages_rpc_ambiguity`

   - Dropped conflicting TEXT overload
   - Ensured canonical TIMESTAMPTZ function
   - Granted proper permissions

2. **Report Generated**: `RPC_AMBIGUITY_FIX_REPORT.md`

## Impact

- **Issue Resolved**: RPC ambiguity error should no longer occur
- **Processing Unblocked**: Worker can now call RPC function without conflicts
- **Backward Compatible**: Existing code continues to work with canonical signature
- **Performance**: Simplified to single SQL function (no PL/pgSQL overhead)
