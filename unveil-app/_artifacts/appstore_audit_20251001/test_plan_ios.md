# iOS Testing Plan - App Store Readiness
**Date:** October 1, 2025  
**Project:** Unveil Wedding App  
**Purpose:** Comprehensive testing strategy for iOS app submission  

## Testing Overview

### Testing Objectives
1. **Functionality Validation** - Ensure all features work correctly on iOS
2. **Device Compatibility** - Test across iPhone models and iOS versions
3. **Performance Verification** - Validate app performance meets standards
4. **Deep Link Integration** - Verify Universal Links and custom schemes
5. **Authentication Flows** - Test Supabase auth in native context
6. **User Experience** - Ensure smooth, intuitive mobile experience

### Testing Scope
- **Platforms:** iOS 15.0+ on iPhone devices
- **Test Types:** Manual functional testing, compatibility testing, performance testing
- **Duration:** 2 weeks (parallel with development)
- **Team:** Development team + external beta testers

## Device & OS Testing Matrix

### Primary Test Devices (Must Test)

| Device | iOS Version | Screen Size | Priority | Test Focus |
|--------|-------------|-------------|----------|------------|
| **iPhone 14 Pro Max** | iOS 17.x | 6.7" | 🔴 Critical | Primary development device |
| **iPhone 13** | iOS 16.x | 6.1" | 🔴 Critical | Most common user device |
| **iPhone 12 mini** | iOS 15.x | 5.4" | 🟡 Important | Small screen compatibility |
| **iPhone SE (3rd gen)** | iOS 16.x | 4.7" | 🟡 Important | Budget device segment |

### Secondary Test Devices (Should Test)

| Device | iOS Version | Screen Size | Priority | Test Focus |
|--------|-------------|-------------|----------|------------|
| **iPhone 14** | iOS 17.x | 6.1" | 🟢 Nice to Have | Current generation |
| **iPhone 11** | iOS 15.x | 6.1" | 🟢 Nice to Have | Older device performance |
| **iPhone XR** | iOS 15.x | 6.1" | 🟢 Nice to Have | Legacy device support |

### iOS Version Coverage Strategy
- **iOS 17.x** (Latest) - 40% of testing effort
- **iOS 16.x** (Current) - 40% of testing effort  
- **iOS 15.x** (Minimum) - 20% of testing effort

## Core Functionality Test Cases

### 1. Authentication & Onboarding

#### Test Case 1.1: Phone Number Authentication
**Objective:** Verify SMS OTP authentication works in native app context

**Steps:**
1. Launch app on fresh install
2. Enter valid phone number
3. Request OTP code
4. Enter correct OTP
5. Complete profile setup
6. Verify successful login

**Expected Results:**
- SMS received within 30 seconds
- OTP verification succeeds
- Profile creation completes
- User redirected to event selection

**Test Data:**
- Valid phone numbers: +1555000001, +1555000002
- Invalid formats: 555-0001, (555) 000-0001
- International numbers: +44123456789

#### Test Case 1.2: Authentication State Persistence
**Objective:** Verify auth state survives app backgrounding/foregrounding

**Steps:**
1. Complete authentication flow
2. Navigate to event selection
3. Background app (home button)
4. Wait 5 minutes
5. Foreground app
6. Verify still authenticated

**Expected Results:**
- No re-authentication required
- User remains on same screen
- Data loads correctly

#### Test Case 1.3: Session Expiry Handling
**Objective:** Verify graceful handling of expired sessions

**Steps:**
1. Complete authentication
2. Manually expire session (developer tools)
3. Attempt to perform authenticated action
4. Verify redirect to login

**Expected Results:**
- Clear error message about session expiry
- Automatic redirect to login
- Return URL preserved for post-auth redirect

### 2. Deep Link Integration

#### Test Case 2.1: Universal Links - Event Access
**Objective:** Verify Universal Links open correct app screens

**Test Scenarios:**
```
https://app.sendunveil.com/select-event
→ Should open: Event selection screen

https://app.sendunveil.com/guest/events/[uuid]
→ Should open: Guest event home (if authorized)

https://app.sendunveil.com/host/events/[uuid]/dashboard  
→ Should open: Host dashboard (if authorized)

https://app.sendunveil.com/login?next=/guest/events/[uuid]
→ Should open: Login, then redirect to event after auth
```

**Testing Methods:**
- Send links via Messages app
- Send links via Mail app
- Open links from Safari
- Test with app installed vs not installed

#### Test Case 2.2: Custom Scheme Fallback
**Objective:** Verify custom scheme URLs work as fallback

