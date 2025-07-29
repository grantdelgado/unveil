'use client';

import { EventDashboard } from '@/components/features/EventDashboard';
import { Button, LoadingSpinner, useToast } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardPage() {
  const { isAuthenticated, loading, user, signOut } = useAuth();
  const router = useRouter();
  const { ToastContainer } = useToast();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, loading, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to home
  }

  // Sample event ID for MVP demo
  const sampleEventId = 'sample-event-123';

  return (
    <div className="h-screen">
      <div className="absolute top-4 right-4 z-10">
        <Button variant="outline" onClick={handleSignOut} size="sm">
          Sign Out
        </Button>
      </div>

      <EventDashboard />

      {/* Development info */}
      <div className="absolute bottom-4 left-4 bg-white border rounded-lg p-3 text-xs text-gray-500 shadow-sm">
        <p>
          <strong>Phase 3 Complete!</strong>
        </p>
        <p>User: {user?.phone || user?.user_metadata?.phone}</p>
        <p>Event ID: {sampleEventId}</p>
      </div>

      <ToastContainer />
    </div>
  );
}
