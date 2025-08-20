# Guest Onboarding Flow Audit

> **Audit Date:** January 2025  
> **Focus:** Guest addition, user creation, SMS automation, and identity linking  
> **Status:** Production-ready with identified gaps  

## Executive Summary

The Unveil app has a **robust phone-first guest onboarding system** with strong foundations but several missing automation pieces. The current system successfully handles guest import, user creation, and manual SMS operations, but lacks automatic guest-to-user linking and automated SMS triggers.

### 🎯 **Current Capabilities**
- ✅ **Guest Import**: Batch processing with validation and deduplication
- ✅ **User Creation**: Automatic phone-based account creation on first login
- ✅ **Manual SMS**: Host-triggered announcements and reminders
- ✅ **Security**: Row-level security with proper access controls

### ❌ **Missing Pieces**
- 🔴 **Auto Guest-User Linking**: No automatic association when users sign up
- 🔴 **Auto SMS Invites**: No triggered invitations when guests are added
- 🔴 **Production SMS**: Twilio configured but not production-ready
- 🔴 **Welcome Messages**: No automated onboarding sequence

---

## 1. 📱 Guest Creation Process

### **Primary Entry Point**
**File:** `lib/services/eventCreation.ts` (lines 527-614)  
**Method:** `EventCreationService.importGuests()`

```typescript
// 1. Permission validation (host-only access)
const permissionCheck = await this.validateGuestImportPermission(eventId, userId);

// 2. Data validation (phone format, duplicates)
const validationResult = this.validateGuestData(guests);

// 3. Batch database insertion (100 guests per batch)
const importResult = await this.performBatchGuestImport(eventId, validGuests, operationId);
```

### **Guest Record Structure**
**Table:** `event_guests`  
**Key Fields:**
- `phone` (required, E.164 format, unique per event)
- `user_id` (nullable - **starts as NULL for imported guests**)
- `guest_name` (optional, falls back to phone number)
- `rsvp_status` (defaults to 'pending')
- `role` (defaults to 'guest')

### **Batch Processing Logic**
- **Batch Size:** 100 guests per batch
- **Error Handling:** Individual row failure tracking, no transaction rollback
- **Performance:** Sequential batches with error resilience
- **Deduplication:** Unique constraint on `(event_id, phone)`

---

## 2. 👤 User Account Creation

### **Authentication Trigger**
**File:** `hooks/usePostAuthRedirect.ts` (lines 55-72)  
**Trigger:** When someone enters a phone number and completes OTP verification

```typescript
// If user doesn't exist, create new user
const { error: insertError } = await supabase
  .from('users')
  .insert({
    id: userId,           // From Supabase Auth
    phone: phone,         // Normalized E.164 format
    onboarding_completed: false,
  });
```

### **Database User Creation**
**File:** `supabase/migrations/20250109000000_phone_first_auth_refactor.sql` (lines 70-82)  
**Function:** `handle_new_user()` - Database trigger on auth.users insert

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, phone, email, full_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', '+1555' || LPAD((random() * 9999999)::int::text, 7, '0')),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 3. 🔗 Guest-to-User Association

### **Current Behavior**
**Status:** ❌ **MISSING AUTOMATION**

When a guest imports creates a guest record:
- ✅ `event_guests.user_id` = `NULL` (guest exists without account)
- ✅ `event_guests.phone` = normalized phone number

When a user signs up with matching phone:
- ✅ New `users` record created with same phone number
- ❌ **MISSING**: No automatic update of `event_guests.user_id`

### **Evidence of Gap**
**File:** `lib/guest-import.ts` (line 388)
```typescript
user_id: null, // Phone-only guests don't have user accounts initially
```

**Referenced Function Missing:** `linkGuestToUser()` mentioned in docs but not implemented  
**Source:** `docs/archive/project-docs-legacy/05-ARCHIVE/archive-phone-migration-summary.md` (line 42)

### **Impact**
- Users who sign up won't automatically see events they were invited to
- Manual intervention required to link guest records to user accounts
- Breaks "smart identity + auto-event-association" requirement

