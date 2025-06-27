-- Migration: Consolidate participants into guests
-- Purpose: Migrate all event_participants records into event_guests table
-- Date: 2025-01-28

-- Step 1: Insert all event_participants data into event_guests with enriched user data
INSERT INTO event_guests (
  event_id,
  user_id,
  role,
  rsvp_status,
  guest_name,
  guest_email,
  phone,
  notes,
  invited_at,
  sms_opt_out,
  preferred_communication,
  phone_number_verified
)
SELECT
  ep.event_id,
  ep.user_id,
  ep.role,
  ep.rsvp_status,
  u.full_name as guest_name,
  u.email as guest_email,
  u.phone,
  ep.notes,
  ep.invited_at,
  false as sms_opt_out,              -- Default to allowing SMS
  'sms' as preferred_communication,   -- Default to SMS preference
  false as phone_number_verified      -- Default to unverified, will be updated later
FROM event_participants ep
LEFT JOIN users u ON u.id = ep.user_id
WHERE NOT EXISTS (
  -- Prevent duplicates in case migration is run multiple times
  SELECT 1 FROM event_guests eg
  WHERE eg.event_id = ep.event_id 
    AND eg.user_id = ep.user_id
    AND eg.role = ep.role
);

-- Step 2: Add any missing constraints or indexes if needed
-- (event_guests table already has proper constraints based on schema review)

-- Step 3: Log migration completion
DO $$
DECLARE
  migrated_count INTEGER;
  total_participants INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_participants FROM event_participants;
  SELECT COUNT(*) INTO migrated_count 
  FROM event_guests eg 
  WHERE EXISTS (
    SELECT 1 FROM event_participants ep 
    WHERE ep.event_id = eg.event_id 
      AND ep.user_id = eg.user_id
  );
  
  RAISE NOTICE 'Migration completed: % participants migrated out of % total participants', migrated_count, total_participants;
END $$; 