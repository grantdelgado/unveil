import { EventSelectionClient } from '@/components/features/event-selection/EventSelectionClient';

/**
 * Select Event Page - Optimized for Core Web Vitals
 * 
 * Performance optimizations:
 * - Server component wrapper for faster initial render
 * - Client interactivity isolated to minimal component
 * - Critical path optimization for mobile LCP
 */
export default function SelectEventPage() {
  return <EventSelectionClient />;
}
