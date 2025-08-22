# Scheduled Messages Operations Runbook

## Quick Reference

### Emergency Contacts

- **Deployment URL**: `https://unveil-ajtd8da32-grant-delgados-projects.vercel.app` (latest)
- **Monitoring**: Vercel function logs + Supabase database queries
- **Cron Schedule**: Every minute (`*/1 * * * *`)

### Key Environment Variables

- `CRON_SECRET`: Authentication for processing endpoints
- `SCHEDULED_MAX_PER_TICK`: Rate limit (default: 100)
- `TWILIO_*`: SMS delivery credentials
- `SUPABASE_SERVICE_ROLE_KEY`: Database access

## Operational Commands

### Health Checks

#### 1. System Health

```bash
# Lightweight health check (no auth required)
curl -X GET "https://your-deployment.vercel.app/api/messages/process-scheduled?health=1"
```

**Expected Response:**

```json
{
  "ok": true,
  "timestamp": "2025-08-21T18:30:00.000Z",
  "lastRunAt": null,
  "lastResult": null
}
```

#### 2. Status Check

```bash
# Status without processing (no auth required)
curl -X GET "https://your-deployment.vercel.app/api/messages/process-scheduled?status=1"
```

### Manual Processing

#### 3. Dry Run Test

```bash
# Test processing without sending messages (requires auth)
curl -X POST "https://your-deployment.vercel.app/api/messages/process-scheduled?dryRun=1" \
  -H "x-cron-key: $CRON_SECRET"
```

#### 4. Force Processing

```bash
# Manually trigger processing (requires auth)
curl -X POST "https://your-deployment.vercel.app/api/messages/process-scheduled" \
  -H "x-cron-key: $CRON_SECRET"
```

#### 5. Cron Simulation

```bash
# Trigger via GET (simulates cron)
curl -X GET "https://your-deployment.vercel.app/api/messages/process-scheduled" \
  -H "x-cron-key: $CRON_SECRET"
```

## Database Operations

### Monitoring Queries

#### Check Processing Status

```sql
-- Recent processing activity
SELECT
  status,
  COUNT(*) as count,
  MIN(updated_at) as earliest,
  MAX(updated_at) as latest
FROM scheduled_messages
WHERE updated_at > now() - interval '1 hour'
GROUP BY status
ORDER BY status;
```

#### Find Overdue Messages

```sql
-- Messages that should have been processed
SELECT id, content, send_at, status, updated_at
FROM scheduled_messages
WHERE status = 'scheduled'
  AND send_at <= now()
ORDER BY send_at ASC
LIMIT 10;
```

#### Check Message Linking

```sql
-- Verify scheduled messages are properly linked to message records
SELECT
  sm.id as scheduled_id,
  sm.status,
  sm.success_count,
  m.id as message_id,
  COUNT(md.id) as delivery_count
FROM scheduled_messages sm
LEFT JOIN messages m ON m.scheduled_message_id = sm.id
LEFT JOIN message_deliveries md ON md.message_id = m.id
WHERE sm.updated_at > now() - interval '1 day'
  AND sm.status = 'sent'
GROUP BY sm.id, sm.status, sm.success_count, m.id
ORDER BY sm.updated_at DESC
LIMIT 20;
```

### Troubleshooting Queries

#### Find Stuck Messages

```sql
-- Messages stuck in 'sending' status
SELECT id, content, send_at, status, updated_at,
       EXTRACT(EPOCH FROM (now() - updated_at))/60 as minutes_stuck
FROM scheduled_messages
WHERE status = 'sending'
  AND updated_at < now() - interval '5 minutes'
ORDER BY updated_at ASC;
```

#### Check RPC Function

```sql
-- Test the RPC function directly
SELECT COUNT(*) as ready_messages
FROM get_scheduled_messages_for_processing(10, now());
```

## Common Issues & Solutions

### 1. No Messages Being Processed

**Symptoms:**

- Cron logs show "No scheduled messages ready for processing"
- Messages remain in 'scheduled' status past send_at time

**Diagnosis:**

```sql
-- Check if there are actually due messages
SELECT COUNT(*) FROM scheduled_messages
WHERE status = 'scheduled' AND send_at <= now();
```

**Solutions:**

- Verify system clock synchronization
- Check RPC function permissions
- Manual processing trigger

### 2. Messages Stuck in 'sending' Status

**Symptoms:**

- Messages show 'sending' status for >5 minutes
- No corresponding message records created

**Diagnosis:**

```sql
-- Find stuck messages
SELECT * FROM scheduled_messages
WHERE status = 'sending'
  AND updated_at < now() - interval '5 minutes';
```

**Solution:**

```sql
-- Reset specific stuck message (use exact ID)
UPDATE scheduled_messages
SET status = 'scheduled', updated_at = now()
WHERE id = 'EXACT_MESSAGE_ID'
  AND status = 'sending';
```

