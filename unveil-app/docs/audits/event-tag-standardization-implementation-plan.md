# Event Creation & SMS Tag — Standardize, Require, and Align Constraints (20-char, colon format)

**Date**: January 30, 2025  
**Status**: 🎯 **IMPLEMENTATION PLAN - READY TO EXECUTE**  
**Intent**: Resolve audit gaps by adding required Event Tag field to creation, standardizing to `EventTag:` format, and aligning all constraints at 20 characters.

---

## 📊 **Current State Recap**

### **Exact Gaps Identified**

**1. Creation vs Edit Inconsistency**
- ❌ `components/features/events/CreateEventWizard.tsx` - NO SMS tag field
- ✅ `components/features/host-dashboard/EventDetailsEditor.tsx` - Full SMS tag functionality (lines 95, 384-408)

**2. Constraint Misalignment**
- 🗄️ **Database**: `char_length(sms_tag) <= 14` (constraint: `events_sms_tag_len`)
- 🎨 **UI Validation**: `max(24, 'SMS tag must be 24 characters or less')` (`lib/validation/events.ts:126`)
- 📝 **Creation Schema**: No SMS tag field in `lib/validations.ts`

**3. Format Inconsistency**
- 📨 **Regular messages**: `[${eventTag}]` format (line 149, 294 in `lib/sms-formatter.ts`)
- 📧 **Invite messages**: `EventTag:` format (lines 684, 558 in `formatInviteSms()`)

**4. Database State**
- **Current events**: 3 total, 3 with tags, 0 without tags (low migration risk)
- **RLS Policies**: ✅ Properly configured - hosts can INSERT/UPDATE their own events

---

## 🎯 **Proposed Implementation Plan**

### **Phase 1: Align Database & Validation (Foundation)**

**Database Migration** (`supabase/migrations/20250130_standardize_sms_tag_constraints.sql`):
```sql
-- Update constraint to 20 characters
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_sms_tag_len;
ALTER TABLE events ADD CONSTRAINT events_sms_tag_20_char 
  CHECK (sms_tag IS NULL OR (char_length(sms_tag) <= 20 AND char_length(sms_tag) >= 1));

-- Backfill strategy for existing NULL tags (safe - only 3 events, all have tags)
-- No backfill needed based on current data
```

**Shared Validation Schema** (`lib/validation/events.ts`):
```typescript
// Update existing validation to 20 chars and align with creation needs
sms_tag: z
  .string()
  .min(1, 'Event tag is required')
  .max(20, 'Event tag must be 20 characters or less')
  .regex(/^[a-zA-Z0-9+\s]*$/, 'Event tag can only contain letters, numbers, spaces, and +')
  .trim(),
```

### **Phase 2: Standardize SMS Formatting (Consistency)**

**SMS Formatter Updates** (`lib/sms-formatter.ts`):
- **Line 149**: Change `[${eventTag}]\n` → `${eventTag}: `
- **Line 294**: Change `header: \`[${eventTag}]\`` → `header: \`${eventTag}:\``
- **Comments/docs**: Update references from `[EventTag]` to `EventTag:`

**Preview Components** (ensure colon format in all previews):
- `components/features/host-dashboard/EventDetailsEditor.tsx:402` - Already shows colon format ✅
- `components/features/host-dashboard/SMSAnnouncementModal.tsx` - Update if using brackets
- `components/features/messaging/host/SendFlowModal.tsx` - Update message previews

### **Phase 3: Add Required Field to Creation Flow**

**Event Creation Interface** (`lib/services/eventCreation.ts`):
```typescript
export interface EventCreationInput {
  title: string;
  event_date: string;
  location?: string;
  is_public: boolean;
  header_image?: File;
  creation_key?: string;
  sms_tag: string; // NEW: Required field
}
```

**Creation Wizard** (`components/features/events/CreateEventWizard.tsx`):
- Add SMS tag field to "basics" step (after event_time, before location)
- Use same validation and preview pattern as edit flow
- Copy: Label "Event Tag for SMS", Helper "Short label shown at the start of each SMS so guests recognize your event. Max 20 characters. Example: Sarah + David.", Preview `{tag}: Your message text…`

**Creation Schema** (`lib/validations.ts`):
```typescript
export const eventCreateSchema = z.object({
  title: z.string().min(1, 'Event title is required').max(200, 'Event title must be less than 200 characters').trim(),
  event_date: z.string().min(1, 'Event date is required').refine(/* date validation */),
  location: z.string().max(500, 'Location must be less than 500 characters').trim().optional().or(z.literal('')),
  description: z.string().max(2000, 'Description must be less than 2000 characters').trim().optional().or(z.literal('')),
  is_public: z.boolean().default(true),
  sms_tag: z.string().min(1, 'Event tag is required').max(20, 'Event tag must be 20 characters or less').regex(/^[a-zA-Z0-9+\s]*$/, 'Event tag can only contain letters, numbers, spaces, and +').trim(), // NEW
});
```

**Database RPC Update** (`supabase/migrations/20250129000010_add_atomic_event_creation.sql`):
- Update `create_event_with_host_atomic()` function to accept and insert `sms_tag`
- Add parameter validation for length and format

---

## 🚨 **Risk Review & Mitigation**

