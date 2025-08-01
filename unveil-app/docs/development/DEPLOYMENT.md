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

# Cron Job Security
CRON_SECRET=your-secure-random-string
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

## Security Checklist

### **Before Production Deployment:**
- [ ] All required environment variables are set
- [ ] Supabase URL matches production project (`wvhtbqvnamerdkkjknuv.supabase.co`)
- [ ] Storage bucket 'event-media' exists and configured
- [ ] Twilio credentials verified and phone number active
- [ ] Base URL matches production domain
- [ ] CRON_SECRET is cryptographically secure (32+ characters)
- [ ] No development-only flags enabled
- [ ] Service role key has appropriate permissions
- [ ] All secrets secured in deployment platform (Vercel)

### **Environment-Specific Behaviors:**
- **Development:** Debug panels, React Query devtools, detailed error messages
- **Production:** Error tracking, performance monitoring, security headers
- **SMS Testing:** Only enabled in development mode

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