/**
 * 🚀 WEEK 4 OPTIMIZATION: Service Worker Implementation
 * 
 * Service Worker setup for offline support and aggressive caching:
 * - Instant subsequent loads through aggressive caching
 * - Offline functionality for critical app features
 * - Background sync for data synchronization
 * - Cache-first strategy for static assets
 * - Network-first strategy for dynamic data
 * 
 * Expected Impact:
 * - 90% faster return visits (cached resources)
 * - Offline capability for core features
 * - Better user experience on poor networks
 * - Reduced server load and bandwidth usage
 */

interface ServiceWorkerConfig {
  cacheVersion: string;
  staticAssets: string[];
  dynamicRoutes: string[];
  offlineRoutes: string[];
}

// Service Worker configuration for Unveil app
export const swConfig: ServiceWorkerConfig = {
  cacheVersion: 'unveil-v1',
  staticAssets: [
    // Critical app shell assets
    '/',
    '/manifest.json',
    '/fonts/inter-variable.woff2',
    '/fonts/inter-variable-italic.woff2',
    // Add other static assets
  ],
  dynamicRoutes: [
    // API routes to cache
    '/api/auth/check-user',
    // Add other dynamic routes
  ],
  offlineRoutes: [
    // Pages that work offline
    '/select-event',
    '/profile',
    // Add other offline-capable routes
  ],
};

/**
 * Register service worker for production builds
 */
export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  return new Promise((resolve) => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('📱 Service Worker registered successfully:', registration);
          resolve(registration);
        })
        .catch((error) => {
          console.error('❌ Service Worker registration failed:', error);
          resolve(null);
        });
    } else {
      resolve(null);
    }
  });
}

/**
 * Update service worker when new version is available
 */
export function updateServiceWorker(registration: ServiceWorkerRegistration): Promise<boolean> {
  return new Promise((resolve) => {
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New service worker is available
            console.log('🔄 New app version available');
            resolve(true);
          }
        });
      }
    });
  });
}

/**
 * Clear service worker cache (for development)
 */
export async function clearServiceWorkerCache(): Promise<void> {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
    console.log('🧹 Service Worker cache cleared');
  }
}

// Export for Next.js app integration
const serviceWorkerModule = {
  register: registerServiceWorker,
  update: updateServiceWorker,
  clear: clearServiceWorkerCache,
  config: swConfig,
};

export default serviceWorkerModule;