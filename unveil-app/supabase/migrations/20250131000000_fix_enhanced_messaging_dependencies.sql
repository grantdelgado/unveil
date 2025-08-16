-- Fix Enhanced Messaging Dependencies
-- This migration ensures all database components required by the enhanced messaging UI are present

BEGIN;

-- =====================================================
-- 1. ENSURE MESSAGE_TEMPLATES TABLE EXISTS
-- =====================================================

-- Create message_templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.message_templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    created_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title varchar(200) NOT NULL,
    content text NOT NULL,
    message_type text DEFAULT 'announcement' CHECK (message_type IN ('direct', 'announcement')),
    category varchar(50) DEFAULT 'custom' CHECK (category IN ('greeting', 'reminder', 'update', 'thank_you', 'custom')),
    variables text[] DEFAULT '{}', -- Variables like {{guest_name}}, {{event_title}}
    usage_count integer DEFAULT 0,
    is_public boolean DEFAULT false, -- Allow sharing across events (future feature)
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add indexes for message templates if they don't exist
CREATE INDEX IF NOT EXISTS idx_message_templates_event_id ON public.message_templates(event_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_category ON public.message_templates(category);
CREATE INDEX IF NOT EXISTS idx_message_templates_message_type ON public.message_templates(message_type);
CREATE INDEX IF NOT EXISTS idx_message_templates_usage_count ON public.message_templates(usage_count DESC);

-- Add updated_at trigger for message_templates
DROP TRIGGER IF EXISTS message_templates_updated_at ON public.message_templates;
CREATE TRIGGER message_templates_updated_at 
    BEFORE UPDATE ON public.message_templates 
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- 2. CREATE GET_EVENT_TAG_STATS RPC FUNCTION
-- =====================================================

-- Function to get tag statistics for an event
CREATE OR REPLACE FUNCTION public.get_event_tag_stats(event_id_param uuid)
RETURNS TABLE(
    tag_name text,
    guest_count bigint,
    attending_count bigint,
    pending_count bigint,
    declined_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Check if user can access this event
    IF NOT public.can_access_event(event_id_param) THEN
        RAISE EXCEPTION 'Access denied to event %', event_id_param;
    END IF;

    RETURN QUERY
    WITH tag_expanded AS (
        SELECT 
            eg.id as guest_id,
            eg.rsvp_status,
            unnest(COALESCE(eg.guest_tags, '{}'::text[])) as tag_name
        FROM public.event_guests eg
        WHERE eg.event_id = event_id_param
    ),
    tag_stats AS (
        SELECT 
            te.tag_name,
            COUNT(*) as guest_count,
            COUNT(*) FILTER (WHERE te.rsvp_status = 'attending') as attending_count,
            COUNT(*) FILTER (WHERE te.rsvp_status = 'pending') as pending_count,
            COUNT(*) FILTER (WHERE te.rsvp_status = 'declined') as declined_count
        FROM tag_expanded te
        WHERE te.tag_name IS NOT NULL AND te.tag_name != ''
        GROUP BY te.tag_name
    )
    SELECT 
        ts.tag_name,
        ts.guest_count,
        ts.attending_count,
        ts.pending_count,
        ts.declined_count
    FROM tag_stats ts
    ORDER BY ts.guest_count DESC, ts.tag_name;
END;
$$;

-- =====================================================
-- 3. ENSURE EVENT_GUESTS TABLE HAS PROPER STRUCTURE
-- =====================================================

-- Check if event_guests table exists and has the required guest_tags column
DO $$
BEGIN
    -- Add guest_tags column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'event_guests' 
        AND column_name = 'guest_tags'
    ) THEN
        ALTER TABLE public.event_guests ADD COLUMN guest_tags text[] DEFAULT '{}';
    END IF;
END $$;

-- =====================================================
-- 4. ENSURE PROPER RLS POLICIES FOR MESSAGE_TEMPLATES
-- =====================================================

-- Enable RLS on message_templates
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "message_templates_select_policy" ON public.message_templates;
DROP POLICY IF EXISTS "message_templates_insert_policy" ON public.message_templates;
DROP POLICY IF EXISTS "message_templates_update_policy" ON public.message_templates;
DROP POLICY IF EXISTS "message_templates_delete_policy" ON public.message_templates;

-- Create comprehensive RLS policies for message_templates
CREATE POLICY "message_templates_select_policy" ON public.message_templates
    FOR SELECT 
    USING (public.can_access_event(event_id));

CREATE POLICY "message_templates_insert_policy" ON public.message_templates
    FOR INSERT 
    WITH CHECK (
        public.can_access_event(event_id) 
        AND public.is_event_host(event_id)
        AND created_by_user_id = auth.uid()
    );

CREATE POLICY "message_templates_update_policy" ON public.message_templates
    FOR UPDATE 
    USING (
        public.can_access_event(event_id) 
        AND public.is_event_host(event_id)
        AND created_by_user_id = auth.uid()
    );

CREATE POLICY "message_templates_delete_policy" ON public.message_templates
    FOR DELETE 
    USING (
        public.can_access_event(event_id) 
        AND public.is_event_host(event_id)
        AND created_by_user_id = auth.uid()
    );

-- =====================================================
-- 5. GRANT NECESSARY PERMISSIONS
-- =====================================================

-- Grant permissions on message_templates table
GRANT ALL ON public.message_templates TO authenticated;
GRANT USAGE ON SEQUENCE public.message_templates_id_seq TO authenticated;

-- Grant execute permission on the new function
GRANT EXECUTE ON FUNCTION public.get_event_tag_stats(uuid) TO authenticated;

COMMIT;
