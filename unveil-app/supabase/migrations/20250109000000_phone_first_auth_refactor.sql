-- Phone-First Authentication Refactor Migration
-- This migration transforms the authentication model to phone-first with per-event roles

-- 1. Update users table for phone-first authentication
-- ================================================

-- First, add the phone column as nullable to allow data migration
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_temp TEXT;

-- Add a temporary phone constraint to validate format during migration
ALTER TABLE public.users ADD CONSTRAINT temp_phone_format 
CHECK (phone_temp IS NULL OR phone_temp ~ '^\+[1-9]\d{1,14}$');

-- Set default phone numbers for existing users (development migration)
-- In production, you would need a more sophisticated migration strategy
UPDATE public.users 
SET phone_temp = '+1555' || LPAD((random() * 9999999)::int::text, 7, '0')
WHERE phone_temp IS NULL;

-- Now make phone NOT NULL and unique
ALTER TABLE public.users ALTER COLUMN phone_temp SET NOT NULL;
ALTER TABLE public.users ADD CONSTRAINT unique_user_phone_temp UNIQUE (phone_temp);

-- Drop the old email unique constraint (email becomes optional)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS unique_user_email;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_key;

-- Drop the email format constraint (email becomes optional)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS email_format;

-- Make email nullable (optional for notifications only)
ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;

-- Remove the global role column (roles are now per-event)
ALTER TABLE public.users DROP COLUMN IF EXISTS role;

-- Rename phone_temp to phone and update constraints
ALTER TABLE public.users RENAME COLUMN phone_temp TO phone;
ALTER TABLE public.users RENAME CONSTRAINT temp_phone_format TO users_phone_format;
ALTER TABLE public.users RENAME CONSTRAINT unique_user_phone_temp TO unique_user_phone;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);

-- 2. Update event_guests table to include role column
-- =================================================

-- Add role column for per-event role assignment
ALTER TABLE public.event_guests ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'guest';

-- Add check constraint for valid roles
ALTER TABLE public.event_guests ADD CONSTRAINT event_guests_role_check 
CHECK (role IN ('host', 'guest', 'admin'));

-- Add invited_at column if it doesn't exist (mentioned in docs but not in current schema)
ALTER TABLE public.event_guests ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing records: set role to 'host' for event creators
UPDATE public.event_guests 
SET role = 'host' 
WHERE user_id IN (
  SELECT host_user_id FROM public.events 
  WHERE events.id = event_guests.event_id
);

-- 3. Update trigger function for new user creation
-- ===============================================

-- Update the trigger function to handle phone-based user creation
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, phone, email, full_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', '+1555' || LPAD((random() * 9999999)::int::text, 7, '0')),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Enhanced RLS helper functions
-- ===============================

-- Enhanced function to check event host role (supports per-event hosts)
CREATE OR REPLACE FUNCTION public.is_event_host(p_event_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.events e
    LEFT JOIN public.event_guests eg ON eg.event_id = e.id AND eg.user_id = auth.uid()
    WHERE e.id = p_event_id 
    AND (e.host_user_id = auth.uid() OR eg.role = 'host')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced function to check event participation
CREATE OR REPLACE FUNCTION public.is_event_participant(p_event_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.events e
    LEFT JOIN public.event_guests eg ON eg.event_id = e.id AND eg.user_id = auth.uid()
    WHERE e.id = p_event_id 
    AND (e.host_user_id = auth.uid() OR eg.user_id = auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user role for specific event
CREATE OR REPLACE FUNCTION public.get_user_event_role(p_event_id UUID)
RETURNS TEXT AS $$
BEGIN
  -- Check if user is the primary host
  IF EXISTS (
    SELECT 1 FROM public.events 
    WHERE id = p_event_id AND host_user_id = auth.uid()
  ) THEN
    RETURN 'host';
  END IF;
  
  -- Check role from event_guests table
  RETURN (
    SELECT eg.role FROM public.event_guests eg
    WHERE eg.event_id = p_event_id AND eg.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all events for a user with their roles
CREATE OR REPLACE FUNCTION public.get_user_events_with_roles()
RETURNS TABLE (
  event_id UUID,
  event_title TEXT,
  event_date DATE,
  event_location TEXT,
  user_role TEXT,
  rsvp_status TEXT,
  is_primary_host BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id as event_id,
    e.title as event_title,
    e.event_date,
    e.location as event_location,
    CASE 
      WHEN e.host_user_id = auth.uid() THEN 'host'
      ELSE COALESCE(eg.role, 'guest')
    END as user_role,
    eg.rsvp_status,
    (e.host_user_id = auth.uid()) as is_primary_host
  FROM public.events e
  LEFT JOIN public.event_guests eg ON eg.event_id = e.id AND eg.user_id = auth.uid()
  WHERE e.host_user_id = auth.uid() OR eg.user_id = auth.uid()
  ORDER BY e.event_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update RLS policies
-- =====================

-- Drop existing user profile policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Event participants can view host profiles" ON public.users;
DROP POLICY IF EXISTS "Event participants can view related profiles" ON public.users;
DROP POLICY IF EXISTS "User profile access policy" ON public.users;

-- Create new user profile policies
CREATE POLICY "Users can view their own profile"
ON public.users FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "Event participants can view related profiles"
ON public.users FOR SELECT TO authenticated
USING (
  id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.events e
    LEFT JOIN public.event_guests eg1 ON eg1.event_id = e.id AND eg1.user_id = auth.uid()
    LEFT JOIN public.event_guests eg2 ON eg2.event_id = e.id AND eg2.user_id = users.id
    WHERE (e.host_user_id = auth.uid() OR eg1.user_id = auth.uid())
    AND (e.host_user_id = users.id OR eg2.user_id = users.id)
  )
);

-- Update events policies to use new functions
DROP POLICY IF EXISTS "Users can view events they are invited to or public ones" ON public.events;

CREATE POLICY "Users can view events they participate in"
ON public.events FOR SELECT TO authenticated
USING (
  is_public = true OR 
  host_user_id = auth.uid() OR 
  is_event_participant(id)
);

-- 6. Grant permissions for new functions
-- ====================================

GRANT EXECUTE ON FUNCTION public.is_event_host(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_participant(UUID) TO authenticated;  
GRANT EXECUTE ON FUNCTION public.get_user_event_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_events_with_roles() TO authenticated;

-- 7. Update indexes for performance
-- ================================

CREATE INDEX IF NOT EXISTS idx_event_guests_role ON public.event_guests(role);
CREATE INDEX IF NOT EXISTS idx_event_guests_user_role ON public.event_guests(user_id, role);
CREATE INDEX IF NOT EXISTS idx_event_guests_event_role ON public.event_guests(event_id, role);

-- 8. Comments for documentation
-- ============================

COMMENT ON COLUMN public.users.phone IS 'Primary identity field - international format phone number';
COMMENT ON COLUMN public.users.email IS 'Optional email for notifications only';
COMMENT ON COLUMN public.event_guests.role IS 'Per-event role assignment: host, guest, or admin';
COMMENT ON FUNCTION public.get_user_event_role(UUID) IS 'Returns the user''s role for a specific event';
COMMENT ON FUNCTION public.get_user_events_with_roles() IS 'Returns all events for the current user with their role in each';

-- 9. Development mode helper function
-- ==================================

-- Function to check if phone number is a development phone (bypasses SMS)
CREATE OR REPLACE FUNCTION public.is_development_phone(p_phone TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN p_phone ~ '^\+1555000[1-3]\d{3}$';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.is_development_phone(TEXT) TO authenticated; 