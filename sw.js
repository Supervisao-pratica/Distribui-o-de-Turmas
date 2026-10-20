const CACHE = 'sgt-v126';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Firebase e bibliotecas externas cuidam do proprio transporte/cache.
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('firebaseio.com')
  ) {
    return;
  }

  // Toda navegacao busca primeiro a versao publicada mais recente.
  // Se estiver offline, abre a ultima versao salva no cache.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put('./index.html', copy));
          }
          return response;
        })
        .catch(async () => {
          return (
            await caches.match('./index.html') ||
            await caches.match('./') ||
            Response.error()
          );
        })
    );
    return;
  }

  // Arquivos locais: usa cache e atualiza silenciosamente pela rede.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const networkRequest = fetch(event.request)
          .then(response => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then(cache => cache.put(event.request, copy));
            }
            return response;
          })
          .catch(() => cached);

        return cached || networkRequest;
      })
    );
  }
});
