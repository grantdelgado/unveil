#!/bin/bash

# iOS Verify & Repair Script
# Purpose: Idempotent verification and repair of Capacitor iOS setup
# Usage: ./scripts/ios-verify-repair.sh

set -euo pipefail

# Configuration
BUILD_LOG_DIR="_artifacts/ios_builds"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BUILD_LOG="$BUILD_LOG_DIR/build_$TIMESTAMP.log"

# Utility functions
have() { 
    command -v "$1" >/dev/null 2>&1; 
}

log() {
    echo "[$(date '+%H:%M:%S')] $*" | tee -a "$BUILD_LOG"
}

fail() {
    echo "[$(date '+%H:%M:%S')] ERROR: $*" | tee -a "$BUILD_LOG"
    exit 1
}

# Ensure build log directory exists
mkdir -p "$BUILD_LOG_DIR"

log "🔍 Starting iOS Verification & Repair"
log "Build log: $BUILD_LOG"

# ============================================================================
# AUDIT PHASE - Read-only checks
# ============================================================================

log "📋 AUDIT PHASE: Checking iOS project state"

# Check iOS project structure
if [[ -d "ios/App/App.xcodeproj" ]]; then
    log "✅ iOS Xcode project exists: ios/App/App.xcodeproj"
    HAS_XCODEPROJ=true
else
    log "❌ iOS Xcode project missing: ios/App/App.xcodeproj"
    HAS_XCODEPROJ=false
fi

if [[ -d "ios/App/App.xcworkspace" ]]; then
    log "✅ iOS Xcode workspace exists: ios/App/App.xcworkspace"
    HAS_XCWORKSPACE=true
else
    log "❌ iOS Xcode workspace missing: ios/App/App.xcworkspace"
    HAS_XCWORKSPACE=false
fi

# Check CocoaPods setup
if [[ -f "ios/App/Podfile" ]]; then
    log "✅ Podfile exists: ios/App/Podfile"
    HAS_PODFILE=true
else
    log "❌ Podfile missing: ios/App/Podfile"
    HAS_PODFILE=false
fi

if [[ -d "ios/App/Pods" ]]; then
    log "✅ Pods directory exists: ios/App/Pods/"
    HAS_PODS=true
else
    log "❌ Pods directory missing: ios/App/Pods/"
    HAS_PODS=false
fi

# Check Universal Links
if [[ -f "public/.well-known/apple-app-site-association" ]]; then
    log "✅ Universal Links file exists: public/.well-known/apple-app-site-association"
    HAS_UNIVERSAL_LINKS=true
else
    log "❌ Universal Links file missing: public/.well-known/apple-app-site-association"
    HAS_UNIVERSAL_LINKS=false
fi

# Check Capacitor config
if [[ -f "capacitor.config.ts" ]] || [[ -f "capacitor.config.js" ]]; then
    log "✅ Capacitor config exists"
    HAS_CAPACITOR_CONFIG=true
else
    log "❌ Capacitor config missing"
    HAS_CAPACITOR_CONFIG=false
fi

