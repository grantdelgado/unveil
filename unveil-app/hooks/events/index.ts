// Modern event hooks (updated)
export { useHostEvents } from './useHostEvents';
export { useGuestEvents } from './useGuestEvents';

// New modern replacements for deprecated hooks
export { useEventWithGuest } from './useEventWithGuest';
export { useUserEvents } from './useUserEvents';
export { useEventAnalytics } from './useEventAnalytics';

// Event creation and management
// Moved to EventCreationService in lib/services/eventCreation.ts

// Legacy hooks removed:
// - useEventDetails (replaced by useEventWithGuest)
// - useEventInsights (replaced by useEventAnalytics)  
// - useUserEventsSorted (replaced by useUserEvents)
