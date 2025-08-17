// Phase 1 Components - New Extractions
export { EventHeader } from './EventHeader';
export { GuestStatusCard } from './GuestStatusCard';
export { TabNavigation, type TabItem } from './TabNavigation';
export { ContextualActionBanner } from './ContextualActionBanner';

// Phase 2 Redesign Components
export { StaticEventHeader } from './StaticEventHeader';
export { EventSummaryCard } from './EventSummaryCard';
export { DashboardActions } from './DashboardActions';
export { EventDetailsEditor } from './EventDetailsEditor';

// Phase 3 Components - Enhanced Guest Management
export { GuestStatusSummary } from './GuestStatusSummary';
export { BulkActionShortcuts } from './BulkActionShortcuts';

// Existing Components
export { GuestManagement } from './GuestManagement';
export { GuestControlPanel } from './GuestControlPanel';

// Re-export messaging components from new location for backwards compatibility
export { 
  MessageCenter,
  MessageComposer
} from '../messaging/host';
export { EventAnalytics } from './EventAnalytics';
export { QuickActions } from './QuickActions';
export { NotificationCenter } from './NotificationCenter';
export { SMSAnnouncementModal } from './SMSAnnouncementModal';
