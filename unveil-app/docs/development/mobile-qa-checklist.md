# Mobile QA Checklist

## Device Testing Matrix

### iOS Devices

- [ ] iPhone SE (375×667) - Smallest modern iPhone
- [ ] iPhone 12/13/14 (390×844) - Standard modern iPhone
- [ ] iPhone 14 Pro (393×852) - With Dynamic Island
- [ ] iPhone 14 Pro Max (430×932) - Largest iPhone

### Android Devices

- [ ] Pixel 5 (393×851) - Standard Android
- [ ] Pixel 7 (412×915) - Larger Android
- [ ] Galaxy S20 (412×915) - Popular Samsung device
- [ ] Small Android (360×800) - Minimum supported size

### Edge Cases

- [ ] Very narrow (320×568) - Oldest supported
- [ ] Very tall (360×800) - Tall aspect ratio

## Critical Screens Testing

### 1. Login/OTP Flow (`/login`)

- [ ] **Layout**: No horizontal scroll on any device
- [ ] **Safe Area**: Content not clipped by notch/Dynamic Island
- [ ] **Touch Targets**: All buttons ≥44px (iOS) / ≥48px (Android)
- [ ] **Keyboard**:
  - [ ] Phone input shows numeric keypad
  - [ ] OTP input shows numeric keypad with `inputMode="numeric"`
  - [ ] Virtual keyboard doesn't hide submit button
  - [ ] Auto-complete works for OTP (`autoComplete="one-time-code"`)
- [ ] **Text**: All text wraps properly, no overflow
- [ ] **Focus**: Visible focus indicators on all interactive elements

### 2. Event Selection (`/select-event`)

- [ ] **Layout**: Scrollable list, no content clipped
- [ ] **Safe Area**: Header and footer respect safe areas
- [ ] **Touch Targets**: Event cards and profile button are tappable
- [ ] **Text**: Event titles and locations wrap/truncate properly
- [ ] **Scroll**: Smooth scrolling, no rubber-band where unwanted
- [ ] **Empty State**: Displays properly on small screens

### 3. Guest Event Home (`/guest/events/[eventId]/home`)

- [ ] **Header**: Sticky header with proper safe-area padding
- [ ] **RSVP Badge**: Responsive sizing, doesn't overflow
- [ ] **Back Button**: Proper touch target size
- [ ] **Content**: Cards stack properly on narrow screens
- [ ] **Text**: Event details, location, host names wrap properly
- [ ] **Links**: External links (wedding website) work correctly

### 4. Messaging Interface

- [ ] **Message List**: Scrollable with proper padding-bottom
- [ ] **Compose Area**: Sticky bottom, keyboard-aware
- [ ] **Touch Targets**: Send button meets minimum size
- [ ] **Input**: Text area expands properly
- [ ] **Keyboard**: `enterKeyHint="send"` shows correct button

## Orientation Testing

- [ ] **Portrait**: Primary testing orientation
- [ ] **Landscape**: Critical content still accessible
- [ ] **Rotation**: Smooth transition, no layout breaks

## Accessibility Testing

- [ ] **Large Text (150%)**: Content doesn't overflow
- [ ] **Large Text (200%)**: Still usable (may require horizontal scroll)
- [ ] **High Contrast**: Text meets contrast requirements
- [ ] **Reduced Motion**: Animations respect preference
- [ ] **Screen Reader**: VoiceOver/TalkBack can navigate
- [ ] **Focus Management**: Logical tab order

## Performance Testing

- [ ] **Load Time**: Pages load within 3 seconds on 3G
- [ ] **Scroll Performance**: 60fps scrolling
- [ ] **Touch Response**: Immediate visual feedback (<100ms)
- [ ] **Memory**: No excessive memory usage growth
- [ ] **Battery**: No excessive battery drain

## Network Conditions

- [ ] **3G**: App remains usable
- [ ] **Offline**: Graceful degradation
- [ ] **Intermittent**: Proper error handling

## Browser Testing

### iOS Safari

- [ ] **Viewport**: No zoom on input focus
- [ ] **Safe Areas**: Proper handling of notch/Dynamic Island
- [ ] **Home Indicator**: Content not hidden behind it
- [ ] **Status Bar**: Proper color and style

### Android Chrome

- [ ] **Address Bar**: Auto-hide behavior doesn't break layout
- [ ] **Navigation Bar**: Three-button vs gesture navigation
- [ ] **System UI**: Immersive mode support

### PWA Mode

- [ ] **Standalone**: App launches in standalone mode
- [ ] **Status Bar**: Proper styling
- [ ] **Safe Areas**: Still work in PWA mode

## Edge Cases

- [ ] **Very Long Text**: Event names, locations, messages
- [ ] **No Data**: Empty states display correctly
- [ ] **Slow Network**: Loading states and timeouts
- [ ] **Low Memory**: App doesn't crash
- [ ] **Interruptions**: Phone calls, notifications, app switching

## Final Checklist

- [ ] No horizontal scrolling anywhere
- [ ] All interactive elements have proper touch targets
- [ ] Text is readable and wraps properly
- [ ] Safe areas are respected
- [ ] Keyboard interactions work correctly
- [ ] Performance is smooth (60fps)
- [ ] Accessibility requirements met
- [ ] Works across all target devices

## Test Commands

```bash
# Run responsive tests
npm run test:e2e -- tests/responsive.spec.ts

# Run with specific viewport
npm run test:e2e -- tests/responsive.spec.ts --config viewport.width=375 viewport.height=667

# Generate visual regression screenshots
npm run test:e2e -- tests/responsive.spec.ts --update-snapshots
```

## Notes

- Test with real devices when possible, simulators/emulators may not show all issues
- Pay special attention to iOS Safari and Android Chrome differences
- Test with different font sizes and accessibility settings
- Verify safe area handling on devices with notches/Dynamic Island
