// sw.js — Eiti Wizard Service Worker v1.8.10
const CACHE_NAME = 'eiti-wizard-lab-v1.8.10-wm1'; // bump on every change to a cached static asset
const BASE_PATH = '/Eiti-Wizard-Lab';
// Research Index (navigation only, not runtime authority): served network-first so online clients get a fresh copy.
const RESEARCH_INDEX_PATH = BASE_PATH + '/docs/research/EXPERIMENT_EVIDENCE_INDEX.md';
// Network budget for the research index. Must stay SHORTER than the page-side budget in index.html (wizResearchIndexLoader)
// so a stalled connection reaches the cached fallback before the page gives up.
const RESEARCH_FETCH_TIMEOUT_MS = 4000;
// Minimal check before an index-like 200 may be cached (the strict parser in research-router.js remains the authority).
const looksLikeResearchIndex = text => typeof text === 'string' && /RESEARCH_INDEX_ONLY/.test(text) && /^## C\. /m.test(text);

const STATIC_ASSETS = [
  BASE_PATH + '/',
  BASE_PATH + '/index.html',
  BASE_PATH + '/manifest.json',
  BASE_PATH + '/wiz-ref-memory.js',
  BASE_PATH + '/working-memory.js',
  BASE_PATH + '/wm-agent-read.js',
  BASE_PATH + '/research-router.js',
  BASE_PATH + '/icon-48x48.png',
  BASE_PATH + '/icon-72x72.png',
  BASE_PATH + '/icon-96x96.png',
  BASE_PATH + '/icon-128x128.png',
  BASE_PATH + '/icon-144x144.png',
  BASE_PATH + '/icon-152x152.png',
  BASE_PATH + '/icon-180x180.png',
  BASE_PATH + '/icon-192x192.png',
  BASE_PATH + '/icon-256x256.png',
  BASE_PATH + '/icon-512x512.png',
];

// ── Install: кэшируем статику ──────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // cache:'reload' bypasses the HTTP cache: plain addAll() can precache stale scripts (e.g. max-age on static hosts)
      // right after a CACHE_NAME bump. Any failed asset still fails the install, like addAll.
      return Promise.all(STATIC_ASSETS.map(asset =>
        fetch(new Request(asset, { cache: 'reload' })).then(response => {
          if (!response || !response.ok) throw new TypeError('precache failed: ' + asset);
          return cache.put(asset, response);
        })));
    })
  );
  self.skipWaiting();
});

// ── Activate: удаляем старые кэши и захватываем клиентов ─────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k.startsWith('eiti-wizard-lab-') && k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: Network-first для index.html, cache-first для остального ────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // API-запросы к внешним провайдерам — только через сеть
  const apiHosts = ['api.deepseek.com', 'api.anthropic.com', 'api.openai.com',
                    'api.groq.com', 'openrouter.ai',
                    'generativelanguage.googleapis.com', // Gemini
                    'dashscope.aliyuncs.com',            // Qwen / Alibaba
                    'api.x.ai'];                         // Grok
  if (apiHosts.some(h => url.hostname.includes(h))) {
    return; // не перехватываем
  }

  // Ollama localhost — прямой проход (офлайн-режим)
  if (url.hostname === 'localhost' && url.port === '11434') {
    return;
  }

  // index.html, корень и manifest.json — network-first (чтобы обновления применялись сразу)
  if (url.pathname === BASE_PATH + '/' || url.pathname === BASE_PATH + '/index.html'
      || url.pathname === BASE_PATH + '/manifest.json') {
    event.respondWith(
      fetch(request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        return caches.match(request).then(cached => {
          if (cached) return cached;
          return caches.match(BASE_PATH + '/index.html').then(fallback => {
            return fallback || new Response('', { status: 504, statusText: 'Offline' });
          });
        });
      })
    );
    return;
  }

  // Research Index — online-first (exact path only): a fresh, valid network copy always beats the cache.
  //  - 200 that looks like the index -> served and cached (the write is held open with event.waitUntil)
  //  - 200 that does NOT look like the index (captive portal / proxy / CDN error page) -> NEVER cached, never overwrites the
  //    last known-good copy; a valid cached copy is served instead (flagged sw-stale-cache), else the body is passed through
  //    (the page-side parser then fails closed)
  //  - transport failure or timeout (RESEARCH_FETCH_TIMEOUT_MS) -> valid cached copy flagged sw-offline-cache, else 504
  //  - 5xx -> valid cached copy flagged sw-stale-cache, else the 5xx response
  //  - 404/410 (authoritative removal) and other 4xx -> passed through; the cached copy is evicted on 404/410
  // The strict parser (research-router.js) stays the runtime authority. Not precached; not runtime authority.
  if (url.pathname === RESEARCH_INDEX_PATH) {
    const flagged = (cached, value) => {
      const headers = new Headers(cached.headers);
      headers.set('X-Eiti-Served-From', value);
      return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers });
    };
    const cachedIndex = value => caches.open(CACHE_NAME).then(cache => cache.match(request)).then(cached => (cached ? flagged(cached, value) : null));
    event.respondWith((async () => {
      let response, text = null;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), RESEARCH_FETCH_TIMEOUT_MS);   // covers headers AND body of a 200
      try {
        response = await fetch(request, { cache: 'no-store', signal: controller.signal });
        if (response.status === 200) text = await response.text();
      } catch (_) {
        return (await cachedIndex('sw-offline-cache').catch(() => null)) || new Response('', { status: 504, statusText: 'Offline' });
      } finally { clearTimeout(timer); }
      if (response.status === 200) {
        const headers = new Headers({ 'Content-Type': response.headers.get('Content-Type') || 'text/markdown; charset=utf-8' });
        if (looksLikeResearchIndex(text)) {
          event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, new Response(text, { status: 200, headers }))).catch(() => {}));
          return new Response(text, { status: 200, headers });
        }
        return (await cachedIndex('sw-stale-cache').catch(() => null)) || new Response(text, { status: 200, headers });
      }
      if (response.status >= 500) return (await cachedIndex('sw-stale-cache').catch(() => null)) || response;
      if (response.status === 404 || response.status === 410) event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.delete(request)).catch(() => {}));
      return response;
    })());
    return;
  }

  // Остальная статика — cache first, fallback network
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => {
        if (request.mode === 'navigate') {
          return caches.match(BASE_PATH + '/index.html').then(cached => {
            return cached || new Response('', { status: 504, statusText: 'Offline' });
          });
        }
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});

// ── Background Sync — агент уведомляет о завершении задачи ────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'agent-task-complete') {
    event.waitUntil(notifyAgentComplete());
  }
});

async function notifyAgentComplete() {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => client.postMessage({ type: 'AGENT_COMPLETE' }));
}

// ── Push Notifications ────────────────────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || '⚡ Eiti Wizard', {
      body: data.body || 'Агент завершил задачу',
      icon: BASE_PATH + '/icon-192x192.png',
      badge: BASE_PATH + '/icon-96x96.png',
      vibrate: [200, 100, 200],
      tag: 'agent-notification',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      if (clients.length) return clients[0].focus();
      return self.clients.openWindow(BASE_PATH + '/');
    })
  );
});
