#!/bin/bash

# iOS Archive Script for TestFlight Builds
# Creates production archive and IPA for App Store distribution

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCHEME_NAME="Unveil (Prod)"
WORKSPACE_PATH="ios/App/App.xcworkspace"
ARCHIVE_PATH="_artifacts/ios_builds/App.xcarchive"
IPA_PATH="_artifacts/ios_builds/App.ipa"
EXPORT_OPTIONS_PATH="_artifacts/ios_builds/ExportOptions.plist"
BUILD_LOG="_artifacts/ios_builds/archive_$(date +%Y%m%d_%H%M%S).log"

echo -e "${BLUE}🚀 Starting iOS Archive Process for TestFlight${NC}"
echo "=================================================="

# Create artifacts directory
mkdir -p _artifacts/ios_builds

# Set production server URL
export CAP_SERVER_URL=https://app.sendunveil.com
echo -e "${YELLOW}📡 Server URL: $CAP_SERVER_URL${NC}"

# Step 1: Build the web app for production
echo -e "${BLUE}🔨 Building web application for production...${NC}"

# Build with production optimizations
if ! npm run build; then
    echo -e "${RED}❌ Web build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Web build completed${NC}"

# Step 2: Copy web assets to iOS
echo -e "${BLUE}📱 Copying assets to iOS...${NC}"
if ! npx cap copy ios; then
    echo -e "${RED}❌ Capacitor copy failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Assets copied to iOS${NC}"

# Step 3: Create ExportOptions.plist for App Store distribution
echo -e "${BLUE}📝 Creating export options...${NC}"
cat > "$EXPORT_OPTIONS_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <key>destination</key>
    <string>upload</string>
    <key>uploadBitcode</key>
    <false/>
    <key>uploadSymbols</key>
    <true/>
    <key>compileBitcode</key>
    <false/>
    <key>stripSwiftSymbols</key>
    <true/>
    <key>teamID</key>
    <string>\$(DEVELOPMENT_TEAM)</string>
    <key>signingStyle</key>
    <string>automatic</string>
</dict>
</plist>
EOF
echo -e "${GREEN}✅ Export options created${NC}"

# Step 4: Clean previous archives
echo -e "${BLUE}🧹 Cleaning previous archives...${NC}"
rm -rf "$ARCHIVE_PATH"
rm -f "$IPA_PATH"

# Step 5: Create archive
echo -e "${BLUE}📦 Creating archive (this may take several minutes)...${NC}"
echo "Archive will be saved to: $ARCHIVE_PATH"
echo "Build log: $BUILD_LOG"

if xcodebuild \
    -workspace "$WORKSPACE_PATH" \
    -scheme "$SCHEME_NAME" \
    -configuration Release \
    -destination 'generic/platform=iOS' \
    -archivePath "$ARCHIVE_PATH" \
    clean archive \
    2>&1 | tee "$BUILD_LOG"; then
    echo -e "${GREEN}✅ Archive created successfully${NC}"
else
    echo -e "${RED}❌ Archive failed. Check build log: $BUILD_LOG${NC}"
    echo -e "${YELLOW}💡 Common issues:${NC}"
    echo "   • Ensure you're signed into Xcode with your Apple Developer account"
    echo "   • Check that provisioning profiles are up to date"
    echo "   • Verify the scheme '$SCHEME_NAME' exists and is shared"
    exit 1
fi

# Step 6: Export IPA
echo -e "${BLUE}📤 Exporting IPA for App Store...${NC}"
if xcodebuild \
    -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportPath "_artifacts/ios_builds/" \
    -exportOptionsPlist "$EXPORT_OPTIONS_PATH" \
    2>&1 | tee -a "$BUILD_LOG"; then
    echo -e "${GREEN}✅ IPA exported successfully${NC}"
else
    echo -e "${RED}❌ IPA export failed. Check build log: $BUILD_LOG${NC}"
    echo -e "${YELLOW}💡 Common issues:${NC}"
    echo "   • Provisioning profile mismatch"
    echo "   • Code signing issues"
    echo "   • Missing entitlements"
    exit 1
fi

# Step 7: Verify outputs
echo -e "${BLUE}🔍 Verifying build outputs...${NC}"

if [ -d "$ARCHIVE_PATH" ]; then
    echo -e "${GREEN}✅ Archive found: $ARCHIVE_PATH${NC}"
    ARCHIVE_SIZE=$(du -sh "$ARCHIVE_PATH" | cut -f1)
    echo "   Size: $ARCHIVE_SIZE"
else
    echo -e "${RED}❌ Archive not found${NC}"
    exit 1
fi

# Find the IPA file (Xcode exports to a subdirectory)
IPA_FILE=$(find _artifacts/ios_builds -name "*.ipa" -type f | head -n 1)
if [ -n "$IPA_FILE" ]; then
    echo -e "${GREEN}✅ IPA found: $IPA_FILE${NC}"
    IPA_SIZE=$(du -sh "$IPA_FILE" | cut -f1)
    echo "   Size: $IPA_SIZE"
else
    echo -e "${RED}❌ IPA not found${NC}"
    exit 1
fi

# Step 8: Success summary
echo ""
echo -e "${GREEN}🎉 iOS Archive Complete!${NC}"
echo "=================================================="
echo -e "${BLUE}📦 Archive:${NC} $ARCHIVE_PATH"
echo -e "${BLUE}📱 IPA:${NC} $IPA_FILE"
echo -e "${BLUE}📋 Build Log:${NC} $BUILD_LOG"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Open Xcode Organizer to upload to App Store Connect:"
echo "   Xcode → Window → Organizer → Archives"
echo "2. Or use Xcode command line:"
echo "   xcrun altool --upload-app -f \"$IPA_FILE\" -u your-apple-id -p your-app-password"
echo "3. Or use Transporter app from the Mac App Store"
echo ""
echo -e "${BLUE}🔗 Useful Links:${NC}"
echo "• App Store Connect: https://appstoreconnect.apple.com"
echo "• TestFlight: https://appstoreconnect.apple.com/apps/testflight"
echo ""
