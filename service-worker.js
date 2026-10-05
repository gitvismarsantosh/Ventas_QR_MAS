const CACHE_NAME = 'compras-q-v24';

// Imprescindibles: si alguno falla, la instalación falla y se conserva la versión anterior
const CORE = ['./', './index.html', './manifest.json'];
// Opcionales: si no se pueden descargar, la app funciona igual
const OPCIONALES = [
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js'
];

// Copia sin la marca "redirected": el navegador rechaza servir desde caché una navegación con esa marca
async function limpia(resp){
  if(!resp.redirected) return resp;
  const cuerpo = await resp.blob();
  return new Response(cuerpo, {status: resp.status, statusText: resp.statusText, headers: resp.headers});
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const url of CORE) {
      const resp = await fetch(new Request(url, {cache: 'reload'}));
      if (!resp.ok) throw new Error('No se pudo cachear ' + url + ' (' + resp.status + ')');
      await cache.put(url, await limpia(resp));
    }
    await Promise.all(OPCIONALES.map(async (url) => {
      try {
        const resp = await fetch(new Request(url, {cache: 'reload'}));
        if (resp.ok) await cache.put(url, resp);
      } catch (err) {
        console.warn('No se pudo cachear:', url, err);
      }
    }));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // Abrir la app (con o sin "index.html", con o sin parámetros): siempre desde el caché
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match('./index.html', {ignoreSearch: true});
      if (cached) return cached;
      try { return await fetch(request); } catch (err) { return Response.error(); }
    })());
    return;
  }

  // Resto de recursos: primero caché, luego red
  event.respondWith((async () => {
    const cached = await caches.match(request, {ignoreSearch: true});
    if (cached) return cached;
    try {
      const resp = await fetch(request);
      if (resp.ok || resp.type === 'opaque') {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, resp.clone());
      }
      return resp;
    } catch (err) {
      return Response.error();
    }
  })());
});
