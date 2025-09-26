# Database & RLS Safety Audit
*Generated: September 26, 2025*
*Analysis Type: MCP introspection, no schema changes*

## RLS Enforcement Status

### Core Tables Security
```sql
Table               | RLS Enabled | Force RLS 
--------------------|-------------|----------
event_guests        | ✅ true     | ✅ true   
events              | ✅ true     | ❌ false  
media               | ✅ true     | ❌ false  
message_deliveries  | ✅ true     | ✅ true   
messages            | ✅ true     | ✅ true   
users               | ✅ true     | ❌ false  
```

**✅ Excellent**: All core tables have RLS enabled
**⚠️  Note**: `events`, `media`, `users` tables allow SECURITY DEFINER bypass (force_rls=false)

### Critical Tables with Force RLS
- **event_guests**: Fully secure - no bypass allowed
- **message_deliveries**: Fully secure - critical for privacy
- **messages**: Fully secure - contains message content

## RLS Policy Analysis

### Event Access Control
**Core Functions Used**:
- `is_event_host(event_id)` - Host permission check
- `is_event_guest(event_id)` - Guest membership check  
- `can_access_event(event_id)` - Combined access check

**Policy Patterns**:
```sql
-- Standard host/guest access pattern
(is_event_host(event_id) OR is_event_guest(event_id))

-- Unified event access  
can_access_event(event_id)
```

### Guest Management Security
**event_guests table** (7 policies):
- ✅ **SELECT**: Host or self access only
- ✅ **INSERT**: Host can add, user can self-join  
- ✅ **UPDATE**: Host or self can update
- ❌ **DELETE**: Explicitly disabled (`false` policy) ⭐

**Analysis**: Guests cannot be accidentally deleted - soft delete pattern enforced

### Message & Delivery Security  
**messages table** (6 policies):
- ✅ **SELECT**: Event access required (`can_access_event`)
- ✅ **INSERT/UPDATE/DELETE**: Host only (`is_event_host`)

**message_deliveries table** (6 policies):
- ✅ **SELECT**: User sees own deliveries + guest context check
- ✅ **INSERT/UPDATE**: Host can manage via `can_manage_deliveries_v2`
- Complex logic for user vs guest delivery access

**Critical Security**: Message content is never exposed to unauthorized users

### Media Access Control
**media table** (3 policies):
- ✅ **SELECT**: Event participants only (`can_access_event`)
- ✅ **INSERT**: Event participants can upload
- ✅ **UPDATE**: Uploader can edit their own media

## SECURITY DEFINER Function Hygiene

### Search Path Analysis
**⚠️  CRITICAL FINDING**: 67 SECURITY DEFINER functions **ALL missing** `SET search_path = ''`

**Functions Without Search Path Protection**:
- Core access functions: `is_event_host`, `is_event_guest`, `can_access_event`
- Message functions: `get_guest_event_messages_v2`, `can_manage_deliveries_v2`
- Guest management: `guest_auto_join`, `add_or_restore_guest`
- User functions: `get_user_events`, `auto_link_user_to_guest_invitations`
- 60+ additional functions

**Security Risk**: 
- Function search path injection vulnerability
- Potential for privilege escalation through schema manipulation
- Non-compliant with PostgreSQL security best practices

**Recommended Fix**:
```sql
-- Example fix for key functions
ALTER FUNCTION public.is_event_host(uuid) SET search_path = '';
ALTER FUNCTION public.is_event_guest(uuid) SET search_path = '';
ALTER FUNCTION public.can_access_event(uuid) SET search_path = '';
-- Apply to all 67 SECURITY DEFINER functions
```

## Index Analysis & Performance

### Message Deliveries (Largest Table)
**Top Indexes by Size**:
- `unique_message_guest_delivery`: 120KB - Unique constraint
- `idx_deliveries_message_guest`: 88KB - Query optimization  
- `message_deliveries_pkey`: 88KB - Primary key
- `idx_md_user_event_created`: 72KB - **Added by migrations for guest RPC**

### Messages Table Indexes
**Well-Optimized**:
- `idx_messages_event_recent`: Event + timestamp ordering
- `idx_messages_event_created_id`: Stable sort with ID tie-breaker ⭐
- `idx_messages_event_host_lookup`: Host message queries
- `idx_messages_event_type_created`: Type-specific queries

### Event Guests Indexes  
**Comprehensive Coverage**:
- `idx_event_guests_event_phone`: Phone lookup optimization
- `idx_event_guests_event_user_lookup`: User-event relationship
- `unique_event_guest_user`: Prevents duplicate memberships ⭐
- `idx_event_guests_phone_messaging`: SMS delivery optimization

### Potential Index Optimizations
1. **Partial Indexes**: Consider partial indexes on `removed_at IS NULL` for active guests
2. **Covering Indexes**: `message_deliveries` could benefit from covering index on (user_id, event_id) INCLUDE (sms_status, created_at)
3. **Composite Optimization**: Review multi-column index order for query patterns

## Foreign Key Integrity

### Well-Connected Schema
**19 Foreign Key Relationships** across core tables:

**Event-Centric Design**:
- `events` ← `event_guests`, `messages`, `media`, `scheduled_messages`
- `users` ← `events.host_user_id`, `event_guests.user_id`, etc.

**Message Relationship Chain**:
```
scheduled_messages → messages → message_deliveries
                           ↓
                    event_guests (via guest_id)
```

**Audit Trail**:
- `user_link_audit` tracks guest-to-user linking with full FK references

**Missing CASCADE Analysis**: FKs appear to use default RESTRICT - confirm cascade behavior for cleanup operations

## Security Findings Summary

### 🔴 Critical Issues
1. **Search Path Vulnerability**: All 67 SECURITY DEFINER functions lack `SET search_path = ''`
   - **Impact**: High - Potential privilege escalation
   - **Fix**: Apply search path setting to all DEFINER functions
   - **Priority**: Immediate

### 🟡 Medium Issues  
1. **Force RLS Inconsistency**: `events`, `media`, `users` allow DEFINER bypass
   - **Impact**: Medium - Functions can bypass RLS if needed
   - **Assessment**: May be intentional for admin operations
   - **Recommendation**: Review DEFINER function necessity

### 🟢 Strengths
1. **RLS Coverage**: 100% of core tables have RLS enabled
2. **Access Control**: Sophisticated host/guest permission system
3. **Message Privacy**: Strong delivery-based access control  
4. **Delete Protection**: Guest deletion explicitly prevented
5. **Index Coverage**: Well-optimized for query patterns
6. **FK Integrity**: Complete relational integrity maintained

## Recommended Actions

### Immediate (Security)
1. **Fix SECURITY DEFINER functions** - Add `SET search_path = ''` to all 67 functions
2. **Test RLS bypass scenarios** - Ensure admin functions work correctly
3. **Review force_rls settings** - Document which tables intentionally allow bypass

### Short-term (Performance)  
1. **Add partial indexes** for active guests (`removed_at IS NULL`)
2. **Review composite index order** for optimal query performance
3. **Add covering indexes** for hot query paths

### Long-term (Monitoring)
1. **RLS policy testing** - Automated tests for policy effectiveness
2. **Index usage analysis** - Monitor for unused indexes
3. **Security audit schedule** - Regular DEFINER function review

## Policy Effectiveness Score: 8.5/10

**Strong Points**: Comprehensive coverage, sophisticated access control, privacy protection
**Weak Point**: SECURITY DEFINER search path vulnerability

The RLS implementation demonstrates mature security patterns with consistent host/guest access control and proper message privacy protection. The primary concern is the search path vulnerability affecting all SECURITY DEFINER functions.
