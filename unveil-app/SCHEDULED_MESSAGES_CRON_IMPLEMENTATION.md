# Scheduled Messages Cron Implementation Guide

**Date:** August 21, 2025  
**Status:** ✅ COMPLETED  
**Issue:** Enable automatic scheduled message processing via Vercel Cron

## Overview

This implementation enables Vercel Cron to automatically process scheduled messages every minute via GET requests to `/api/messages/process-scheduled`. The system maintains backward compatibility with manual POST processing while adding robust safety rails and observability.

## Architecture Changes

### 🔄 **Shared Processing Logic**

- **Function**: `processDueScheduledMessages(options: ProcessingOptions)`
- **Purpose**: Centralized processing logic used by both GET (cron) and POST (manual) handlers
- **Features**: Idempotency, rate limiting, structured logging, error handling

### 🔍 **Cron Detection**

The system detects cron requests via:

1. `x-vercel-cron-signature` header (Vercel automatic)
2. `user-agent: vercel-cron/*` header
3. `x-cron-key` header presence
4. `?mode=cron` query parameter (explicit)

### 🛡️ **Safety Rails**

- **Rate Limiting**: `SCHEDULED_MAX_PER_TICK` environment variable (default: 100)
- **Authentication**: Required for all processing operations
- **Jitter**: ±10s random delay to prevent overlapping cron invocations
- **Idempotency**: `FOR UPDATE SKIP LOCKED` prevents duplicate processing

## API Endpoints

### GET `/api/messages/process-scheduled`

**Behavior depends on request type:**

#### 1. Cron Processing (with cron headers)

```bash
# Vercel Cron (automatic)
GET /api/messages/process-scheduled
Headers: x-vercel-cron-signature: <signature>

# Manual cron mode
GET /api/messages/process-scheduled?mode=cron
Headers: x-cron-key: <secret>
```

**Response:**

```json
{
  "success": true,
  "timestamp": "2025-08-21T16:50:00.000Z",
  "totalProcessed": 2,
  "successful": 2,
  "failed": 0,
  "details": [
    {
      "messageId": "msg-123",
      "status": "sent",
      "recipientCount": 3
    }
  ],
  "processingTimeMs": 1250,
  "isDryRun": false,
  "jobId": "job_1724259000_abc123",
  "message": "Processed 2 scheduled messages: 2 successful, 0 failed"
}
```

#### 2. Health Check

```bash
GET /api/messages/process-scheduled?health=1
```

**Response:**

```json
{
  "ok": true,
  "timestamp": "2025-08-21T16:50:00.000Z",
  "lastRunAt": null,
  "lastResult": null
}
```

#### 3. Status Check (no cron headers)

```bash
GET /api/messages/process-scheduled
```

**Response (Production):**

```json
{
  "success": true,
  "timestamp": "2025-08-21T16:50:00.000Z",
  "stats": {
    "pending": 0,
    "processed": 0,
    "failed": 0,
    "message": "Use useMessages hook for real-time message data"
  }
}
```

**Response (Development):**

```json
{
  "success": true,
  "timestamp": "2025-08-21T16:50:00.000Z",
  "environment": "development",
  "diagnostics": {
    "utcNow": "2025-08-21T16:50:00.000Z",
    "hasCronSecret": true,
    "cronSecretLength": 32,
    "pendingMessagesCount": 1,
    "pendingMessages": [
      {
        "id": "msg-123",
        "sendAt": "2025-08-21T16:38:00Z",
        "status": "scheduled",
        "recipientCount": 3
      }
    ],
    "requestInfo": {
      "isCron": false,
      "cronMode": false,
      "isHealthCheck": false,
      "shouldProcess": false,
      "userAgent": "Mozilla/5.0...",
      "hasVercelSignature": false
    }
  },
  "stats": {
    "pending": 1,
    "processed": 0,
    "failed": 0,
    "message": "Development diagnostic endpoint"
  }
}
```

