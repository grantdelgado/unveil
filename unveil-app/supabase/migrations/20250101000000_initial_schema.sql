-- Initial Schema Migration for Unveil Wedding App
-- Creates core tables required by subsequent migrations
-- Designed to be simple, secure, and extensible

-- ============================================
-- 1. USERS TABLE
-- ============================================

CREATE TABLE public.users (
  id UUID DEFAULT auth.uid() NOT NULL PRIMARY KEY,
  email TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'guest' CHECK (role IN ('guest', 'host', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Email format validation (will be made optional in phone_first_auth migration)
  CONSTRAINT email_format CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to users
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- 2. EVENTS TABLE  
-- ============================================

CREATE TABLE public.events (
  id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  host_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  location TEXT,
  description TEXT,
  header_image_url TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Apply updated_at trigger to events
CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- 3. EVENT_GUESTS TABLE
-- ============================================

CREATE TABLE public.event_guests (
  id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Guest information (can exist without user account)
  guest_name TEXT,
  guest_email TEXT,
  phone TEXT NOT NULL,
  
  -- RSVP and invitation status
  rsvp_status TEXT DEFAULT 'pending' CHECK (rsvp_status IN ('attending', 'declined', 'maybe', 'pending')),
  notes TEXT,
  guest_tags TEXT[] DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure each phone is only invited once per event
  UNIQUE(event_id, phone),
  
  -- Phone format validation (E.164 format)
  CONSTRAINT phone_format CHECK (phone ~ '^\+[1-9]\d{1,14}$')
);

-- Apply updated_at trigger to event_guests
CREATE TRIGGER event_guests_updated_at
  BEFORE UPDATE ON public.event_guests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- 4. MESSAGES TABLE
-- ============================================

CREATE TABLE public.messages (
  id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  recipient_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'direct' CHECK (message_type IN ('direct', 'announcement', 'channel')),
  parent_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  recipient_tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Apply updated_at trigger to messages
CREATE TRIGGER messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- 5. MEDIA TABLE
-- ============================================

CREATE TABLE public.media (
  id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  uploader_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  caption TEXT,
  is_featured BOOLEAN DEFAULT FALSE,
  media_tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Apply updated_at trigger to media
CREATE TRIGGER media_updated_at
  BEFORE UPDATE ON public.media
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- 6. PERFORMANCE INDEXES
-- ============================================

-- Users indexes
CREATE INDEX idx_users_email ON public.users(email);

-- Events indexes  
CREATE INDEX idx_events_host_user_id ON public.events(host_user_id);
CREATE INDEX idx_events_event_date ON public.events(event_date);
CREATE INDEX idx_events_is_public ON public.events(is_public);

-- Event guests indexes
CREATE INDEX idx_event_guests_event_id ON public.event_guests(event_id);
CREATE INDEX idx_event_guests_user_id ON public.event_guests(user_id);
CREATE INDEX idx_event_guests_phone ON public.event_guests(phone);
CREATE INDEX idx_event_guests_rsvp_status ON public.event_guests(rsvp_status);

-- Messages indexes
CREATE INDEX idx_messages_event_id ON public.messages(event_id);
CREATE INDEX idx_messages_sender_user_id ON public.messages(sender_user_id);
CREATE INDEX idx_messages_recipient_user_id ON public.messages(recipient_user_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);

-- Media indexes
CREATE INDEX idx_media_event_id ON public.media(event_id);
CREATE INDEX idx_media_uploader_user_id ON public.media(uploader_user_id);
CREATE INDEX idx_media_media_type ON public.media(media_type);

-- ============================================
-- 7. ROW LEVEL SECURITY (RLS) SETUP
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 8. BASIC RLS HELPER FUNCTIONS
-- ============================================

-- Function to check if user is event host
CREATE OR REPLACE FUNCTION public.is_event_host(p_event_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.events 
    WHERE id = p_event_id AND host_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is event guest
CREATE OR REPLACE FUNCTION public.is_event_guest(p_event_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.event_guests 
    WHERE event_id = p_event_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. BASIC RLS POLICIES
-- ============================================

-- Users policies
CREATE POLICY "Users can view their own profile"
ON public.users FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
ON public.users FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Events policies
CREATE POLICY "Users can view public events and events they're involved in"
ON public.events FOR SELECT TO authenticated
USING (
  is_public = true OR 
  host_user_id = auth.uid() OR 
  is_event_guest(id)
);

CREATE POLICY "Only hosts can update their events"
ON public.events FOR UPDATE TO authenticated
USING (host_user_id = auth.uid())
WITH CHECK (host_user_id = auth.uid());

CREATE POLICY "Authenticated users can create events"
ON public.events FOR INSERT TO authenticated
WITH CHECK (host_user_id = auth.uid());

CREATE POLICY "Only hosts can delete their events"
ON public.events FOR DELETE TO authenticated
USING (host_user_id = auth.uid());

-- Event guests policies
CREATE POLICY "Users can view guests for events they're involved in"
ON public.event_guests FOR SELECT TO authenticated
USING (
  is_event_host(event_id) OR 
  user_id = auth.uid()
);

CREATE POLICY "Only event hosts can manage guest list"
ON public.event_guests FOR ALL TO authenticated
USING (is_event_host(event_id))
WITH CHECK (is_event_host(event_id));

-- Messages policies
CREATE POLICY "Users can view messages for events they're involved in"
ON public.messages FOR SELECT TO authenticated
USING (
  is_event_host(event_id) OR 
  is_event_guest(event_id) OR
  sender_user_id = auth.uid() OR
  recipient_user_id = auth.uid()
);

CREATE POLICY "Users can send messages to events they're involved in"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  sender_user_id = auth.uid() AND (
    is_event_host(event_id) OR 
    is_event_guest(event_id)
  )
);

-- Media policies
CREATE POLICY "Users can view media for events they're involved in"
ON public.media FOR SELECT TO authenticated
USING (
  is_event_host(event_id) OR 
  is_event_guest(event_id)
);

CREATE POLICY "Users can upload media to events they're involved in"
ON public.media FOR INSERT TO authenticated
WITH CHECK (
  uploader_user_id = auth.uid() AND (
    is_event_host(event_id) OR 
    is_event_guest(event_id)
  )
);

CREATE POLICY "Users can delete their own media"
ON public.media FOR DELETE TO authenticated
USING (uploader_user_id = auth.uid());

-- ============================================
-- 10. AUTH TRIGGER SETUP
-- ============================================

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 11. ADDITIONAL ENUMS
-- ============================================

-- Create custom types for consistency
CREATE TYPE public.user_role_enum AS ENUM ('guest', 'host', 'admin');
CREATE TYPE public.rsvp_status_enum AS ENUM ('attending', 'declined', 'maybe', 'pending');
CREATE TYPE public.media_type_enum AS ENUM ('image', 'video');
CREATE TYPE public.message_type_enum AS ENUM ('direct', 'announcement', 'channel');

-- ============================================
-- 12. PUBLIC USER PROFILES VIEW
-- ============================================

-- Create view for public user profiles (limited data exposure)
CREATE OR REPLACE VIEW public.public_user_profiles AS
SELECT 
  id,
  full_name,
  avatar_url
FROM public.users;

-- RLS for public profiles view
ALTER VIEW public.public_user_profiles SET (security_invoker = true);

-- Grant permissions
GRANT SELECT ON public.public_user_profiles TO authenticated, anon;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- This migration creates the foundation schema required by:
-- - 20250109000000_phone_first_auth_refactor.sql (will modify users table)
-- - 20250602002100_enhance_messaging_system.sql (will add complex messaging)
-- - 20250112000000_simplify_schema.sql (will simplify back to clean state) 