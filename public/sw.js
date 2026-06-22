/**
 * TKDL Service Worker
 * Enables:
 * - Offline functionality
 * - App shell caching (for tablets too)
 * - Background sync
 * - Proper PWA installation on Android/iOS/iPad
 */

const CACHE_NAME = 'tkdl-v1';
const RUNTIME_CACHE = 'tkdl-runtime-v1';
const API_CACHE = 'tkdl-api-v1';

// Assets to cache on install (app shell)
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/styles/responsive.css',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

/**
 * INSTALL EVENT
 * Cache critical assets needed for app to work offline
 */
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching app shell');
        // Don't fail if some assets are missing (they might not exist in dev)
        return Promise.allSettled(
          PRECACHE_ASSETS.map(url => cache.add(url))
        );
      })
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

/**
 * ACTIVATE EVENT
 * Clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !name.includes(CACHE_NAME.split('-')[0]))
          .map((name) => {
            console.log('Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

/**
 * FETCH EVENT
 * Network-first strategy with fallback to cache
 * Different handling for different request types
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests (other domains)
  if (url.origin !== location.origin) {
    return;
  }

  // API requests - Network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    return event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful responses
          if (response.status === 200) {
            const cache_clone = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, cache_clone);
            });
          }
          return response;
        })
        .catch(() => {
          // Return cached API response if offline
          return caches.match(request).then((response) => {
            return response || new Response(
              JSON.stringify({ error: 'Offline - cached data unavailable' }),
              { 
                status: 503,
                statusText: 'Service Unavailable',
                headers: new Headers({ 'Content-Type': 'application/json' })
              }
            );
          });
        })
    );
  }

  // HTML/JS/CSS - Cache first, network fallback
  if (
    request.headers.get('accept')?.includes('text/html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css')
  ) {
    return event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            return response;
          }
          
          // Not in cache, try network
          return fetch(request)
            .then((response) => {
              // Cache successful responses
              if (response.status === 200) {
                const cache_clone = response.clone();
                const cache_name = url.pathname.endsWith('.js') || url.pathname.endsWith('.css')
                  ? RUNTIME_CACHE
                  : CACHE_NAME;
                
                caches.open(cache_name).then((cache) => {
                  cache.put(request, cache_clone);
                });
              }
              return response;
            })
            .catch(() => {
              // Network failed, show offline fallback
              if (request.headers.get('accept')?.includes('text/html')) {
                return new Response(
                  `
                    <!DOCTYPE html>
                    <html>
                      <head>
                        <title>Offline - TKDL</title>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1">
                        <style>
                          body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            height: 100vh;
                            margin: 0;
                            background: #080612;
                            color: #fff;
                          }
                          .offline-container {
                            text-align: center;
                            padding: 20px;
                          }
                          h1 { font-size: 24px; margin: 0 0 10px 0; }
                          p { font-size: 14px; color: rgba(255,255,255,0.7); }
                          .emoji { font-size: 48px; margin-bottom: 20px; }
                        </style>
                      </head>
                      <body>
                        <div class="offline-container">
                          <div class="emoji">📡</div>
                          <h1>You're Offline</h1>
                          <p>TKDL is loaded in your cache. Some features may be limited.</p>
                          <p>Check your internet connection and refresh.</p>
                        </div>
                      </body>
                    </html>
                  `,
                  { 
                    status: 503,
                    headers: new Headers({ 'Content-Type': 'text/html' })
                  }
                );
              }
              return null;
            });
        })
    );
  }

  // Images and other assets - Cache first, network fallback
  return event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          return response;
        }
        
        return fetch(request)
          .then((response) => {
            // Cache images for offline access
            if (response.status === 200 && request.url.match(/\.(png|jpg|jpeg|gif|svg)$/i)) {
              const cache_clone = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => {
                cache.put(request, cache_clone);
              });
            }
            return response;
          })
          .catch(() => {
            // Return placeholder for missing images
            if (request.url.match(/\.(png|jpg|jpeg|gif)$/i)) {
              return new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#1a1a2e" width="100" height="100"/></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            }
            return null;
          });
      })
  );
});

/**
 * MESSAGE EVENT
 * Handle messages from the app
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Handle cache clear request
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((cacheNames) => {
      Promise.all(cacheNames.map((name) => caches.delete(name)));
    });
  }

  // Handle version check
  if (event.data && event.data.type === 'CHECK_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

/**
 * PERIODIC BACKGROUND SYNC (for tablets with battery)
 * Sync data when back online
 */
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'sync-matches') {
      event.waitUntil(syncMatches());
    }
    if (event.tag === 'sync-stats') {
      event.waitUntil(syncStats());
    }
  });
}

async function syncMatches() {
  try {
    const response = await fetch('/api/matches/recent');
    if (response.ok) {
      console.log('Synced matches');
    }
  } catch (err) {
    console.error('Failed to sync matches:', err);
  }
}

async function syncStats() {
  try {
    const response = await fetch('/api/players/me/stats');
    if (response.ok) {
      console.log('Synced stats');
    }
  } catch (err) {
    console.error('Failed to sync stats:', err);
  }
}
