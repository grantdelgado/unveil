# Unveil Guest Communication Module - Project Plan

**📅 Timeline**: 2 weeks intensive development  
**🎯 Goal**: Comprehensive messaging system with host orchestration and guest interaction  
**📊 Status Tracking**: Not Started | In Progress | Review | Complete  

---

## 📋 **Project Overview**

### **Scope**
- Host messaging tools (compose, schedule, segment, analytics)
- Guest messaging interface (view, respond, media)
- Shared components and services
- Minimal schema changes (tagging + message_type)
- Dedicated messaging routes

### **Success Metrics**
- [ ] Hosts can compose and schedule messages
- [ ] Guest segmentation via tags and RSVP filters
- [ ] Real-time message delivery to guests
- [ ] Analytics dashboard for message engagement
- [ ] CRON processing for scheduled messages

---

## 🏗️ **Phase 1: Core Messaging Route & UI Shell**
*Priority: Critical | Timeline: Days 1-2*

### **1.1 Route Structure & Navigation** `#routing` `#frontend`
**Status: Not Started**

#### **Task 1.1.1: Create Host Messaging Routes**
- **Description**: Set up dedicated messaging route structure
- **Files to Create**:
  - `app/host/events/[eventId]/messages/page.tsx`
  - `app/host/events/[eventId]/messages/compose/page.tsx`
  - `app/host/events/[eventId]/messages/scheduled/page.tsx`
  - `app/host/events/[eventId]/messages/analytics/page.tsx`
- **Dependencies**: None
- **Subtasks**:
  - [ ] Create main messaging hub layout
  - [ ] Add navigation between messaging sections
  - [ ] Implement breadcrumb navigation
  - [ ] Add route protection for hosts only

#### **Task 1.1.2: Update Host Dashboard Navigation**
- **Description**: Add Messages link to host dashboard
- **Files to Modify**:
  - `app/host/events/[eventId]/dashboard/page.tsx`
  - `components/features/host-dashboard/TabNavigation.tsx`
- **Dependencies**: Task 1.1.1
- **Subtasks**:
  - [ ] Add "Advanced Messages" link in dashboard
  - [ ] Update tab navigation to highlight messaging
  - [ ] Add badge for pending scheduled messages

### **1.2 Component Architecture Setup** `#frontend` `#architecture`
**Status: Not Started**

#### **Task 1.2.1: Restructure Messaging Components**
- **Description**: Organize existing components into new folder structure
- **Files to Create/Move**:
  - `components/features/messaging/common/MessageThread.tsx`
  - `components/features/messaging/common/MessageBubble.tsx`
  - `components/features/messaging/common/MessageInput.tsx`
  - `components/features/messaging/host/` (move existing host components)
  - `components/features/messaging/guest/` (move existing guest components)
- **Dependencies**: None
- **Subtasks**:
  - [ ] Move `EnhancedMessageCenter.tsx` to `host/`
  - [ ] Move `MessageComposer.tsx` to `host/`
  - [ ] Move `GuestMessaging.tsx` to `guest/`
  - [ ] Extract shared components to `common/`
  - [ ] Update all import statements

#### **Task 1.2.2: Create Component Index Files**
- **Description**: Centralize component exports
- **Files to Create**:
  - `components/features/messaging/index.ts`
  - `components/features/messaging/common/index.ts`
  - `components/features/messaging/host/index.ts`
  - `components/features/messaging/guest/index.ts`
- **Dependencies**: Task 1.2.1
- **Subtasks**:
  - [ ] Export all common components
  - [ ] Export all host components
  - [ ] Export all guest components
  - [ ] Update main features index

---

## 🗄️ **Phase 2: Scheduled Message Creation & Queue**
*Priority: High | Timeline: Days 3-4*

### **2.1 Database Schema Enhancements** `#schema` `#backend`
**Status: Not Started**

#### **Task 2.1.1: Add Tags to Event Participants**
- **Description**: Enable guest tagging for segmentation
- **Files to Create**:
  - `supabase/migrations/20250118000000_add_participant_tags.sql`
- **Dependencies**: None
- **Subtasks**:
  - [ ] Create migration for tags column
  - [ ] Add index for tags array queries
  - [ ] Test migration in development
  - [ ] Update TypeScript types

