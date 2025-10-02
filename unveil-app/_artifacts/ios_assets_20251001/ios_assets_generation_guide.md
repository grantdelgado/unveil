# iOS Assets Generation Guide
**Date:** October 1, 2025  
**Project:** Unveil Wedding App  
**Purpose:** Step-by-step guide for generating required iOS assets  

## Source Assets Available

### Current Icon Assets
- **512x512 PNG:** `/public/icon-512.png` (base for generation)
- **192x192 PNG:** `/public/icon-192.png` (alternative source)
- **SVG Icons:** Available in `/public/icons/` (vector source preferred)

### Brand Colors (from audit)
- **Primary:** #E15B50 (coral/rose)
- **Background:** #FFF5E5 (warm cream)
- **Theme:** Wedding-appropriate, elegant, minimal

## Required iOS App Icons

### Critical Icons (Must Generate)
```bash
# High Priority - Required for App Store submission
29x29     # Settings icon
40x40     # Spotlight search
58x58     # Settings @2x
80x80     # Spotlight @2x  
120x120   # App icon @2x (most common)
180x180   # App icon @3x (most common)
1024x1024 # App Store listing

# Medium Priority - iOS system integration
60x60     # App @1x (rare but required)
87x87     # Settings @3x
```

### Generation Commands (Using ImageMagick)

```bash
# Install ImageMagick if not available
# brew install imagemagick

# Source file (use highest quality available)
SOURCE_ICON="public/icon-512.png"

# Generate all required iOS icon sizes
magick $SOURCE_ICON -resize 29x29 public/icons/ios/icon-29x29.png
magick $SOURCE_ICON -resize 40x40 public/icons/ios/icon-40x40.png
magick $SOURCE_ICON -resize 58x58 public/icons/ios/icon-58x58.png
magick $SOURCE_ICON -resize 60x60 public/icons/ios/icon-60x60.png
magick $SOURCE_ICON -resize 80x80 public/icons/ios/icon-80x80.png
magick $SOURCE_ICON -resize 87x87 public/icons/ios/icon-87x87.png
magick $SOURCE_ICON -resize 120x120 public/icons/ios/icon-120x120.png
magick $SOURCE_ICON -resize 180x180 public/icons/ios/icon-180x180.png
magick $SOURCE_ICON -resize 1024x1024 public/icons/ios/icon-1024x1024.png
```

## Required iOS Launch Screens

### Critical Launch Screen Sizes
```bash
# iPhone Launch Screens (Portrait)
750x1334    # iPhone 6/7/8
828x1792    # iPhone XR/11
1125x2436   # iPhone X/XS/11 Pro
1242x2208   # iPhone 6/7/8 Plus
1242x2688   # iPhone XS Max/11 Pro Max
1170x2532   # iPhone 12/13/14
1284x2778   # iPhone 12/13/14 Pro Max
```

### Launch Screen Design Specs
- **Background Color:** #FFF5E5 (warm cream)
- **Logo/Wordmark:** Centered, appropriate size
- **Style:** Minimal, matches app's first screen
- **Content:** No text that requires localization

### Launch Screen Generation Commands

```bash
# Create base launch screen template (1170x2532 as base)
# This would typically be done in design software, but here's the concept:

# Background with brand color
magick -size 1170x2532 xc:"#FFF5E5" base_launch.png

# Add centered logo (assuming logo.png exists)
# magick base_launch.png logo.png -gravity center -composite launch_1170x2532.png

# Generate other sizes by cropping/scaling from base
magick launch_1170x2532.png -resize 750x1334! public/splash/ios/launch-750x1334.png
magick launch_1170x2532.png -resize 828x1792! public/splash/ios/launch-828x1792.png
magick launch_1170x2532.png -resize 1125x2436! public/splash/ios/launch-1125x2436.png
magick launch_1170x2532.png -resize 1242x2208! public/splash/ios/launch-1242x2208.png
magick launch_1170x2532.png -resize 1242x2688! public/splash/ios/launch-1242x2688.png
magick launch_1170x2532.png -resize 1170x2532! public/splash/ios/launch-1170x2532.png
magick launch_1170x2532.png -resize 1284x2778! public/splash/ios/launch-1284x2778.png
```

