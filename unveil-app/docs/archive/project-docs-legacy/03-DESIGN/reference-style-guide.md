# Unveil Style Guide - Updated Design System

## 🎨 Typography Hierarchy

| Use Case | Font | Size | Weight | Tailwind Classes |
|--------------------|----------|----------|-----------|--------------------------|
| Main Page Title (H1) | Inter | 30px | Bold | `text-3xl font-bold` |
| Section Title (H2) | Inter | 24px | Semibold | `text-2xl font-semibold` |
| Body Text | Inter | 16px | Regular | `text-base` |
| Secondary Text | Inter | 16px | Regular | `text-base text-gray-500` |
| Labels | Inter | 16px | Medium | `text-base font-medium` |
| Small Text/Microcopy | Inter | 14px | Regular | `text-sm text-gray-500` |
| Dev Mode Text | Inter | 14px | Regular/Bold | `text-sm text-blue-700/800` |

---

## 🎨 Color Palette

### Core Colors
- **Page Background**: `#FAFAFA` (Warm light gray)
- **Card Background**: `#FFFFFF` (Pure white)
- **Primary Brand**: `#FF6B6B` (Warm coral)
- **Primary Brand Hover**: `#FF5A5A` (Darker coral)

### Text Colors
- **Primary Text**: `#111827` (`text-gray-900`)
- **Secondary Text**: `#6B7280` (`text-gray-500`)
- **Label Text**: `#374151` (`text-gray-700`)
- **Muted Text**: `#9CA3AF` (`text-gray-400`)
- **Error Text**: `#DC2626` (`text-red-600`)

### Interactive Colors
- **Focus Ring**: `#F9A8D4` (`focus:ring-pink-300`)
- **Focus Border**: `#F472B6` (`focus:border-pink-400`)
- **Border Default**: `#D1D5DB` (`border-gray-300`)
- **Border Light**: `#F3F4F6` (`border-gray-100`)

### Development Mode Colors
- **Background**: `#EDF4FF` (Soft blue)
- **Text**: `#1E3A8A` (`text-blue-800`)
- **Secondary Text**: `#1D4ED8` (`text-blue-700`)

---

## 🔘 Button System

### Primary Button
```html
<button class="w-full py-3 px-4 bg-[#FF6B6B] hover:bg-[#FF5A5A] text-white text-base font-medium rounded-lg shadow-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
```
- **Background**: Warm coral `#FF6B6B`
- **Hover**: Darker coral `#FF5A5A`
- **Padding**: `py-3 px-4` (12px vertical, 16px horizontal)
- **Full width**: `w-full`

### Secondary Button
```html
<button class="w-full py-3 px-4 text-gray-600 text-base font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors duration-200">
```
- **Border**: Light gray with hover background
- **Text**: Medium gray `text-gray-600`
- **Same padding as primary**

---

## ✅ Form Controls

### Input Fields
```html
<input class="w-full py-3 px-4 border border-gray-300 rounded-lg text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-pink-400 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50">
```
- **Padding**: `py-3 px-4` (12px vertical, 16px horizontal)
- **Border**: Light gray `border-gray-300`
- **Focus**: Pink ring and border
- **Radius**: `rounded-lg` (8px)

### Form Labels
```html
<label class="block text-base font-medium text-gray-700 mb-2">
```
- **Typography**: Base size, medium weight
- **Color**: `text-gray-700`
- **Spacing**: `mb-2` below label

### Error States
```html
<p class="text-sm text-red-600 mt-1" role="alert">Error message</p>
```

---

## 📦 Container System

### Page Container
```html
<div class="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4 md:p-6">
```

### Card Container
```html
<div class="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-gray-100 p-6 transition-all duration-500 ease-out animate-fade-in-up">
```
- **Max width**: `max-w-sm` (384px) for mobile-first
- **Shadow**: `shadow-lg` for elevation
- **Radius**: `rounded-2xl` (16px)
- **Animation**: Entrance fade-in-up

---

## 🔧 Spacing System

### Container Spacing
- **Page padding**: `p-4` mobile, `md:p-6` desktop
- **Card padding**: `p-6` (24px)
- **Section spacing**: `mb-6` (24px)
- **Form spacing**: `space-y-5` (20px between form elements)
- **Form group spacing**: `space-y-2` (8px within groups)

### Component Spacing
- **Logo to title**: `mb-4` (16px)
- **Title to subtitle**: `mb-2` (8px)
- **Label to input**: `mb-2` (8px)
- **Microcopy spacing**: `mt-6` (24px)

---

## 🎭 Shadows & Elevation

### Card Elevation
- **Shadow**: `shadow-lg` 
- **CSS**: `0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)`

### Button Elevation
- **Shadow**: `shadow-sm`
- **CSS**: `0 1px 2px 0 rgba(0, 0, 0, 0.05)`

---

## 🔄 Animation System

### Page Entrance
```css
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-up { animation: fade-in-up 0.5s ease-out; }
```

### Transitions
- **Standard**: `transition-all duration-500 ease-out`
- **Colors**: `transition-colors duration-200`
- **Interactive**: `transition-all duration-200`

---

## 📋 Development Mode Styling

### Info Box
```html
<div class="mt-6 p-4 bg-[#EDF4FF] rounded-lg">
  <div class="text-sm">
    <div class="font-bold text-blue-800 mb-2">🚀 Development Mode</div>
    <div class="text-blue-700">Content...</div>
  </div>
</div>
```

---

## 🎯 Design Principles

### Mobile-First
- All components prioritize mobile experience
- Use responsive padding: `p-4 md:p-6`
- Max widths: `max-w-sm` for forms, `max-w-md` for content

### Accessibility
- All interactive elements have focus states
- Color contrast meets WCAG AA standards
- Proper labels and error associations
- Semantic HTML elements

### Consistency
- Use warm coral `#FF6B6B` for primary actions
- Maintain consistent spacing scale
- Apply `rounded-lg` to form controls, `rounded-2xl` to cards
- Use soft `#FAFAFA` background throughout app

### Polish
- Subtle entrance animations on cards
- Smooth color transitions (200ms)
- Consistent shadow elevation
- Development mode styling that doesn't interfere

---

## 📐 Border Radius System

- **Cards**: `rounded-2xl` (16px)
- **Form controls**: `rounded-lg` (8px)
- **Buttons**: `rounded-lg` (8px)
- **Info boxes**: `rounded-lg` (8px)

---

## 🎨 Logo/Icon System

### Logo Container
```html
<div class="flex justify-center mb-4">
  <div class="w-16 h-16 flex items-center justify-center">
    <span class="text-5xl">💍</span>
  </div>
</div>
```
- **Size**: `w-16 h-16` (64px × 64px)
- **Icon size**: `text-5xl` (48px)
- **Spacing**: `mb-4` below logo
