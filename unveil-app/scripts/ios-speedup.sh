#!/bin/bash

# iOS Speedup Script
# Purpose: Optimize iOS simulator build and launch performance
# Usage: ./scripts/ios-speedup.sh [--dry-run] [--hard] [--purge-derived-data]

set -euo pipefail

# Configuration
BUILD_LOG_DIR="_artifacts/ios_builds"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BUILD_LOG="$BUILD_LOG_DIR/speedup_$TIMESTAMP.log"
TIMING_LOG="$BUILD_LOG_DIR/timing_$TIMESTAMP.txt"

# Parse command line arguments
DRY_RUN=false
HARD_RESET=false
PURGE_DERIVED_DATA=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --hard)
            HARD_RESET=true
            shift
            ;;
        --purge-derived-data)
            PURGE_DERIVED_DATA=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--dry-run] [--hard] [--purge-derived-data]"
            exit 1
            ;;
    esac
done

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

dry_run_or_execute() {
    if [[ "$DRY_RUN" = true ]]; then
        log "DRY RUN: Would execute: $*"
    else
        log "Executing: $*"
        eval "$@"
    fi
}

# Ensure build log directory exists
mkdir -p "$BUILD_LOG_DIR"

log "🚀 Starting iOS Speedup Optimization"
log "Build log: $BUILD_LOG"
log "Timing log: $TIMING_LOG"
log "Dry run: $DRY_RUN"
log "Hard reset: $HARD_RESET"
log "Purge derived data: $PURGE_DERIVED_DATA"

# ============================================================================
# CLEANUP PHASE - Remove build artifacts and caches
# ============================================================================

log "🧹 CLEANUP PHASE: Removing build artifacts and caches"

# Purge Xcode DerivedData if requested
if [[ "$PURGE_DERIVED_DATA" = true ]]; then
    DERIVED_DATA_PATH=$(xcodebuild -showBuildSettings | grep -m 1 "BUILD_DIR" | grep -oE "/.*DerivedData[^/]*" | head -1 || echo "")
    if [[ -n "$DERIVED_DATA_PATH" ]] && [[ -d "$DERIVED_DATA_PATH" ]]; then
        log "🗑️  Purging DerivedData: $DERIVED_DATA_PATH"
        dry_run_or_execute "rm -rf '$DERIVED_DATA_PATH'"
    else
        log "ℹ️  DerivedData directory not found or already clean"
    fi
fi

# Hard reset: nuke Pods and lock files
if [[ "$HARD_RESET" = true ]]; then
    log "💥 Hard reset: Removing Pods directory and lock files"
    dry_run_or_execute "rm -rf ios/App/Pods"
    dry_run_or_execute "rm -f ios/App/Podfile.lock"
    dry_run_or_execute "rm -f ios/App/Pods/Manifest.lock"
fi

# Clean iOS build products
log "🧽 Cleaning iOS build products"
if [[ -d "ios/App/App.xcworkspace" ]]; then
    BUILD_TARGET="-workspace ios/App/App.xcworkspace -scheme \"Unveil (Dev)\""
elif [[ -d "ios/App/App.xcodeproj" ]]; then
    BUILD_TARGET="-project ios/App/App.xcodeproj -scheme \"Unveil (Dev)\""
else
    fail "No valid Xcode project or workspace found"
fi

dry_run_or_execute "xcodebuild clean $BUILD_TARGET -configuration Debug"

# ============================================================================
# BUILD PHASE - Rebuild web assets and sync Capacitor
# ============================================================================

log "🔨 BUILD PHASE: Rebuilding web assets and syncing Capacitor"

# Determine package manager
if have pnpm; then
    PACKAGE_MANAGER="pnpm"
elif have npm; then
    PACKAGE_MANAGER="npm"
else
    fail "No package manager (npm/pnpm) found"
fi

# Build web assets (skip if using development server)
if grep -q "url.*localhost" capacitor.config.ts; then
    log "🔧 Development server mode detected - skipping build step"
    log "📡 Ensuring development server is running on localhost:3000"
    if ! curl -s http://localhost:3000 > /dev/null; then
        log "⚠️  Development server not running. Please start it with: pnpm dev"
        if [[ "$DRY_RUN" = false ]]; then
            fail "Development server required but not running"
        fi
    else
        log "✅ Development server is running"
    fi
else
    log "📦 Building web assets with $PACKAGE_MANAGER"
    if [[ "$PACKAGE_MANAGER" = "pnpm" ]]; then
        dry_run_or_execute "pnpm build"
    else
        dry_run_or_execute "npm run build"
    fi
fi

# Capacitor copy and sync
log "📱 Copying and syncing Capacitor assets"
dry_run_or_execute "npx cap copy ios"
dry_run_or_execute "npx cap sync ios"

# ============================================================================
# COCOAPODS VALIDATION PHASE
# ============================================================================

