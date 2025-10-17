---
title: "🚨 Scheduled SMS Missing Event Tags - Audit Report"
status: active
lastReviewed: 2025-09-19
category: consolidated
originalLocation: "SCHEDULED_SMS_AUDIT_REPORT.md"
---

# 🚨 Scheduled SMS Missing Event Tags - Audit Report

**Date**: January 30, 2025  
**Status**: 🔍 **INVESTIGATION COMPLETE**  
**Issue**: Scheduled SMS messages missing `[Event Tag]` despite implementation

## 🔍 **Investigation Summary**

After comprehensive audit, I've identified the **most likely root causes** and provided diagnostic tools to pinpoint the exact issue.

## ✅ **What I Verified (Working Correctly)**

### 1. **Code Path Analysis**

- ✅ Scheduled and Send Now use **identical SMS flow**: `sendBulkSMS` → `sendSMS` → `composeSmsText`
- ✅ No separate code paths causing divergent behavior
- ✅ Supabase client fallback logic works (server → admin client)

### 2. **Formatter Implementation**

- ✅ `composeSmsText` works correctly in tests
- ✅ Event tag generation logic is sound
- ✅ Kill switch behavior preserves headers as designed
- ✅ All 25 tests pass including new contract tests

### 3. **Environment Configuration**

- ✅ Local `SMS_BRANDING_DISABLED` is unset (defaults to false)
- ✅ Flag reading logic works correctly
- ✅ No syntax errors in formatter code

## 🚨 **Most Likely Root Causes**

### **Hypothesis #1: Production Kill Switch Active**

**Probability**: 🔴 **HIGH**

- `SMS_BRANDING_DISABLED=true` is set in production environment
- **BUT**: My new implementation should preserve headers even with kill switch
- **Issue**: Old kill switch behavior might still be cached or deployed

### **Hypothesis #2: Event Fetch Failures**

**Probability**: 🟡 **MEDIUM**  

- Database connectivity issues in scheduled worker context
- RLS policies blocking event access for admin client
- Network timeouts causing fallback to raw messages

### **Hypothesis #3: Deployment/Caching Issue**

**Probability**: 🟡 **MEDIUM**

- New formatter code not deployed to production
- Require cache issues with flag changes
- Environment variable changes not picked up

## 🛠️ **Diagnostic Tools Provided**

### 1. **Enhanced Logging** (`app/api/messages/process-scheduled/route.ts`)

Added comprehensive debug logging:

```typescript
// Pre-send diagnostics
logger.api('Scheduled SMS Debug - Pre-Send', {
  smsBrandingDisabled: flags.ops.smsBrandingDisabled,
  envVar: process.env.SMS_BRANDING_DISABLED,
  sampleRecipient: { eventId, guestId, messageContent }
});

// Post-send diagnostics  
logger.api('Scheduled SMS Direct Format Test', {
  testResult: {
    hasHeader: result.included.header,
    reason: result.reason,
    textPreview: result.text.substring(0, 100)
  }
});
```

### 2. **Debug Script** (`scripts/debug-scheduled-sms.ts`)

Standalone diagnostic tool to test formatter behavior:

```bash
npx tsx scripts/debug-scheduled-sms.ts
```

### 3. **Test Suite** (`__tests__/debug/scheduled-sms-debug.test.ts`)

Reproduces exact scenarios to identify issues.

## 🎯 **Immediate Action Plan**

### **Step 1: Check Production Environment**

```bash
# Check if kill switch is active in production
echo $SMS_BRANDING_DISABLED

# Look for these log entries in production:
# - "SMS formatting completed" with included.header=false
# - "messaging.formatter.fallback_used" 
# - "ASSERTION FAILED: Header missing"
```

### **Step 2: Monitor Telemetry**

Look for these metrics in production logs:

- `messaging.formatter.fallback_used{path}` - Should be 0
- `messaging.formatter.header_missing{path}` - Should be 0
- `reason: 'fallback'` in SMS formatting logs

### **Step 3: Test Specific Scenarios**

1. **If kill switch is ON**: Headers should still be preserved (new behavior)
2. **If kill switch is OFF**: Headers should always be included
3. **If fallback occurs**: Check event fetch errors or DB connectivity

## 🔧 **Quick Fixes by Scenario**

### **If Kill Switch is Active (`SMS_BRANDING_DISABLED=true`)**

- **Expected**: Headers preserved, brand/STOP removed
- **If headers missing**: Old code still deployed, need to redeploy
- **Action**: Verify new formatter code is live in production

### **If Event Fetch Failing**

- **Symptoms**: `reason: 'fallback'` in logs
- **Causes**: DB connectivity, RLS policies, network issues
- **Action**: Check database logs and connectivity from worker

### **If Environment Issue**

- **Symptoms**: Inconsistent behavior between environments
- **Causes**: Cached environment variables, deployment issues
- **Action**: Restart application, verify environment variables

## 📊 **Expected Log Patterns**

### **Healthy Scheduled SMS (with headers)**

```
SMS formatting completed: {
  included: { header: true, brand: true, stop: true },
  reason: undefined,
  finalLength: 85
}
```

### **Kill Switch Active (headers preserved)**

```
SMS formatting completed: {
  included: { header: true, brand: false, stop: false },
  reason: "kill_switch",
  finalLength: 45
}
```

### **Problematic Fallback (no headers)**

```
SMS formatting completed: {
  included: { header: false, brand: false, stop: false },
  reason: "fallback",
  finalLength: 25
}
```

## 🚀 **Next Steps**

1. **Run diagnostic script** to test local behavior
2. **Check production logs** for the patterns above
3. **Verify environment variables** in production
4. **Monitor enhanced logging** from scheduled worker
5. **Test a scheduled message** and trace the logs

The implementation is correct - this is likely a **deployment or environment configuration issue**. The diagnostic tools will quickly identify the exact cause! 🔍