### **Edge Cases**

**1. Legacy Event Migration**
- **Risk**: Existing events with NULL tags
- **Mitigation**: Current data shows 0 events without tags, so no migration needed
- **Fallback**: Auto-generation from title still works in formatter

**2. Character Validation**
- **Risk**: Users entering emojis or special characters
- **Mitigation**: Regex validation `[a-zA-Z0-9+\s]*` blocks problematic chars
- **UX**: Clear error message with allowed characters

**3. SMS Length Impact**
- **Risk**: 20-char tag + colon + space = 22 chars overhead
- **Mitigation**: SMS formatter already handles length budgeting
- **Validation**: 160 - 22 = 138 chars available for message (acceptable)

### **Migration Safety**

**Database Changes**:
- ✅ Constraint update is non-breaking (expands from 14→20 chars)
- ✅ No data migration needed (all events have tags)
- ✅ RLS policies unchanged (hosts can still update their events)

**API Changes**:
- ⚠️ `EventCreationInput` interface change requires coordinated deployment
- ✅ Existing edit flow unchanged (backward compatible)

---

## 🔄 **Rollback Plan**

### **Phase 1 Rollback (Database/Validation)**
```sql
-- Revert constraint to 14 characters
ALTER TABLE events DROP CONSTRAINT events_sms_tag_20_char;
ALTER TABLE events ADD CONSTRAINT events_sms_tag_len 
  CHECK (sms_tag IS NULL OR char_length(sms_tag) <= 14);
```
- Revert `lib/validation/events.ts` max length back to 24

### **Phase 2 Rollback (SMS Format)**
- Revert `lib/sms-formatter.ts` lines 149, 294 back to `[${eventTag}]` format
- Revert any preview component changes

### **Phase 3 Rollback (Creation Flow)**
- Remove `sms_tag` field from `CreateEventWizard.tsx`
- Revert `EventCreationInput` interface
- Revert `eventCreateSchema` in `lib/validations.ts`
- Revert RPC function changes

**Rollback Safety**: All changes are additive or constraint-relaxing, making rollback low-risk.

---

## 📋 **High-Level File Diffs**

### **Database & Migration**
- `supabase/migrations/20250130_standardize_sms_tag_constraints.sql` - New constraint
- `supabase/migrations/20250129000010_add_atomic_event_creation.sql` - Update RPC function

### **Validation & Types**
- `lib/validation/events.ts` - Change max 24→20, align with creation
- `lib/validations.ts` - Add `sms_tag` field to `eventCreateSchema`
- `lib/services/eventCreation.ts` - Add `sms_tag` to `EventCreationInput`

### **SMS Formatting**
- `lib/sms-formatter.ts` - Change `[tag]` → `tag:` (lines 149, 294)
- Review preview components for bracket usage

### **UI Components**
- `components/features/events/CreateEventWizard.tsx` - Add SMS tag field to basics step
- `components/features/events/types.ts` - Add `sms_tag` to `EventFormData`

### **Database Functions**
- Update `create_event_with_host_atomic()` to handle `sms_tag` parameter

---

## 🧪 **Test Plan Outline**

### **Creation Happy Path**
1. **Create event** with valid SMS tag (5-20 chars) → Saves successfully
2. **Navigate to edit** → SMS tag appears correctly
3. **Send message** → Shows `EventTag: message` format
4. **Preview in composer** → Consistent colon format

### **Validation Tests**
1. **Empty tag** → "Event tag is required" error, form blocked
2. **Too long** (>20 chars) → "Event tag must be 20 characters or less" error
3. **Invalid chars** (emojis, symbols) → "Event tag can only contain letters, numbers, spaces, and +" error
4. **Edge cases** → Spaces only, numbers only, mixed case handling

### **SMS Format Consistency**
1. **Invite messages** → `EventTag: Welcome to our wedding...`
2. **Regular messages** → `EventTag: Update about the venue...`
3. **Scheduled messages** → Same colon format
4. **Kill switch mode** → Still uses colon format (not brackets)

### **Database & RLS**
1. **Host creates event** → Can set SMS tag, saves to database
2. **Host edits event** → Can modify SMS tag
3. **Constraint validation** → 21+ char tags rejected at DB level
4. **Cross-event isolation** → Hosts can only modify their own events

---

## ✅ **Acceptance Criteria**

- [ ] Event creation **requires** SMS tag with helper text and live preview
- [ ] All SMS messages use consistent `EventTag:` format (no brackets)
- [ ] Database constraint, UI validation, and schemas all enforce **20 characters**
- [ ] Existing events continue working without disruption
- [ ] RLS policies unchanged - hosts control their own event tags
- [ ] Clean rollback plan tested and documented
- [ ] No changes to Twilio delivery path or notification behavior

---

## 📈 **Success Metrics**

- **100%** of new events have SMS tags (field is required)
- **0** database constraint violations or validation mismatches
- **Consistent** `EventTag:` format across all message types
- **<5 seconds** additional event creation time
- **No regression** in SMS delivery rates or formatting accuracy

---

*This implementation plan provides a systematic approach to standardizing SMS tags as a required, first-class field while maintaining system consistency and ensuring safe deployment with rollback options.*
