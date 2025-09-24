---
title: "Scheduled Messages Monitoring & Alerts"
status: active
lastReviewed: 2025-09-19
category: consolidated
originalLocation: "SCHEDULED_MESSAGES_ALERTS.md"
---

# Scheduled Messages Monitoring & Alerts

## Overview

This document outlines the monitoring strategy and recommended alerts for the scheduled messaging system in production.

## Key Metrics to Monitor

### 1. Cron Execution Health

- **Metric**: Successful cron job executions every minute
- **Alert**: No cron runs detected in 10 minutes
- **Query Pattern**: Look for log entries containing `"GET-triggered scheduled message processing"`

### 2. Processing Success Rate

- **Metric**: Ratio of successful vs failed scheduled message processing
- **Alert**: `failed > 0` in any processing run
- **Query Pattern**: Look for `"successful": X, "failed": Y` in processing results

### 3. Database Connectivity

- **Metric**: RPC function execution success
- **Alert**: Database errors in processing route
- **Query Pattern**: Look for `"Failed to fetch scheduled messages"` or RPC errors

### 4. Message Delivery Success

- **Metric**: SMS delivery success rate via Twilio
- **Alert**: High delivery failure rate (>10% failures)
- **Query Pattern**: Look for Twilio error codes in delivery logs

## Log Patterns to Monitor

### Successful Processing

```json
{
  "level": "info",
  "message": "GET-triggered scheduled message processing",
  "data": {
    "jobId": "job_1755800855221_qgxvli",
    "isCron": true
  }
}
```

```json
{
  "level": "info",
  "message": "Cron processing completed",
  "data": {
    "jobId": "job_1755800855221_qgxvli",
    "totalProcessed": 1,
    "successful": 1,
    "failed": 0,
    "processingTimeMs": 2430
  }
}
```

### Error Patterns to Alert On

```json
{
  "level": "error",
  "message": "Failed to fetch scheduled messages",
  "error": "RPC error details"
}
```

```json
{
  "level": "error",
  "message": "Error processing scheduled messages",
  "error": "Processing error details"
}
```

## Recommended Alert Rules

### 1. Cron Health Check

**Condition**: No log entries matching `"GET-triggered scheduled message processing"` in last 10 minutes
**Severity**: Critical
**Action**: Check Vercel cron configuration and function deployment

### 2. Processing Failures

**Condition**: Any log entry with `"failed": N` where N > 0
**Severity**: High
**Action**: Check database connectivity and message validity

### 3. High Processing Duration

**Condition**: `"processingTimeMs"` > 30000 (30 seconds)
**Severity**: Medium
**Action**: Check for database performance issues or large message batches

### 4. RPC Errors

**Condition**: Log entries containing `"Failed to fetch scheduled messages"`
**Severity**: High
**Action**: Check Supabase connectivity and RPC function status

## Manual Verification Commands

### Check Recent Processing Activity

```bash
# View recent function logs
vercel logs <deployment-url> --json | grep "scheduled message"
```

### Database Health Check

```sql
-- Check for stuck messages (in 'sending' status for >5 minutes)
SELECT id, status, send_at, updated_at
FROM scheduled_messages
WHERE status = 'sending'
  AND updated_at < now() - interval '5 minutes';

-- Check recent processing success
SELECT
  status,
  COUNT(*) as count,
  AVG(success_count) as avg_success,
  AVG(failure_count) as avg_failures
FROM scheduled_messages
WHERE updated_at > now() - interval '1 hour'
GROUP BY status;
```

### Manual Processing Test

```bash
# Dry run test (requires CRON_SECRET)
curl -X POST "https://your-deployment.vercel.app/api/messages/process-scheduled?dryRun=1" \
  -H "x-cron-key: $CRON_SECRET"

# Health check
curl -X GET "https://your-deployment.vercel.app/api/messages/process-scheduled?health=1"
```

## Break-Glass Procedures

### 1. Stuck Message Recovery

If messages are stuck in 'sending' status:

```sql
-- Reset stuck messages back to scheduled (use carefully)
UPDATE scheduled_messages
SET status = 'scheduled',
    updated_at = now()
WHERE status = 'sending'
  AND updated_at < now() - interval '10 minutes'
  AND id = 'SPECIFIC_MESSAGE_ID'; -- Always specify exact ID
```

### 2. Manual Processing Trigger

If cron stops working:

```bash
# Trigger processing manually (requires authentication)
curl -X POST "https://your-deployment.vercel.app/api/messages/process-scheduled" \
  -H "x-cron-key: $CRON_SECRET"
```

### 3. Emergency Message Cancellation

To prevent a problematic message from sending:

```sql
-- Cancel a specific scheduled message
UPDATE scheduled_messages
SET status = 'cancelled',
    updated_at = now()
WHERE id = 'MESSAGE_ID_TO_CANCEL'
  AND status = 'scheduled';
```

## Twilio Error Codes Reference

Common Twilio error codes to monitor:

- **21211**: Invalid phone number format
- **21614**: Message body exceeds character limit
- **30007**: Message delivery failure
- **30008**: Unknown error occurred

## Implementation Notes

- All processing includes unique `jobId` for correlation
- Processing duration is logged for performance monitoring
- Individual message failures don't crash the entire job
- FOR UPDATE SKIP LOCKED prevents duplicate processing
- Rate limiting via `SCHEDULED_MAX_PER_TICK` environment variable

## Next Steps

1. Set up log aggregation and alerting in your monitoring system
2. Configure notification channels (Slack, email, PagerDuty)
3. Create dashboards for key metrics visualization
4. Test alert rules with intentional failures
5. Document escalation procedures for different severity levels