#### **Task 2.1.2: Enhance Scheduled Messages Table**
- **Description**: Add message_type for consistency
- **Files to Modify**:
  - `supabase/migrations/20250118000001_enhance_scheduled_messages.sql`
- **Dependencies**: None
- **Subtasks**:
  - [ ] Add message_type column with constraints
  - [ ] Add index for message_type queries
  - [ ] Update existing scheduled message types
  - [ ] Update TypeScript types

### **2.2 Scheduled Messaging Services** `#backend` `#services`
**Status: Not Started**

#### **Task 2.2.1: Create Scheduled Messaging Service**
- **Description**: Build service layer for scheduled messages
- **Files to Create**:
  - `services/messaging/scheduled.ts`
  - `lib/supabase/scheduled-messaging.ts`
- **Dependencies**: Task 2.1.2
- **Subtasks**:
  - [ ] `createScheduledMessage()` function
  - [ ] `getScheduledMessages()` with filtering
  - [ ] `updateScheduledMessage()` function
  - [ ] `cancelScheduledMessage()` function
  - [ ] Input validation and error handling

#### **Task 2.2.2: Create Scheduled Message Hooks**
- **Description**: React hooks for scheduled message management
- **Files to Create**:
  - `hooks/messaging/useScheduledMessages.ts`
  - `hooks/messaging/useCreateScheduledMessage.ts`
- **Dependencies**: Task 2.2.1
- **Subtasks**:
  - [ ] List scheduled messages with caching
  - [ ] Create scheduled message mutation
  - [ ] Update scheduled message mutation
  - [ ] Real-time subscription for status updates

### **2.3 Scheduled Message UI Components** `#frontend` `#UX`
**Status: Not Started**

#### **Task 2.3.1: Build Message Scheduler Component**
- **Description**: Date/time picker with smart presets
- **Files to Create**:
  - `components/features/messaging/host/MessageScheduler.tsx`
  - `components/features/messaging/host/SchedulePresets.tsx`
- **Dependencies**: Task 2.2.2
- **Subtasks**:
  - [ ] Calendar date picker component
  - [ ] Time picker with timezone support
  - [ ] Smart presets ("1 day before", "1 week before")
  - [ ] Validation for future dates only

#### **Task 2.3.2: Build Scheduled Message Queue**
- **Description**: List view of scheduled messages
- **Files to Create**:
  - `components/features/messaging/host/MessageQueue.tsx`
  - `components/features/messaging/host/ScheduledMessageCard.tsx`
- **Dependencies**: Task 2.3.1
- **Subtasks**:
  - [ ] List view with status indicators
  - [ ] Edit/cancel actions
  - [ ] Bulk operations (cancel multiple)
  - [ ] Sort by send date, status, recipient count

#### **Task 2.3.3: Integrate Scheduling into Composer**
- **Description**: Add scheduling option to existing composer
- **Files to Modify**:
  - `components/features/messaging/host/MessageComposer.tsx`
- **Dependencies**: Task 2.3.1
- **Subtasks**:
  - [ ] Add "Schedule for later" toggle
  - [ ] Integrate MessageScheduler component
  - [ ] Update send button behavior
  - [ ] Add confirmation for scheduled messages

---

## 🏷️ **Phase 3: Guest Tagging & Filtering**
*Priority: High | Timeline: Days 5-6*

### **3.1 Guest Tagging System** `#frontend` `#backend`
**Status: Not Started**

#### **Task 3.1.1: Build Tag Management Interface**
- **Description**: UI for creating and managing guest tags
- **Files to Create**:
  - `components/features/messaging/host/GuestTagManager.tsx`
  - `components/features/messaging/host/TagSelector.tsx`
- **Dependencies**: Task 2.1.1
- **Subtasks**:
  - [ ] Tag creation form with validation
  - [ ] Tag editing and deletion
  - [ ] Bulk tag assignment to guests
  - [ ] Tag usage statistics

#### **Task 3.1.2: Enhance Recipient Filtering**
- **Description**: Advanced recipient selection with tags
- **Files to Modify**:
  - `components/features/messaging/host/RecipientPresets.tsx`
