-- Auto-link user_id by phone across tables (event-scoped, safe, idempotent)
-- Migration: 20250129000000_auto_link_user_by_phone.sql

-- ============================================================================
-- FEATURE FLAG AND NORMALIZATION
-- ============================================================================

-- Feature flag to control the auto-linking system
CREATE OR REPLACE FUNCTION get_feature_flag(flag_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    -- For now, we'll use a simple approach. In production, this could read from a config table
    CASE flag_name
        WHEN 'LINK_USER_BY_PHONE' THEN RETURN true;
        ELSE RETURN false;
    END CASE;
END;
$$;

-- Phone normalization function (already E.164, but ensure consistency)
CREATE OR REPLACE FUNCTION normalize_phone(phone_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF phone_input IS NULL OR phone_input = '' THEN
        RETURN NULL;
    END IF;
    
    -- Remove all non-digit characters except +
    phone_input := regexp_replace(phone_input, '[^\+0-9]', '', 'g');
    
    -- If it doesn't start with +, assume US number and add +1
    IF NOT phone_input ~ '^\+' THEN
        IF length(phone_input) = 10 THEN
            phone_input := '+1' || phone_input;
        ELSIF length(phone_input) = 11 AND phone_input ~ '^1' THEN
            phone_input := '+' || phone_input;
        END IF;
    END IF;
    
    -- Validate E.164 format
    IF phone_input ~ '^\+[1-9]\d{1,14}$' THEN
        RETURN phone_input;
    ELSE
        RETURN NULL;
    END IF;
END;
$$;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE user_link_outcome_enum AS ENUM ('linked', 'no_match', 'ambiguous', 'skipped');

-- ============================================================================
-- CENTRAL LINKING FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION link_user_by_phone(
    p_event_id uuid,
    p_normalized_phone text
)
RETURNS TABLE(
    user_id uuid,
    guest_id uuid,
    outcome user_link_outcome_enum
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_guest_record RECORD;
    v_guest_count INTEGER;
    v_user_count INTEGER;
    v_result_user_id uuid;
    v_result_guest_id uuid;
    v_result_outcome user_link_outcome_enum;
BEGIN
    -- Check feature flag
    IF NOT public.get_feature_flag('LINK_USER_BY_PHONE') THEN
        RETURN QUERY SELECT NULL::uuid, NULL::uuid, 'skipped'::user_link_outcome_enum;
        RETURN;
    END IF;
    
    -- Validate inputs
    IF p_event_id IS NULL OR p_normalized_phone IS NULL THEN
        RETURN QUERY SELECT NULL::uuid, NULL::uuid, 'no_match'::user_link_outcome_enum;
        RETURN;
    END IF;
    
    -- Find active event guests with this phone number
    SELECT COUNT(*) INTO v_guest_count
    FROM public.event_guests 
    WHERE event_id = p_event_id 
      AND phone = p_normalized_phone 
      AND removed_at IS NULL;
    
    -- If no guests or multiple guests, skip
    IF v_guest_count = 0 THEN
        RETURN QUERY SELECT NULL::uuid, NULL::uuid, 'no_match'::user_link_outcome_enum;
        RETURN;
    ELSIF v_guest_count > 1 THEN
        RETURN QUERY SELECT NULL::uuid, NULL::uuid, 'ambiguous'::user_link_outcome_enum;
        RETURN;
    END IF;
    
    -- Get the single matching guest
    SELECT * INTO v_guest_record
    FROM public.event_guests 
    WHERE event_id = p_event_id 
      AND phone = p_normalized_phone 
      AND removed_at IS NULL;
    
    v_result_guest_id := v_guest_record.id;
    
    -- Preferred source of truth for user_id:
    -- 1. event_guests.user_id if NOT NULL
    IF v_guest_record.user_id IS NOT NULL THEN
        v_result_user_id := v_guest_record.user_id;
        v_result_outcome := 'linked'::user_link_outcome_enum;
    ELSE
        -- 2. Single verified user matching that phone
        SELECT COUNT(*) INTO v_user_count
        FROM public.users 
        WHERE phone = p_normalized_phone;
        
        IF v_user_count = 1 THEN
            SELECT id INTO v_result_user_id
            FROM public.users 
            WHERE phone = p_normalized_phone;
            v_result_outcome := 'linked'::user_link_outcome_enum;
        ELSIF v_user_count = 0 THEN
            v_result_outcome := 'no_match'::user_link_outcome_enum;
        ELSE
            v_result_outcome := 'ambiguous'::user_link_outcome_enum;
        END IF;
    END IF;
    
    RETURN QUERY SELECT v_result_user_id, v_result_guest_id, v_result_outcome;
END;
$$;

-- ============================================================================
-- TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_link_user_by_phone_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_event_id uuid;
    v_normalized_phone text;
    v_link_result RECORD;
    v_table_name text;
    v_record_id uuid;
BEGIN
    -- Get table name
    v_table_name := TG_TABLE_NAME;
    
    -- Skip if user_id is already set
    IF NEW.user_id IS NOT NULL THEN
        RETURN NEW;
    END IF;
    
    -- Extract event_id and phone based on table
    CASE v_table_name
        WHEN 'message_deliveries' THEN
            -- Get event_id through guest_id
            IF NEW.guest_id IS NOT NULL THEN
                SELECT eg.event_id INTO v_event_id
                FROM public.event_guests eg
                WHERE eg.id = NEW.guest_id;
            END IF;
            v_normalized_phone := public.normalize_phone(NEW.phone_number);
            v_record_id := NEW.id;
        ELSE
            -- Skip unknown tables
            RETURN NEW;
    END CASE;
    
    -- Skip if we couldn't determine event_id or phone
    IF v_event_id IS NULL OR v_normalized_phone IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Call central linking function
    SELECT * INTO v_link_result
    FROM public.link_user_by_phone(v_event_id, v_normalized_phone);
    
    -- Update NEW record if we got a user_id
    IF v_link_result.user_id IS NOT NULL THEN
        NEW.user_id := v_link_result.user_id;
    END IF;
    
    -- Log to audit table
    INSERT INTO public.user_link_audit (
        table_name,
        record_id,
        event_id,
        normalized_phone,
        matched_guest_id,
        linked_user_id,
        outcome
    ) VALUES (
        v_table_name,
        v_record_id,
        v_event_id,
        v_normalized_phone,
        v_link_result.guest_id,
        v_link_result.user_id,
        v_link_result.outcome
    );
    
    RETURN NEW;
END;
$$;

-- ============================================================================
-- AUDIT TABLE
-- ============================================================================

CREATE TABLE user_link_audit (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name text NOT NULL,
    record_id uuid NOT NULL,
    event_id uuid NOT NULL,
    normalized_phone text NOT NULL,
    matched_guest_id uuid,
    linked_user_id uuid,
    outcome user_link_outcome_enum NOT NULL,
    created_at timestamptz DEFAULT now(),
    
    -- Foreign keys
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (matched_guest_id) REFERENCES event_guests(id) ON DELETE SET NULL,
    FOREIGN KEY (linked_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Index for audit queries
CREATE INDEX idx_user_link_audit_table_outcome ON user_link_audit(table_name, outcome);
CREATE INDEX idx_user_link_audit_event_phone ON user_link_audit(event_id, normalized_phone);
CREATE INDEX idx_user_link_audit_created_at ON user_link_audit(created_at);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- message_deliveries trigger
DROP TRIGGER IF EXISTS trigger_message_deliveries_auto_link_user ON message_deliveries;
CREATE TRIGGER trigger_message_deliveries_auto_link_user
    BEFORE INSERT OR UPDATE ON message_deliveries
    FOR EACH ROW
    EXECUTE FUNCTION auto_link_user_by_phone_trigger();

-- ============================================================================
-- BACKFILL RPC FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION backfill_user_links(
    p_table_name text DEFAULT 'message_deliveries',
    p_batch_size integer DEFAULT 100,
    p_dry_run boolean DEFAULT true
)
RETURNS TABLE(
    processed_count integer,
    linked_count integer,
    no_match_count integer,
    ambiguous_count integer,
    skipped_count integer,
    sample_results jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_processed_count integer := 0;
    v_linked_count integer := 0;
    v_no_match_count integer := 0;
    v_ambiguous_count integer := 0;
    v_skipped_count integer := 0;
    v_sample_results jsonb := '[]'::jsonb;
    v_record RECORD;
    v_link_result RECORD;
    v_event_id uuid;
    v_normalized_phone text;
    v_sample_count integer := 0;
BEGIN
    -- Only support message_deliveries for now
    IF p_table_name != 'message_deliveries' THEN
        RAISE EXCEPTION 'Unsupported table: %', p_table_name;
    END IF;
    
    -- Process records in batches
    FOR v_record IN 
        SELECT md.id, md.phone_number, md.user_id, md.guest_id, eg.event_id
        FROM public.message_deliveries md
        LEFT JOIN public.event_guests eg ON md.guest_id = eg.id
        WHERE md.user_id IS NULL 
          AND md.phone_number IS NOT NULL
          AND eg.event_id IS NOT NULL
        LIMIT p_batch_size
    LOOP
        v_processed_count := v_processed_count + 1;
        v_event_id := v_record.event_id;
        v_normalized_phone := public.normalize_phone(v_record.phone_number);
        
        -- Skip if phone couldn't be normalized
        IF v_normalized_phone IS NULL THEN
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END IF;
        
        -- Call linking function
        SELECT * INTO v_link_result
        FROM public.link_user_by_phone(v_event_id, v_normalized_phone);
        
        -- Count outcomes
        CASE v_link_result.outcome
            WHEN 'linked' THEN 
                v_linked_count := v_linked_count + 1;
                -- Actually update the record if not dry run
                IF NOT p_dry_run THEN
                    UPDATE public.message_deliveries 
                    SET user_id = v_link_result.user_id 
                    WHERE id = v_record.id;
                END IF;
            WHEN 'no_match' THEN v_no_match_count := v_no_match_count + 1;
            WHEN 'ambiguous' THEN v_ambiguous_count := v_ambiguous_count + 1;
            WHEN 'skipped' THEN v_skipped_count := v_skipped_count + 1;
        END CASE;
        
        -- Log to audit table (even for dry runs)
        INSERT INTO public.user_link_audit (
            table_name,
            record_id,
            event_id,
            normalized_phone,
            matched_guest_id,
            linked_user_id,
            outcome
        ) VALUES (
            p_table_name,
            v_record.id,
            v_event_id,
            v_normalized_phone,
            v_link_result.guest_id,
            v_link_result.user_id,
            v_link_result.outcome
        );
        
        -- Collect sample results (first 5)
        IF v_sample_count < 5 THEN
            v_sample_results := v_sample_results || jsonb_build_object(
                'record_id', v_record.id,
                'phone', v_normalized_phone,
                'outcome', v_link_result.outcome,
                'linked_user_id', v_link_result.user_id
            );
            v_sample_count := v_sample_count + 1;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT 
        v_processed_count,
        v_linked_count,
        v_no_match_count,
        v_ambiguous_count,
        v_skipped_count,
        v_sample_results;
END;
$$;

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Ensure we have the indexes we need for fast lookups
-- (Most already exist, but let's be explicit)

-- Index for message_deliveries phone lookups
CREATE INDEX IF NOT EXISTS idx_message_deliveries_phone_user_null 
ON message_deliveries(phone_number) 
WHERE user_id IS NULL AND phone_number IS NOT NULL;

-- Index for event_guests phone lookups (already exists as unique constraint)
-- CREATE UNIQUE INDEX event_guests_event_id_phone_active_key ON event_guests(event_id, phone) WHERE removed_at IS NULL;

-- ============================================================================
-- RLS POLICIES FOR AUDIT TABLE
-- ============================================================================

ALTER TABLE user_link_audit ENABLE ROW LEVEL SECURITY;

-- Only hosts can view audit records for their events
CREATE POLICY user_link_audit_host_access ON user_link_audit
FOR SELECT USING (public.is_event_host(event_id));

-- ============================================================================
-- UTILITY FUNCTIONS FOR ROLLBACK
-- ============================================================================

-- Function to rollback recent links (for emergency use)
CREATE OR REPLACE FUNCTION rollback_user_links(
    p_since_timestamp timestamptz,
    p_table_name text DEFAULT 'message_deliveries',
    p_dry_run boolean DEFAULT true
)
RETURNS TABLE(
    rolled_back_count integer,
    sample_records jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_rolled_back_count integer := 0;
    v_sample_records jsonb := '[]'::jsonb;
    v_audit_record RECORD;
    v_sample_count integer := 0;
BEGIN
    -- Only support message_deliveries for now
    IF p_table_name != 'message_deliveries' THEN
        RAISE EXCEPTION 'Unsupported table: %', p_table_name;
    END IF;
    
    -- Find audit records to rollback
    FOR v_audit_record IN
        SELECT record_id, linked_user_id
        FROM public.user_link_audit
        WHERE table_name = p_table_name
          AND outcome = 'linked'
          AND created_at >= p_since_timestamp
          AND linked_user_id IS NOT NULL
    LOOP
        v_rolled_back_count := v_rolled_back_count + 1;
        
        -- Actually rollback if not dry run
        IF NOT p_dry_run THEN
            UPDATE public.message_deliveries
            SET user_id = NULL
            WHERE id = v_audit_record.record_id
              AND user_id = v_audit_record.linked_user_id;
        END IF;
        
        -- Collect sample
        IF v_sample_count < 5 THEN
            v_sample_records := v_sample_records || jsonb_build_object(
                'record_id', v_audit_record.record_id,
                'user_id_to_clear', v_audit_record.linked_user_id
            );
            v_sample_count := v_sample_count + 1;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT v_rolled_back_count, v_sample_records;
END;
$$;

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION link_user_by_phone(uuid, text) IS 
'Central function to find user_id for a given (event_id, phone) combination. Returns user_id from event_guests if available, otherwise from users table if unambiguous match exists.';

COMMENT ON FUNCTION auto_link_user_by_phone_trigger() IS 
'Trigger function that automatically populates user_id on INSERT/UPDATE when user_id is NULL but phone is available. Event-scoped and safe.';

COMMENT ON FUNCTION backfill_user_links(text, integer, boolean) IS 
'Backfill existing records with user_id links. Use dry_run=true for testing. Returns summary statistics and sample results.';

COMMENT ON FUNCTION rollback_user_links(timestamptz, text, boolean) IS 
'Emergency rollback function to clear user_id links created after a specific timestamp. Use dry_run=true for testing.';

COMMENT ON TABLE user_link_audit IS 
'Audit table tracking all user_id linking operations across tables. Provides full traceability and rollback capability.';
