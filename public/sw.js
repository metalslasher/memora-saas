// Memora service worker. Deliberately minimal: no offline cache yet (planned
// "later"), so every request goes to the network as usual. It keeps the app
// installable and shows the daily reminder (web push, /api/cron/reminders).
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Payload: { title, body, url }. One notification per day is sent by the server;
// the tag makes a repeated one replace the previous instead of stacking.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Not JSON: fall back to a generic text below.
  }
  const title = typeof data.title === "string" && data.title ? data.title : "Memora";
  const body = typeof data.body === "string" && data.body ? data.body : "Час потренувати слова.";
  const url = typeof data.url === "string" && data.url.startsWith("/app") ? data.url : "/app";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/pwa/icon-192.png",
      badge: "/pwa/icon-192.png",
      tag: "memora-reminder",
      data: { url },
    }),
  );
});

// A tap opens (or focuses) the practice screen.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/app";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
