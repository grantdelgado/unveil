-- Add onboarding and redirect fields to users table
-- This fixes the mismatch between TypeScript types and database schema

BEGIN;

-- Add onboarding_completed field
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Add intended_redirect field for post-auth routing
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS intended_redirect TEXT;

-- Set existing users as having completed onboarding (if any exist)
-- This prevents existing users from being forced through setup again
UPDATE public.users 
SET onboarding_completed = true 
WHERE onboarding_completed IS NULL;

-- Add index for performance on onboarding queries
CREATE INDEX IF NOT EXISTS idx_users_onboarding_completed 
ON public.users(onboarding_completed);

COMMIT; 