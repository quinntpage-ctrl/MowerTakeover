// Service Worker for PWA functionality
const CACHE_NAME = 'mower-io-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through fetch for basic PWA installability.
  // In a real production app, you'd cache static assets here.
  event.respondWith(fetch(event.request));
});