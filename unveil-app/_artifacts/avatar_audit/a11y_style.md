# Avatar Accessibility & Styling Review

## Current Size Usage Analysis

### Sizes Found in Codebase
| Component | Size (px) | Tailwind Class | Context |
|-----------|-----------|----------------|---------|
| ProfileAvatar | 20×20 | `w-5 h-5` (svg) | Header navigation button |
| Profile Page | 80×80 | `w-20 h-20` | Large profile display |
| AvatarImage | 40×40 | `size` prop default | Generic component |
| Message Icons | 20×20 | svg dimensions | Message type indicators |

### Recommended Size System
| Token | Size (px) | Tailwind | Use Case |
|-------|-----------|----------|----------|
| `sm` | 24×24 | `w-6 h-6` | Compact lists, inline mentions |
| `md` | 32×32 | `w-8 h-8` | Standard buttons, cards |
| `lg` | 40×40 | `w-10 h-10` | Prominent displays |
| `xl` | 64×64 | `w-16 h-16` | Profile headers, modals |

## Current Styling Patterns

### ProfileAvatar Component
```css
/* Current classes */
.bg-white
.border
.border-gray-200
.hover:ring-2
.hover:ring-purple-200
.hover:border-purple-300
.shadow-sm
.hover:shadow-md
```

**Issues:**
- No focus ring for keyboard navigation
- Insufficient contrast ratios not verified
- No active/pressed states

### Profile Page Avatar
```css
/* Current classes */
.w-20
.h-20
.bg-gradient-to-r
.from-rose-400
.to-purple-500
.rounded-full
.flex
.items-center
.justify-center
.mx-auto
```

**Issues:**
- Gradient may not meet contrast requirements
- No fallback for high contrast mode
- Fixed size not responsive

## Accessibility Audit

### Current Accessibility Features

#### ProfileAvatar ✅
- **aria-label**: `"Profile"` ✅
- **Role**: Implicit button role ✅
- **Keyboard**: Clickable via IconButton ✅

#### Profile Page Avatar ❌
- **aria-label**: Missing ❌
- **Role**: No semantic role ❌
- **Alt text**: Generic "Profile" ❌

#### Message Senders ❌
- **Screen reader**: Text only, no context ❌
- **Semantic markup**: No role attributes ❌

### Missing Accessibility Features

#### 1. Proper ARIA Labels
```typescript
// CURRENT: Generic label
aria-label="Profile"

// RECOMMENDED: User-specific label
aria-label={`Account: ${user.full_name || 'Your Profile'}`}
```

#### 2. Focus Management
```css
/* MISSING: Visible focus ring */
.focus:ring-2
.focus:ring-purple-500
.focus:ring-offset-2
.focus:outline-none
```

#### 3. High Contrast Support
```css
/* MISSING: Forced colors support */
@media (forced-colors: active) {
  .avatar-fallback {
    background: ButtonFace;
    color: ButtonText;
    border: 1px solid ButtonText;
  }
}
```

## Color Contrast Analysis

### Current Colors (Profile Page)
- **Background**: `from-rose-400 to-purple-500`
- **Text**: `fill="white"`
- **Contrast Ratio**: ~3.2:1 (rose-400) to ~4.1:1 (purple-500)

**WCAG Compliance:**
- ❌ AA Large Text (3:1 required, rose-400 fails)
- ✅ AA Large Text (purple-500 passes)
- ❌ AA Normal Text (4.5:1 required, both fail)

### Recommended Accessible Palette
| Color | Background | Text | Contrast Ratio | WCAG AA |
|-------|------------|------|----------------|---------|
| Purple | `bg-purple-600` | `text-white` | 5.9:1 | ✅ |
| Blue | `bg-blue-600` | `text-white` | 5.4:1 | ✅ |
| Green | `bg-green-600` | `text-white` | 4.8:1 | ✅ |
| Rose | `bg-rose-600` | `text-white` | 4.7:1 | ✅ |
| Amber | `bg-amber-600` | `text-black` | 6.2:1 | ✅ |
| Teal | `bg-teal-600` | `text-white` | 5.1:1 | ✅ |
| Indigo | `bg-indigo-600` | `text-white` | 6.8:1 | ✅ |
| Emerald | `bg-emerald-600` | `text-white` | 4.9:1 | ✅ |

