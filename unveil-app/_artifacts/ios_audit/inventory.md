# iOS Readiness Audit - Inventory

**Generated:** 2025-01-08  
**Scope:** iOS/Capacitor/Next.js infrastructure and recent changes  
**Purpose:** Comprehensive inventory for iOS readiness and web stability audit

## 1. Core iOS/Capacitor Configuration

### 1.1 Capacitor Configuration
**File:** `capacitor.config.ts`
- **Environment-driven server config:** `CAP_SERVER_URL` environment variable
- **iOS scheme:** `Unveil` with extensive WebView optimizations
- **Key settings:**
  - `webContentsDebuggingEnabled: true` (duplicated on lines 28 & 40)
  - `backgroundColor: '#FFF5E5'` (consistent across app/splash)
  - `limitsNavigationsToAppBoundDomains: false` (debugging enabled)
  - iOS 26.0 specific optimizations included

### 1.2 iOS Project Structure
**Directory:** `ios/App/`
- **Xcode project:** `App.xcodeproj` ✅
- **Xcode workspace:** `App.xcworkspace` ✅
- **Info.plist:** Comprehensive configuration with Universal Links, ATS, privacy descriptions

### 1.3 Info.plist Key Configurations
- **Bundle ID:** `com.unveil.wedding`
- **Universal Links:** `applinks:app.sendunveil.com`
- **Custom URL Scheme:** `unveil://`
- **ATS Exceptions:** Supabase, production domain, localhost development
- **Privacy Descriptions:** Camera, Photo Library access for wedding media

## 2. Makefile Targets & Script Dependencies

### 2.1 Primary Makefile Targets
```
ios-verify          → ios-speedup.sh + ios-verify-repair.sh
ios-speedup         → ios-speedup.sh only
ios-run-prod        → CAP_SERVER_URL=https://app.sendunveil.com + cap copy + open Xcode
ios-run-dev         → Start dev server + CAP_SERVER_URL=http://localhost:3000 + cap copy + open Xcode
ios-dev-deterministic → ios-dev-deterministic.sh
ios-open            → npx cap open ios
ios-clean           → Remove build artifacts
ios-build-without-pods → ios-build-no-pods.sh (Ruby compatibility)
ios-ruby-check      → Ruby version check for CocoaPods
ios-archive         → ios-archive.sh (TestFlight builds)
```

### 2.2 Script Dependency Graph
```
make ios-verify
├── scripts/ios-speedup.sh
│   ├── Cleanup phase (DerivedData, Pods)
│   ├── Build phase (web assets, cap copy/sync)
│   ├── CocoaPods validation
│   ├── Xcode optimization
│   ├── Timed build analysis
│   └── Simulator preparation
└── scripts/ios-verify-repair.sh
    ├── Audit phase (read-only checks)
    ├── Repair phase (conditional fixes)
    ├── Build target determination
    ├── Simulator destination resolution
    ├── Web target preflight check
    ├── Simulator build
    └── Smoke test execution

make ios-archive
└── scripts/ios-archive.sh
    ├── Temporary iOS layout swap
    ├── Production build
    ├── Capacitor copy
    ├── Xcode archive creation
    └── IPA export for App Store
```

### 2.3 Overlapping Responsibilities
- **CocoaPods installation:** Both `ios-speedup.sh` and `ios-verify-repair.sh`
- **Capacitor copy/sync:** All major scripts perform this operation
- **Build artifact cleanup:** Multiple scripts clean different artifact types
- **Simulator management:** Both speedup and verify scripts handle simulator setup

## 3. Layout & Provider Architecture

### 3.1 Layout Files
- **Primary layout:** `app/layout.tsx` (uses `LeanRootProvider`)
- **iOS-specific layout:** `app/layout-ios.tsx` (uses `Providers` component)
- **iOS-specific page:** `app/page-ios.tsx` (diagnostic/debug page)
- **Minimal page:** `app/page-minimal.tsx` (similar to iOS page)

