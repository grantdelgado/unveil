# 🚀 **Messaging Pipeline Production Deployment Guide**

This guide ensures the complete messaging delivery pipeline is properly configured for production deployment.

## ✅ **Pre-Deployment Checklist**

### **1. Environment Variables**

Ensure these variables are set in your production environment:

```bash
# Twilio SMS Configuration (REQUIRED)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here

# Either phone number OR messaging service (Messaging Service recommended)
TWILIO_PHONE_NUMBER=+1234567890
# OR
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxx

# Supabase Configuration (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Security (REQUIRED)
CRON_SECRET=your-secure-32-character-random-string

# App Configuration
NEXT_PUBLIC_BASE_URL=https://your-domain.com
NODE_ENV=production
```

### **2. Database Migration**

Apply the messaging delivery pipeline migration:

```bash
# Apply the phone access migration
npx supabase db push

# Verify migration applied successfully
npx supabase db pull --schema public
```

### **3. Twilio Console Configuration**

1. **Login to Twilio Console**: <https://console.twilio.com/>
2. **Configure Webhook**:

   - Go to Phone Numbers > Manage > Active Numbers
   - Select your messaging number
   - Set webhook URL: `https://your-domain.com/api/webhooks/twilio`
   - Set HTTP method: `POST`
   - Check all message status events

3. **Verify Phone Number**:
   - Ensure your Twilio phone number is verified and active
   - Test sending a manual SMS from Twilio console

### **4. Cron Job Setup (Vercel)**

Ensure your `vercel.json` includes:

```json
{
  "crons": [
    {
      "path": "/api/cron/process-messages",
      "schedule": "* * * * *"
    }
  ]
}
```

## 🧪 **Testing & Validation**

### **Run Validation Script**

```bash
npm run validate-messaging-pipeline
```

This will check:

- ✅ Environment configuration
- ✅ Database connectivity
- ✅ Twilio integration
- ✅ API endpoints
- ✅ Webhook setup

### **Manual Testing Steps**

1. **Test Immediate Messages**:

   ```bash
   # Create a test event with guests having valid phone numbers
   # Send a test message using the messaging UI
   # Verify SMS delivery in Twilio console logs
   ```

2. **Test Scheduled Messages**:

   ```bash
   # Schedule a message for 2 minutes in the future
   # Wait for cron job to process (runs every minute)
   # Verify message was sent and status updated
   ```

3. **Test Webhook Processing**:

   ```bash
   # Send a test message
   # Check Twilio webhook logs
   # Verify delivery status updates in message_deliveries table
   ```

## 🚨 **Critical Production Requirements**

### **Security**

- ✅ CRON_SECRET must be 32+ characters
- ✅ Supabase service role key properly secured
- ✅ Twilio credentials in environment variables (never in code)

### **Performance**

- ✅ Rate limiting: 100ms delay between SMS messages
- ✅ Batch processing: Max 100 scheduled messages per cron run
- ✅ Database indexes for phone number lookups

### **Reliability**

- ✅ Retry logic: 1 retry max for network failures
- ✅ Idempotency: Scheduled message processing prevents duplicates
- ✅ Error handling: Graceful failure with detailed logging

### **Monitoring**

- ✅ Comprehensive logging for all delivery attempts
- ✅ Delivery tracking via webhooks
- ✅ Analytics dashboard for success rates

## 📊 **Monitoring & Alerts**

### **Key Metrics to Monitor**

1. **SMS Delivery Rates**:

   - Target: >95% delivery success rate
   - Monitor via: Twilio console + message_deliveries table

2. **Scheduled Processing**:

   - Target: <2 minute processing delay
   - Monitor via: Vercel function logs

3. **Error Rates**:
   - Target: <5% error rate
   - Monitor via: Application logs + Sentry

### **Common Issues & Solutions**

| Issue                             | Symptoms                                  | Solution                                                 |
| --------------------------------- | ----------------------------------------- | -------------------------------------------------------- |
| Messages not sending              | UI shows success, no SMS received         | Check Twilio credentials and webhook setup               |
| Scheduled messages not processing | Messages stuck in 'scheduled' status      | Verify CRON_SECRET and Vercel cron configuration         |
| High failure rates                | Many messages in 'failed' status          | Check phone number formatting and Twilio account balance |
| Webhook not updating status       | SMS sent but delivery status not updating | Verify webhook URL configuration in Twilio               |

## 🔧 **Troubleshooting**

### **Debug Message Delivery**

1. **Check Logs**:

   ```bash
   # Vercel function logs
   vercel logs --project your-project

   # Check specific function
   vercel logs --function api/messages/process-scheduled
   ```

2. **Verify Database State**:

   ```sql
   -- Check scheduled messages
   SELECT id, status, send_at, success_count, failure_count
   FROM scheduled_messages
   WHERE status IN ('scheduled', 'sending')
   ORDER BY send_at;

   -- Check delivery records
   SELECT sms_status, COUNT(*)
   FROM message_deliveries
   GROUP BY sms_status;
   ```

3. **Test API Endpoints**:

   ```bash
   # Test webhook (replace with your domain)
   curl -X POST https://your-domain.com/api/webhooks/twilio \
     -d "MessageSid=test123&MessageStatus=delivered&To=+1234567890"

   # Test scheduled processing (requires CRON_SECRET)
   curl -X POST https://your-domain.com/api/messages/process-scheduled \
     -H "Authorization: Bearer your-cron-secret"
   ```

### **Performance Optimization**

1. **Database Queries**:

   - Ensure phone number indexes are active
   - Monitor query performance in Supabase dashboard

2. **SMS Rate Limiting**:

   - Default: 1 message per 100ms (600 messages/minute)
   - Twilio limit: Varies by account type
   - Adjust delay in `sendBulkSMS` if needed

3. **Memory Usage**:
   - Scheduled processing handles max 100 messages per run
   - Increase if needed based on message volume

## 🎯 **Success Criteria**

Before marking the deployment as successful, verify:

- ✅ **Immediate Messages**: 95%+ delivery rate within 30 seconds
- ✅ **Scheduled Messages**: Processed within 2 minutes of scheduled time
- ✅ **Webhook Updates**: Delivery status updated within 60 seconds
- ✅ **Error Handling**: Failed messages properly logged and tracked
- ✅ **Analytics**: Delivery metrics visible in dashboard

## 📞 **Support & Emergency Contacts**

### **Twilio Support**

- Console: <https://console.twilio.com/>
- Support: <https://support.twilio.com/>
- Status: <https://status.twilio.com/>

### **Vercel Support**

- Dashboard: <https://vercel.com/dashboard>
- Documentation: <https://vercel.com/docs>
- Status: <https://www.vercel-status.com/>

### **Emergency Procedures**

1. **Disable SMS**: Set `TWILIO_ACCOUNT_SID=""` to stop all SMS
2. **Disable Cron**: Remove cron job from `vercel.json` and redeploy
3. **Rollback**: Revert to previous deployment via Vercel dashboard

---

## ✅ **Deployment Complete**

Once all checks pass:

1. ✅ Environment variables configured
2. ✅ Database migration applied
3. ✅ Twilio webhook configured
4. ✅ Validation script passes
5. ✅ Manual testing successful
6. ✅ Monitoring alerts configured

**🚀 Your messaging delivery pipeline is now production-ready!**
