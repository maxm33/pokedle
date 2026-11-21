const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const express = require("express");
const { createClient } = require("redis");
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const logger = require("morgan");
const createError = require("http-errors");
const packageJson = require("./package.json");
const axiosBundlePath = path.resolve(
  path.dirname(require.resolve("axios")),
  "..",
  "axios.min.js",
);
const badFootprints = require("./data/badFootprints.json");
const eventPokemonPool = require("./data/legendaryPokemon.json");
const classicStats = require("./lib/classicStats");
const shopCatalog = require("./lib/shopCatalog");
const rankingCache = require("./lib/rankingCache");
const registerClassicRoutes = require("./routes/classicRoutes");
const registerRankingRoutes = require("./routes/rankingRoutes");
const registerSentryRoutes = require("./routes/sentryRoutes");
const registerUserRoutes = require("./routes/userRoutes");
const registerPokedexRoutes = require("./routes/pokedexRoutes");
const registerShopRoutes = require("./routes/shopRoutes");
const registerCatalogRoutes = require("./routes/catalogRoutes");
const classicVerifyGuess = require("./lib/classicGame");
const createRankingService = require("./lib/rankingService");
const createGameStatsService = require("./lib/gameStatsService");
const createGameRuntime = require("./lib/gameRuntime");
const createRateLimiters = require("./lib/rateLimiters");
const createShopItems = require("./lib/shopItems");
const createShopServices = require("./lib/shopServices");
const createClassicGuestStateService = require("./lib/classicGuestStateService");

const {
  classicGetActiveBall,
  classicGetCurrentDate,
  classicGetDateTimeParts,
  classicGetDaysBetween,
  classicGetDoubleEarningsUntilDate,
  classicGetRemainingTime,
  classicGetShinyChance,
  classicGetStreakBall,
  classicShouldResetStreak,
  getMasterBallBoostProfileUpdates,
  isUserBoostActive,
} = classicStats;

// initialize Firebase with admin privileges
initializeApp({
  credential: applicationDefault(),
  projectId: process.env.PROJECT_ID,
});

// needed for client-side use only
const firebaseConfig = {
  apiKey: process.env.API_KEY,
  authDomain: process.env.AUTH_DOMAIN,
  projectId: process.env.PROJECT_ID,
  storageBucket: process.env.STORAGE_BUCKET,
  messagingSenderId: process.env.MESSAGING_SENDER_ID,
  appId: process.env.APP_ID,
  measurementId: process.env.MEASUREMENT_ID,
};

const gameState = {
  classicWinners: [],
  classicPlayerStates: new Map(),
  classicGameID: undefined,
  classicPreviousPokemon: undefined,
  classicCurrentPokemon: undefined,
  classicEventActive: false,
  classicDoubleEarningsEventActive: false,
  classicShinyEventActive: false,
  shopDiscounts: {},
  sentryChallenges: {},
  sentrySessions: new Map(),
  pokemonCache: new Map(),
  validSentryIds: [],
  bg_desktop_option: undefined,
  bg_mobile_option: undefined,
};
const bgPathSelector = (device) =>
  device === "phone"
    ? `/public/images/backgrounds_mobile/${gameState.bg_mobile_option}.webp`
    : `/public/images/backgrounds_desktop/${gameState.bg_desktop_option}.webp`;
const sentryDurationMs = 30 * 1000; // duration for each sentry guess
const sentryFailureLimit = 3;
const sentrySessionTtlMs = 60 * 60 * 1000;

const classicRankingCache = {
  ...rankingCache.createRankingCache(),
};
const sentryRankingCache = {
  ...rankingCache.createRankingCache(),
};
const rankingNotificationCollection = "rankingNotifications";
const {
  shopBackgrounds,
  overlayItems,
  companionItems,
  boostItems,
  collectibleCatalog,
} = createShopItems(__dirname);

// Background images per device type
const desktopBackgroundCount = fs.readdirSync(
  "./public/images/backgrounds_desktop",
).length; // number of desktop background options
const mobileBackgroundCount = fs.readdirSync(
  "./public/images/backgrounds_mobile",
).length; //number of mobile background options

