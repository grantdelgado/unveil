/**
 * MessageCenter Module Exports
 * 
 * Clean export interface for the MessageCenter feature components.
 * Provides both individual components and the main container for flexibility.
 */

// Main component - use this in most cases
export { MessageCenterContainer } from './MessageCenterContainer';

// Individual components - use these for custom composition
export { MessageCenterView } from './MessageCenterView';
export { MessageCenterTabs } from './MessageCenterTabs';

// Hook - use this for custom container components
export { useMessageCenter } from './useMessageCenter';

// Types - use these for TypeScript support
export type {
  Guest,
  Message,
  ActiveView,
  MessageCenterState,
  MessageCenterActions,
  UseMessageCenterReturn
} from './useMessageCenter';

// Main export alias for backward compatibility
export { MessageCenterContainer as MessageCenter } from './MessageCenterContainer'; 