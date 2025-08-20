# Production Deployment Fix - Guest Messaging Read-Only

## Issue Summary
Production is showing guest reply UI ("Replies enabled", "Send a response" button) while development shows the correct read-only implementation ("Announcements from your hosts").

## Root Cause
Production deployment is running an older version of the codebase that had guest replies enabled. The current codebase (commit `1a46eff`) correctly implements read-only guest messaging.

## Current State Verification
- **Local/Dev**: ✅ Read-only guest messaging (correct)
- **Production**: ❌ Guest reply UI visible (outdated)
- **Database RLS**: ✅ Correctly blocks guest message inserts
- **Current Commit**: `1a46eff31e35eeb9a9e9792a1adc0c2b1ba751ee`

## Immediate Fix Required

### 1. Force Production Deployment
```bash
# Ensure we're on the latest commit
git status
git log --oneline -1

# Force push to trigger new deployment
git commit --allow-empty -m "fix: force production deployment for guest messaging read-only"
git push origin main
```

### 2. Verify Deployment
- Check Vercel deployment dashboard
- Confirm deployment hash matches local: `1a46eff`
- Test production URL with guest credentials

### 3. Clear Caches
After deployment:
- Purge Vercel Edge cache
- Clear CDN cache if applicable
- Test in incognito browser

## Expected Result
After successful deployment, production should show:
- ✅ "Announcements from your hosts" footer
- ✅ No reply composer or input field
- ✅ No "Send a response" button
- ✅ Identical behavior to development

## Verification Steps
1. Load guest event page in production
2. Scroll to bottom of Event Messages card
3. Confirm footer shows "Announcements from your hosts"
4. Confirm no reply input or button is visible
5. Test with multiple events/guests to ensure consistency

## Defensive Measures Applied
- Removed unused `GuestMessageInput` export
- Added cache-busting for guest routes
- Created defensive API route blocking guest replies
- Enhanced documentation comments
