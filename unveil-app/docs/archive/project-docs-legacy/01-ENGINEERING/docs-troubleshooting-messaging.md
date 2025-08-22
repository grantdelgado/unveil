# 🔧 Messaging System Troubleshooting Guide

## Quick Diagnosis Checklist

When encountering messaging issues, run through this checklist:

1. **Environment Check**

   ```bash
   npx tsx scripts/validate-production-env.ts
   ```

2. **Build Verification**

   ```bash
   pnpm build && pnpm lint
   ```

3. **Database Connection Test**

   - Check Supabase dashboard is accessible
   - Verify RLS policies are active
   - Confirm migrations are applied

4. **CRON Job Status**
   - Check Vercel function logs
   - Verify CRON_SECRET is configured
   - Test manual execution

## Common Issues & Solutions

### 🚫 Messages Not Sending

#### **Symptom**: Messages stuck in "scheduled" status

**Diagnosis Steps:**

1. Check CRON job execution in Vercel dashboard
2. Verify `send_at` timestamp is in the past
3. Examine function logs for errors

**Common Causes & Solutions:**

**CRON Job Not Running**

```bash
# Check Vercel CRON configuration
cat vercel.json

# Expected output:
{
  "crons": [{
    "path": "/api/cron/process-messages",
    "schedule": "0 9 * * *"
  }]
}
```

**Solution**: Ensure CRON job is deployed and environment variables are set in Vercel.

**Missing CRON_SECRET**

```bash
# Check environment variable exists
echo $CRON_SECRET  # Should output 32+ character string
```

**Solution**: Set `CRON_SECRET` in Vercel environment variables.

**Timezone Issues**

```sql
-- Check message scheduling in database
SELECT id, content, send_at, status, created_at
FROM scheduled_messages
WHERE status = 'scheduled'
ORDER BY send_at ASC;
```

**Solution**: Ensure `send_at` times are in UTC and properly formatted.

#### **Symptom**: CRON job runs but no messages delivered

**Diagnosis Steps:**

1. Check message delivery records
2. Verify guest data completeness
3. Review delivery service configurations

```sql
-- Check delivery attempts
SELECT sm.content, md.guest_id, md.sms_status, md.email_status, md.push_status
FROM scheduled_messages sm
JOIN message_deliveries md ON sm.id = md.message_id
WHERE sm.status = 'sent'
ORDER BY sm.created_at DESC LIMIT 10;
```

**Common Solutions:**

- **Missing Guest Data**: Ensure guests have valid phone numbers and emails
- **Twilio Issues**: Check account balance and phone number verification
- **Service Limits**: Verify API rate limits haven't been exceeded

### 📱 SMS Delivery Problems

#### **Symptom**: SMS status shows "failed"

**Diagnosis Steps:**

1. Check Twilio account status and balance
2. Verify phone number format validation
3. Review Twilio delivery logs

**Common Causes & Solutions:**

**Invalid Phone Numbers**

```typescript
// Phone number validation check
const isValidPhone = (phone: string) => {
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
};
```

**Solution**: Update guest phone numbers to E.164 format (+1234567890).

**Twilio Account Issues**

```bash
# Check Twilio environment variables
echo $TWILIO_ACCOUNT_SID
echo $TWILIO_AUTH_TOKEN
echo $TWILIO_PHONE_NUMBER
```

**Solution**: Verify credentials in Twilio console and update environment variables.

**Message Content Violations**

- Check for blocked keywords
- Ensure message length is under carrier limits
- Avoid suspicious content patterns

#### **Symptom**: SMS sent but not received

**Diagnosis Steps:**

1. Check delivery status in Twilio console
2. Verify recipient phone number is active
3. Test with different carriers

**Solutions:**

- **Carrier Blocking**: Try alternative phone numbers for testing
- **Message Filtering**: Avoid promotional language in content
- **Delivery Reports**: Enable delivery receipts in Twilio settings

### 📊 Analytics Not Updating

#### **Symptom**: Dashboard shows empty or outdated metrics

**Diagnosis Steps:**

1. Check if message deliveries are being created
2. Verify read tracking is functioning
3. Review analytics query performance

```sql
-- Check recent delivery data
SELECT COUNT(*) as total_deliveries,
       COUNT(CASE WHEN sms_status = 'delivered' THEN 1 END) as sms_delivered,
       COUNT(CASE WHEN has_responded = true THEN 1 END) as responses
FROM message_deliveries
WHERE created_at >= NOW() - INTERVAL '7 days';
```

