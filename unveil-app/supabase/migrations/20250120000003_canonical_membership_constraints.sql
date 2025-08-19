-- Canonical membership constraints and indexes
-- Ensures one active membership per (event_id, phone) and optimizes lookups

-- 1. Ensure the partial unique constraint exists (may already exist from earlier migration)
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_guests_event_phone_active
ON public.event_guests(event_id, phone)
WHERE removed_at IS NULL;

-- 2. Add lookup indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_guests_user_active
ON public.event_guests(user_id, event_id) 
WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_guests_event_phone_all
ON public.event_guests(event_id, phone);

-- 3. Add index for removed_at queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_event_guests_removed_at 
ON public.event_guests(removed_at);

-- 4. Comment the constraints for documentation
COMMENT ON INDEX uq_event_guests_event_phone_active IS 
'Ensures only one active guest per phone number per event (canonical membership)';

COMMENT ON INDEX idx_event_guests_user_active IS 
'Optimizes user event membership lookups for active guests only';

COMMENT ON INDEX idx_event_guests_event_phone_all IS 
'Optimizes phone-based lookups across all guest records (active and removed)';

COMMENT ON INDEX idx_event_guests_removed_at IS 
'Optimizes queries filtering by removed_at status';
