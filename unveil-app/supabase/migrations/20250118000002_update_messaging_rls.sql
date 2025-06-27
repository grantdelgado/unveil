-- Migration: Update messaging RLS policies for tag-based filtering
-- This migration enhances the RLS policies to support tag-based message targeting
-- and ensures proper access control for the new guest tagging features.

-- =====================================================
-- HELPER FUNCTIONS FOR TAG-BASED ACCESS CONTROL
-- =====================================================

-- Function to check if a guest has any of the specified tags
CREATE OR REPLACE FUNCTION guest_has_any_tags(guest_id UUID, target_tags TEXT[])
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  guest_tags TEXT[];
BEGIN
  -- Get the guest's tags
  SELECT event_guests.guest_tags INTO guest_tags
  FROM event_guests
  WHERE event_guests.id = guest_id;
  
  -- If no tags specified or guest has no tags, return false
  IF target_tags IS NULL OR array_length(target_tags, 1) IS NULL 
     OR guest_tags IS NULL OR array_length(guest_tags, 1) IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if guest has any of the target tags
  RETURN guest_tags && target_tags;
END;
$$;

-- Function to check if a guest has all of the specified tags
CREATE OR REPLACE FUNCTION guest_has_all_tags(guest_id UUID, target_tags TEXT[])
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  guest_tags TEXT[];
BEGIN
  -- Get the guest's tags
  SELECT event_guests.guest_tags INTO guest_tags
  FROM event_guests
  WHERE event_guests.id = guest_id;
  
  -- If no tags specified, return true (vacuous truth)
  IF target_tags IS NULL OR array_length(target_tags, 1) IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- If guest has no tags but tags are required, return false
  IF guest_tags IS NULL OR array_length(guest_tags, 1) IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if guest has all target tags
  RETURN target_tags <@ guest_tags;
END;
$$;

-- Function to resolve message recipients based on targeting criteria
CREATE OR REPLACE FUNCTION resolve_message_recipients(
  msg_event_id UUID,
  target_guest_ids UUID[] DEFAULT NULL,
  target_tags TEXT[] DEFAULT NULL,
  require_all_tags BOOLEAN DEFAULT FALSE,
  target_rsvp_statuses TEXT[] DEFAULT NULL
)
RETURNS TABLE(guest_id UUID, guest_phone TEXT, guest_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    eg.id as guest_id,
    eg.phone as guest_phone,
    eg.guest_name as guest_name
  FROM event_guests eg
  WHERE eg.event_id = msg_event_id
    AND eg.phone IS NOT NULL
    AND (
      -- If explicit guest IDs are provided, use those
      (target_guest_ids IS NOT NULL AND eg.id = ANY(target_guest_ids))
      OR
      -- Otherwise, apply tag and RSVP filters
      (
        target_guest_ids IS NULL
        AND
        -- Tag filtering
        (
          target_tags IS NULL 
          OR array_length(target_tags, 1) IS NULL
          OR (
            require_all_tags = FALSE 
            AND guest_has_any_tags(eg.id, target_tags)
          )
          OR (
            require_all_tags = TRUE 
            AND guest_has_all_tags(eg.id, target_tags)
          )
        )
        AND
        -- RSVP status filtering
        (
          target_rsvp_statuses IS NULL 
          OR array_length(target_rsvp_statuses, 1) IS NULL
          OR eg.rsvp_status = ANY(target_rsvp_statuses)
        )
      )
    );
END;
$$;

-- =====================================================
-- UPDATE SCHEDULED MESSAGES RLS POLICIES
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Hosts can manage scheduled messages for their events" ON scheduled_messages;
DROP POLICY IF EXISTS "Guests cannot access scheduled messages" ON scheduled_messages;

-- Updated policy for hosts to manage scheduled messages
CREATE POLICY "Hosts can manage scheduled messages for their events"
ON scheduled_messages
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = scheduled_messages.event_id
    AND e.host_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = scheduled_messages.event_id
    AND e.host_id = auth.uid()
  )
);

