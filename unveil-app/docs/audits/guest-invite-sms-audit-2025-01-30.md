# Guest Invite SMS — Copy, Length & Segmentation Audit

**Date**: January 30, 2025  
**Status**: ✅ **COMPLETE**  
**Intent**: Comprehensive analysis of guest invitation SMS text, character counts, encoding, segmentation, and truncation behavior

## 🎯 Executive Summary

**KEY FINDING**: All guest invitation SMS messages currently exceed the 160-character single-segment limit, resulting in **multi-segment messages** that may appear truncated or fragmented on recipient devices.

**ROOT CAUSE**: The combination of event header tags, full invitation template, and 39-character invite URL consistently pushes messages to 200+ characters, forcing 2-segment delivery.

**IMPACT**: Guests may receive incomplete invitations or multiple separate text messages, potentially reducing RSVP conversion rates.

## 📋 SMS Pipeline Analysis

### Invitation Flow
1. **UI Trigger**: Guest Management → "Invite" button → `/api/guests/invite-single`
2. **Template Generation**: `lib/sms-invitations.ts` → `createInvitationMessage()`
3. **SMS Formatting**: `lib/sms.ts` → `sendSMS()` → `composeSmsText()`
4. **Delivery**: Twilio SMS with event header and GSM-7 normalization

### Template Source (`lib/sms-invitations.ts:29-44`)
```typescript
const createInvitationMessage = (invitation: EventInvitation): string => {
  let guestGreeting = 'Hi there! ';
  if (invitation.guestName) {
    const firstName = invitation.guestName.split(' ')[0]?.trim();
    guestGreeting = firstName ? `Hi, ${firstName}! ` : `Hi, ${invitation.guestName}! `;
  }

  const inviteUrl = buildInviteLink({ target: 'hub' });

  return `${guestGreeting}You are invited to ${invitation.eventTitle} on ${invitation.eventDate}!

View the wedding details here: ${inviteUrl}.

Hosted by ${invitation.hostName} via Unveil

Reply STOP to opt out.`;
};
```

### SMS Formatter Integration
- **Event Header**: `composeSmsText()` adds `[EventTag]` prefix
- **GSM-7 Normalization**: Smart quotes → regular quotes, em-dashes → hyphens
- **STOP Policy**: Invites use `messageType="welcome"` but do NOT set `forceStopNotice=true`
- **Result**: STOP notice comes from invitation template, not formatter

## 🔍 Dynamic Fields Analysis

| Field | Source | Example | Length Impact |
|-------|--------|---------|---------------|
| `{guestName}` | Guest record or manual input | "Sarah" → "Hi, Sarah!" | +4-15 chars |
| `{eventTitle}` | Event title field | "Alexandra & Maximilian — Big Sky Weekend 2025" | 10-50+ chars |
| `{eventDate}` | `formatEventDate()` | "Saturday, February 15th" | ~20-25 chars |
| `{hostName}` | Host user full_name | "Alexandra Rodriguez-Martinez" | 5-30+ chars |
| `{inviteUrl}` | `buildInviteLink({ target: 'hub' })` | `https://app.sendunveil.com/select-event` | **39 chars (fixed)** |
| `[EventTag]` | Generated from title/sms_tag | `[Alexandra+Max+]` | 8-16 chars |

### URL Analysis
- **Production URL**: `https://app.sendunveil.com/select-event` (39 characters)
- **Target**: Guest hub/event selector (not event-specific deep link)
- **Link Shortening**: Not currently implemented
- **Environment Handling**: Uses `getPublicBaseUrl()` with fallbacks

## 📊 Test Scenario Results

**Methodology**: Analyzed 6 representative scenarios with varying name lengths, custom tags, and character types.