- **Dependencies**: Task 3.1.1
- **Subtasks**:
  - [ ] Add tag-based filtering
  - [ ] Combine RSVP status + tags
  - [ ] Real-time recipient count updates
  - [ ] Preview selected recipients

#### **Task 3.1.3: Guest Tag Services**
- **Description**: Backend functions for tag management
- **Files to Create**:
  - `services/messaging/tags.ts`
  - `hooks/messaging/useGuestTags.ts`
- **Dependencies**: Task 2.1.1
- **Subtasks**:
  - [ ] CRUD operations for tags
  - [ ] Bulk tag assignment functions
  - [ ] Tag usage analytics
  - [ ] React hooks for tag management

### **3.2 Enhanced Message Targeting** `#backend` `#RLS`
**Status: Not Started**

#### **Task 3.2.1: Update RLS Policies for Tags**
- **Description**: Ensure proper access control for tagged messages
- **Files to Create**:
  - `supabase/migrations/20250118000002_update_messaging_rls.sql`
- **Dependencies**: Task 2.1.1
- **Subtasks**:
  - [ ] Update scheduled_messages RLS policies
  - [ ] Add tag-based message filtering policies
  - [ ] Test permissions with tagged messages
  - [ ] Verify guest access restrictions

#### **Task 3.2.2: Enhance Message Filtering Logic**
- **Description**: Server-side filtering for tagged messages
- **Files to Modify**:
  - `services/messaging/index.ts`
  - `services/messaging/scheduled.ts`
- **Dependencies**: Task 3.2.1
- **Subtasks**:
  - [ ] Filter messages by recipient tags
  - [ ] Combine filters (RSVP + tags + individual)
  - [ ] Optimize query performance
  - [ ] Add recipient count calculations

---

## 📊 **Phase 4: Messaging Analytics**
*Priority: Medium | Timeline: Days 7-8*

### **4.1 Analytics Data Layer** `#backend` `#analytics`
**Status: Not Started**

#### **Task 4.1.1: Create Analytics Service**
- **Description**: Functions for message delivery and engagement metrics
- **Files to Create**:
  - `services/messaging/analytics.ts`
  - `hooks/messaging/useMessageAnalytics.ts`
- **Dependencies**: Task 2.2.1
- **Subtasks**:
  - [ ] Message delivery rate calculations
  - [ ] Engagement metrics (opens, responses)
  - [ ] RSVP correlation analytics
  - [ ] Time-based delivery analysis

#### **Task 4.1.2: Enhance Message Delivery Tracking**
- **Description**: Track message delivery status
- **Files to Modify**:
  - `services/messaging/index.ts`
  - Database: `message_deliveries` table usage
- **Dependencies**: None
- **Subtasks**:
  - [ ] Record delivery timestamps
  - [ ] Track delivery failures with reasons
  - [ ] Guest read receipt tracking
  - [ ] Response rate calculation

### **4.2 Analytics Dashboard UI** `#frontend` `#UX`
**Status: Not Started**

#### **Task 4.2.1: Build Analytics Dashboard**
- **Description**: Visual analytics for message performance
- **Files to Create**:
  - `components/features/messaging/host/MessageAnalytics.tsx`
  - `components/features/messaging/host/AnalyticsChart.tsx`
  - `components/features/messaging/host/DeliveryMetrics.tsx`
- **Dependencies**: Task 4.1.1
- **Subtasks**:
  - [ ] Message delivery rate charts
  - [ ] Engagement timeline visualization
  - [ ] RSVP response correlation
  - [ ] Export analytics data

#### **Task 4.2.2: Implement Analytics Route Page**
- **Description**: Full analytics page layout
- **Files to Modify**:
  - `app/host/events/[eventId]/messages/analytics/page.tsx`
- **Dependencies**: Task 4.2.1
- **Subtasks**:
  - [ ] Dashboard layout with key metrics
  - [ ] Filterable date ranges
  - [ ] Message type breakdowns
  - [ ] Mobile-responsive design

---

## 💬 **Phase 5: Guest-Side Messaging Interface**
*Priority: Medium | Timeline: Days 9-10*

