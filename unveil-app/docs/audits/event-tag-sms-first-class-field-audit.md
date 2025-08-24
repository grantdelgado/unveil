# Event Creation — Make "Event Tag for SMS" a First-Class, Required Field

**Date**: January 30, 2025  
**Status**: 📋 **AUDIT COMPLETE - READY FOR IMPLEMENTATION**  
**Intent**: Ensure every new event captures a concise **Event Tag for SMS** used as the header in guest SMS (e.g., `Sarah + David:`). The tag should be clearly explained to hosts, validated at creation, and consistent with how messaging formats headers today.

---

## 📊 **Current State Analysis**

### **Event Creation Flow**

**UI Components:**
- **Primary**: `components/features/events/CreateEventWizard.tsx` - 3-step wizard (basics → image → review)
- **Form Interface**: `EventFormData` type with `title`, `event_date`, `event_time`, `location`, `is_public`
- **Validation**: `lib/validations.ts` - `eventCreateSchema` (no SMS tag field)

**Server Actions:**
- **Service**: `lib/services/eventCreation.ts` - `EventCreationService.createEventWithHost()`
- **Input Type**: `EventCreationInput` interface (no SMS tag field)
- **Database**: Atomic creation via RPC `create_event_with_host_atomic()` or client-side fallback

**Current Flow Gap**: ❌ **SMS tag is NOT captured during event creation**

### **Event Editing Flow**

**UI Components:**
- **Primary**: `components/features/host-dashboard/EventDetailsEditor.tsx`
- **Form Interface**: `EventDetailsFormData` type from `lib/validation/events.ts`
- **SMS Tag Field**: ✅ **EXISTS** - Lines 95, 124-130, 384-408

**Current Implementation:**
```typescript
// Line 95: Form default value
sms_tag: event.sms_tag || '',

// Lines 124-130: Validation schema
sms_tag: z
  .string()
  .max(24, 'SMS tag must be 24 characters or less')
  .regex(/^[a-zA-Z0-9+\s]*$/, 'SMS tag can only contain letters, numbers, spaces, and +')
  .trim()
  .optional()
  .or(z.literal('')),

// Lines 384-408: UI field with preview
<FieldLabel htmlFor="sms_tag">Event Tag for SMS</FieldLabel>
<TextInput
  id="sms_tag"
  {...register('sms_tag')}
  placeholder="e.g., Sarah + David, Wedding 2025"
  maxLength={24}
/>
<MicroCopy>
  Optional: This tag appears at the start of SMS messages to identify your event.
  Max 24 characters. Leave empty to auto-generate from event title.
  {watchedValues.sms_tag && (
    <>
      <br />
      <span className="font-medium">Preview:</span> {watchedValues.sms_tag}: Your message text here...
    </>
  )}
</MicroCopy>
```

### **Database Schema**

**Table**: `events` (via Supabase MCP inspection)
```sql
sms_tag: text | nullable: YES | default: null | constraint: char_length(sms_tag) <= 14
```

**Constraint Mismatch**: ⚠️ **Database allows 14 chars, UI validation allows 24 chars**

### **SMS Formatter Integration**

**Primary Function**: `lib/sms-formatter.ts` - `composeSmsText()` and `formatInviteSms()`

**Current Header Logic:**
```typescript
// Lines 120-124: Fetches event data
const { data: eventData } = await supabase
  .from('events')
  .select('sms_tag, title')
  .eq('id', eventId)
  .maybeSingle();

// Lines 148-149: Generates tag with fallback
const eventTag = generateEventTag(event?.sms_tag || null, event?.title || 'Event');
const headerOnlyText = `[${eventTag}]\n${normalizeToGsm7(body.trim())}`;

// Lines 377-399: Extended tag generation (24 chars)
export function generateEventTagExtended(smsTag: string | null, eventTitle: string, maxLength: number = 24): string {
  if (smsTag && smsTag.trim()) {
    return normalizeToAscii(smsTag.trim()).slice(0, maxLength);
  }
  // Auto-generate from title if no custom tag
}
```

**Format Inconsistency**: ⚠️ **Two different formats used**
- **Regular messages**: `[EventTag]` (brackets)
- **Invite messages**: `EventTag:` (colon, no brackets)

---

## 🚨 **Gaps & Risks Identified**

### **1. Creation vs. Edit Inconsistency**
- ❌ **Event creation wizard** has NO SMS tag field
- ✅ **Event editing** has full SMS tag functionality
- **Risk**: New events created without tags, hosts must edit later

### **2. Database Constraint Mismatch**
- 🗄️ **Database**: 14 character limit (`char_length(sms_tag) <= 14`)
- 🎨 **UI Validation**: 24 character limit (`max(24, 'SMS tag must be 24 characters or less')`)
- **Risk**: UI allows input that database will reject

### **3. SMS Format Inconsistency**
- 📨 **Regular messages**: `[EventTag] Your message...` (brackets)
- 📧 **Invite messages**: `EventTag: Your message...` (colon)
- **Risk**: Confusing user experience, inconsistent branding

### **4. Validation Schema Divergence**
- 📝 **Creation schema** (`lib/validations.ts`): No SMS tag field
- ✏️ **Edit schema** (`lib/validation/events.ts`): Full SMS tag validation
- **Risk**: Type safety issues, inconsistent validation

### **5. Legacy Event Migration**
- 🏗️ **Existing events**: May have `sms_tag = null`
- 📱 **SMS formatter**: Falls back to auto-generated tags
- **Risk**: Inconsistent SMS headers for older events

---

