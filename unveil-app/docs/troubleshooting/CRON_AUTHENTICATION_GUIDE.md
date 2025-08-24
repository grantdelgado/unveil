# 🔧 Cron Authentication Troubleshooting Guide

**Last Updated:** January 30, 2025  
**Scope:** Scheduled message processing authentication issues

## 🎯 **Quick Diagnosis**

### **Is Your Cron Working?**

1. **Check Vercel Cron Logs:**
   ```bash
   # View recent cron executions
   vercel logs --follow
   ```

2. **Manual Test:**
   ```bash
   # Test cron endpoint directly
   curl -X GET "https://your-domain.com/api/messages/process-scheduled?status=1" \
     -H "x-cron-key: YOUR_CRON_SECRET"
   ```

3. **Check Scheduled Messages:**
   ```sql
   -- Look for overdue messages
   SELECT id, send_at, status, created_at 
   FROM scheduled_messages 
   WHERE send_at < NOW() AND status = 'scheduled';
   ```

---

## 🚨 **Common Authentication Issues**

### **Issue 1: "Unauthorized" Response (401)**

**Symptoms:**
- Cron returns `{"error": "Unauthorized"}`
- Scheduled messages remain in `scheduled` status past their send time
- Vercel logs show 401 responses

**Root Causes & Solutions:**

#### **A) Missing CRON_SECRET Environment Variable**

```bash
# ❌ Problem: CRON_SECRET not set in Vercel
# ✅ Solution: Add to Vercel environment variables
CRON_SECRET=your-secure-32-character-random-string
```

**How to Fix:**
1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Add `CRON_SECRET` with a secure random value (32+ characters)
3. Redeploy the application

#### **B) Vercel Cron Signature Missing**

**Symptoms:**
- Manual curl works with `x-cron-key` header
- Vercel automatic cron fails with 401

**Debugging:**
```typescript
// Check what headers Vercel is sending
console.log('Cron request headers:', {
  'x-vercel-cron-signature': request.headers.get('x-vercel-cron-signature'),
  'x-cron-key': request.headers.get('x-cron-key'),
  'user-agent': request.headers.get('user-agent'),
});
```

**Solutions:**
1. **Verify vercel.json configuration:**
   ```json
   {
     "crons": [
       {
         "path": "/api/messages/process-scheduled",
         "schedule": "*/1 * * * *"
       }
     ]
   }
   ```

2. **Check deployment status:**
   - Ensure cron configuration deployed successfully
   - Verify no deployment protection blocking cron requests

#### **C) Authentication Logic Issues**

**Check the authentication function:**
```typescript
// In /api/messages/process-scheduled/route.ts
function isRequestAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronHeader = request.headers.get('x-cron-key');
  const vercelCronHeader = request.headers.get('x-vercel-cron-signature');
  const cronSecret = process.env.CRON_SECRET;

  return Boolean(
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (cronSecret && cronHeader === cronSecret) ||
    vercelCronHeader // Vercel automatically adds this header
  );
}
```

---

### **Issue 2: Cron Runs But No Messages Processed**

**Symptoms:**
- Cron returns 200 OK
- Response: `"No messages ready for processing"`
- Messages exist with `send_at` in the past

**Root Causes & Solutions:**

#### **A) Timezone Issues**

**Check UTC conversion:**
```sql
-- Verify send_at times are in UTC
SELECT 
  id, 
  send_at,
  scheduled_tz,
  scheduled_local,
  NOW() as current_utc,
  (send_at <= NOW()) as should_process
FROM scheduled_messages 
WHERE status = 'scheduled'
ORDER BY send_at;
```

#### **B) Database Trigger Blocking**

**Check minimum lead time enforcement:**
```sql
-- Look for trigger errors
SELECT * FROM scheduled_messages 
WHERE send_at < NOW() - INTERVAL '3 minutes'
AND status = 'scheduled';
```

**If messages exist:** The trigger `enforce_schedule_min_lead_trigger` may be preventing updates.

#### **C) RPC Function Issues**

**Test the RPC function directly:**
```sql
-- Test message retrieval
SELECT * FROM get_scheduled_messages_for_processing(10, NOW());
```

**Expected behavior:**
- Returns messages where `send_at <= current_time`
- Uses `FOR UPDATE SKIP LOCKED` for concurrency safety

