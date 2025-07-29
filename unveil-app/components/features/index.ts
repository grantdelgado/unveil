/**
 * Feature Components Barrel - OPTIMIZED FOR TREE-SHAKING
 * 
 * WARNING: Wildcard exports can significantly bloat your bundle.
 * RECOMMENDED: Import components directly:
 * - import { LogoutButton } from '@/components/features/auth'
 * - import { GuestManagement } from '@/components/features/host-dashboard'
 * - import { GuestMessaging } from '@/components/features/messaging/guest'
 * 
 * Use this barrel only when importing multiple components from the same feature.
 */

// Most frequently used lightweight components (specific imports)
export { LogoutButton, ProfileAvatar } from './auth';
export { WelcomeBanner } from './events';
// Navigation components removed
export { QuickActions } from './host-dashboard';
export { EventSchedule } from './scheduling';

// Feature namespaces for multiple imports from same feature
export * as AuthComponents from './auth';
export * as EventComponents from './events';
export * as GuestComponents from './guests';
export * as HostDashboardComponents from './host-dashboard';
export * as MediaComponents from './media';
export * as MessagingComponents from './messaging';
// Navigation components removed
export * as SchedulingComponents from './scheduling';

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
  import('./messaging/host/MessageComposer').then(module => ({ default: module.MessageComposer }))
)
export const MessageCenter = lazy(() => 
  import('./messaging/host/MessageCenter').then(module => ({ default: module.MessageCenter }))
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
  import('./messaging/guest/GuestMessaging').then(module => ({ default: module.GuestMessaging }))
)

// Development Components (removed - not needed for production)
