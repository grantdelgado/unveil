# 🔧 Production Environment Setup Guide

## Required Environment Variables

### **Core Application (REQUIRED)**

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

# Application Settings
NEXT_PUBLIC_BASE_URL=https://your-domain.com
NODE_ENV=production

# SMS Configuration (Twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxx

# SMS Invite Configuration (REQUIRED for production)
NEXT_PUBLIC_APP_URL=https://your-domain.com
# Alternative: INVITES_PUBLIC_URL=https://your-domain.com (highest priority)

# Cron Job Security
CRON_SECRET=your-secure-random-string

# Messaging System Configuration (Optional)
SMS_BRANDING_DISABLED=false              # Kill switch for SMS branding (default: false)
SCHEDULED_MAX_PER_TICK=100              # Max scheduled messages per cron tick (default: 100)
SCHEDULE_MIN_LEAD_SECONDS=180           # Minimum lead time for scheduling (default: 180)
```

### **Optional Monitoring & Analytics**

```bash
# Error Tracking
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# Analytics
NEXT_PUBLIC_GA_TRACKING_ID=G-XXXXXXXXXX

# Performance Monitoring
NEXT_PUBLIC_LOGROCKET_ID=your-app-id
NEW_RELIC_LICENSE_KEY=your-license-key
```

### **Feature Flags (Optional)**

```bash
NEXT_PUBLIC_ENABLE_MESSAGING=true
NEXT_PUBLIC_ENABLE_MEDIA_UPLOAD=true
NEXT_PUBLIC_ENABLE_SMS_INVITES=true
```

### **Messaging System Tuning (Optional)**

```bash
# SMS Branding Control
SMS_BRANDING_DISABLED=false            # Emergency kill switch for SMS branding
                                       # Set to 'true' to instantly disable event tags and A2P footers

# Scheduled Message Processing
SCHEDULED_MAX_PER_TICK=100             # Maximum messages processed per cron tick
                                       # Increase for high-volume events, decrease for rate limiting

# Schedule Validation
SCHEDULE_MIN_LEAD_SECONDS=180          # Minimum seconds between scheduling and send time
                                       # Default: 180 (3 minutes) - provides safety margin for cron processing

# Development Simulation
DEV_SIMULATE_INVITES=true              # Enable SMS simulation mode (development only)
                                       # Logs SMS content without sending actual messages
```

## Security Checklist

### **Before Production Deployment:**

- [ ] All required environment variables are set
- [ ] Supabase URL matches production project (`wvhtbqvnamerdkkjknuv.supabase.co`)
- [ ] Storage bucket 'event-media' exists and configured
- [ ] Twilio credentials verified and phone number active
- [ ] Base URL matches production domain
- [ ] CRON_SECRET is cryptographically secure (32+ characters)
- [ ] SMS_BRANDING_DISABLED is set to false (or unset) for normal operation
- [ ] SCHEDULED_MAX_PER_TICK is appropriate for expected message volume
- [ ] No development-only flags enabled (DEV_SIMULATE_INVITES should be false/unset)
- [ ] Service role key has appropriate permissions
- [ ] All secrets secured in deployment platform (Vercel)

### **Environment-Specific Behaviors:**

- **Development:** Debug panels, React Query devtools, detailed error messages
- **Production:** Error tracking, performance monitoring, security headers
- **SMS Testing:** Only enabled in development mode

## 🔧 Local Development SMS Configuration

For local development, SMS invites require special configuration since localhost URLs cannot be used in outbound SMS messages.

### **Option 1: Tunnel Mode (Real SMS)**

Use a tunnel service to expose your local development server publicly:

```bash
# Using ngrok (recommended)
ngrok http 3000

# Using Cloudflare Tunnel
cloudflared tunnel --url http://localhost:3000

# Set the tunnel URL
DEV_TUNNEL_URL=https://your-tunnel-domain.ngrok.io
```

### **Option 2: Simulation Mode (No SMS Sent)**

Enable simulation mode to test the invite flow without sending actual SMS:

```bash
# .env.local
DEV_SIMULATE_INVITES=true
```

**Simulation Mode Features:**

- ✅ Database updates (invited_at, invite_attempts, etc.)
- ✅ UI feedback and state changes
- ✅ Complete invite flow testing
- ❌ No actual SMS sent
- 📝 SMS payload logged to console

### **Environment Variable Priority**

The system checks for base URLs in this order:

1. `INVITES_PUBLIC_URL` (highest priority)
2. `NEXT_PUBLIC_APP_URL`
3. `APP_URL`
4. `DEV_TUNNEL_URL` (development only)
5. Simulation mode if `DEV_SIMULATE_INVITES=true`

### **Error Messages**

- **"Public base URL not configured"**: Set one of the environment variables above
- **"Invalid public base URL detected"**: Localhost detected - use tunnel or simulation mode
- **"Development Setup Required"**: Check tunnel or simulation configuration

## Deployment Platform Setup

### **Vercel Environment Variables:**

1. Go to Vercel Dashboard > Project Settings > Environment Variables
2. Add all required variables above
3. Set Environment: **Production**
4. Ensure sensitive keys are marked as **Sensitive**

### **Validation Script:**

```bash
# Run environment validation
npx tsx scripts/validate-production-env.ts
```

## Security Considerations

### **Secrets Management:**

- Never commit `.env.production` to version control
- Use Vercel's encrypted environment variables
- Rotate secrets regularly (quarterly recommended)
- Monitor for leaked credentials

### **API Security:**

- Service role key only used in API routes
- Cron endpoints protected with secret validation
- Development panels disabled in production
- RLS policies enforce data access control