| Scenario | Event Tag | Raw Length | Final Length | Encoding | Segments | Status |
|----------|-----------|------------|--------------|----------|----------|---------|
| Short names | `[Lo+Jon]` | 192 | 201 | GSM-7 | 2 | ⚠️ Multi |
| Long names | `[Alexandra+Max+]` | 257 | 274 | GSM-7 | 2 | ⚠️ Multi |
| Custom tag | `[Sarah+David]` | 203 | 217 | GSM-7 | 2 | ⚠️ Multi |
| No guest name | `[Wedding+Cel]` | 212 | 226 | GSM-7 | 2 | ⚠️ Multi |
| With emoji* | `[Sarah+Dav+Wed]` | 206 | 219 | UCS-2** | 4 | ⚠️ Multi |
| Smart quotes | `[Sarahs+Dre+Wed]` | 207 | 224 | GSM-7 | 2 | ⚠️ Multi |

*Emoji scenario: GSM-7 normalization strips emojis, but if preserved would force UCS-2  
**UCS-2 limits: 70 chars (1 segment), 67 chars (concatenated)

### Sample SMS Text (Short Names Scenario)
```
[Lo+Jon]
Hi, Sarah! You are invited to Lo & Jonny on Saturday, February 15th!

View the wedding details here: https://app.sendunveil.com/select-event.

Hosted by Emma via Unveil

Reply STOP to opt out.
```
**Length**: 201 characters → **2 SMS segments**

## ⚠️ Truncation & Segmentation Analysis

### Current Behavior
1. **No Truncation Applied**: Invites bypass `composeSmsText()` length budget constraints
2. **Multi-Segment Delivery**: All scenarios result in 2+ segments (200+ characters)
3. **Carrier Handling**: Depends on carrier/device how segments are reassembled

### SMS Formatter Length Budget (Not Applied to Invites)
The `applyLengthBudget()` function in `composeSmsText()` has a truncation priority:
1. **Drop link first** (if present in options)
2. **Drop brand line** ("via Unveil")
3. **Drop STOP notice** (if forced)
4. **Truncate body** with "…" suffix
5. **Emergency fallback**: Header + minimal body only

**However**: Invites use pre-formatted template, so this logic doesn't apply.

### Root Causes of Multi-Segment Messages
1. **Base Template Length**: ~140-160 characters before event tag
2. **Event Tag Overhead**: +8-16 characters + newline
3. **Fixed URL Length**: 39 characters (non-negotiable)
4. **No Length Optimization**: Template prioritizes completeness over segmentation

## 🔧 SMS Branding Configuration

### Current Environment
- **`SMS_BRANDING_DISABLED`**: `(unset)` → defaults to `false` (branding enabled)
- **Kill Switch Effect** (if enabled):
  - ✅ Event header `[EventTag]` **preserved**
  - ❌ "via Unveil" branding **removed**
  - ❌ STOP notice **removed**
- **Invite Behavior**: Uses template's built-in branding and STOP notice

### Compliance Rules
- **STOP Notice**: Required for A2P messaging, included in invitation template
- **First Contact**: Invites are typically first SMS to new guests
- **Branding**: "via Unveil" line included for brand recognition
- **Event Header**: Always included for immediate context

## 🎯 Segmentation Triggers

### High-Risk Factors
1. **Long Event Titles** (>25 characters)
2. **Long Host Names** (>20 characters)
3. **Emojis in Titles** (forces UCS-2: 70/67 char limits)
4. **Custom SMS Tags** (if longer than auto-generated)

### Character Budget Breakdown
```
Base components:
- Greeting: "Hi, [Name]! " (8-20 chars)
- Invitation: "You are invited to [Title] on [Date]!" (35-80 chars)
- CTA: "View the wedding details here: [URL]." (42 chars fixed)
- Brand: "Hosted by [Host] via Unveil" (15-40 chars)
- STOP: "Reply STOP to opt out." (23 chars)
- Event Tag: "[Tag]" + newline (9-17 chars)

Total Range: 180-250+ characters
Single Segment Limit: 160 characters (GSM-7) / 70 characters (UCS-2)
```

## 📈 Recommendations

### 1. Immediate Optimizations (No Code Changes)
- **Host Training**: Encourage shorter event titles and SMS tags
- **Character Limits**: Add UI validation for event title length
- **Preview Feature**: Show SMS preview with character count in event setup

