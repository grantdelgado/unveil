# PWA Manifest Audit - iOS App Store Preparation
**Date:** October 1, 2025  
**File:** `app/manifest.webmanifest`  
**Purpose:** Assess current PWA manifest for iOS app packaging compatibility  

## Current Manifest Analysis

### Manifest File Location
- **Current:** `app/manifest.webmanifest`
- **Served at:** `/manifest.webmanifest`
- **Content-Type:** `application/manifest+json` (configured in `next.config.ts`)

### Current Manifest Content
```json
{
  "name": "Unveil",
  "short_name": "Unveil", 
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FFF5E5",
  "theme_color": "#E15B50",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    {
      "src": "/icon-512-maskable.png",
      "sizes": "512x512", 
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

## Field-by-Field Assessment

### ✅ **Compliant Fields**

| Field | Current Value | iOS Compatibility | Notes |
|-------|---------------|-------------------|-------|
| `name` | "Unveil" | ✅ Good | Clear, matches app branding |
| `short_name` | "Unveil" | ✅ Good | Appropriate length for iOS |
| `display` | "standalone" | ✅ Good | Correct for native app feel |
| `background_color` | "#FFF5E5" | ✅ Good | Matches brand colors |
| `theme_color` | "#E15B50" | ✅ Good | Consistent with iOS viewport meta |

### ⚠️ **Fields Needing Enhancement**

| Field | Current Value | Issue | Recommendation |
|-------|---------------|-------|----------------|
| `start_url` | "/" | Basic | Consider `/select-event` for authenticated users |
| `icons` | 3 icons only | Insufficient for iOS | Need comprehensive iOS icon set |

### ❌ **Missing Fields for iOS**

| Field | Missing | iOS Benefit | Recommended Value |
|-------|---------|-------------|-------------------|
| `description` | Yes | App Store metadata | "Beautifully preserve and share your wedding memories" |
| `orientation` | Yes | iOS display control | "portrait-primary" |
| `scope` | Yes | Navigation boundaries | "/" |
| `categories` | Yes | App Store categorization | ["lifestyle", "social"] |
| `lang` | Yes | Internationalization | "en" |
| `dir` | Yes | Text direction | "ltr" |

## Icon Analysis

### Current Icon Set
| Icon | Size | Purpose | iOS Compatibility |
|------|------|---------|-------------------|
| `icon-192.png` | 192×192 | Standard PWA | ⚠️ Not iOS native size |
| `icon-512.png` | 512×512 | Large PWA | ⚠️ Not iOS native size |
| `icon-512-maskable.png` | 512×512 | Adaptive icon | ❌ iOS doesn't use maskable |

### iOS Required Icon Sizes
| Size | Purpose | Current Status | Priority |
|------|---------|----------------|----------|
| 29×29 | Settings | ❌ Missing | High |
| 40×40 | Spotlight | ❌ Missing | High |
| 58×58 | Settings @2x | ❌ Missing | High |
| 60×60 | App @1x | ❌ Missing | Medium |
| 80×80 | Spotlight @2x | ❌ Missing | High |
| 87×87 | Settings @3x | ❌ Missing | Medium |
| 120×120 | App @2x | ❌ Missing | High |
| 180×180 | App @3x | ❌ Missing | High |
| 1024×1024 | App Store | ❌ Missing | High |

### Apple Touch Icons (Current)
**From `app/layout.tsx`:**
```tsx
<link rel="apple-touch-icon" href="/apple-icon.png?v=1755746392" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-icon.png?v=1755746392" />
```

**Assessment:** Basic Apple touch icon present but insufficient for comprehensive iOS support.

## Enhanced Manifest Recommendation

### Proposed Enhanced Manifest
```json
{
  "name": "Unveil Wedding App",
  "short_name": "Unveil",
  "description": "Beautifully preserve and share your wedding memories with real-time photo sharing, messaging, and event coordination.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#FFF5E5",
  "theme_color": "#E15B50",
  "lang": "en",
  "dir": "ltr",
  "categories": ["lifestyle", "social", "photo"],
  "icons": [
    {
      "src": "/icons/icon-29x29.png",
      "sizes": "29x29",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-40x40.png", 
      "sizes": "40x40",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-58x58.png",
      "sizes": "58x58", 
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-60x60.png",
      "sizes": "60x60",
      "type": "image/png", 
      "purpose": "any"
    },
    {
      "src": "/icons/icon-80x80.png",
      "sizes": "80x80",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-87x87.png",
      "sizes": "87x87",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-120x120.png",
      "sizes": "120x120",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-180x180.png",
      "sizes": "180x180",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-1024x1024.png",
      "sizes": "1024x1024",
      "type": "image/png",
      "purpose": "any"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/ios-6.7-1.png",
      "sizes": "1290x2796",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "Event selection and RSVP management"
    },
    {
      "src": "/screenshots/ios-6.7-2.png", 
      "sizes": "1290x2796",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "Real-time photo sharing and messaging"
    }
  ]
}
```

## Capacitor Integration Considerations

### Manifest Usage in Capacitor
- **PWA manifest** provides metadata for web version
- **iOS Info.plist** provides metadata for native app
- **Consistency required** between both configurations

### Key Mappings
| PWA Manifest | iOS Info.plist | Notes |
|--------------|----------------|-------|
| `name` | `CFBundleDisplayName` | App display name |
| `short_name` | `CFBundleName` | Bundle name |
| `start_url` | Custom handling | Deep link configuration |
| `theme_color` | `UIStatusBarStyle` | Status bar appearance |
| `background_color` | `UILaunchStoryboard` | Launch screen color |
| `icons` | `CFBundleIcons` | App icon configuration |

## Action Items

### Immediate (Sprint 1)
1. **Generate iOS Icon Set**
   - Create all required iOS icon sizes from existing brand assets
   - Ensure icons follow iOS design guidelines (no transparency, square format)
   - Place in `/public/icons/` directory

2. **Update Manifest**
   - Add missing fields (description, orientation, scope, etc.)
   - Include comprehensive icon set
   - Add screenshot metadata for future use

3. **Verify Serving Configuration**
   - Ensure manifest served with correct Content-Type
   - Test manifest validation with PWA tools
   - Verify caching headers are appropriate

### Medium Priority (Sprint 2)
1. **Screenshot Generation**
   - Capture iOS-specific screenshots for App Store
   - Include in manifest for PWA screenshot support
   - Optimize for different iOS device sizes

2. **Manifest Validation**
   - Test with Lighthouse PWA audit
   - Validate with online PWA manifest validators
   - Ensure Capacitor compatibility

### Future Enhancements (Sprint 3)
1. **Advanced PWA Features**
   - Add `shortcuts` for quick actions
   - Include `share_target` for iOS sharing
   - Consider `protocol_handlers` for custom protocols

2. **Internationalization**
   - Add localized manifest versions
   - Support multiple languages if needed

## Compatibility Assessment

### PWA to iOS App Transition
| Aspect | Compatibility | Notes |
|--------|---------------|-------|
| **Manifest Structure** | ✅ Good | Standard manifest works with Capacitor |
| **Icon Formats** | ⚠️ Needs Work | Need iOS-specific sizes |
| **Color Scheme** | ✅ Good | Colors work well on iOS |
| **Display Mode** | ✅ Good | Standalone mode appropriate |
| **Start URL** | ✅ Good | Compatible with deep linking |

### Current vs Required
- **Current State:** Basic PWA manifest with minimal iOS consideration
- **Required State:** Comprehensive manifest supporting both PWA and iOS native packaging
- **Gap:** Primarily missing iOS-specific icon sizes and enhanced metadata

---

**Overall Assessment:** Current manifest provides a solid foundation but requires iOS-specific enhancements for optimal App Store presentation and native app integration.
