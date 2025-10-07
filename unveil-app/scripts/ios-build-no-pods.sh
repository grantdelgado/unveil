#!/bin/bash

# iOS Build Without CocoaPods - Workaround Script
# Purpose: Test basic Capacitor iOS functionality without CocoaPods dependencies
# Usage: ./scripts/ios-build-no-pods.sh

set -euo pipefail

# Configuration
BUILD_LOG_DIR="_artifacts/ios_builds"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BUILD_LOG="$BUILD_LOG_DIR/no_pods_build_$TIMESTAMP.log"

# Utility functions
log() {
    echo "[$(date '+%H:%M:%S')] $*" | tee -a "$BUILD_LOG"
}

fail() {
    echo "[$(date '+%H:%M:%S')] ERROR: $*" | tee -a "$BUILD_LOG"
    exit 1
}

# Ensure build log directory exists
mkdir -p "$BUILD_LOG_DIR"

log "🧪 iOS Build Test Without CocoaPods"
log "Build log: $BUILD_LOG"
log "⚠️  This is a workaround for Ruby version compatibility issues"

# Check prerequisites
if [[ ! -d "ios/App/App.xcodeproj" ]]; then
    fail "iOS project not found. Run 'npx cap add ios' first."
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
    fail "xcodebuild not found. Install Xcode from App Store."
fi

# Start development server if not running
if ! curl -s http://localhost:3000 >/dev/null 2>&1; then
    log "🔧 Starting Next.js development server..."
    npm run dev &
    DEV_SERVER_PID=$!
    log "⏳ Waiting for development server to start..."
    sleep 5
    
    if ! curl -s http://localhost:3000 >/dev/null 2>&1; then
        log "❌ Development server failed to start"
        kill $DEV_SERVER_PID 2>/dev/null || true
        fail "Cannot start development server on localhost:3000"
    fi
    
    log "✅ Development server running on localhost:3000"
    STARTED_DEV_SERVER=true
else
    log "✅ Development server already running on localhost:3000"
    STARTED_DEV_SERVER=false
fi

# Sync Capacitor assets
log "🔧 Syncing Capacitor assets..."
npx cap copy ios 2>&1 | tee -a "$BUILD_LOG" || log "⚠️  cap copy completed with warnings"
npx cap sync ios 2>&1 | tee -a "$BUILD_LOG" || log "⚠️  cap sync completed with warnings"

# Find available iPhone simulator
log "📱 Finding available iPhone simulator..."
AVAILABLE_IPHONE=$(xcrun simctl list devices available | grep -E "iPhone [0-9]+" | head -n1)
if [[ -z "$AVAILABLE_IPHONE" ]]; then
    fail "No iPhone simulators available. Install iOS Simulator in Xcode."
fi

DEVICE_NAME=$(echo "$AVAILABLE_IPHONE" | sed 's/ *\([^(]*\).*/\1/' | xargs)
DEVICE_ID=$(echo "$AVAILABLE_IPHONE" | sed 's/.*(\([^)]*\)).*/\1/')
DESTINATION="platform=iOS Simulator,id=$DEVICE_ID"

log "✅ Using simulator: $DEVICE_NAME ($DEVICE_ID)"

# Create temporary Xcode project without CocoaPods references
log "🔧 Creating temporary build configuration..."
TEMP_PROJECT_DIR="ios/App_temp"
cp -r ios/App "$TEMP_PROJECT_DIR"

# Remove CocoaPods references from project file
sed -i '' '/Pods-App/d' "$TEMP_PROJECT_DIR/App.xcodeproj/project.pbxproj"
sed -i '' '/\[CP\]/d' "$TEMP_PROJECT_DIR/App.xcodeproj/project.pbxproj"

# Attempt build
log "🔨 Building for iOS Simulator (without CocoaPods)..."
BUILD_CMD="xcodebuild -project $TEMP_PROJECT_DIR/App.xcodeproj -scheme App -destination '$DESTINATION' -configuration Debug build"
log "   Command: $BUILD_CMD"

if eval "$BUILD_CMD" 2>&1 | tee -a "$BUILD_LOG"; then
    log "✅ iOS Simulator build successful (without CocoaPods)!"
    log "📝 Note: This build may have limited native functionality"
    log "📝 For full functionality, install Ruby 3.1+ and CocoaPods"
    BUILD_SUCCESS=true
else
    log "❌ iOS Simulator build failed"
    log "📝 Last 10 lines of build output:"
    tail -n 10 "$BUILD_LOG" | while read -r line; do
        log "   $line"
    done
    BUILD_SUCCESS=false
fi

# Cleanup
log "🧹 Cleaning up temporary files..."
rm -rf "$TEMP_PROJECT_DIR"

# Stop development server if we started it
if [[ "$STARTED_DEV_SERVER" = true ]]; then
    log "🛑 Stopping development server..."
    kill $DEV_SERVER_PID 2>/dev/null || true
fi

# Final status
if [[ "$BUILD_SUCCESS" = true ]]; then
    log "🎉 iOS build test completed successfully"
    log "📱 Ready for Xcode testing: make ios-open"
    log "⚠️  For full native features, resolve Ruby/CocoaPods setup"
    exit 0
else
    fail "iOS build test failed. Check full log at: $BUILD_LOG"
fi
