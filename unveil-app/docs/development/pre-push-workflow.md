# Pre-Push Validation Workflow

**Purpose:** Ensure all changes pass validation before pushing to prevent Vercel build failures  
**Created:** October 16, 2025  
**Status:** ✅ Active

---

## Quick Start

**Before every `git push`, run:**

```bash
./scripts/pre-push-check.sh
```

This will catch TypeScript errors, linting issues, and build failures **before** they reach Vercel.

---

## What the Script Checks

### 1. ✅ TypeScript Compilation

**Command:** `pnpm run type-check` or `pnpm tsc --noEmit`

**Catches:**
- Type errors
- Missing imports
- Interface mismatches
- Generic type issues

**Example Issues Caught:**
- `Property 'start_time' does not exist on type 'Event'`
- `Property 'length' does not exist on type '{}'`
- `Argument of type 'X' is not assignable to parameter of type 'Y'`

---

### 2. ✅ ESLint Validation

**Command:** `pnpm run lint`

**Catches:**
- Unused variables
- Unused imports
- Code style violations
- React hooks violations
- Custom rule violations (canonical messaging, etc.)

**Example Issues Caught:**
- `'headerImage' is defined but never used`
- `'Image' is imported but never used`
- `Unexpected any. Specify a different type`

---

### 3. ✅ Migration Files Check

**Validates:**
- No untracked migration files in `supabase/migrations/`
- All migrations are committed

**Why Important:**
- Migrations must be version controlled
- Missing migrations cause schema drift
- Deployment order matters

---

### 4. ✅ Supabase Types Sync

**Validates:**
- `types/supabase.ts` matches `app/reference/supabase.types.ts`

**Why Important:**
- Both files must be identical
- App imports from `app/reference/`
- Easy to forget to copy after regenerating types

**Auto-fix:**
```bash
cp types/supabase.ts app/reference/supabase.types.ts
```

---

### 5. ✅ Production Build Test

**Command:** `pnpm run build`

**Catches:**
- All TypeScript errors (stricter than type-check)
- Build-time failures
- Bundle size issues
- Missing dependencies
- Import errors

**Why Important:**
- This is exactly what Vercel runs
- Catches issues that `type-check` might miss
- Validates entire build pipeline

---

### 6. ✅ Bundle Size Check

**Validates:**
- No chunks over 300KB
- Shows large bundle sizes

**Why Important:**
- Performance impact
- Identifies bloat early
- Helps maintain fast page loads

---

## Common Issues and Fixes

### Issue 1: RPC Type Assertions

**Problem:**
```typescript
const { data } = await supabase.rpc('some_function');
if (data.length === 0) {  // ❌ Error: Property 'length' does not exist
```

**Fix:**
```typescript
const { data } = await supabase.rpc('some_function');
const results = data as Array<YourType> | null;
if (!results || results.length === 0) {  // ✅ Works
```

**Why:**
- Supabase RPC returns `unknown` type
- TypeScript can't infer array
- Need explicit type assertion

---

### Issue 2: Unused Variables

**Problem:**
```typescript
export function MyComponent({ value, unusedProp }: Props) {
  return <div>{value}</div>;  // ❌ Error: 'unusedProp' is defined but never used
}
```

**Fix:**
```typescript
export function MyComponent({ value }: Props) {
  return <div>{value}</div>;  // ✅ Works
}
```

Or if needed for interface compatibility:
```typescript
export function MyComponent({ value, unusedProp: _ }: Props) {
  return <div>{value}</div>;  // ✅ Acknowledges unused
}
```

---

### Issue 3: Type Sync Out of Date

**Problem:**
```
⚠️  Supabase type files are out of sync
```

**Fix:**
```bash
# Regenerate types from database
pnpm run typegen

# OR manually copy
cp types/supabase.ts app/reference/supabase.types.ts

# Then commit
git add types/supabase.ts app/reference/supabase.types.ts
```

---

### Issue 4: Disk Full (Local Only)

**Problem:**
```
ENOSPC: no space left on device
```

**Fix:**
```bash
# Clean build cache
rm -rf .next

# Clean node modules (if needed)
rm -rf node_modules
pnpm install

# Check disk space
df -h
```

**Note:** This won't affect Vercel (they have plenty of space)

---

## Manual Validation Checklist

If you can't run the automated script, manually verify:

### Before Committing

- [ ] Run `pnpm run lint` - passes with no errors
- [ ] Run `pnpm tsc --noEmit` - passes with no errors
- [ ] Check `git status` - only intended files staged
- [ ] Review `git diff --cached` - changes look correct

### After Committing, Before Pushing

- [ ] Run `pnpm run build` - completes successfully
- [ ] Check build warnings - acceptable bundle sizes
- [ ] Verify types in sync - `diff types/supabase.ts app/reference/supabase.types.ts`
- [ ] Check migrations committed - `git ls-files supabase/migrations/`

### After Pushing

