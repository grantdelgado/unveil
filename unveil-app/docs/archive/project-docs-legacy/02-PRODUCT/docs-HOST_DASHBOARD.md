# Host Dashboard Documentation

## Overview

The Host Dashboard is the primary interface for wedding hosts to manage their events, guests, and communications. This document provides comprehensive documentation for all components, hooks, and patterns used in the dashboard.

## Architecture

### Component Structure

```
components/features/host-dashboard/
├── EventHeader.tsx           # Event details with gradient design
├── TabNavigation.tsx         # Tab switching with swipe support
├── GuestManagement.tsx       # Main guest management interface
├── GuestStatusSummary.tsx    # RSVP status filter pills
├── GuestStatusCard.tsx       # RSVP summary card
├── BulkActionShortcuts.tsx   # Quick action buttons
├── EnhancedMessageCenter.tsx # Main messaging interface
├── MessageComposer.tsx       # Message composition form
├── MessageTemplates.tsx      # Pre-built message templates
├── RecipientPresets.tsx      # Audience targeting filters
├── RecentMessages.tsx        # Message history display
├── QuickMessageActions.tsx   # Quick messaging shortcuts
├── NotificationCenter.tsx    # System notifications
└── index.ts                  # Component exports
```

### Custom Hooks

```
hooks/common/
├── useHapticFeedback.ts     # Mobile haptic feedback
├── useSwipeGesture.ts       # Touch gesture detection
├── usePullToRefresh.ts      # Pull-to-refresh functionality
└── useDebounce.ts           # Input debouncing
```

## Component API Reference

### EventHeader

Displays event information with a beautiful gradient background and host badge.

**Props:**

```typescript
interface EventHeaderProps {
  event: {
    name: string;
    date: string;
    location?: string;
  };
  participantCount: number;
  isHost: boolean;
  children?: React.ReactNode; // For QuickActions
  className?: string;
}
```

**Usage:**

```tsx
<EventHeader
  event={eventData}
  participantCount={participants.length}
  isHost={true}
>
  <QuickMessageActions onAction={handleQuickMessage} />
</EventHeader>
```

**Features:**

- Purple-to-coral gradient background
- Responsive layout (mobile-first)
- Host crown badge (👑)
- Participant count display
- Support for child components

### TabNavigation

Enhanced tab navigation with swipe gesture support and badge indicators.

**Props:**

```typescript
interface TabNavigationProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabKey: string) => void;
  className?: string;
}

interface TabItem {
  key: string;
  label: string;
  icon: string;
  badge?: number;
  disabled?: boolean;
}
```

**Usage:**

```tsx
const tabs = [
  { key: 'guests', label: 'Guests', icon: '👥', badge: pendingCount },
  { key: 'messages', label: 'Messages', icon: '💬' },
];

<TabNavigation
  tabs={tabs}
  activeTab={currentTab}
  onTabChange={setCurrentTab}
/>;
```

**Features:**

- Swipe gesture navigation (mobile)
- Badge support for notifications
- Disabled state handling
- Coral accent colors
- Keyboard accessibility

### GuestManagement

Main component for managing event participants with filtering, search, and bulk actions.

**Props:**

```typescript
interface GuestManagementProps {
  eventId: string;
  onGuestUpdated?: () => void;
  onImportGuests?: () => void;
  onSendMessage?: (messageType: 'reminder') => void;
}
```

**Usage:**

```tsx
<GuestManagement
  eventId={eventId}
  onGuestUpdated={refetchData}
  onImportGuests={openImportWizard}
  onSendMessage={handleQuickMessage}
/>
```

**Features:**

- Real-time search with 300ms debouncing
- RSVP status filtering via pills
- Bulk selection and actions
- Pull-to-refresh support
- Haptic feedback on actions
- Optimistic RSVP updates
- Mobile-optimized card layout

### EnhancedMessageCenter

Unified messaging interface combining composition, templates, and history.

**Props:**

```typescript
interface EnhancedMessageCenterProps {
  eventId: string;
  participants: Participant[];
  onMessageSent?: () => void;
  className?: string;
}
```

**Usage:**

```tsx
<EnhancedMessageCenter
  eventId={eventId}
  participants={participants}
  onMessageSent={refetchMessages}
/>
```

**Features:**

- Compose/History toggle interface
- Template integration with auto-fill
- Recipient targeting with context
- Real-time participant counts
- Success animations with haptic feedback

### MessageComposer

Message composition form with template support and validation.

**Props:**