const app = express(); // new express app
const auth = getAuth(); // reference to auth service
const firestore = getFirestore(); // reference to firestore cloud storage service
const {
  getCollectible,
  getOwnedBoostInventory,
  getOwnedCollectibles,
  getOwnedShopBackgrounds,
  getShopBackground,
  profileBgPathSelector,
  verifyShopUserToken,
} = createShopServices({
  auth,
  shopBackgrounds,
  collectibleCatalog,
  boostItems,
  bgPathSelector,
});
const rankingService = createRankingService({
  firestore,
  rankingCache,
  rankingNotificationCollection,
  classicGetDateTimeParts,
  classicGetCurrentDate,
  getOwnedBoostInventory,
  getMasterBallBoostProfileUpdates,
  randomUUID,
});
const {
  ensureMonthlyRankingPeriod,
  getCachedRanking,
  getMonthlyRanking,
  getRankingPeriod,
} = rankingService;
const { updateStatsOnClassicWin, updateStatsOnSentryRound } =
  createGameStatsService({
    firestore,
    rankingService,
    classicRankingCache,
    sentryRankingCache,
    classicStats,
    isClassicDoubleEarningsEventActive: () =>
      gameState.classicDoubleEarningsEventActive,
  });
const { mergeClassicGuestState } = createClassicGuestStateService({
  state: gameState,
  updateStatsOnClassicWin,
});
const rateLimitRedis = createClient({ url: process.env.REDIS_URL });
const appVersion = packageJson.version;
app.locals.appVersion = appVersion;

rateLimitRedis.on("error", (err) => {
  console.error("Shared rate-limit Redis connection error:", err);
});

let rateLimitRedisConnection;
async function initializeRateLimitStore() {
  if (!process.env.REDIS_URL)
    throw new Error("REDIS_URL must be configured for shared rate limiting");
  if (!rateLimitRedisConnection)
    rateLimitRedisConnection = rateLimitRedis.connect();
  await rateLimitRedisConnection;
}

const sendRateLimitRedisCommand = async (...args) => {
  await initializeRateLimitStore();
  return rateLimitRedis.sendCommand(args);
};
const {
  firestoreReadLimiter,
  shopLimiter,
  sentryStatsLimiter,
  authLimiter,
} = createRateLimiters(sendRateLimitRedisCommand);

const gameRuntime = createGameRuntime({
  state: gameState,
  firestore,
  badFootprints,
  eventPokemonPool,
  randomUUID,
  classicGetRemainingTime,
  sentryDurationMs,
  desktopBackgroundCount,
  mobileBackgroundCount,
  shopBackgrounds,
  overlayItems,
  companionItems,
  boostItems,
});

app.locals.initializeRateLimitStore = initializeRateLimitStore;
app.locals.initializeClassicGame = gameRuntime.initializeClassicGame;
app.locals.initializeMonthlyRankings = rankingService.initializeMonthlyRankings;

// EJS view engine setup
app.set("views", __dirname + "/views");
app.set("view engine", "ejs");

app.set("trust proxy", 3);

app.use(logger("dev"));
app.use(express.json());
app.use((req, res, next) => {
  const ua = req.headers["user-agent"] || "";
  req.device = {
    type: /Mobi|Android|iPhone|iPod|Windows Phone/i.test(ua)
      ? "phone"
      : "desktop",
  };
  next();
});

// Client app version check, ignores cache policies if not synchronized with server's
app.use((req, res, next) => {
  const clientVersion = req.headers["x-client-version"];

  if (
    req.path.startsWith("/public/") &&
    clientVersion &&
    clientVersion !== appVersion
  ) {
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }

  res.setHeader("X-App-Version", appVersion);
  next();
});

app.get("/vendor/axios.min.js", (req, res, next) => {
  res.sendFile(
    axiosBundlePath,
    { maxAge: "1y", immutable: true },
    (err) => {
      if (err) next(err);
    },
  );
});

