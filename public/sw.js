// Memora service worker. Deliberately minimal: no offline cache yet (planned
// "later"), so every request goes to the network as usual. It exists so the app
// is installable and so web push (batch 7) can add "push" and
// "notificationclick" handlers here.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