### **5.1 Enhanced Guest Messaging** `#frontend` `#UX`
**Status: Not Started**

#### **Task 5.1.1: Rebuild Guest Messaging Component**
- **Description**: Enhanced guest message interface
- **Files to Modify**:
  - `components/features/messaging/guest/GuestMessaging.tsx`
- **Dependencies**: Task 1.2.1
- **Subtasks**:
  - [ ] Message thread with host announcements
  - [ ] Real-time message updates
  - [ ] Message type indicators (announcement vs direct)
  - [ ] Mobile-optimized layout

#### **Task 5.1.2: Guest Message Response System**
- **Description**: Allow guests to respond to host messages
- **Files to Create**:
  - `components/features/messaging/guest/GuestMessageInput.tsx`
  - `components/features/messaging/guest/ResponseIndicator.tsx`
- **Dependencies**: Task 5.1.1
- **Subtasks**:
  - [ ] Response input with validation
  - [ ] Host permission settings for responses
  - [ ] Response threading
  - [ ] Character limit and spam protection

### **5.2 Guest Messaging Services** `#backend` `#services`
**Status: Not Started**

#### **Task 5.2.1: Create Guest Messaging Service**
- **Description**: Guest-specific messaging functions
- **Files to Create**:
  - `services/messaging/guest.ts`
  - `hooks/messaging/useGuestMessages.ts`
- **Dependencies**: None
- **Subtasks**:
  - [ ] Get messages for guest (filtered)
  - [ ] Send guest response function
  - [ ] Mark messages as read
  - [ ] Guest message subscription

#### **Task 5.2.2: Update Message Routing Logic**
- **Description**: Role-aware message filtering
- **Files to Modify**:
  - `services/messaging/index.ts`
  - RLS policies in database
- **Dependencies**: Task 5.2.1
- **Subtasks**:
  - [ ] Filter messages by recipient targeting
  - [ ] Ensure guests only see relevant messages
  - [ ] Prevent unauthorized message access
  - [ ] Optimize query performance

---

## ⚙️ **Phase 6: CRON Job / Edge Function for Scheduled Dispatch**
*Priority: High | Timeline: Days 11-12*

### **6.1 Message Processing Infrastructure** `#infra` `#backend`
**Status: Not Started**

#### **Task 6.1.1: Enhance CRON Route**
- **Description**: Process scheduled messages automatically
- **Files to Modify**:
  - `app/api/cron/process-messages/route.ts`
- **Dependencies**: Task 2.2.1
- **Subtasks**:
  - [ ] Query ready scheduled messages
  - [ ] Process message sending logic
  - [ ] Update message status and metrics
  - [ ] Error handling and retry logic

#### **Task 6.1.2: Create Message Processing Service**
- **Description**: Core logic for sending scheduled messages
- **Files to Create**:
  - `services/messaging/processor.ts`
  - `lib/messaging/delivery.ts`
- **Dependencies**: Task 6.1.1
- **Subtasks**:
  - [ ] Process individual scheduled message
  - [ ] Resolve recipient lists (tags, RSVP, etc.)
  - [ ] Create message delivery records
  - [ ] Handle bulk message sending

### **6.2 Message Delivery Integration** `#infra` `#integration`
**Status: Not Started**

#### **Task 6.2.1: Integrate SMS Service**
- **Description**: Connect scheduled messages to SMS delivery
- **Files to Modify**:
  - `lib/sms.ts`
  - `services/messaging/processor.ts`
- **Dependencies**: Task 6.1.2
- **Subtasks**:
  - [ ] Send SMS for scheduled messages
  - [ ] Handle SMS delivery failures
  - [ ] Update delivery status
  - [ ] Rate limiting for bulk SMS

#### **Task 6.2.2: Setup Push Notification Delivery**
- **Description**: Push notifications for scheduled messages
- **Files to Create**:
  - `lib/push-notifications.ts`
- **Dependencies**: Task 6.1.2
- **Subtasks**:
  - [ ] Push notification payload creation
  - [ ] Device token management
  - [ ] Delivery confirmation tracking
  - [ ] Fallback to SMS if push fails

---

## 🔧 **Final Integration & Testing**
*Priority: Critical | Timeline: Days 13-14*

