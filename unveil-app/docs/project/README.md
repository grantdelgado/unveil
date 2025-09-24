---
title: "Archived Migrations"
status: active
lastReviewed: 2025-09-19
category: consolidated
originalLocation: "supabase/migrations-archive/README.md"
---

# Archived Migrations

This directory contains SQL migration files that were moved from `supabase/migrations/` to resolve timestamp conflicts and ensure deterministic migration ordering.

## Why These Migrations Were Archived

### Timestamp Conflicts

Several migrations had duplicate timestamps that could cause unpredictable ordering in fresh deployments:

- `20250101000000_add_message_templates.sql` - Conflicted with `20250101000000_initial_schema.sql`
- `20250120000000_fix_function_search_path_security.sql` - Conflicted with `20250120000000_fix_duplicate_events_function.sql`
- `20250129000010_add_atomic_event_creation.sql` - Conflicted with `20250129000010_fix_stable_ordering_guest_messages.sql`
- Additional conflicts identified during audit

### Resolution Strategy

1. **Primary migrations kept**: The more fundamental/structural changes remained in the main migrations directory
2. **Secondary migrations archived**: Smaller fixes or additions were moved to this archive
3. **Functionality preserved**: All archived migrations' functionality was either:
   - Incorporated into other migrations
   - Applied directly to production (if already deployed)
   - Superseded by newer implementations

## Current Status

These archived migrations are **NOT** applied in fresh deployments. Their functionality has been preserved through:

- ✅ **Message templates**: Functionality moved to newer message system migrations
- ✅ **Search path security**: Consolidated into `20250130000010_fix_security_definer_search_path.sql`
- ✅ **Atomic event creation**: Included in baseline schema
- ✅ **Other conflicts**: Resolved through consolidation

## Production Database

The production database already has these migrations applied, so no data loss or functionality regression occurs. This archive only affects:

- Fresh database deployments
- Development environment setup
- Migration ordering consistency

## Restoration Process

If any archived migration needs to be restored:

1. **Review dependencies**: Ensure no conflicts with current migrations
2. **Assign new timestamp**: Use a timestamp after the latest migration
3. **Test thoroughly**: Verify no functionality regressions
4. **Update documentation**: Record the restoration in this README

---

**Archive Date**: January 30, 2025  
**Audit Reference**: `docs/audits/repo-docs-and-migrations-audit.md`  
**Migration Count**: 8 archived migrations
