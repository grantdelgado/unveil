# Invitable Guests Investigation Findings

## Executive Summary

**Decision: REMOVED** - The `public.invitable_guests` view was safely removed as it was unused and posed security risks.

## Investigation Results

### 1. Discovery & Usage Analysis

**Finding**: Zero active usage across the entire codebase.

- **Code References**: Only found in:
  - TypeScript types (`app/reference/supabase.types.ts`) - auto-generated
  - Migration file where it was created (`20250207000000_implement_host_non_invitable_logic.sql`)
- **Client Usage**: No `.from('invitable_guests')` queries found
- **API Usage**: No API endpoints reference the view
- **UI Components**: No components use the `is_invitable` computed field

### 2. Schema & Security Analysis

**Object Type**: PostgreSQL View

```sql
CREATE VIEW public.invitable_guests AS
SELECT
    eg.*,
    (eg.role != 'host' AND eg.removed_at IS NULL) as is_invitable
FROM public.event_guests eg;
```

**Security Issues Identified**:

- ❌ **Excessive Permissions**: Granted ALL privileges (`INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`) to all roles including `anon`
- ❌ **Principle Violation**: Views should typically be read-only, especially for computed fields
- ❌ **Unrestricted Access**: No additional RLS policies beyond inherited ones

### 3. Original Intent vs. Current Implementation

**Original Purpose** (from migration comments):

> "Create a view that makes it easy to query invitable guests"

**Reality**:

- The `is_invitable` logic (`role != 'host' AND removed_at IS NULL`) is already implemented directly in:
  - API endpoints: `guest.role === 'host'` checks
  - Client components: `isHost = guest.role === 'host'`
  - RPC functions: `WHERE role != 'host'` clauses
  - Database queries: Consistent filtering patterns

**Assessment**: The view was redundant from creation - existing code patterns already handle this logic correctly.

### 4. Implementation & Validation

**Migration Applied**: `20250207000002_remove_unused_invitable_guests_view.sql`

- ✅ Safety checks passed (no dependent views)
- ✅ View dropped successfully
- ✅ Type definitions updated

**Validation Tests**:

- ✅ Guest list queries: Working (5 total guests found)
- ✅ Invitable filtering: Working (4 invitable guests found using direct logic)
- ✅ Messaging recipients: Working (RPC functions unaffected)
- ✅ View removal: Confirmed (view no longer exists)

### 5. Risk Assessment

**Removal Risks**: ⚪ **NONE IDENTIFIED**

- No code dependencies
- No breaking changes to existing functionality
- All invitable logic continues to work through existing patterns

**Security Improvements**: ✅ **SIGNIFICANT**

- Eliminated unrestricted database object
- Reduced attack surface
- Enforced principle of least privilege

## Recommendations

### ✅ Completed Actions

1. **Removed** `public.invitable_guests` view via migration
2. **Updated** TypeScript type definitions
3. **Validated** all key flows continue to work
4. **Documented** findings and rationale

### 🔄 Future Considerations

1. **Code Review**: When adding new database objects, ensure they are actually needed
2. **Security Review**: Default to minimal permissions and add only what's required
3. **Usage Tracking**: Consider monitoring for unused database objects in future migrations

## Test Plan & Results

### Test Scenarios

| Flow             | Test                      | Result                                              |
| ---------------- | ------------------------- | --------------------------------------------------- |
| Guest Management | List all guests for event | ✅ PASS (5 guests found)                            |
| Invitation Logic | Filter invitable guests   | ✅ PASS (4 invitable guests using `role != 'host'`) |
| Messaging        | Get messaging recipients  | ✅ PASS (RPC working, access control intact)        |
| Database Cleanup | Verify view removal       | ✅ PASS (view no longer exists)                     |

### Performance Impact

- **Database**: Improved (removed unused object)
- **Application**: None (no code changes needed)
- **Security**: Improved (reduced attack surface)

## Conclusion

The `public.invitable_guests` view was successfully removed with zero impact on application functionality. This cleanup:

- **Eliminates security risks** from overprivileged database objects
- **Reduces complexity** by removing redundant abstractions
- **Maintains functionality** through existing, well-tested code patterns
- **Follows best practices** for database security and maintenance

The investigation demonstrates the importance of auditing database objects for actual usage before deployment, especially when they involve computed fields that may already be handled in application logic.
