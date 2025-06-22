-- Emergency schema recreation after tables were dropped
-- This recreates the essential simplified schema structure

BEGIN;

-- 1. Recreate events table
CREATE TABLE public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  location TEXT,
  description TEXT,
  host_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  header_image_url TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Recreate event_participants table
CREATE TABLE public.event_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'guest' CHECK (role IN ('host', 'guest')),
  rsvp_status TEXT DEFAULT 'pending' CHECK (rsvp_status IN ('attending', 'declined', 'maybe', 'pending')),
  notes TEXT,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- 3. Recreate media table (simplified)
CREATE TABLE public.media (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  uploader_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Recreate messages table (simplified)
CREATE TABLE public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'direct' CHECK (message_type IN ('direct', 'announcement')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create indices for performance
CREATE INDEX idx_events_host ON public.events(host_user_id);
CREATE INDEX idx_events_date ON public.events(event_date);
CREATE INDEX idx_event_participants_event ON public.event_participants(event_id);
CREATE INDEX idx_event_participants_user ON public.event_participants(user_id);
CREATE INDEX idx_media_event ON public.media(event_id);
CREATE INDEX idx_messages_event ON public.messages(event_id);

-- 6. Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 7. Re-enable RLS on users (it was disabled)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 8. Recreate essential RLS functions
CREATE OR REPLACE FUNCTION public.can_access_event(p_event_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.events e
    LEFT JOIN public.event_participants ep ON ep.event_id = e.id
    WHERE e.id = p_event_id 
    AND (e.host_user_id = auth.uid() OR ep.user_id = auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_event_host(p_event_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.events e
    LEFT JOIN public.event_participants ep ON ep.event_id = e.id AND ep.user_id = auth.uid()
    WHERE e.id = p_event_id 
    AND (e.host_user_id = auth.uid() OR ep.role = 'host')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  FROM public.events e
  LEFT JOIN public.event_participants ep ON ep.event_id = e.id AND ep.user_id = auth.uid()
  WHERE e.host_user_id = auth.uid() OR ep.user_id = auth.uid()
  ORDER BY e.event_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create simplified RLS policies
-- Users policies
CREATE POLICY "users_select_own" ON public.users FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "users_select_event_related" ON public.users FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    LEFT JOIN public.event_participants ep1 ON ep1.event_id = e.id AND ep1.user_id = auth.uid()
    LEFT JOIN public.event_participants ep2 ON ep2.event_id = e.id AND ep2.user_id = users.id
    WHERE (e.host_user_id = auth.uid() OR ep1.user_id = auth.uid())
    AND (e.host_user_id = users.id OR ep2.user_id = users.id)
  )
);

CREATE POLICY "users_update_own" ON public.users FOR UPDATE TO authenticated
USING (id = auth.uid());

-- Events policies
CREATE POLICY "events_select_accessible" ON public.events FOR SELECT TO authenticated
USING (is_public = true OR can_access_event(id));

CREATE POLICY "events_manage_own" ON public.events FOR ALL TO authenticated
USING (is_event_host(id));

-- Event participants policies
CREATE POLICY "participants_select_event_related" ON public.event_participants FOR SELECT TO authenticated
USING (can_access_event(event_id));

CREATE POLICY "participants_manage_as_host" ON public.event_participants FOR ALL TO authenticated
USING (is_event_host(event_id));

-- Media policies
CREATE POLICY "media_select_event_accessible" ON public.media FOR SELECT TO authenticated
USING (can_access_event(event_id));

CREATE POLICY "media_insert_event_participant" ON public.media FOR INSERT TO authenticated
WITH CHECK (can_access_event(event_id));

CREATE POLICY "media_update_own" ON public.media FOR UPDATE TO authenticated
USING (uploader_user_id = auth.uid());

-- Messages policies
CREATE POLICY "messages_select_event_accessible" ON public.messages FOR SELECT TO authenticated
USING (can_access_event(event_id));

CREATE POLICY "messages_insert_event_participant" ON public.messages FOR INSERT TO authenticated
WITH CHECK (can_access_event(event_id));

-- 10. Grant permissions
GRANT SELECT, UPDATE ON public.users TO authenticated;
GRANT ALL ON public.events TO authenticated;
GRANT ALL ON public.event_participants TO authenticated;
GRANT ALL ON public.media TO authenticated;
GRANT ALL ON public.messages TO authenticated;

GRANT EXECUTE ON FUNCTION public.can_access_event(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_host(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_events() TO authenticated;

COMMIT; 