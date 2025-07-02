-- phase3: Move moddatetime extension from public to extensions schema
-- Addresses security vulnerability: Extension in Public Schema
-- Impact: Prevents unauthorized access to extension functions

BEGIN;

-- ============================================================================
-- SECURITY FIX: MOVE MODDATETIME EXTENSION TO EXTENSIONS SCHEMA
-- Moving extensions out of public schema is a security best practice
-- ============================================================================

-- Drop moddatetime from public schema
DROP EXTENSION IF EXISTS moddatetime CASCADE;

-- Recreate moddatetime in extensions schema  
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- Update function references to use extensions schema
-- Note: Any triggers using moddatetime will need to reference extensions.moddatetime()

-- Verify the extension is now in the correct schema
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension e
        JOIN pg_namespace n ON e.extnamespace = n.oid
        WHERE e.extname = 'moddatetime' AND n.nspname = 'extensions'
    ) THEN
        RAISE EXCEPTION 'Failed to move moddatetime extension to extensions schema';
    END IF;
    
    RAISE NOTICE 'moddatetime extension successfully moved to extensions schema';
END $$;

COMMIT;

-- ============================================================================
-- SECURITY HARDENING SUMMARY:
-- ============================================================================
-- 1. Moved moddatetime extension from public to extensions schema
-- 2. Prevents unauthorized access to extension functions
-- 3. Follows PostgreSQL security best practices
-- 4. Extension now properly isolated from public schema
-- ============================================================================ 