---

## 4. 📲 SMS Notification System

### **SMS Infrastructure Status**
**Files:** `lib/sms.ts`, `lib/sms-invitations.ts`  
**Status:** 🟡 **CONFIGURED BUT NOT AUTOMATED**

#### **Twilio Integration**
- ✅ **Environment Variables**: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN configured
- ✅ **Client Setup**: Dynamic import and initialization (lines 15-21 in `lib/sms.ts`)
- ✅ **Message Templates**: Event invitations, RSVP confirmations, reminders
- ✅ **Phone Validation**: E.164 format validation and normalization

#### **Manual SMS Operations**
**Available Functions:**
- ✅ `sendEventAnnouncement()` - Host announcements to guests
- ✅ `sendRSVPReminder()` - Manual RSVP reminders  
- ✅ `sendBatchInvitations()` - Bulk invitation sending

#### **API Endpoints**
- ✅ `/api/sms/send-announcement` - Host-triggered announcements
- ✅ `/api/sms/send-reminder` - Manual RSVP reminders
- ✅ Authorization required (host verification)

### **Missing SMS Automation**
❌ **No automatic SMS triggers when:**
- Guests are imported/added to an event
- Users sign up and get linked to guest records
- Events are created with guests
- RSVP deadlines approach

---

## 5. 🛡️ Security & Access Control

### **Row Level Security (RLS)**
**File:** `supabase/migrations/20250128000001_cleanup_rls_policies.sql`

#### **Guest Access Policies**
```sql
-- Policy 1: Host Access
CREATE POLICY "event_guests_host_access" ON public.event_guests
FOR ALL TO authenticated
USING (is_event_host(event_id))
WITH CHECK (is_event_host(event_id));

-- Policy 2: Guest Self-Access
CREATE POLICY "event_guests_own_access" ON public.event_guests
FOR ALL TO authenticated, anon
USING (
  user_id = auth.uid() 
  OR (phone = (auth.jwt() ->> 'phone'::text) AND auth.jwt() ->> 'phone' IS NOT NULL)
);
```

#### **Authorization Functions**
- ✅ `is_event_host(p_event_id)` - Checks host permissions
- ✅ `is_event_participant(p_event_id)` - Checks event access
- ✅ `get_user_event_role(p_event_id)` - Returns user's role for event

### **Phone-Based Guest Access**
**Key Feature:** Guests can access events using phone number even without user account  
**Implementation:** JWT phone claim matching in RLS policies

---

## 6. 🔍 Missing Implementation Details

### **Critical Gaps**

#### **1. Automatic Guest-User Linking**
**Missing:** Database trigger or function to link guests when users sign up

**Proposed Solution:**
```sql
-- Trigger function to link guests when user signs up
CREATE OR REPLACE FUNCTION public.link_guests_to_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  -- Update all guest records with matching phone to include user_id
  UPDATE public.event_guests 
  SET user_id = NEW.id 
  WHERE phone = NEW.phone AND user_id IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on users table
CREATE TRIGGER link_guests_on_user_creation
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_guests_to_new_user();
```

#### **2. Automated SMS Invitations**
**Missing:** Trigger to send SMS when guests are added

**Current Workaround:** Hosts must manually send announcements
**Impact:** No immediate notification to new guests

#### **3. Welcome Message Sequence**
**Missing:** Automated onboarding messages for new guests
**Gap:** No SMS sent when guest records are created

#### **4. RSVP Deadline Automation**
**Missing:** Scheduled reminders based on event dates
**Current:** Manual reminder sending only

### **Rate Limiting & Deduplication**
**Status:** ⚠️ **PARTIALLY IMPLEMENTED**

#### **Current Protection:**
- ✅ Duplicate guest prevention: `UNIQUE(event_id, phone)` constraint
- ✅ Batch processing limits: 100 guests per batch
- ✅ API authorization: Host verification required

#### **Missing Protection:**
- ❌ SMS rate limiting per phone number
- ❌ Daily/hourly SMS send limits
- ❌ Cooldown periods between invites
- ❌ Spam prevention for repeat invitations