-- Guests should not see scheduled messages at all
CREATE POLICY "Guests cannot access scheduled messages"
ON scheduled_messages
FOR ALL
TO authenticated
USING (FALSE);

-- =====================================================
-- UPDATE MESSAGE DELIVERIES RLS POLICIES
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Hosts can view all message deliveries for their events" ON message_deliveries;
DROP POLICY IF EXISTS "Guests can view their own message deliveries" ON message_deliveries;

-- Hosts can view all message deliveries for their events
CREATE POLICY "Hosts can view all message deliveries for their events"
ON message_deliveries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM scheduled_messages sm
    JOIN events e ON e.id = sm.event_id
    WHERE sm.id = message_deliveries.scheduled_message_id
    AND e.host_id = auth.uid()
  )
);

-- Guests can view their own message deliveries
CREATE POLICY "Guests can view their own message deliveries"
ON message_deliveries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM event_guests eg
    WHERE eg.id = message_deliveries.guest_id
    AND eg.phone = auth.jwt() ->> 'phone'
  )
);

-- =====================================================
-- UPDATE MESSAGES RLS POLICIES FOR TAG-BASED ACCESS
-- =====================================================

-- Drop existing policies to rebuild them
DROP POLICY IF EXISTS "Hosts can manage messages for their events" ON messages;
DROP POLICY IF EXISTS "Guests can view messages targeting them" ON messages;

-- Enhanced policy for hosts
CREATE POLICY "Hosts can manage messages for their events"
ON messages
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = messages.event_id
    AND e.host_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = messages.event_id
    AND e.host_id = auth.uid()
  )
);

-- Enhanced policy for guests to view messages targeting them
-- This now supports tag-based targeting
CREATE POLICY "Guests can view messages targeting them"
ON messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM event_guests eg
    WHERE eg.event_id = messages.event_id
    AND eg.phone = auth.jwt() ->> 'phone'
    AND (
      -- Message targets all guests (no specific targeting)
      (
        messages.target_guest_ids IS NULL 
        AND messages.target_tags IS NULL
      )
      OR
      -- Message explicitly targets this guest
      (
        messages.target_guest_ids IS NOT NULL 
        AND eg.id = ANY(messages.target_guest_ids)
      )
      OR
      -- Message targets guests with specific tags and this guest has them
      (
        messages.target_tags IS NOT NULL 
        AND array_length(messages.target_tags, 1) > 0
        AND (
          -- Message requires any of the tags
          (
            (messages.require_all_tags = FALSE OR messages.require_all_tags IS NULL)
            AND guest_has_any_tags(eg.id, messages.target_tags)
          )
          OR
          -- Message requires all of the tags
          (
            messages.require_all_tags = TRUE
            AND guest_has_all_tags(eg.id, messages.target_tags)
          )
        )
      )
    )
  )
);

-- =====================================================
-- UPDATE EVENT GUESTS RLS POLICIES
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Hosts can manage guests for their events" ON event_guests;
DROP POLICY IF EXISTS "Guests can view their own record" ON event_guests;

-- Enhanced policy for hosts to manage event guests and tags
CREATE POLICY "Hosts can manage guests for their events"
ON event_guests
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_guests.event_id
    AND e.host_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_guests.event_id
    AND e.host_id = auth.uid()
  )
);

-- Guests can view and update their own record
CREATE POLICY "Guests can view their own record"
ON event_guests
FOR SELECT
TO authenticated
USING (
  phone = auth.jwt() ->> 'phone'
);

-- Guests can update their own RSVP and preferences (but not tags)
CREATE POLICY "Guests can update their own RSVP"
ON event_guests
FOR UPDATE
TO authenticated
USING (
  phone = auth.jwt() ->> 'phone'
)
WITH CHECK (
  phone = auth.jwt() ->> 'phone'
  -- Prevent guests from modifying their own tags
  AND (
    OLD.guest_tags IS NOT DISTINCT FROM NEW.guest_tags
    OR NEW.guest_tags IS NULL
  )
);

