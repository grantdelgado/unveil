# 📬 Unveil Messaging System Guide

## Overview

The Unveil messaging system enables wedding hosts to communicate with their guests through multiple channels (SMS, email, push notifications) with scheduling, analytics, and real-time capabilities.

## Architecture

### Core Components
```
┌─────────────────────────────────────────────────────────────┐
│                     Messaging System                        │
├─────────────────────────────────────────────────────────────┤
│  Host Interface     │  Guest Interface   │  Processing      │
│  • Compose         │  • View Messages   │  • CRON Jobs     │
│  • Schedule        │  • Respond         │  • Delivery      │
│  • Analytics       │  • Read Tracking   │  • Analytics     │
│  • Templates       │                    │  • Metrics       │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema
- **`scheduled_messages`**: Message content, scheduling, and metadata
- **`message_deliveries`**: Per-guest delivery tracking and status
- **`message_tags`**: Guest segmentation and targeting
- **`messages`**: Real-time chat-style messages (guest responses)

### Message Flow
1. **Composition**: Host creates message via `/host/events/[eventId]/messages/compose`
2. **Scheduling**: Messages queued in `scheduled_messages` table
3. **Processing**: CRON job (`/api/cron/process-messages`) runs daily at 9 AM
4. **Delivery**: Multi-channel delivery via Twilio, email, push notifications
5. **Tracking**: Delivery status, read receipts, and responses tracked
6. **Analytics**: Comprehensive metrics and engagement insights

## Features

### 🎯 Message Types
- **Announcements**: Broadcast to all guests
- **Direct Messages**: Targeted to specific guests
- **Channel Messages**: Group communications

### 📅 Scheduling
- **Send Now**: Immediate delivery
- **Send Later**: Schedule for specific date/time
- **Recurring**: Future feature for regular updates

### 📊 Analytics & Insights
- **Delivery Metrics**: Success rates, failure tracking
- **Engagement Analytics**: Read rates, response rates
- **Performance Charts**: Delivery trends over time
- **Export Capabilities**: CSV/Excel export for external analysis

### 🎨 Guest Targeting
- **Tag-based Segmentation**: Target guests by custom tags
- **RSVP Status Filtering**: Send to attending/not attending guests
- **Communication Preferences**: Respect guest channel preferences

## Host Dashboard Usage

### Composing Messages

1. **Navigate to Messaging**
   ```
   /host/events/[eventId]/messages/compose
   ```

2. **Message Configuration**
   - **Content**: Rich text message content
   - **Type**: Announcement, direct, or channel
   - **Delivery Method**: SMS, email, push, or multi-channel
   - **Scheduling**: Send now or schedule for later

3. **Guest Targeting**
   - Select specific guests or use "All Guests"
   - Apply tag-based filters
   - Preview recipient count

### Managing Scheduled Messages

1. **View Scheduled Messages**
   ```
   /host/events/[eventId]/messages/scheduled
   ```

2. **Available Actions**
   - Edit scheduled messages (before send time)
   - Cancel scheduled messages
   - View delivery estimates

### Analytics Dashboard

1. **Message Analytics**
   ```
   /host/events/[eventId]/messages/analytics
   ```

2. **Key Metrics**
   - **Delivery Stats**: Total sent, delivered, failed
   - **Engagement Metrics**: Read rates, response rates
   - **Channel Performance**: SMS vs. email vs. push success rates
   - **Top Performing Messages**: Highest engagement content

## Guest Experience

### Receiving Messages
- **SMS**: Direct delivery to guest's phone number
- **Email**: Formatted email with Unveil branding
- **Push Notifications**: In-app notifications for mobile users

### Responding to Messages
1. **View Messages**: `/guest/events/[eventId]/home`
2. **Read Messages**: Automatic read tracking
3. **Respond**: Real-time chat interface for quick replies

### Privacy & Preferences
- Guests can update communication preferences
- Unsubscribe options available
- Data privacy controls

## Technical Implementation

### API Endpoints

#### Host Routes
```typescript
// Message composition and management
POST /api/messages/compose
GET /api/messages/scheduled
PUT /api/messages/scheduled/[id]
DELETE /api/messages/scheduled/[id]

// Analytics and insights
GET /api/messages/analytics/[eventId]
GET /api/messages/metrics/[eventId]
```

#### Processing Routes
```typescript
// CRON job endpoint (secured)
POST /api/cron/process-messages
POST /api/messages/process-scheduled

// Delivery tracking
POST /api/messages/delivery/status
POST /api/messages/delivery/read
POST /api/messages/delivery/response
```

### Real-time Features

The messaging system uses Supabase Realtime for instant updates:

```typescript
// Subscribe to new messages
const subscription = supabase
  .channel(`event-${eventId}-messages`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `event_id=eq.${eventId}`
  }, handleNewMessage)
  .subscribe();
