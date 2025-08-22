# SMS Invitation Troubleshooting Guide

**Last Updated:** January 30, 2025  
**For:** Unveil SMS Invitation System

## 🚨 Quick Diagnosis

If guests aren't receiving SMS invitations after import, run this **one-liner** to diagnose the issue:

```bash
npx tsx scripts/debug-sms-complete.ts [your_phone_number]
```

**Example:**

```bash
npx tsx scripts/debug-sms-complete.ts +15551234567
```

This will run a complete diagnostic suite and tell you exactly what's wrong.

---

## 🛠️ Step-by-Step Debugging Tools

### **1. Configuration Check** (Start Here)

```bash
npx tsx scripts/debug-sms-config.ts
```

**What it checks:**

- ✅ Twilio environment variables
- ✅ Account SID/Auth Token format
- ✅ Phone number or Messaging Service setup
- ✅ Twilio connection test

### **2. Manual SMS Testing**

```bash
npx tsx scripts/test-sms-manual.ts +1234567890
```

**What it tests:**

- ✅ Basic SMS sending
- ✅ Guest invitation SMS flow
- ✅ Unlinked guest scenario (user_id = NULL)

### **3. Complete Diagnostic Suite**

```bash
npx tsx scripts/debug-sms-complete.ts +1234567890
```

**Comprehensive check of:**

- ✅ All configuration issues
- ✅ All SMS sending scenarios
- ✅ Database checks
- ✅ Opt-out settings

---

## 🔍 Enhanced Debug Logging

### **Browser Console Logs**

After implementing the enhanced logging, you'll now see detailed SMS debug information in your browser console during guest import:

```javascript
📱 SMS Debug: Starting SMS invitation process...
📱 SMS Debug: Event ID: 24caa3a8-020e-4a80-9899-35ff2797dcc0
📱 SMS Debug: Imported 3 guests successfully
📱 SMS Debug: Prepared 3 guests for SMS: [...]
📱 SMS Debug: SMS API call completed: { success: true, sent: 3, failed: 0 }
✅ Background SMS: Successfully sent invitations to 3 guests
```

### **Server-Side Logs**

Enhanced SMS function logging will show:

```javascript
📱 SMS Debug: Starting invitation SMS for +1555...
📱 SMS Debug: Event found for +1555...: { eventId, eventTitle, eventDate }
📱 SMS Debug: Prepared invitation message for +1555...: { messageLength, messagePreview }
📱 SMS Debug: Calling sendSMS for +1555...
📱 SMS Debug: sendSMS result for +1555...: { success: true, messageId: "SM..." }
✅ SMS invitation sent successfully to +1555...
```

---

## 🚩 Common Issues & Solutions

### **Issue 1: "Event not found or unauthorized" - COMPLETELY FIXED!**

**Fixed!** ✅ This was caused by the SMS API using the client-side Supabase client instead of the service role client.

**Root Cause:**

- SMS API route was importing client-side Supabase client (anon key)
- Client-side client has RLS restrictions that prevented event access
- Even though user was legitimate host, RLS policies blocked the query

**Solution:**

- Created dedicated service role client (`lib/supabase/admin.ts`)
- Updated SMS API to use admin client for event existence checks
- Added proper authorization flow: admin check → explicit host verification
- Fixed Next.js cookies warnings with proper `await cookies()`

### **Issue 2: Configuration Issues**

**Symptoms:**

- `Twilio not configured. Please check your environment variables.`
- Connection timeouts

**Solution:**

```bash
# Check your .env.local file has:
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token

# Either:
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
# OR:
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxx
```

### **Issue 3: Rate Limiting**

**Symptoms:**

- Some SMS sent, others failed
- 429 errors in logs

**Solution:**

- Current system has built-in rate limiting
- Uses `maxConcurrency: 1` for imports
- Includes retry logic with delays

### **Issue 4: Phone Number Format Issues**

**Symptoms:**

- `Invalid phone number format`
- SMS fails for certain numbers

**Solution:**

- All phone numbers must be in E.164 format (`+1234567890`)
- The system automatically formats them during import
- Test with: `npx tsx scripts/test-sms-manual.ts +15551234567`

### **Issue 5: Guests Opted Out**

**Symptoms:**

- SMS appears to send but guests don't receive them

**Solution:**
Check database:

```sql
SELECT phone, sms_opt_out FROM event_guests
WHERE event_id = 'your-event-id' AND sms_opt_out = true;
```

### **Issue 6: Guest Linking 500 Error on Login**

**Fixed!** ✅ This was caused by session object reference errors in the API route.

**Root Cause:** The guest linking API was trying to access `session.user` when `session` could be null, causing runtime errors.

**Solution:**

- Fixed all references to use `currentUser` consistently
- Added better error handling and phone number normalization
- Enhanced debugging logs for troubleshooting

---

## 📊 Expected Behavior After Fix

### **✅ Working Flow:**

1. Host adds guest via import wizard
2. Guest inserted into `event_guests` table
3. SMS invitation triggered automatically
4. Detailed logs appear in browser console
5. Guest receives SMS with invitation link

### **✅ Supported Guest Types:**

- **Linked guests:** `user_id` populated, full user profile
- **Unlinked guests:** `user_id = NULL`, phone-only contact
- **Both receive identical SMS invitations**

### **✅ Authorization:**

- **Primary hosts:** `events.host_user_id = current_user`
- **Delegated hosts:** `event_guests.role = 'host'`
- **Both can send SMS invitations**

---

## 🔗 Additional Resources

- **Twilio Console:** https://console.twilio.com/us1/develop/sms/logs
- **SMS Setup Guide:** `docs/archive/project-docs-legacy/04-OPERATIONS/docs-SMS_SETUP_GUIDE.md`
- **Delegated Hosts Documentation:** `docs/access/roles/delegated-hosts.md`
- **Environment Setup:** `docs/development/DEPLOYMENT.md`

---

## 🧪 Testing Your Fixes

### **After Implementing the Complete Fix:**

1. **Verify Fix Implementation:**

   ```bash
   npx tsx scripts/verify-sms-fix.ts
   ```

   This checks:

   - ✅ Admin client connection
   - ✅ Event lookup (bypasses RLS)
   - ✅ Environment variables
   - ✅ API endpoint structure

2. **Test Complete SMS Flow:**

   ```bash
   npx tsx scripts/debug-sms-complete.ts +15551234567
   ```

3. **Real User Test:**
   - Restart your development server
   - Log into your account
   - Navigate to guest management
   - Try importing a guest
   - Check browser console for success logs
   - Verify SMS is sent and received

### **Expected Success Logs:**

```javascript
🔧 SMS API: Event access successful {eventId, eventTitle: "Your Event", currentUserId}
🔧 SMS API: User authorized as host {authorizationType: "primary"}
📱 SMS invitation sent successfully to +1555...
```

---

## 🆘 Emergency Fallback

If automated SMS still fails after debugging:

1. **Manual SMS sending** from host dashboard
2. **Copy invitation links** and send manually
3. **Check Twilio console** for delivery status
4. **Contact Twilio support** for account issues

Remember: The SMS system is designed to be **non-blocking** - guest import will succeed even if SMS fails, ensuring no data loss.
