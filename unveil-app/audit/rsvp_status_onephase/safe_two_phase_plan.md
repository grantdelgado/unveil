# Safe Two-Phase RSVP Status Removal Plan

**📅 Date**: September 30, 2025  
**🎯 Goal**: Safely remove `rsvp_status` column with zero downtime  
**📊 Status**: ✅ **READY FOR PHASE 1** - Two-phase approach required  

---

## 🚨 **Why One-Phase Removal is NOT Safe**

### Critical Blocking Issues Found:
1. **`resolve_message_recipients()` RPC** actively uses `rsvp_status` field
2. **UI Components** still read `rsvp_status` for display logic  
3. **Messaging System** passes `rsvpStatuses` that gets converted to `rsvp:` tags

**❌ One-phase removal would cause immediate production failures**

---

## ✅ **Safe Two-Phase Approach**

### **Phase 1: Update Code to Use declined_at Logic** 
*Deploy first, verify working, then proceed to Phase 2*

#### 1.1 Update RPC Function
```sql
-- Update resolve_message_recipients to use declined_at instead of rsvp_status
CREATE OR REPLACE FUNCTION public.resolve_message_recipients(
  msg_event_id uuid, 
  target_guest_ids uuid[] DEFAULT NULL::uuid[], 
  target_tags text[] DEFAULT NULL::text[], 
  require_all_tags boolean DEFAULT false, 
  target_rsvp_statuses text[] DEFAULT NULL::text[], 
  include_declined boolean DEFAULT false
)
RETURNS TABLE(guest_id uuid, phone text, guest_name text, display_name text, can_receive_sms boolean, sms_opt_out boolean, recipient_type text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    eg.id::UUID as guest_id,
    eg.phone::TEXT,
    COALESCE(eg.guest_name, pu.full_name, 'Guest')::TEXT as guest_name,
    COALESCE(eg.display_name, eg.guest_name, pu.full_name, 'Guest')::TEXT as display_name,
    (eg.phone IS NOT NULL AND eg.phone != '')::BOOLEAN as can_receive_sms,
    COALESCE(eg.sms_opt_out, false)::BOOLEAN as sms_opt_out,
    'guest'::TEXT as recipient_type
  FROM event_guests eg
  LEFT JOIN public.users pu ON eg.user_id = pu.id
  WHERE 
    eg.event_id = msg_event_id
    AND eg.phone IS NOT NULL
    AND eg.phone != ''
    -- Use declined_at instead of rsvp_status
    AND (include_declined = TRUE OR eg.declined_at IS NULL)
    AND (target_guest_ids IS NULL OR eg.id = ANY(target_guest_ids))
    -- Convert rsvp_status logic to declined_at logic
    AND (
      target_rsvp_statuses IS NULL 
      OR (
        ('attending' = ANY(target_rsvp_statuses) AND eg.declined_at IS NULL)
        OR ('declined' = ANY(target_rsvp_statuses) AND eg.declined_at IS NOT NULL)
        -- Handle legacy statuses by mapping to declined_at
        OR ('pending' = ANY(target_rsvp_statuses) AND eg.declined_at IS NULL)
        OR ('maybe' = ANY(target_rsvp_statuses) AND eg.declined_at IS NULL)
      )
    )
    AND (
      target_tags IS NULL 
      OR (
        require_all_tags = FALSE AND guest_has_any_tags(eg.id, target_tags)
      )
      OR (
        require_all_tags = TRUE AND guest_has_all_tags(eg.id, target_tags)
      )
    )
  ORDER BY display_name, guest_id;
END;
$function$;
```

#### 1.2 Update UI Components
- **StatusChip.tsx**: Use `declined_at` instead of `rsvp_status`
- **GuestEventHome**: Use `declined_at` for CTA resolution
- **GuestListItem**: Remove `rsvp_status` reference
- **RecipientPreview**: Use `declined_at` for status calculation

#### 1.3 Update Types
- Mark `rsvp_status` as deprecated in TypeScript types
- Update constants to be deprecated

