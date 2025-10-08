'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './Providers';
import { LoadingSpinner } from '@/components/ui';
import { UnveilHeader } from '@/components/shared';
import { isIOSWebView, safeNavigate, ensureDOMReady, debugWebView, getIOSVersion } from '@/lib/ios-webview-compat';
import { webViewLogger } from '@/lib/webview-logger';

export default function HomePage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [debugInfo, setDebugInfo] = useState('Initializing...');

  useEffect(() => {
    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    // Debug WebView environment
    debugWebView();
    
    const load = async () => {
      try {
        // Log to native for debugging
        await webViewLogger.info('HomePage: Starting load process');
        
        // Ensure DOM is ready for iOS WebView
        await ensureDOMReady();
        
        const iosVersion = getIOSVersion();
        setDebugInfo(`iOS ${iosVersion}, Auth loading: ${loading}, Session: ${session ? 'exists' : 'none'}`);
        await webViewLogger.info(`iOS ${iosVersion}, Auth loading: ${loading}, Session exists: ${!!session}`);
        
        // Wait for auth to finish loading
        if (loading) {
          setDebugInfo('Waiting for authentication...');
          await webViewLogger.info('Waiting for authentication to complete');
          return;
        }

        setDebugInfo('Authentication complete, navigating...');
        await webViewLogger.info('Authentication complete, preparing navigation');
        
        // Short delay for iOS WebView stability
        await new Promise(resolve => {
          timeoutId = setTimeout(resolve, 200);
        });
        
        if (!isMounted) return;
        
        const targetRoute = session ? '/select-event' : '/login';
        setDebugInfo(`Navigating to: ${targetRoute}`);
        await webViewLogger.info(`Attempting navigation to: ${targetRoute}`);
        
        // Use iOS WebView-compatible navigation
        safeNavigate(router, targetRoute);
        
      } catch (error) {
        console.error('Navigation error:', error);
        await webViewLogger.error(`Navigation error: ${error}`);
        setDebugInfo(`Error: ${error}`);
        
        // Fallback to login
        if (isMounted) {
          await webViewLogger.info('Using fallback navigation to login');
          safeNavigate(router, '/login');
        }
      }
    };

    // iOS WebView fallback - force navigation after 4 seconds
    const fallbackTimeout = setTimeout(() => {
      if (isMounted) {
        console.log('iOS WebView fallback timeout - forcing navigation');
        setDebugInfo('Timeout - forcing navigation to login');
        safeNavigate(router, '/login');
      }
    }, 4000);

    load();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      clearTimeout(fallbackTimeout);
    };
  }, [loading, session, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-stone-50">
      <div className="text-center max-w-md mx-auto p-8">
        <UnveilHeader />
        <div className="mt-8">
          <LoadingSpinner />
          <p className="mt-4 text-sm text-stone-600">Loading Unveil...</p>
          
          {/* Debug info and manual navigation */}
          <div className="mt-6 p-4 bg-white rounded-lg shadow-sm border text-left">
            <p className="text-xs text-stone-500 font-mono mb-2">Debug Info:</p>
            <p className="text-xs text-stone-400">{debugInfo}</p>
            <p className="text-xs text-stone-300 mt-1">
              Environment: {typeof window !== 'undefined' ? 'Client' : 'Server'}
            </p>
            <p className="text-xs text-stone-300">
              iOS WebView: {isIOSWebView() ? 'Yes' : 'No'} (v{getIOSVersion()})
            </p>
            
            {/* Manual navigation buttons for testing */}
            <div className="mt-3 space-y-2">
              <button
                onClick={() => safeNavigate(router, '/login')}
                className="w-full text-xs bg-rose-500 text-white px-3 py-1 rounded hover:bg-rose-600"
              >
                Go to Login (Test)
              </button>
              <button
                onClick={() => window.location.href = '/login'}
                className="w-full text-xs bg-stone-500 text-white px-3 py-1 rounded hover:bg-stone-600"
              >
                Force Navigate to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}