-- =====================================================
-- ADD PERFORMANCE INDEXES
-- =====================================================

-- Index for efficient tag queries
CREATE INDEX IF NOT EXISTS idx_event_guests_tags_gin 
ON event_guests USING GIN (guest_tags);

-- Index for RSVP status queries
CREATE INDEX IF NOT EXISTS idx_event_guests_rsvp_status 
ON event_guests (event_id, rsvp_status);

-- Index for phone lookups
CREATE INDEX IF NOT EXISTS idx_event_guests_phone 
ON event_guests (phone);

-- Index for message targeting queries
CREATE INDEX IF NOT EXISTS idx_messages_target_tags_gin 
ON messages USING GIN (target_tags);

CREATE INDEX IF NOT EXISTS idx_messages_target_guest_ids_gin 
ON messages USING GIN (target_guest_ids);

-- Index for scheduled messages targeting
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_target_tags_gin 
ON scheduled_messages USING GIN (target_tags);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_target_guest_ids_gin 
ON scheduled_messages USING GIN (target_guest_ids);

-- =====================================================
-- ADD VALIDATION CONSTRAINTS
-- =====================================================

-- Ensure tag names are properly formatted
ALTER TABLE event_guests 
ADD CONSTRAINT check_guest_tags_format 
CHECK (
  guest_tags IS NULL 
  OR (
    array_length(guest_tags, 1) <= 10 -- Max 10 tags per guest
    AND NOT EXISTS (
      SELECT 1 FROM unnest(guest_tags) tag 
      WHERE length(tag) > 20 OR length(tag) = 0
    )
  )
);

-- Ensure messages have valid targeting
ALTER TABLE messages 
ADD CONSTRAINT check_message_targeting 
CHECK (
  -- At least one targeting method is used or it's a broadcast
  target_guest_ids IS NOT NULL 
  OR target_tags IS NOT NULL 
  OR (target_guest_ids IS NULL AND target_tags IS NULL)
);

-- Ensure scheduled messages have valid targeting
ALTER TABLE scheduled_messages 
ADD CONSTRAINT check_scheduled_message_targeting 
CHECK (
  -- At least one targeting method is used or it's a broadcast
  target_guest_ids IS NOT NULL 
  OR target_tags IS NOT NULL 
  OR (target_guest_ids IS NULL AND target_tags IS NULL)
);

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant usage on helper functions to authenticated users
GRANT EXECUTE ON FUNCTION guest_has_any_tags(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION guest_has_all_tags(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_message_recipients(UUID, UUID[], TEXT[], BOOLEAN, TEXT[]) TO authenticated;

-- =====================================================
-- ADD HELPFUL COMMENTS
-- =====================================================

COMMENT ON FUNCTION guest_has_any_tags IS 'Check if a guest has any of the specified tags';
COMMENT ON FUNCTION guest_has_all_tags IS 'Check if a guest has all of the specified tags';
COMMENT ON FUNCTION resolve_message_recipients IS 'Resolve message recipients based on targeting criteria including tags and RSVP status';

COMMENT ON COLUMN event_guests.guest_tags IS 'Array of tags assigned to this guest for categorization and targeting';
COMMENT ON COLUMN messages.target_tags IS 'Array of tags to target for this message';
COMMENT ON COLUMN messages.require_all_tags IS 'Whether the guest must have ALL target tags (true) or ANY target tags (false)';
COMMENT ON COLUMN scheduled_messages.target_tags IS 'Array of tags to target for this scheduled message';
COMMENT ON COLUMN scheduled_messages.require_all_tags IS 'Whether the guest must have ALL target tags (true) or ANY target tags (false)';

-- Migration complete 