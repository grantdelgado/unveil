# Initial-Based Avatar Recommendations (MVP)

## Executive Summary

This document outlines a comprehensive specification for implementing initial-based avatars in the Unveil app. The design prioritizes accessibility, consistency, and maintainability while providing a foundation for future avatar upload functionality.

## Core Specification

### 1. Initial Extraction Algorithm

#### Unicode-Safe Initial Generation
```typescript
/**
 * Extract the first grapheme cluster from a display name
 * Handles Unicode, emojis, and complex scripts safely
 */
function getInitial(name: string | null | undefined): string {
  if (!name?.trim()) return '?';
  
  // Use Intl.Segmenter for proper grapheme cluster handling
  const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
  const segments = [...segmenter.segment(name.trim())];
  
  const firstGrapheme = segments[0]?.segment;
  if (!firstGrapheme) return '?';
  
  // Handle special cases
  if (firstGrapheme.match(/\p{Emoji}/u)) {
    return firstGrapheme; // Keep emojis as-is
  }
  
  return firstGrapheme.toUpperCase();
}

// Examples:
// getInitial("Grant Delgado") → "G"
// getInitial("李小龙") → "李"  
// getInitial("🤖 Bot") → "🤖"
// getInitial("O'Connor") → "O"
// getInitial("") → "?"
```

### 2. Deterministic Color System

#### Accessible Color Palette
```typescript
type AvatarColor = {
  bg: string;
  text: string;
  contrast: number; // WCAG AA ratio
};

const AVATAR_COLORS: AvatarColor[] = [
  { bg: 'bg-purple-600', text: 'text-white', contrast: 5.9 },
  { bg: 'bg-blue-600', text: 'text-white', contrast: 5.4 },
  { bg: 'bg-green-600', text: 'text-white', contrast: 4.8 },
  { bg: 'bg-rose-600', text: 'text-white', contrast: 4.7 },
  { bg: 'bg-teal-600', text: 'text-white', contrast: 5.1 },
  { bg: 'bg-indigo-600', text: 'text-white', contrast: 6.8 },
  { bg: 'bg-emerald-600', text: 'text-white', contrast: 4.9 },
  { bg: 'bg-amber-600', text: 'text-black', contrast: 6.2 },
  { bg: 'bg-orange-600', text: 'text-white', contrast: 4.6 },
  { bg: 'bg-cyan-600', text: 'text-white', contrast: 5.3 },
  { bg: 'bg-violet-600', text: 'text-white', contrast: 6.1 },
  { bg: 'bg-lime-600', text: 'text-black', contrast: 5.8 },
];
```

#### Color Selection Algorithm
```typescript
/**
 * Generate deterministic avatar color from stable user key
 * Uses user ID for consistency across sessions
 */
function getAvatarColor(userId: string): AvatarColor {
  // Simple hash function for deterministic selection
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}
```

### 3. Size System

#### Standardized Size Tokens
```typescript
type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

const AVATAR_SIZES: Record<AvatarSize, {
  container: string;
  text: string;
  pixels: number;
}> = {
  sm: { container: 'w-6 h-6', text: 'text-xs', pixels: 24 },
  md: { container: 'w-8 h-8', text: 'text-sm', pixels: 32 },
  lg: { container: 'w-10 h-10', text: 'text-base', pixels: 40 },
  xl: { container: 'w-16 h-16', text: 'text-xl', pixels: 64 },
};
```

#### Responsive Sizing (Future Enhancement)
```css
/* Mobile-first responsive avatars */
.avatar-responsive-md {
  @apply w-8 h-8 text-sm;
}

@screen sm {
  .avatar-responsive-md {
    @apply w-10 h-10 text-base;
  }
}
```

### 4. Accessibility Specification

#### ARIA Labels
```typescript
function getAvatarAriaLabel(user: { full_name?: string | null }, context: 'button' | 'display' = 'display'): string {
  const name = user.full_name?.trim();
  
  if (context === 'button') {
    return name ? `Account menu for ${name}` : 'Account menu';
  }
  
  return name ? `${name}'s profile picture` : 'Profile picture';
}
```

#### Focus Management
```css
/* Focus ring for interactive avatars */
.avatar-button:focus {
  @apply outline-none ring-2 ring-purple-500 ring-offset-2;
}

