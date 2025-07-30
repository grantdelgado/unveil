// Modern event hooks (updated)
export { useHostEvents } from './useHostEvents';
export { useGuestEvents } from './useGuestEvents';

// New modern replacements for deprecated hooks
export { useEventWithGuest } from './useEventWithGuest';
export { useUserEvents } from './useUserEvents';
export { useEventAnalytics } from './useEventAnalytics';

// Event creation and management
export { useEventCreation } from './useEventCreation';
export type { EventFormData, EventFormErrors, UseEventCreationReturn } from './useEventCreation';

// Legacy hooks removed:
// - useEventDetails (replaced by useEventWithGuest)
// - useEventInsights (replaced by useEventAnalytics)  
// - useUserEventsSorted (replaced by useUserEvents)
