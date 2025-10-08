# Baseline Restore Report: c206ad1

## Commit Information
- **Commit Hash**: c206ad1fa36d32ba7fce3c0008e3fa70b98d2a68
- **Commit Message**: feat: iOS App Store launch preparation - Week 1-2 foundation
- **Date**: Wed Oct 1 22:22:35 2025 -0500
- **Author**: Grant Delgado <grant@unveil.app>

## What We Intentionally Did Not Include
This restore excludes all 11 commits that came after c206ad1, including:
- Server-side auth gate fixes
- Provider refactoring and cleanup
- iOS deterministic first paint improvements
- Capacitor TypeScript configuration fixes
- Complete iOS Capacitor setup

## Web Verification Results ✅

### Health Endpoint Test
- **URL**: http://localhost:3000/api/health/realtime
- **Status**: ✅ HEALTHY
- **Response**: 
```json
{
  "activeChannels": 0,
  "totalConnects": 0,
  "totalDisconnects": 0,
  "totalMessages": 0,
  "totalErrors": 0,
  "uptimeMs": 78,
  "lastActivityMs": 78,
  "recentActivityRate": 0,
  "healthScore": 100,
  "timestamp": "2025-10-08T04:42:59.371Z",
  "status": "healthy"
}
```

### Root Page Test
- **URL**: http://localhost:3000/
- **Status**: ✅ LOADS (with expected client-side rendering bailout)
- **Behavior**: Server renders HTML shell, then bails out to client-side rendering due to dynamic imports
- **Expected**: This is normal behavior for this commit snapshot

## iOS Verification Results ⚠️

### Project Structure
- **iOS Directory**: ✅ Present at `ios/` (partial structure from c206ad1)
- **Capacitor Config**: ❌ Not present in original c206ad1 commit
- **Xcode Project**: ⚠️ Incomplete (missing `project.pbxproj` file)
- **Workspace**: ✅ Present but incomplete

### Configuration Analysis
The iOS project at c206ad1 was in an early planning state:
- iOS directory structure partially present (from documentation/planning phase)
- No functional Capacitor configuration at this commit
- Xcode project files incomplete (missing `project.pbxproj`)
- This represents the "Week 1-2 foundation" planning phase, not implementation

### Build Attempt
```bash
xcodebuild -workspace App.xcworkspace -scheme App build
# Result: Failed - missing project.pbxproj file
```

### Simulator State
- **Device**: iPhone 17 Pro (already booted)
- **Screenshot**: Captured baseline simulator state
- **Logs**: Collected for reference

## Artifacts Saved
- `web_healthz.txt` - Health endpoint response
- `web_root_head.txt` - Root page HTML (first 80 lines)
- `sim_first_paint.png` - Simulator screenshot
- `sim_device_log.txt` - Device logs
- `REPORT.md` - This report

## Build Verification ✅

### Production Build
- **Status**: ✅ SUCCESSFUL
- **Command**: `pnpm build`
- **Result**: Clean build with only bundle size warnings (expected)
- **Deployment**: Ready for Vercel deployment

## Summary
At commit c206ad1, the codebase represents the "iOS App Store launch preparation - Week 1-2 foundation" state:

✅ **Web Application**: Fully functional with health endpoints working and production build ready
⚠️ **iOS Application**: Planning phase only (documentation and partial structure)

This snapshot captures the exact state when iOS preparation was documented and planned, but before the actual iOS project was implemented. The build is clean and deployment-ready.

## Recommendations
If iOS functionality is needed from this baseline:
1. The later commits (particularly "Complete iOS Capacitor setup with successful build") contain the missing iOS project files
2. These could be cherry-picked separately if needed
3. The current state shows the planning and configuration phase was complete

## Branch Information
- **Baseline Branch**: `baseline/c206ad1`
- **Safety Branch**: `exp/wip-pre-rollback`
- **Safety Tag**: `wip-pre-rollback-20251007`
