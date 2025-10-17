# Archived Database Fixes (2024-2025)

<!-- ARCHIVED: October 16, 2025 -->
<!-- SUPERSEDED BY: /docs/context/unveil-product-eng-context.md -->

## Purpose

This directory contains documentation of completed database fixes, schema migrations, and issue resolutions from 2024-2025. These files document the evolution of the database schema but are no longer active issues.

## Current Database Reference

**Canonical Sources:**
- **Schema:** `/supabase/migrations/` (live migration files)
- **Context:** `/docs/context/unveil-product-eng-context.md`
- **Database Docs:** `/docs/database/` (active issues and guides)

## Archived Fixes

### `event-creation-schema-fix.md`
- **Date:** October 16, 2025
- **Issue:** Event creation failing with `rsvp_status` column not found
- **Resolution:** Removed `rsvp_status` reference (RSVP-Lite migration)
- **Status:** ✅ Fixed and deployed

## When to Reference

- Understanding historical schema evolution
- Debugging similar issues
- Learning from past fixes
- Migration planning

## When NOT to Reference

- ❌ Current schema structure (use `/supabase/migrations/`)
- ❌ Active database issues (use `/docs/database/`)
- ❌ RLS policies (use `/docs/architecture/SECURITY.md`)

---

**All fixes in this directory are completed and archived for historical reference only.**

