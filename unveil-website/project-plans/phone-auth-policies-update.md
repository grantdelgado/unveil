# Phone-Based Auth Policies Update Project Plan

## Overview

Update the Unveil website's policies page to clearly document the phone-based authentication and opt-in process, ensuring compliance with A2P 10DLC requirements and providing clear documentation for Twilio/Vercel verification.

## Objectives

1. **Update Policies Page** - Clearly describe phone-based verification and opt-in process
2. **Ensure A2P 10DLC Compliance** - Meet common SMS opt-in requirements
3. **Provide Clear Documentation** - Support compliance verification for Twilio/Vercel
4. **Maintain User Trust** - Present honest, transparent communication about data usage

## Tasks

### 1. Update Guest Consent Section

**File**: `app/policies/page.tsx`

- [ ] **Replace current consent description** with phone-based auth explanation
- [ ] **Add SMS/Phone Authentication section** explaining:
  - Users provide phone number during signup/login
  - Two-factor authentication via SMS verification codes
  - Phone number used solely for account access and event communication
  - No separate marketing opt-in required
- [ ] **Update consent flow description** to reflect phone verification process
- [ ] **Clarify data usage** - phone numbers used only for account security and host communication

### 2. Add Phone Authentication Policy Section

**File**: `app/policies/page.tsx`

- [ ] **Create new "SMS & Phone Verification" policy section** including:
  - Clear statement about phone-based account authentication
  - Explanation of SMS verification code process
  - Data usage limitations (account access + event communication only)
  - User rights (opt-out, data deletion, etc.)
- [ ] **A2P 10DLC compliance language** covering:
  - Express consent obtained during signup
  - Clear purpose of SMS communications
  - Opt-out instructions (STOP keyword)
  - Message frequency expectations

### 3. Update Privacy Policy Language

**File**: `app/policies/page.tsx`

- [ ] **Enhance Privacy Policy section** to include:
  - Phone number collection and usage
  - SMS communication purposes
  - Data retention for phone numbers
  - Third-party sharing limitations (Twilio for SMS delivery only)
- [ ] **Add data minimization statement** - only collect phone numbers necessary for service

### 4. Create A2P 10DLC Compliance Documentation

**File**: `app/policies/page.tsx`

- [ ] **Add compliance documentation section** for verification purposes:
  - Clear opt-in mechanism description
  - Message type classification (transactional/account notifications)
  - User consent timestamp tracking
  - Audit trail availability
- [ ] **Include example consent language** users see during signup
- [ ] **Document opt-out mechanisms** and user rights

### 5. Update Supporting Content

**File**: `app/policies/page.tsx`

- [ ] **Update page header** to mention phone authentication
- [ ] **Revise meta description** to include SMS compliance
- [ ] **Update consent mockup image** (if applicable) to show phone auth flow
- [ ] **Add SMS compliance contact information** for verification inquiries

### 6. Enhance Legal Compliance

**File**: `app/policies/page.tsx`

- [ ] **Add Terms of Service updates** covering:
  - Phone number requirement for account access
  - SMS verification process agreement
  - Communication preferences and opt-out rights
- [ ] **Include message and data rates disclaimer**
- [ ] **Add carrier liability limitations**

## Content Requirements

### Key Messages to Include

1. **Clear Opt-In Process**:
   - "By providing your phone number during signup, you consent to receive SMS verification codes and event-related communications"
   - "Your phone number is required for secure account access via two-factor authentication"

2. **Data Usage Transparency**:
   - "Phone numbers are used exclusively for account verification and wedding event communication"
   - "We do not use phone numbers for marketing purposes or share them for promotional use"

3. **A2P 10DLC Compliance**:
   - "Express consent is obtained during account creation"
   - "Users can opt-out by replying STOP to any message"
   - "Message frequency varies based on event activity"

4. **User Rights**:
   - "You can request phone number deletion by contacting support"
   - "Consent can be withdrawn at any time"
   - "Account access requires phone verification"

### Technical Implementation

- **No breaking changes** to existing page structure
- **Maintain current design system** and styling
- **Preserve SEO-friendly structure**
- **Ensure mobile responsiveness**

## Success Criteria

- [ ] **Clear documentation** of phone-based auth process
- [ ] **A2P 10DLC compliant** language throughout
- [ ] **Honest and transparent** communication about data usage
- [ ] **Verification-ready** documentation for Twilio/Vercel compliance
- [ ] **User-friendly** language that maintains trust
- [ ] **Legal compliance** with SMS regulations

## Timeline

**Estimated Duration**: 4-6 hours

- **Content Updates**: 2-3 hours
- **Review & Refinement**: 1-2 hours  
- **Testing & Deployment**: 1 hour

## Dependencies

- [ ] **Review current phone auth implementation** in main app for accuracy
- [ ] **Confirm SMS message templates** used in verification process
- [ ] **Validate A2P 10DLC requirements** with current Twilio setup

## Notes

- Focus on **transparency and user trust**
- Ensure language is **legally compliant but user-friendly**
- Maintain consistency with **existing brand voice**
- Consider **future auditing requirements** when documenting consent process 