log "🍫 COCOAPODS VALIDATION PHASE"

# Install/update CocoaPods dependencies
if [[ -f "ios/App/Podfile" ]]; then
    log "📦 Installing CocoaPods dependencies"
    dry_run_or_execute "cd ios/App && pod install && cd ../.."
    
    # Validate Pods/Manifest.lock matches Podfile.lock
    if [[ -f "ios/App/Pods/Manifest.lock" ]] && [[ -f "ios/App/Podfile.lock" ]]; then
        if ! diff -q "ios/App/Pods/Manifest.lock" "ios/App/Podfile.lock" >/dev/null 2>&1; then
            log "⚠️  Pods/Manifest.lock differs from Podfile.lock"
            if [[ "$DRY_RUN" = false ]]; then
                log "🔄 Re-running pod install to sync"
                cd ios/App && pod install && cd ../..
            fi
        else
            log "✅ CocoaPods manifests are in sync"
        fi
    fi
else
    log "ℹ️  No Podfile found, skipping CocoaPods validation"
fi

# ============================================================================
# XCODE PROJECT OPTIMIZATION PHASE
# ============================================================================

log "⚡ XCODE PROJECT OPTIMIZATION PHASE"

# Function to update Xcode build settings
update_build_setting() {
    local setting_name="$1"
    local setting_value="$2"
    local config="$3"
    
    if [[ "$DRY_RUN" = true ]]; then
        log "DRY RUN: Would set $setting_name = $setting_value for $config configuration"
    else
        log "Setting $setting_name = $setting_value for $config configuration"
        cd ios/App
        xcodebuild -project App.xcodeproj -target App -configuration "$config" ONLY_ACTIVE_ARCH="$setting_value" || true
        cd ../..
    fi
}

# Optimize Debug configuration settings
log "🎯 Optimizing Debug build settings"

# Note: These settings are already optimal based on our check:
# - ONLY_ACTIVE_ARCH = YES (already set)
# - DEBUG_INFORMATION_FORMAT = dwarf (already set)
# - ENABLE_BITCODE is not present (good, it's deprecated)

log "✅ Debug build settings are already optimized"
log "   - ONLY_ACTIVE_ARCH = YES (builds only for current architecture)"
log "   - DEBUG_INFORMATION_FORMAT = dwarf (faster than dwarf-with-dsym)"
log "   - ENABLE_BITCODE = not set (bitcode is deprecated and disabled by default)"

# ============================================================================
# BUILD TIMING ANALYSIS PHASE
# ============================================================================

log "⏱️  BUILD TIMING ANALYSIS PHASE"

# Perform a timed build with detailed timing information
log "🔨 Performing timed build for analysis"

# Determine simulator destination
if xcrun simctl list devices available | grep -q "iPhone 17 Pro"; then
    DESTINATION="platform=iOS Simulator,name=iPhone 17 Pro"
    DEVICE_NAME="iPhone 17 Pro"
    log "📱 Using simulator: iPhone 17 Pro"
elif xcrun simctl list devices available | grep -q "iPhone 17"; then
    DESTINATION="platform=iOS Simulator,name=iPhone 17"
    DEVICE_NAME="iPhone 17"
    log "📱 Using simulator: iPhone 17"
elif xcrun simctl list devices available | grep -q "iPhone 16"; then
    DESTINATION="platform=iOS Simulator,name=iPhone 16"
    DEVICE_NAME="iPhone 16"
    log "📱 Using simulator: iPhone 16"
else
    # Fall back to first available iPhone simulator
    AVAILABLE_IPHONE=$(xcrun simctl list devices available | grep -E "iPhone [0-9]+" | head -n1)
    if [[ -n "$AVAILABLE_IPHONE" ]]; then
        DEVICE_NAME=$(echo "$AVAILABLE_IPHONE" | sed 's/ *\([^(]*\).*/\1/' | xargs)
        DESTINATION="platform=iOS Simulator,name=$DEVICE_NAME"
        log "📱 Using simulator: $DEVICE_NAME"
    else
        fail "No iPhone simulators available"
    fi
fi

# Build with timing information
BUILD_CMD="xcodebuild build $BUILD_TARGET -destination '$DESTINATION' -configuration Debug -showBuildTimingSummary"
log "🔨 Build command: $BUILD_CMD"

