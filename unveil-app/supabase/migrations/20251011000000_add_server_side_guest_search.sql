-- Migration: Add server-side guest search capability
-- Replaces get_event_guests_with_display_names with search-aware version
-- Maintains backward compatibility and existing RLS security

-- ============================================
-- SEARCH-AWARE GUEST FUNCTION
-- ============================================

-- Drop existing function to replace with search-aware version
DROP FUNCTION IF EXISTS public.get_event_guests_with_display_names(UUID, INTEGER, INTEGER);

-- Create new search-aware function with same security model
CREATE OR REPLACE FUNCTION public.get_event_guests_with_display_names(
  p_event_id UUID,
  p_search_term TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  event_id UUID, 
  user_id UUID,
  guest_name TEXT,
  phone TEXT,
  rsvp_status TEXT,
  notes TEXT,
  guest_tags TEXT[],
  role TEXT,
  invited_at TIMESTAMP WITH TIME ZONE,
  last_invited_at TIMESTAMP WITH TIME ZONE,
  first_invited_at TIMESTAMP WITH TIME ZONE,
  last_messaged_at TIMESTAMP WITH TIME ZONE,
  invite_attempts INTEGER,
  joined_at TIMESTAMP WITH TIME ZONE,
  declined_at TIMESTAMP WITH TIME ZONE,
  decline_reason TEXT,
  removed_at TIMESTAMP WITH TIME ZONE,
  phone_number_verified BOOLEAN,
  sms_opt_out BOOLEAN,
  preferred_communication TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  guest_display_name TEXT,
  user_full_name TEXT,
  user_phone TEXT,
  user_avatar_url TEXT,
  user_created_at TIMESTAMP WITH TIME ZONE,
  user_updated_at TIMESTAMP WITH TIME ZONE,
  user_intended_redirect TEXT,
  user_onboarding_completed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH base_guests AS (
    SELECT 
      eg.id,
      eg.event_id,
      eg.user_id,
      eg.guest_name::text,
      eg.phone::text,
      eg.rsvp_status::text,
      eg.notes::text,
      eg.guest_tags,
      eg.role::text,
      eg.invited_at,
      eg.last_invited_at,
      eg.first_invited_at,
      eg.last_messaged_at,
      eg.invite_attempts,
      eg.joined_at,
      eg.declined_at,
      eg.decline_reason::text,
      eg.removed_at,
      eg.phone_number_verified,
      eg.sms_opt_out,
      eg.preferred_communication::text,
      eg.created_at,
      eg.updated_at,
      COALESCE(u.full_name, eg.guest_name, 'Unnamed Guest')::text AS guest_display_name,
      u.full_name::text AS user_full_name,
      u.phone::text AS user_phone,
      u.avatar_url::text AS user_avatar_url,
      u.created_at AS user_created_at,
      u.updated_at AS user_updated_at,
      u.intended_redirect::text AS user_intended_redirect,
      u.onboarding_completed AS user_onboarding_completed
    FROM 
      public.event_guests eg
      LEFT JOIN public.users u ON u.id = eg.user_id
    WHERE 
      eg.event_id = p_event_id
      AND eg.removed_at IS NULL  -- Exclude soft-deleted guests
  ),
  filtered_guests AS (
    SELECT * FROM base_guests
    WHERE 
      -- Apply search filter only if search term is provided and not empty
      p_search_term IS NULL 
      OR p_search_term = '' 
      OR (
        LOWER(guest_display_name) LIKE '%' || LOWER(p_search_term) || '%' OR
        LOWER(COALESCE(guest_name, '')) LIKE '%' || LOWER(p_search_term) || '%' OR
        LOWER(COALESCE(phone, '')) LIKE '%' || LOWER(p_search_term) || '%' OR
        LOWER(COALESCE(user_full_name, '')) LIKE '%' || LOWER(p_search_term) || '%'
      )
  )
  SELECT 
    fg.id,
    fg.event_id,
    fg.user_id,
    fg.guest_name,
    fg.phone,
    fg.rsvp_status,
    fg.notes,
    fg.guest_tags,
    fg.role,
    fg.invited_at,
    fg.last_invited_at,
    fg.first_invited_at,
    fg.last_messaged_at,
    fg.invite_attempts,
    fg.joined_at,
    fg.declined_at,
    fg.decline_reason,
    fg.removed_at,
    fg.phone_number_verified,
    fg.sms_opt_out,
    fg.preferred_communication,
    fg.created_at,
    fg.updated_at,
    fg.guest_display_name,
    fg.user_full_name,
    fg.user_phone,
    fg.user_avatar_url,
    fg.user_created_at,
    fg.user_updated_at,
    fg.user_intended_redirect,
    fg.user_onboarding_completed
  FROM filtered_guests fg
  ORDER BY 
    -- Alphabetical ordering by display name (case-insensitive)
    -- Hosts appear first, then guests alphabetically
    CASE WHEN fg.role = 'host' THEN 0 ELSE 1 END,
    LOWER(fg.guest_display_name) ASC,
    fg.id ASC  -- Stable sort tiebreaker for identical names
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Update function comment to reflect search capability
COMMENT ON FUNCTION public.get_event_guests_with_display_names(UUID, TEXT, INTEGER, INTEGER) IS 
'Returns event guests with computed display names in alphabetical order. Supports server-side search across display name, guest name, phone, and user full name. Hosts appear first, followed by guests sorted alphabetically. Maintains existing RLS security model.';

-- ============================================
-- PERFORMANCE INDEXES
-- ============================================

-- Index for event + display name searches (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_event_guests_search_display 
ON public.event_guests (event_id, LOWER(guest_name)) 
WHERE removed_at IS NULL;

-- Index for event + phone searches
CREATE INDEX IF NOT EXISTS idx_event_guests_search_phone 
ON public.event_guests (event_id, phone) 
WHERE removed_at IS NULL;

-- Compound index for users.full_name searches (for linked guests)
CREATE INDEX IF NOT EXISTS idx_users_full_name_search 
ON public.users (LOWER(full_name)) 
WHERE full_name IS NOT NULL;

-- Optional: Trigram index for fuzzy search (if pg_trgm extension is available)
-- This is wrapped in a DO block to handle cases where pg_trgm is not available
DO $$
BEGIN
  -- Check if pg_trgm extension exists
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    -- Create trigram index for better fuzzy search performance
    CREATE INDEX IF NOT EXISTS idx_event_guests_display_trgm 
    ON public.event_guests USING gin (LOWER(guest_name) gin_trgm_ops)
    WHERE removed_at IS NULL;
    
    RAISE NOTICE 'Created trigram index for fuzzy search performance';
  ELSE
    RAISE NOTICE 'pg_trgm extension not available, skipping trigram index';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not create trigram index: %', SQLERRM;
END;
$$;

-- ============================================
-- SECURITY & PERMISSIONS
-- ============================================

-- Grant execute permission to authenticated users (maintains existing security model)
GRANT EXECUTE ON FUNCTION public.get_event_guests_with_display_names(UUID, TEXT, INTEGER, INTEGER) TO authenticated;

-- ============================================
-- MIGRATION VERIFICATION
-- ============================================

-- Log the migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 20251011000000_add_server_side_guest_search completed successfully';
  RAISE NOTICE 'Added server-side search capability to get_event_guests_with_display_names function';
  RAISE NOTICE 'Created performance indexes for search operations';
  RAISE NOTICE 'Maintained existing RLS security model and permissions';
  RAISE NOTICE 'Function now supports p_search_term parameter for server-side filtering';
END;
$$;
