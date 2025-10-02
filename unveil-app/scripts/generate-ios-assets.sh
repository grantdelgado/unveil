#!/bin/bash

# iOS Assets Generation Script
# Usage: ./scripts/generate-ios-assets.sh
# Requires: ImageMagick (brew install imagemagick)

set -e

# Colors from brand guidelines
PRIMARY_COLOR="#E15B50"
BACKGROUND_COLOR="#FFF5E5"

# Source icon (use highest quality available)
SOURCE_ICON="public/icon-512.png"

# Check if ImageMagick is installed
if ! command -v magick &> /dev/null; then
    echo "❌ ImageMagick not found. Please install:"
    echo "   brew install imagemagick"
    echo ""
    echo "Alternative: Use online generators:"
    echo "   - https://appicon.co/"
    echo "   - https://icon.kitchen/"
    exit 1
fi

# Check if source icon exists
if [ ! -f "$SOURCE_ICON" ]; then
    echo "❌ Source icon not found: $SOURCE_ICON"
    echo "Please ensure a high-quality source icon exists."
    exit 1
fi

echo "🎨 Generating iOS App Icons..."

# Create iOS icons directory
mkdir -p public/icons/ios

# Generate all required iOS icon sizes
echo "  📱 Generating app icons..."
magick "$SOURCE_ICON" -resize 29x29 public/icons/ios/icon-29x29.png
magick "$SOURCE_ICON" -resize 40x40 public/icons/ios/icon-40x40.png
magick "$SOURCE_ICON" -resize 58x58 public/icons/ios/icon-58x58.png
magick "$SOURCE_ICON" -resize 60x60 public/icons/ios/icon-60x60.png
magick "$SOURCE_ICON" -resize 80x80 public/icons/ios/icon-80x80.png
magick "$SOURCE_ICON" -resize 87x87 public/icons/ios/icon-87x87.png
magick "$SOURCE_ICON" -resize 120x120 public/icons/ios/icon-120x120.png
magick "$SOURCE_ICON" -resize 180x180 public/icons/ios/icon-180x180.png
magick "$SOURCE_ICON" -resize 1024x1024 public/icons/ios/icon-1024x1024.png

echo "🖼️  Generating iOS Launch Screens..."

# Create iOS splash directory
mkdir -p public/splash/ios

# Create base launch screen with brand background
magick -size 1170x2532 xc:"$BACKGROUND_COLOR" temp_base_launch.png

# If logo exists, add it centered (optional)
if [ -f "public/icons/icon-512x512.png" ]; then
    echo "  🎯 Adding logo to launch screens..."
    # Resize logo to appropriate size for launch screen
    magick public/icons/icon-512x512.png -resize 200x200 temp_logo.png
    # Composite logo onto base launch screen
    magick temp_base_launch.png temp_logo.png -gravity center -composite temp_base_launch.png
fi

# Generate all required launch screen sizes
echo "  📱 Generating launch screens..."
magick temp_base_launch.png -resize 750x1334! public/splash/ios/launch-750x1334.png
magick temp_base_launch.png -resize 828x1792! public/splash/ios/launch-828x1792.png
magick temp_base_launch.png -resize 1125x2436! public/splash/ios/launch-1125x2436.png
magick temp_base_launch.png -resize 1242x2208! public/splash/ios/launch-1242x2208.png
magick temp_base_launch.png -resize 1242x2688! public/splash/ios/launch-1242x2688.png
magick temp_base_launch.png -resize 1170x2532! public/splash/ios/launch-1170x2532.png
magick temp_base_launch.png -resize 1284x2778! public/splash/ios/launch-1284x2778.png

# Clean up temporary files
rm -f temp_base_launch.png temp_logo.png

echo "✅ iOS Assets Generated Successfully!"
echo ""
echo "📁 Generated Files:"
echo "   Icons: public/icons/ios/ (9 files)"
echo "   Launch Screens: public/splash/ios/ (7 files)"
echo ""
echo "📋 Next Steps:"
echo "   1. Review generated assets for quality"
echo "   2. Test icons at actual device sizes"
echo "   3. Add assets to Capacitor iOS project"
echo "   4. Configure asset catalog in Xcode"
echo ""
echo "🎨 For production-quality assets, consider:"
echo "   - Professional icon design from brand guidelines"
echo "   - Custom launch screen with Unveil branding"
echo "   - Vector-based source files for crisp scaling"