```typescript
interface MessageComposerProps {
  eventId: string;
  participants: Participant[];
  selectedTemplate?: MessageTemplate | null;
  selectedRecipientFilter?: RecipientFilter;
  onMessageSent?: () => void;
  onClear?: () => void;
  className?: string;
}
```

**Usage:**

```tsx
<MessageComposer
  eventId={eventId}
  participants={participants}
  selectedTemplate={template}
  selectedRecipientFilter="pending"
  onMessageSent={handleSent}
/>
```

**Features:**

- 500 character limit with visual feedback
- Template auto-fill with cursor positioning
- Recipient context display
- Haptic feedback on validation/success
- Mobile-optimized textarea
- Enhanced button interactions

## Custom Hooks Documentation

### useHapticFeedback

Provides cross-platform haptic feedback for mobile devices.

**API:**

```typescript
const { triggerHaptic, isSupported } = useHapticFeedback();

// Trigger different patterns
triggerHaptic('light'); // 10ms single pulse
triggerHaptic('medium'); // 20ms single pulse
triggerHaptic('heavy'); // 30ms single pulse
triggerHaptic('success'); // 10-10-10ms triple pulse
triggerHaptic('warning'); // 20-20ms double pulse
triggerHaptic('error'); // 30-10-30ms error pattern
```

**Usage:**

```tsx
const { triggerHaptic } = useHapticFeedback();

const handleRSVPUpdate = () => {
  triggerHaptic('light'); // Immediate feedback
  // ... update logic
  triggerHaptic('success'); // Success feedback
};
```

### useSwipeGesture

Detects touch-based swipe gestures for navigation and interactions.

**API:**

```typescript
const { attachSwipeListeners } = useSwipeGesture({
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  onSwipeUp: () => void,
  onSwipeDown: () => void,
  minSwipeDistance: 50, // minimum px to trigger
  maxSwipeTime: 500     // maximum ms for gesture
});
```

**Usage:**

```tsx
const containerRef = useRef<HTMLDivElement>(null);
const { attachSwipeListeners } = useSwipeGesture({
  onSwipeLeft: () => nextTab(),
  onSwipeRight: () => prevTab(),
  minSwipeDistance: 60,
});

useEffect(() => {
  return attachSwipeListeners(containerRef.current);
}, [attachSwipeListeners]);
```

### usePullToRefresh

Implements native mobile pull-to-refresh functionality.

**API:**

```typescript
const {
  isPulling,
  pullDistance,
  isRefreshing,
  canRefresh,
  attachPullToRefreshListeners
} = usePullToRefresh({
  onRefresh: async () => void,
  pullThreshold: 60,
  refreshThreshold: 80,
  disabled: false
});
```

**Usage:**

```tsx
const containerRef = useRef<HTMLDivElement>(null);
const pullToRefresh = usePullToRefresh({
  onRefresh: async () => {
    await refetchData();
    triggerHaptic('success');
  },
});

useEffect(() => {
  return pullToRefresh.attachPullToRefreshListeners(containerRef.current);
}, [pullToRefresh]);
```

### useDebounce

Debounces rapidly changing values to optimize performance.

**API:**

```typescript
const debouncedValue = useDebounce(value, delay);
```

**Usage:**

```tsx
const [searchTerm, setSearchTerm] = useState('');
const debouncedSearchTerm = useDebounce(searchTerm, 300);

// Use debouncedSearchTerm for filtering to avoid excessive renders
const filteredResults = useMemo(() => {
  return data.filter((item) =>
    item.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()),
  );
}, [data, debouncedSearchTerm]);
```

## Design System Integration

### Colors

- **Primary Accent**: `#FF6B6B` (coral) - buttons, focus rings, active states
- **Background**: `#fdfffc` (off-white) - main background
- **Text**: `#333333` - primary text color
- **Muted**: `#888888` - secondary text

### Touch Targets

- **Minimum**: 44px height for all interactive elements
- **Optimal**: 48px+ for primary actions
- **Spacing**: 8px minimum between touch targets

### Typography

- **Font**: Inter (system fallback: -apple-system, system-ui)
- **Base Size**: 16px (1rem) for body text
- **Line Height**: 1.6 for readability

### Animations

- **Duration**: 150-200ms for interactions
- **Easing**: `ease-out` for natural feel
- **Reduced Motion**: Respects `prefers-reduced-motion: reduce`

## Accessibility Features

### WCAG 2.1 AA Compliance

- **Color Contrast**: 4.5:1 minimum for normal text
- **Focus Indicators**: 2px coral outline with 2px offset
- **ARIA Labels**: Comprehensive labeling for screen readers
- **Keyboard Navigation**: Full keyboard accessibility

