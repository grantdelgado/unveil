#!/bin/bash

# iOS Development Script with Deterministic First Paint
# Uses iOS-optimized layout for testing deterministic rendering

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting iOS Development with Deterministic First Paint${NC}"
echo "============================================================"

# Set development server URL
export CAP_SERVER_URL=http://localhost:3000
echo -e "${YELLOW}📡 Server URL: $CAP_SERVER_URL${NC}"

# Step 1: Start development server in background
echo -e "${BLUE}🔧 Starting development server...${NC}"
npm run dev &
DEV_SERVER_PID=$!

# Wait for server to start
sleep 5

# Step 2: Temporarily use iOS layout for testing
echo -e "${BLUE}📱 Switching to iOS-optimized layout...${NC}"

# Backup current layout
if [ -f "app/layout.tsx" ]; then
    cp app/layout.tsx app/layout-web.tsx.bak
fi

# Use iOS layout
if [ -f "app/layout-ios.tsx" ]; then
    cp app/layout-ios.tsx app/layout.tsx
    echo -e "${GREEN}✅ iOS layout activated${NC}"
else
    echo -e "${RED}❌ iOS layout not found${NC}"
    kill $DEV_SERVER_PID 2>/dev/null || true
    exit 1
fi

# Step 3: Copy to iOS
echo -e "${BLUE}📱 Copying assets to iOS...${NC}"
if ! npx cap copy ios; then
    echo -e "${RED}❌ Capacitor copy failed${NC}"
    
    # Restore original layout
    if [ -f "app/layout-web.tsx.bak" ]; then
        mv app/layout-web.tsx.bak app/layout.tsx
    fi
    kill $DEV_SERVER_PID 2>/dev/null || true
    exit 1
fi

# Step 4: Open Xcode
echo -e "${BLUE}📱 Opening iOS project in Xcode...${NC}"
npx cap open ios

echo -e "${GREEN}🎉 iOS Development Ready!${NC}"
echo "============================================="
echo -e "${BLUE}📱 Xcode:${NC} Select 'Unveil (Prod)' scheme and run"
echo -e "${BLUE}🌐 Dev Server:${NC} Running on http://localhost:3000"
echo -e "${BLUE}⚡ Layout:${NC} iOS-optimized (deterministic first paint)"
echo ""
echo -e "${YELLOW}To restore web layout when done:${NC}"
echo "  1. Stop this script (Ctrl+C)"
echo "  2. Run: mv app/layout-web.tsx.bak app/layout.tsx"
echo ""

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🧹 Cleaning up...${NC}"
    
    # Restore original layout
    if [ -f "app/layout-web.tsx.bak" ]; then
        mv app/layout-web.tsx.bak app/layout.tsx
        echo -e "${GREEN}✅ Web layout restored${NC}"
    fi
    
    # Kill dev server
    kill $DEV_SERVER_PID 2>/dev/null || true
    echo -e "${GREEN}✅ Development server stopped${NC}"
}

# Set trap to cleanup on script exit
trap cleanup EXIT

# Wait for user to stop the script
echo -e "${BLUE}Press Ctrl+C to stop and cleanup...${NC}"
wait $DEV_SERVER_PID
