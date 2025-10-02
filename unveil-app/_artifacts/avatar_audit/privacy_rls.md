# Avatar Privacy & RLS Compliance Analysis

## Current Data Access Patterns

### 1. Profile Avatar Component
**Data Access**: None
- **Privacy Risk**: ✅ Low - No user data accessed
- **RLS Compliance**: ✅ N/A - Static component only
- **PII Exposure**: ✅ None

### 2. Profile Page Avatar
**Data Access**: Direct user profile query
```sql
SELECT id, full_name, phone, avatar_url 
FROM users 
WHERE id = $1
```
- **Privacy Risk**: ✅ Low - Self-access only
- **RLS Compliance**: ✅ User can only access own profile
- **PII Exposure**: ⚠️ Phone number included (but not displayed in avatar)

### 3. Message Sender Display
**Data Access**: Via RPC and joins
```sql
-- In get_guest_event_messages RPC
sender:users!messages_sender_user_id_fkey(full_name, avatar_url)
```
- **Privacy Risk**: ⚠️ Medium - Cross-user name access
- **RLS Compliance**: ✅ Event-scoped access only
- **PII Exposure**: ✅ Only full_name and avatar_url

### 4. Guest List Display
**Data Access**: Via guest queries with user joins
```sql
SELECT guest_display_name, users.full_name 
FROM event_guests 
LEFT JOIN users ON event_guests.user_id = users.id
```
- **Privacy Risk**: ⚠️ Medium - Host sees guest names
- **RLS Compliance**: ✅ Event-host scoped access
- **PII Exposure**: ✅ Only display names

## RLS Policy Analysis

### Users Table Policies
Based on schema analysis, the `users` table should have:

#### Current Implied Policies
1. **Self-Access Policy**: Users can read/update their own profile
2. **Event-Scoped Access**: Other users visible only within shared events
3. **Host Access**: Event hosts can see guest user profiles

#### Avatar-Specific Considerations
```sql
-- Recommended policy for avatar_url access
CREATE POLICY "Avatar URLs readable by event participants" ON users
FOR SELECT USING (
  id = auth.uid() OR  -- Self access
  EXISTS (
    SELECT 1 FROM event_guests eg1, event_guests eg2 
    WHERE eg1.user_id = auth.uid() 
    AND eg2.user_id = users.id 
    AND eg1.event_id = eg2.event_id
  )
);
```

### Storage Bucket Policies (If Implemented)

#### Current State
- **No avatar storage bucket** exists
- **Only event-media and event-images** buckets present
- **No avatar upload functionality** implemented

#### Recommended Avatar Bucket Policies
```sql
-- Avatar upload policy (future)
CREATE POLICY "Users can upload own avatars" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Avatar read policy (future)  
CREATE POLICY "Avatars readable by event participants" ON storage.objects
FOR SELECT USING (
  bucket_id = 'avatars' AND
  (
    auth.uid()::text = (storage.foldername(name))[1] OR
    EXISTS (
      SELECT 1 FROM event_guests eg1, event_guests eg2, users u
      WHERE eg1.user_id = auth.uid()
      AND eg2.user_id = u.id
      AND u.id::text = (storage.foldername(name))[1]
      AND eg1.event_id = eg2.event_id
    )
  )
);
```

## Privacy Compliance Review

### PII Handling in Avatar Context

#### Currently Exposed Data
| Data Field | Context | Exposure Level | Compliance |
|------------|---------|----------------|------------|
| `full_name` | Message senders | Event participants | ✅ Appropriate |
| `full_name` | Guest lists | Event hosts only | ✅ Appropriate |
| `avatar_url` | Profile page | Self only | ✅ Appropriate |
| `avatar_url` | RPC data | Event participants | ✅ Appropriate |
| `phone` | Profile queries | Self only | ✅ Not displayed |

#### Not Exposed (Good)
- ✅ Email addresses never accessed for avatars
- ✅ Phone numbers not displayed in avatar contexts
- ✅ User IDs not exposed in UI
- ✅ Auth metadata not used for display

### Logging & Telemetry Compliance

