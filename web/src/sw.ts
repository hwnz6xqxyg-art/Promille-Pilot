/**
 * Service worker — offline-first app shell.
 * __CACHE_NAME__ and __PRECACHE__ are injected by build.mjs (esbuild define),
 * so every deploy gets a fresh cache and old ones are purged on activate.
 */
declare const __CACHE_NAME__: string;
declare const __PRECACHE__: string[];

// Minimal SW typings (tsconfig uses the DOM lib; WebWorker lib would conflict).
interface ExtendableEvent extends Event {
  waitUntil(p: Promise<unknown>): void;
}
interface FetchEventLike extends ExtendableEvent {
  request: Request;
  respondWith(r: Promise<Response> | Response): void;
}
interface SWScope {
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  addEventListener(type: string, listener: (event: never) => void): void;
}

const sw = self as unknown as SWScope;

sw.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .open(__CACHE_NAME__)
      .then((cache) => cache.addAll(__PRECACHE__))
      .then(() => sw.skipWaiting()),
  );
});

sw.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith('pp-web-') && k !== __CACHE_NAME__).map((k) => caches.delete(k))),
      )
      .then(() => sw.clients.claim()),
  );
});

sw.addEventListener('fetch', (event: FetchEventLike) => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith(location.origin)) return;
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ??
        fetch(req).catch(() => {
          if (req.mode === 'navigate') {
            return caches.match('./index.html').then((page) => page ?? Response.error());
          }
          return Response.error();
        }),
    ),
  );
});
