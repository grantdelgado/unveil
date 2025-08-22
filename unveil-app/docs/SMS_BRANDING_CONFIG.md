# SMS Branding Configuration

## Overview

SMS branding is **enabled by default** for all outbound SMS messages. Every SMS will include:
- `[EventTag]` prefix for immediate event identification
- One-time "Reply STOP to opt out" footer per guest/event
- GSM-7 normalization for compatibility
- Single-segment preference with graceful length management

## Environment Variables

### `SMS_BRANDING_DISABLED` (Kill Switch)

**Default**: `false` (branding enabled)
**Purpose**: Emergency kill-switch to instantly revert to legacy plain SMS format

```bash
# Enable SMS branding (default behavior)
SMS_BRANDING_DISABLED=false

# Disable SMS branding (emergency rollback)
SMS_BRANDING_DISABLED=true
```

**Usage**:
- **Production**: Leave unset or set to `false` for normal operation
- **Emergency**: Set to `true` to instantly disable branding without code deployment
- **Testing**: Can be used to test legacy SMS behavior

## Rollback Strategy

To instantly revert to legacy SMS format:

1. Set environment variable: `SMS_BRANDING_DISABLED=true`
2. Restart application (no code deployment needed)
3. All new SMS will use legacy format (no event tags, no A2P footer)

## Event Tag Configuration

Hosts can configure custom SMS tags in Event Settings:
- **Path**: Host Dashboard → Event Details → SMS Branding
- **Format**: Up to 14 ASCII characters
- **Auto-generation**: If empty, auto-generated from event title
- **Example**: "Sarah+David" → `[Sarah+David] Your message here...`

## Technical Details

- **Integration Point**: `/lib/sms.ts` → `sendSMS()` function
- **Formatter**: `/lib/sms-formatter.ts` → `composeSmsText()`
- **Database Fields**: `events.sms_tag`, `event_guests.a2p_notice_sent_at`
- **Security**: Host-only SMS tag editing via RLS policies

## Monitoring

SMS formatting metrics are logged (no PII):
- Message length and segment count
- Whether STOP notice was included
- Whether link was dropped or body truncated
- Event ID and formatting flags (boolean only)

## Legacy Behavior (When Disabled)

When `SMS_BRANDING_DISABLED=true`:
- No event tags prepended
- No A2P "Reply STOP" footer
- No GSM-7 normalization
- Original message sent as-is
- No database lookups for event tags
