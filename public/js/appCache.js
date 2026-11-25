export const APP_CACHE_PREFIX = "pokedle.cache:";

export function getAppVersion() {
  return (
    document
      .querySelector('meta[name="app-version"]')
      ?.getAttribute("content") || "unknown"
  );
}

export function invalidateAppCaches() {
  const appVersion = getAppVersion();
  const versionKey = "pokedle.cache.app-version";
  const preservedKeys = new Set([
    versionKey,
    "pokedle.music-player.volume",
    "sentry-muted",
    "pokedleShopFavorites",
  ]);
  const preservedPrefixes = ["pokedleProfilePresets:"];

  try {
    const cachedAppVersion = localStorage.getItem(versionKey);
    if (cachedAppVersion === appVersion) return;

    const preservedValues = new Map();
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (
        key &&
        (preservedKeys.has(key) ||
          preservedPrefixes.some((prefix) => key.startsWith(prefix)))
      ) {
        preservedValues.set(key, localStorage.getItem(key));
      }
    }

    localStorage.clear();
    sessionStorage.clear();
    preservedValues.forEach((value, key) => localStorage.setItem(key, value));
    localStorage.setItem(versionKey, appVersion);
  } catch (error) {
    console.error("Could not invalidate application caches.", error);
  }
}

invalidateAppCaches();
