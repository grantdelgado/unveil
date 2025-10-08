# iOS Simulator Diagnostics Guide

This guide provides troubleshooting steps for iOS simulator slow install/attach issues and performance problems.

## Quick Diagnostics Checklist

### 1. Simulator State Check
```bash
# Check simulator status
xcrun simctl list devices available

# Check booted simulators
xcrun simctl list devices | grep Booted

# Check for stuck simulators
xcrun simctl list devices | grep -E "(Creating|Booting|Shutting Down)"
```

### 2. Build Performance Check
```bash
# Run speedup script with dry run first
./scripts/ios-speedup.sh --dry-run

# Check recent build timings
ls -la _artifacts/ios_builds/timing_*.txt | tail -5

# View latest timing summary
cat _artifacts/ios_builds/timing_$(ls _artifacts/ios_builds/timing_*.txt | tail -1 | sed 's/.*timing_//' | sed 's/.txt//')
```

### 3. Xcode Project Health
```bash
# Verify project settings
cd ios/App
xcodebuild -project App.xcodeproj -showBuildSettings -configuration Debug | grep -E "(ONLY_ACTIVE_ARCH|ENABLE_BITCODE|DEBUG_INFORMATION_FORMAT)"

# Check for scheme issues
xcodebuild -project App.xcodeproj -list
```

## Common Issues and Solutions

### Issue: "Installing/Attaching to App" Hangs for Minutes

**Symptoms:**
- Xcode shows "Installing/Attaching to App on iPhone X" for >2 minutes
- Simulator appears to boot but app never launches
- Build succeeds but install fails

**Diagnosis Steps:**
1. Check simulator logs:
   ```bash
   # Get simulator UDID
   UDID=$(xcrun simctl list devices available | grep "iPhone" | head -1 | grep -oE "\([A-F0-9-]{36}\)" | tr -d "()")
   
   # Check recent logs
   xcrun simctl spawn $UDID log show --last 30m --predicate 'subsystem contains "com.unveil.wedding"'
   ```

2. Check for CoreSimulator issues:
   ```bash
   log show --last 30m --predicate 'subsystem == "com.apple.CoreSimulator"' | grep -i error
   ```

**Solutions:**
1. **Reset simulator** (most effective):
   ```bash
   # Reset specific simulator
   xcrun simctl shutdown $UDID
   xcrun simctl erase $UDID
   xcrun simctl boot $UDID
   ```

2. **Clean build artifacts**:
   ```bash
   ./scripts/ios-speedup.sh --purge-derived-data
   ```

3. **Hard reset** (nuclear option):
   ```bash
   ./scripts/ios-speedup.sh --hard --purge-derived-data
   ```

### Issue: Slow Build Times (>60s for incremental builds)

**Symptoms:**
- Clean builds take >2 minutes
- Incremental builds take >60 seconds
- Xcode shows long compilation times

**Diagnosis Steps:**
1. Check build timing breakdown:
   ```bash
   # View latest timing log
   cat _artifacts/ios_builds/timing_*.txt | tail -1
   ```

2. Look for slow compilation steps:
   ```bash
   # Find slowest build steps
   grep -E "CompileC|Ld |ProcessInfoPlistFile" _artifacts/ios_builds/timing_*.txt | sort -k2 -nr | head -10
   ```

**Solutions:**
1. **Optimize build settings** (already done by speedup script):
   - `ONLY_ACTIVE_ARCH = YES`
   - `DEBUG_INFORMATION_FORMAT = dwarf`
   - `ENABLE_BITCODE = NO`

2. **Clean DerivedData**:
   ```bash
   ./scripts/ios-speedup.sh --purge-derived-data
   ```

3. **Check for large asset files**:
   ```bash
   find ios/App/App/Assets.xcassets -name "*.png" -size +1M
   ```

### Issue: CocoaPods Installation Problems

**Symptoms:**
- `pod install` fails or hangs
- Pods/Manifest.lock differs from Podfile.lock
- Missing pod dependencies

**Diagnosis Steps:**
1. Check CocoaPods version:
   ```bash
   pod --version
   ruby --version
   ```

2. Verify Podfile integrity:
   ```bash
   cd ios/App
   pod spec lint --quick
   ```

**Solutions:**
1. **Update CocoaPods**:
   ```bash
   gem update cocoapods
   ```

2. **Clean pod cache**:
   ```bash
   cd ios/App
   pod cache clean --all
   pod deintegrate
   pod install
   ```

3. **Hard reset pods** (included in speedup script):
   ```bash
   ./scripts/ios-speedup.sh --hard
   ```

### Issue: Simulator Boot Failures

**Symptoms:**
- Simulator fails to boot
- "Unable to boot device" errors
- Simulator app crashes

**Diagnosis Steps:**
1. Check simulator runtime:
   ```bash
   xcrun simctl list runtimes
   ```

