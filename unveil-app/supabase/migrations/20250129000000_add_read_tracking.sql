-- Migration: Add read tracking to message deliveries
-- Date: 2025-01-29
-- Purpose: Add read_at timestamp and optimize read tracking performance

-- Add read_at column to message_deliveries table
ALTER TABLE message_deliveries 
ADD COLUMN read_at TIMESTAMPTZ DEFAULT NULL;

-- Create composite index for guest read tracking queries
CREATE INDEX idx_message_deliveries_guest_read 
ON message_deliveries(guest_id, read_at) 
WHERE read_at IS NOT NULL;

-- Create index for message read statistics
CREATE INDEX idx_message_deliveries_message_read 
ON message_deliveries(message_id, read_at) 
WHERE read_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN message_deliveries.read_at IS 'Timestamp when the guest read the message. NULL means unread.';

-- Update RLS policies to ensure read_at can only be updated by the guest or host
CREATE POLICY "Guests can update their own read status"
ON message_deliveries
FOR UPDATE
TO authenticated
USING (
  -- Allow guests to mark their own messages as read
  guest_id IN (
    SELECT id FROM event_guests 
    WHERE user_id = auth.uid() 
    OR (phone = auth.jwt() ->> 'phone' AND user_id IS NULL)
  )
  -- Allow hosts to mark messages as read for any guest in their events
  OR EXISTS (
    SELECT 1 FROM event_guests eg
    JOIN events e ON eg.event_id = e.id
    WHERE eg.id = guest_id
    AND e.host_user_id = auth.uid()
  )
); 