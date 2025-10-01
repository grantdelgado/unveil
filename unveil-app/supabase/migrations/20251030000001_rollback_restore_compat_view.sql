-- ROLLBACK Migration: Restore RSVP Compatibility View
-- Purpose: Emergency restore if compat view removal causes issues
-- Date: 2025-10-30
-- Usage: Run this if analytics queries break after compat view removal

BEGIN;

-- Recreate the compatibility view with original definition
CREATE OR REPLACE VIEW public.event_guests_rsvp_compat AS
SELECT
  eg.*,
  -- Provide rsvp_status_compat for legacy analytics queries
  (CASE 
    WHEN eg.declined_at IS NULL THEN 'ATTENDING' 
    ELSE 'DECLINED' 
  END)::text as rsvp_status_compat,
  -- Additional computed fields for analytics
  (eg.declined_at IS NULL)::boolean as is_attending,
  (eg.declined_at IS NOT NULL)::boolean as is_declined
FROM public.event_guests eg
WHERE eg.removed_at IS NULL; -- Only include active guests

-- Restore helpful comment for analysts
COMMENT ON VIEW public.event_guests_rsvp_compat IS 
'Compatibility view for analytics. Use rsvp_status_compat instead of rsvp_status. 
ATTENDING = declined_at IS NULL, DECLINED = declined_at IS NOT NULL.
RESTORED after removal on 2025-10-30 due to compatibility issues.';

-- Grant appropriate permissions to the view
GRANT SELECT ON public.event_guests_rsvp_compat TO authenticated;

-- Log the restoration
INSERT INTO public.migration_log (
  migration_name,
  description,
  applied_at,
  applied_by
) VALUES (
  'rollback_restore_compat_view',
  'ROLLBACK: Restored event_guests_rsvp_compat view due to compatibility issues',
  NOW(),
  'system'
) ON CONFLICT DO NOTHING;

COMMIT;
