const CACHE_NAME = "Pokédle-Cache";
const STATIC_CACHE_URLS = [
  "/views/offline.html",
  "/public/images/favicon.png",
  "/public/stylesheets/style.css",
  "/public/images/pokedle-logo.webp",
  "/public/images/background.webp",
];

self.addEventListener("install", (event) => {
  console.log("Service Worker installing.");
  event.waitUntil(
    // adds into cache the fallback page offline.html and everything else that the page needs to load properly
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_CACHE_URLS))
  );
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker activating.");
  // clear obsolete caches that are not "Pokédle-Cache"
  event.waitUntil(
    caches
      .keys()
      .then((keys) => keys.filter((key) => key !== CACHE_NAME))
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    // fetch handler, intercepts the request and checks if we have the resource requested in cache.
    // If we have it, we return it. Otherwise, the cached fallback page is returned instead.
    caches.match(event.request).then((cacheRes) => {
      return (
        cacheRes ||
        fetch(event.request).catch(() => caches.match("/views/offline.html"))
      );
    })
  );
});