// JS/CSS/assets cache control policies
app.use(
  "/public/js",
  express.static(__dirname + "/public/js", {
    setHeaders: function (res, _) {
      applyAssetCacheHeaders(res, 3600);
    },
  }),
);
app.use(
  "/public/stylesheets",
  express.static(__dirname + "/public/stylesheets", {
    setHeaders: function (res, _) {
      applyAssetCacheHeaders(res, 3600);
    },
  }),
);
app.use(
  "/public",
  express.static(__dirname + "/public", {
    setHeaders: function (res, _) {
      applyAssetCacheHeaders(res, 31536000);
    },
  }),
);

registerCatalogRoutes(app);

app.get("/app/version", (_, res) => {
  res.status(200);
  res.setHeader("X-App-Version", appVersion);
  res.send({ version: appVersion });
});

// send firebase configuration to client
app.get("/env/fb", (_, res) => {
  res.status(200);
  res.send(firebaseConfig);
});

// classic mode redirected as home page
app.get("/", (_, res) => {
  res.redirect("/classic");
});

const applyAssetCacheHeaders = (res, maxAge) => {
  res.setHeader("Cache-Control", `public, max-age=${maxAge}, must-revalidate`);
};

const routeState = gameState;

registerClassicRoutes(app, {
  auth,
  firestore,
  firestoreReadLimiter,
  createError,
  bgPathSelector,
  mergeClassicGuestState,
  classicVerifyGuess,
  pokemonCache: gameState.pokemonCache,
  classicGetShinyChance,
  updateStatsOnClassicWin,
  classicGetRemainingTime,
  classicGetCurrentDate,
  classicShouldResetStreak,
  classicGetActiveBall,
  classicGetStreakBall,
  state: routeState,
});
registerRankingRoutes(app, {
  auth,
  firestore,
  createError,
  ensureMonthlyRankingPeriod,
  getRankingPeriod,
  classicRankingCache,
  sentryRankingCache,
  getCachedRanking,
  getMonthlyRanking,
  bgPathSelector,
  rankingNotificationCollection,
});
registerSentryRoutes(app, {
  auth,
  createError,
  bgPathSelector,
  sentryStatsLimiter,
  sentryDurationMs,
  sentryFailureLimit,
  sentrySessionTtlMs,
  updateStatsOnSentryRound,
  randomUUID,
  generateSentryChallenge: gameRuntime.generateSentryChallenge,
  state: routeState,
});
registerUserRoutes(app, {
  randomUUID,
  auth,
  authLimiter,
  firestore,
  createError,
  firestoreReadLimiter,
  getShopBackground,
  getCollectible,
  profileBgPathSelector,
  bgPathSelector,
});
registerShopRoutes(app, {
  bgPathSelector,
  shopBackgrounds,
  overlayItems,
  companionItems,
  boostItems,
  collectibleCatalog,
  verifyShopUserToken,
  firestoreReadLimiter,
  shopLimiter,
  firestore,
  createError,
  classicGetCurrentDate,
  isUserBoostActive,
  classicGetDaysBetween,
  getOwnedShopBackgrounds,
  getShopBackground,
  getOwnedCollectibles,
  getOwnedBoostInventory,
  getCollectible,
  classicGetStreakBall,
  classicGetDoubleEarningsUntilDate,
  getOwnedCollectiblesField: shopCatalog.getOwnedCollectiblesField,
  getEquippedCollectibleField: shopCatalog.getEquippedCollectibleField,
  getMasterBallBoostProfileUpdates,
  state: routeState,
});
registerPokedexRoutes(app, {
  firestore,
  firestoreReadLimiter,
  createError,
  classicGetCurrentDate,
  bgPathSelector,
  state: routeState,
});

app.all("/*", (req, res, next) => {
  next(createError(404));
});

app.use(function (err, req, res, _) {
  res.locals.message = err.message;
  res.locals.error = err;
  res.status(err.status || 500);
  res.render("error", { bg: bgPathSelector(req.device.type) });
});

module.exports = app;
