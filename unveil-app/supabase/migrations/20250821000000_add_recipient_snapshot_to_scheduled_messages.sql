-- Add recipient_snapshot column to scheduled_messages table
-- This optional column stores a snapshot of resolved recipients at schedule time
-- for audit purposes and to prevent audience drift issues.

-- Add the new column (nullable, default NULL to avoid breaking existing code)
ALTER TABLE scheduled_messages 
ADD COLUMN IF NOT EXISTS recipient_snapshot JSONB DEFAULT NULL;

-- Add comment explaining the column format
COMMENT ON COLUMN scheduled_messages.recipient_snapshot IS 
'Optional snapshot of resolved recipients at schedule time for audit purposes. Format: JSONB array with objects like {user_id?: string, guest_id: string, phone: string, name: string, channel?: string}. This prevents audience drift and provides audit trail for who was targeted when the message was scheduled.';

-- Add index for querying recipient snapshots (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_recipient_snapshot 
ON scheduled_messages USING GIN (recipient_snapshot);
