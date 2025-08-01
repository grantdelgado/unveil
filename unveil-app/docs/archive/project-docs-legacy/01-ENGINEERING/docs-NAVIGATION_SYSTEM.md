# Navigation System Documentation

## Overview

The Unveil app now features a comprehensive, role-aware bottom navigation system that provides intuitive navigation for both hosts and guests while making the user's current context absolutely clear.

## 🎯 Key Features

### **Context-Aware Navigation**

- **Role Detection**: Automatically determines if user is host or guest for current event
- **Visual Differentiation**: Host mode uses purple gradient, guest mode uses rose gradient
- **Clear Mode Indicators**: Prominent "HOST MODE" or "GUEST MODE" badges with role icons (👑/🎊)
- **Event Context**: Shows current event title in navigation header

### **Role-Specific Navigation Items**

#### **Host Navigation**

```
🏠 Dashboard  |  👥 Guests  |  💬 Messages  |  🎉 Schedule  |  👤 Profile
```

- **Dashboard**: Event overview and analytics (tab: overview)
- **Guests**: Guest management and RSVP tracking (tab: guests)
- **Messages**: Message composer and SMS tools (tab: messages)
- **Schedule**: Sub-event management (tab: events)
- **Profile**: User settings and event switching

#### **Guest Navigation**

```
🎉 Event  |  📸 Photos  |  💬 Chat  |  👥 Guests  |  👤 Profile
```

- **Event**: Event details and RSVP management
- **Photos**: Media gallery and photo uploads
- **Chat**: Event messaging and announcements
- **Guests**: Other attendees and networking
- **Profile**: Personal settings

### **Advanced Features**

- **Role Switcher**: Dropdown to switch between events where user has different roles
- **Badge Notifications**: Red badges for unread messages, pending RSVPs
- **Tab Synchronization**: Bottom nav syncs with dashboard tab state
- **Safe Area Support**: Proper spacing for devices with home indicators
- **Smart Hiding**: Automatically hides on login, registration, and creation pages

## 🏗 Architecture

### **Components**

#### **BottomNavigation.tsx**

- Main navigation component with role-aware rendering
- Handles navigation logic and active state detection
- Manages tab switching for host dashboard
- Features role-specific styling and layouts

#### **NavigationLayout.tsx**

- Layout wrapper that provides navigation context
- Automatically adds bottom padding when navigation is visible
- Handles loading states and conditional rendering

#### **RoleSwitcher.tsx**

- Dropdown component for switching between user's events
- Shows user's role in each event (host/guest)
- Provides quick access to events where user has multiple roles

#### **useNavigation.ts**

- Custom hook for extracting navigation context from URL
- Determines user role and event details
- Provides loading states and error handling

### **Integration Points**

#### **Root Layout Integration**

```tsx
<NavigationLayout>
  <ProfileAvatar />
  {children}
</NavigationLayout>
```

#### **Host Dashboard Integration**

- Syncs tab state with bottom navigation
- Dispatches events for navigation updates
- Listens for navigation-triggered tab changes

## 🎨 Design System

### **Visual Hierarchy**

1. **Role Indicator Header**: Clear mode identification
2. **Navigation Items**: Consistent icon + label pattern
3. **Active States**: White overlay for current section
4. **Badges**: Red notification indicators

### **Color Coding**

- **Host Mode**: Purple to rose gradient (`from-purple-600 to-rose-600`)
- **Guest Mode**: Rose to pink gradient (`from-rose-500 to-pink-500`)
- **Role Badges**: Matching background colors with dark text
- **Active Items**: White overlay with full opacity
- **Inactive Items**: 70% opacity with hover effects

### **Responsive Design**

- **Mobile-First**: Optimized for touch interaction
- **Safe Areas**: Supports iPhone home indicator
- **Adaptive Layout**: Adjusts based on content and device
- **Smooth Transitions**: 200ms transition on all interactive elements

## 🔄 Navigation Flow

### **Host Journey**

1. **Dashboard** → Overview with key metrics and quick actions
2. **Guests** → Manage guest list, RSVPs, bulk operations
3. **Messages** → Send announcements, schedule messages
4. **Schedule** → Manage sub-events (rehearsal, ceremony, etc.)
5. **Profile** → Account settings, switch events

### **Guest Journey**

1. **Event** → View details, RSVP, event schedule
2. **Photos** → Upload and browse event media
3. **Chat** → Communicate with other guests and hosts
4. **Guests** → See who's attending, contact info
5. **Profile** → Personal settings, switch events

## 🛠 Technical Implementation

### **State Management**

- **Local State**: Navigation context and user role
- **URL Parameters**: Tab state persistence
- **Event System**: Custom events for component communication
- **Real-time Updates**: Role and event data refresh

### **Performance Optimizations**

- **Conditional Rendering**: Only loads relevant navigation
- **Lazy Imports**: Components loaded on demand
- **Memoization**: Prevents unnecessary re-renders
- **Smart Caching**: Role and event data caching

### **Error Handling**

- **Graceful Degradation**: Falls back to no navigation if errors
- **Role Detection Errors**: Safe defaults and error logging
- **Network Resilience**: Handles offline scenarios

## 🧪 Testing Scenarios

### **Role Detection**

- ✅ Host accessing their own event
- ✅ Guest accessing event they're invited to
- ✅ User with no role (unauthorized access)
- ✅ User who is both host and guest in different events

### **Navigation Behavior**

- ✅ Tab switching in host dashboard
- ✅ Cross-event navigation via role switcher
- ✅ Back button handling and URL state
- ✅ Deep linking to specific tabs

### **Visual States**

- ✅ Host mode purple gradient and crown icon
- ✅ Guest mode rose gradient and party icon
- ✅ Active/inactive navigation items
- ✅ Badge notifications and counts

## 📱 Mobile Experience

### **Touch Interactions**

- **Tap Targets**: Minimum 44px touch targets
- **Haptic Feedback**: Subtle feedback on navigation
- **Gesture Support**: Swipe gestures (future enhancement)
- **Accessibility**: Screen reader and keyboard support

### **Performance**

- **Smooth Animations**: Hardware-accelerated transitions
- **Fast Navigation**: Instant feedback on tap
- **Loading States**: Skeleton screens during navigation
- **Offline Support**: Cached navigation state

## 🚀 Future Enhancements

### **Planned Features**

1. **Real-time Badges**: Live notification counts
2. **Gesture Navigation**: Swipe between tabs
3. **Contextual Actions**: Long-press for quick actions
4. **Keyboard Shortcuts**: Desktop navigation shortcuts
5. **Accessibility**: Enhanced screen reader support

### **Advanced Functionality**

1. **Multi-Event Switching**: Quick access to all user events
2. **Notification Center**: Centralized alerts and updates
3. **Quick Actions**: Floating action button for common tasks
4. **Search Integration**: Global search from navigation
5. **Analytics**: Navigation usage tracking

## 💡 Best Practices

### **Development**

- Always test with both host and guest roles
- Verify navigation state after route changes
- Test role switcher with multiple events
- Ensure proper cleanup of event listeners

### **Design**

- Maintain consistent icon usage across navigation
- Keep navigation items concise and clear
- Use badges sparingly to avoid visual clutter
- Test on various device sizes and safe areas

### **UX**

- Make role context immediately obvious
- Provide clear feedback for navigation actions
- Ensure navigation doesn't block content
- Test with users who have multiple roles

---

**Implementation Status**: ✅ Complete and Production Ready

The navigation system provides a solid foundation for user interaction while maintaining clarity about context and role. The role-aware design ensures users always understand their current mode and have access to the most relevant actions.
