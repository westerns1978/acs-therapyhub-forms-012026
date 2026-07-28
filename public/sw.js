/**
 * SERVICE-WORKER KILL SWITCH (2026-07-28). Deliberately not a service worker.
 *
 * History: a cache-everything worker lived at the repo root (never copied into
 * dist/), so /sw.js was served as index.html by the SPA rewrite. Consequences:
 *  - New clients: registration failed silently on the MIME check (harmless).
 *  - Old clients that HAD registered the real worker in an earlier era could
 *    NEVER update it — the update fetch got HTML, failed, and the stale
 *    cacher persisted forever. That is the stale-shell-after-deploy landmine.
 *
 * This file exists (in public/, so it actually ships) purely so those old
 * clients' update checks SUCCEED and install this instead: it unregisters
 * itself and deletes every cache, then gets out of the way. index.html no
 * longer registers any worker.
 *
 * Do NOT reintroduce a caching service worker without an explicit update
 * strategy (versioned precache + skipWaiting + client reload prompt) — the
 * hosting layer already handles caching correctly (index.html no-cache,
 * hashed /assets immutable).
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      // Reload once so the page runs SW-free with the freshly-served shell.
      clients.forEach((c) => c.navigate(c.url));
    })()
  );
});