- [ ] Monitor Vercel deployment dashboard
- [ ] Check build logs for errors
- [ ] Test deployed preview URL
- [ ] Verify no runtime errors in browser console

---

## Workflow Integration

### Recommended Git Flow

```bash
# 1. Make changes
# ... edit files ...

# 2. Stage changes
git add -A

# 3. Run pre-push validation
./scripts/pre-push-check.sh

# 4. If checks pass, commit
git commit -m "feat: your message"

# 5. Push
git push origin main

# 6. Monitor Vercel
# Check deployment dashboard
```

---

### Alternative: Git Pre-Push Hook

**Setup automatic validation:**

```bash
# Create git hook
cat > .git/hooks/pre-push << 'EOF'
#!/bin/bash
echo "Running pre-push checks..."
./scripts/pre-push-check.sh
EOF

# Make executable
chmod +x .git/hooks/pre-push
```

**Now git will automatically run checks before every push!**

---

## When Vercel Build Fails

### Step 1: Get Error Details

**From Vercel Dashboard:**
- Click failed deployment
- View "Build Logs"
- Find the error message (usually near bottom)

**Common patterns:**
```
Failed to compile.
./path/to/file.ts:123:45
Type error: ...
```

---

### Step 2: Reproduce Locally

```bash
# Clean slate
rm -rf .next

# Run exact same build as Vercel
pnpm run build

# Should show same error
```

---

### Step 3: Fix the Error

**TypeScript errors:**
- Add type assertions for RPC calls
- Fix interface mismatches
- Remove unused variables

**Import errors:**
- Remove unused imports
- Fix circular dependencies
- Check file paths

---

### Step 4: Validate and Re-push

```bash
# Validate fix
./scripts/pre-push-check.sh

# Commit and push
git add -A
git commit -m "fix: description of fix"
git push origin main
```

---

## Emergency Rollback

**If bad code reaches production:**

```bash
# Revert last commit
git revert HEAD

# Push revert
git push origin main

# Vercel will automatically deploy the revert
```

**For multiple commits:**
```bash
# Revert to specific commit
git revert <commit-hash>

# Or reset (if no one else has pulled)
git reset --hard <good-commit-hash>
git push --force origin main  # ⚠️ Use with caution
```

---

## Best Practices

### DO ✅

- ✅ Run `./scripts/pre-push-check.sh` before every push
- ✅ Fix all TypeScript errors locally first
- ✅ Test major changes in local dev server
- ✅ Keep commits atomic (one feature per commit)
- ✅ Use descriptive commit messages
- ✅ Regenerate types after database migrations
- ✅ Copy types to both locations (types/ and app/reference/)

### DON'T ❌

- ❌ Push without running build locally
- ❌ Ignore TypeScript errors ("it works in dev")
- ❌ Use `@ts-ignore` to bypass type errors
- ❌ Commit with `--no-verify` (skips hooks)
- ❌ Push large binary files or node_modules
- ❌ Force push to main without team communication

---

## Script Output Example

**Successful run:**
```
🔍 Pre-Push Validation Check
=============================

Step 1: Checking TypeScript types...
✅ TypeScript compilation

Step 2: Running ESLint...
✅ ESLint checks

Step 3: Checking for untracked migration files...
✅ No untracked migrations

Step 4: Verifying Supabase types are up to date...
✅ Supabase types are in sync

Step 5: Checking for large uncommitted changes...
✅ Found 12 staged changes

Step 6: Testing production build...
This may take 30-60 seconds...
✅ Production build succeeded

Step 7: Checking bundle sizes...
⚠️  Found 2 chunks over 300KB
  main-app.js 367KB
  2042.js 391KB

=============================
✅ All checks passed!

Ready to push. Run:
  git push origin main
```

---

**Failed run:**
```
🔍 Pre-Push Validation Check
=============================

Step 1: Checking TypeScript types...
❌ TypeScript compilation

Step 2: Running ESLint...
❌ ESLint checks

...

=============================
❌ Some checks failed

Please fix the issues above before pushing.
```

---

## Continuous Integration Future

**Potential GitHub Actions workflow:**

```yaml
name: Pre-Push Validation
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm run lint
      - run: pnpm run type-check
      - run: pnpm run build
```

This would run the same checks on GitHub before Vercel deployment.

---

## Troubleshooting

### "Command not found: pnpm"

**Solution:**
```bash
npm install -g pnpm
```

### "Permission denied: ./scripts/pre-push-check.sh"

**Solution:**
```bash
chmod +x scripts/pre-push-check.sh
```

### "Build takes too long"

**Solutions:**
- Use `pnpm run type-check` for faster validation
- Skip build step if only docs changed
- Clean `.next` cache if builds are slow

### "Out of disk space"

**Solutions:**
```bash
# Clean build artifacts
rm -rf .next

# Clean cache
pnpm store prune

# Check space
df -h
```

---

**Workflow established:** October 16, 2025  
**Maintained by:** Development team  
**Next review:** After 10 successful deployments