### 3. Cron Not Executing

**Symptoms:**

- No "GET-triggered scheduled message processing" logs
- Function logs show no activity

**Diagnosis:**

```bash
# Check recent logs
vercel logs <deployment-url> --json | grep -i cron
```

**Solutions:**

- Verify Vercel cron configuration in `vercel.json`
- Check deployment status
- Manual trigger to test function

### 4. Authentication Failures

**Symptoms:**

- 401 Unauthorized responses
- "Unauthorized request to scheduled messages" logs

**Diagnosis:**

- Check `CRON_SECRET` environment variable
- Verify Vercel cron headers

**Solutions:**

- Update environment variables
- Check header format in requests

### 5. High Processing Duration

**Symptoms:**

- `processingTimeMs > 30000` in logs
- Timeout errors

**Diagnosis:**

```sql
-- Check message batch sizes
SELECT COUNT(*) FROM scheduled_messages
WHERE status = 'scheduled' AND send_at <= now();
```

**Solutions:**

- Reduce `SCHEDULED_MAX_PER_TICK`
- Check database performance
- Verify network connectivity

## Break-Glass Procedures

### Emergency Message Cancellation

```sql
-- Cancel a problematic message before it sends
UPDATE scheduled_messages
SET status = 'cancelled', updated_at = now()
WHERE id = 'MESSAGE_ID_TO_CANCEL'
  AND status IN ('scheduled', 'sending');
```

### Bulk Message Reset

```sql
-- Reset multiple stuck messages (use carefully)
UPDATE scheduled_messages
SET status = 'scheduled', updated_at = now()
WHERE status = 'sending'
  AND updated_at < now() - interval '10 minutes'
  AND event_id = 'SPECIFIC_EVENT_ID'; -- Always scope to specific event
```

### Manual Message Processing

If automated processing fails completely:

1. **Identify Due Messages:**

```sql
SELECT id, event_id, content, send_at
FROM scheduled_messages
WHERE status = 'scheduled' AND send_at <= now()
ORDER BY send_at ASC;
```

2. **Process Via API:**

```bash
# Force processing of due messages
curl -X POST "https://your-deployment.vercel.app/api/messages/process-scheduled" \
  -H "x-cron-key: $CRON_SECRET" \
  -H "Content-Type: application/json"
```

3. **Verify Results:**

```sql
-- Check processing results
SELECT id, status, success_count, failure_count, sent_at
FROM scheduled_messages
WHERE id IN ('message_id_1', 'message_id_2', ...);
```

## Monitoring Checklist

### Daily Checks

- [ ] No stuck messages in 'sending' status
- [ ] Cron execution logs present (every minute)
- [ ] No processing errors in last 24h
- [ ] Message delivery success rate >95%

### Weekly Checks

- [ ] Function performance metrics
- [ ] Database query performance
- [ ] Environment variable validation
- [ ] Twilio account status and credits

### Monthly Checks

- [ ] Review and update monitoring thresholds
- [ ] Test break-glass procedures
- [ ] Verify backup and recovery processes
- [ ] Update documentation with new issues/solutions

## Escalation Procedures

### Severity Levels

**Critical (P0)**: Complete system failure

- No cron execution for >10 minutes
- All message processing failing
- Database connectivity lost
- **Response**: Immediate action, page on-call

**High (P1)**: Partial functionality impacted

- > 50% message processing failures
- Stuck messages affecting user experience
- Performance degradation
- **Response**: 1-hour response time

**Medium (P2)**: Minor issues

- Individual message failures
- Performance slowdowns
- Non-critical errors
- **Response**: Next business day

**Low (P3)**: Monitoring/maintenance

- Documentation updates needed
- Performance optimization opportunities
- **Response**: Weekly review

## Change Management

### Deployment Safety

1. Always test in staging environment first
2. Use feature flags for risky changes
3. Monitor logs closely after deployment
4. Have rollback plan ready

### Schema Changes

1. Use idempotent migrations
2. Test with production data volume
3. Coordinate with message processing schedule
4. Monitor performance impact

### Configuration Updates

1. Update environment variables via Vercel dashboard
2. Verify changes in deployment logs
3. Test functionality after changes
4. Document all configuration changes

## Support Information

### Log Analysis

- **Function Logs**: `vercel logs <deployment-url>`
- **Database Logs**: Supabase dashboard
- **SMS Delivery**: Twilio console

### Key Metrics

- Processing success rate
- Average processing duration
- Message delivery rate
- Cron execution frequency

### Documentation Updates

Keep this runbook updated with:

- New error patterns discovered
- Additional troubleshooting steps
- Performance optimization tips
- Lessons learned from incidents