#### Current Logging Patterns
```typescript
// GOOD: No PII in logs
console.error('Profile fetch error:', error);

// GOOD: Generic error messages
setMessage('Unable to load profile data. Please try again.');
```

#### Recommended Avatar Logging
```typescript
// Safe logging for avatar functionality
const logAvatarEvent = (event: string, userId: string) => {
  console.log('Avatar event', {
    event,
    userId: hashUserId(userId), // Hash for privacy
    hasImage: !!avatarUrl,
    usedFallback: !avatarUrl,
    timestamp: Date.now()
  });
};
```

## Cross-User Data Access Analysis

### Legitimate Cross-User Access
1. **Message Senders**: Users see names of other event participants
2. **Guest Lists**: Hosts see guest display names
3. **Event Context**: Names visible only within shared events

### Access Control Verification
```sql
-- Verify event-scoped access only
SELECT DISTINCT u.full_name 
FROM users u
JOIN event_guests eg ON u.id = eg.user_id
WHERE eg.event_id IN (
  SELECT event_id FROM event_guests WHERE user_id = auth.uid()
);
```

### Potential Privacy Risks

#### Low Risk ✅
- **Static avatar components**: No data access
- **Self-profile access**: User sees own data only
- **Event-scoped names**: Appropriate business context

#### Medium Risk ⚠️
- **Avatar URLs in RPC**: Included but not always used
- **Cross-event name caching**: Potential for data leakage
- **Guest display name computation**: Complex COALESCE logic

#### High Risk ❌
- **None identified** in current avatar implementation

## Data Minimization Compliance

### Current Data Selection
```sql
-- Profile page: Includes unnecessary phone field
SELECT id, full_name, phone, avatar_url FROM users WHERE id = $1

-- Recommended: Avatar-specific query
SELECT id, full_name, avatar_url FROM users WHERE id = $1
```

### RPC Data Optimization
```sql
-- Current RPC includes avatar_url but UI doesn't use it
sender_avatar_url: rpcMessage.sender_avatar_url,

-- Recommendation: Remove if not used, or implement UI usage
```

## Storage Security (Future Implementation)

### Recommended Avatar Storage Structure
```
avatars/
├── {user_id}/
│   ├── avatar.jpg
│   └── avatar_thumb.jpg
└── default/
    └── fallback.svg
```

### Security Considerations
1. **File naming**: Use user IDs, not names
2. **Access control**: Event-participant scoped
3. **File validation**: Image type and size limits
4. **CDN caching**: Appropriate cache headers

## Compliance Summary

### ✅ Currently Compliant
- **RLS enforcement**: All queries properly scoped
- **PII minimization**: Only necessary fields accessed
- **Event-based access**: No cross-event data leakage
- **Self-access patterns**: Users control own profile data
- **Logging practices**: No PII in error logs

### ⚠️ Areas for Improvement
- **Data selection**: Remove unused phone field from profile queries
- **RPC optimization**: Avatar URLs fetched but not used
- **Future storage**: Need avatar-specific RLS policies

### ❌ Critical Issues
- **None identified** in current avatar implementation

## Recommendations for Avatar Feature

### 1. Maintain Current Privacy Standards
- Keep event-scoped access model
- Continue PII-safe logging practices
- Preserve RLS policy structure

### 2. Optimize Data Access
```sql
-- Minimal avatar query
SELECT id, full_name, avatar_url 
FROM users 
WHERE id = auth.uid();

-- Event participant names (for messaging)
SELECT DISTINCT u.full_name, u.avatar_url
FROM users u
JOIN event_guests eg ON u.id = eg.user_id  
WHERE eg.event_id = $1 
AND EXISTS (
  SELECT 1 FROM event_guests 
  WHERE user_id = auth.uid() AND event_id = $1
);
```

### 3. Future Avatar Upload Security
- Implement dedicated `avatars` storage bucket
- Use user ID-based folder structure
- Apply event-participant access policies
- Add file type and size validation
- Include malware scanning for uploads

### 4. Enhanced Privacy Controls
- Allow users to opt out of avatar display
- Implement avatar visibility settings
- Add audit logging for avatar access
- Consider GDPR deletion requirements
