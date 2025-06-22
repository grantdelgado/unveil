-- Schema Simplification Migration
-- Reduces 11 tables to 5 core tables for better maintainability
-- Part of the comprehensive simplification audit

BEGIN;

-- =============================================
-- STEP 1: CREATE SIMPLIFIED TABLES
-- =============================================

-- 1. Simplified Users Table (phone-first)
CREATE TABLE IF NOT EXISTS public.users_new (
  id UUID DEFAULT auth.uid() NOT NULL PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  email TEXT, -- Optional for notifications only
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT users_new_phone_format CHECK (phone ~ '^\+[1-9]\d{1,14}$')
);

-- 2. Simplified Events Table
CREATE TABLE IF NOT EXISTS public.events_new (
  id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  location TEXT,
  description TEXT,
  host_user_id UUID NOT NULL REFERENCES public.users_new(id) ON DELETE CASCADE,
  header_image_url TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Event Participants (replaces event_guests with cleaner structure)
CREATE TABLE IF NOT EXISTS public.event_participants (
  id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events_new(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users_new(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'guest' CHECK (role IN ('host', 'guest')),
  rsvp_status TEXT DEFAULT 'pending' CHECK (rsvp_status IN ('attending', 'declined', 'maybe', 'pending')),
  notes TEXT,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(event_id, user_id)
);

-- 4. Simplified Media Table
CREATE TABLE IF NOT EXISTS public.media_new (
  id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events_new(id) ON DELETE CASCADE,
  uploader_user_id UUID REFERENCES public.users_new(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  caption TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Simplified Messages Table (single table approach)
CREATE TABLE IF NOT EXISTS public.messages_new (
  id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events_new(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES public.users_new(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'direct' CHECK (message_type IN ('direct', 'announcement')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- STEP 2: MIGRATE ESSENTIAL DATA
-- =============================================

-- Migrate users (keeping essential data only)
INSERT INTO public.users_new (id, phone, full_name, avatar_url, email, created_at, updated_at)
SELECT 
  id, 
  phone,
  full_name,
  avatar_url,
  email,
  created_at,
  updated_at
FROM public.users
ON CONFLICT (id) DO NOTHING;

-- Migrate events
INSERT INTO public.events_new (id, title, event_date, location, description, host_user_id, header_image_url, is_public, created_at, updated_at)
SELECT 
  id,
  title,
  event_date::DATE,
  location,
  description,
  host_user_id,
  header_image_url,
  COALESCE(is_public, false),
  created_at,
  updated_at
FROM public.events
ON CONFLICT (id) DO NOTHING;

-- Migrate event participants (from event_guests)
INSERT INTO public.event_participants (id, event_id, user_id, role, rsvp_status, notes, invited_at, created_at)
SELECT 
  gen_random_uuid(),
  event_id,
  user_id,
  COALESCE(role, 'guest'),
  COALESCE(rsvp_status, 'pending'),
  notes,
  COALESCE(created_at, NOW()),
  COALESCE(created_at, NOW())
FROM public.event_guests
WHERE user_id IS NOT NULL
ON CONFLICT (event_id, user_id) DO NOTHING;

-- Migrate media (essential fields only)
INSERT INTO public.media_new (id, event_id, uploader_user_id, storage_path, media_type, caption, created_at)
SELECT 
  id,
  event_id,
  uploader_user_id,
  storage_path,
  media_type,
  caption,
  created_at
FROM public.media
ON CONFLICT (id) DO NOTHING;

-- Migrate messages (essential messages only)
INSERT INTO public.messages_new (id, event_id, sender_user_id, content, message_type, created_at)
SELECT 
  id,
  event_id,
  sender_user_id,
  content,
  COALESCE(message_type, 'direct'),
  created_at
FROM public.messages
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- STEP 3: CREATE INDICES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_users_new_phone ON public.users_new(phone);
CREATE INDEX IF NOT EXISTS idx_events_new_host ON public.events_new(host_user_id);
CREATE INDEX IF NOT EXISTS idx_events_new_date ON public.events_new(event_date);
CREATE INDEX IF NOT EXISTS idx_event_participants_event ON public.event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_user ON public.event_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_role ON public.event_participants(role);
CREATE INDEX IF NOT EXISTS idx_media_new_event ON public.media_new(event_id);
CREATE INDEX IF NOT EXISTS idx_messages_new_event ON public.messages_new(event_id);

-- =============================================
-- STEP 4: SIMPLIFIED RLS FUNCTIONS
-- =============================================

-- First drop all RLS policies that depend on functions we're about to drop
-- Note: Using DO blocks because we can't use IF EXISTS with table names in DROP POLICY
DO $$
BEGIN
  -- Drop policies on sub_events if table exists
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sub_events') THEN
    DROP POLICY IF EXISTS "Users can view sub-events for events they host or are guests of" ON public.sub_events;
  END IF;
  
  -- Drop policies on guest_sub_event_assignments if table exists  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'guest_sub_event_assignments') THEN
    DROP POLICY IF EXISTS "Users can view assignments for events they host or are guests of" ON public.guest_sub_event_assignments;
  END IF;
  
  -- Drop policies on events table
  DROP POLICY IF EXISTS "Users can view events they are invited to or public ones" ON public.events;
  DROP POLICY IF EXISTS "Users can view events they participate in" ON public.events;
END $$;

-- Drop old complex functions (CASCADE to handle any remaining dependencies)
DROP FUNCTION IF EXISTS public.is_event_guest(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_event_participant(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_events_with_roles() CASCADE;
DROP FUNCTION IF EXISTS public.current_user_guest_has_tags(TEXT, TEXT[]) CASCADE;
DROP FUNCTION IF EXISTS public.get_event_details_for_user(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_events_for_user(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.find_user_by_phone(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.user_can_view_profile(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.can_view_user_profile(TEXT) CASCADE;

-- 1. Check if user can access event (host or participant)
CREATE OR REPLACE FUNCTION public.can_access_event(p_event_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.events_new e
    LEFT JOIN public.event_participants ep ON ep.event_id = e.id
    WHERE e.id = p_event_id 
    AND (e.host_user_id = auth.uid() OR ep.user_id = auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Check if user is host of event  
CREATE OR REPLACE FUNCTION public.is_event_host(p_event_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.events_new e
    LEFT JOIN public.event_participants ep ON ep.event_id = e.id AND ep.user_id = auth.uid()
    WHERE e.id = p_event_id 
    AND (e.host_user_id = auth.uid() OR ep.role = 'host')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Get user events with roles (for event selection)
CREATE OR REPLACE FUNCTION public.get_user_events()
RETURNS TABLE (
  event_id UUID,
  title TEXT,
  event_date DATE,
  location TEXT,
  user_role TEXT,
  rsvp_status TEXT,
  is_primary_host BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.title,
    e.event_date,
    e.location,
    CASE 
      WHEN e.host_user_id = auth.uid() THEN 'host'::TEXT
      ELSE COALESCE(ep.role, 'guest'::TEXT)
    END,
    ep.rsvp_status,
    (e.host_user_id = auth.uid())
  FROM public.events_new e
  LEFT JOIN public.event_participants ep ON ep.event_id = e.id AND ep.user_id = auth.uid()
  WHERE e.host_user_id = auth.uid() OR ep.user_id = auth.uid()
  ORDER BY e.event_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Development phone check
CREATE OR REPLACE FUNCTION public.is_development_phone(p_phone TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN p_phone ~ '^\+1555000000[1-9]$';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- STEP 5: SIMPLIFIED RLS POLICIES
-- =============================================

-- Enable RLS on new tables
ALTER TABLE public.users_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events_new ENABLE ROW LEVEL SECURITY;  
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages_new ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "users_select_own" ON public.users_new FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "users_select_event_related" ON public.users_new FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events_new e
    LEFT JOIN public.event_participants ep1 ON ep1.event_id = e.id AND ep1.user_id = auth.uid()
    LEFT JOIN public.event_participants ep2 ON ep2.event_id = e.id AND ep2.user_id = users_new.id
    WHERE (e.host_user_id = auth.uid() OR ep1.user_id = auth.uid())
    AND (e.host_user_id = users_new.id OR ep2.user_id = users_new.id)
  )
);

CREATE POLICY "users_update_own" ON public.users_new FOR UPDATE TO authenticated
USING (id = auth.uid());

-- Events policies
CREATE POLICY "events_select_accessible" ON public.events_new FOR SELECT TO authenticated
USING (is_public = true OR can_access_event(id));

CREATE POLICY "events_manage_own" ON public.events_new FOR ALL TO authenticated
USING (is_event_host(id));

-- Event participants policies
CREATE POLICY "participants_select_event_related" ON public.event_participants FOR SELECT TO authenticated
USING (can_access_event(event_id));

CREATE POLICY "participants_manage_as_host" ON public.event_participants FOR ALL TO authenticated
USING (is_event_host(event_id));

-- Media policies
CREATE POLICY "media_select_event_accessible" ON public.media_new FOR SELECT TO authenticated
USING (can_access_event(event_id));

CREATE POLICY "media_insert_event_participant" ON public.media_new FOR INSERT TO authenticated
WITH CHECK (can_access_event(event_id));

CREATE POLICY "media_update_own" ON public.media_new FOR UPDATE TO authenticated
USING (uploader_user_id = auth.uid());

-- Messages policies
CREATE POLICY "messages_select_event_accessible" ON public.messages_new FOR SELECT TO authenticated
USING (can_access_event(event_id));

CREATE POLICY "messages_insert_event_participant" ON public.messages_new FOR INSERT TO authenticated
WITH CHECK (can_access_event(event_id));

-- =============================================
-- STEP 6: UPDATE USER CREATION TRIGGER
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users_new (id, phone, email, full_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', '+1555000000' || (floor(random() * 9) + 1)::text),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update trigger to use new table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- STEP 7: CREATE SIMPLIFIED VIEW
-- =============================================

-- Drop old view
DROP VIEW IF EXISTS public.public_user_profiles;

-- Create new simplified view
CREATE VIEW public.public_user_profiles AS
SELECT 
  u.id,
  u.full_name,
  u.avatar_url
FROM public.users_new u
WHERE EXISTS (
  SELECT 1 FROM public.events_new e
  LEFT JOIN public.event_participants ep1 ON ep1.event_id = e.id AND ep1.user_id = auth.uid()
  LEFT JOIN public.event_participants ep2 ON ep2.event_id = e.id AND ep2.user_id = u.id
  WHERE (e.host_user_id = auth.uid() OR ep1.user_id = auth.uid())
  AND (e.host_user_id = u.id OR ep2.user_id = u.id)
) OR u.id = auth.uid();

-- =============================================
-- STEP 8: GRANT PERMISSIONS
-- =============================================

GRANT SELECT ON public.users_new TO authenticated;
GRANT SELECT, UPDATE ON public.users_new TO authenticated;
GRANT SELECT ON public.events_new TO authenticated;
GRANT ALL ON public.events_new TO authenticated;
GRANT ALL ON public.event_participants TO authenticated;
GRANT ALL ON public.media_new TO authenticated;
GRANT ALL ON public.messages_new TO authenticated;
GRANT SELECT ON public.public_user_profiles TO authenticated;

GRANT EXECUTE ON FUNCTION public.can_access_event(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_host(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_events() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_development_phone(TEXT) TO authenticated;

COMMIT;

-- =============================================
-- MANUAL STEP: RENAME TABLES
-- =============================================
-- After verifying the migration worked:
-- 1. DROP old tables: users, events, event_guests, media, messages, etc.
-- 2. RENAME new tables: users_new -> users, events_new -> events, etc.
-- 3. Update application code to use new simplified structure
-- This is done in a separate migration for safety 