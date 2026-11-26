export const STORAGE_KEYS = Object.freeze({
  appVersion: "pokedle.cache.app-version",
  authState: "pokedleAuthState",
  accountRateLimit: "pokedleAccountRateLimitUntil",
  classicGameId: "gameID",
  classicState: "state",
  classicUserId: "userID",
  eventDismissals: "eventNotificationDismissals",
  musicPlayback: "pokedle.music-player",
  musicVolume: "pokedle.music-player.volume",
  musicPlaylist: "pokedle.cache:music-playlist",
  oakDanceVictoryGameId: "pokedle.classic-victory-game-id",
  rankingSeenIds: "pokedle.cache:ranking-notification-seen-ids",
  sentryMuted: "sentry-muted",
  shopFavorites: "pokedleShopFavorites",
});

export function getProfilePresetStorageKey(profileId) {
  return `pokedleProfilePresets:${profileId}`;
}
