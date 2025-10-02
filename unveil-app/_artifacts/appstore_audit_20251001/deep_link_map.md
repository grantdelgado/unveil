# Deep Link Strategy - Universal Links & Custom Scheme
**Date:** October 1, 2025  
**Project:** Unveil Wedding App iOS Implementation  

## Universal Links Configuration

### Primary Domain: `app.sendunveil.com`

**Associated Domain:** `applinks:app.sendunveil.com`

This configuration enables Universal Links for the production app, allowing iOS to open links directly in the native app when installed.

### Route Mapping Strategy

#### High Priority Routes (Always Handle)
```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAMID.com.unveil.wedding",
        "paths": [
          "/",
          "/select-event",
          "/guest/events/*",
          "/host/events/*/dashboard",
          "/host/events/*/guests", 
          "/host/events/*/messages",
          "/login"
        ]
      }
    ]
  }
}
```

#### Medium Priority Routes (Conditional Handling)
```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAMID.com.unveil.wedding", 
        "paths": [
          "/host/events/create",
          "/host/events/*/details",
          "/host/events/*/edit",
          "/host/events/*/schedule",
          "/guest/events/*/schedule",
          "/setup"
        ]
      }
    ]
  }
}
```

### Complete Apple App Site Association File

**Location:** `https://app.sendunveil.com/.well-known/apple-app-site-association`

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAMID.com.unveil.wedding",
        "paths": [
          "/",
          "/select-event", 
          "/login",
          "/setup",
          "/guest/events/*",
          "/host/events/create",
          "/host/events/*/dashboard",
          "/host/events/*/details", 
          "/host/events/*/edit",
          "/host/events/*/guests",
          "/host/events/*/messages",
          "/host/events/*/messages/compose",
          "/host/events/*/messages/analytics",
          "/host/events/*/schedule"
        ]
      }
    ]
  },
  "webcredentials": {
    "apps": ["TEAMID.com.unveil.wedding"]
  }
}
```

## Custom URL Scheme Fallback

### Scheme: `unveil://`

**Purpose:** Fallback for scenarios where Universal Links fail or for app-to-app communication.

### Route Mapping

| Web Route | Custom Scheme | Purpose |
|-----------|---------------|---------|
| `/` | `unveil://home` | Landing page |
| `/select-event` | `unveil://select-event` | Event selection |
| `/login` | `unveil://login` | Authentication |
| `/setup` | `unveil://setup` | Account setup |
| `/guest/events/[id]` | `unveil://guest/event/[id]` | Guest event access |
| `/guest/events/[id]/schedule` | `unveil://guest/event/[id]/schedule` | Guest schedule |
| `/host/events/create` | `unveil://host/create-event` | Event creation |
| `/host/events/[id]/dashboard` | `unveil://host/event/[id]` | Host dashboard |
| `/host/events/[id]/guests` | `unveil://host/event/[id]/guests` | Guest management |
| `/host/events/[id]/messages` | `unveil://host/event/[id]/messages` | Message hub |

### Example Custom Scheme URLs

```
unveil://home
unveil://select-event
unveil://login
unveil://guest/event/123e4567-e89b-12d3-a456-426614174000
unveil://host/event/123e4567-e89b-12d3-a456-426614174000
unveil://host/event/123e4567-e89b-12d3-a456-426614174000/guests
```

## Implementation Strategy

### 1. Universal Links (Primary)

**iOS Configuration (Info.plist):**
```xml
<key>com.apple.developer.associated-domains</key>
<array>
    <string>applinks:app.sendunveil.com</string>
</array>
```

**Handling in iOS App:**
```swift
// AppDelegate or SceneDelegate
func application(_ application: UIApplication, 
                continue userActivity: NSUserActivity, 
                restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
    
    guard userActivity.activityType == NSUserActivityTypeBrowsingWeb,
          let url = userActivity.webpageURL else {
        return false
    }
    
    // Handle the Universal Link
    return handleUniversalLink(url)
}
```

### 2. Custom Scheme (Fallback)

**iOS Configuration (Info.plist):**
```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLName</key>
        <string>com.unveil.wedding</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>unveil</string>
        </array>
    </dict>
</array>
```

**Handling in iOS App:**
```swift
func application(_ app: UIApplication, 
                open url: URL, 
                options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
    
    if url.scheme == "unveil" {
        return handleCustomScheme(url)
    }
    
    return false
}
```

### 3. Capacitor Integration