/* High contrast mode support */
@media (forced-colors: active) {
  .avatar-fallback {
    background: ButtonFace !important;
    color: ButtonText !important;
    border: 1px solid ButtonText !important;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .avatar-button {
    transition: none !important;
  }
}
```

## Component Architecture

### 1. Core Avatar Component

#### Base Avatar Component
```typescript
interface AvatarProps {
  user: {
    id: string;
    full_name?: string | null;
    avatar_url?: string | null;
  };
  size?: AvatarSize;
  className?: string;
  showFallback?: boolean;
}

function Avatar({ user, size = 'md', className, showFallback = true }: AvatarProps) {
  const sizeConfig = AVATAR_SIZES[size];
  const initial = getInitial(user.full_name);
  const colors = getAvatarColor(user.id);
  
  return (
    <div 
      className={cn(
        sizeConfig.container,
        'rounded-full overflow-hidden flex items-center justify-center',
        className
      )}
    >
      {user.avatar_url ? (
        <OptimizedImage
          src={user.avatar_url}
          alt={getAvatarAriaLabel(user)}
          width={sizeConfig.pixels}
          height={sizeConfig.pixels}
          className="w-full h-full object-cover"
          fallback={showFallback ? (
            <AvatarFallback 
              initial={initial} 
              colors={colors} 
              size={size} 
            />
          ) : undefined}
        />
      ) : showFallback ? (
        <AvatarFallback 
          initial={initial} 
          colors={colors} 
          size={size} 
        />
      ) : null}
    </div>
  );
}
```

#### Fallback Component
```typescript
interface AvatarFallbackProps {
  initial: string;
  colors: AvatarColor;
  size: AvatarSize;
}

function AvatarFallback({ initial, colors, size }: AvatarFallbackProps) {
  const sizeConfig = AVATAR_SIZES[size];
  
  return (
    <div 
      className={cn(
        'w-full h-full flex items-center justify-center font-medium',
        colors.bg,
        colors.text,
        sizeConfig.text
      )}
    >
      {initial}
    </div>
  );
}
```

### 2. Interactive Avatar Button

```typescript
interface AvatarButtonProps extends AvatarProps {
  onClick?: () => void;
  disabled?: boolean;
}

function AvatarButton({ onClick, disabled, ...avatarProps }: AvatarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={getAvatarAriaLabel(avatarProps.user, 'button')}
      className={cn(
        'avatar-button transition-all duration-200',
        'hover:ring-2 hover:ring-purple-200 hover:shadow-md',
        'focus:ring-2 focus:ring-purple-500 focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        disabled && 'pointer-events-none'
      )}
    >
      <Avatar {...avatarProps} />
    </button>
  );
}
```

## Implementation Plan

### Phase 1: Core Avatar System (Week 1)
1. **Create utility functions**
   - `getInitial()` with Unicode support
   - `getAvatarColor()` with deterministic hashing
   - `getAvatarAriaLabel()` for accessibility

2. **Build base components**
   - `Avatar` component with fallback logic
   - `AvatarFallback` component with color system
   - `AvatarButton` wrapper for interactive use

3. **Update existing components**
   - Replace `ProfileAvatar` static icon
   - Enhance profile page avatar display
   - Add avatars to message sender displays

### Phase 2: Integration & Polish (Week 2)
1. **Component integration**
   - Update all avatar usage points
   - Implement consistent sizing system
   - Add proper ARIA labels and focus management

2. **Testing & validation**
   - Unit tests for initial extraction
   - Accessibility testing with screen readers
   - Color contrast verification
   - Cross-browser Unicode support testing

### Phase 3: Future Upload Foundation (Week 3+)
1. **Storage preparation**
   - Create `avatars` storage bucket
   - Implement RLS policies for avatar access
   - Add file validation and processing

2. **Upload interface**
   - Avatar upload component
   - Image cropping and resizing
   - Progress indicators and error handling

## Code Sketches

### Utility Functions
```typescript
// lib/utils/avatar.ts
export { getInitial, getAvatarColor, getAvatarAriaLabel };

