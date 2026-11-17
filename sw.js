// Painel Bôdhi: service worker mínimo, só para o painel poder ser instalado como app.
// Ele NÃO guarda arquivos do painel: tudo continua vindo da internet, então cada versão nova
// publicada chega na hora, igual ao site. A única coisa guardada é a tela "sem internet".
// Só mexe na abertura do painel (/ e /index.html). A página do cliente (aprovar.html), o
// relatório público, o Supabase e os vídeos passam direto, como se este arquivo não existisse.
const OFFLINE = 'painel-offline-1';
const PAGINA = 'offline.html';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(OFFLINE).then((c) => c.add(PAGINA)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== OFFLINE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.mode !== 'navigate') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname !== '/' && url.pathname !== '/index.html') return;
  e.respondWith(fetch(req).catch(() => caches.match(PAGINA)));
});
