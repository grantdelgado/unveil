# OTP Resend Functionality

## Overview

This document describes the OTP resend functionality that allows users to request a new verification code during the authentication process.

## Features

- **Safe Rate Limiting**: Prevents abuse with phone-based and IP-based limits
- **User-Friendly UI**: Countdown timer and clear status messages
- **A2P Compliance**: Reuses existing SMS template and Twilio configuration
- **Audit Logging**: Tracks resend attempts for security monitoring

## Rate Limits

### Per Phone Number

- **Max Attempts**: 3 resends per 10-minute window
- **Cooldown**: 30 seconds between resends
- **Window Reset**: 10 minutes after first attempt

### Per IP Address (Burst Protection)

- **Max Attempts**: 10 resends per 10-minute window
- **Purpose**: Prevents automated attacks from single IP

## API Endpoint

**POST** `/api/auth/otp/resend`

### Request Body

```json
{
  "phone": "+1234567890",
  "context": "login"
}
```

### Response (Success)

```json
{
  "success": true,
  "message": "If your number is registered, a verification code was sent.",
  "remaining": 2
}
```

### Response (Rate Limited)

```json
{
  "error": "Please wait before requesting another code",
  "retryAfter": 45
}
```

**HTTP Status**: 429
**Headers**: `Retry-After: 45`

## UI Components

### ResendOTPButton

- **Initial State**: Disabled for 30 seconds after page load
- **Cooldown Display**: Shows countdown timer (e.g., "Resend in 0:25")
- **Loading State**: Shows "Sending..." during API call
- **Accessibility**: Proper ARIA labels and 44px+ touch targets

### Integration

- Located below "Verify Code" button in OTP step
- Shows success toast: "Code resent. Check your messages."
- Displays error messages for rate limiting
- Auto-clears messages when user types in OTP field

## Security Features

### Anti-Enumeration

- Returns generic success message regardless of phone existence
- Consistent response times for valid/invalid numbers

### Rate Limiting

- Phone-based limits prevent targeted abuse
- IP-based limits prevent distributed attacks
- Exponential cooldown for repeated violations

### Audit Logging

- Logs all resend attempts with truncated phone/IP
- Tracks success/failure status
- Includes error messages for debugging

## Troubleshooting

### Common Issues

**"Please wait before requesting another code"**

- User hit the 30-second cooldown
- Wait for countdown to reach zero

**"Too many requests from this location"**

- IP-based rate limit exceeded
- Wait 10 minutes or try from different network

**"Too many attempts. Please wait before trying again."**

- Phone-based rate limit exceeded (3 attempts)
- Wait 10 minutes before trying again

### Debug Steps

1. **Check API Response**:

   ```bash
   curl -X POST http://localhost:3000/api/auth/otp/resend \
     -H 'Content-Type: application/json' \
     -d '{"phone":"+1234567890","context":"login"}'
   ```

2. **Verify Twilio Configuration**:

   - Check environment variables are set
   - Confirm Twilio account has sufficient balance
   - Verify phone number is not blocked

3. **Check Application Logs**:
   - Look for "OTP Resend Attempt" log entries
   - Verify Supabase auth calls are successful
   - Check for rate limiting violations

## Implementation Notes

### Reuses Existing Logic

- Uses same `supabase.auth.signInWithOtp()` call as initial send
- Maintains consistency with existing A2P message template
- Leverages existing phone validation and normalization

### Rate Limiting Storage

- Currently uses in-memory Map for rate limiting
- **Production Recommendation**: Migrate to Redis/Upstash for:
  - Persistence across server restarts
  - Multi-instance synchronization
  - Better performance at scale

### Future Enhancements

- Database-backed audit table for compliance
- Configurable rate limits via environment variables
- SMS delivery status tracking integration
- Push notification fallback for failed SMS

## Testing

### Manual Testing

1. Enter phone number and reach OTP step
2. Verify "Resend Code" shows 30-second countdown initially
3. Wait for countdown to complete, click "Resend Code"
4. Confirm success message and new 30-second countdown
5. Attempt rapid clicks to verify rate limiting
6. Test with invalid phone numbers to verify error handling

### Automated Testing

- Unit tests for rate limiting logic
- Integration tests for API endpoint
- E2E tests for complete user flow
- Load tests for rate limiting effectiveness
