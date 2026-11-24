const { getMasterBallBoostProfileUpdates } = require("./classicStats");

function createRouteDependencyGroups({
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
  generateSentryChallenge,
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
}) {
  const classicDependencies = {
    mergeClassicGuestState,
    classicVerifyGuess,
    classicGetShinyChance: classicStats.classicGetShinyChance,
    updateStatsOnClassicWin,
    classicGetRemainingTime: classicStats.classicGetRemainingTime,
    classicGetCurrentDate: classicStats.classicGetCurrentDate,
    classicShouldResetStreak: classicStats.classicShouldResetStreak,
    classicGetActiveBall: classicStats.classicGetActiveBall,
    classicGetStreakBall: classicStats.classicGetStreakBall,
  };
  const rankingDependencies = {
    ensureMonthlyRankingPeriod: rankingService.ensureMonthlyRankingPeriod,
    getRankingPeriod: rankingService.getRankingPeriod,
    getMonthlyRanking: rankingService.getMonthlyRanking,
    getCachedRanking: rankingService.getCachedRanking,
    rankingNotificationCollection: "rankingNotifications",
  };
  const sentryDependencies = {
    sentryStatsLimiter,
    sentryDurationMs,
    sentryFailureLimit,
    sentrySessionTtlMs,
    updateStatsOnSentryRound,
    randomUUID,
    generateSentryChallenge,
  };
  const shopDependencies = {
    shopLimiter,
    shopFields,
    shopBackgrounds,
    overlayItems,
    companionItems,
    boostItems,
    collectibleCatalog,
    verifyShopUserToken,
    getShopBackground: shopCatalogService.getShopBackground,
    getCollectible: shopCatalogService.getCollectible,
    getOwnedShopBackgrounds: shopCatalogService.getOwnedShopBackgrounds,
    getOwnedCollectibles: shopCatalogService.getOwnedCollectibles,
    getOwnedBoostInventory: shopCatalogService.getOwnedBoostInventory,
    getBoost: shopCatalogService.getBoost,
    profileBgPathSelector,
    classicGetCurrentDate: classicStats.classicGetCurrentDate,
    classicGetDaysBetween: classicStats.classicGetDaysBetween,
    classicGetDoubleEarningsUntilDate:
      classicStats.classicGetDoubleEarningsUntilDate,
    classicGetStreakBall: classicStats.classicGetStreakBall,
    isUserBoostActive: classicStats.isUserBoostActive,
    getMasterBallBoostProfileUpdates,
  };
  const userDependencies = {
    authLimiter,
    randomUUID,
    getShopBackground: shopCatalogService.getShopBackground,
    getCollectible: shopCatalogService.getCollectible,
    profileBgPathSelector,
  };
  const pokedexDependencies = {
    classicGetCurrentDate: classicStats.classicGetCurrentDate,
  };

  return {
    common: commonDependencies,
    classic: classicDependencies,
    ranking: rankingDependencies,
    sentry: sentryDependencies,
    shop: shopDependencies,
    user: userDependencies,
    pokedex: pokedexDependencies,
  };
}

module.exports = { createRouteDependencyGroups };