---

## 7. 📋 Production Readiness Assessment

### **Ready for Production ✅**
- **Guest Import System**: Robust batch processing with error handling
- **User Authentication**: Phone-first OTP with proper session management
- **Database Security**: Comprehensive RLS policies
- **Manual SMS**: Host-controlled announcements and reminders
- **Data Validation**: Phone format validation and normalization

### **Needs Implementation ❌**
- **Auto Guest-User Linking**: Critical for seamless user experience
- **Auto SMS Invitations**: Required for complete guest onboarding
- **Rate Limiting**: Essential for production SMS operations
- **Monitoring**: SMS delivery tracking and failure alerting

### **Production Risks**
1. **Identity Confusion**: Users won't see events they were invited to
2. **Manual Overhead**: Hosts must manually send all invitations
3. **SMS Costs**: No rate limiting could lead to unexpected charges
4. **User Experience**: Broken "smart identity" promise

---

## 8. 🔧 Recommended Implementation Plan

### **Phase 1: Critical Fixes (1-2 days)**
1. **Implement Guest-User Linking Trigger**
   - Add database trigger on `users` table
   - Update `event_guests.user_id` for matching phone numbers
   - Test with existing guest data

2. **Add SMS Rate Limiting**
   - Implement cooldown periods (5 minutes between SMS to same number)
   - Add daily limits per phone number (5 SMS/day max)
   - Create rate limiting middleware

### **Phase 2: Automation (2-3 days)**
1. **Auto SMS Invitations**
   - Trigger SMS when guests are imported
   - Welcome message sequence for new guests
   - Option to skip SMS for bulk imports

2. **RSVP Deadline Reminders**
   - Scheduled job to send automatic reminders
   - 7 days, 3 days, 1 day before event
   - Configurable per event

### **Phase 3: Monitoring (1 day)**
1. **SMS Delivery Tracking**
   - Log all SMS attempts and results
   - Alert on high failure rates
   - Dashboard for SMS usage

2. **Guest Linking Verification**
   - Monitor successful linking operations
   - Alert on linking failures
   - Regular audit of unlinked guests

---

## 9. 📄 File References

### **Core Logic Files**
- `lib/services/eventCreation.ts` (lines 527-934) - Guest import service
- `hooks/usePostAuthRedirect.ts` (lines 55-72) - User creation logic
- `lib/utils/guestHelpers.ts` (lines 19-57) - Guest existence checking
- `lib/sms.ts` (lines 127-331) - SMS infrastructure
- `lib/sms-invitations.ts` (lines 23-227) - SMS templates and validation

### **Database Schema**
- `supabase/migrations/20250101000000_initial_schema.sql` (lines 64-87) - event_guests table
- `supabase/migrations/20250109000000_phone_first_auth_refactor.sql` (lines 70-82) - User creation trigger
- `app/reference/schema.sql` (lines 45-62) - Current schema reference

### **API Endpoints**
- `app/api/sms/send-announcement/route.ts` - Manual SMS announcements
- `app/api/sms/send-reminder/route.ts` - Manual RSVP reminders

### **UI Components**
- `components/features/guests/GuestImportWizard.tsx` (lines 177-213) - Guest import interface
- `hooks/guests/useGuestMutations.ts` (lines 57-78) - Guest operations

---

## 10. ✅ Conclusion

The Unveil guest onboarding system has **strong foundations** with robust guest import, user creation, and manual SMS capabilities. However, **critical automation gaps** prevent it from achieving the "smart identity + auto-event-association" goal.

### **Immediate Action Required**
1. **Implement guest-to-user linking trigger** (highest priority)
2. **Add SMS rate limiting** (production safety)
3. **Enable automatic SMS invitations** (user experience)

### **Production Readiness Score: 7/10**
- **Ready:** Core functionality, security, data validation
- **Missing:** Automation, rate limiting, monitoring

The system supports **manual guest management** well but needs **automation improvements** for a seamless guest experience and production-level operation.