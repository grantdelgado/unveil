-- Add message templates table for Phase 5 analytics
CREATE TABLE IF NOT EXISTS public.message_templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title varchar(200) NOT NULL,
    content text NOT NULL,
    message_type message_type_enum DEFAULT 'announcement',
    category varchar(50) DEFAULT 'custom' CHECK (category IN ('greeting', 'reminder', 'update', 'thank_you', 'custom')),
    variables text[] DEFAULT '{}', -- Variables like {{guest_name}}, {{event_title}}
    usage_count integer DEFAULT 0,
    is_public boolean DEFAULT false, -- Allow sharing across events (future feature)
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add indexes for message templates
CREATE INDEX IF NOT EXISTS idx_message_templates_event_id ON message_templates(event_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_category ON message_templates(category);
CREATE INDEX IF NOT EXISTS idx_message_templates_message_type ON message_templates(message_type);
CREATE INDEX IF NOT EXISTS idx_message_templates_usage_count ON message_templates(usage_count DESC);

-- Add updated_at trigger
CREATE OR REPLACE TRIGGER message_templates_updated_at 
    BEFORE UPDATE ON message_templates 
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Enhance messages table for analytics tracking
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS delivered_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS failed_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES message_templates(id) ON DELETE SET NULL;

-- Enhance scheduled_messages table to track template usage
ALTER TABLE scheduled_messages 
ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES message_templates(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- Add analytics indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_delivered_count ON messages(delivered_count) WHERE delivered_count > 0;
CREATE INDEX IF NOT EXISTS idx_messages_template_id ON messages(template_id) WHERE template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_template_id ON scheduled_messages(template_id) WHERE template_id IS NOT NULL;
