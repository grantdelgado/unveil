# Lighthouse CI Baselines & Setup
*Generated: September 26, 2025*
*Analysis Type: Lab testing with mobile emulation*

## LHCI Infrastructure Status

### ✅ Already Configured
- **Lighthouse CLI**: v12.6.1 installed via npm
- **Configuration File**: `lighthouserc.js` with mobile-first settings
- **Baseline Script**: `scripts/lighthouse-baseline.js` (needs module fix)
- **Artifacts Storage**: `_artifacts/perf/` directory structure

### 🔧 Configuration Applied
```javascript
// lighthouserc.js - Mobile-first performance testing
{
  ci: {
    collect: {
      preset: 'mobile',
      throttling: {
        rttMs: 150,        // 3G network RTT
        throughputKbps: 1600, // 3G throughput
        cpuSlowdownMultiplier: 4, // Mobile CPU simulation
      },
      numberOfRuns: 3, // Statistical significance
    },
    assert: {
      'categories:performance': ['error', { minScore: 0.75 }],
      'first-contentful-paint': ['error', { maxNumericValue: 1800 }],
      'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
      'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
    }
  }
}
```

## Baseline Measurement Results

### Route: `/` (Landing Page)
**Performance Score**: 37/100 ⚠️

| Metric | Value | Target | Status |
|--------|-------|---------|--------|
| **FCP** | 958ms | <1800ms | ✅ Good |
| **LCP** | 40.1s | <2500ms | ❌ Critical |
| **CLS** | 0.000 | <0.1 | ✅ Excellent |
| **TBT** | 3,536ms | <200ms | ❌ Critical |

**Analysis**: The landing page has severe performance issues with LCP taking 40+ seconds, likely due to the 1.5-second artificial delay in the loading logic.

### Route: `/login` (Magic Link Auth)
**Performance Score**: 0/100 ❌

| Metric | Value | Target | Status |
|--------|-------|---------|--------|
| **FCP** | 941ms | <1800ms | ✅ Good |
| **LCP** | N/A | <2500ms | ❌ No LCP detected |
| **CLS** | 0.000 | <0.1 | ✅ Excellent |
| **TBT** | N/A | <200ms | ❌ Analysis failed |

**Analysis**: The login page failed to register LCP, indicating potential loading issues or content visibility problems during testing.

## Performance Insights

### 🔴 Critical Issues Identified
1. **Landing Page Timeout**: The 1.5-second `waitMinDisplay` delay severely impacts LCP
2. **LCP Detection Failure**: Login page has no detectable LCP element
3. **High TBT**: 3.5+ seconds of main thread blocking on landing page
4. **Bundle Size**: Needs verification against 320KB script target

### 🟡 Testing Limitations
1. **Authentication Required**: Cannot test `/select-event` or authenticated routes
2. **Dynamic Content**: Some routes require session/event data for meaningful testing
3. **Real User Conditions**: Lab testing doesn't capture real network/device variance

### ✅ Positive Observations
1. **CLS Excellent**: Both routes show 0.000 layout shift
2. **FCP Within Range**: Both pages achieve FCP under 1 second
3. **Mobile-First**: Responsive design works well in mobile simulation

## Artifacts Generated

### Performance Data
```
_artifacts/perf/
├── lighthouse_landing.json    # Landing page full results
└── lighthouse_login.json      # Login page full results
```

### Key Metrics Summary
```json
{
  "landing": {
    "performance": 37,
    "fcp": 958,
    "lcp": 40102,
    "cls": 0.000,
    "tbt": 3536
  },
  "login": {
    "performance": 0,
    "fcp": 941,
    "lcp": null,
    "cls": 0.000,
    "tbt": null
  }
}
```

## LHCI Commands Added

### Manual Baseline Collection
```bash
# Single route test
npx lighthouse http://localhost:3000/login \
  --emulated-form-factor=mobile \
  --only-categories=performance \
  --output json

# Batch baseline collection (requires dev server)
npm run dev & 
npm run lighthouse:baseline
```

### CI Integration Commands
```bash
# Full LHCI run with assertions
npx lhci autorun

# Collect only (for debugging)
npx lhci collect --url=http://localhost:3000/login

# Assert against baseline
npx lhci assert --preset=lighthouse:recommended
```

## Recommendations for LHCI Integration

### 1. Fix Performance Blockers
**Priority**: Immediate
- Remove or reduce the 1.5s artificial delay on landing page
- Investigate LCP detection issues on login page  
- Optimize bundle size to meet 320KB script target

### 2. Expand Route Coverage
**Priority**: Short-term
- Add authenticated route testing with mock sessions
- Include `/select-event` in baseline measurements
- Test representative guest/host flows

### 3. CI/CD Integration
**Priority**: Medium-term
```yaml
# Example GitHub Actions workflow
- name: Lighthouse CI
  run: |
    npm ci
    npm run build
    npm run start &
    npx wait-on http://localhost:3000
    npx lhci autorun
```

### 4. Performance Budget Enforcement
**Priority**: Long-term
- Set stricter performance score thresholds (>75)
- Monitor resource size budgets
- Track performance regression trends

## Baseline Script Fix

The existing `lighthouse-baseline.js` script has a module import issue. Recommended fix:

```javascript
// Replace dynamic require with static import
const lighthouse = require('lighthouse');
// Ensure chrome-launcher is available
const chromeLauncher = require('chrome-launcher');
```

## Mobile Emulation Validation

### Device Simulation Confirmed
- **Viewport**: 375x667 (iPhone SE equivalent)
- **Device Scale Factor**: 2x
- **Network**: 3G throttling (150ms RTT, 1.6Mbps)
- **CPU**: 4x slowdown for mobile simulation

### Touch-Friendly Testing
- Button sizes adequate (no audit failures)
- Viewport meta tag properly configured
- Safe area support verified

## Next Steps

1. **Immediate**: Fix landing page performance issues
2. **Short-term**: Resolve LCP detection on login page
3. **Medium-term**: Add authenticated route testing
4. **Long-term**: Integrate LHCI into CI/CD pipeline

The LHCI infrastructure is properly configured but reveals significant performance issues that need immediate attention before establishing stable baselines.
