// RSVP-Lite guest management hooks
export { useGuests } from './useGuests';
export { useGuestDecline } from './useGuestDecline';
export { useGuestRejoin } from './useGuestRejoin';
export { useHostGuestDecline } from './useHostGuestDecline';

// Legacy hook - still used by some components
export { useGuestData } from './useGuestData';

// Simplified guest store (primary hook for guest management)
export { useSimpleGuestStore } from './useSimpleGuestStore';

// Unified guest counts for dashboard consistency
export { useUnifiedGuestCounts } from './useUnifiedGuestCounts';

// Phase 3: Unified guest actions hook (feature flag controlled)
// TODO: Complete API alignment before enabling
// export { useGuestActions } from './useGuestActions';
// export type { UseGuestActionsOptions, GuestActionResult, UnifiedGuestActionsReturn } from './useGuestActions';
