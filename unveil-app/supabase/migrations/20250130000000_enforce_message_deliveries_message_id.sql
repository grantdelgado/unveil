-- ============================================================================
-- Migration: Enforce NOT NULL constraint on message_deliveries.message_id
-- ============================================================================
-- 
-- This migration enforces that all message_deliveries must be linked to a
-- messages record, preventing orphaned delivery records.
--
-- Prerequisites:
-- 1. Run backfill script to fix existing orphaned deliveries
-- 2. Deploy code changes that ensure message records are created before deliveries
--
-- Safety: This will fail if any NULL message_id values still exist

-- First, verify no orphaned deliveries remain
DO $$
DECLARE
    orphan_count integer;
BEGIN
    SELECT COUNT(*) INTO orphan_count 
    FROM message_deliveries 
    WHERE message_id IS NULL;
    
    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'Cannot add NOT NULL constraint: % orphaned deliveries still exist. Run backfill script first.', orphan_count;
    END IF;
    
    RAISE NOTICE 'Verified: No orphaned deliveries found. Safe to proceed.';
END $$;

-- Add NOT NULL constraint to message_id column
ALTER TABLE public.message_deliveries 
    ALTER COLUMN message_id SET NOT NULL;

-- Update the foreign key constraint to be deferrable initially deferred
-- This allows same-transaction creation of messages and deliveries
ALTER TABLE public.message_deliveries 
    DROP CONSTRAINT IF EXISTS message_deliveries_message_id_fkey;

ALTER TABLE public.message_deliveries 
    ADD CONSTRAINT message_deliveries_message_id_fkey 
    FOREIGN KEY (message_id) 
    REFERENCES public.messages(id) 
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED;

-- Add a comment explaining the constraint
COMMENT ON CONSTRAINT message_deliveries_message_id_fkey ON public.message_deliveries IS 
'Deferrable FK constraint allows same-transaction creation of messages and deliveries while preventing orphaned delivery records';

-- Create index for better performance on the FK
CREATE INDEX IF NOT EXISTS idx_message_deliveries_message_id 
    ON public.message_deliveries(message_id);

-- Verify the constraint is in place
DO $$
DECLARE
    constraint_info record;
BEGIN
    SELECT 
        tc.constraint_name,
        tc.is_deferrable,
        tc.initially_deferred
    INTO constraint_info
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'message_deliveries' 
        AND tc.constraint_name = 'message_deliveries_message_id_fkey';
    
    IF constraint_info.constraint_name IS NULL THEN
        RAISE EXCEPTION 'Foreign key constraint was not created successfully';
    END IF;
    
    RAISE NOTICE 'Successfully created deferrable FK constraint: % (deferrable: %, initially_deferred: %)', 
        constraint_info.constraint_name,
        constraint_info.is_deferrable,
        constraint_info.initially_deferred;
END $$;
