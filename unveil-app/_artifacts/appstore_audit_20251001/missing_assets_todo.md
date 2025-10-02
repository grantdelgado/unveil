# Missing Assets Checklist - iOS App Store Preparation
**Date:** October 1, 2025  
**Project:** Unveil Wedding App  
**Purpose:** Comprehensive checklist for generating required iOS assets  

## iOS App Icons - CRITICAL ⚠️

### Required Sizes for iOS App Bundle

| Size | Usage | Devices | Priority | Status |
|------|-------|---------|----------|--------|
| 29×29 | Settings | iPhone, iPad | 🔴 High | ❌ Missing |
| 40×40 | Spotlight | iPhone, iPad | 🔴 High | ❌ Missing |
| 58×58 | Settings @2x | iPhone | 🔴 High | ❌ Missing |
| 60×60 | App @1x | iPhone (rare) | 🟡 Medium | ❌ Missing |
| 80×80 | Spotlight @2x | iPhone, iPad | 🔴 High | ❌ Missing |
| 87×87 | Settings @3x | iPhone | 🟡 Medium | ❌ Missing |
| 120×120 | App @2x | iPhone | 🔴 High | ❌ Missing |
| 180×180 | App @3x | iPhone | 🔴 High | ❌ Missing |
| 1024×1024 | App Store | All devices | 🔴 High | ❌ Missing |

### iPad Specific Icons (Future Consideration)

| Size | Usage | Priority | Status |
|------|-------|----------|--------|
| 76×76 | App @1x | 🟢 Low | ❌ Missing |
| 152×152 | App @2x | 🟢 Low | ❌ Missing |
| 167×167 | App @2x (Pro) | 🟢 Low | ❌ Missing |

### Icon Generation Checklist

#### ✅ **Preparation Tasks**
- [ ] Locate source brand assets (SVG or high-res PNG)
- [ ] Verify brand guidelines for icon treatment
- [ ] Ensure icon works at small sizes (29×29 test)
- [ ] Confirm icon follows iOS design guidelines:
  - [ ] No transparency
  - [ ] Square format (iOS adds rounded corners)
  - [ ] High contrast for visibility
  - [ ] Scalable design elements

#### ✅ **Generation Tasks**
- [ ] Generate 29×29 PNG (Settings)
- [ ] Generate 40×40 PNG (Spotlight)
- [ ] Generate 58×58 PNG (Settings @2x)
- [ ] Generate 60×60 PNG (App @1x)
- [ ] Generate 80×80 PNG (Spotlight @2x)
- [ ] Generate 87×87 PNG (Settings @3x)
- [ ] Generate 120×120 PNG (App @2x) - **Most Common**
- [ ] Generate 180×180 PNG (App @3x) - **Most Common**
- [ ] Generate 1024×1024 PNG (App Store) - **Required for Submission**

#### ✅ **Validation Tasks**
- [ ] Test icons at actual device sizes
- [ ] Verify icons display correctly in iOS Simulator
- [ ] Check icon clarity at smallest sizes
- [ ] Ensure consistent branding across all sizes
- [ ] Validate PNG compression and file sizes

## iOS Launch Screens - HIGH PRIORITY 🟡

### Required Launch Screen Sizes

| Device | Size | Orientation | Priority | Status |
|--------|------|-------------|----------|--------|
| iPhone 6/7/8 | 750×1334 | Portrait | 🟡 Medium | ❌ Missing |
| iPhone 6/7/8 Plus | 1242×2208 | Portrait | 🟡 Medium | ❌ Missing |
| iPhone X/XS | 1125×2436 | Portrait | 🟡 Medium | ❌ Missing |
| iPhone XR | 828×1792 | Portrait | 🟡 Medium | ❌ Missing |
| iPhone XS Max | 1242×2688 | Portrait | 🟡 Medium | ❌ Missing |
| iPhone 12 mini | 1080×2340 | Portrait | 🟡 Medium | ❌ Missing |
| iPhone 12/13/14 | 1170×2532 | Portrait | 🟡 Medium | ❌ Missing |
| iPhone 12/13/14 Pro Max | 1284×2778 | Portrait | 🟡 Medium | ❌ Missing |

### Launch Screen Design Guidelines

