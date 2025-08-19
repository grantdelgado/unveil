-- Migration: Atomic decline/rejoin RPCs with SMS opt-out integration
-- Purpose: Make decline/rejoin atomic and consistent: declining also opts out of SMS; rejoining re-enables SMS
-- Date: 2025-02-03

-- Update guest_decline_event to be atomic (decline + SMS opt-out)
CREATE OR REPLACE FUNCTION public.guest_decline_event(
  p_event_id uuid,
  p_decline_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_guest_record RECORD;
  v_result JSONB;
BEGIN
  -- Get current user ID
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Find the guest record for this user and event
  SELECT * INTO v_guest_record
  FROM public.event_guests 
  WHERE event_id = p_event_id 
    AND user_id = auth.uid()
    AND role = 'guest';

  -- Check if guest record exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Guest record not found or access denied');
  END IF;

  -- Atomic update: decline + SMS opt-out (idempotent)
  UPDATE public.event_guests 
  SET 
    declined_at = COALESCE(declined_at, NOW()),
    decline_reason = CASE 
      WHEN p_decline_reason IS NOT NULL AND p_decline_reason != '' 
      THEN TRIM(SUBSTRING(p_decline_reason FROM 1 FOR 200))
      ELSE decline_reason 
    END,
    sms_opt_out = TRUE,  -- ATOMIC: declining also opts out of SMS
    updated_at = NOW()
  WHERE id = v_guest_record.id;

  -- Return success with updated values
  RETURN jsonb_build_object(
    'success', true, 
    'declined_at', (SELECT declined_at FROM public.event_guests WHERE id = v_guest_record.id),
    'decline_reason', (SELECT decline_reason FROM public.event_guests WHERE id = v_guest_record.id),
    'sms_opt_out', TRUE
  );
END;
$$;

-- Create new guest_rejoin_event RPC (atomic rejoin + SMS opt-in)
CREATE OR REPLACE FUNCTION public.guest_rejoin_event(
  p_event_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_guest_record RECORD;
BEGIN
  -- Get current user ID
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Find the guest record for this user and event
  SELECT * INTO v_guest_record
  FROM public.event_guests 
  WHERE event_id = p_event_id 
    AND user_id = auth.uid()
    AND role = 'guest';

  -- Check if guest record exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Guest record not found or access denied');
  END IF;

  -- Atomic update: rejoin + SMS opt-in (idempotent)
  UPDATE public.event_guests 
  SET 
    declined_at = NULL,
    decline_reason = NULL,
    sms_opt_out = FALSE,  -- ATOMIC: rejoining re-enables SMS
    updated_at = NOW()
  WHERE id = v_guest_record.id;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'declined_at', NULL,
    'decline_reason', NULL,
    'sms_opt_out', FALSE
  );
END;
$$;

-- Add comments for clarity
COMMENT ON FUNCTION public.guest_decline_event IS 
'Atomic guest decline: sets declined_at = now(), stores reason (optional), and sets sms_opt_out = TRUE. Idempotent operation.';

COMMENT ON FUNCTION public.guest_rejoin_event IS 
'Atomic guest rejoin: clears declined_at and decline_reason, sets sms_opt_out = FALSE. Idempotent operation.';

-- Create derived status helper function for compatibility
CREATE OR REPLACE FUNCTION public.get_guest_rsvp_status(
  p_declined_at timestamptz
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE 
    WHEN p_declined_at IS NOT NULL THEN 'declined'
    ELSE 'attending'
  END;
$$;

COMMENT ON FUNCTION public.get_guest_rsvp_status IS 
'Derives rsvp_status from declined_at field: "declined" when declined_at IS NOT NULL, else "attending".';

-- Create view for derived status (optional compatibility layer)
CREATE OR REPLACE VIEW public.event_guests_with_derived_status AS
SELECT 
  eg.*,
  public.get_guest_rsvp_status(eg.declined_at) as derived_rsvp_status
FROM public.event_guests eg;

COMMENT ON VIEW public.event_guests_with_derived_status IS 
'Compatibility view that adds derived_rsvp_status based on declined_at field.';
