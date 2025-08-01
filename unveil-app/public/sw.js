/**
 * 🚀 WEEK 4 OPTIMIZATION: Service Worker for Unveil App
 * 
 * Provides:
 * - Aggressive caching for instant subsequent loads
 * - Offline functionality for core features
 * - Background sync for data synchronization
 * - Cache strategies optimized for wedding app usage
 */

const CACHE_VERSION = 'unveil-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const OFFLINE_CACHE = `${CACHE_VERSION}-offline`;

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/fonts/inter-variable.woff2',
  '/fonts/inter-variable-italic.woff2',
  '/offline.html',
  // Add critical assets
];

// Routes that should work offline
const OFFLINE_ROUTES = [
  '/select-event',
  '/profile',
  '/login',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('📱 Service Worker installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('📦 Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Error caching static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName.startsWith('unveil-') && 
                     !cacheName.includes(CACHE_VERSION);
            })
            .map((cacheName) => {
              console.log('🧹 Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        // Take control of all pages immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip external requests
  if (url.origin !== location.origin) {
    return;
  }
  
  event.respondWith(handleFetch(request));
});

/**
 * Handle fetch with appropriate caching strategy
 */
async function handleFetch(request) {
  const url = new URL(request.url);
  
  try {
    // Strategy 1: Cache-first for static assets
    if (isStaticAsset(url.pathname)) {
      return await cacheFirst(request, STATIC_CACHE);
    }
    
    // Strategy 2: Network-first for API calls
    if (url.pathname.startsWith('/api/')) {
      return await networkFirst(request, DYNAMIC_CACHE);
    }
    
    // Strategy 3: Stale-while-revalidate for pages
    if (isPageRequest(request)) {
      return await staleWhileRevalidate(request, DYNAMIC_CACHE);
    }
    
    // Default: Network-first
    return await networkFirst(request, DYNAMIC_CACHE);
    
  } catch (error) {
    console.error('❌ Fetch error:', error);
    
    // Return offline page for navigation requests
    if (isPageRequest(request)) {
      const offlineResponse = await caches.match('/offline.html');
      return offlineResponse || new Response('Offline', { status: 503 });
    }
    
    throw error;
  }
}

/**
 * Cache-first strategy for static assets
 */
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  const networkResponse = await fetch(request);
  const cache = await caches.open(cacheName);
  cache.put(request, networkResponse.clone());
  
  return networkResponse;
}

/**
 * Network-first strategy for dynamic content
 */
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Fall back to cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

/**
 * Stale-while-revalidate strategy for pages
 */
async function staleWhileRevalidate(request, cacheName) {
  const cachedResponse = await caches.match(request);
  
  // Always try to fetch fresh content in the background
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      const cache = caches.open(cacheName);
      cache.then(c => c.put(request, networkResponse.clone()));
    }
    return networkResponse;
  });
  
  // Return cached content immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Otherwise wait for network
  return await fetchPromise;
}

/**
 * Check if request is for a static asset
 */
function isStaticAsset(pathname) {
  return pathname.includes('.') && (
    pathname.endsWith('.js') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.woff2') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.svg')
  );
}

/**
 * Check if request is for a page navigation
 */
function isPageRequest(request) {
  return request.mode === 'navigate' || 
         request.headers.get('accept')?.includes('text/html');
}

// Background sync for offline data
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

/**
 * Handle background synchronization
 */
async function doBackgroundSync() {
  try {
    // Implement background sync logic for:
    // - RSVP updates
    // - Message sending
    // - Photo uploads
    console.log('🔄 Performing background sync...');
  } catch (error) {
    console.error('❌ Background sync failed:', error);
  }
}

console.log('📱 Unveil Service Worker loaded');