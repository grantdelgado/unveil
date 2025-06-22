# SMS Integration Setup Guide

## Overview

This guide walks you through setting up SMS integration for Unveil using Twilio. The SMS system is already built into the app - you just need to configure your Twilio account and environment variables.

## 🚀 Quick Start

### 1. Twilio Account Setup

1. Create a Twilio account at [twilio.com](https://twilio.com)
2. Get your Account SID and Auth Token from the console
3. Purchase a phone number OR set up a Messaging Service (recommended)

### 2. Environment Variables

Add these to your `.env.local` file:

```bash
# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here

# Option A: Use a phone number
TWILIO_PHONE_NUMBER=+1234567890

# Option B: Use messaging service (recommended for production)
TWILIO_MESSAGING_SERVICE_SID=your_messaging_service_sid

# Cron Job Security (generate random string)
CRON_SECRET=your_random_secret_here
```

### 3. Webhook Configuration

In your Twilio console, set up webhooks for delivery status updates:

**Webhook URL**: `https://your-domain.com/api/webhooks/twilio`
**Method**: POST
**Events**: All message events

## 📋 Features Already Implemented

### ✅ Core SMS Functionality

- **Twilio Integration**: Full SMS sending with delivery tracking
- **Message Scheduling**: Send now or schedule for later
- **Bulk Messaging**: Send to multiple guests simultaneously
- **Delivery Tracking**: Real-time status updates via webhooks
- **Opt-out Support**: Respects guest SMS preferences

### ✅ Advanced Targeting

- **All Guests**: Broadcast to entire guest list
- **Sub-Event Targeting**: Send to specific events (rehearsal, ceremony, etc.)
- **Tag-based Targeting**: Send to guests with specific tags
- **Individual Targeting**: Send to specific guests

### ✅ Message Personalization

- **Guest Names**: Use `{name}` or `{first_name}` in messages
- **Character Counting**: SMS-optimized message length validation
- **Multiple Channels**: SMS, Push, and Email support

### ✅ Analytics & Monitoring

- **Delivery Status**: Track sent, delivered, failed messages
- **Error Handling**: Comprehensive error logging and recovery
- **Rate Limiting**: Respects Twilio rate limits
- **Retry Logic**: Automatic retry for failed messages

## 🔧 How It Works

### Message Flow

1. **Compose**: Host creates message in MessageComposer
2. **Schedule**: Message saved to `scheduled_messages` table
3. **Process**: Cron job (every minute) checks for ready messages
4. **Send**: Twilio API sends SMS to targeted guests
5. **Track**: Delivery status updated via webhooks

### Database Tables

- `scheduled_messages`: Stores message content and targeting
- `message_deliveries`: Tracks individual message delivery
- `event_guests`: Guest phone numbers and preferences

## 🧪 Testing

### 1. Test Message Processing

```bash
# Manually trigger message processing
curl -X POST http://localhost:3000/api/messages/process-scheduled
```

### 2. Test Webhook

```bash
# Test Twilio webhook (replace with your domain)
curl -X POST https://your-domain.com/api/webhooks/twilio \
  -d "MessageSid=test123&MessageStatus=delivered&To=+1234567890"
```

### 3. Test Announcement

Use the SMS Announcement feature in the host dashboard to send a test message.

## 🛠 Production Deployment

### 1. Vercel Configuration

The app includes `vercel.json` with cron job configuration:

- Runs every minute to process scheduled messages
- Secure with `CRON_SECRET` environment variable

### 2. Twilio Configuration

- Use Messaging Service for better deliverability
- Set up webhooks for delivery tracking
- Configure phone number pools for high volume

### 3. Monitoring

- Check Vercel function logs for message processing
- Monitor Twilio console for delivery rates
- Use Supabase dashboard to track message status

## 🔐 Security

### Environment Variables

Never commit sensitive data:

- Twilio credentials
- Cron secrets
- Database keys

### Webhook Security

- Validate Twilio webhook signatures (future enhancement)
- Use HTTPS for all webhook endpoints
- Implement rate limiting on endpoints

## 🐛 Troubleshooting

### Common Issues

1. **Messages not sending**: Check Twilio credentials and phone number
2. **Webhook not updating**: Verify webhook URL in Twilio console
3. **Cron not running**: Check Vercel function logs
4. **Rate limits**: Implement delays between messages

### Debug Logs

Check these locations for debugging:

- Vercel function logs
- Twilio console logs
- Supabase database logs
- Browser console for UI issues

## 📈 Usage Metrics

The system tracks:

- Messages sent/failed
- Delivery rates by channel
- Guest response rates
- Cost per message (via Twilio)

## 🚀 Next Steps

Once SMS is working:

1. **Push Notifications**: Add Firebase for app users
2. **Email Integration**: Add SendGrid/Mailgun support
3. **Two-way Messaging**: Handle guest replies
4. **Message Templates**: Pre-built message templates
5. **Scheduling UI**: Better date/time pickers

## 💡 Pro Tips

1. **Test thoroughly** with a small group first
2. **Use Messaging Service** for better deliverability
3. **Monitor costs** - SMS can add up quickly
4. **Respect opt-outs** - always honor guest preferences
5. **Personalize messages** - use guest names for better engagement

---

**Need help?** Check the troubleshooting section or review the code in:

- `/lib/sms.ts` - Core SMS functionality
- `/app/api/messages/process-scheduled/route.ts` - Message processing
- `/components/features/events/MessageComposer.tsx` - UI component