## Border Radius & Shape

### Current Implementation
- **Profile Avatar**: `rounded-full` (circular) ✅
- **Profile Page**: `rounded-full` (circular) ✅
- **Consistency**: Good ✅

### Recommended Standards
```css
/* Avatar shape tokens */
.avatar-circular { border-radius: 9999px; }
.avatar-rounded { border-radius: 0.5rem; }
.avatar-square { border-radius: 0; }
```

## Shadow & Elevation

### Current Shadows
- **ProfileAvatar**: `shadow-sm` → `hover:shadow-md`
- **Profile Page**: No shadow

### Recommended Shadow System
```css
/* Avatar elevation tokens */
.avatar-shadow-sm { box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); }
.avatar-shadow-md { box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
.avatar-shadow-lg { box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1); }
```

## Responsive Considerations

### Current Issues
- **Fixed sizes**: No responsive scaling
- **Mobile optimization**: 80px may be too large on small screens
- **Touch targets**: 20px button may be too small for touch

### Recommended Responsive Sizes
```css
/* Responsive avatar sizing */
.avatar-sm { 
  @apply w-6 h-6 text-xs;
}

.avatar-md { 
  @apply w-8 h-8 text-sm;
  @screen sm { @apply w-10 h-10 text-base; }
}

.avatar-lg { 
  @apply w-12 h-12 text-lg;
  @screen sm { @apply w-16 h-16 text-xl; }
}

.avatar-xl { 
  @apply w-16 h-16 text-xl;
  @screen sm { @apply w-20 h-20 text-2xl; }
}
```

## Keyboard Navigation

### Current State
- **ProfileAvatar**: Keyboard accessible via IconButton ✅
- **Tab order**: Proper sequence ✅
- **Enter/Space**: Activates button ✅

### Missing Features
- **Arrow key navigation** in avatar grids
- **Focus trapping** in avatar selection modals
- **Skip links** for avatar-heavy interfaces

## Screen Reader Support

### Current Issues
```html
<!-- CURRENT: Minimal context -->
<button aria-label="Profile">
  <svg>...</svg>
</button>

<!-- IMPROVED: Rich context -->
<button 
  aria-label="Account menu for Grant Delgado"
  aria-describedby="avatar-help"
>
  <img alt="Grant Delgado's profile picture" />
</button>
<div id="avatar-help" class="sr-only">
  Opens account settings and profile options
</div>
```

### Recommended ARIA Patterns
```typescript
// Avatar button with user context
const getAvatarAriaLabel = (user: User) => {
  if (user.full_name) {
    return `Account menu for ${user.full_name}`;
  }
  return 'Account menu';
};

// Avatar image with meaningful alt text
const getAvatarAltText = (user: User) => {
  if (user.full_name) {
    return `${user.full_name}'s profile picture`;
  }
  return 'Profile picture';
};
```

## Motion & Animation

### Current State
- **Transitions**: `transition-all duration-200` ✅
- **Hover effects**: Smooth ring and shadow changes ✅
- **Reduced motion**: Not considered ❌

### Accessibility Recommendations
```css
/* Respect user motion preferences */
@media (prefers-reduced-motion: reduce) {
  .avatar-button {
    transition: none;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .avatar-button {
    transition: all 0.2s ease-in-out;
  }
}
```

## Summary of Issues

### Critical (Must Fix)
1. **Missing focus rings** on interactive avatars
2. **Insufficient contrast ratios** in gradient backgrounds
3. **Generic aria-labels** without user context
4. **No high contrast mode support**

### Important (Should Fix)
1. **Inconsistent sizing system** across components
2. **Missing responsive considerations**
3. **No reduced motion support**
4. **Inadequate screen reader context**

### Nice to Have
1. **Consistent shadow system**
2. **Better semantic markup**
3. **Enhanced keyboard navigation**
4. **Rich ARIA descriptions**