#### ✅ **Design Requirements**
- [ ] Match app's initial screen layout
- [ ] Use brand colors (#FFF5E5 background, #E15B50 accent)
- [ ] Minimal text (avoid localization issues)
- [ ] Fast loading appearance
- [ ] Consistent with app's visual identity

#### ✅ **Content Recommendations**
- [ ] Unveil logo/wordmark centered
- [ ] Subtle background pattern or solid color
- [ ] Loading indicator (optional)
- [ ] No user interface elements
- [ ] No advertising or promotional content

#### ✅ **Generation Tasks**
- [ ] Create base launch screen design (1x resolution)
- [ ] Generate all required device-specific sizes
- [ ] Test on actual devices for proper scaling
- [ ] Optimize file sizes for fast loading
- [ ] Validate colors match brand guidelines

## App Store Marketing Assets - MEDIUM PRIORITY 🟡

### App Store Screenshots

| Device Category | Size | Quantity Required | Priority | Status |
|-----------------|------|-------------------|----------|--------|
| 6.7" Display | 1290×2796 | 3-10 screenshots | 🟡 Medium | ❌ Missing |
| 6.5" Display | 1242×2688 | 3-10 screenshots | 🟡 Medium | ❌ Missing |
| 5.5" Display | 1242×2208 | 3-10 screenshots | 🟡 Medium | ❌ Missing |
| iPad Pro (12.9") | 2048×2732 | 3-10 screenshots | 🟢 Low | ❌ Missing |
| iPad Pro (11") | 1668×2388 | 3-10 screenshots | 🟢 Low | ❌ Missing |

### Screenshot Content Strategy

#### ✅ **Key Screens to Capture**
- [ ] **Event Selection** - Main app entry point
- [ ] **Guest RSVP Flow** - Core guest functionality  
- [ ] **Photo Sharing** - Key value proposition
- [ ] **Real-time Messaging** - Social engagement feature
- [ ] **Host Dashboard** - Event management overview
- [ ] **Guest Management** - Host invitation workflow
- [ ] **Event Details** - Information display
- [ ] **Media Gallery** - Photo viewing experience

#### ✅ **Screenshot Guidelines**
- [ ] Use realistic demo data (no Lorem Ipsum)
- [ ] Show app in use with authentic wedding content
- [ ] Highlight unique features and value propositions
- [ ] Ensure text is readable at App Store display sizes
- [ ] Use consistent device frames and backgrounds
- [ ] Include captions explaining key features

### App Store Metadata Assets

#### ✅ **Marketing Copy Assets**
- [ ] App Store title (30 characters max)
- [ ] Subtitle (30 characters max) 
- [ ] Promotional text (170 characters max)
- [ ] Description (4000 characters max)
- [ ] Keywords (100 characters max, comma-separated)
- [ ] What's New text (4000 characters max)

#### ✅ **Visual Assets**
- [ ] App preview videos (15-30 seconds, optional but recommended)
- [ ] Promotional artwork (1024×1024, optional)
- [ ] Apple Watch app icon (if applicable, future)

## Technical Assets - LOW PRIORITY 🟢

### Capacitor Configuration Assets

#### ✅ **iOS Project Assets**
- [ ] Info.plist configuration
- [ ] Entitlements.plist for capabilities
- [ ] LaunchScreen.storyboard (alternative to static images)
- [ ] iOS app bundle configuration

#### ✅ **Development Assets**
- [ ] Development provisioning profiles
- [ ] Distribution certificates
- [ ] App Store Connect metadata
- [ ] TestFlight beta testing assets

## Asset Generation Workflow

### Phase 1: Critical Assets (Sprint 1)
1. **App Icons Generation**
   - Source: Current brand assets
   - Tool: Adobe Illustrator/Photoshop or online icon generator
   - Output: All 9 required iOS icon sizes
   - Validation: Test in iOS Simulator

2. **Basic Launch Screens**
   - Design: Simple branded launch screen
   - Generate: Top 4 most common device sizes
   - Test: Verify loading appearance

### Phase 2: Store Preparation (Sprint 2)
1. **Screenshot Capture**
   - Setup: Demo data and test accounts
   - Capture: Key user flows on target devices
   - Edit: Add device frames and annotations
   - Optimize: For App Store display

2. **Marketing Copy**
   - Research: App Store optimization best practices
   - Write: Compelling descriptions and metadata
   - Review: Legal and brand compliance
   - Localize: If targeting multiple markets

### Phase 3: Polish & Optimization (Sprint 3)
1. **Advanced Assets**
   - Create: App preview videos
   - Generate: Additional device-specific assets
   - Optimize: File sizes and loading performance
   - Test: Complete asset integration

## Tools & Resources

### Recommended Tools
- **Icon Generation:** [App Icon Generator](https://appicon.co/), Adobe Creative Suite
- **Screenshot Tools:** iOS Simulator, Device screenshots, [Screenshot Framer](https://screenshot.rocks/)
- **Launch Screen Design:** Sketch, Figma, Adobe XD
- **Asset Optimization:** ImageOptim, TinyPNG

### Quality Checklist
- [ ] All assets follow iOS Human Interface Guidelines
- [ ] File sizes optimized for app bundle size
- [ ] Colors consistent with brand guidelines
- [ ] Assets tested on actual devices
- [ ] Backup copies stored in version control
- [ ] Asset naming follows iOS conventions

---

**Estimated Effort:**
- **Critical Assets (Icons + Launch):** 1-2 days
- **Store Screenshots:** 2-3 days  
- **Marketing Copy:** 1-2 days
- **Total:** 4-7 days for complete asset package
