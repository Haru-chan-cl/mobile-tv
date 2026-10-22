// Service worker simple. Guarda en caché SOLO los archivos de la propia app, para que la lista de canales
// se vea sin internet. Nunca toca YouTube ni ningún sitio externo, y nunca guarda live-ids.json.

const CACHE = 'canales-v6';

// Lista cerrada: solo estos archivos propios se guardan.
const ASSETS = [
  './',
  'index.html',
  'instalar.html',
  'css/styles.css',
  'css/instalar.css',
  'design/tokens.css',
  'fonts/barlow-condensed-500.woff2',
  'fonts/barlow-condensed-600.woff2',
  'fonts/noto-sans-jp-variable.woff2',
  'js/app.js',
  'js/data.js',
  'js/favorites.js',
  'js/player.js',
  'js/register-sw.js',
  'js/tabs.js',
  'channels.json',
  'manifest.webmanifest',
  'icons/favicon.svg',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

const assetUrls = new Set(ASSETS.map((asset) => new URL(asset, self.location).href));

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Todo lo que no sea de la propia app (YouTube, fuentes, sitios oficiales) pasa directo, sin caché.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Los IDs de vivo cambian: siempre se piden frescos y nunca se guardan.
  if (url.pathname.endsWith('/live-ids.json')) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  // Cualquier otro archivo que no esté en la lista tampoco se guarda.
  const isNavigation = request.mode === 'navigate';
  if (!isNavigation && !assetUrls.has(url.href)) return;

  // Primero internet (así los cambios llegan apenas hay conexión); si no hay, lo guardado.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && assetUrls.has(url.href)) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      // Sin internet: lo guardado; y para una página con otra dirección (por ejemplo con parámetros), la raíz de la app.
      // Se usa './' y no 'index.html' porque algunos servidores redirigen index.html, y el navegador no acepta
      // una respuesta redirigida como página.
      .catch(() => caches.match(request).then((saved) => saved || (isNavigation ? caches.match('./') : Response.error())))
  );
});
