import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Health Check - Unveil',
  description: 'Application health check endpoint',
  robots: 'noindex, nofollow',
};

/**
 * Minimal health check page for smoke testing
 * Used to verify deterministic first paint on iOS Simulator
 */
export default function HealthzPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 to-rose-50">
      <div className="text-center space-y-4">
        <div 
          data-testid="health-status" 
          className="text-2xl font-semibold text-stone-900"
        >
          ✅ Unveil is healthy
        </div>
        <div className="text-stone-600">
          First paint successful • iOS ready
        </div>
        <div className="text-xs text-stone-400 font-mono">
          {new Date().toISOString()}
        </div>
      </div>
    </div>
  );
}
