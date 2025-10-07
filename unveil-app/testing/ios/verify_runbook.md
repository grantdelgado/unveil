# iOS Verification Runbook
**Date:** October 7, 2025  
**Project:** Unveil Wedding App  
**Purpose:** Guide for iOS setup verification and common issue resolution  

## 🎯 What the Verification Script Does

### Audit Phase (Read-Only)
The `ios-verify-repair.sh` script checks for:

| Component | Check | Expected Location |
|-----------|-------|-------------------|
| **iOS Project** | Xcode project exists | `ios/App/App.xcodeproj` |
| **iOS Workspace** | Xcode workspace exists | `ios/App/App.xcworkspace` |
| **CocoaPods** | Podfile and Pods directory | `ios/App/Podfile`, `ios/App/Pods/` |
| **Universal Links** | Apple App Site Association | `public/.well-known/apple-app-site-association` |
| **Capacitor Config** | Configuration file exists | `capacitor.config.ts` |
| **iOS Assets** | Icons and splash screens | `public/icons/ios/`, `public/splash/ios/` |
| **Build Tools** | Xcode and CocoaPods availability | System PATH |

### Repair Phase (Conditional)
The script performs minimal repairs only when needed:

1. **CocoaPods Installation** - If `Podfile` exists but `Pods/` missing
2. **Web Asset Build** - If `.next` missing or outdated
3. **Capacitor Sync** - Always runs `cap copy` and `cap sync` (safe operations)
4. **iOS Build** - Compiles for iOS Simulator to verify setup

## 📁 Build Logs Location

All build logs are stored in: `_artifacts/ios_builds/`

### Log File Format
- **Filename:** `build_YYYYMMDD_HHMMSS.log`
- **Content:** Complete build output with timestamps
- **Retention:** Logs persist until manually cleaned

### Log Analysis
```bash
# View latest build log
ls -t _artifacts/ios_builds/build_*.log | head -n1 | xargs cat

# Check for specific errors
grep -i error _artifacts/ios_builds/build_*.log | tail -n10

# View build summary
grep -E "(✅|❌|🔧)" _artifacts/ios_builds/build_*.log | tail -n20
```

## 🔧 Common Outcomes & Actions

### ✅ **Success: "Nothing to Repair"**
**Output:** Script reports all components present and working
```
📊 AUDIT SUMMARY:
   iOS Project: ✅ Xcode project, ✅ workspace
   CocoaPods: ✅ installed, ✅ pods directory
   Configuration: ✅ Capacitor, ✅ Universal Links
   Assets: ✅ 9 icons, ✅ 7 splash screens
🔧 REPAIR PHASE: No repairs needed - setup was already complete
✅ iOS Simulator build successful!
```
**Action:** Ready for development and testing

### ⚠️ **Partial: "Repairs Applied"**
**Output:** Script found and fixed missing components
```
🔧 Installing CocoaPods dependencies...
🔧 Building web assets...
🔧 Syncing Capacitor assets...
✅ iOS Simulator build successful!
🔧 Repairs were applied during this run
```
**Action:** Setup now complete, proceed with testing

### ❌ **Failure: "CocoaPods Not Installed"**
**Output:** CocoaPods required but not available
```
❌ CocoaPods required but not installed
📝 Install CocoaPods with: sudo gem install cocoapods
ERROR: CocoaPods installation required. Run: sudo gem install cocoapods
```
**Action Required:**
```bash
sudo gem install cocoapods
make ios-verify  # Re-run verification
```

### ❌ **Failure: "Xcode Not Available"**
**Output:** Xcode build tools missing or misconfigured
```
❌ Xcode build tools not available
ERROR: xcode-select: error: tool 'xcodebuild' requires Xcode
```
**Action Required:**
1. **Install Xcode** from Mac App Store (if not installed)
2. **Set Developer Directory** (if Xcode installed but not active):
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```
3. **Accept License** (if first time):
   ```bash
   sudo xcodebuild -license accept
   ```
4. **Re-run verification:**
   ```bash
   make ios-verify
   ```

### ❌ **Failure: "Build Failed"**
**Output:** iOS build compilation errors
```
❌ iOS Simulator build failed
📝 Last 20 lines of build output:
   [build error details]
