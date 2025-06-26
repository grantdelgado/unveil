-- Add guest tagging and scheduled messaging support
-- Phase 2.1: Database Schema Enhancements

-- First add message_type_enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE message_type_enum AS ENUM ('direct', 'announcement', 'channel');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create event_guests table with tags support
CREATE TABLE IF NOT EXISTS public.event_guests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    guest_name text,
    guest_email text,
    phone text NOT NULL,
    rsvp_status text DEFAULT 'pending'::text,
    notes text,
    guest_tags text[] DEFAULT '{}'::text[],
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    role text DEFAULT 'guest'::text NOT NULL,
    invited_at timestamptz DEFAULT now(),
    phone_number_verified boolean DEFAULT false,
    sms_opt_out boolean DEFAULT false,
    preferred_communication varchar(20) DEFAULT 'sms'::varchar,
    
    CONSTRAINT event_guests_role_check CHECK (role = ANY (ARRAY['host'::text, 'guest'::text, 'admin'::text])),
    CONSTRAINT event_guests_rsvp_status_check CHECK (rsvp_status = ANY (ARRAY['attending'::text, 'declined'::text, 'maybe'::text, 'pending'::text])),
    CONSTRAINT event_guests_preferred_communication_check CHECK (preferred_communication::text = ANY (ARRAY['sms'::varchar, 'push'::varchar, 'email'::varchar, 'none'::varchar]::text[])),
    CONSTRAINT phone_format CHECK (phone ~ '^\+[1-9]\d{1,14}$'::text),
    CONSTRAINT event_guests_event_id_phone_key UNIQUE (event_id, phone)
);

-- Create scheduled_messages table
CREATE TABLE IF NOT EXISTS public.scheduled_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    sender_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject varchar(500),
    content text NOT NULL,
    message_type message_type_enum DEFAULT 'announcement',
    send_at timestamptz NOT NULL,
    target_all_guests boolean DEFAULT false,
    target_sub_event_ids uuid[],
    target_guest_tags text[],
    target_guest_ids uuid[],
    send_via_sms boolean DEFAULT true,
    send_via_push boolean DEFAULT true,
    send_via_email boolean DEFAULT false,
    status varchar(20) DEFAULT 'scheduled'::varchar,
    sent_at timestamptz,
    recipient_count integer DEFAULT 0,
    success_count integer DEFAULT 0,
    failure_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    CONSTRAINT scheduled_messages_status_check CHECK (status::text = ANY (ARRAY['scheduled'::varchar, 'sending'::varchar, 'sent'::varchar, 'failed'::varchar, 'cancelled'::varchar]::text[]))
);

-- Create message_deliveries table for tracking
CREATE TABLE IF NOT EXISTS public.message_deliveries (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    scheduled_message_id uuid REFERENCES scheduled_messages(id) ON DELETE CASCADE,
    message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
    guest_id uuid REFERENCES event_guests(id) ON DELETE CASCADE,
    phone_number varchar(20),
    email varchar(255),
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    sms_status varchar(20) DEFAULT 'pending'::varchar,
    push_status varchar(20) DEFAULT 'pending'::varchar,
    email_status varchar(20) DEFAULT 'pending'::varchar,
    sms_provider_id varchar(255),
    push_provider_id varchar(255),
    email_provider_id varchar(255),
    has_responded boolean DEFAULT false,
    response_message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    CONSTRAINT message_deliveries_sms_status_check CHECK (sms_status::text = ANY (ARRAY['pending'::varchar, 'sent'::varchar, 'delivered'::varchar, 'failed'::varchar, 'undelivered'::varchar]::text[])),
    CONSTRAINT message_deliveries_push_status_check CHECK (push_status::text = ANY (ARRAY['pending'::varchar, 'sent'::varchar, 'delivered'::varchar, 'failed'::varchar, 'not_applicable'::varchar]::text[])),
    CONSTRAINT message_deliveries_email_status_check CHECK (email_status::text = ANY (ARRAY['pending'::varchar, 'sent'::varchar, 'delivered'::varchar, 'failed'::varchar, 'not_applicable'::varchar]::text[]))
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_guests_event_id ON event_guests(event_id);
CREATE INDEX IF NOT EXISTS idx_event_guests_phone ON event_guests(phone);
CREATE INDEX IF NOT EXISTS idx_event_guests_rsvp_status ON event_guests(rsvp_status);
CREATE INDEX IF NOT EXISTS idx_event_guests_role ON event_guests(role);
CREATE INDEX IF NOT EXISTS idx_event_guests_guest_tags ON event_guests USING gin(guest_tags);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_event_id ON scheduled_messages(event_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_send_at ON scheduled_messages(send_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON scheduled_messages(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_message_type ON scheduled_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_target_guest_tags ON scheduled_messages USING gin(target_guest_tags);

CREATE INDEX IF NOT EXISTS idx_message_deliveries_scheduled_message_id ON message_deliveries(scheduled_message_id);
CREATE INDEX IF NOT EXISTS idx_message_deliveries_guest_id ON message_deliveries(guest_id);
CREATE INDEX IF NOT EXISTS idx_message_deliveries_status ON message_deliveries(sms_status, push_status, email_status);

-- Update messages table to use message_type_enum
ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS messages_message_type_check;

-- First set default to null, then change type, then set new default
ALTER TABLE messages ALTER COLUMN message_type DROP DEFAULT;

ALTER TABLE messages 
ALTER COLUMN message_type TYPE message_type_enum 
USING message_type::message_type_enum;

ALTER TABLE messages 
ALTER COLUMN message_type SET DEFAULT 'direct'::message_type_enum;

-- Create handle_updated_at function if it doesn't exist
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE OR REPLACE TRIGGER event_guests_updated_at 
    BEFORE UPDATE ON event_guests 
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE OR REPLACE TRIGGER scheduled_messages_updated_at 
    BEFORE UPDATE ON scheduled_messages 
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE OR REPLACE TRIGGER message_deliveries_updated_at 
    BEFORE UPDATE ON message_deliveries 
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- RLS Policies

-- Event guests: hosts can manage all guests, guests can see themselves
ALTER TABLE event_guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_guests_host_full_access" ON event_guests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM events e 
            WHERE e.id = event_guests.event_id 
            AND e.host_user_id = auth.uid()
        )
    );

CREATE POLICY "event_guests_guest_read_own" ON event_guests
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM event_participants ep 
            WHERE ep.event_id = event_guests.event_id 
            AND ep.user_id = auth.uid()
        )
    );

-- Scheduled messages: only hosts can manage
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scheduled_messages_host_only" ON scheduled_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM events e 
            WHERE e.id = scheduled_messages.event_id 
            AND e.host_user_id = auth.uid()
        )
    );

-- Message deliveries: hosts can see all, guests can see their own
ALTER TABLE message_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_deliveries_host_access" ON message_deliveries
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM scheduled_messages sm
            JOIN events e ON e.id = sm.event_id
            WHERE sm.id = message_deliveries.scheduled_message_id
            AND e.host_user_id = auth.uid()
        ) OR
        user_id = auth.uid()
    );

CREATE POLICY "message_deliveries_guest_read_own" ON message_deliveries
    FOR SELECT USING (user_id = auth.uid()); 