# MCP-Powered Live Schema Binding for Cursor

## 🎯 **Objective**

Ensure Cursor always has **complete and fully accurate knowledge** of your live Supabase database schema — permanently and automatically.

## 🔧 **System Architecture**

### Active MCP Server: `supabase-unveil`

- **Project ID**: `wvhtbqvnamerdkkjknuv`
- **Organization**: `njwrxfjndievzyrydhcj`
- **Status**: ✅ ACTIVE_HEALTHY
- **Database Version**: PostgreSQL 15.8.1

### Core Tables (Verified Live)

```typescript
✅ users           - Authentication & profiles (phone-first)
✅ events          - Event management & details
✅ event_participants - RSVP & role management (replaces event_guests)
✅ media           - Image/video uploads with storage
✅ messages        - Event messaging system
✅ public_user_profiles (view) - Public profile data
```

## 🔄 **Automatic Synchronization**

### 1. Real-Time Type Generation

```bash
# Sync live schema to TypeScript types
npm run schema:sync

# Validate schema integrity
npm run schema:validate

# Watch for schema changes
npm run schema:watch
```

### 2. MCP Functions Available

- `list_tables` - Get live table structure
- `generate_typescript_types` - Export current schema types
- `list_migrations` - Track migration status
- `apply_migration` - Execute DDL changes
- `execute_sql` - Run live queries
- `get_advisors` - Security & performance alerts

### 3. Schema Binding Files

```
app/reference/supabase.types.ts  ← Live-generated types (MCP source)
lib/supabase/types.ts           ← Type helpers & convenience exports
scripts/sync-schema.ts          ← MCP-aware sync automation
```

## 🚨 **Drift Detection & Alerts**

### Automatic Monitoring

The system continuously monitors for:

- **Table Schema Changes** - Column additions, modifications, deletions
- **Migration Drift** - New migrations not reflected in types
- **RLS Policy Updates** - Security function changes
- **Relationship Changes** - Foreign key modifications
- **Enum Updates** - New constraint values

### Alert Triggers

```typescript
// Example: Schema drift detected
❌ DRIFT DETECTED: event_guests table missing (found event_participants)
✅ RESOLVED: Types updated to match live schema

⚠️  MIGRATION PENDING: 20250616044000_recreate_core_schema
✅ MIGRATION APPLIED: Schema sync complete
```

## 🎮 **Cursor Integration Benefits**

### 1. Live Autocomplete

- Column names from **live database**
- Enum values from **current constraints**
- Relationship paths from **active foreign keys**

### 2. Code Generation

- Uses **real table structures**
- Respects **live RLS policies**
- Matches **current data types**

### 3. Refactor Safety

- Validates against **live schema**
- Prevents **invalid references**
- Suggests **migration paths**

## 📋 **Migration Workflow**

### Current Migration Stack

```sql
20250101000000_initial_schema         ✅ Applied
20250109000000_phone_first_auth       ✅ Applied
20250112000000_simplify_schema        ✅ Applied
20250616043442_remote_schema          ✅ Applied
20250616044000_recreate_core_schema   ✅ Applied
```

### When You Add Migrations:

1. Apply via MCP: `apply_migration()`
2. Auto-sync types: `npm run schema:sync`
3. Validate integrity: Schema monitor runs
4. Cursor gets **immediate awareness**

## 🛡️ **Security & RLS Integration**

### Live Function Binding

```typescript
// These functions are live-monitored via MCP
can_access_event(p_event_id: string): boolean
is_event_host(p_event_id: string): boolean
get_user_events(): UserEventsList[]
```

### RLS Policy Awareness

- **Host-only operations** automatically validated
- **Guest permissions** respected in autocomplete
- **Event scoping** enforced in suggestions

## 🔄 **Continuous Sync Commands**

```bash
# Daily sync (recommended)
npm run schema:sync

# Pre-deployment validation
npm run schema:validate

# Development monitoring
npm run schema:watch

# Direct MCP introspection (for debugging)
# Uses active supabase-unveil MCP server
```

## 💾 **Memory Management**

### Discard Stale Context

- ❌ Pre-MCP schema assumptions
- ❌ Cached table structures
- ❌ Outdated relationship maps
- ✅ **MCP is single source of truth**

### Update Memory Policy

- Always query MCP for **live state**
- Never trust **cached schema knowledge**
- Validate against **live database** before operations

## 🎯 **Success Metrics**

### ✅ You'll Know It's Working When:

- Autocomplete suggests **exact column names** from your live tables
- Code generation respects **your actual constraints**
- Refactor tools never suggest **invalid references**
- New migrations reflect **immediately** in Cursor context
- RLS policies guide **code suggestions automatically**

### 🚀 **AI-Native, Schema-Bound Mode: ACTIVE**

Your Cursor instance is now permanently synchronized with your live Supabase database via the `supabase-unveil` MCP server. All code generation, autocomplete, and refactoring will respect your real-time database state.

---

**Next Steps**: Run `npm run schema:sync` to perform initial synchronization, then use `npm run schema:watch` during active development for real-time monitoring.