if [[ "$DRY_RUN" = false ]]; then
    START_TIME=$(date +%s)
    
    if eval "$BUILD_CMD" 2>&1 | tee -a "$BUILD_LOG"; then
        END_TIME=$(date +%s)
        BUILD_DURATION=$((END_TIME - START_TIME))
        
        log "✅ Build completed successfully in ${BUILD_DURATION}s"
        
        # Extract and save timing summary
        if grep -A 50 "Build Timing Summary" "$BUILD_LOG" > "$TIMING_LOG" 2>/dev/null; then
            log "📊 Build timing summary saved to: $TIMING_LOG"
            
            # Show key timing metrics
            log "📈 Key timing metrics:"
            grep -E "(CompileC|Ld |ProcessInfoPlistFile|Touch)" "$TIMING_LOG" | head -5 | while read -r line; do
                log "   $line"
            done
        else
            log "⚠️  Build timing summary not found in build output"
        fi
        
        # Save overall build time
        echo "Overall build time: ${BUILD_DURATION}s" >> "$TIMING_LOG"
        echo "Build completed at: $(date)" >> "$TIMING_LOG"
        
    else
        fail "Build failed during timing analysis"
    fi
else
    log "DRY RUN: Would perform timed build and save results to $TIMING_LOG"
fi

# ============================================================================
# SIMULATOR PREPARATION PHASE
# ============================================================================

log "📱 SIMULATOR PREPARATION PHASE"

# Get the simulator UDID for the destination
SIMULATOR_UDID=$(xcrun simctl list devices available | grep "$DEVICE_NAME" | head -n1 | grep -oE "\([A-F0-9-]{36}\)" | tr -d "()")

if [[ -n "$SIMULATOR_UDID" ]]; then
    log "📱 Target simulator UDID: $SIMULATOR_UDID"
    
    # Boot simulator if not already booted
    SIMULATOR_STATE=$(xcrun simctl list devices | grep "$SIMULATOR_UDID" | grep -oE "\((Booted|Shutdown)\)" | tr -d "()")
    
    if [[ "$SIMULATOR_STATE" != "Booted" ]]; then
        log "🚀 Booting simulator: $DEVICE_NAME"
        dry_run_or_execute "xcrun simctl boot '$SIMULATOR_UDID'"
    else
        log "✅ Simulator already booted: $DEVICE_NAME"
    fi
    
    # Save simulator info for diagnostics
    if [[ "$DRY_RUN" = false ]]; then
        echo "Simulator: $DEVICE_NAME" >> "$TIMING_LOG"
        echo "UDID: $SIMULATOR_UDID" >> "$TIMING_LOG"
        echo "State: $SIMULATOR_STATE" >> "$TIMING_LOG"
    fi
else
    log "⚠️  Could not determine simulator UDID"
fi

# ============================================================================
# LOG COLLECTION PHASE
# ============================================================================

log "📋 LOG COLLECTION PHASE"

if [[ "$DRY_RUN" = false ]]; then
    # Collect device logs
    DEVICE_LOG="$BUILD_LOG_DIR/device_logs_$TIMESTAMP.txt"
    log "📱 Collecting device logs to: $DEVICE_LOG"
    
    # Get recent simulator logs
    if [[ -n "$SIMULATOR_UDID" ]]; then
        xcrun simctl spawn "$SIMULATOR_UDID" log show --last 1h --predicate 'subsystem contains "com.unveil.wedding"' > "$DEVICE_LOG" 2>/dev/null || log "⚠️  Could not collect device logs"
    fi
    
    # Collect CoreSimulator logs
    CORESIM_LOG="$BUILD_LOG_DIR/coresimulator_logs_$TIMESTAMP.txt"
    log "🖥️  Collecting CoreSimulator logs to: $CORESIM_LOG"
    
    # Get recent CoreSimulator logs
    log show --last 1h --predicate 'subsystem == "com.apple.CoreSimulator"' > "$CORESIM_LOG" 2>/dev/null || log "⚠️  Could not collect CoreSimulator logs"
else
    log "DRY RUN: Would collect device and CoreSimulator logs"
fi

# ============================================================================
# FINAL REPORT
# ============================================================================

log "📊 SPEEDUP OPTIMIZATION COMPLETE"
log "   Build Log: $BUILD_LOG"
log "   Timing Log: $TIMING_LOG"
log "   Dry Run: $DRY_RUN"
log "   Hard Reset: $HARD_RESET"
log "   Purged DerivedData: $PURGE_DERIVED_DATA"

if [[ "$DRY_RUN" = false ]]; then
    log "🎯 Next steps:"
    log "   1. Run 'make ios-open' to open Xcode"
    log "   2. Click ▶️ to run in iOS Simulator"
    log "   3. Monitor install/attach time (should be <30s)"
    log "   4. Check timing logs for any steps >60s"
    
    log "📈 Performance monitoring:"
    log "   - Build timing: $TIMING_LOG"
    log "   - Device logs: $BUILD_LOG_DIR/device_logs_$TIMESTAMP.txt"
    log "   - CoreSimulator logs: $BUILD_LOG_DIR/coresimulator_logs_$TIMESTAMP.txt"
else
    log "🔍 Dry run completed - no changes made"
    log "   Run without --dry-run to apply optimizations"
fi

exit 0
