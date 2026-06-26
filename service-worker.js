// Service Worker para D'Leia Comprovantes
// Versão do app — MUDE ESTE NÚMERO sempre que atualizar o app
const APP_VERSION = '5.41.0';
const CACHE_NAME = 'dleia-comprovante-' + APP_VERSION;

const ASSETS_TO_CACHE = [
  './app.html',
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

// Estratégia: só intercepta requisições do próprio app (GET, mesma origem).
// Chamadas para APIs externas (Claude, Evolution API) passam direto, sem cache,
// senão o navegador pode falhar ao tentar cachear POSTs ou recursos cross-origin.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Intercepta o POST de "compartilhar com o app" (Web Share Target)
  if (req.method === 'POST' && url.pathname.endsWith('/app.html')) {
    event.respondWith(handleShareTarget(event));
    return;
  }

  // Deixa passar direto: métodos diferentes de GET (POST/PUT/etc das APIs)
  // e requisições para outros domínios (api.anthropic.com, servidor Evolution API)
  if (req.method !== 'GET' || url.origin !== self.location.origin) {
    return; // não chama respondWith = o navegador faz a requisição normalmente
  }

  event.respondWith(
    fetch(req)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(req, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Sem internet: usa o que está salvo
        return caches.match(req);
      })
  );
});

// Recebe as fotos compartilhadas de outro app (Galeria, Google Fotos, etc),
// guarda temporariamente e redireciona para o app já sinalizando que há fotos esperando
async function handleShareTarget(event) {
  try {
    const formData = await event.request.formData();
    const arquivos = formData.getAll('fotos-compartilhadas');

    const db = await abrirBancoCompartilhamento();
    const tx = db.transaction('fotos', 'readwrite');
    const store = tx.objectStore('fotos');
    await store.clear();
    for (const arquivo of arquivos) {
      await store.add(arquivo);
    }

    return Response.redirect('./app.html?compartilhado=1', 303);
  } catch (e) {
    return Response.redirect('./app.html', 303);
  }
}

function abrirBancoCompartilhamento() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('comprovai-share', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('fotos', { autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Avisa o app quando há uma nova versão disponível
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
