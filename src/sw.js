const CACHE_PREFIX = 'cyberquest-';
// Increase the version when any precached game file changes.
const CACHE_NAME = CACHE_PREFIX + 'v1';
const scope = self.registration.scope;
const entry = new URL('index.html', scope).href;
const audio = new URL('audio/music.mp3', scope).href;
const files = new Set([
  entry, audio,
  ...[
    'style.css', 'mobile.css', 'webapp.js', 'game.js', 'world.js', 'sfx.js', 'content/pack.js',
    'manifest.webmanifest', 'img/logo.png', 'img/icon-192.png', 'img/icon-512.png',
    'img/ai-boy.jpg', 'img/ai-boy-2.jpg', 'img/real-picnic.jpg',
  ].map((file) => new URL(file, scope).href),
]);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) =>
    cache.addAll([...files].map((url) => new Request(url, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

// Mobile browsers can request byte ranges even when the full song is cached.
async function audioRange(response, range) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  const blob = await response.blob();
  const size = blob.size;
  const suffix = match?.[1] === '';
  const start = suffix ? Math.max(0, size - Number(match[2])) : Number(match?.[1]);
  const end = suffix || match?.[2] === '' ? size - 1 : Math.min(size - 1, Number(match?.[2]));
  if (!match || start > end || start >= size) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Content-Type': 'audio/mpeg',
    },
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  url.search = '';
  const key = request.mode === 'navigate' && url.href === scope ? entry : url.href;
  if (!files.has(key)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(key);
    if (!cached) return fetch(request);
    const range = request.headers.get('Range');
    return key === audio && range ? audioRange(cached, range) : cached;
  })());
});