## 💡 **Recommended Solution**

### **UX Copy & Validation Strategy**

**Label**: "Event Tag for SMS"  
**Helper Text**: "A short label shown at the start of every SMS so guests know it's from your event (max 20 characters). Example: Sarah + David."  
**Preview Format**: `Sarah + David: Your message text…` (colon format for consistency)  
**Validation**: Required field, 1-20 characters, alphanumeric + spaces + "+" only

**Rationale for 20 chars**: 
- Compromise between 14 (DB constraint) and 24 (current UI)
- Leaves room for `: ` separator and message content in 160-char SMS
- Aligns with SMS best practices for sender identification

### **Database Schema Changes**

```sql
-- Update constraint to match new limit
ALTER TABLE events 
DROP CONSTRAINT IF EXISTS events_sms_tag_check;

ALTER TABLE events 
ADD CONSTRAINT events_sms_tag_check 
CHECK (sms_tag IS NULL OR char_length(sms_tag) <= 20);

-- Migration for existing events (optional)
UPDATE events 
SET sms_tag = LEFT(title, 20) 
WHERE sms_tag IS NULL AND title IS NOT NULL;
```

### **Implementation Plan**

#### **Phase 1: Align Existing Edit Flow**
1. Update `lib/validation/events.ts` - Change max length from 24 to 20
2. Update database constraint from 14 to 20 characters
3. Standardize SMS formatter to use colon format consistently
4. Update preview text in `EventDetailsEditor.tsx`

#### **Phase 2: Add to Creation Flow**
1. Add `sms_tag` field to `EventCreationInput` interface
2. Update `CreateEventWizard.tsx` - Add SMS tag field to "basics" step
3. Update `eventCreateSchema` in `lib/validations.ts`
4. Update database RPC function to accept `sms_tag`
5. Make field **required** with validation

#### **Phase 3: SMS Format Consistency**
1. Update `composeSmsText()` to use colon format: `EventTag: message`
2. Remove brackets format `[EventTag]` entirely
3. Update all SMS previews in messaging UI
4. Test invite and regular message formatting

---

## 📋 **Files to Modify**

### **Creation Flow**
- `components/features/events/CreateEventWizard.tsx` - Add SMS tag field
- `lib/services/eventCreation.ts` - Update `EventCreationInput` interface
- `lib/validations.ts` - Add SMS tag to `eventCreateSchema`
- `supabase/migrations/` - Update RPC function for SMS tag

### **Validation & Types**
- `lib/validation/events.ts` - Reduce max length to 20, make required
- Database constraint update migration

### **SMS Formatting**
- `lib/sms-formatter.ts` - Standardize to colon format
- `components/features/messaging/host/SendFlowModal.tsx` - Update previews
- `components/features/host-dashboard/SMSAnnouncementModal.tsx` - Update previews

### **Database**
- New migration: Update `sms_tag` constraint to 20 chars
- Update `create_event_with_host_atomic()` RPC function

---

## 🔄 **Rollback Strategy**

### **UI Rollback**
1. Revert `CreateEventWizard.tsx` to remove SMS tag field
2. Revert `EventCreationInput` interface changes
3. Make SMS tag optional again in validation schemas

### **Database Rollback**
1. Revert constraint back to 14 characters
2. Revert RPC function to exclude `sms_tag` parameter
3. Set `sms_tag = null` for any events created during rollout

### **SMS Format Rollback**
1. Revert `composeSmsText()` to use brackets format `[EventTag]`
2. Revert all preview components to show brackets

**Migration Safety**: All changes are additive/optional, so rollback is low-risk

---

## 🧪 **Test Plan Outline**

### **Happy Path**
1. **Create event** with valid SMS tag → Tag appears in event settings
2. **Send message** → SMS shows `EventTag: message` format
3. **Edit SMS tag** → Changes reflected in subsequent messages
4. **Empty tag** → Auto-generates from event title

### **Validation Tests**
1. **Empty tag** → Clear error message, form blocked
2. **Too long** (>20 chars) → Validation error with character count
3. **Invalid characters** → Clear error with allowed characters
4. **Edge cases** → Emojis, special chars, Unicode handling

### **SMS Consistency**
1. **Invite messages** → `EventTag: Welcome to our wedding...`
2. **Regular messages** → `EventTag: Update about the venue...`
3. **Scheduled messages** → Same format as immediate sends
4. **Legacy events** → Auto-generated tags work correctly

### **RLS & Permissions**
1. **Host creates event** → Can set SMS tag
2. **Host edits event** → Can modify SMS tag
3. **Guest access** → Cannot see/edit SMS tag
4. **Cross-event access** → Proper isolation

---

## ✅ **Acceptance Criteria**

- [ ] Event creation **requires** "Event Tag for SMS" with clear guidance
- [ ] Tag is stored consistently and used by formatter without regressions
- [ ] All SMS messages use consistent `EventTag: message` format
- [ ] Database constraint matches UI validation (20 characters)
- [ ] Legacy events have safe migration path
- [ ] Clean rollback plan documented and tested
- [ ] No changes to Twilio path, deliveries, or notification behavior
- [ ] RLS policies remain correct and secure

---

## 🎯 **Success Metrics**

- **100%** of new events have custom SMS tags
- **0** database constraint violations
- **Consistent** SMS header format across all message types
- **<2 seconds** additional event creation time
- **No regression** in SMS delivery rates or formatting

---

*This audit provides the foundation for implementing SMS tag as a first-class, required field in event creation while maintaining consistency with existing SMS formatting and ensuring a smooth migration path.*