### 2. Template Optimization (Low Risk)
- **Shorter CTA**: "View details: [URL]" (-20 chars)
- **Compact Branding**: "via Unveil" → "- Unveil" (-4 chars)
- **Conditional Greeting**: Skip guest name for very long titles
- **Target**: Reduce base template to ~120-130 characters

### 3. URL Shortening (Medium Risk)
- **Custom Shortener**: `unveil.to/abc123` (~15 chars, -24 savings)
- **Twilio Shortener**: Built-in URL shortening service
- **Fallback Strategy**: Long URL if shortening fails

### 4. Dynamic Length Management (Higher Risk)
- **Smart Truncation**: Apply `applyLengthBudget()` to invitation template
- **Tiered Templates**: Short/medium/long versions based on content
- **Adaptive Formatting**: Drop optional elements for long content

### 5. Encoding Safety
- **GSM-7 Validation**: Warn about emojis/special characters in titles
- **Character Replacement**: Auto-convert problematic characters
- **Encoding Detection**: Monitor UCS-2 usage in production

## 🚨 Critical Issues Identified

### 1. Universal Multi-Segment Delivery
- **Impact**: All invites currently send as 2+ segments
- **Risk**: Message fragmentation, delivery delays, higher costs
- **Priority**: HIGH

### 2. No Length Feedback
- **Impact**: Hosts unaware of SMS length implications
- **Risk**: Unintentional long messages
- **Priority**: MEDIUM

### 3. Emoji Handling Inconsistency
- **Impact**: Emojis stripped by GSM-7 normalization
- **Risk**: Unexpected message content changes
- **Priority**: LOW

## 🎯 Next Steps

### Phase 1: Quick Wins (1-2 days)
1. **Template Optimization**: Shorten CTA and branding text
2. **Character Counter**: Add SMS length preview to event setup
3. **Documentation**: Update host guidelines for SMS-friendly titles

### Phase 2: Technical Improvements (1 week)
1. **URL Shortening**: Implement custom or Twilio shortener
2. **Smart Truncation**: Apply length budget to invitation template
3. **Encoding Validation**: Warn about UCS-2 triggers

### Phase 3: Advanced Features (2-3 weeks)
1. **Adaptive Templates**: Multiple template versions by length
2. **Real-time Preview**: Live SMS preview with segment count
3. **A/B Testing**: Compare short vs. full templates for conversion

## 📋 Monitoring & Metrics

### Recommended Tracking
- **Segment Distribution**: 1-segment vs. multi-segment ratio
- **Encoding Usage**: GSM-7 vs. UCS-2 percentage
- **Template Performance**: RSVP rates by message length
- **Truncation Events**: When length budget is applied

### Success Metrics
- **Target**: >80% of invites in single segment
- **Encoding**: >95% GSM-7 usage
- **Conversion**: Maintain or improve RSVP rates
- **Cost**: Reduce SMS segment costs

---

## 🔍 Technical Appendix

### File References
- **Template**: `lib/sms-invitations.ts:29-44`
- **Formatter**: `lib/sms-formatter.ts:89-343`
- **SMS Pipeline**: `lib/sms.ts:169-403`
- **URL Builder**: `lib/utils/url.ts:142-161`
- **Flags**: `config/flags.ts:37-39`

### Environment Variables
- **`SMS_BRANDING_DISABLED`**: Kill switch for branding (default: false)
- **`NEXT_PUBLIC_APP_URL`**: Base URL for invite links
- **`DEV_SIMULATE_INVITES`**: Development simulation mode

### Database Fields
- **`events.sms_tag`**: Custom SMS tag (optional)
- **`events.title`**: Event title (used for auto-tag generation)
- **`event_guests.a2p_notice_sent_at`**: A2P compliance tracking

---

**Audit Complete**: January 30, 2025  
**Next Review**: After Phase 1 implementation  
**Contact**: Development Team