### Screen Reader Support

```tsx
// Example ARIA usage
<button
  aria-label={`Mark ${participant.name} as attending`}
  aria-pressed={isAttending}
  role="button"
>
  ✅ Attending
</button>
```

### Motion Preferences

- Automatic animation disable for `prefers-reduced-motion: reduce`
- Essential feedback maintained (haptics, visual states)
- Smooth degradation without breaking functionality

## Performance Optimizations

### React Optimizations

- **useMemo**: Expensive calculations (filtering, sorting)
- **useCallback**: Event handlers and functions passed to children
- **React.memo**: Individual guest cards and template items
- **Debouncing**: Search inputs to reduce re-renders

### Bundle Optimization

- **Code Splitting**: Route-level splitting for dashboard pages
- **Tree Shaking**: Only used components included in build
- **Dynamic Imports**: Heavy components loaded on demand

### Runtime Performance

- **Virtualization**: Large guest lists (100+ participants)
- **Intersection Observer**: Lazy loading of off-screen content
- **RequestAnimationFrame**: Smooth animations and scrolling

## Testing Strategies

### Unit Testing

```tsx
// Example test for GuestManagement
import { render, screen, fireEvent } from '@testing-library/react';
import { GuestManagement } from './GuestManagement';

test('filters guests by RSVP status', () => {
  render(<GuestManagement eventId="test" />);

  fireEvent.click(screen.getByText('Attending'));
  expect(screen.getByText('John Doe')).toBeInTheDocument();
  expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
});
```

### Integration Testing

- **Supabase Integration**: Mock database calls
- **Real-time Updates**: Test subscription handling
- **Error States**: Network failures and recovery

### E2E Testing

- **Mobile Devices**: iOS Safari, Android Chrome
- **Gesture Testing**: Swipe navigation, pull-to-refresh
- **Accessibility**: Screen reader compatibility

## Best Practices

### Component Development

1. **Start Mobile-First**: Design for mobile, enhance for desktop
2. **Accessibility by Default**: Include ARIA labels and keyboard support
3. **Performance Conscious**: Use React.memo and hooks appropriately
4. **Error Boundaries**: Wrap components in error boundaries
5. **TypeScript**: Strong typing for all props and state

### State Management

1. **Local State**: Use useState for component-specific state
2. **Shared State**: Props drilling for parent-child communication
3. **Optimistic Updates**: Update UI immediately, rollback on error
4. **Error Handling**: Graceful degradation and user feedback

### Styling

1. **Utility-First**: Tailwind CSS for consistency
2. **Responsive Design**: Mobile-first with desktop enhancements
3. **Design Tokens**: Use CSS custom properties for theming
4. **Animation**: Respect user motion preferences

## Troubleshooting

### Common Issues

**Swipe Gestures Not Working**

- Ensure touch events are not prevented by parent elements
- Check minimum swipe distance and timing thresholds
- Verify passive event listeners are properly attached

**Haptic Feedback Silent**

- Check device support with `isSupported` flag
- Ensure user has enabled vibration in device settings
- Test on physical device (not simulator/emulator)

**Pull-to-Refresh Conflicts**

- Disable native browser pull-to-refresh if needed
- Check scroll position detection logic
- Verify preventDefault is called appropriately

**Performance Issues**

- Check for unnecessary re-renders with React DevTools
- Verify debouncing is working for search inputs
- Consider virtualization for large lists (100+ items)

### Debug Mode

Enable debug logging for custom hooks:

```tsx
// Add to your component for debugging
useEffect(() => {
  if (process.env.NODE_ENV === 'development') {
    console.log('GuestManagement render:', {
      participants: participants.length,
      filtered: filteredParticipants.length,
      searchTerm: debouncedSearchTerm,
    });
  }
}, [participants, filteredParticipants, debouncedSearchTerm]);
```

## Deployment Checklist

### Pre-deployment

- [ ] All Lighthouse scores ≥95% accessibility, ≥85% performance
- [ ] Cross-browser testing complete (Chrome, Safari, Firefox)
- [ ] Mobile device testing on iOS and Android
- [ ] Error boundaries implemented and tested
- [ ] Analytics and monitoring configured

### Production Monitoring

- [ ] Performance monitoring for Core Web Vitals
- [ ] Error tracking for JavaScript exceptions
- [ ] User feedback collection for UX issues
- [ ] A/B testing setup for feature iterations

---

_Last updated: January 17, 2025_
_Version: 1.0.0 (MVP Release)_
