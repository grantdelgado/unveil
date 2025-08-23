# Feature Flags — Centralized Management & Policy

**Status**: ✅ **ACTIVE**  
**Owner**: Platform Team  
**Last Updated**: January 30, 2025

## 🎯 Overview

Unveil uses a minimal, centralized approach to feature flags. Only essential operational flags are maintained long-term. All flags are defined in `config/flags.ts` as the single source of truth.

## 🏁 Current Active Flags

### **SMS_BRANDING_DISABLED** (Operational Kill Switch)

**Purpose**: Emergency rollback for SMS branding system  
**Owner**: Platform Team  
**Default**: `false` (branding enabled)  
**Risk Level**: 🔴 **HIGH** - affects all SMS delivery

#### Usage
```typescript
import { flags } from '@/config/flags';

if (flags.ops.smsBrandingDisabled) {
  // Use legacy SMS format
  return { text: rawMessage };
}
```

#### Environment Variable
```bash
# Enable SMS branding (default behavior)
SMS_BRANDING_DISABLED=false

# Disable SMS branding (emergency rollback)
SMS_BRANDING_DISABLED=true
```

#### When to Use
- **Emergency**: SMS delivery issues with new branding format
- **Compliance**: Regulatory concerns with A2P messaging
- **Testing**: Validate legacy format behavior

#### Rollback Process
1. Set environment variable: `SMS_BRANDING_DISABLED=true`
2. Restart application (no code deployment needed)
3. All new SMS will use legacy format (no event tags, no A2P footer)
4. Monitor SMS delivery metrics
5. Investigate and fix root cause
6. Re-enable: `SMS_BRANDING_DISABLED=false`

#### Legacy Behavior (When Disabled)
- No event tags prepended to messages
- No A2P "Reply STOP to opt out" footer
- Direct message body sent to Twilio
- No recipient snapshot tracking

---

## 📋 Temporary Flag Policy

Temporary flags are **strongly discouraged** but may be used for:
- Short-term rollouts (< 2 weeks)
- A/B testing (< 1 month)
- Emergency feature toggles

### **Requirements for Temporary Flags**

All temporary flags **MUST** include:

```typescript
// @flag TEMP owner=john remove_by=2025-02-15 description="Guest UI rollout"
```

**Required Fields**:
- `owner`: GitHub username responsible for removal
- `remove_by`: ISO date when flag must be removed
- `description`: Brief explanation of purpose

### **CI Protection**

The CI pipeline runs `pnpm check:flags` to:
- ✅ Validate all temporary flags have required metadata
- ⚠️  Warn about flags expiring within 7 days
- ❌ **Fail builds** if any flags are past their `remove_by` date

### **Temporary Flag Lifecycle**

1. **Add Flag**: Include proper annotation
2. **Monitor**: CI warns 7 days before expiry
3. **Remove**: Delete flag and inline behavior before deadline
4. **Cleanup**: Remove dead code branches

---

## 🛠 Implementation Guidelines

### **Adding New Operational Flags**

1. **Justify Need**: Must be essential for ops/emergency use
2. **Update Config**: Add to `config/flags.ts`
3. **Document**: Add section to this file
4. **Test**: Verify both enabled/disabled states
5. **Monitor**: Add metrics for flag usage

### **Flag Naming Convention**

```typescript
export const flags = {
  ops: {
    // Use camelCase, descriptive names
    smsBrandingDisabled: envBool('SMS_BRANDING_DISABLED', false),
    // paymentProcessingDisabled: envBool('PAYMENT_PROCESSING_DISABLED', false),
  },
} as const;
```

### **Environment Variable Convention**

- **Format**: `FEATURE_NAME_DISABLED` or `FEATURE_NAME_ENABLED`
- **Values**: `'true'` or `'false'` (strings)
- **Default**: Safe production behavior
- **Documentation**: Include in deployment guides

---

## 🧪 Testing Flag Behavior

### **Unit Tests**

```typescript
describe('Feature Flag', () => {
  beforeEach(() => {
    delete process.env.SMS_BRANDING_DISABLED;
  });

  it('should use branding by default', () => {
    expect(flags.ops.smsBrandingDisabled).toBe(false);
  });

  it('should disable branding when flag set', () => {
    process.env.SMS_BRANDING_DISABLED = 'true';
    // Re-import to get updated flag value
    expect(flags.ops.smsBrandingDisabled).toBe(true);
  });
});
```

### **Integration Tests**

All operational flags must have integration tests covering:
- ✅ Default behavior (flag disabled)
- ✅ Alternate behavior (flag enabled)
- ✅ Error handling in both states
- ✅ Metrics/logging differences

---

## 🚨 Emergency Procedures

### **Immediate Flag Toggle**

For production emergencies:

1. **Vercel Dashboard** → Project Settings → Environment Variables
2. Set `SMS_BRANDING_DISABLED=true`
3. **Redeploy** or wait for next deployment
4. **Monitor** application logs and metrics
5. **Document** incident and root cause

### **Rollback Checklist**

- [ ] Flag toggled in production environment
- [ ] Application restarted/redeployed
- [ ] Metrics show expected behavior change
- [ ] No new errors in application logs
- [ ] SMS delivery rates remain stable
- [ ] Incident documented with timeline

---

## 📊 Monitoring & Metrics

### **Flag Usage Tracking**

```typescript
import { flags } from '@/config/flags';
import { logger } from '@/lib/logger';

// Log flag state on application startup
logger.info('Feature flags initialized', {
  smsBrandingDisabled: flags.ops.smsBrandingDisabled,
});
```

### **Key Metrics to Monitor**

- **SMS Delivery Rate**: Should remain stable regardless of flag state
- **Error Rates**: Watch for spikes when toggling flags
- **User Experience**: Monitor support tickets for SMS-related issues
- **Performance**: Flag checks should have minimal overhead

---

## 🔄 Migration from Old System

### **Removed Flags** (January 2025)

- ❌ `NEXT_PUBLIC_ENABLE_RECIPIENT_SNAPSHOT` - Feature shipped
- ❌ `NEXT_PUBLIC_ENABLE_READMODEL_ANALYTICS` - Temporary rollout complete
- ❌ `NEXT_PUBLIC_MESSAGES_READMODEL_V2` - Migration complete
- ❌ `GUEST_UI_CENTERED_MODAL` - UI changes shipped
- ❌ `GUEST_UI_STABLE_HEADER` - UI changes shipped
- ❌ `lib/constants/features.ts` - Replaced by `config/flags.ts`

### **Benefits of New System**

- 🎯 **Focused**: Only essential operational flags
- 🔒 **Type Safe**: Full TypeScript support
- 📝 **Documented**: Each flag has clear purpose and usage
- 🛡️ **Protected**: CI prevents overdue temporary flags
- 🔧 **Centralized**: Single source of truth in `config/flags.ts`

---

## 📚 Related Documentation

- [SMS Branding Configuration](./SMS_BRANDING_CONFIG.md)
- [Deployment Environment Setup](./development/DEPLOYMENT.md)
- [Emergency Runbooks](./debugging/COMPLETE_SMS_SOLUTION.md)

---

**Remember**: Feature flags add complexity. Use sparingly and remove promptly. When in doubt, ship the feature properly instead of hiding it behind a flag.