**Common Solutions:**

**Missing Delivery Records**

```typescript
// Ensure delivery records are created in message processor
await createMessageDelivery({
  message_id: message.id,
  guest_id: guest.id,
  user_id: guest.user_id,
  // ... other fields
});
```

**Read Tracking Not Working**

```typescript
// Check read tracking implementation
const handleMessageRead = async (deliveryId: string) => {
  await recordMessageRead(deliveryId);
  // Update UI optimistically
};
```

**Query Performance Issues**

- Check database indexes on `event_id`, `message_id`, `created_at`
- Consider pagination for large datasets
- Monitor query execution times

### 🔄 Real-time Updates Not Working

#### **Symptom**: New messages don't appear instantly

**Diagnosis Steps:**

1. Check browser console for WebSocket errors
2. Verify Supabase real-time is enabled
3. Test subscription setup

```typescript
// Debug real-time subscription
const subscription = supabase
  .channel(`event-${eventId}-messages`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `event_id=eq.${eventId}`,
    },
    (payload) => {
      console.log('Real-time message received:', payload);
      // Handle new message
    },
  )
  .subscribe((status) => {
    console.log('Subscription status:', status);
  });
```

**Common Solutions:**

**WebSocket Connection Issues**

- Check browser network tab for WebSocket connections
- Verify Supabase URL is correct
- Test with different browsers/networks

**Subscription Filtering**

- Ensure event_id filter matches current event
- Check table and schema names are correct
- Verify RLS policies allow real-time access

**Component Lifecycle Issues**

```typescript
// Proper cleanup on unmount
useEffect(() => {
  const subscription = setupRealtimeSubscription();

  return () => {
    subscription.unsubscribe();
  };
}, [eventId]);
```

### 🔐 Permission & Access Issues

#### **Symptom**: "Unauthorized" or "Access Denied" errors

**Diagnosis Steps:**

1. Check user authentication status
2. Verify host/guest role assignments
3. Review RLS policy implementations

**Common Solutions:**

**Host Permission Issues**

```sql
-- Check host permission function
SELECT is_event_host('event-id', 'user-id');
-- Should return true for event hosts
```

**Solution**: Verify user is properly assigned as event host in `events` table.

**Guest Access Problems**

```sql
-- Check guest assignment
SELECT * FROM event_guests
WHERE user_id = 'user-id' AND event_id = 'event-id';
```

**Solution**: Ensure guest record exists and is properly linked.

**RLS Policy Conflicts**

```sql
-- Review messaging RLS policies
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('scheduled_messages', 'message_deliveries', 'messages');
```

**Solution**: Update RLS policies to match current database schema.

### 🚀 Performance Issues

#### **Symptom**: Slow loading or timeouts

**Diagnosis Steps:**

1. Check database query performance
2. Monitor API response times
3. Review client-side caching

**Optimization Strategies:**

**Database Optimization**

```sql
-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_event_send_at
ON scheduled_messages(event_id, send_at);

CREATE INDEX IF NOT EXISTS idx_message_deliveries_message_guest
ON message_deliveries(message_id, guest_id);
```

**Client-side Caching**

```typescript
// Use React Query for efficient caching
const { data: messages, isLoading } = useQuery({
  queryKey: ['messages', eventId],
  queryFn: () => fetchMessages(eventId),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

**Pagination Implementation**

```typescript
// Implement pagination for large datasets
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['messages', eventId],
  queryFn: ({ pageParam = 0 }) =>
    fetchMessages(eventId, { offset: pageParam, limit: 20 }),
  getNextPageParam: (lastPage, pages) =>
    lastPage.length === 20 ? pages.length * 20 : undefined,
});
```

## Development Tools

### Debug Console Commands

```bash
# Check environment variables
npm run dev-setup

# Test database connectivity
npx tsx scripts/test-schema-awareness.ts

# Run user authentication tests
npx tsx scripts/test-auth-flow.ts

# Validate RLS policies
npx tsx scripts/test-rls-policies.ts
```

### Browser Console Debugging

```javascript
// Check Supabase client status
console.log('Supabase client:', window.supabase);

// Monitor real-time channels
console.log('Active channels:', window.supabase?.realtime?.channels);

// Test authentication
console.log('Current user:', await window.supabase?.auth.getUser());
```

### Database Debugging Queries

```sql
-- Check recent errors in logs (if enabled)
SELECT * FROM pg_stat_activity
WHERE state = 'active'
AND query LIKE '%scheduled_messages%';