**Test Scenarios:**
```
unveil://select-event
→ Should open: Event selection screen

unveil://guest/event/[uuid]
→ Should open: Guest event home

unveil://host/event/[uuid]
→ Should open: Host dashboard
```

**Testing Methods:**
- iOS Simulator: `xcrun simctl openurl booted "unveil://select-event"`
- Safari address bar: Type custom scheme URL
- Third-party app integration

#### Test Case 2.3: Authentication Required Deep Links
**Objective:** Verify unauthenticated deep link access

**Steps:**
1. Clear app data/reinstall app
2. Click deep link to protected content
3. Verify redirect to login
4. Complete authentication
5. Verify redirect to original destination

**Expected Results:**
- Login screen appears with return URL preserved
- After auth, user reaches intended destination
- No data loss or navigation errors

### 3. Core App Features

#### Test Case 3.1: Event Selection & Navigation
**Objective:** Verify event selection and navigation works correctly

**Steps:**
1. Complete authentication
2. View available events
3. Select an event
4. Navigate between event sections
5. Return to event selection

**Expected Results:**
- Events load within 3 seconds
- Smooth navigation between screens
- Proper back button behavior
- Event data displays correctly

#### Test Case 3.2: Photo Upload & Gallery
**Objective:** Verify photo sharing functionality

**Steps:**
1. Navigate to event photo gallery
2. Tap upload button
3. Select photo from library
4. Add caption
5. Upload photo
6. Verify photo appears in gallery

**Expected Results:**
- Photo picker opens correctly
- Upload progress indicator works
- Photo appears in gallery within 10 seconds
- Caption displays correctly

#### Test Case 3.3: Real-Time Messaging
**Objective:** Verify messaging functionality and real-time updates

**Steps:**
1. Open event messages
2. Send a message
3. Verify message appears
4. Test with second device/user
5. Verify real-time delivery

**Expected Results:**
- Messages send within 2 seconds
- Real-time updates work correctly
- Message history loads properly
- No duplicate messages

#### Test Case 3.4: RSVP Management
**Objective:** Verify RSVP functionality for guests

**Steps:**
1. Navigate to guest event home
2. View current RSVP status
3. Change RSVP status
4. Add guest count and notes
5. Save changes
6. Verify updates persist

**Expected Results:**
- Current status displays correctly
- Changes save successfully
- Host sees updated RSVP status
- Data persists across app restarts

### 4. Performance Testing

#### Test Case 4.1: App Launch Performance
**Objective:** Verify acceptable app launch times

**Metrics:**
- Cold launch: <3 seconds to interactive
- Warm launch: <1 second to interactive
- Memory usage: <100MB baseline

**Testing Method:**
1. Force quit app
2. Launch app and measure time to interactive
3. Repeat 10 times and average results
4. Test across different device models

#### Test Case 4.2: Network Performance
**Objective:** Verify app performance under various network conditions

**Test Scenarios:**
- WiFi (high speed)
- LTE (good signal)
- 3G (slower connection)
- Poor connectivity (1 bar)
- Offline mode

**Expected Results:**
- Graceful degradation with slower networks
- Appropriate loading indicators
- Offline functionality where possible
- No crashes due to network issues

#### Test Case 4.3: Memory & Battery Usage
**Objective:** Verify reasonable resource consumption

**Metrics:**
- Memory usage: <150MB during normal use
- Battery drain: <5% per hour of active use
- CPU usage: <20% average during normal use

**Testing Method:**
- Use Xcode Instruments for profiling
- Monitor during 30-minute usage sessions
- Test photo upload and real-time features

### 5. User Experience Testing

#### Test Case 5.1: Keyboard & Input Handling
**Objective:** Verify keyboard behavior and input handling

**Test Areas:**
- Text input fields (messages, captions, profile)
- Keyboard appearance/dismissal
- Input validation and error states
- Auto-correction and suggestions

**Expected Results:**
- Keyboard appears/dismisses smoothly
- Input validation provides clear feedback
- No UI layout issues with keyboard
- Proper input focus management

#### Test Case 5.2: Touch & Gesture Handling
**Objective:** Verify touch interactions work correctly

**Test Areas:**
- Button taps and touch targets
- Scroll behavior in lists and galleries
- Pull-to-refresh functionality
- Swipe gestures (if implemented)

**Expected Results:**
- All touch targets are 44pt minimum
- Smooth scrolling performance
- Proper gesture recognition
- No accidental activations

#### Test Case 5.3: Accessibility Testing
**Objective:** Verify app accessibility features

**Test Areas:**
- VoiceOver navigation
- Dynamic Type support
- Color contrast ratios
- Focus management

