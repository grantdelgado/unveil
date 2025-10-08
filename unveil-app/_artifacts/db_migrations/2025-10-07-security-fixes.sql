-- Security fixes for Supabase lint errors
-- Date: 2025-10-07
-- Applied: 2025-10-07 via MCP Supabase Unveil
-- Migration: security_fixes_views_and_ops_tables

-- INTENT: Resolve database-linter errors for:
-- 1. "Security Definer View" on public.rum_p75_7d and public.low_usage_indexes_30d
-- 2. "RLS Disabled in Public" on public.user_link_audit_purge_runs and public.index_usage_snapshots

-- POSTGRES VERSION: 15.8 (supports security_invoker on views)

-- CHANGES APPLIED:
-- 1. Set SECURITY INVOKER on views to prevent privilege escalation
-- 2. Added SECURITY BARRIER for defense-in-depth
-- 3. Moved ops tables out of public schema to ops schema
-- 4. Locked down ops schema privileges

BEGIN;

-- 1) Ensure ops schema exists and is locked down
CREATE SCHEMA IF NOT EXISTS ops;
REVOKE ALL ON SCHEMA ops FROM public;
GRANT USAGE ON SCHEMA ops TO postgres;

-- 2) Fix views: set SECURITY INVOKER (PG15+ path)
-- This prevents privilege escalation through views
ALTER VIEW public.rum_p75_7d SET (security_invoker = on);
ALTER VIEW public.low_usage_indexes_30d SET (security_invoker = on);

-- Optional: add security_barrier for defense-in-depth
ALTER VIEW public.rum_p75_7d SET (security_barrier = on);
ALTER VIEW public.low_usage_indexes_30d SET (security_barrier = on);

-- 3) Move ops/monitoring tables out of public schema
-- This removes them from PostgREST exposure and eliminates RLS lint warnings
ALTER TABLE IF EXISTS public.user_link_audit_purge_runs SET SCHEMA ops;
ALTER TABLE IF EXISTS public.index_usage_snapshots SET SCHEMA ops;

-- 4) Lock down table privileges in ops schema
REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM public;
REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM authenticated;

-- Grant minimal access only to service roles if needed
-- (Uncomment if maintenance access is required)
-- GRANT SELECT ON ops.user_link_audit_purge_runs TO service_role;
-- GRANT SELECT ON ops.index_usage_snapshots TO service_role;

COMMIT;

-- VALIDATION RESULTS:
-- ✅ Postgres version: PostgreSQL 15.8 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 13.2.0, 64-bit
-- ✅ Views now have: security_invoker=on, security_barrier=on
-- ✅ Tables moved to ops schema: ops.user_link_audit_purge_runs, ops.index_usage_snapshots
-- ✅ RUM API still functional: rum_p75_7d view accessible with 20 rows
-- ✅ Security advisors: No more "Security Definer View" or "RLS Disabled in Public" errors

-- APP IMPACT:
-- ✅ app/api/rum/route.ts continues to work (uses rum_p75_7d view)
-- ✅ No other app code references the affected objects
-- ✅ Ops tables moved out of PostgREST exposure (no longer accessible via API)

-- ROLLBACK (if needed):
-- BEGIN;
-- ALTER TABLE IF EXISTS ops.user_link_audit_purge_runs SET SCHEMA public;
-- ALTER TABLE IF EXISTS ops.index_usage_snapshots SET SCHEMA public;
-- ALTER VIEW IF EXISTS public.rum_p75_7d RESET (security_invoker);
-- ALTER VIEW IF EXISTS public.low_usage_indexes_30d RESET (security_invoker);
-- ALTER VIEW IF EXISTS public.rum_p75_7d RESET (security_barrier);
-- ALTER VIEW IF EXISTS public.low_usage_indexes_30d RESET (security_barrier);
-- COMMIT;