2. Check available disk space:
   ```bash
   df -h ~/Library/Developer/CoreSimulator
   ```

3. Check for corrupted simulators:
   ```bash
   xcrun simctl list devices unavailable
   ```

**Solutions:**
1. **Delete unavailable simulators**:
   ```bash
   xcrun simctl delete unavailable
   ```

2. **Reset CoreSimulator service**:
   ```bash
   sudo killall -9 com.apple.CoreSimulator.CoreSimulatorService
   xcrun simctl shutdown all
   ```

3. **Create fresh simulator**:
   ```bash
   xcrun simctl create "iPhone 17 Pro Test" "iPhone 17 Pro" "iOS-18-0"
   ```

## Performance Monitoring

### Build Time Tracking
The speedup script automatically tracks build times in `_artifacts/ios_builds/timing_*.txt`. Monitor these files to track performance improvements:

```bash
# Compare recent build times
grep "Overall build time" _artifacts/ios_builds/timing_*.txt | tail -5
```

### Expected Performance Targets
- **Clean build**: <90 seconds
- **Incremental build**: <30 seconds
- **Install/attach time**: <30 seconds
- **App launch time**: <10 seconds

### Red Flags
- Any single build step >60 seconds
- Install/attach >2 minutes
- Repeated "Installing" without progress
- Memory usage >8GB during build

## Rollback Procedures

### Revert Xcode Project Changes
```bash
# Restore original project files
git checkout -- ios/App/App.xcodeproj/project.pbxproj

# Re-sync pods
cd ios/App && pod install && cd ../..
```

### Restore from Backup
```bash
# If you have a backup of the ios/ directory
cp -r ios_backup/ ios/

# Re-run Capacitor sync
npx cap sync ios
```

### Emergency Reset
```bash
# Nuclear option: regenerate iOS project
rm -rf ios/
npx cap add ios
./scripts/ios-speedup.sh --hard
```

## Advanced Logging Methods

### Method 1: Xcode Debug Console (Recommended)
```bash
# In Xcode
1. View → Debug Area → Show Debug Area (Cmd+Shift+Y)
2. Click "Console" tab
3. Filter by "WebView" or "App" to see relevant logs
4. Look for: "WebView finished loading" or "WebView failed to load"
```

### Method 2: Devices & Simulators Console
```bash
# In Xcode
1. Window → Devices and Simulators
2. Select your simulator
3. Click "Console" button
4. Stream live logs during app execution
5. Search for "WebView" or "com.unveil.wedding"
```

### Method 3: Console.app (System Logs)
```bash
# On Mac
1. Open Console.app
2. Select your simulator under "Devices"
3. Filter by "com.unveil.wedding" or "WebView"
4. See system-level logs
```

### Method 4: Terminal Log Streaming
```bash
# Stream logs for your app
xcrun simctl spawn booted log stream --predicate 'process == "App"' --level=info

# Monitor for WebView failures specifically
xcrun simctl spawn booted log stream --predicate 'process == "App" && message contains "WebView failed to load"' --level=error
```

### Method 5: Safari Web Inspector
```bash
# Setup
1. iOS Simulator → Settings → Safari → Advanced → Web Inspector (ON)
2. Safari on Mac → Develop → iPhone 17 Pro → [Your App]
3. Console tab shows JavaScript logs and errors
```

## Log Collection for Support

When reporting issues, collect these logs:

```bash
# Run diagnostics and collect logs
./scripts/ios-speedup.sh --dry-run > ios_diagnostics.txt 2>&1

# Collect recent build logs
tar -czf ios_logs.tar.gz _artifacts/ios_builds/

# Collect WebView logs from simulator
xcrun simctl spawn booted log collect --last 1h --output webview_logs.logarchive

# Collect system info
system_profiler SPDeveloperToolsDataType > system_info.txt
```

## Preventive Maintenance

### Weekly Tasks
```bash
# Clean old build artifacts
find _artifacts/ios_builds/ -name "*.txt" -mtime +7 -delete

# Update CocoaPods
gem update cocoapods

# Check for Xcode updates
softwareupdate -l | grep -i xcode
```

### Monthly Tasks
```bash
# Full cleanup
./scripts/ios-speedup.sh --hard --purge-derived-data

# Reset test simulators
xcrun simctl delete unavailable
xcrun simctl erase all
```

## Troubleshooting Contacts

- **Xcode Issues**: Check Apple Developer Forums
- **Capacitor Issues**: Check Capacitor GitHub Issues
- **CocoaPods Issues**: Check CocoaPods GitHub Issues

## Additional Resources

- [Apple Developer Documentation - Simulator](https://developer.apple.com/documentation/xcode/running-your-app-in-simulator)
- [Capacitor iOS Documentation](https://capacitorjs.com/docs/ios)
- [CocoaPods Troubleshooting Guide](https://guides.cocoapods.org/using/troubleshooting)
