# Modern OTP Input Component

## Overview

The `ModernOTPInput` component provides a modern, mobile-first verification code input experience with 6 individual input boxes instead of a single text field.

## Features

✨ **6 Individual Input Boxes**: Each digit gets its own visually separated input
🎯 **Auto-advance**: Automatically moves to the next box when a digit is entered  
⌨️ **Keyboard Navigation**: Arrow keys for manual navigation, backspace for deletion
📋 **Smart Paste**: Paste a 6-digit code anywhere and it distributes across all boxes
📱 **Mobile-Optimized**: Touch-friendly with proper mobile input handling
♿ **Accessible**: Proper labeling, ARIA attributes, and focus management
🎨 **Themed**: Consistent with Unveil's design system

## Usage

```tsx
import { ModernOTPInput } from '@/components/features/auth/ModernOTPInput';

const [otp, setOtp] = useState('');

<ModernOTPInput
  value={otp}
  onChange={setOtp}
  onComplete={(code) => {
    // Called when all 6 digits are entered
    verifyCode(code);
  }}
  error={error}
  autoFocus
  disabled={loading}
/>
```

## Keyboard Interactions

| Key | Action |
|-----|--------|
| `0-9` | Enter digit and auto-advance to next box |
| `Backspace` | Delete current digit, or move to previous box if empty |
| `Arrow Left/Right` | Navigate between boxes |
| `Tab` | Normal tab navigation |
| `Paste` | Distribute pasted 6-digit code across all boxes |

## Props

All props from the original `OTPInput` component are supported:

- `value: string` - The current OTP value
- `onChange: (value: string) => void` - Called when value changes
- `onComplete?: (code: string) => void` - Called when all 6 digits are filled
- `error?: string` - Error message to display
- `disabled?: boolean` - Disable all inputs
- `autoFocus?: boolean` - Auto-focus first input on mount
- `length?: number` - Number of digits (defaults to 6)

## Styling

The component uses Tailwind classes and follows these design patterns:

- **Box Size**: `w-12 h-12` (48x48px) for optimal touch targets
- **Spacing**: `gap-3` between boxes for clear separation  
- **Typography**: Large text (`text-xl`) with monospace font for better digit recognition
- **Focus States**: Pink ring consistent with Unveil's brand colors
- **Error States**: Red borders when validation fails

## Mobile Considerations

- Uses `inputMode="numeric"` to show numeric keyboard on mobile
- `touch-manipulation` CSS for better touch responsiveness
- Minimum 48px touch targets for accessibility
- Prevents iOS zoom with appropriate font sizes

## Migration from Old OTP Input

The `ModernOTPInput` is a drop-in replacement for the old `OTPInput`:

```tsx
// Old
<OTPInput 
  value={otp} 
  onChange={setOtp} 
  onComplete={handleComplete} 
/>

// New - same interface!
<ModernOTPInput 
  value={otp} 
  onChange={setOtp} 
  onComplete={handleComplete} 
/>
```

## Implementation Details

- Each input box handles only single digits
- State is managed centrally and distributed to individual boxes
- Auto-advance logic prevents need for manual navigation
- Paste handling extracts and distributes digits intelligently
- Focus management ensures smooth user experience
- Validation and error states are shared across all boxes