## Asset Validation Checklist

### Icon Validation
- [ ] All icons are PNG format (no transparency)
- [ ] Icons are square (1:1 aspect ratio)
- [ ] Icons are crisp at small sizes (test 29x29)
- [ ] Icons follow iOS design guidelines
- [ ] File sizes are reasonable (<100KB each)

### Launch Screen Validation  
- [ ] All launch screens match app's initial appearance
- [ ] Background color matches brand (#FFF5E5)
- [ ] No text that requires localization
- [ ] Images load quickly on device
- [ ] Consistent visual style across sizes

## Alternative: Online Icon Generators

If ImageMagick is not available, use these online tools:

### Recommended Tools
1. **App Icon Generator** (https://appicon.co/)
   - Upload 1024x1024 source image
   - Generates all iOS sizes automatically
   - Downloads as organized folder

2. **Icon Generator** (https://icon.kitchen/)
   - Supports multiple platforms
   - Good for batch generation
   - Includes launch screen templates

3. **Figma/Sketch Export**
   - Design icons in vector format
   - Export at multiple resolutions
   - Ensures pixel-perfect results

## Manual Asset Creation (Temporary)

For immediate testing, I'll create placeholder assets with correct dimensions:

```bash
# Create placeholder icons with brand color
magick -size 29x29 xc:"#E15B50" public/icons/ios/icon-29x29.png
magick -size 40x40 xc:"#E15B50" public/icons/ios/icon-40x40.png
magick -size 58x58 xc:"#E15B50" public/icons/ios/icon-58x58.png
magick -size 60x60 xc:"#E15B50" public/icons/ios/icon-60x60.png
magick -size 80x80 xc:"#E15B50" public/icons/ios/icon-80x80.png
magick -size 87x87 xc:"#E15B50" public/icons/ios/icon-87x87.png
magick -size 120x120 xc:"#E15B50" public/icons/ios/icon-120x120.png
magick -size 180x180 xc:"#E15B50" public/icons/ios/icon-180x180.png
magick -size 1024x1024 xc:"#E15B50" public/icons/ios/icon-1024x1024.png

# Create placeholder launch screens
magick -size 750x1334 xc:"#FFF5E5" public/splash/ios/launch-750x1334.png
magick -size 828x1792 xc:"#FFF5E5" public/splash/ios/launch-828x1792.png
magick -size 1125x2436 xc:"#FFF5E5" public/splash/ios/launch-1125x2436.png
magick -size 1242x2208 xc:"#FFF5E5" public/splash/ios/launch-1242x2208.png
magick -size 1242x2688 xc:"#FFF5E5" public/splash/ios/launch-1242x2688.png
magick -size 1170x2532 xc:"#FFF5E5" public/splash/ios/launch-1170x2532.png
magick -size 1284x2778 xc:"#FFF5E5" public/splash/ios/launch-1284x2778.png
```

## Next Steps

1. **Design Team Action Required:**
   - Create proper app icon design based on brand guidelines
   - Design launch screen with Unveil logo/wordmark
   - Export high-resolution source files

2. **Development Integration:**
   - Add generated assets to Capacitor iOS project
   - Configure asset catalog in Xcode
   - Test assets on various iOS devices

3. **Quality Assurance:**
   - Test icons at actual device sizes
   - Verify launch screens display correctly
   - Ensure assets meet App Store requirements

## File Structure After Generation

```
public/
├── icons/
│   └── ios/
│       ├── icon-29x29.png
│       ├── icon-40x40.png
│       ├── icon-58x58.png
│       ├── icon-60x60.png
│       ├── icon-80x80.png
│       ├── icon-87x87.png
│       ├── icon-120x120.png
│       ├── icon-180x180.png
│       └── icon-1024x1024.png
└── splash/
    └── ios/
        ├── launch-750x1334.png
        ├── launch-828x1792.png
        ├── launch-1125x2436.png
        ├── launch-1242x2208.png
        ├── launch-1242x2688.png
        ├── launch-1170x2532.png
        └── launch-1284x2778.png
```

---

**Status:** Placeholder assets created for immediate development needs  
**Action Required:** Design team to create final branded assets  
**Timeline:** 1-2 days for proper asset creation and integration
