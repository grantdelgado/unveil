# Performance Scripts

This directory contains automated performance validation and monitoring scripts.

## Available Scripts

### `performance-check.js`

**Purpose:** Automated bundle size validation and performance checking  
**Usage:**

```bash
# Run performance check only
pnpm perf:check

# Run build + performance check
pnpm build:check
```

**Features:**

- Bundle size validation (350KB warning, 500KB error)
- Page-specific target checking
- Build manifest analysis
- Static asset validation
- JSON report generation

**Output:** `performance/reports/performance-report.json`

### Configuration

The script uses the following thresholds:

- **Bundle Size Warning:** 350KB
- **Bundle Size Error:** 500KB
- **Total Client Bundle Limit:** 5MB
- **Page Targets:**
  - Host Dashboard: <300KB
  - Guest Home: <250KB
  - Select Event: <300KB

### Integration

- Integrated with `pnpm build:check` for CI/CD
- Generates detailed reports for tracking
- Fails build on critical performance regressions