### **7.1 End-to-End Testing** `#testing` `#QA`
**Status: Not Started**

#### **Task 7.1.1: Host Messaging Flow Testing**
- **Description**: Complete host messaging workflow
- **Files to Create**:
  - `tests/messaging/host-flow.spec.ts`
- **Dependencies**: All previous phases
- **Subtasks**:
  - [ ] Test immediate message sending
  - [ ] Test scheduled message creation
  - [ ] Test recipient filtering (tags, RSVP)
  - [ ] Test message cancellation/editing

#### **Task 7.1.2: Guest Messaging Flow Testing**
- **Description**: Complete guest messaging experience
- **Files to Create**:
  - `tests/messaging/guest-flow.spec.ts`
- **Dependencies**: Phase 5
- **Subtasks**:
  - [ ] Test guest message viewing
  - [ ] Test guest response functionality
  - [ ] Test real-time message updates
  - [ ] Test message filtering for guests

#### **Task 7.1.3: CRON Job Testing**
- **Description**: Test scheduled message processing
- **Files to Create**:
  - `tests/messaging/cron-processing.spec.ts`
- **Dependencies**: Phase 6
- **Subtasks**:
  - [ ] Test scheduled message detection
  - [ ] Test recipient resolution
  - [ ] Test delivery status updates
  - [ ] Test error handling and retries

### **7.2 Performance & Security** `#performance` `#security`
**Status: Not Started**

#### **Task 7.2.1: Performance Optimization**
- **Description**: Optimize message queries and delivery
- **Files to Review**:
  - All service files
  - Database indices
- **Dependencies**: All phases
- **Subtasks**:
  - [ ] Optimize message list queries
  - [ ] Add database indices for performance
  - [ ] Implement message pagination
  - [ ] Cache frequently accessed data

#### **Task 7.2.2: Security Audit**
- **Description**: Ensure proper access controls
- **Files to Review**:
  - RLS policies
  - API routes
  - Service functions
- **Dependencies**: All phases
- **Subtasks**:
  - [ ] Audit RLS policies for messages
  - [ ] Verify host-only access to analytics
  - [ ] Test guest message filtering
  - [ ] Validate input sanitization

---

## 📈 **Progress Rollup**

### **Phase Status Overview**
- **Phase 1**: 0/2 tasks complete (0%)
- **Phase 2**: 0/3 tasks complete (0%)
- **Phase 3**: 0/2 tasks complete (0%)
- **Phase 4**: 0/2 tasks complete (0%)
- **Phase 5**: 0/2 tasks complete (0%)
- **Phase 6**: 0/2 tasks complete (0%)
- **Phase 7**: 0/2 tasks complete (0%)

### **Area Breakdown**
- **Frontend**: 15 tasks
- **Backend**: 12 tasks
- **Schema**: 3 tasks
- **RLS**: 2 tasks
- **Infrastructure**: 4 tasks
- **Testing**: 3 tasks
- **UX**: 6 tasks
- **Performance**: 2 tasks

### **Total Tasks**: 47 tasks, 0 complete (0%)

---

## 🎯 **Success Criteria**

### **Week 1 Completion Goals**
- [ ] Messaging routes and navigation complete
- [ ] Scheduled message creation working
- [ ] Guest tagging system functional
- [ ] Basic analytics dashboard

### **Week 2 Completion Goals**
- [ ] Guest messaging interface enhanced
- [ ] CRON job processing scheduled messages
- [ ] Complete end-to-end testing
- [ ] Performance and security validation

### **Definition of Done**
- [ ] All 47 tasks completed
- [ ] Host can create and schedule messages
- [ ] Guests receive and can respond to messages
- [ ] Analytics show delivery and engagement metrics
- [ ] System handles scheduled message processing automatically
- [ ] All tests passing with >90% coverage

---

## 📝 **Notes**

- **Schema changes are minimal** - leveraging existing `scheduled_messages` table
- **Real-time updates** maintained through existing Supabase subscriptions
- **Mobile-first design** consistent with current Unveil patterns
- **Performance-focused** with proper indexing and caching
- **Security-first** with comprehensive RLS policies

**Ready to begin implementation! 🚀** 