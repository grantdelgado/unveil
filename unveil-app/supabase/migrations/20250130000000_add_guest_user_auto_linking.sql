-- Migration: Add Guest-to-User Auto-Linking Trigger
-- Purpose: Automatically link guest records to user accounts when a user signs up with matching phone
-- Date: 2025-01-30

-- =====================================================
-- 1. Guest-to-User Auto-Linking Trigger Function
-- =====================================================

-- Function to link existing guest records to newly created users
CREATE OR REPLACE FUNCTION public.link_guests_to_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  linked_count INTEGER;
BEGIN
  -- Update all guest records with matching phone to include the new user_id
  UPDATE public.event_guests 
  SET user_id = NEW.id,
      updated_at = NOW()
  WHERE phone = NEW.phone 
    AND user_id IS NULL;
  
  -- Get count of linked records for logging
  GET DIAGNOSTICS linked_count = ROW_COUNT;
  
  -- Log the linking operation (useful for debugging and analytics)
  IF linked_count > 0 THEN
    RAISE NOTICE 'Auto-linked % guest records to new user % (phone: %)', 
      linked_count, NEW.id, NEW.phone;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on users table to execute after user creation
CREATE TRIGGER link_guests_on_user_creation
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_guests_to_new_user();

-- =====================================================
-- 2. SMS Rate Limiting Support Table
-- =====================================================

-- Table to track SMS sends for rate limiting
CREATE TABLE public.guest_sms_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  message_type TEXT DEFAULT 'invitation' CHECK (message_type IN ('invitation', 'reminder', 'announcement', 'welcome')),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  twilio_sid TEXT, -- Store Twilio message SID for tracking
  
  -- Index for rate limiting queries
  CONSTRAINT guest_sms_log_phone_format CHECK (phone ~ '^\+[1-9]\d{1,14}$')
);

-- Indexes for efficient rate limiting queries
CREATE INDEX idx_guest_sms_log_phone_sent_at ON public.guest_sms_log(phone, sent_at);
CREATE INDEX idx_guest_sms_log_event_type ON public.guest_sms_log(event_id, message_type);

-- =====================================================
-- 3. Rate Limiting Helper Functions
-- =====================================================

-- Function to check if SMS send is allowed (rate limiting)
CREATE OR REPLACE FUNCTION public.is_sms_send_allowed(
  p_phone TEXT,
  p_cooldown_minutes INTEGER DEFAULT 5,
  p_daily_limit INTEGER DEFAULT 5
)
RETURNS BOOLEAN AS $$
DECLARE
  recent_sends_count INTEGER;
  daily_sends_count INTEGER;
BEGIN
  -- Check cooldown period (last X minutes)
  SELECT COUNT(*) INTO recent_sends_count
  FROM public.guest_sms_log
  WHERE phone = p_phone
    AND sent_at > NOW() - INTERVAL '1 minute' * p_cooldown_minutes
    AND success = true;
  
  -- If recent sends found, deny
  IF recent_sends_count > 0 THEN
    RETURN false;
  END IF;
  
  -- Check daily limit (last 24 hours)
  SELECT COUNT(*) INTO daily_sends_count
  FROM public.guest_sms_log
  WHERE phone = p_phone
    AND sent_at > NOW() - INTERVAL '24 hours'
    AND success = true;
  
  -- Check if under daily limit
  RETURN daily_sends_count < p_daily_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log SMS send attempt
CREATE OR REPLACE FUNCTION public.log_sms_send(
  p_phone TEXT,
  p_event_id UUID,
  p_message_type TEXT DEFAULT 'invitation',
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL,
  p_twilio_sid TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.guest_sms_log (
    phone,
    event_id,
    message_type,
    success,
    error_message,
    twilio_sid
  ) VALUES (
    p_phone,
    p_event_id,
    p_message_type,
    p_success,
    p_error_message,
    p_twilio_sid
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. RLS Policies for SMS Log Table
-- =====================================================

-- Enable RLS on the SMS log table
ALTER TABLE public.guest_sms_log ENABLE ROW LEVEL SECURITY;

-- Policy: Event hosts can view SMS logs for their events
CREATE POLICY "sms_log_host_access" ON public.guest_sms_log
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = guest_sms_log.event_id
      AND is_event_host(e.id)
  )
);

-- Policy: System can insert SMS logs (for server functions)
CREATE POLICY "sms_log_insert_access" ON public.guest_sms_log
FOR INSERT TO authenticated, anon
WITH CHECK (true); -- Allow inserts from SMS functions

-- =====================================================
-- 5. Grant Permissions
-- =====================================================

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION public.link_guests_to_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_sms_send_allowed(TEXT, INTEGER, INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.log_sms_send(TEXT, UUID, TEXT, BOOLEAN, TEXT, TEXT) TO authenticated, anon;

-- =====================================================
-- 6. Comments for Documentation
-- =====================================================

COMMENT ON FUNCTION public.link_guests_to_new_user() IS 'Automatically links guest records to user accounts when a user signs up with matching phone number';
COMMENT ON FUNCTION public.is_sms_send_allowed(TEXT, INTEGER, INTEGER) IS 'Checks if SMS send is allowed based on cooldown and daily limits';
COMMENT ON FUNCTION public.log_sms_send(TEXT, UUID, TEXT, BOOLEAN, TEXT, TEXT) IS 'Logs SMS send attempts for rate limiting and analytics';
COMMENT ON TABLE public.guest_sms_log IS 'Tracks SMS sends for rate limiting and delivery analytics';

-- =====================================================
-- 7. Development/Testing Helpers
-- =====================================================

-- Function to check linking status for a phone number (useful for debugging)
CREATE OR REPLACE FUNCTION public.get_guest_link_status(p_phone TEXT)
RETURNS TABLE (
  guest_id UUID,
  event_id UUID,
  event_title TEXT,
  guest_name TEXT,
  user_id UUID,
  is_linked BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    eg.id as guest_id,
    eg.event_id,
    e.title as event_title,
    eg.guest_name,
    eg.user_id,
    (eg.user_id IS NOT NULL) as is_linked
  FROM public.event_guests eg
  LEFT JOIN public.events e ON e.id = eg.event_id
  WHERE eg.phone = p_phone
  ORDER BY eg.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_guest_link_status(TEXT) TO authenticated;
COMMENT ON FUNCTION public.get_guest_link_status(TEXT) IS 'Development helper to check guest linking status for a phone number';