**Testing Method:**
- Enable VoiceOver and navigate app
- Test with largest Dynamic Type size
- Use accessibility inspector
- Test with high contrast mode

### 6. Edge Cases & Error Handling

#### Test Case 6.1: Network Interruption
**Objective:** Verify graceful handling of network issues

**Steps:**
1. Begin photo upload
2. Disable network mid-upload
3. Re-enable network
4. Verify recovery behavior

**Expected Results:**
- Clear error message about network issue
- Option to retry operation
- No data loss or corruption
- Graceful recovery when network restored

#### Test Case 6.2: Low Storage Scenarios
**Objective:** Verify behavior when device storage is low

**Steps:**
1. Fill device storage to <100MB free
2. Attempt photo upload
3. Verify error handling

**Expected Results:**
- Clear error message about storage
- Suggestion to free up space
- No app crashes or data corruption

#### Test Case 6.3: Background App Refresh
**Objective:** Verify behavior when backgrounded

**Steps:**
1. Open app and navigate to messages
2. Background app for extended period
3. Foreground app
4. Verify data freshness and state

**Expected Results:**
- App resumes where left off
- Data refreshes appropriately
- No stale or inconsistent data
- Smooth transition back to foreground

## Beta Testing Strategy

### Internal Testing (Week 1)
**Participants:** Development team (3-5 people)  
**Focus:** Core functionality, major bugs, basic compatibility  
**Devices:** Primary test devices  
**Feedback Method:** Direct communication, bug tracking system

### External Beta Testing (Week 2)
**Participants:** Wedding industry contacts, friends/family (10-15 people)  
**Focus:** User experience, real-world usage, edge cases  
**Devices:** Variety of user devices  
**Feedback Method:** TestFlight feedback, survey, direct interviews

### Beta Test Scenarios
1. **Complete Wedding Event Simulation**
   - Create event, invite guests, share photos
   - Test full host and guest workflows
   - Simulate real wedding day usage

2. **Multi-Device Testing**
   - Same user on multiple devices
   - Multiple users in same event
   - Real-time synchronization testing

3. **Extended Usage Testing**
   - Use app for several days
   - Test notification handling
   - Verify data persistence

## Test Environment Setup

### Development Environment
- **Supabase:** Dedicated testing project
- **Test Data:** Realistic wedding events and users
- **SMS Testing:** Twilio test credentials
- **Push Notifications:** Development certificates

### TestFlight Distribution
- **Internal Track:** Development team
- **External Track:** Beta testers
- **Build Notes:** Clear instructions for each build
- **Feedback Collection:** Structured feedback forms

## Acceptance Criteria

### Functionality Requirements
- [ ] All core features work correctly on primary devices
- [ ] Authentication flows complete successfully
- [ ] Deep links navigate to correct screens
- [ ] Real-time features update within 5 seconds
- [ ] Photo uploads complete within 30 seconds

### Performance Requirements
- [ ] App launches in <3 seconds (cold start)
- [ ] Memory usage stays <150MB during normal use
- [ ] No crashes during 30-minute usage sessions
- [ ] Smooth 60fps scrolling in galleries and lists

### Compatibility Requirements
- [ ] Works correctly on iOS 15.0+
- [ ] Functions properly on all target device sizes
- [ ] Handles network interruptions gracefully
- [ ] Supports accessibility features

### User Experience Requirements
- [ ] Intuitive navigation without training
- [ ] Clear error messages and recovery options
- [ ] Responsive touch interactions
- [ ] Appropriate loading states and feedback

## Bug Triage & Resolution

### Severity Levels
- **Critical:** App crashes, data loss, security issues
- **High:** Core features broken, major UX issues
- **Medium:** Minor feature issues, cosmetic problems
- **Low:** Enhancement requests, minor polish items

### Resolution Timeline
- **Critical:** Fix within 24 hours
- **High:** Fix within 3 days
- **Medium:** Fix before App Store submission
- **Low:** Consider for post-launch updates

## Test Reporting

### Daily Test Reports
- Test cases executed
- Bugs found and severity
- Performance metrics
- Device coverage status

### Weekly Summary Reports
- Overall test progress
- Critical issues and resolutions
- Performance trends
- Beta tester feedback summary

### Final Test Report
- Complete test coverage summary
- All resolved issues documentation
- Performance benchmarks achieved
- Recommendation for App Store submission

---

**Success Criteria:**
- 95% of test cases pass on primary devices
- No critical or high severity bugs remaining
- Performance meets all benchmarks
- Positive feedback from beta testers
- Ready for App Store submission
