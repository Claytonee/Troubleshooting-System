/**
 * Service worker — offline-first shell, offline-readable guides, queued writes.
 * Design: docs/features/02-offline-pwa.md
 *
 * The cache name carries the same version string index.html uses on its
 * ?v=NN asset URLs, so bumping that one number also retires every cache and a
 * deploy can never leave a client running a half-old shell.
 */
const VERSION = 'v37';
const SHELL_CACHE = `oe-shell-${VERSION}`;
const DATA_CACHE = `oe-data-${VERSION}`;

/**
 * Precached on install. Anything the app needs to boot with no network at all.
 * Kept deliberately short — bandwidth is the scarce resource here.
 */
const SHELL = [
  '/',
  `/css/variables.css?v=${VERSION.slice(1)}`,
  `/css/base.css?v=${VERSION.slice(1)}`,
  `/css/components.css?v=${VERSION.slice(1)}`,
  '/manifest.webmanifest',
  '/icons/oe-mark.svg',
  '/fonts/axiforma-semi-bold.woff2'
];

/**
 * API reads worth keeping. Guides and manuals are the offline manual — they are
 * exactly what is needed when the network is down, which is also when they
 * would otherwise be unreachable.
 */
const CACHEABLE_API = [
  /^\/api\/guides/,
  /^\/api\/manuals/,
  /^\/api\/settings/,
  // The school list is reference data the report form cannot be filled without.
  // Testing offline with only a network-first copy left the dropdown empty and
  // the form unsubmittable — the exact case this feature exists for.
  /^\/api\/schools$/
];

/** Reads that may be served stale, but only with an explicit "as of" stamp. */
const STALE_OK_API = [/^\/api\/errors/, /^\/api\/dashboard/, /^\/api\/schools\//];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // addAll is atomic: one 404 would fail the whole install and leave the
    // client with no worker, so add individually and tolerate misses.
    await Promise.all(SHELL.map(url =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, DATA_CACHE]);
    await Promise.all((await caches.keys()).map(k => keep.has(k) ? null : caches.delete(k)));
    await self.clients.claim();
  })());
});

/** The page asks for the version so it can show which shell it is running. */
self.addEventListener('message', event => {
  if (event.data === 'version' && event.source) event.source.postMessage({ swVersion: VERSION });
});

/**
 * Background Sync. The worker cannot replay the queue itself: the JWT lives in
 * the page's localStorage, which is unreachable from here, and copying a token
 * into the worker to avoid that would be worse than the limitation. So it asks
 * an open client to flush. With no client open, nothing happens now — the
 * queue drains on next app open, which Offline.init() already does.
 */
self.addEventListener('sync', event => {
  if (event.tag !== 'oe-flush-queue') return;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(c => c.postMessage({ action: 'flush-queue' }));
  })());
});

const matches = (patterns, path) => patterns.some(re => re.test(path));

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;               // writes are queued by the page, not here
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;    // never cache Cloudinary or CDN bytes

  // Navigations: serve the cached shell when the network fails, so the app
  // boots offline instead of showing the browser's error page.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match('/')) || Response.error();
      }
    })());
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    if (matches(CACHEABLE_API, url.pathname)) {
      event.respondWith(staleWhileRevalidate(request));
    } else if (matches(STALE_OK_API, url.pathname)) {
      event.respondWith(networkFirstStamped(request));
    }
    return;                                            // everything else stays online-only
  }

  event.respondWith(cacheFirst(request));              // shell assets
});

/** Shell: cache wins, network fills gaps and refreshes in the background. */
async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(request, { ignoreSearch: false });
  if (hit) return hit;
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    // A versioned asset URL missed the cache; try ignoring the ?v= query.
    return (await cache.match(request, { ignoreSearch: true })) || Response.error();
  }
}

/** Guides and manuals: instant from cache, refreshed for next time. */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DATA_CACHE);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then(res => { if (res.ok) cache.put(request, res.clone()); return res; })
    .catch(() => null);
  if (hit) return hit;
  return (await network) || Response.error();
}

/**
 * Lists and dashboards: live data preferred. A cached fallback is served with
 * an `X-OE-Cached-At` header so the page can label it — a dashboard silently
 * showing yesterday's counts is worse than one that will not load.
 */
async function networkFirstStamped(request) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) {
      const stamped = new Response(res.clone().body, {
        status: res.status, statusText: res.statusText,
        headers: new Headers([...res.headers.entries(), ['X-OE-Cached-At', new Date().toISOString()]])
      });
      cache.put(request, stamped);
    }
    return res;
  } catch {
    const hit = await cache.match(request);
    return hit || Response.error();
  }
}