```

### Message Processing

Daily CRON job processes scheduled messages:

1. **Query Ready Messages**: `send_at <= NOW()` and `status = 'scheduled'`
2. **Create Deliveries**: Generate per-guest delivery records
3. **Multi-channel Delivery**: Send via SMS, email, push notifications
4. **Status Tracking**: Update delivery status and retry failed messages
5. **Metrics Collection**: Record performance and engagement data

## Security & Privacy

### Data Protection
- **Row-Level Security (RLS)**: Enforced on all messaging tables
- **Event Scoping**: Users can only access their event's messages
- **Role-based Access**: Hosts can manage, guests can only view their messages

### Authentication
- **Host Verification**: `is_event_host()` function validates host permissions
- **Guest Verification**: `is_event_guest()` function validates guest access
- **CRON Security**: Endpoints protected with secret authentication

### Rate Limiting
- **API Protection**: Middleware enforces rate limits on messaging endpoints
- **SMS Limits**: Twilio integration respects provider limits
- **Abuse Prevention**: Built-in protections against message spam

## Troubleshooting

### Common Issues

**Messages Not Sending**
1. Check CRON job status in Vercel dashboard
2. Verify Twilio credentials are correct
3. Ensure guests have valid phone numbers/emails
4. Check scheduled_messages status field

**Poor Delivery Rates**
1. Validate phone number formats
2. Check email addresses for typos
3. Review Twilio account status and balance
4. Monitor delivery failure reasons

**Analytics Not Updating**
1. Verify message_deliveries records are created
2. Check read tracking implementation
3. Ensure proper event scoping in queries

### Debug Tools

**Development Mode**
- Detailed logging in console
- React Query DevTools for API inspection
- Supabase logs for database operations

**Production Monitoring**
- Sentry error tracking
- Vercel function logs
- Twilio delivery webhooks

## Performance Optimization

### Database Optimization
- **Indexes**: Optimized queries on `event_id`, `send_at`, `status`
- **Pagination**: Large message lists paginated for performance
- **Selective Loading**: Only load necessary fields for large datasets

### Caching Strategy
- **React Query**: Intelligent caching of message data
- **Real-time Updates**: Efficient subscription management
- **Static Assets**: CDN delivery for optimal performance

### Delivery Optimization
- **Batch Processing**: Messages processed in efficient batches
- **Channel Prioritization**: SMS > Push > Email for reliability
- **Retry Logic**: Exponential backoff for failed deliveries

## Future Enhancements

### Planned Features
- **Message Templates**: Pre-built message templates for common scenarios
- **Rich Media**: Image and video attachments in messages
- **Message Automation**: Trigger-based messaging (RSVP changes, etc.)
- **Advanced Analytics**: Sentiment analysis, engagement scoring
- **Multi-language Support**: Internationalization for global weddings

### Technical Improvements
- **Redis Caching**: Enhanced performance for high-volume events
- **Webhook Integrations**: Third-party service integration
- **Advanced Scheduling**: Recurring messages, time zone support
- **A/B Testing**: Message content optimization

## API Reference

### Message Object
```typescript
interface ScheduledMessage {
  id: string;
  event_id: string;
  sender_user_id: string;
  content: string;
  message_type: 'direct' | 'announcement' | 'channel';
  send_at: string;
  status: 'draft' | 'scheduled' | 'processing' | 'sent' | 'failed';
  target_all_guests: boolean;
  delivery_methods: ('sms' | 'email' | 'push')[];
  created_at: string;
  updated_at: string;
}
```

### Delivery Tracking
```typescript
interface MessageDelivery {
  id: string;
  message_id: string;
  guest_id: string;
  user_id: string;
  sms_status: 'pending' | 'sent' | 'delivered' | 'failed' | null;
  email_status: 'pending' | 'sent' | 'delivered' | 'failed' | null;
  push_status: 'pending' | 'sent' | 'delivered' | 'failed' | null;
  has_responded: boolean;
  created_at: string;
  updated_at: string;
}
```

### Analytics Response
```typescript
interface MessageAnalytics {
  deliveryStats: {
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
    deliveryRate: number;
    responseRate: number;
  };
  engagementMetrics: EngagementMetrics[];
  topPerformingMessages: TopPerformingMessage[];
  responseRatesOverTime: ResponseRateOverTime[];
}
```

## Support & Resources

### Documentation
- [SMS Setup Guide](./SMS_SETUP_GUIDE.md)
- [Production Environment Setup](./production-environment-setup.md)
- [Database Schema Reference](../app/reference/schema.sql)

### Development
- [Developer Guide](./developer-guide.md)
- [Testing Infrastructure](./testing-infrastructure.md)
- [Component Library](./component-library-implementation.md)

### Contact
For technical support or feature requests, please refer to the project documentation or contact the development team. 