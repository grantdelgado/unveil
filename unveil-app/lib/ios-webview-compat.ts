/**
 * iOS WebView Compatibility Layer
 * Purpose: Handle iOS WebView-specific issues and ensure reliable rendering
 */

// Detect iOS WebView environment (including iOS 26.0 detection)
export function isIOSWebView(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = window.navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(userAgent);
  const isWebView = !/Safari/.test(userAgent) && /WebKit/.test(userAgent);
  const isCapacitor = !!(window as any).Capacitor;
  
  return isIOS && (isWebView || isCapacitor);
}

// Detect iOS version for version-specific handling
export function getIOSVersion(): number | null {
  if (typeof window === 'undefined') return null;
  
  const userAgent = window.navigator.userAgent;
  const match = userAgent.match(/OS (\d+)_(\d+)/);
  if (match) {
    return parseInt(match[1]);
  }
  return null;
}

// iOS WebView-safe navigation with iOS 26.0 support
export function safeNavigate(router: any, path: string, fallbackDelay = 1000) {
  const iosVersion = getIOSVersion();
  const isWebView = isIOSWebView();
  
  console.log(`🧭 Navigation attempt: ${path} (iOS: ${iosVersion}, WebView: ${isWebView})`);
  
  if (isWebView || iosVersion >= 26) {
    // iOS 26.0+ or WebView: Use multiple navigation strategies
    console.log('Using iOS 26.0+ navigation strategy');
    
    // Strategy 1: Immediate window.location (most reliable)
    try {
      window.location.href = path;
    } catch (e) {
      console.warn('window.location failed:', e);
    }
    
    // Strategy 2: Router navigation with delay
    setTimeout(() => {
      try {
        router.replace(path);
      } catch (e) {
        console.warn('router.replace failed:', e);
      }
    }, 200);
    
    // Strategy 3: Force navigation if still on same page
    setTimeout(() => {
      if (window.location.pathname !== path) {
        console.log('Forcing navigation with window.location.replace');
        window.location.replace(path);
      }
    }, fallbackDelay);
  } else {
    // Standard web browser: Use Next.js router
    router.replace(path);
  }
}

// iOS WebView-safe timeout for async operations
export function webViewSafeTimeout<T>(
  promise: Promise<T>,
  timeoutMs = 5000,
  fallback?: () => T
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (fallback) {
        console.log('iOS WebView timeout - using fallback');
        resolve(fallback());
      } else {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

// Force DOM ready state for iOS WebView
export function ensureDOMReady(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }

    if (document.readyState === 'complete') {
      resolve();
    } else {
      const handler = () => {
        document.removeEventListener('DOMContentLoaded', handler);
        window.removeEventListener('load', handler);
        resolve();
      };
      
      document.addEventListener('DOMContentLoaded', handler);
      window.addEventListener('load', handler);
      
      // Fallback timeout
      setTimeout(handler, 2000);
    }
  });
}

// iOS WebView debugging helper
export function debugWebView() {
  if (typeof window === 'undefined') return;
  
  const debugInfo = {
    userAgent: navigator.userAgent,
    isIOSWebView: isIOSWebView(),
    iosVersion: getIOSVersion(),
    readyState: document.readyState,
    location: window.location.href,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    capacitor: !!(window as any).Capacitor,
    timestamp: new Date().toISOString(),
  };
  
  console.log('🔍 WebView Debug Info:', debugInfo);
  return debugInfo;
}
