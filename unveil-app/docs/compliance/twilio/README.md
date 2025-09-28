# Twilio SMS Compliance Documentation

## Overview

This directory contains compliance documentation for Twilio SMS campaigns and opt-in flows used in the Unveil app.

## SMS Consent Flow

Unveil implements a two-step SMS consent process:

1. **Login/Authentication Consent** (`app/(auth)/login/page.tsx`)
   - Users enter their phone number to receive SMS verification codes
   - Footer text appears below the "Continue" button explaining SMS usage for authentication
   - Required for login functionality

2. **Event Notifications Consent** (`app/(auth)/setup/page.tsx`)
   - Users complete account setup after authentication
   - Required checkbox for receiving event-related SMS notifications
   - Separate from authentication consent - optional but required to receive notifications

## For Twilio Reviewers

- **Phone Login Screen**: Located at `/login` - shows authentication SMS consent footer
- **Account Setup Screen**: Located at `/setup` - shows event notifications consent checkbox
- **Privacy Policy**: Both screens link to https://www.sendunveil.com/policies
- **Canonical Opt-in Message**: See `opt_in_message.md` for exact text to use in Twilio campaign forms

## Code Implementation

All SMS consent copy is centralized in `lib/compliance/smsConsent.ts` to ensure consistency between in-app display and external compliance documentation.
