'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNavigationDebounce } from '@/lib/hooks/useNavigationDebounce';
import { useTransitionStore } from '@/lib/hooks/useTransitionStore';
import { useTransitionComplete } from '@/lib/hooks/useTransitionComplete';
import { 
  PageWrapper, 
  CardContainer, 
  PageTitle, 
  SubTitle, 
  PrimaryButton, 
  SecondaryButton,
  MicroCopy 
} from '@/components/ui';

export default function TestTransitionsPage() {
  const router = useRouter();
  const debouncedNav = useNavigationDebounce({ delay: 200 });
  const { forceComplete, setDebugMode, debugMode, isLoading, currentRoute, lastNavigationId } = useTransitionStore();
  const [slowLoadEnabled, setSlowLoadEnabled] = useState(false);
  
  // Ensure page transition completes when this component mounts
  useTransitionComplete();

  // Simulate slow loading
  React.useEffect(() => {
    if (slowLoadEnabled) {
      const start = Date.now();
      while (Date.now() - start < 2000) {
        // Blocking operation to simulate slow page
      }
      setSlowLoadEnabled(false);
    }
  }, [slowLoadEnabled]);

  const testRoutes = [
    { path: '/profile', label: 'Profile Page' },
    { path: '/select-event', label: 'Select Event' },
    { path: '/login', label: 'Login' },
    { path: '/setup', label: 'Setup' },
  ];

  const handleRapidNavigation = () => {
    // Test rapid navigation
    testRoutes.forEach((route, index) => {
      setTimeout(() => {
        debouncedNav.push(route.path);
      }, index * 50); // Very rapid clicks
    });
  };

  const handleSlowPageTest = () => {
    setSlowLoadEnabled(true);
    setTimeout(() => {
      router.push('/profile');
    }, 100);
  };

  return (
    <PageWrapper>
      <div className="max-w-2xl mx-auto space-y-6">
        <CardContainer>
          <div className="space-y-4">
            <PageTitle>Transition System Test</PageTitle>
            <SubTitle>Test the robustness of page transitions</SubTitle>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDebugMode(!debugMode)}
                  className={`px-3 py-2 rounded text-sm font-medium ${
                    debugMode 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  Debug Mode: {debugMode ? 'ON' : 'OFF'}
                </button>
                <MicroCopy>
                  Toggle to see transition logs in console and debug panel
                </MicroCopy>
              </div>
              
              {/* Real-time state display */}
              <div className="bg-gray-50 p-3 rounded text-sm space-y-1">
                <div className="font-medium text-gray-700">Current Transition State:</div>
                <div className={`font-mono ${isLoading ? 'text-red-600' : 'text-green-600'}`}>
                  Loading: {isLoading ? 'TRUE' : 'FALSE'}
                </div>
                {currentRoute && (
                  <div className="font-mono text-blue-600">
                    Target: {currentRoute}
                  </div>
                )}
                {lastNavigationId && (
                  <div className="font-mono text-purple-600">
                    Nav ID: {lastNavigationId}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContainer>

        <CardContainer>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Basic Navigation Tests</h3>
            <div className="grid grid-cols-2 gap-3">
              {testRoutes.map((route) => (
                <PrimaryButton
                  key={route.path}
                  onClick={() => router.push(route.path)}
                  className="text-sm"
                >
                  → {route.label}
                </PrimaryButton>
              ))}
            </div>
          </div>
        </CardContainer>

        <CardContainer>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Stress Tests</h3>
            
            <div className="space-y-3">
              <div>
                <PrimaryButton
                  onClick={handleRapidNavigation}
                  className="w-full"
                >
                  🚀 Rapid Navigation Test
                </PrimaryButton>
                <MicroCopy className="mt-1">
                  Triggers multiple quick navigations to test debouncing
                </MicroCopy>
              </div>

              <div>
                <PrimaryButton
                  onClick={handleSlowPageTest}
                  className="w-full"
                >
                  🐌 Slow Page Load Test
                </PrimaryButton>
                <MicroCopy className="mt-1">
                  Simulates a page that takes 2 seconds to load
                </MicroCopy>
              </div>

              <div>
                <SecondaryButton
                  onClick={() => {
                    // Test immediate cancellation
                    router.push('/profile');
                    setTimeout(() => router.back(), 100);
                  }}
                  className="w-full"
                >
                  ↩️ Quick Cancel Test
                </SecondaryButton>
                <MicroCopy className="mt-1">
                  Navigate and immediately go back to test cancellation
                </MicroCopy>
              </div>

              <div>
                <SecondaryButton
                  onClick={forceComplete}
                  className="w-full text-red-600 border-red-300"
                >
                  ⚠️ Force Complete Transition
                </SecondaryButton>
                <MicroCopy className="mt-1">
                  Manually complete any hanging transitions
                </MicroCopy>
              </div>
            </div>
          </div>
        </CardContainer>

        <CardContainer>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Expected Behaviors</h3>
            <div className="text-sm space-y-2 text-gray-600">
              <div>✅ <strong>Consistent spinner:</strong> All transitions show the same loading overlay</div>
              <div>✅ <strong>No hanging:</strong> Spinner never stays visible indefinitely</div>
              <div>✅ <strong>Debounced:</strong> Rapid clicks don&apos;t cause multiple navigations</div>
              <div>✅ <strong>Cancellable:</strong> Navigation can be interrupted gracefully</div>
              <div>✅ <strong>Timeout protection:</strong> Long loads auto-complete after 8 seconds</div>
              <div>✅ <strong>Same-page ignored:</strong> Navigation to current page is ignored</div>
            </div>
          </div>
        </CardContainer>

        <CardContainer>
          <div className="text-center">
            <SecondaryButton
              onClick={() => router.back()}
            >
              ← Back to Previous Page
            </SecondaryButton>
          </div>
        </CardContainer>
      </div>
    </PageWrapper>
  );
}
