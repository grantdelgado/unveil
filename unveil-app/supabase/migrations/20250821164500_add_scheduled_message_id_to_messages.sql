-- Add scheduled_message_id column to messages table to link processed scheduled messages
-- This enables proper tracking and prevents duplicate processing

-- Add the column with foreign key constraint
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS scheduled_message_id UUID REFERENCES scheduled_messages(id);

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_messages_scheduled_message_id 
ON messages(scheduled_message_id);

-- Add comment for documentation
COMMENT ON COLUMN messages.scheduled_message_id IS 'Links this message to the original scheduled_messages record if it was created from a scheduled send';
