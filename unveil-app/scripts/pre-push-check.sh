#!/bin/bash

# Pre-Push Validation Script
# Ensures Vercel build will succeed before pushing
# Usage: ./scripts/pre-push-check.sh

echo "🔍 Pre-Push Validation (Vercel Build Simulation)"
echo "================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

CHECKS_FAILED=0

print_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✅ $2${NC}"
  else
    echo -e "${RED}❌ $2 - BLOCKING${NC}"
    CHECKS_FAILED=1
  fi
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

# ============================================
# CRITICAL CHECKS (Must Pass for Vercel)
# ============================================

echo -e "${BLUE}Critical Checks (Vercel will run these):${NC}"
echo ""

# 1. TypeScript Check (exactly what Next.js runs)
echo "1️⃣  TypeScript Compilation..."
pnpm tsc --noEmit > ts-check.log 2>&1
TS_RESULT=$?
if [ $TS_RESULT -eq 0 ]; then
  print_result 0 "TypeScript types valid"
  rm -f ts-check.log
else
  print_result 1 "TypeScript errors found"
  echo ""
  echo -e "${RED}=== TypeScript Errors ===${NC}"
  head -50 ts-check.log
  echo ""
  echo "Full output in: ts-check.log"
  echo ""
fi

# 2. ESLint (Next.js runs this during build)
echo ""
echo "2️⃣  ESLint Validation..."
pnpm run lint > lint-check.log 2>&1
LINT_RESULT=$?
if [ $LINT_RESULT -eq 0 ]; then
  print_result 0 "No linting errors"
  rm -f lint-check.log
else
  print_result 1 "Linting errors found"
  echo ""
  echo -e "${RED}=== Linting Errors ===${NC}"
  tail -30 lint-check.log
  echo ""
  echo "Full output in: lint-check.log"
  echo ""
fi

# 3. Supabase Types Sync
echo ""
echo "3️⃣  Supabase Types Sync..."
if diff -q types/supabase.ts app/reference/supabase.types.ts > /dev/null 2>&1; then
  print_result 0 "Types are synchronized"
else
  print_result 1 "Type files out of sync"
  echo ""
  echo -e "${YELLOW}Fix with: cp types/supabase.ts app/reference/supabase.types.ts${NC}"
  echo ""
fi

# ============================================
# OPTIONAL CHECKS (Recommended but not blocking)
# ============================================

echo ""
echo -e "${BLUE}Optional Checks (Recommended):${NC}"
echo ""

# 4. Unit Tests
echo "4️⃣  Unit Tests (non-blocking)..."
if command -v vitest &> /dev/null; then
  pnpm test:unit --run --reporter=dot > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ All unit tests passing${NC}"
  else
    print_warning "Some unit tests failing (not blocking push)"
    echo "   Run 'pnpm test:unit' to see details"
  fi
else
  print_info "Vitest not available, skipping tests"
fi

# 5. Staged Changes Check
echo ""
echo "5️⃣  Git Status..."
STAGED=$(git diff --cached --name-only | wc -l | tr -d ' ')
if [ "$STAGED" -eq 0 ]; then
  print_warning "No staged changes found"
  echo "   Run: git add -A"
else
  echo -e "${GREEN}✅ $STAGED file(s) staged for commit${NC}"
fi

# 6. Migration Files
echo ""
echo "6️⃣  Migration Files..."
UNTRACKED_MIG=$(git ls-files --others --exclude-standard supabase/migrations/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$UNTRACKED_MIG" -gt 0 ]; then
  print_warning "Found $UNTRACKED_MIG untracked migration(s)"
  git ls-files --others --exclude-standard supabase/migrations/
  echo "   Add with: git add supabase/migrations/"
else
  echo -e "${GREEN}✅ All migrations tracked${NC}"
fi

# ============================================
# FINAL VERDICT
# ============================================

echo ""
echo "================================================"
if [ $CHECKS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All critical checks passed!${NC}"
  echo ""
  echo "Safe to push. Next steps:"
  echo "  git commit -m 'your message'"
  echo "  git push origin main"
  echo ""
  exit 0
else
  echo -e "${RED}❌ Critical checks failed - DO NOT PUSH${NC}"
  echo ""
  echo "Fix the errors above, then run this script again."
  echo ""
  exit 1
fi