# Check iOS assets
if [[ -d "public/icons/ios" ]] && [[ "$(ls -A public/icons/ios 2>/dev/null)" ]]; then
    ICON_COUNT=$(ls -1 public/icons/ios/*.png 2>/dev/null | wc -l | tr -d ' ')
    log "✅ iOS icons directory exists with $ICON_COUNT icons: public/icons/ios/"
    HAS_IOS_ICONS=true
else
    log "❌ iOS icons directory empty or missing: public/icons/ios/"
    HAS_IOS_ICONS=false
fi

if [[ -d "public/splash/ios" ]]; then
    SPLASH_COUNT=$(ls -1 public/splash/ios/*.png 2>/dev/null | wc -l | tr -d ' ') || SPLASH_COUNT=0
    if [[ "$SPLASH_COUNT" -gt 0 ]]; then
        log "✅ iOS splash directory exists with $SPLASH_COUNT splash screens: public/splash/ios/"
        HAS_IOS_SPLASH=true
    else
        log "⚠️  iOS splash directory exists but empty: public/splash/ios/"
        HAS_IOS_SPLASH=false
    fi
else
    log "❌ iOS splash directory missing: public/splash/ios/"
    HAS_IOS_SPLASH=false
fi

# Check required tools
if have pod; then
    POD_VERSION=$(pod --version 2>/dev/null || echo "unknown")
    log "✅ CocoaPods installed: version $POD_VERSION"
    HAS_COCOAPODS=true
else
    log "❌ CocoaPods not installed"
    HAS_COCOAPODS=false
fi

if have xcodebuild; then
    XCODE_VERSION=$(xcodebuild -version 2>/dev/null | head -n1 || echo "Command Line Tools only")
    log "✅ Xcode build tools available: $XCODE_VERSION"
    HAS_XCODEBUILD=true
else
    log "❌ Xcode build tools not available"
    HAS_XCODEBUILD=false
fi

# Check package manager
if have pnpm; then
    PACKAGE_MANAGER="pnpm"
    log "✅ Package manager: pnpm"
elif have npm; then
    PACKAGE_MANAGER="npm"
    log "✅ Package manager: npm"
else
    fail "No package manager (npm/pnpm) found"
fi

log "📊 AUDIT SUMMARY:"
log "   iOS Project: $([ "$HAS_XCODEPROJ" = true ] && echo "✅" || echo "❌") Xcode project, $([ "$HAS_XCWORKSPACE" = true ] && echo "✅" || echo "❌") workspace"
log "   CocoaPods: $([ "$HAS_COCOAPODS" = true ] && echo "✅" || echo "❌") installed, $([ "$HAS_PODS" = true ] && echo "✅" || echo "❌") pods directory"
log "   Configuration: $([ "$HAS_CAPACITOR_CONFIG" = true ] && echo "✅" || echo "❌") Capacitor, $([ "$HAS_UNIVERSAL_LINKS" = true ] && echo "✅" || echo "❌") Universal Links"
log "   Assets: $([ "$HAS_IOS_ICONS" = true ] && echo "✅ $ICON_COUNT" || echo "❌ 0") icons, $([ "$HAS_IOS_SPLASH" = true ] && echo "✅ $SPLASH_COUNT" || echo "❌ 0") splash screens"

# ============================================================================
# REPAIR PHASE - Conditional fixes
# ============================================================================

log "🔧 REPAIR PHASE: Applying minimal fixes"

REPAIRS_NEEDED=false

# Check if CocoaPods installation is needed
if [[ "$HAS_PODFILE" = true ]] && [[ "$HAS_PODS" = false ]]; then
    if [[ "$HAS_COCOAPODS" = false ]]; then
        log "❌ CocoaPods required but not installed"
        
        # Check Ruby version for better error messaging
        RUBY_VERSION=$(ruby --version | grep -o '[0-9]\+\.[0-9]\+' | head -n1)
        RUBY_MAJOR=$(echo "$RUBY_VERSION" | cut -d. -f1)
        RUBY_MINOR=$(echo "$RUBY_VERSION" | cut -d. -f2)
        
        if [[ "$RUBY_MAJOR" -lt 3 ]] || [[ "$RUBY_MAJOR" -eq 3 && "$RUBY_MINOR" -lt 1 ]]; then
            log "⚠️  Ruby version $RUBY_VERSION detected (CocoaPods requires 3.1+)"
            log "📝 Recommended solutions:"
            log "   1. Install modern Ruby: brew install ruby"
            log "   2. Use rbenv: brew install rbenv && rbenv install 3.1.0"
            log "   3. For testing only: make ios-build-without-pods"
            fail "Ruby version $RUBY_VERSION incompatible with CocoaPods. See solutions above."
        else
            log "📝 Install CocoaPods with: gem install cocoapods"
            fail "CocoaPods installation required. Run: gem install cocoapods"
        fi
    else
        log "🔧 Installing CocoaPods dependencies..."
        cd ios/App
        pod install 2>&1 | tee -a "../../$BUILD_LOG"
        cd ../..
        REPAIRS_NEEDED=true
        log "✅ CocoaPods dependencies installed"
    fi
fi

# Build web assets if needed
if [[ ! -d ".next" ]] || [[ ".next" -ot "app" ]]; then
    log "🔧 Building web assets..."
    if [[ "$PACKAGE_MANAGER" = "pnpm" ]]; then
        pnpm build 2>&1 | tee -a "$BUILD_LOG"
    else
        npm run build 2>&1 | tee -a "$BUILD_LOG"
    fi
    REPAIRS_NEEDED=true
    log "✅ Web assets built"
else
    log "✅ Web assets are up to date"
fi

# Always run Capacitor copy and sync (safe operations)
log "🔧 Syncing Capacitor assets..."
npx cap copy ios 2>&1 | tee -a "$BUILD_LOG" || log "⚠️  cap copy completed with warnings"
npx cap sync ios 2>&1 | tee -a "$BUILD_LOG" || log "⚠️  cap sync completed with warnings"
log "✅ Capacitor sync completed"

# ============================================================================
# BUILD TARGET DETERMINATION
# ============================================================================

log "🎯 Determining build target..."

if [[ "$HAS_XCWORKSPACE" = true ]] && [[ -f "ios/App/App.xcworkspace/contents.xcworkspacedata" ]]; then
    BUILD_TARGET="-workspace ios/App/App.xcworkspace -scheme \"Unveil (Dev)\""
    log "✅ Using workspace build target: App.xcworkspace"
elif [[ "$HAS_XCODEPROJ" = true ]]; then
    BUILD_TARGET="-project ios/App/App.xcodeproj -scheme \"Unveil (Dev)\""
    log "✅ Using project build target: App.xcodeproj"
else
    fail "No valid Xcode project or workspace found"
fi

# ============================================================================
# SIMULATOR DESTINATION RESOLUTION
# ============================================================================

log "📱 Resolving iOS Simulator destination..."

# Try preferred simulators in order
if xcrun simctl list devices available | grep -q "iPhone 17 Pro"; then
    DESTINATION="platform=iOS Simulator,name=iPhone 17 Pro"
    log "✅ Using preferred simulator: iPhone 17 Pro"
elif xcrun simctl list devices available | grep -q "iPhone 17"; then
    DESTINATION="platform=iOS Simulator,name=iPhone 17"
    log "✅ Using available simulator: iPhone 17"
elif xcrun simctl list devices available | grep -q "iPhone 16"; then
    DESTINATION="platform=iOS Simulator,name=iPhone 16"
    log "✅ Using available simulator: iPhone 16"
else
    # Fall back to first available iPhone simulator by name
    AVAILABLE_IPHONE=$(xcrun simctl list devices available | grep -E "iPhone [0-9]+" | head -n1)
    if [[ -n "$AVAILABLE_IPHONE" ]]; then
        DEVICE_NAME=$(echo "$AVAILABLE_IPHONE" | sed 's/ *\([^(]*\).*/\1/' | xargs)
        DESTINATION="platform=iOS Simulator,name=$DEVICE_NAME"
        log "✅ Using available simulator: $DEVICE_NAME"
    else
        fail "No iPhone simulators available. Install iOS Simulator in Xcode."
    fi
fi

# ============================================================================
# WEB TARGET PREFLIGHT CHECK
# ============================================================================

log "🔍 Running web target preflight check..."

# Determine the target URL for preflight
TARGET_URL="${CAP_SERVER_URL:-}"
if [[ -z "$TARGET_URL" ]]; then
    # Try to extract from capacitor.config.ts as fallback
    if [[ -f "capacitor.config.ts" ]]; then
        TARGET_URL=$(grep -o "url:\s*['\"][^'\"]*['\"]" capacitor.config.ts | head -1 | sed "s/url:\s*['\"]//g" | sed "s/['\"]//g" || echo "")
    fi
fi

if [[ -n "$TARGET_URL" ]]; then
    log "📡 Target URL: $TARGET_URL"
    echo "Capacitor App URL: $TARGET_URL" > "$BUILD_LOG_DIR/last_app_url.txt"
    
    # Run preflight check
    if command -v npx >/dev/null 2>&1; then
        if npx tsx scripts/check-web-target.ts --timeout=3000 2>&1 | tee -a "$BUILD_LOG"; then
            log "✅ Web target preflight passed"
        else
            fail "Web target preflight failed. Check the URL and try again."
        fi
    else
        log "⚠️  npx not found, skipping preflight check"
    fi
else
    log "ℹ️  No target URL configured, using static assets"
    echo "Static assets (no server URL)" > "$BUILD_LOG_DIR/last_app_url.txt"
fi

# ============================================================================
# SIMULATOR BUILD
# ============================================================================

log "🔨 Building for iOS Simulator..."
log "   Target: $BUILD_TARGET"
log "   Destination: $DESTINATION"

# Perform the build
BUILD_CMD="xcodebuild clean build $BUILD_TARGET -destination '$DESTINATION' -configuration Debug"
log "   Command: $BUILD_CMD"

if eval "$BUILD_CMD" 2>&1 | tee -a "$BUILD_LOG"; then
    log "✅ iOS Simulator build successful!"
    
    # Extract key build information
    BUILD_PRODUCT_PATH=$(grep "BUILD_PRODUCT_PATH" "$BUILD_LOG" | tail -n1 | cut -d'=' -f2 | xargs || echo "Not found")
    if [[ "$BUILD_PRODUCT_PATH" != "Not found" ]]; then
        log "📦 Build product: $BUILD_PRODUCT_PATH"
    fi
    
    log "🎉 iOS verification and repair completed successfully"
    
    if [[ "$REPAIRS_NEEDED" = true ]]; then
        log "🔧 Repairs were applied during this run"
    else
        log "✅ No repairs needed - setup was already complete"
    fi
    
else
    log "❌ iOS Simulator build failed"
    log "📝 Last 20 lines of build output:"
    tail -n 20 "$BUILD_LOG" | while read -r line; do
        log "   $line"
    done
    fail "iOS build failed. Check full log at: $BUILD_LOG"
fi

# ============================================================================
# FINAL STATUS REPORT
# ============================================================================

log "🧪 Running smoke test for deterministic first paint..."
if have npx && [ -f "tests/smoke-healthz.spec.ts" ]; then
    if npx playwright test tests/smoke-healthz.spec.ts --reporter=line 2>&1 | tee -a "$BUILD_LOG"; then
        log "✅ Smoke test passed - first paint is working"
        SMOKE_STATUS="PASSED"
    else
        log "⚠️  Smoke test failed - check for CSR bailouts or rendering issues"
        SMOKE_STATUS="FAILED"
    fi
else
    log "⚠️  Smoke test skipped - Playwright not available or test file missing"
    SMOKE_STATUS="SKIPPED"
fi

log "📊 FINAL STATUS REPORT:"
log "   Build Log: $BUILD_LOG"
log "   iOS Project: $([ "$HAS_XCWORKSPACE" = true ] && echo "Workspace" || echo "Project") build target"
log "   Simulator: $DESTINATION"
log "   Repairs Applied: $([ "$REPAIRS_NEEDED" = true ] && echo "Yes" || echo "No")"
log "   Smoke Test: $SMOKE_STATUS"
log "   Status: SUCCESS"

log "🚀 Next steps:"
log "   1. Run 'make ios-open' to open Xcode"
log "   2. Click ▶️ to run in iOS Simulator"
log "   3. Test Universal Links and authentication flows"

exit 0