### POST `/api/messages/process-scheduled` (Unchanged)

**Manual Processing:**

```bash
# Dry run
POST /api/messages/process-scheduled?dryRun=1
Headers: x-cron-key: <secret>

# Live processing
POST /api/messages/process-scheduled
Headers: x-cron-key: <secret>
```

## Environment Variables

| Variable                 | Default    | Description                                      |
| ------------------------ | ---------- | ------------------------------------------------ |
| `CRON_SECRET`            | _required_ | Authentication secret for cron/manual processing |
| `SCHEDULED_MAX_PER_TICK` | `100`      | Maximum messages to process per cron invocation  |
| `NODE_ENV`               | -          | Controls diagnostic information exposure         |

## Authentication Methods

The system accepts any of these authentication methods:

1. **Bearer Token**: `Authorization: Bearer <CRON_SECRET>`
2. **Cron Key**: `x-cron-key: <CRON_SECRET>`
3. **Vercel Signature**: `x-vercel-cron-signature: <signature>` (automatic)

## Logging & Observability

### Structured Logging

All operations include structured log data:

- **Job ID**: Unique identifier per processing run (`job_<timestamp>_<random>`)
- **Processing Metrics**: Start/end times, counts, duration
- **Error Context**: Detailed error information with context

### Log Examples

```javascript
// Cron start
logger.api('Cron-triggered scheduled message processing', {
  jobId: 'job_1724259000_abc123',
  isCron: true,
  cronMode: false,
});

// Processing complete
logger.api('Cron processing completed', {
  jobId: 'job_1724259000_abc123',
  totalProcessed: 2,
  successful: 2,
  failed: 0,
  processingTimeMs: 1250,
});

// Individual message
logger.api(
  'Processed scheduled message msg-123: sent, delivered: 3, failed: 0',
  {
    jobId: 'job_1724259000_abc123',
  },
);
```

### Warnings

- Non-cron GET requests generate warnings
- Unauthorized processing attempts are logged
- Processing errors include full context

## Testing

### Manual Testing

#### Dry Run (Development)

```bash
curl -X POST "http://localhost:3000/api/messages/process-scheduled?dryRun=1" \
  -H "x-cron-key: your-cron-secret"
```

#### Cron Simulation

```bash
curl -X GET "http://localhost:3000/api/messages/process-scheduled?mode=cron" \
  -H "x-cron-key: your-cron-secret"
```

#### Health Check

```bash
curl -X GET "http://localhost:3000/api/messages/process-scheduled?health=1"
```

#### Status Check (Development)

```bash
curl -X GET "http://localhost:3000/api/messages/process-scheduled"
```

### Production Testing

#### Verify Cron Execution (Production)

1. Check Vercel Function logs for cron invocations
2. Monitor database for scheduled message status transitions
3. Verify delivery records are created

#### Validate Processing

```sql
-- Check for processed messages
SELECT id, status, sent_at, success_count, failure_count
FROM scheduled_messages
WHERE status IN ('sent', 'partially_failed', 'failed')
ORDER BY sent_at DESC;

-- Verify message records are linked
SELECT sm.id as scheduled_id, m.id as message_id, m.scheduled_message_id
FROM scheduled_messages sm
JOIN messages m ON m.scheduled_message_id = sm.id
WHERE sm.status = 'sent';

-- Check delivery records
SELECT md.*, sm.content
FROM message_deliveries md
JOIN messages m ON md.message_id = m.id
JOIN scheduled_messages sm ON m.scheduled_message_id = sm.id
ORDER BY md.created_at DESC;
```

## Acceptance Criteria

### ✅ **Functional Requirements**

- [x] Cron GET requests trigger message processing
- [x] Manual POST requests work exactly as before
- [x] Dry run mode prevents actual SMS/email sending
- [x] Health endpoint provides lightweight status
- [x] Development diagnostics show pending messages

### ✅ **Safety Requirements**

