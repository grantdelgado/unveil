# 🚀 Database Schema & Auth Flow Simplification Implementation Guide

This guide provides step-by-step instructions for implementing the complete simplification audit recommendations.

## ⚠️ **BEFORE YOU BEGIN**

### **Backup Requirements**

```bash
# 1. Backup your current database
supabase db dump > backup-$(date +%Y%m%d).sql

# 2. Export important data
npx tsx scripts/export-critical-data.ts

# 3. Test the backup
supabase db reset --local
supabase db push backup-$(date +%Y%m%d).sql
```

### **Environment Setup**

Create `.env.local` with simplified configuration:

```env
# Required for simplification
NODE_ENV=development
SKIP_SMS_IN_DEV=true
AUTO_VERIFY_DEV_PHONES=true
DEV_PHONE_PATTERN=+1555000000

# Your Supabase config
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 🗂️ **PHASE 1: Database Schema Simplification**

### **Step 1.1: Apply New Schema Migration**

```bash
# Run the simplification migration
supabase migration new simplify_schema
# Copy content from supabase/migrations/20250112000000_simplify_schema.sql
supabase db push
```

### **Step 1.2: Verify Migration Success**

```bash
# Check that new tables exist
supabase db ls

# Verify data migration
psql -d postgres -c "SELECT COUNT(*) FROM users_new;"
psql -d postgres -c "SELECT COUNT(*) FROM events_new;"
psql -d postgres -c "SELECT COUNT(*) FROM event_participants;"
```

### **Step 1.3: Update Type Definitions**

```bash
# Generate new types from simplified schema
npm run supabase:generate-types

# Verify types are updated
grep -n "event_participants" app/reference/supabase.types.ts
```

---

## 📱 **PHASE 2: Authentication Flow Simplification**

### **Step 2.1: Replace Login Page**

```bash
# Backup current login
cp app/login/page.tsx app/login/page.tsx.backup

# Replace with simplified version
cp app/login/login-simplified.tsx app/login/page.tsx
```

### **Step 2.2: Update Event Selection**

```bash
# Backup current event selection
cp app/select-event/page.tsx app/select-event/page.tsx.backup

# Replace with simplified version
cp app/select-event/select-event-simplified.tsx app/select-event/page.tsx
```

### **Step 2.3: Update Session Management**

```bash
# Update AuthSessionWatcher to use simplified flow
# Key changes:
# - Remove complex role checks
# - Simplify redirect logic
# - Use new RLS functions
```

Update `components/features/auth/AuthSessionWatcher.tsx`:

```typescript
// Replace existing function calls:
// get_user_events_with_roles() → get_user_events()
// is_event_participant() → can_access_event()
```

---

## 🛠️ **PHASE 3: Developer Experience Setup**

### **Step 3.1: Install Dev Setup Script**

```bash
# Make script executable
chmod +x scripts/dev-setup.ts

# Add to package.json (already done)
npm run dev-setup
```

### **Step 3.2: Test Development Flow**

```bash
# Reset and create test data
npm run dev-reset
npm run dev-setup

# Verify test users created
npm run dev-demo

# Test login flow
npm run dev
# Visit localhost:3000, click "Use Test Account"
```

### **Step 3.3: Verify Development Bypass**

```bash
# Test development phone patterns work
# Should auto-login without SMS: +15550000001, +15550000002, +15550000003
```

---

## 🧹 **PHASE 4: Code Cleanup**

### **Step 4.1: Remove Unused Components**

```bash
# Remove complex components that are no longer needed
rm -rf components/features/guests/GuestSubEventAssignments
rm -rf components/features/messaging/MessageDeliveries
rm -rf components/features/messaging/ScheduledMessages
rm -rf components/features/events/SubEvents
rm -rf components/features/communication/Preferences
```

### **Step 4.2: Update API Routes**

```bash
# Update API routes to use simplified schema
find app/api -name "*.ts" -exec grep -l "event_guests" {} \;
# Replace with "event_participants"

find app/api -name "*.ts" -exec grep -l "get_user_events_with_roles" {} \;
# Replace with "get_user_events"
```

### **Step 4.3: Update Components**

```bash
# Update all components using old schema
grep -r "event_guests" app/components --include="*.tsx"
# Replace with "event_participants"

grep -r "message_deliveries" app/components --include="*.tsx"
# Remove or simplify to use messages table only
```

---

## 🔒 **PHASE 5: Security Verification**

### **Step 5.1: Test RLS Policies**

```bash
# Test new simplified RLS functions
npx tsx scripts/test-simplified-rls.ts

