-- ============================================================================
-- STANDARDIZE SMS TAG CONSTRAINTS TO 20 CHARACTERS
-- ============================================================================
-- 
-- INTENT: Align database constraint with UI validation at 20 characters max
-- SAFETY: Expanding constraint from 14→20 chars (non-breaking change)
-- DATA: Current max tag length is 13 chars, 0 NULL tags (verified via MCP)
--
-- ROLLBACK: 
-- ALTER TABLE events DROP CONSTRAINT events_sms_tag_20_char;
-- ALTER TABLE events ADD CONSTRAINT events_sms_tag_len 
--   CHECK (sms_tag IS NULL OR char_length(sms_tag) <= 14);
-- ============================================================================

BEGIN;

-- Drop existing 14-character constraint
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_sms_tag_len;

-- Add new 20-character constraint with minimum length validation
ALTER TABLE events ADD CONSTRAINT events_sms_tag_20_char 
  CHECK (
    sms_tag IS NULL OR 
    (char_length(sms_tag) >= 1 AND char_length(sms_tag) <= 20)
  );

-- Add comment for documentation
COMMENT ON CONSTRAINT events_sms_tag_20_char ON events IS 
  'SMS tag must be 1-20 characters when provided. Standardized for UI/server alignment.';

COMMIT;

-- Verification query (should return 0 violations)
-- SELECT COUNT(*) as violations 
-- FROM events 
-- WHERE sms_tag IS NOT NULL AND (char_length(sms_tag) < 1 OR char_length(sms_tag) > 20);
