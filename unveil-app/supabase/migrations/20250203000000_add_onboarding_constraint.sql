-- Add constraint to ensure onboarding_completed cannot be true without full_name
-- This prevents users from bypassing the full name requirement during setup

BEGIN;

-- First, update any existing users who have onboarding_completed = true but no full_name
-- This ensures the constraint won't fail on existing data
UPDATE public.users 
SET full_name = COALESCE(
  full_name, 
  'User ' || COALESCE(phone, id::text)
)
WHERE onboarding_completed = true 
  AND (full_name IS NULL OR length(trim(full_name)) = 0);

-- Add a check constraint to ensure onboarding cannot be completed without full_name
ALTER TABLE public.users 
ADD CONSTRAINT check_onboarding_requires_full_name 
CHECK (
  (onboarding_completed = false) OR 
  (onboarding_completed = true AND full_name IS NOT NULL AND length(trim(full_name)) > 0)
);

-- Add a comment to document the constraint
COMMENT ON CONSTRAINT check_onboarding_requires_full_name ON public.users IS 
'Ensures that onboarding_completed can only be true when full_name is provided and not empty';

COMMIT;
