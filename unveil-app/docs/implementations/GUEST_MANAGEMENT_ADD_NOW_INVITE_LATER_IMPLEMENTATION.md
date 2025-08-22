# Guest Management — "Add Now, Invite Later" Implementation Summary

## 🎯 Completed Implementation

Successfully implemented the "add now, invite later" flow with simplified guest states and enhanced functionality.

## 📋 Discovery Notes

### Why New Guests Showed as "Invited"

- **Root Cause**: The `invited_at` column had `DEFAULT now()` in the schema
- **Impact**: Every new guest was automatically marked as "Invited" upon creation
- **Fix Applied**: Removed the default value, so new guests start as "Not Invited"

### Pills and Badge Computation

- Pills computed in `GuestManagement.tsx` using guest data filtering
- Status derived from `invited_at`, `joined_at`, and `declined_at` timestamps
- Counts calculated via `useMemo` for performance

### Remove Action Status

- Previously showed placeholder: "Guest removal will be available in the next update"
- Hard delete logic existed but was disabled
- **Fix Applied**: Implemented soft-delete with confirmation

### Unique Constraint Analysis

- Original: `UNIQUE (event_id, phone)`
- **Updated**: Partial unique index `UNIQUE (event_id, phone) WHERE removed_at IS NULL`
- Allows re-adding previously removed guests

## 🗄️ Database Schema Changes

### New Fields Added

```sql
ALTER TABLE public.event_guests
ADD COLUMN IF NOT EXISTS last_invited_at timestamptz,
ADD COLUMN IF NOT EXISTS invite_attempts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS joined_at timestamptz,
ADD COLUMN IF NOT EXISTS removed_at timestamptz;
```

### Key Schema Fixes

```sql
-- Remove auto-invite behavior
ALTER TABLE public.event_guests ALTER COLUMN invited_at DROP DEFAULT;

-- Replace unique constraint with partial index
DROP CONSTRAINT event_guests_event_id_phone_key;
CREATE UNIQUE INDEX event_guests_event_id_phone_active_key
ON public.event_guests (event_id, phone) WHERE removed_at IS NULL;
```

### New RPC Functions

1. **`update_guest_invitation_tracking()`** - Updates invitation fields on send
2. **`soft_delete_guest()`** - Soft-deletes guests (RLS-protected)
3. **`restore_guest()`** - Restores soft-deleted guests
4. **`check_phone_exists_for_event()`** - Duplicate phone validation
5. **`get_guest_invitation_status()`** - Helper for status determination

## 🎨 UI/UX Changes

### Simplified Filter Pills

**Before**: All / Not Invited / Invited / Joined / Declined  
**After**: All / Not Invited / Invited / Declined

- Removed "Joined" state entirely
- Simplified status logic to 3 core states

### Enhanced Guest Status Badges

- **Not Invited**: 📝 Gray badge
- **Invited**: 📬 Blue badge
- **Declined**: ❌ Red badge

### New Actions

1. **Bulk "Send Invitations"** - Routes to composer with not_invited preset
2. **Per-row "Invite"** - Routes to composer with single guest
3. **Per-row "Copy Link"** - Copies generic event link
4. **Working "Remove"** - Soft-deletes with confirmation

## 🔄 Functional Changes

### Guest Creation Flow

**Before**: Add Guest → Auto-invite → Send SMS → Show as "Invited"  
**After**: Add Guest → Show as "Not Invited" → Manual "Send Invitations"

### Status State Definitions

- **Not Invited**: `invited_at IS NULL AND declined_at IS NULL`
- **Invited**: `invited_at IS NOT NULL AND declined_at IS NULL`
- **Declined**: `declined_at IS NOT NULL`

### Remove Functionality

- **Soft Delete**: Sets `removed_at = NOW()`
- **Partial Index**: Allows re-adding same phone after removal
- **RLS Protected**: Only event hosts can remove guests
- **Host Protection**: Cannot remove event hosts

### Duplicate Prevention

- **Client-side**: Real-time validation with RPC function
- **Server-side**: Partial unique constraint prevents duplicates
- **User Feedback**: Inline error message + disabled submit button

## 🛡️ Security & RLS

All new functionality is properly protected:

- Only event hosts can update invitation tracking
- Only event hosts can remove/restore guests
- Guests cannot modify invitation fields
- Hosts cannot be removed via guest management UI

## 📱 Message Composer Integration

### Preselection Support

- URL parameters: `?preset=not_invited` or `?preset=custom&guests=id1,id2`
- Auto-selects appropriate guests based on preset
- Default SMS template for invitations

### Invitation Tracking

- Automatically updates `invited_at`, `last_invited_at`, `invite_attempts`
- Only triggers on `messageType: 'invitation'`
- Maintains audit trail of invitation attempts

## ✅ Acceptance Criteria Met

- ✅ Adding a guest leaves them "Not Invited" (no SMS sent)
- ✅ Pills show All / Not Invited / Invited / Declined only
- ✅ Remove hides guest, updates counts, allows re-adding same phone
- ✅ Add Guest form prevents duplicate phones with inline error
- ✅ Hosts excluded from invite lists and not removable
- ✅ Returning to Guest Management reflects new counts immediately

## 🚀 Ready for Production

All changes have been:

- ✅ Successfully applied to Supabase database
- ✅ Implemented in frontend components
- ✅ Linted and validated (zero errors)
- ✅ RLS policies properly configured
- ✅ Real-time updates working
- ✅ Backward compatible with existing data
