# RSVP-Lite Audit Matrix

**📅 Date**: January 2025  
**🎯 Goal**: Identify and fix remaining legacy RSVP UI when RSVP-Lite is enabled  
**📊 Status**: 🔍 Discovery Complete - Issues Identified

---

## 🔍 **Audit Results**

| Surface | Expected with RSVP-Lite | Actual Behavior | Data Source | Flag Gate Used | Component File | Status |
|---------|-------------------------|-----------------|-------------|----------------|---------------|---------|
| **Guest Event Home** | "Can't make it?" button visible | ✅ Implemented | N/A | ✅ `getFeatureFlag('RSVP_LITE')` | `app/guest/events/[eventId]/home/page.tsx` | ✅ **WORKING** |
| **Select-Event Cards** | No "RSVP Needed" badges | ✅ Removed | N/A | ❌ No flag gate | `app/select-event/page.tsx` | ✅ **FIXED** |
| **Host Dashboard - RSVP Status Card** | "Attending (declined excluded)" count | ❌ Still shows legacy 4-status | `rsvp_status` from DB | ❌ No flag gate | `components/features/host-dashboard/EventSummaryCard.tsx` | ❌ **NEEDS FIX** |
| **Host Dashboard - Guest Status Card** | Attending = `declined_at IS NULL` | ❌ Still uses `rsvp_status` | `rsvp_status` from DB | ❌ No flag gate | `components/features/host-dashboard/GuestStatusCard.tsx` | ❌ **NEEDS FIX** |
| **Guest Management - Filter Pills** | All / Attending / Declined only | ❌ Still shows Pending/Maybe/Attending/Declined | `rsvp_status` counts | ❌ No flag gate | `components/features/host-dashboard/GuestStatusSummary.tsx` | ❌ **NEEDS FIX** |
| **Guest Management - List Items** | RSVP dropdown + decline indicators | ✅ Both implemented | Mixed | ❌ No flag gate | `components/features/host-dashboard/GuestListItem.tsx` | ⚠️ **PARTIAL** |
| **Recipient Composer** | Default "Attending" (excludes declined) | ✅ Implemented | RSVP-Lite logic | ❌ No flag gate | `components/features/messaging/host/MessageComposer.tsx` | ✅ **WORKING** |
| **Recipient Preview** | Show attending/declined status | ✅ Updated to RSVP-Lite | RSVP-Lite logic | ❌ No flag gate | `components/features/messaging/host/RecipientPreview.tsx` | ✅ **WORKING** |
| **Analytics/Charts** | Attending = `declined_at IS NULL` | ❌ Still uses legacy `rsvp_status` | `rsvp_status` counts | ❌ No flag gate | `components/features/host-dashboard/EventAnalytics.tsx` | ❌ **NEEDS FIX** |

---

## 🚨 **Key Issues Identified**

### **1. Legacy Count Calculations**
**Problem**: Most host dashboard components still calculate "attending" using `rsvp_status = 'attending'` instead of RSVP-Lite logic (`declined_at IS NULL`).

**Components Affected**:
- `GuestStatusCard.tsx` - Lines 37-53 (uses `rsvp_status`)
- `EventSummaryCard.tsx` - Lines 40-53 (uses `rsvp_status`) 
- `GuestStatusSummary.tsx` - Lines 144-178 (uses `rsvp_status`)
- `EventAnalytics.tsx` - Lines 109-120 (uses `rsvp_status`)

### **2. Missing Feature Flag Gates**
**Problem**: Host dashboard components don't check RSVP-Lite flags and always show legacy UI.

**Components Affected**:
- All host dashboard status/analytics components
- Guest management filter pills
- RSVP progress charts

### **3. Mixed Data Sources**
**Problem**: Some components use RSVP-Lite logic while others use legacy `rsvp_status`, causing inconsistent counts.

### **4. Client/Server Flag Consistency**
**Problem**: Feature flag system may not work correctly on client-side (browser environment).

---

## 🎯 **Required Fixes**

### **High Priority**
1. **Update Count Calculations**: Change all "attending" counts to use `declined_at IS NULL` logic
2. **Add Feature Flag Gates**: Wrap legacy RSVP UI in `!getFeatureFlag('RSVP_LITE')` checks
3. **Unify Data Sources**: Ensure all components use consistent RSVP-Lite logic

### **Medium Priority**  
4. **Update Filter Pills**: Replace 4-status filters with Attending/Declined only
5. **Fix Progress Charts**: Update to show RSVP-Lite semantics

### **Low Priority**
6. **Cleanup Legacy Code**: Remove unused RSVP status configurations when RSVP-Lite is enabled

---

## 🧪 **Test Scenarios**

### **Guest Experience**
- [ ] Navigate to guest event home
- [ ] Verify "Can't make it?" button is visible
- [ ] Complete decline flow with reason
- [ ] Verify decline banner appears
- [ ] Verify no legacy RSVP UI visible

### **Host Experience**  
- [ ] Check host dashboard shows correct "Attending" counts (excludes declined)
- [ ] Verify guest management shows decline indicators
- [ ] Test "Clear decline" functionality
- [ ] Verify messaging defaults to "Attending" filter
- [ ] Test "Include declined" toggle

### **Flag Consistency**
- [ ] Check browser console for feature flag logs
- [ ] Verify same flag values on server and client
- [ ] Test flag toggling in development

---

## 📝 **Runtime Flag Logs**

*To be populated during testing - logs will appear in browser console for:*
- Guest Event Home: `[FEATURE FLAGS] Guest Event Home: {RSVP_LITE: true, role: 'guest', route: '/guest/events/[id]/home'}`
- Host Dashboard: `[FEATURE FLAGS] Host Dashboard: {RSVP_LITE: true, role: 'host', route: '/host/events/[id]/dashboard'}`  
- Guest Management: `[FEATURE FLAGS] Guest Management: {RSVP_LITE: true, role: 'host', route: '/host/events/[id]/guests'}`

---

## ✅ **Success Criteria**

- [ ] All host dashboard counts use RSVP-Lite logic (`declined_at IS NULL`)
- [ ] Legacy RSVP UI hidden when RSVP-Lite enabled
- [ ] "Can't make it?" visible for guests, not hosts
- [ ] Messaging excludes declined guests by default
- [ ] Feature flag logs show consistent values
- [ ] End-to-end guest decline → host composer flow works
