# Avatar Fallbacks & Edge Cases Analysis

## Current Fallback Behavior

### 1. Profile Avatar Button (`ProfileAvatar.tsx`)
- **Current**: Static SVG user icon (gray circles)
- **No user data integration**: Always shows same icon regardless of user
- **Fallback chain**: None - always static icon

### 2. Profile Page Avatar (`profile/page.tsx`)
- **Current**: Gradient background (rose-400 to purple-500) with conditional content
- **Success case**: `<Image>` component with `avatar_url`
- **Fallback**: Static white SVG user icon
- **Size**: 80px (w-20 h-20)

### 3. Message Sender Display
- **Current**: Text-only with emoji prefix
- **Pattern**: `{emoji} {sender.full_name || 'Unknown User'}`
- **No visual avatar**: Only name display

## Edge Case Analysis

### Missing Name Scenarios

| Scenario | Current Behavior | Expected Behavior |
|----------|------------------|-------------------|
| `full_name = null` | "Unknown User" | Initial from phone/email |
| `full_name = ""` | Empty string display | "?" or default icon |
| `full_name = " "` | Single space display | Trimmed → default |
| `full_name = "A"` | "A" | "A" initial |

### Multi-word Names

| Input | Current | Expected Initial |
|-------|---------|------------------|
| "Grant Delgado" | "Grant Delgado" | "GD" or "G" |
| "Mary Jane Watson" | "Mary Jane Watson" | "MW" or "M" |
| "李小龙" | "李小龙" | "李" |
| "José María" | "José María" | "JM" or "J" |

### Special Characters & Unicode

| Input | Current | Expected Handling |
|-------|---------|-------------------|
| "🤖 Bot User" | "🤖 Bot User" | "🤖" or "B" |
| "O'Connor" | "O'Connor" | "O" |
| "van der Berg" | "van der Berg" | "V" or "VB" |
| "محمد علي" (Arabic RTL) | "محمد علي" | "م" |
| " alice " | " alice " | "A" (trimmed) |

### Image URL Failures

| Scenario | Current Behavior | Recommended |
|----------|------------------|-------------|
| `avatar_url = null` | SVG fallback | Initial tile |
| `avatar_url = ""` | SVG fallback | Initial tile |
| Network failure | SVG fallback | Initial tile |
| 404 error | SVG fallback | Initial tile |
| Malformed URL | SVG fallback | Initial tile |

## Current vs Expected Behavior

### ProfileAvatar Component
```typescript
// CURRENT: Static icon always
<svg width="20" height="20" fill="none" viewBox="0 0 24 24">
  <circle cx="12" cy="8" r="4" fill="#6b7280" />
  <ellipse cx="12" cy="17" rx="7" ry="4" fill="#9ca3af" />
</svg>

// EXPECTED: User-specific initial
<div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
  <span className="text-white text-sm font-medium">GD</span>
</div>
```

### Profile Page Avatar
```typescript
// CURRENT: Gradient with conditional image
<div className="w-20 h-20 bg-gradient-to-r from-rose-400 to-purple-500 rounded-full flex items-center justify-center mx-auto">
  {userProfile.avatar_url ? (
    <Image src={userProfile.avatar_url} alt="Profile" width={80} height={80} className="w-full h-full rounded-full object-cover" />
  ) : (
    <svg width="32" height="32" fill="white" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="4" />
      <ellipse cx="12" cy="17" rx="7" ry="4" />
    </svg>
  )}
</div>

// EXPECTED: Consistent initial-based fallback
<div className="w-20 h-20 rounded-full bg-purple-500 flex items-center justify-center mx-auto">
  {userProfile.avatar_url ? (
    <Image src={userProfile.avatar_url} alt="Profile" width={80} height={80} className="w-full h-full rounded-full object-cover" />
  ) : (
    <span className="text-white text-2xl font-medium">
      {getInitial(userProfile.full_name)}
    </span>
  )}
</div>
```

## Missing Functionality

### 1. Initial Extraction
- **No utility function** for extracting initials
- **No Unicode support** for non-Latin scripts
- **No grapheme cluster handling** for complex characters

### 2. Color Generation
- **No deterministic colors** based on user identity
- **No accessible color palette** defined
- **Inconsistent backgrounds** across components

### 3. Size Standardization
- **Ad-hoc sizing**: 20px, 80px used arbitrarily
- **No design system tokens** for avatar sizes
- **No responsive sizing** considerations

### 4. Accessibility
- **Missing aria-labels** with user names
- **No contrast verification** for generated colors
- **No keyboard navigation** considerations

## Recommendations for Fallback Chain

### Proposed Order
1. **Image URL** (if valid and loads successfully)
2. **Initial Tile** (generated from display name)
3. **Default Icon** (generic user silhouette)

### Initial Generation Logic
```typescript
function getInitial(name: string | null): string {
  if (!name?.trim()) return '?';
  
  // Handle Unicode grapheme clusters
  const firstGrapheme = [...name.trim()][0];
  return firstGrapheme?.toUpperCase() || '?';
}
```

### Color Generation Logic
```typescript
function getAvatarColor(key: string): { bg: string; text: string } {
  const colors = [
    { bg: 'bg-purple-500', text: 'text-white' },
    { bg: 'bg-blue-500', text: 'text-white' },
    { bg: 'bg-green-500', text: 'text-white' },
    // ... more accessible pairs
  ];
  
  const hash = simpleHash(key);
  return colors[hash % colors.length];
}
```