ERROR: iOS build failed. Check full log at: _artifacts/ios_builds/build_YYYYMMDD_HHMMSS.log
```
**Action Required:**
1. **Review Full Build Log:**
   ```bash
   cat _artifacts/ios_builds/build_*.log | tail -n1
   ```
2. **Common Build Issues:**
   - **Missing Pods:** Run `cd ios/App && pod install`
   - **Signing Issues:** Check bundle identifier and team settings
   - **Asset Issues:** Verify app icons are valid PNG files
   - **Configuration Issues:** Check Info.plist syntax

### ⚠️ **Warning: "Blank Screen in Simulator"**
**Symptoms:** App launches but shows blank/white screen
**Causes:**
- Next.js development server not running
- Network connectivity issues in simulator
- Capacitor server configuration incorrect

**Action Required:**
1. **Start Development Server:**
   ```bash
   npm run dev  # or pnpm dev
   ```
2. **Verify Server Accessible:**
   ```bash
   curl http://localhost:3000
   ```
3. **Check Capacitor Config:**
   ```typescript
   // capacitor.config.ts should have:
   server: {
     url: 'http://localhost:3000',
     cleartext: true
   }
   ```
4. **Re-sync Capacitor:**
   ```bash
   npx cap sync ios
   ```

## 🧪 Manual Testing Procedures

### Basic Functionality Test
1. **Launch App in Simulator**
   - Open Xcode workspace: `make ios-open`
   - Select iOS Simulator (iPhone 14 Pro recommended)
   - Click ▶️ to build and run
   - **Expected:** App launches and displays Unveil interface

2. **Navigation Test**
   - Navigate through app sections
   - Test login flow (if not authenticated)
   - Verify responsive design on mobile screen
   - **Expected:** Smooth navigation, proper mobile layout

### Universal Links Test
1. **Open Safari in Simulator**
2. **Navigate to Test URLs:**
   ```
   https://app.sendunveil.com/select-event
   https://app.sendunveil.com/login
   ```
3. **Expected Behavior:**
   - Links open in Unveil app (not Safari)
   - Proper navigation to requested screens
   - Authentication state preserved

### Custom Scheme Test
1. **In Safari Address Bar, Type:**
   ```
   unveil://select-event
   ```
2. **Expected Behavior:**
   - Prompt to open in Unveil app
   - App opens to event selection screen
   - Fallback works when Universal Links fail

### Authentication Flow Test
1. **Complete Login Process:**
   - Enter phone number
   - Request OTP code
   - Enter verification code
   - Complete profile setup if needed
2. **Expected Behavior:**
   - SMS OTP received (if using real phone)
   - Authentication completes successfully
   - Redirect to appropriate screen
   - Session persists across app launches

## 🛠️ Troubleshooting Guide

### Issue: "Command not found: make"
**Solution:** Use direct script execution:
```bash
./scripts/ios-verify-repair.sh
```

### Issue: "Permission denied: ./scripts/ios-verify-repair.sh"
**Solution:** Make script executable:
```bash
chmod +x scripts/ios-verify-repair.sh
```

### Issue: "No iOS Simulators available"
**Solution:** Install iOS Simulator:
1. Open Xcode
2. Go to Xcode → Preferences → Components
3. Download iOS Simulator versions
4. Re-run verification

### Issue: "Build takes very long"
**Solution:** This is normal for first build (5-10 minutes)
- Subsequent builds are much faster
- Consider using physical device for better performance

### Issue: "App shows web content but looks wrong"
**Solution:** Mobile viewport issues:
1. Check responsive design in web browser first
2. Verify Capacitor viewport configuration
3. Test on different simulator sizes

## 📋 Quick Reference Commands

### Essential Commands
```bash
# Verify and repair iOS setup
make ios-verify

# Open iOS project in Xcode  
make ios-open

# Clean build artifacts
make ios-clean

# Start development server
npm run dev  # or pnpm dev

# Manual Capacitor sync
npx cap sync ios
```

### Debugging Commands
```bash
# Check iOS Simulators
xcrun simctl list devices available

# Check Xcode configuration
xcode-select --print-path

# Check CocoaPods status
pod --version

# View latest build log
ls -t _artifacts/ios_builds/build_*.log | head -n1 | xargs tail -n50
```

## 🎯 Success Criteria

### Verification Script Success
- [x] Script runs without errors
- [x] All audit checks pass or repairs applied
- [x] iOS Simulator build completes successfully
- [x] Build log created with detailed output

### iOS App Functionality
- [x] App launches in iOS Simulator
- [x] Web content displays correctly
- [x] Navigation works smoothly
- [x] Authentication flows functional
- [x] Universal Links handle correctly

### Development Workflow
- [x] Live reload works during development
- [x] Xcode workspace opens correctly
- [x] Build process is repeatable
- [x] Error messages are clear and actionable

---

**Quick Start:** Run `make ios-verify` to check and repair iOS setup automatically  
**Documentation:** Full build logs available in `_artifacts/ios_builds/`  
**Support:** Check troubleshooting section for common issues and solutions
