-- Migration: Add guest display name function
-- Provides computed guest display name that prefers users.full_name over event_guests.guest_name
-- This enables query-time override for guest names when guests are linked to user accounts

-- ============================================
-- GUEST DISPLAY NAME FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.get_guest_display_name(
  p_guest_name TEXT,
  p_user_full_name TEXT
)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT COALESCE(p_user_full_name, p_guest_name, 'Unnamed Guest');
$$;

-- ============================================
-- GUEST DATA WITH DISPLAY NAME VIEW
-- ============================================

-- Create a view that includes computed guest_display_name
-- This provides a consistent way to query guest data with display names
CREATE OR REPLACE VIEW public.guests_with_display_names AS
SELECT 
  eg.*,
  COALESCE(u.full_name, eg.guest_name, 'Unnamed Guest') AS guest_display_name,
  u.id as user_id_resolved,
  u.full_name as user_full_name,
  u.email as user_email,
  u.phone as user_phone,
  u.avatar_url as user_avatar_url,
  u.created_at as user_created_at,
  u.updated_at as user_updated_at,
  u.intended_redirect as user_intended_redirect,
  u.onboarding_completed as user_onboarding_completed
FROM 
  public.event_guests eg
  LEFT JOIN public.users u ON u.id = eg.user_id;

-- ============================================
-- FUNCTION TO GET GUESTS WITH DISPLAY NAMES
-- ============================================

-- RPC function to get guests for an event with computed display names
-- This provides better performance than the view for specific event queries
CREATE OR REPLACE FUNCTION public.get_event_guests_with_display_names(
  p_event_id UUID,
  p_limit INTEGER DEFAULT NULL,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  event_id UUID, 
  user_id UUID,
  guest_name TEXT,
  guest_email TEXT,
  phone TEXT,
  rsvp_status TEXT,
  notes TEXT,
  guest_tags TEXT[],
  role TEXT,
  invited_at TIMESTAMP WITH TIME ZONE,
  phone_number_verified BOOLEAN,
  sms_opt_out BOOLEAN,
  preferred_communication TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  guest_display_name TEXT,
  user_full_name TEXT,
  user_email TEXT,
  user_phone TEXT,
  user_avatar_url TEXT,
  user_created_at TIMESTAMP WITH TIME ZONE,
  user_updated_at TIMESTAMP WITH TIME ZONE,
  user_intended_redirect TEXT,
  user_onboarding_completed BOOLEAN
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    eg.id,
    eg.event_id,
    eg.user_id,
    eg.guest_name,
    eg.guest_email,
    eg.phone,
    eg.rsvp_status,
    eg.notes,
    eg.guest_tags,
    eg.role,
    eg.invited_at,
    eg.phone_number_verified,
    eg.sms_opt_out,
    eg.preferred_communication,
    eg.created_at,
    eg.updated_at,
    COALESCE(u.full_name, eg.guest_name, 'Unnamed Guest') AS guest_display_name,
    u.full_name AS user_full_name,
    u.email AS user_email,
    u.phone AS user_phone,
    u.avatar_url AS user_avatar_url,
    u.created_at AS user_created_at,
    u.updated_at AS user_updated_at,
    u.intended_redirect AS user_intended_redirect,
    u.onboarding_completed AS user_onboarding_completed
  FROM 
    public.event_guests eg
    LEFT JOIN public.users u ON u.id = eg.user_id
  WHERE 
    eg.event_id = p_event_id
  ORDER BY eg.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_guest_display_name(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_guests_with_display_names(UUID, INTEGER, INTEGER) TO authenticated;
GRANT SELECT ON public.guests_with_display_names TO authenticated;

-- ============================================
-- PERFORMANCE INDEXES
-- ============================================

-- Ensure we have proper indexes for the JOIN operations
-- Index on event_guests.user_id for efficient LEFT JOIN with users table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_guests_user_id 
ON public.event_guests(user_id) 
WHERE user_id IS NOT NULL;

-- Composite index for event-scoped queries with user info
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_guests_event_user 
ON public.event_guests(event_id, user_id);

-- Index on users.id for efficient JOIN (should already exist as PK but ensuring)
-- Note: Primary key indexes are automatic, but documenting for clarity

-- Index on event_guests.event_id for efficient filtering (should already exist)
-- Note: This is likely already indexed but ensuring for performance

-- ============================================
-- RLS POLICIES FOR VIEW
-- ============================================

-- Enable RLS on the view
ALTER VIEW public.guests_with_display_names ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see guests for events they can access
CREATE POLICY "guests_with_display_names_access" ON public.guests_with_display_names
  FOR SELECT USING (
    public.can_access_event(event_id)
  );