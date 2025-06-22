// Feature Components
export * from './auth';
export * from './events';
export * from './guests';
export * from './host-dashboard';
export * from './media';
export * from './messaging';
export * from './navigation';
export * from './scheduling';

// Lazy-loaded exports for heavy components
import { lazy } from 'react'

// Host Dashboard Components (heavy with charts, tables, etc.)
export const EventAnalytics = lazy(() => 
  import('./host-dashboard/EventAnalytics').then(module => ({ default: module.EventAnalytics }))
)
export const GuestManagement = lazy(() => 
  import('./host-dashboard/GuestManagement').then(module => ({ default: module.GuestManagement }))
)
export const MessageComposer = lazy(() => 
  import('./host-dashboard/MessageComposer').then(module => ({ default: module.MessageComposer }))
)
export const NotificationCenter = lazy(() => 
  import('./host-dashboard/NotificationCenter').then(module => ({ default: module.NotificationCenter }))
)
export const SMSAnnouncementModal = lazy(() => 
  import('./host-dashboard/SMSAnnouncementModal').then(module => ({ default: module.SMSAnnouncementModal }))
)

// Guest Components (media-heavy)
export const GuestImportWizard = lazy(() => 
  import('./guests/GuestImportWizard').then(module => ({ default: module.GuestImportWizard }))
)
export const GuestPhotoGallery = lazy(() => 
  import('./media/GuestPhotoGallery')
)

// Messaging Components
export const GuestMessaging = lazy(() => 
  import('./messaging/GuestMessaging')
)

// Development Components (only load in development)
export const RealtimeDebugger = lazy(() => 
  import('../dev/RealtimeDebugger').then(module => ({ default: module.RealtimeDebugger }))
)
export const TestUserCreator = lazy(() => 
  import('../dev/TestUserCreator').then(module => ({ default: module.TestUserCreator }))
)

// Lightweight components that can be imported directly
export { WelcomeBanner } from './events'
export { BottomNavigation, NavigationLayout, RoleSwitcher } from './navigation'
export { AuthSessionWatcher, LogoutButton, ProfileAvatar } from './auth'
export { QuickActions } from './host-dashboard'
export { EventSchedule } from './scheduling'
