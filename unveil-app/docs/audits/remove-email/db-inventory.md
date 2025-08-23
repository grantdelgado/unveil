# Database Email Inventory - Schema Audit

**Date:** January 21, 2025  
**Purpose:** Comprehensive audit of email references in database schema for phone-only MVP conversion  
**Database:** Supabase Project `wvhtbqvnamerdkkjknuv`

## Executive Summary

Found **6 email-related columns** across 3 core tables, plus **2 check constraints** that reference email. The database has email infrastructure built into the messaging system but is not currently required for core functionality.

## Email Columns by Table

### 1. `users` Table
```sql
Column: email
Type: text
Nullable: YES (NULL allowed)
Purpose: User email address (optional)
Usage: Currently nullable, not required for phone-only auth
```

**Analysis:** This column is optional and not used in current phone-only authentication flow. Safe to remove.

### 2. `event_guests` Table
```sql
Column: guest_email  
Type: text
Nullable: YES (NULL allowed)
Purpose: Guest email for contact/import
Usage: Used in guest import CSV, optional field
```

**Analysis:** Used in guest import functionality and guest management. Removing will require updates to import/export logic.

### 3. `message_deliveries` Table
```sql
Column: email
Type: character varying
Nullable: YES (NULL allowed)
Purpose: Email address for message delivery
Usage: Part of multi-channel messaging system

Column: email_status
Type: character varying  
Nullable: YES (NULL allowed)
Default: 'pending'
Purpose: Email delivery status tracking
Constraint: CHECK (email_status IN ('pending', 'sent', 'delivered', 'failed', 'not_applicable'))

Column: email_provider_id
Type: character varying
Nullable: YES (NULL allowed)  
Purpose: External email service provider ID
Usage: Tracking for email delivery services
```

**Analysis:** These columns support email delivery channel in messaging system. Currently unused since messaging is SMS-only.

### 4. `scheduled_messages` Table
```sql
Column: send_via_email
Type: boolean
Nullable: YES (NULL allowed)
Default: false
Purpose: Flag to enable email delivery for scheduled messages
Usage: Multi-channel messaging configuration
```

**Analysis:** Feature flag for email delivery. Currently defaults to false, can be removed safely.

## Database Constraints Affected

### Check Constraints
1. **`event_guests_preferred_communication_check`**
   ```sql
   CHECK (preferred_communication IN ('sms', 'push', 'email', 'none'))
   ```
   **Impact:** Must remove 'email' option from enum

2. **`message_deliveries_email_status_check`**
   ```sql  
   CHECK (email_status IN ('pending', 'sent', 'delivered', 'failed', 'not_applicable'))
   ```
   **Impact:** Can be removed entirely with email_status column

### Foreign Key Constraints
- **No foreign key constraints** directly reference email columns
- All email columns are independent and safe to drop

### Indexes
- **No indexes found** specifically on email columns
- No index cleanup required

## Database Functions Affected

### Functions with Email References (5 functions)

1. **`add_or_restore_guest`**
   - **Usage:** Handles `p_email` parameter for guest creation/restoration
   - **Impact:** Remove email parameter and logic
   - **Lines:** References `guest_email` field in INSERT/UPDATE

2. **`lookup_user_by_phone`**
   - **Usage:** Returns user email in SELECT query
   - **Impact:** Remove email from return columns
   - **Lines:** `SELECT u.email` in return query

3. **`get_event_guests_with_display_names`**
   - **Usage:** Returns guest_email and user_email in results
   - **Impact:** Remove email columns from SELECT
   - **Lines:** Multiple email field references

4. **`upsert_message_delivery`**
   - **Usage:** Handles email delivery parameters and status
   - **Impact:** Remove email-related parameters and logic
   - **Lines:** email_status, email_provider_id handling

5. **`get_messaging_recipients`**
   - **Usage:** Returns guest_email and user_email for messaging
   - **Impact:** Remove email fields from return query
   - **Lines:** `eg.guest_email`, `u.email` in SELECT

