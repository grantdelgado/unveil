'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/app/Providers';
import { LoadingSpinner } from '@/components/ui';
import { UnveilHeader } from '@/components/shared';
import { isIOSWebView, getIOSVersion } from '@/lib/ios-webview-compat';

interface DevSplashProps {
  reason?: string;
}

/**
 * DEV-ONLY SPLASH SCREEN
 * Only shown when NEXT_PUBLIC_DEV_SPLASH=true
 * Provides debug information during development
 */
export function DevSplash({ reason = 'dev_splash' }: DevSplashProps) {
  const { session, loading } = useAuth();
  const [debugInfo, setDebugInfo] = useState('Initializing...');

  useEffect(() => {
    const updateDebugInfo = () => {
      const info = [
        `Reason: ${reason}`,
        `Auth: ${loading ? 'loading' : session ? 'authenticated' : 'unauthenticated'}`,
        `Environment: ${typeof window !== 'undefined' ? 'Client' : 'Server'}`,
        `iOS WebView: ${isIOSWebView() ? 'Yes' : 'No'} (v${getIOSVersion()})`,
        `Timestamp: ${new Date().toISOString()}`,
      ].join(' • ');
      
      setDebugInfo(info);
    };

    updateDebugInfo();
    const interval = setInterval(updateDebugInfo, 1000);
    
    return () => clearInterval(interval);
  }, [reason, session, loading]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-stone-50">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-semibold text-gray-800 tracking-tight">
            unveil
          </h1>
          <div className="w-20 h-px bg-gradient-to-r from-transparent via-rose-300 to-transparent mx-auto"></div>
        </div>

        <div className="mt-8">
          <div className="text-center">
            <LoadingSpinner />
            <p className="text-gray-500 text-base mt-4">Loading...</p>
          </div>

          <p className="mt-4 text-sm text-stone-600">Loading Unveil...</p>

          <div className="mt-6 p-4 bg-white rounded-lg shadow-sm border text-left">
            <p className="text-xs text-stone-500 font-mono mb-2">
              🧪 DEV SPLASH (NEXT_PUBLIC_DEV_SPLASH=true)
            </p>
            <p className="text-xs text-stone-400 font-mono">{debugInfo}</p>
            
            <div className="mt-3 space-y-2">
              <button
                onClick={() => window.location.href = '/login'}
                className="w-full text-xs bg-rose-500 text-white px-3 py-1 rounded hover:bg-rose-600"
              >
                Go to Login (Test)
              </button>
              <button
                onClick={() => window.location.href = '/select-event'}
                className="w-full text-xs bg-stone-500 text-white px-3 py-1 rounded hover:bg-stone-600"
              >
                Go to Select Event (Test)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
