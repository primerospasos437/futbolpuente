/**
 * Service worker — prioridad red; HTML con no-cache para evitar index viejo en el navegador.
 * Al desplegar, Vite pone `?v=...` en la URL del SW para forzar descarga del script nuevo.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((n) => n.startsWith("futbol-puente-")).map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const req =
    event.request.mode === "navigate"
      ? new Request(event.request, { cache: "no-cache" })
      : event.request;

  event.respondWith(
    fetch(req).catch(() => caches.match(event.request)),
  );
});
