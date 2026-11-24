const { randomUUID } = require("crypto");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const createError = require("http-errors");
const packageJson = require("../package.json");
const badFootprints = require("../data/badFootprints.json");
const eventPokemonPool = require("../data/legendaryPokemon.json");
const classicStats = require("./classicStats");
const shopCatalog = require("./shopCatalog");
const createRankingService = require("./rankingService");
const createGameStatsService = require("./gameStatsService");
const createGameRuntime = require("./gameRuntime");
const createRateLimiters = require("./rateLimiters");
const createShopItems = require("./shopItems");
const createShopServices = require("./shopServices");
const createClassicGuestStateService = require("./classicGuestStateService");
const classicVerifyGuess = require("./classicGame");
const createAppState = require("./appState");
const shopFields = require("../data/shopFields.json");
const createRateLimitRedisStore = require("./rateLimitRedisStore");
const {
  createFirebaseConfig,
  initializeFirebase,
  resolveAxiosBundlePath,
} = require("./appBootstrap");
const {
  createRouteDependencyGroups,
} = require("./appCompositionSections");
const { countBackgroundImages } = require("./backgroundCatalog");

function createAppComposition(rootDirectory, env) {
  initializeFirebase(env.PROJECT_ID);

  const firebaseConfig = createFirebaseConfig(env);
  const axiosBundlePath = resolveAxiosBundlePath();
  const appVersion = packageJson.version;
  const auth = getAuth();
  const firestore = getFirestore();
  const state = createAppState();
  const {
    shopBackgrounds,
    overlayItems,
    companionItems,
    boostItems,
    collectibleCatalog,
  } = createShopItems(rootDirectory);

  const bgPathSelector = (device) =>
    device === "phone"
      ? `/public/images/backgrounds_mobile/${state.bg_mobile_option}.webp`
      : `/public/images/backgrounds_desktop/${state.bg_desktop_option}.webp`;

  const desktopBackgroundCount = countBackgroundImages(
    rootDirectory,
    "backgrounds_desktop",
  );
  const mobileBackgroundCount = countBackgroundImages(
    rootDirectory,
    "backgrounds_mobile",
  );

  const shopCatalogService = shopCatalog.createShopCatalogService({
    shopBackgrounds,
    collectibleCatalog,
    boostItems,
  });
  const { getOwnedBoostInventory, getShopBackground } = shopCatalogService;
  const { profileBgPathSelector, verifyShopUserToken } = createShopServices({
    auth,
    bgPathSelector,
    getShopBackground,
  });

  const rankingService = createRankingService({
    firestore,
    rankingNotificationCollection: "rankingNotifications",
    classicGetDateTimeParts: classicStats.classicGetDateTimeParts,
    classicGetCurrentDate: classicStats.classicGetCurrentDate,
    getOwnedBoostInventory,
    getMasterBallBoostProfileUpdates:
      classicStats.getMasterBallBoostProfileUpdates,
    randomUUID,
  });
  const { updateStatsOnClassicWin, updateStatsOnSentryRound } =
    createGameStatsService({
      firestore,
      rankingService,
      classicStats,
      isClassicDoubleEarningsEventActive: () =>
        state.classicDoubleEarningsEventActive,
    });
  const { mergeClassicGuestState } = createClassicGuestStateService({
    state,
    updateStatsOnClassicWin,
  });

  const rateLimitRedisStore = createRateLimitRedisStore(env);
  const initializeRateLimitStore = rateLimitRedisStore.initialize;
  const sendRateLimitRedisCommand = rateLimitRedisStore.sendCommand;
  const {
    firestoreReadLimiter,
    shopLimiter,
    sentryStatsLimiter,
    authLimiter,
  } = createRateLimiters(sendRateLimitRedisCommand);

  const sentryDurationMs = 30 * 1000;
  const sentryFailureLimit = 3;
  const sentrySessionTtlMs = 60 * 60 * 1000;
  const gameRuntime = createGameRuntime({
    state,
    firestore,
    badFootprints,
    eventPokemonPool,
    randomUUID,
    classicGetRemainingTime: classicStats.classicGetRemainingTime,
    sentryDurationMs,
    desktopBackgroundCount,
    mobileBackgroundCount,
    shopBackgrounds,
    overlayItems,
    companionItems,
    boostItems,
  });

  const commonDependencies = {
    createError,
    auth,
    firestore,
    firestoreReadLimiter,
    bgPathSelector,
    state,
  };
  const routeDependencies = createRouteDependencyGroups({
    commonDependencies,
    mergeClassicGuestState,
    classicVerifyGuess,
    classicStats,
    updateStatsOnClassicWin,
    rankingService,
    sentryStatsLimiter,
    sentryDurationMs,
    sentryFailureLimit,
    sentrySessionTtlMs,
    updateStatsOnSentryRound,
    randomUUID,
    generateSentryChallenge: gameRuntime.generateSentryChallenge,
    shopLimiter,
    shopFields,
    shopBackgrounds,
    overlayItems,
    companionItems,
    boostItems,
    collectibleCatalog,
    verifyShopUserToken,
    shopCatalogService,
    profileBgPathSelector,
    authLimiter,
  });

  return {
    appVersion,
    firebaseConfig,
    axiosBundlePath,
    bgPathSelector,
    initializeRateLimitStore,
    closeRateLimitRedisStore: rateLimitRedisStore.close,
    initializeClassicGame: gameRuntime.initializeClassicGame,
    stopScheduledClassicGeneration: gameRuntime.stopScheduledClassicGeneration,
    initializeMonthlyRankings: rankingService.initializeMonthlyRankings,
    stopMonthlyRankingReset: rankingService.stopMonthlyRankingReset,
    routeDependencies,
  };
}

module.exports = createAppComposition;