**Capacitor Plugin Configuration:**
```typescript
// capacitor.config.ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.unveil.wedding',
  appName: 'Unveil',
  webDir: 'out',
  bundledWebRuntime: false,
  ios: {
    scheme: 'Unveil',
    contentInset: 'automatic',
    scrollEnabled: true,
    backgroundColor: '#FFF5E5'
  },
  plugins: {
    App: {
      launchShowDuration: 0
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#FFF5E5',
      showSpinner: false
    }
  }
};

export default config;
```

## Authentication Integration

### Deep Link Authentication Flow

1. **Unauthenticated Deep Link Access**
   ```
   User clicks: https://app.sendunveil.com/guest/events/123...
   → App opens to login screen
   → Store intended destination: /guest/events/123...
   → After successful auth, redirect to stored destination
   ```

2. **Supabase Auth Redirect Compatibility**
   ```typescript
   // Current auth redirect logic (usePostAuthRedirect.ts)
   const returnUrl = urlParams.get('next');
   
   if (returnUrl) {
     router.replace(returnUrl); // This works with deep links
   } else if (userExists && onboardingCompleted) {
     router.replace('/select-event');
   }
   ```

3. **Native App Auth Handling**
   ```typescript
   // Enhanced for iOS deep linking
   const handleDeepLinkAuth = (originalUrl: string) => {
     const authUrl = `/login?next=${encodeURIComponent(originalUrl)}`;
     // Navigate to auth with return URL preserved
   };
   ```

### Session Management

**Current Implementation (Compatible):**
- Supabase session management works in WKWebView
- Session cookies persist across app launches
- Auth state synchronization with native app lifecycle

**Enhancements Needed:**
- Handle app backgrounding/foregrounding
- Refresh tokens in native context
- Deep link handling during session refresh

## Testing Strategy

### Universal Links Testing

1. **Development Testing**
   ```bash
   # Test Universal Links in iOS Simulator
   xcrun simctl openurl booted "https://app.sendunveil.com/select-event"
   ```

2. **Device Testing**
   - Send test links via Messages, Mail, Safari
   - Verify app opens instead of web browser
   - Test with app installed vs not installed

3. **Authentication Flow Testing**
   ```
   Test Cases:
   1. Deep link → Login → Original destination
   2. Deep link with valid session → Direct access
   3. Deep link with expired session → Re-auth flow
   4. Invalid/malformed deep links → Graceful fallback
   ```

### Custom Scheme Testing

1. **Direct Scheme Testing**
   ```bash
   # Test custom scheme in iOS Simulator  
   xcrun simctl openurl booted "unveil://guest/event/123e4567-e89b-12d3-a456-426614174000"
   ```

2. **Fallback Scenarios**
   - Universal Links disabled
   - Network connectivity issues
   - App not installed (should open App Store)

## Security Considerations

### URL Validation
```typescript
// Validate deep link URLs before processing
const validateDeepLink = (url: string): boolean => {
  // Check for valid UUID in event IDs
  const eventIdRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  
  // Validate route patterns
  const validRoutes = [
    /^\/$/,
    /^\/select-event$/,
    /^\/login$/,
    /^\/guest\/events\/[0-9a-f-]+$/,
    /^\/host\/events\/[0-9a-f-]+\/dashboard$/
    // ... other valid patterns
  ];
  
  return validRoutes.some(pattern => pattern.test(url));
};
```

### Authorization Checks
```typescript
// Ensure user has permission for deep linked content
const validateEventAccess = async (eventId: string, userId: string) => {
  // Check if user is host or guest of the event
  // This leverages existing RLS policies
  const { data, error } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .single();
    
  return !error && data;
};
```

## Deployment Requirements

### Web Server Configuration
1. **Apple App Site Association File**
   - Host at `https://app.sendunveil.com/.well-known/apple-app-site-association`
   - Serve with `Content-Type: application/json`
   - No file extension required
   - Must be accessible over HTTPS

2. **Vercel Configuration**
   ```json
   // vercel.json
   {
     "headers": [
       {
         "source": "/.well-known/apple-app-site-association",
         "headers": [
           {
             "key": "Content-Type", 
             "value": "application/json"
           }
         ]
       }
     ]
   }
   ```

### iOS App Configuration
1. **Associated Domains Entitlement**
   - Add to Xcode project capabilities
   - Configure in Apple Developer Portal
   - Include in provisioning profile

2. **Bundle Identifier**
   - Recommended: `com.unveil.wedding`
   - Must match Apple App Site Association file
   - Register in Apple Developer Portal

---

**Implementation Priority:**
1. Universal Links setup (Sprint 1)
2. Custom scheme fallback (Sprint 1) 
3. Authentication integration (Sprint 2)
4. Comprehensive testing (Sprint 2)
5. Security hardening (Sprint 3)