-- Monitor table sizes
SELECT
  schemaname,
  tablename,
  attname,
  n_distinct,
  most_common_vals
FROM pg_stats
WHERE tablename IN ('scheduled_messages', 'message_deliveries')
ORDER BY schemaname, tablename;

-- Check constraint violations
SELECT conrelid::regclass AS table_name,
       conname AS constraint_name,
       pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE contype = 'c'
AND conrelid::regclass::text LIKE '%message%';
```

## Production Monitoring

### Key Metrics to Monitor

1. **Message Processing Rate**

   - Messages processed per minute
   - Processing success rate
   - Queue depth and backlog

2. **Delivery Success Rates**

   - SMS delivery rate (target: >95%)
   - Email delivery rate (target: >98%)
   - Push notification rate (target: >90%)

3. **System Performance**
   - API response times
   - Database query performance
   - Memory and CPU usage

### Alert Thresholds

```typescript
// Recommended monitoring thresholds
const ALERT_THRESHOLDS = {
  message_processing_failure_rate: 5, // %
  delivery_failure_rate: 10, // %
  api_response_time: 2000, // ms
  database_query_time: 1000, // ms
  unprocessed_message_age: 3600, // seconds
};
```

### Log Analysis

**Search for Common Error Patterns:**

```bash
# CRON job failures
grep -i "cron.*failed" /var/log/vercel/*.log

# SMS delivery issues
grep -i "twilio.*error" /var/log/vercel/*.log

# Database connection problems
grep -i "supabase.*connection" /var/log/vercel/*.log
```

## Emergency Procedures

### Critical Message Stuck in Queue

1. **Identify Issue**

   ```sql
   SELECT * FROM scheduled_messages
   WHERE status = 'processing'
   AND updated_at < NOW() - INTERVAL '1 hour';
   ```

2. **Manual Intervention**

   ```sql
   -- Reset stuck messages to scheduled
   UPDATE scheduled_messages
   SET status = 'scheduled'
   WHERE id = 'stuck-message-id';
   ```

3. **Force Processing**
   ```bash
   # Manually trigger CRON job
   curl -X POST https://your-app.vercel.app/api/cron/process-messages \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

### Mass Message Failure

1. **Stop Further Processing**

   ```sql
   -- Temporarily disable auto-processing
   UPDATE scheduled_messages
   SET status = 'draft'
   WHERE status = 'scheduled'
   AND send_at > NOW();
   ```

2. **Investigate Root Cause**

   - Check service provider status
   - Review configuration changes
   - Analyze error patterns

3. **Gradual Recovery**
   ```sql
   -- Re-enable messages in small batches
   UPDATE scheduled_messages
   SET status = 'scheduled'
   WHERE status = 'draft'
   AND id IN (SELECT id FROM scheduled_messages LIMIT 10);
   ```

## Support Escalation

### When to Escalate

- **System-wide delivery failures** affecting >50% of messages
- **Database corruption** or data integrity issues
- **Security breaches** or unauthorized access
- **Performance degradation** affecting user experience

### Information to Gather

1. **Error Details**

   - Exact error messages
   - Timestamps of incidents
   - Affected user/event IDs

2. **System State**

   - Recent deployments or changes
   - Environment variable modifications
   - Database migration status

3. **Impact Assessment**
   - Number of affected users
   - Duration of the issue
   - Business impact severity

### Contact Information

- **Technical Lead**: [Development team contact]
- **Database Issues**: [Database administrator]
- **Infrastructure**: [DevOps/Platform team]
- **Security**: [Security team contact]

## Prevention Best Practices

### Regular Maintenance

1. **Weekly Checks**

   - Review CRON job execution logs
   - Monitor delivery success rates
   - Check database performance metrics

2. **Monthly Tasks**

   - Update dependencies and security patches
   - Review and optimize database queries
   - Analyze usage patterns and capacity planning

3. **Quarterly Reviews**
   - Audit security configurations
   - Review and update monitoring thresholds
   - Plan infrastructure scaling needs

### Code Quality

- **Comprehensive Testing**: Maintain >80% test coverage
- **Error Handling**: Implement graceful degradation
- **Monitoring**: Add detailed logging and metrics
- **Documentation**: Keep troubleshooting guides updated

### Deployment Safety

- **Staged Rollouts**: Deploy to staging first
- **Feature Flags**: Use flags for new functionality
- **Rollback Plans**: Maintain quick rollback capabilities
- **Health Checks**: Implement comprehensive health monitoring