#### 1.4 Add Tests
- Test that messaging works with new RPC function
- Test UI components work with `declined_at` logic
- Test audience counts remain consistent

### **Phase 2: Remove Column** 
*Only after Phase 1 is deployed and verified working*

#### 2.1 Atomic Migration
```sql
BEGIN;

-- Safety: Ensure required indexes exist
CREATE INDEX IF NOT EXISTS event_guests_event_idx
  ON public.event_guests (event_id);

CREATE INDEX IF NOT EXISTS event_guests_event_attending_idx
  ON public.event_guests (event_id)
  WHERE declined_at IS NULL;

-- Drop the legacy column
ALTER TABLE public.event_guests
  DROP COLUMN IF EXISTS rsvp_status;

-- Analyst compat view
CREATE OR REPLACE VIEW public.event_guests_rsvp_compat AS
SELECT
  eg.*,
  (CASE WHEN eg.declined_at IS NULL THEN 'ATTENDING' ELSE 'DECLINED' END)::text as rsvp_status_compat
FROM public.event_guests eg;

COMMIT;
```

#### 2.2 Rollback Migration
```sql
BEGIN;

-- Re-add column
ALTER TABLE public.event_guests ADD COLUMN rsvp_status text;

-- Backfill from declined_at
UPDATE public.event_guests eg
SET rsvp_status = CASE WHEN eg.declined_at IS NULL THEN 'ATTENDING' ELSE 'DECLINED' END;

-- Drop compat view
DROP VIEW IF EXISTS public.event_guests_rsvp_compat;

COMMIT;
```

#### 2.3 CI Guard
```bash
# Add to CI pipeline
if grep -r '\brsvp_status\b' app/ components/ hooks/ lib/ --exclude-dir=node_modules; then
  echo "❌ Found rsvp_status references. Use declined_at instead."
  exit 1
fi
```

---

## 🧪 **Testing Strategy**

### Phase 1 Tests
1. **RPC Function Parity**:
   ```sql
   -- Test that new RPC returns same results as old RPC
   SELECT * FROM resolve_message_recipients('event-id', null, null, false, ARRAY['attending'], false);
   ```

2. **UI Component Tests**:
   - Guest status chips show correct attending/declined states
   - Message recipient preview works correctly
   - Host dashboard counts are consistent

3. **Integration Tests**:
   - End-to-end messaging flow works
   - RSVP decline flow works
   - Audience selection works in message composer

### Phase 2 Tests
1. **Migration Tests**:
   - Up migration runs cleanly
   - Down migration restores data correctly
   - Compat view provides expected data

2. **Production Verification**:
   - All existing functionality works
   - No references to dropped column
   - Analytics queries work with compat view

---

## 📊 **Risk Assessment**

### Phase 1 Risks: **LOW**
- ✅ No schema changes
- ✅ Backward compatible
- ✅ Can rollback by reverting code

### Phase 2 Risks: **MEDIUM**
- ⚠️ Schema change (but with rollback migration)
- ⚠️ Requires verification that Phase 1 is working
- ✅ Atomic migration with instant rollback available

---

## 🎯 **Implementation Order**

1. **Create Phase 1 PR**:
   - Update RPC function
   - Update UI components  
   - Add tests
   - Deploy and verify

2. **Wait 24-48 hours** for stability verification

3. **Create Phase 2 PR**:
   - Add migration files
   - Add CI guard
   - Update documentation
   - Deploy migration

4. **Monitor for 24 hours** post-Phase 2

5. **Clean up**:
   - Remove deprecated type annotations
   - Update documentation

---

## 📋 **Acceptance Criteria**

### Phase 1 Complete When:
- ✅ All UI components use `declined_at` logic
- ✅ RPC function uses `declined_at` instead of `rsvp_status`
- ✅ Tests pass
- ✅ Production messaging works correctly
- ✅ No functionality regressions

### Phase 2 Complete When:
- ✅ `rsvp_status` column removed
- ✅ Compat view available for analysts
- ✅ CI guard prevents future usage
- ✅ Documentation updated
- ✅ Zero production issues

This approach ensures **zero downtime** and **safe rollback** at every step.
