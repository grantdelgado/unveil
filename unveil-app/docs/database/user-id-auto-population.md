# User ID Auto-Population System

## 📋 Overview

This system automatically populates the `user_id` field in the `event_guests` table when a guest's phone number matches an existing user in the `users` table. This eliminates the need for manual linking and ensures data consistency.

## 🛠 Implementation

### Database Trigger Function

**Function Name**: `assign_user_id_from_phone()`  
**Language**: PL/pgSQL  
**Security**: DEFINER (runs with elevated privileges)

```sql
CREATE OR REPLACE FUNCTION assign_user_id_from_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    matching_user_id UUID;
BEGIN
    -- Only proceed if user_id is NULL and phone is NOT NULL
    IF NEW.user_id IS NULL AND NEW.phone IS NOT NULL THEN
        -- Look for a matching user by phone number
        SELECT id INTO matching_user_id
        FROM public.users
        WHERE phone = NEW.phone
        LIMIT 1;

        -- If we found a matching user, update the user_id
        IF matching_user_id IS NOT NULL THEN
            UPDATE public.event_guests
            SET user_id = matching_user_id,
                updated_at = NOW()
            WHERE id = NEW.id;

            -- Update the NEW record for the trigger response
            NEW.user_id := matching_user_id;
            NEW.updated_at := NOW();
        END IF;
    END IF;

    RETURN NEW;
END;
$$;
```

### Database Trigger

**Trigger Name**: `trg_assign_user_id_from_phone`  
**Event**: AFTER INSERT ON `public.event_guests`  
**Scope**: FOR EACH ROW

```sql
CREATE TRIGGER trg_assign_user_id_from_phone
    AFTER INSERT ON public.event_guests
    FOR EACH ROW
    EXECUTE FUNCTION assign_user_id_from_phone();
```

## 🔧 Backfill System

### Database Function

**Function Name**: `backfill_user_id_from_phone()`  
**Purpose**: Safely update existing rows that need user_id population

```sql
CREATE OR REPLACE FUNCTION backfill_user_id_from_phone()
RETURNS TABLE (
    updated_count INTEGER,
    total_eligible_count INTEGER,
    details TEXT
)
```

### Utility Scripts

#### Command Line Script

**Location**: `scripts/backfill-user-ids.ts`  
**Usage**: `npm run script:backfill-user-ids`

Features:

- ✅ Checks current state before running
- ✅ Shows potential matches
- ✅ Safe for multiple runs
- ✅ Detailed reporting

#### API Endpoint

**Location**: `app/api/admin/backfill-user-ids/route.ts`  
**Endpoints**:

- `GET /api/admin/backfill-user-ids` - Check current state
- `POST /api/admin/backfill-user-ids` - Execute backfill

## 🧪 Testing

### Automated Test

**Location**: `scripts/test-user-id-trigger.ts`  
**Usage**: `npm run test:user-id-trigger`

Test Coverage:

- ✅ Trigger populates user_id for new inserts
- ✅ Trigger does NOT overwrite existing user_id values
- ✅ Clean test data management

## 🚦 How It Works

### New Guest Creation Flow

1. **Guest Insert**: New `event_guests` row inserted with `user_id = NULL`
2. **Trigger Activation**: `trg_assign_user_id_from_phone` fires
3. **Phone Lookup**: Function searches for matching `users.phone`
4. **Auto-Population**: If match found, `user_id` is updated
5. **Completion**: Guest record now has proper user linkage

### Safety Mechanisms

#### ✅ **Never Overwrites**

- Only updates when `user_id IS NULL`
- Existing user_id values are preserved

#### ✅ **Handles Missing Data**

- No error if phone is NULL
- No error if no matching user found

#### ✅ **Performance Optimized**

- Uses efficient phone lookup with LIMIT 1
- Updates only necessary fields

## 📊 Monitoring & Troubleshooting

### Check Current State

```sql
-- Count guests without user_id but with phone
SELECT COUNT(*) as unlinked_guests
FROM event_guests
WHERE user_id IS NULL
AND phone IS NOT NULL;

-- Find potential matches
SELECT eg.phone, eg.guest_name, u.full_name
FROM event_guests eg
JOIN users u ON u.phone = eg.phone
WHERE eg.user_id IS NULL;
```

### Manual Backfill

```sql
-- Run the backfill function
SELECT * FROM backfill_user_id_from_phone();
```

### Test Trigger Status

```sql
-- Check if trigger exists
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE trigger_name = 'trg_assign_user_id_from_phone';
```

## 🔄 Migration History

| Migration                                | Description               | Date    |
| ---------------------------------------- | ------------------------- | ------- |
| `create_assign_user_id_trigger_function` | Creates the core function | Current |
| `create_assign_user_id_trigger`          | Attaches trigger to table | Current |
| `create_backfill_user_id_function`       | Adds backfill utility     | Current |

## 🎯 Use Cases

### Primary Use Case: Guest Import

When hosts import guests via CSV or manual entry:

1. Phone numbers are provided
2. user_id is initially NULL
3. Trigger automatically links if user exists
4. Guest can immediately access their account

### Secondary Use Case: User Registration

When a user registers with a phone number:

1. User account is created
2. Any existing guest records with that phone are automatically linked
3. User gains access to all their event invitations

### Backfill Use Case: Data Migration

For existing data or batch operations:

1. Run backfill script or API
2. All eligible records are updated
3. Safe to run multiple times
4. Detailed reporting provided

## 🛡 Security Considerations

- **Function Security**: Uses SECURITY DEFINER for necessary privileges
- **Input Validation**: Phone format already validated by table constraints
- **No Data Exposure**: Only links data that should be linked
- **Audit Trail**: Updates timestamp for tracking changes

## 📈 Performance Impact

- **Minimal Overhead**: Only triggers on INSERT
- **Efficient Lookup**: Single phone query with LIMIT
- **No Cascade Effects**: Self-contained operation
- **Index Utilization**: Leverages existing phone uniqueness constraints