### 3.2 Provider Hierarchy
```
app/layout.tsx
└── LeanRootProvider (with dynamic imports)
    ├── ErrorBoundary
    ├── ReactQueryProvider (dynamic)
    ├── AuthProvider (dynamic)
    └── RumCollectorWrapper

app/layout-ios.tsx  
└── Providers (static imports only)
    ├── ErrorBoundary
    ├── QueryClientProvider (static)
    ├── MinimalAuthProvider (static)
    └── RumCollectorWrapper
```

### 3.3 Provider Strategy Differences
- **LeanRootProvider:** Uses `next/dynamic` for code splitting
- **Providers:** Uses static imports for deterministic first paint
- **MinimalAuthProvider:** Simplified auth without GuestLinkingManager dependencies

## 4. Recent Commit History Analysis

### 4.1 Key iOS-Related Commits (Last 50)
- **5c072e3** (Latest): "feat: Complete iOS Capacitor setup with successful build"
- **04b4c6c**: "feat(performance): comprehensive mobile performance optimization"
- **d678de5**: "perf: optimize frontend bundle sizes with dynamic imports and provider splitting"
- **75e5b5d**: "chore(icons): add Unveil favicon/app icons & web app manifest"

### 4.2 Provider/Layout Evolution
- **d678de5**: Introduced dynamic imports and provider splitting for performance
- **e86e91b**: Added SubscriptionProvider to GuestProvider
- **d912326**: Fixed providers to resolve Vercel build errors
- **941e234**: Next.js 15 layout props compatibility fixes

## 5. Environment & Build Configuration

### 5.1 Environment Variables
- **CAP_SERVER_URL:** Controls Capacitor server configuration
  - Development: `http://localhost:3000`
  - Production: `https://app.sendunveil.com`
  - Static: `undefined` (uses built assets)

### 5.2 Build Artifacts Location
- **Build logs:** `_artifacts/ios_builds/`
- **Archives:** `_artifacts/ios_builds/App.xcarchive`
- **IPAs:** `_artifacts/ios_builds/App.ipa`
- **Timing logs:** `_artifacts/ios_builds/timing_*.txt`

### 5.3 Xcode Schemes
- **Unveil (Dev):** Development with localhost server
- **Unveil (Prod):** Production with app.sendunveil.com server

## 6. Asset Management

### 6.1 iOS-Specific Assets
- **Icons:** `public/icons/ios/` (PNG format)
- **Splash screens:** `public/splash/ios/` (various device sizes)
- **Universal Links:** `public/.well-known/apple-app-site-association`

### 6.2 Font Loading
- **Inter Variable:** Loaded via `localFont` with preload optimization
- **Fallback chain:** Inter → -apple-system → BlinkMacSystemFont → system-ui → sans-serif

## 7. Development Workflow Scripts

### 7.1 ios-dev-deterministic.sh
- Starts dev server in background
- Temporarily swaps to iOS layout
- Copies assets to iOS
- Opens Xcode with cleanup on exit

### 7.2 ios-archive.sh
- Production build with iOS layout swap
- Creates App Store-ready archive and IPA
- Handles layout restoration on success/failure
- Comprehensive build verification

## 8. Testing & Verification

### 8.1 Smoke Tests
- **File:** `tests/smoke-healthz.spec.ts`
- **Execution:** Integrated into `ios-verify-repair.sh`
- **Purpose:** Validate deterministic first paint

### 8.2 Web Target Preflight
- **Script:** `scripts/check-web-target.ts`
- **Timeout:** 3000ms
- **Purpose:** Verify target URL accessibility before iOS build

## 9. Summary Statistics

- **Total Makefile targets:** 9 iOS-specific targets
- **Total scripts:** 4 primary iOS scripts + 1 helper
- **Layout variants:** 3 (standard, iOS-optimized, minimal)
- **Provider variants:** 2 (dynamic imports vs static imports)
- **Environment configurations:** 3 (dev, prod, static)
- **Recent iOS commits:** 4 major commits in last 50

## 10. Identified Complexity Points

1. **Dual layout system** with runtime/build-time swapping
2. **Overlapping script responsibilities** for common operations
3. **Dynamic vs static import strategies** across different entry points
4. **Multiple provider hierarchies** with different optimization goals
5. **Environment-driven configuration** with multiple code paths
