# Unveil Design System Specification

**Status**: ✅ **IMPLEMENTED** - Complete standardization across entire application  
**Last Updated**: January 16, 2025  
**Implementation**: 100% complete across all pages and components

## Overview
This design system was extracted from the polished Login Page implementation and now serves as the **implemented** single source of truth for all UI/UX consistency across the Unveil wedding app. All pages and components have been standardized to follow these specifications.

## Core Design Principles
- **Mobile-first**: All designs prioritize mobile experience
- **Warm & Modern**: Soft, romantic aesthetic with clean modern elements
- **Accessible**: WCAG compliant with proper focus states and semantics
- **Consistent**: Unified visual language across all touchpoints

---

## 1. Layout Structure

### Page Container
```css
/* Full-screen container */
.page-container {
  min-height: 100vh;
  background: #FAFAFA;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

/* Responsive padding */
@media (min-width: 768px) {
  .page-container {
    padding: 1.5rem;
  }
}
```

### Card Containers
```css
.card-container {
  width: 100%;
  max-width: 24rem; /* max-w-sm */
  background: white;
  border-radius: 1rem; /* rounded-2xl */
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); /* shadow-lg */
  border: 1px solid #F3F4F6; /* border-gray-100 */
  padding: 1.5rem; /* p-6 */
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## 2. Color Palette

### Primary Colors
- **Page Background**: `#FAFAFA` (Warm light gray)
- **Card Background**: `#FFFFFF` (Pure white)
- **Primary Brand**: `#FF6B6B` (Warm coral)
- **Primary Brand Hover**: `#FF5A5A` (Darker coral)

### Text Colors
- **Primary Text**: `#111827` (text-gray-900)
- **Secondary Text**: `#6B7280` (text-gray-500)
- **Label Text**: `#374151` (text-gray-700)
- **Muted Text**: `#9CA3AF` (text-gray-400)
- **Error Text**: `#DC2626` (text-red-600)

### Development Mode Colors
- **Background**: `#EDF4FF` (Soft blue)
- **Text**: `#1E3A8A` (text-blue-800)
- **Secondary Text**: `#1D4ED8` (text-blue-700)

### Interactive Colors
- **Focus Ring**: `#F9A8D4` (focus:ring-pink-300)
- **Focus Border**: `#F472B6` (focus:border-pink-400)
- **Border Default**: `#D1D5DB` (border-gray-300)
- **Border Light**: `#F3F4F6` (border-gray-100)

---

## 3. Typography Hierarchy

### Headers
```css
/* Main Page Title (H1) */
.title-main {
  font-size: 1.875rem; /* text-3xl */
  font-weight: 700; /* font-bold */
  color: #111827; /* text-gray-900 */
  margin-bottom: 0.5rem;
}

/* Section Headers (H2) */
.title-section {
  font-size: 1.5rem; /* text-2xl */
  font-weight: 600; /* font-semibold */
  color: #111827;
  margin-bottom: 1rem;
}
```

### Body Text
```css
/* Primary Body Text */
.text-primary {
  font-size: 1rem; /* text-base */
  color: #111827;
  line-height: 1.5;
}

/* Secondary Body Text */
.text-secondary {
  font-size: 1rem; /* text-base */
  color: #6B7280; /* text-gray-500 */
  line-height: 1.5;
}

/* Small Text / Microcopy */
.text-small {
  font-size: 0.875rem; /* text-sm */
  color: #6B7280;
  line-height: 1.4;
}
```

### Labels
```css
.label-primary {
  font-size: 1rem; /* text-base */
  font-weight: 500; /* font-medium */
  color: #374151; /* text-gray-700 */
  display: block;
  margin-bottom: 0.5rem;
}
```

---

## 4. Form Controls

### Input Fields
```css
.input-primary {
  width: 100%;
  padding: 0.75rem 1rem; /* py-3 px-4 */
  border: 1px solid #D1D5DB; /* border-gray-300 */
  border-radius: 0.5rem; /* rounded-lg */
  font-size: 1rem; /* text-base */
  transition: all 0.2s ease-in-out;
  background: white;
}

.input-primary::placeholder {
  color: #9CA3AF; /* text-gray-400 */
}

.input-primary:focus {
  outline: none;
  ring: 2px solid #F9A8D4; /* focus:ring-pink-300 */
  border-color: #F472B6; /* focus:border-pink-400 */
}

.input-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: #F9FAFB; /* bg-gray-50 */
}
```

### Form Groups
```css
.form-group {
  margin-bottom: 0.5rem; /* space-y-2 */
}

.form-container {
  margin-bottom: 1.25rem; /* space-y-5 */
}
```

---

## 5. Button System