# Verify:
# - can_access_event() works correctly
# - is_event_host() properly restricts access
# - get_user_events() returns correct events
```

### **Step 5.2: Test Authentication Security**

```bash
# Verify development bypasses only work in development
NODE_ENV=production npm run dev
# Development phones should NOT bypass SMS in production
```

### **Step 5.3: Test Event Access Control**

```bash
# Test that users can only see their events
# Test that hosts can manage their events
# Test that guests can only view their assigned events
```

---

## 📊 **PHASE 6: Data Migration & Cleanup**

### **Step 6.1: Migrate Critical Data**

```bash
# Ensure all important data is in new tables
# Run data verification script
npx tsx scripts/verify-data-migration.ts
```

### **Step 6.2: Drop Old Tables (CAREFUL!)**

```sql
-- ONLY after verifying new tables work correctly
BEGIN;

-- Drop old complex tables
DROP TABLE IF EXISTS communication_preferences CASCADE;
DROP TABLE IF EXISTS guest_sub_event_assignments CASCADE;
DROP TABLE IF EXISTS message_deliveries CASCADE;
DROP TABLE IF EXISTS scheduled_messages CASCADE;
DROP TABLE IF EXISTS sub_events CASCADE;

-- Rename new tables to production names
ALTER TABLE users_new RENAME TO users_simplified;
ALTER TABLE events_new RENAME TO events_simplified;
ALTER TABLE media_new RENAME TO media_simplified;
ALTER TABLE messages_new RENAME TO messages_simplified;

-- Final rename to production names
ALTER TABLE users_simplified RENAME TO users;
ALTER TABLE events_simplified RENAME TO events;
ALTER TABLE media_simplified RENAME TO media;
ALTER TABLE messages_simplified RENAME TO messages;

COMMIT;
```

### **Step 6.3: Update All References**

```bash
# Update all code references to use final table names
# This should be minimal since we kept the same names
npm run supabase:generate-types
```

---

## ✅ **PHASE 7: Testing & Verification**

### **Step 7.1: Full Application Test**

```bash
# Test complete user flows
npm run dev-setup
npm run dev

# Test scenarios:
# 1. Development login with test phones
# 2. Real phone login (if A2P approved)
# 3. Event creation and management
# 4. Guest invitation and RSVP
# 5. Media upload and viewing
# 6. Messaging functionality
```

### **Step 7.2: Performance Verification**

```bash
# Test database performance with simplified schema
# Should be faster with fewer tables and simpler queries

# Run existing test suite
npm run test
npm run test:e2e
```

### **Step 7.3: Production Readiness Check**

```bash
# Environment check
NODE_ENV=production npm run build

# Security check
npm run test:rls

# Performance check
npm run test:e2e
```

---

## 🎯 **PHASE 8: Deployment**

### **Step 8.1: Staging Deployment**

```bash
# Deploy to staging first
git add .
git commit -m "feat: implement database and auth simplification"
git push origin staging

# Test staging environment thoroughly
```

### **Step 8.2: Production Migration**

```bash
# Schedule maintenance window
# Backup production database
# Apply migrations
# Deploy new code
# Test critical paths
# Monitor for issues
```

### **Step 8.3: Post-Deployment Monitoring**

```bash
# Monitor application performance
# Watch for authentication issues
# Check database query performance
# Verify development experience
```

---

## 🆘 **ROLLBACK PLAN**

If issues arise, use this rollback procedure:

### **Emergency Rollback**

```bash
# 1. Revert to previous deployment
git revert HEAD
git push origin main

# 2. Restore database from backup
supabase db reset
supabase db push backup-YYYYMMDD.sql

# 3. Verify critical functionality
npm run test:e2e
```

### **Partial Rollback Options**

- Keep new simplified login but revert schema changes
- Keep schema changes but revert authentication flow
- Revert specific components while keeping others

---

## 📈 **SUCCESS METRICS**

After implementation, you should see:

### **Developer Experience**

- ✅ One command setup: `npm run dev-setup`
- ✅ No SMS dependency for development
- ✅ Auto-login with test accounts
- ✅ Faster local development

### **Code Simplicity**

- ✅ 55% fewer database tables (11 → 5)
- ✅ 62% fewer RLS functions (8 → 3)
- ✅ Single authentication pattern
- ✅ Cleaner codebase

### **Performance**

- ✅ Faster database queries
- ✅ Simpler RLS policy evaluation
- ✅ Reduced complexity overhead
- ✅ Better maintainability

---

## 📞 **SUPPORT & TROUBLESHOOTING**

### **Common Issues**

**Migration Fails**

```bash
# Check migration syntax
supabase db lint

# Check for data conflicts
npm run verify-data-migration
```

**Authentication Issues**

```bash
# Clear browser storage
# Check environment variables
# Verify Supabase configuration
```

**RLS Policy Issues**

```bash
# Test policies manually
npm run test:rls

# Check function definitions
\df in psql
```

### **Getting Help**

- Check the audit document: `docs/schema-simplification-audit.md`
- Review implementation logs
- Test with minimal reproduction case
- Verify environment configuration

---

_This implementation should reduce complexity by 55% while maintaining all core functionality and improving developer experience._
