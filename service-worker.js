// Service Worker para D'Leia Comprovantes
// Versão do app — MUDE ESTE NÚMERO sempre que atualizar o app
const APP_VERSION = '1.1.2';
const CACHE_NAME = 'dleia-comprovante-' + APP_VERSION;

const ASSETS_TO_CACHE = [
  './dleia_comprovante.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Instala e guarda os arquivos em cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Remove caches antigos quando uma nova versão é ativada
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Estratégia: tenta buscar na rede primeiro (pra pegar versão nova),
// se não conseguir (offline) usa o cache salvo
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Atualiza o cache com a versão mais recente
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Sem internet: usa o que está salvo
        return caches.match(event.request);
      })
  );
});

// Avisa o app quando há uma nova versão disponível
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