### Primary Button
```css
.btn-primary {
  width: 100%;
  padding: 0.75rem 1rem; /* py-3 px-4 */
  background-color: #FF6B6B;
  color: white;
  font-size: 1rem; /* text-base */
  font-weight: 500; /* font-medium */
  border-radius: 0.5rem; /* rounded-lg */
  border: none;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); /* shadow-sm */
  transition: all 0.2s ease-in-out;
  cursor: pointer;
}

.btn-primary:hover {
  background-color: #FF5A5A;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Secondary Button
```css
.btn-secondary {
  width: 100%;
  padding: 0.75rem 1rem; /* py-3 px-4 */
  background-color: transparent;
  color: #4B5563; /* text-gray-600 */
  font-size: 1rem; /* text-base */
  font-weight: 500; /* font-medium */
  border-radius: 0.5rem; /* rounded-lg */
  border: 1px solid #D1D5DB; /* border-gray-300 */
  transition: all 0.2s ease-in-out;
  cursor: pointer;
}

.btn-secondary:hover {
  background-color: #F9FAFB; /* hover:bg-gray-50 */
}
```

---

## 6. Spacing System

### Container Spacing
- **Page padding**: `p-4` mobile, `md:p-6` desktop
- **Card padding**: `p-6` (1.5rem)
- **Section spacing**: `mb-6` (1.5rem)
- **Form spacing**: `space-y-5` (1.25rem)
- **Form group spacing**: `space-y-2` (0.5rem)

### Component Spacing
- **Logo to title**: `mb-4` (1rem)
- **Title to subtitle**: `mb-2` (0.5rem)
- **Label to input**: `mb-2` (0.5rem)
- **Microcopy spacing**: `mt-6` (1.5rem)

---

## 7. Shadows & Elevation

### Card Elevation
```css
.elevation-card {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}
```

### Button Elevation
```css
.elevation-button {
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}
```

---

## 8. Border Radius System

- **Cards**: `rounded-2xl` (1rem)
- **Form controls**: `rounded-lg` (0.5rem)
- **Buttons**: `rounded-lg` (0.5rem)
- **Info boxes**: `rounded-lg` (0.5rem)

---

## 9. Development Mode Styling

### Development Info Box
```css
.dev-info-box {
  margin-top: 1.5rem; /* mt-6 */
  padding: 1rem; /* p-4 */
  background-color: #EDF4FF;
  border-radius: 0.5rem; /* rounded-lg */
}

.dev-title {
  font-weight: 700; /* font-bold */
  color: #1E3A8A; /* text-blue-800 */
  margin-bottom: 0.5rem;
  font-size: 0.875rem; /* text-sm */
}

.dev-text {
  color: #1D4ED8; /* text-blue-700 */
  font-size: 0.875rem; /* text-sm */
}

.dev-code {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", monospace;
  color: #1E3A8A; /* text-blue-800 */
}
```

---

## 10. Animation System

### Page Entrance
```css
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fade-in-up 0.5s ease-out;
}
```

### Transitions
- **Standard transition**: `transition-all duration-500 ease-out`
- **Color transitions**: `transition-colors duration-200`
- **Interactive transitions**: `transition-all duration-200`

---

## 11. Error States

### Error Text
```css
.error-text {
  font-size: 0.875rem; /* text-sm */
  color: #DC2626; /* text-red-600 */
  margin-top: 0.25rem; /* mt-1 */
}
```

### Error Input State
```css
.input-error {
  border-color: #EF4444; /* border-red-500 */
}

.input-error:focus {
  ring-color: #FECACA; /* focus:ring-red-200 */
  border-color: #EF4444;
}
```

---

## 12. Logo/Icon System

### Logo Container
```css
.logo-container {
  width: 4rem; /* w-16 */
  height: 4rem; /* h-16 */
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
}

.logo-icon {
  font-size: 3rem; /* text-5xl */
}
```

---

## Implementation Guidelines

### Tailwind CSS Classes
This design system maps directly to Tailwind CSS utilities. Key class combinations:

**Card Container:**
```html
<div class="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-gray-100 p-6 transition-all duration-500 ease-out animate-fade-in-up">
```

**Primary Button:**
```html
<button class="w-full py-3 px-4 bg-[#FF6B6B] hover:bg-[#FF5A5A] text-white text-base font-medium rounded-lg shadow-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
```

**Input Field:**
```html
<input class="w-full py-3 px-4 border border-gray-300 rounded-lg text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-pink-400 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50">
```

### Responsive Considerations
- All components are mobile-first
- Use `max-w-sm` for mobile cards, can expand to `max-w-md` for desktop content
- Maintain consistent padding scaling: `p-4` mobile → `md:p-6` desktop

### Accessibility Requirements
- All interactive elements must have focus states
- Color contrast ratios must meet WCAG AA standards
- Form elements require proper labels and error associations
- Use semantic HTML elements appropriately 