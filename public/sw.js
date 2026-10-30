/* Free Life Collective service worker: shows push notifications and keeps the app-icon number up to date. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { /* plain text push */ }
  const title = d.title || "Free Life Collective";
  event.waitUntil((async () => {
    await self.registration.showNotification(title, {
      body: d.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: d.tag,
      data: { url: d.url || "/notifications" },
      silent: false,
      vibrate: [200, 100, 200],
    });
    if (typeof d.badge === "number" && self.navigator && "setAppBadge" in self.navigator) {
      try { await self.navigator.setAppBadge(d.badge); } catch { /* not supported here */ }
    }
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if ("focus" in c) { await c.focus(); if ("navigate" in c) { try { await c.navigate(url); } catch { /* cross-origin */ } } return; }
    }
    await self.clients.openWindow(url);
  })());
});
