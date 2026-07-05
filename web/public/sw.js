// Minimale service worker voor Kliko Cleaning Bonaire (PWA-installatie).
// Strategie, bewust conservatief zodat updates nooit blijven hangen:
//  - navigaties: network-first, bij offline een gecachte pagina of de app-shell "/";
//  - gehashte Next-assets (/_next/static) en iconen: cache-first (immutable);
//  - al het andere (Firestore, API's): niet aanraken, gewoon het netwerk.
// Bij een nieuwe versie: CACHE_NAAM ophogen; activate ruimt oude caches op.
const CACHE_NAAM = "kliko-cache-v1";
const APP_SHELL = ["/", "/icon-192.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAAM)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((namen) =>
        Promise.all(
          namen.filter((n) => n !== CACHE_NAAM).map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigaties: eerst het netwerk (altijd verse HTML), offline-fallback uit cache.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((antwoord) => {
          // Kopie van de app-shell verversen zodat de offline-fallback bijblijft.
          if (antwoord.ok && url.pathname === "/") {
            const kopie = antwoord.clone();
            caches.open(CACHE_NAAM).then((cache) => cache.put("/", kopie));
          }
          return antwoord;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached ?? (await caches.match("/")) ?? Response.error();
        })
    );
    return;
  }

  // Gehashte build-assets en iconen: cache-first (bestandsnaam verandert per build).
  const cacheFirst =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/icon-192.png" ||
    url.pathname === "/icon-512.png" ||
    url.pathname === "/icon.png" ||
    url.pathname === "/primary.png";
  if (cacheFirst) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((antwoord) => {
            if (antwoord.ok) {
              const kopie = antwoord.clone();
              caches.open(CACHE_NAAM).then((cache) => cache.put(request, kopie));
            }
            return antwoord;
          })
      )
    );
  }
  // Overige requests: niet afvangen (Firestore/analytics gaan rechtstreeks).
});