- [x] Authentication required for all processing
- [x] Rate limiting via `SCHEDULED_MAX_PER_TICK`
- [x] Idempotency prevents duplicate sends
- [x] Jitter reduces overlapping cron invocations
- [x] Error handling prevents system crashes

### ✅ **Observability Requirements**

- [x] Structured logging with job IDs
- [x] Processing metrics (duration, counts, errors)
- [x] Cron detection and warning logs
- [x] Development diagnostic information

### ✅ **Backward Compatibility**

- [x] POST endpoint behavior unchanged
- [x] Existing authentication methods work
- [x] API response formats maintained
- [x] No breaking changes to client code

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Cron Execution**: Vercel function logs every minute
2. **Processing Success Rate**: `successful / totalProcessed`
3. **Processing Duration**: `processingTimeMs` trends
4. **Pending Message Count**: Messages stuck in `scheduled` status
5. **Error Rates**: Failed message processing

### Recommended Alerts

- Cron execution failures (no logs for >5 minutes)
- High failure rates (>10% failed messages)
- Long processing times (>30 seconds)
- Growing pending message backlog

## Troubleshooting

### Common Issues

#### Cron Not Executing

1. **Check Vercel Dashboard**: Verify cron is configured and running
2. **Check Environment Variables**: Ensure `CRON_SECRET` is set in production
3. **Check Function Logs**: Look for authentication errors

#### Messages Not Processing

1. **Check RPC Function**: Verify `get_scheduled_messages_for_processing` exists
2. **Check Database Schema**: Ensure `messages.scheduled_message_id` column exists
3. **Check Message Status**: Verify messages are in `scheduled` status

#### Authentication Errors

1. **Verify CRON_SECRET**: Check environment variable in Vercel
2. **Check Headers**: Ensure cron requests include proper headers
3. **Review Logs**: Look for specific authentication failure details

### Debug Commands

#### Check Pending Messages

```sql
SELECT id, send_at, status, recipient_count
FROM scheduled_messages
WHERE status = 'scheduled'
AND send_at <= now()
ORDER BY send_at;
```

#### Test RPC Function

```sql
SELECT * FROM get_scheduled_messages_for_processing(10, now());
```

#### Check Recent Processing

```sql
SELECT * FROM scheduled_messages
WHERE updated_at > now() - interval '1 hour'
ORDER BY updated_at DESC;
```

## File Changes

### Modified Files

1. **`app/api/messages/process-scheduled/route.ts`**
   - Extracted shared processing logic
   - Updated GET handler for cron processing
   - Added safety rails and observability
   - Maintained backward compatibility

### New Files

1. **`__tests__/api/process-scheduled-cron.test.ts`**

   - Unit tests for cron functionality
   - Authentication and detection tests
   - Error handling tests

2. **`__tests__/integration/scheduled-messages-cron-integration.test.ts`**

   - End-to-end integration tests
   - Full processing flow validation
   - Error scenarios and idempotency

3. **`SCHEDULED_MESSAGES_CRON_IMPLEMENTATION.md`**
   - Comprehensive implementation guide
   - API documentation
   - Testing and troubleshooting guide

### Unchanged Files

- `vercel.json` - Cron configuration remains the same
- Database schema - No additional schema changes
- Client code - No breaking changes

## Next Steps

### Immediate Actions

1. **Deploy to Production**: Merge and deploy the implementation
2. **Monitor Logs**: Watch for successful cron execution
3. **Verify Processing**: Check that scheduled messages are sent

### Future Enhancements

1. **Last Run Tracking**: Implement caching for health endpoint
2. **Metrics Dashboard**: Add monitoring for processing metrics
3. **Alert Integration**: Set up alerts for processing failures
4. **Performance Optimization**: Add batch processing improvements

## Conclusion

This implementation successfully enables automatic scheduled message processing via Vercel Cron while maintaining full backward compatibility and adding comprehensive safety rails. The system is production-ready with robust error handling, observability, and testing coverage.
