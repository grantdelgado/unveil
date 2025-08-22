# Invite Timestamp Bug Fix - Complete Implementation

## Problem Summary

**Bug**: "Invited • Sent X ago" timestamp was updating after non-invite messages, showing "Sent just now" for regular messages instead of the actual invite send time.

**Root Cause**: The message sending API (`/api/messages/send/route.ts`) was incorrectly identifying regular announcement messages as invitations and updating invitation timestamps via `update_guest_invitation_tracking`.

## Solution Overview

Implemented a comprehensive fix that clearly separates invitation timestamps from general messaging activity at the database, RPC, and UI layers.

## Changes Made

### 1. Database Schema Updates

**New Columns Added to `event_guests`:**

- `first_invited_at` - Tracks the very first time a guest was invited
- `last_messaged_at` - Tracks general messaging activity (separate from invitations)
- `last_invited_at` - Already existed, now used exclusively for invitation timestamps

### 2. New RPC Functions

**`update_guest_invitation_tracking_strict`:**

- ONLY updates invitation-related timestamps (`first_invited_at`, `last_invited_at`, `invited_at`)
- Should only be called for actual invitations, not regular messages

**`update_guest_messaging_activity`:**

- ONLY updates general messaging timestamp (`last_messaged_at`)
- Used for regular messages that are not invitations

**Updated `get_event_guests_with_display_names`:**

- Now returns all new timestamp fields for proper frontend display

### 3. API Route Fixes

**`/api/messages/send/route.ts`:**

- Fixed invitation detection logic: `messageType === 'invitation'` (instead of flawed content-based detection)
- Now calls `update_guest_invitation_tracking_strict` ONLY for actual invitations
- Calls `update_guest_messaging_activity` for regular messages
- Clear separation between invitation and messaging flows

**`/api/guests/invite-single/route.ts`:**

- Updated to use `update_guest_invitation_tracking_strict`
- Ensures single guest invitations properly update invitation timestamps

### 4. Frontend Updates

**`GuestListItem.tsx`:**

- Changed invitation status detection to use `guest.last_invited_at` instead of `guest.invited_at`
- Ensures "Invited • Sent X ago" only shows for actual invitations

**`useSimpleGuestStore.ts`:**

- Added new timestamp fields to TypeScript interface
- Ensures proper data flow from database to UI

**`supabase.types.ts`:**

- Updated with new database schema including `first_invited_at` and `last_messaged_at`

### 5. Data Backfill

**Safe Migration Applied:**

- Backfilled `first_invited_at` from message history where possible
- Ensured `last_invited_at` is properly set for existing invited guests
- Fixed any inconsistent timestamp data

## How It Works Now

### Invitation Flow

1. Host sends invitation via "Send Invitations" button or single invite
2. `messageType` is set to 'invitation'
3. API calls `update_guest_invitation_tracking_strict`
4. Updates: `first_invited_at`, `last_invited_at`, `invited_at`, `invite_attempts`
5. UI shows "Invited • Sent X ago" based on `last_invited_at`

### Regular Message Flow

1. Host sends regular message via Message Center
2. `messageType` is 'announcement' or 'direct'
3. API calls `update_guest_messaging_activity`
4. Updates: `last_messaged_at` only
5. Invitation timestamps remain unchanged
6. UI continues showing original invitation time

## Key Benefits

1. **Accurate Timestamps**: "Invited • Sent X ago" now reflects actual invite time
2. **Clear Separation**: Invitation vs messaging activity are tracked separately
3. **Backward Compatible**: Existing `invited_at` field preserved for compatibility
4. **Safe Migration**: Data backfilled safely without data loss
5. **Future-Proof**: Architecture supports additional activity tracking if needed

## Testing Verification

The fix ensures:

- ✅ Sending an invitation updates invitation timestamps
- ✅ Sending a regular message does NOT update invitation timestamps
- ✅ "Invited • Sent X ago" shows correct invitation time
- ✅ Re-inviting updates the invitation timestamp appropriately
- ✅ Guest counts (Invited/Not Invited) remain accurate
- ✅ All existing functionality preserved

## Issue Resolution Update

**Additional Fix Applied**: Resolved RPC function data type mismatch error that was causing "structure of query does not match function result type" on the Guest Management page.

**Root Cause**: When the `get_event_guests_with_display_names` function was updated to include new columns, some database columns had specific varchar constraints that didn't match the function's `text` return type.

**Solution**: Updated the RPC function to explicitly cast all varchar columns to `text` type, ensuring perfect alignment between database schema and function signature.

**Status**: ✅ Guest Management page now loads successfully with proper invite timestamp separation.

## Migration Safety

- All migrations are idempotent and safe to re-run
- Existing data preserved and properly backfilled
- RLS policies and permissions unchanged
- No breaking changes to existing API contracts

## Files Modified

### Database

- `supabase/migrations/20250207000000_fix_invite_timestamp_separation_v2.sql`
- `supabase/migrations/20250207000001_backfill_invite_timestamps_v2.sql`

### Backend

- `app/api/messages/send/route.ts`
- `app/api/guests/invite-single/route.ts`
- `app/reference/supabase.types.ts`

### Frontend

- `hooks/guests/useSimpleGuestStore.ts`
- `components/features/host-dashboard/GuestListItem.tsx`

## Acceptance Criteria Met

- ✅ "Invited • Sent X ago" reflects invite send time only
- ✅ Non-invite messages no longer refresh the invite timestamp
- ✅ Counts (Invited / Not Invited) remain correct
- ✅ RLS and existing permissions unaffected
- ✅ Migration + backfill are safe to re-run and documented

The bug is now completely resolved with a robust, scalable solution that maintains clear separation between invitation and messaging activities.
