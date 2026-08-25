// sw.js — Eiti Wizard Service Worker v1.8.4
const CACHE_NAME = 'eiti-wizard-v1.8.4';
const BASE_PATH = '/Eiti-Wizard';

const STATIC_ASSETS = [
  BASE_PATH + '/',
  BASE_PATH + '/index.html',
  BASE_PATH + '/manifest.json',
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
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ── Activate: удаляем старые кэши и захватываем клиентов ─────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
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
          return cached || caches.match(BASE_PATH + '/index.html');
        });
      })
    );
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
        if (request.mode === 'navigate') return caches.match(BASE_PATH + '/index.html');
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
