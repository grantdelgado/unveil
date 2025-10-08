# iOS Readiness Audit - Sanity Tests

**Generated:** 2025-01-08  
**Test Environment:** macOS with Xcode, iPhone 17 Pro Simulator  
**Dev Server:** http://localhost:3000  

## 1. Web Health Tests

### 1.1 Development Server Status
- **Command:** `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/healthz`
- **Result:** ✅ **200** - Health endpoint responding
- **Server Start:** Successfully started with `pnpm dev --hostname 0.0.0.0`

### 1.2 Main Route Test
- **Command:** `curl -s http://localhost:3000/`
- **Result:** ❌ **CSR BAILOUT DETECTED**

**Critical Finding:** Server-side rendering fails with bailout error:
```
Error: Bail out to client-side rendering: next/dynamic
```

**Root Cause:** Dynamic imports in `LeanRootProvider` causing SSR to bail out to client-side rendering.

**Impact:** Non-deterministic first paint timing, potential white screen on iOS WebView.

### 1.3 HTML Structure Analysis
- **DOCTYPE:** ✅ Proper HTML5 DOCTYPE
- **Meta tags:** ✅ Comprehensive mobile optimization meta tags
- **Font loading:** ✅ Inter variable font with proper fallbacks
- **PWA manifest:** ✅ Manifest linked correctly
- **Apple-specific tags:** ✅ Apple touch icons and PWA meta tags present

## 2. iOS Simulator Tests

### 2.1 Xcode Workspace Analysis
- **Workspace:** `ios/App/App.xcworkspace` ✅ EXISTS
- **Available Schemes:**
  - `Capacitor` ✅
  - `CapacitorCordova` ✅
  - `Pods-App` ✅
  - `Unveil (Dev)` ✅
  - `Unveil (Prod)` ✅

**Issue Found:** Scripts reference scheme `"App"` but actual schemes are `"Unveil (Dev)"` and `"Unveil (Prod)"`

### 2.2 iOS Verification Script Test
- **Command:** `make ios-verify`
- **Result:** ❌ **FAILED** - Scheme name mismatch

**Error Details:**
```
xcodebuild: error: The workspace named "App" does not contain a scheme named "App".
```

**Scripts Affected:**
- `scripts/ios-speedup.sh`
- `scripts/ios-verify-repair.sh`

### 2.3 Simulator Environment
- **Available Simulators:** ✅ iPhone 17 Pro, iPhone 17 Pro Max, iPhone Air, iPhone 17, iPhone 16e
- **Selected Simulator:** iPhone 17 Pro (93C13956-615F-473A-BF55-925075B4469A)
- **Boot Status:** ✅ Successfully booted
- **Screenshot Capture:** ✅ Captured to `_artifacts/ios_audit/sim_first_paint.png`

### 2.4 Device Logs Collection
- **Log Collection:** ✅ Attempted device log collection
- **Predicate:** `subsystem contains "com.unveil.wedding"`
- **Result:** No app-specific logs found (expected, as app wasn't launched)
- **Log File:** `_artifacts/ios_audit/sim_device_log.txt`

## 3. Build Configuration Issues

### 3.1 Scheme Name Inconsistency
**Problem:** Scripts hardcode scheme name as "App" but actual schemes are:
- `Unveil (Dev)` - for development with localhost
- `Unveil (Prod)` - for production with app.sendunveil.com

**Files Requiring Updates:**
- `scripts/ios-speedup.sh` (line ~103, ~250)
- `scripts/ios-verify-repair.sh` (line ~218)
- `Makefile` may need scheme specification

### 3.2 CAP_SERVER_URL Configuration
- **Development:** `http://localhost:3000` ✅ WORKING
- **Production:** `https://app.sendunveil.com` (not tested)
- **Environment Variable:** Properly recognized by `capacitor.config.ts`

## 4. Performance Timing Analysis

### 4.1 Web Performance Issues
**CSR Bailout Impact:**
- Server-side rendering fails completely
- Client must download and execute all JavaScript before first paint
- Potential for white screen during JavaScript loading
- Non-deterministic timing based on network and device performance

### 4.2 Expected iOS WebView Impact
**Predicted Issues:**
- Longer time to first paint (3-5 seconds instead of <1 second)
- White screen during JavaScript loading phase
- Potential timeout issues on slower devices
- Inconsistent loading experience

## 5. Asset Verification

### 5.1 iOS Assets Status
**Icons:** Not verified (would require full build)
**Splash Screens:** Not verified (would require full build)
**Universal Links:** `public/.well-known/apple-app-site-association` (not tested)

### 5.2 Capacitor Configuration
- **App ID:** `com.unveil.wedding` ✅
- **Server URL:** Dynamic based on `CAP_SERVER_URL` ✅
- **iOS Settings:** Comprehensive WebView optimizations ✅

## 6. Test Results Summary

### 6.1 PASSING Tests ✅
- Development server startup and health endpoint
- HTML structure and meta tags
- Xcode workspace and scheme detection
- Simulator boot and screenshot capture
- Environment variable configuration

### 6.2 FAILING Tests ❌
- **CRITICAL:** Server-side rendering with CSR bailout
- **CRITICAL:** iOS verification script scheme name mismatch
- **MEDIUM:** No app-specific device logs (expected without app launch)

### 6.3 BLOCKED Tests ⏸️
- Full iOS app launch (blocked by scheme name issue)
- First paint timing measurement (blocked by build failure)
- Universal Links testing (blocked by app launch failure)

## 7. Immediate Action Items

### 7.1 High Priority Fixes
1. **Fix CSR bailout** by eliminating dynamic imports from root providers
2. **Update scheme names** in all iOS scripts from "App" to "Unveil (Dev)"/"Unveil (Prod)"
3. **Test full iOS build** after scheme name fixes

### 7.2 Verification Steps
1. Implement static provider imports
2. Update script scheme references
3. Re-run `make ios-verify` with corrected configuration
4. Capture successful app launch screenshot
5. Measure first paint timing

## 8. Test Environment Details

- **macOS Version:** Darwin 24.6.0
- **Xcode Version:** Available (command line tools confirmed)
- **Node.js:** pnpm package manager available
- **Simulator:** iPhone 17 Pro (iOS latest)
- **Network:** Development server on localhost:3000
- **Timestamp:** 2025-01-08 22:52:59

## 9. Artifacts Generated

- `_artifacts/ios_audit/sim_first_paint.png` - Simulator home screen screenshot
- `_artifacts/ios_audit/sim_device_log.txt` - Device logs (empty, as expected)
- `_artifacts/ios_audit/ios_verify_sample.txt` - iOS verification script output sample

## 10. Next Steps for Complete Testing

1. **Apply fixes** from proposal document
2. **Re-run full test suite** with corrected configuration
3. **Measure performance** with deterministic first paint
4. **Validate Universal Links** and deep linking
5. **Test production build** and archive process