---

### **Issue 3: Multiple Cron Instances Conflict**

**Symptoms:**
- Some messages processed multiple times
- Inconsistent processing results
- Database lock timeouts

**Solutions:**

#### **A) Enable Jitter (Already Implemented)**
```typescript
// Random delay to prevent overlap
const jitter = Math.floor(Math.random() * 20000) - 10000; // ±10s
if (jitter > 0) {
  await new Promise((resolve) => setTimeout(resolve, jitter));
}
```

#### **B) Verify Concurrency Protection**
```sql
-- Check for concurrent processing
SELECT * FROM scheduled_messages 
WHERE status = 'sending' 
AND updated_at < NOW() - INTERVAL '5 minutes';
```

**If stuck messages exist:** Manual cleanup may be needed:
```sql
-- Reset stuck messages (use with caution)
UPDATE scheduled_messages 
SET status = 'scheduled', updated_at = NOW()
WHERE status = 'sending' 
AND updated_at < NOW() - INTERVAL '10 minutes';
```

---

## 🔍 **Debugging Tools**

### **1. Enable Debug Logging**

Add to your environment:
```bash
# Enable detailed cron logging
DEBUG_CRON=true
```

### **2. Manual Cron Trigger**

```bash
# Test with explicit cron mode
curl -X GET "https://your-domain.com/api/messages/process-scheduled?mode=cron" \
  -H "x-cron-key: YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

### **3. Health Check Endpoint**

```bash
# Quick health check (no processing)
curl -X GET "https://your-domain.com/api/messages/process-scheduled?health=1"
```

### **4. Dry Run Mode**

```bash
# See what would be processed without actually processing
curl -X POST "https://your-domain.com/api/messages/process-scheduled?dryRun=true" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

---

## 📋 **Verification Checklist**

### **Environment Setup:**
- [ ] `CRON_SECRET` set in Vercel environment variables (32+ characters)
- [ ] `vercel.json` contains correct cron configuration
- [ ] Latest deployment includes cron configuration
- [ ] No deployment protection blocking `/api/messages/process-scheduled`

### **Database Setup:**
- [ ] `get_scheduled_messages_for_processing` RPC function exists
- [ ] `enforce_schedule_min_lead_trigger` trigger exists and works
- [ ] No overdue messages stuck in `scheduled` status

### **Authentication Flow:**
- [ ] Manual test with `x-cron-key` header works
- [ ] Vercel cron logs show successful requests (not 401)
- [ ] Authentication function handles all three auth methods

### **Processing Logic:**
- [ ] Messages with `send_at <= NOW()` are being retrieved
- [ ] Concurrency protection working (`FOR UPDATE SKIP LOCKED`)
- [ ] Message status transitions: `scheduled` → `sending` → `sent`

---

## 🆘 **Emergency Procedures**

### **If Cron Completely Fails:**

1. **Manual Processing:**
   ```bash
   # Process immediately via API
   curl -X POST "https://your-domain.com/api/messages/process-scheduled" \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

2. **Disable Scheduling Temporarily:**
   ```sql
   -- Prevent new scheduled messages
   UPDATE scheduled_messages 
   SET status = 'cancelled' 
   WHERE status = 'scheduled' AND send_at > NOW();
   ```

3. **Reset Stuck Messages:**
   ```sql
   -- Reset messages stuck in 'sending' status
   UPDATE scheduled_messages 
   SET status = 'scheduled', updated_at = NOW()
   WHERE status = 'sending' 
   AND updated_at < NOW() - INTERVAL '10 minutes';
   ```

### **Contact Points:**
- Check Vercel dashboard for deployment issues
- Review Supabase logs for database errors
- Monitor application logs for authentication failures

---

## 📊 **Monitoring Recommendations**

1. **Set up alerts for:**
   - 401 responses on cron endpoint
   - Messages overdue by >5 minutes
   - Cron execution failures

2. **Regular checks:**
   - Weekly review of `scheduled_messages` table for stuck records
   - Monthly rotation of `CRON_SECRET`
   - Quarterly review of cron performance metrics

3. **Dashboard metrics:**
   - Cron success rate
   - Average processing time per tick
   - Message type coercion frequency
   - Formatter fallback rates
