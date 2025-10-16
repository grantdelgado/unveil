#!/bin/bash

# Pre-Push Validation Script
# Runs comprehensive checks before allowing git push to ensure Vercel build will succeed
# Usage: ./scripts/pre-push-check.sh

set -e  # Exit on first error

echo "🔍 Pre-Push Validation Check"
echo "============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track if any checks fail
CHECKS_FAILED=0

# Function to print check result
print_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✅ $2${NC}"
  else
    echo -e "${RED}❌ $2${NC}"
    CHECKS_FAILED=1
  fi
}

echo "Step 1: Checking TypeScript types..."
pnpm run type-check > /dev/null 2>&1 || pnpm tsc --noEmit > /dev/null 2>&1
print_result $? "TypeScript compilation"

echo ""
echo "Step 2: Running ESLint..."
pnpm run lint > /dev/null 2>&1
print_result $? "ESLint checks"

echo ""
echo "Step 3: Checking for untracked migration files..."
UNTRACKED_MIGRATIONS=$(git ls-files --others --exclude-standard supabase/migrations/ | wc -l)
if [ "$UNTRACKED_MIGRATIONS" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Found $UNTRACKED_MIGRATIONS untracked migration file(s)${NC}"
  git ls-files --others --exclude-standard supabase/migrations/
  echo "Please add them with: git add supabase/migrations/"
  CHECKS_FAILED=1
else
  print_result 0 "No untracked migrations"
fi

echo ""
echo "Step 4: Verifying Supabase types are up to date..."
# Check if types/supabase.ts and app/reference/supabase.types.ts are in sync
if diff -q types/supabase.ts app/reference/supabase.types.ts > /dev/null 2>&1; then
  print_result 0 "Supabase types are in sync"
else
  echo -e "${YELLOW}⚠️  Supabase type files are out of sync${NC}"
  echo "Run: cp types/supabase.ts app/reference/supabase.types.ts"
  CHECKS_FAILED=1
fi

echo ""
echo "Step 5: Checking for large uncommitted changes..."
UNCOMMITTED=$(git diff --cached --numstat | wc -l)
if [ "$UNCOMMITTED" -eq 0 ]; then
  echo -e "${YELLOW}⚠️  No staged changes found${NC}"
  echo "Nothing to commit. Run: git add -A"
else
  echo -e "${GREEN}✅ Found $UNCOMMITTED staged changes${NC}"
fi

echo ""
echo "Step 6: Testing production build..."
echo "This may take 30-60 seconds..."

# Clean .next to avoid cache issues
rm -rf .next > /dev/null 2>&1

# Run build with output capture
if pnpm run build > build-check.log 2>&1; then
  print_result 0 "Production build succeeded"
  rm -f build-check.log
else
  print_result 1 "Production build FAILED"
  echo ""
  echo -e "${RED}Build Error Details:${NC}"
  tail -30 build-check.log
  echo ""
  echo "Full log saved to: build-check.log"
fi

echo ""
echo "Step 7: Checking bundle sizes..."
if [ -f ".next/build-manifest.json" ]; then
  LARGE_CHUNKS=$(find .next/static/chunks -name "*.js" -size +300k 2>/dev/null | wc -l)
  if [ "$LARGE_CHUNKS" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Found $LARGE_CHUNKS chunks over 300KB${NC}"
    find .next/static/chunks -name "*.js" -size +300k -exec ls -lh {} \; 2>/dev/null | awk '{print "  "$9, $5}'
  else
    print_result 0 "No oversized chunks"
  fi
else
  echo -e "${YELLOW}⚠️  Build manifest not found (build may have failed)${NC}"
fi

echo ""
echo "============================="
if [ $CHECKS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All checks passed!${NC}"
  echo ""
  echo "Ready to push. Run:"
  echo "  git push origin main"
  exit 0
else
  echo -e "${RED}❌ Some checks failed${NC}"
  echo ""
  echo "Please fix the issues above before pushing."
  exit 1
fi