### Views
- **No views found** that reference email columns

### RLS Policies  
- **No RLS policies found** that reference email columns
- Email removal will not affect row-level security

## Migration Strategy

### Phase 1: Update Functions
```sql
-- Update functions to remove email parameters and return columns
CREATE OR REPLACE FUNCTION add_or_restore_guest(...)  -- Remove p_email param
CREATE OR REPLACE FUNCTION lookup_user_by_phone(...)  -- Remove email from SELECT  
CREATE OR REPLACE FUNCTION get_event_guests_with_display_names(...)  -- Remove email columns
CREATE OR REPLACE FUNCTION upsert_message_delivery(...)  -- Remove email params
CREATE OR REPLACE FUNCTION get_messaging_recipients(...)  -- Remove email from SELECT
```

### Phase 2: Drop Constraints
```sql
-- Remove check constraints that reference email
ALTER TABLE event_guests DROP CONSTRAINT event_guests_preferred_communication_check;
ALTER TABLE message_deliveries DROP CONSTRAINT message_deliveries_email_status_check;

-- Add updated constraint without email option
ALTER TABLE event_guests ADD CONSTRAINT event_guests_preferred_communication_check 
  CHECK (preferred_communication IN ('sms', 'push', 'none'));
```

### Phase 3: Drop Columns
```sql
-- Drop email columns from all tables
ALTER TABLE users DROP COLUMN email;
ALTER TABLE event_guests DROP COLUMN guest_email;
ALTER TABLE message_deliveries DROP COLUMN email;
ALTER TABLE message_deliveries DROP COLUMN email_status;  
ALTER TABLE message_deliveries DROP COLUMN email_provider_id;
ALTER TABLE scheduled_messages DROP COLUMN send_via_email;
```

## Data Impact Analysis

### Current Data Check
```sql
-- Check for existing email data
SELECT 
  (SELECT COUNT(*) FROM users WHERE email IS NOT NULL) as users_with_email,
  (SELECT COUNT(*) FROM event_guests WHERE guest_email IS NOT NULL) as guests_with_email,
  (SELECT COUNT(*) FROM message_deliveries WHERE email IS NOT NULL) as deliveries_with_email;
```

### Backup Considerations
- Email data should be backed up before removal
- Consider export for potential future migration
- Document any business-critical email addresses

## Dependencies & Risks

### Low Risk
- `users.email` - Optional field, not used in auth flow
- `scheduled_messages.send_via_email` - Defaults to false
- `message_deliveries.email_*` - Unused in current SMS-only system

### Medium Risk  
- `event_guests.guest_email` - Used in import/export, requires code changes
- Database functions - Multiple functions need updates

### High Risk
- **None identified** - No critical dependencies on email functionality

## Verification Queries

### Pre-Migration Verification
```sql
-- Confirm no critical email dependencies
SELECT column_name, table_name FROM information_schema.columns 
WHERE table_schema = 'public' AND column_name ILIKE '%email%';

-- Check for email data that might be lost
SELECT 'users' as table_name, COUNT(*) as email_count 
FROM users WHERE email IS NOT NULL
UNION ALL
SELECT 'event_guests', COUNT(*) FROM event_guests WHERE guest_email IS NOT NULL;
```

### Post-Migration Verification  
```sql
-- Confirm email columns are removed
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'public' AND column_name ILIKE '%email%';
-- Should return 0 rows

-- Confirm functions compile
SELECT proname FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid 
WHERE n.nspname = 'public' AND p.prosrc ILIKE '%email%';
-- Should return 0 rows
```

## Summary

- **6 columns** across 3 tables need removal
- **2 check constraints** need updates  
- **5 database functions** need modification
- **0 views or RLS policies** affected
- **Low overall risk** - email is optional throughout system
- **Clean migration path** - no critical dependencies identified

The database is well-positioned for email removal with minimal risk to core functionality.