// components/ui/Avatar.tsx  
export { Avatar, AvatarButton, AvatarFallback };

// Updated ProfileAvatar usage
function ProfileAvatar() {
  const { user } = useAuth();
  
  return (
    <AvatarButton
      user={user}
      size="md"
      onClick={() => router.push('/profile')}
    />
  );
}
```

### Message Integration
```typescript
// Updated MessageBubble with avatar
function MessageBubble({ message, isOwnMessage, showSender }: MessageBubbleProps) {
  return (
    <div className="flex flex-col gap-1">
      {showSender && message.sender && (
        <div className="flex items-center gap-2 text-xs">
          <Avatar 
            user={message.sender} 
            size="sm" 
            className="flex-shrink-0"
          />
          <span className="text-gray-500">
            {message.sender.full_name || 'Unknown User'}
          </span>
        </div>
      )}
      {/* Message content */}
    </div>
  );
}
```

## Migration Strategy

### Backward Compatibility
- **Gradual rollout**: Replace components one by one
- **Feature flags**: Toggle between old and new avatar systems
- **Fallback support**: Maintain existing static icons as ultimate fallback

### Data Migration
- **No database changes**: Uses existing `users.full_name` and `users.avatar_url`
- **Client-side processing**: All initial generation happens in browser
- **Server parity**: Utility functions work in both client and server contexts

### Testing Strategy
```typescript
// Unit tests for initial extraction
describe('getInitial', () => {
  it('handles basic Latin names', () => {
    expect(getInitial('Grant Delgado')).toBe('G');
  });
  
  it('handles CJK characters', () => {
    expect(getInitial('李小龙')).toBe('李');
  });
  
  it('handles emojis', () => {
    expect(getInitial('🤖 Bot')).toBe('🤖');
  });
  
  it('handles edge cases', () => {
    expect(getInitial('')).toBe('?');
    expect(getInitial('   ')).toBe('?');
    expect(getInitial(null)).toBe('?');
  });
});

// Color consistency tests
describe('getAvatarColor', () => {
  it('returns consistent colors for same user', () => {
    const userId = 'test-user-123';
    const color1 = getAvatarColor(userId);
    const color2 = getAvatarColor(userId);
    expect(color1).toEqual(color2);
  });
  
  it('returns different colors for different users', () => {
    const color1 = getAvatarColor('user1');
    const color2 = getAvatarColor('user2');
    expect(color1).not.toEqual(color2);
  });
});
```

## Future Upload Feature Foundation

### Storage Architecture
```
supabase/storage/avatars/
├── {user_id}/
│   ├── original.jpg     # Full resolution upload
│   ├── large.jpg        # 256x256 for profile pages
│   ├── medium.jpg       # 64x64 for cards
│   └── small.jpg        # 32x32 for lists
└── system/
    └── default.svg      # System fallback icon
```

### Upload Component Preview
```typescript
function AvatarUpload({ user, onUpload }: AvatarUploadProps) {
  return (
    <div className="relative">
      <Avatar user={user} size="xl" />
      
      <button 
        className="absolute inset-0 bg-black/50 rounded-full opacity-0 hover:opacity-100 transition-opacity"
        aria-label="Change profile picture"
      >
        <CameraIcon className="w-6 h-6 text-white" />
      </button>
      
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFileSelect}
      />
    </div>
  );
}
```

### RLS Policies for Upload
```sql
-- Avatar upload policy
CREATE POLICY "Users can upload own avatars" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Avatar read policy (event-scoped)
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

## Success Metrics

### Technical Metrics
- **Performance**: Avatar rendering < 16ms
- **Accessibility**: 100% WCAG AA compliance
- **Consistency**: All avatar instances use shared components
- **Unicode support**: Proper handling of all scripts

### User Experience Metrics  
- **Recognition**: Users can identify themselves and others
- **Personalization**: Unique visual identity per user
- **Accessibility**: Screen reader friendly
- **Performance**: No layout shifts or loading delays

### Future Readiness
- **Upload foundation**: Storage and policies ready
- **Scalability**: Component system supports new features
- **Maintainability**: Centralized avatar logic
- **Extensibility**: Easy to add new sizes, shapes, or features
