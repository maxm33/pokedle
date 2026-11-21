const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");
const ejs = require("ejs");
const createGameRuntime = require("../lib/gameRuntime");
const createClassicGuestStateService = require("../lib/classicGuestStateService");
const createShopServices = require("../lib/shopServices");

const directories = ["app.js", "bin", "lib", "public/js", "routes", "scripts"];

function getFiles(target, extension) {
  const absolute = path.resolve(target);
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return absolute.endsWith(extension) ? [absolute] : [];

  return fs.readdirSync(absolute).flatMap((entry) => {
    const child = path.join(absolute, entry);
    if (fs.statSync(child).isDirectory()) return getFiles(child, extension);
    return child.endsWith(extension) ? [child] : [];
  });
}

const files = [
  ...new Set(directories.flatMap((target) => getFiles(target, ".js"))),
];
let failed = false;

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    failed = true;
    process.stderr.write(`${file}\n${result.stderr || result.stdout}`);
  }
}

const classicStats = require("../lib/classicStats");
require("../lib/gameStatsService");
require("../lib/rankingService");
const shopCatalog = require("../lib/shopCatalog");
const rankingCache = require("../lib/rankingCache");
const classicGame = require("../lib/classicGame");
const getBearerToken = require("../lib/authTokens");
const pokemonNames = require("../lib/pokemonNames");
const browserNameContext = {};
browserNameContext.globalThis = browserNameContext;
vm.runInNewContext(
  fs.readFileSync(
    path.join(__dirname, "../public/js/pokemonNameCore.js"),
    "utf8",
  ),
  browserNameContext,
);
const browserPokemonNames = browserNameContext.PokemonNameHelpers;
const registerCatalogRoutes = require("../routes/catalogRoutes");
const registerClassicRoutes = require("../routes/classicRoutes");
const registerShopRoutes = require("../routes/shopRoutes");

const reward = classicStats.classicGetPokedollarReward(3);
const monthlyPoints = classicStats.classicGetMonthlyRankingPoints(5, 2);
const collectible = shopCatalog.getCollectible(
  { companion: [{ id: "companion-test" }] },
  "companion",
  "companion-test",
);
const guess = classicGame({ name: "Pikachu" }, { name: "Pikachu" });
const cache = rankingCache.createRankingCache();
rankingCache.invalidateRankingCache(cache);
const catalogRoutes = new Set();
registerCatalogRoutes({
  get(path) {
    catalogRoutes.add(path);
  },
});
const safePokedollars = shopCatalog.getSafePokedollars;
const bearerToken = getBearerToken({
  get: () => "Bearer test-token",
});
const testShopServices = createShopServices({
  auth: { verifyIdToken: async (token) => ({ uid: token }) },
  shopBackgrounds: [
    { id: "background-test", desktopUrl: "/desktop-bg", mobileUrl: "/mobile-bg" },
  ],
  collectibleCatalog: {
    overlay: [{ id: "overlay-test" }],
    companion: [{ id: "companion-test" }],
  },
  boostItems: [{ id: "boost-master-ball" }],
  bgPathSelector: (device) => `/fallback/${device}`,
});
const shopServiceResponse = {
  statusCode: null,
  body: null,
  status(statusCode) {
    this.statusCode = statusCode;
    return this;
  },
  send(body) {
    this.body = body;
    return this;
  },
};
const shopServicesCheck = testShopServices
  .verifyShopUserToken(
    { get: () => "Bearer test-user" },
    shopServiceResponse,
  )
  .then((decodedToken) => {
    if (
      decodedToken?.uid !== "test-user" ||
      testShopServices.getShopBackground("background-test")?.id !==
        "background-test" ||
      testShopServices.getCollectible("overlay", "overlay-test")?.id !==
        "overlay-test" ||
      testShopServices.getOwnedShopBackgrounds({
        ownedBackgrounds: ["background-test", "missing"],
      }).length !== 1 ||
      testShopServices.getOwnedCollectibles(
        { ownedOverlays: ["overlay-test"] },
        "overlay",
      )[0] !== "overlay-test" ||
      testShopServices.getOwnedBoostInventory({
        ownedBoosts: { "boost-master-ball": 2 },
      })["boost-master-ball"] !== 2 ||
      testShopServices.profileBgPathSelector("background-test", "phone") !==
        "/mobile-bg" ||
      testShopServices.profileBgPathSelector("missing", "phone") !==
        "/fallback/phone"
    ) {
      failed = true;
      process.stderr.write("Shop services smoke check failed.\n");
    }
  })
  .catch((error) => {
    failed = true;
    process.stderr.write(`Shop services smoke check failed: ${error.message}\n`);
  });
let classicGuestMergeStats;
const testClassicGuestState = {
  classicPlayerStates: new Map([
    [
      "user:merge-test",
      {
        guesses: new Map([
          ["Bulbasaur", { result: [{ name: "Bulbasaur" }, {}, false] }],
        ]),
        winner: false,
        pendingWinner: null,
      },
    ],
    [
      "guest:merge-test",
      {
        guesses: new Map([
          ["Pikachu", {
            result: [{ name: "Pikachu" }, {}, true],
            guaranteedShiny: true,
          }],
          ["Bulbasaur", { result: [{ name: "Bulbasaur" }, {}, false] }],
        ]),
        winner: true,
      },
    ],
  ]),
  classicWinners: [],
};
const testClassicGuestStateService = createClassicGuestStateService({
  state: testClassicGuestState,
  updateStatsOnClassicWin: async (...args) => {
    classicGuestMergeStats = args;
  },
});
const classicGuestMergeCheck = testClassicGuestStateService
  .mergeClassicGuestState("merge-test", "merge-test")
  .then((userState) => {
    if (
      userState !== testClassicGuestState.classicPlayerStates.get(
        "user:merge-test",
      ) ||
      userState.guesses.size !== 2 ||
      !userState.winner ||
      !testClassicGuestState.classicWinners.includes("user:merge-test") ||
      classicGuestMergeStats?.[0] !== "merge-test" ||
      classicGuestMergeStats?.[1] !== "Pikachu" ||
      classicGuestMergeStats?.[2] !== 2 ||
      !Number.isFinite(classicGuestMergeStats?.[3]) ||
      classicGuestMergeStats?.[4] !== true
    ) {
      failed = true;
      process.stderr.write("Classic guest state merge smoke check failed.\n");
    }
  })
  .catch((error) => {
    failed = true;
    process.stderr.write(
      `Classic guest state merge smoke check failed: ${error.message}\n`,
    );
  });

const registeredRoutes = new Map();
const mockApp = {
  get(path, ...handlers) {
    registeredRoutes.set(`GET ${path}`, handlers[handlers.length - 1]);
  },
  post(path, ...handlers) {
    registeredRoutes.set(`POST ${path}`, handlers[handlers.length - 1]);
  },
  patch(path, ...handlers) {
    registeredRoutes.set(`PATCH ${path}`, handlers[handlers.length - 1]);
  },
};
const classicPlayerStates = new Map();
const guessPokemon = {
  name: "Pidgey",
  habitat: "forest",
  fullyEvolved: false,
  evolutionLevel: 1,
  gen: 1,
  types: ["normal"],
  colors: ["brown"],
};
const guestRouteState = {
  classicPlayerStates,
  classicCurrentPokemon: {
    name: "Pikachu",
    habitat: "mountain",
    fullyEvolved: true,
    evolutionLevel: 2,
    gen: 1,
    types: ["electric"],
    colors: ["yellow"],
  },
  classicWinners: [],
  classicShinyEventActive: false,
};
let classicResponseStatus;
let classicResponseBody;
let classicRouteError;
registerClassicRoutes(
  mockApp,
  {
    auth: { verifyIdToken: async () => ({ uid: "test-user" }) },
    createError: (status, message) =>
      Object.assign(new Error(message), { status }),
    pokemonCache: new Map([
      [guessPokemon.name, guessPokemon],
      [
        "Pikachu",
        {
          name: "Pikachu",
          habitat: "mountain",
          fullyEvolved: true,
          evolutionLevel: 2,
          gen: 1,
          types: ["electric"],
          colors: ["yellow"],
        },
      ],
    ]),
    classicVerifyGuess: classicGame,
    classicGetShinyChance: () => 0,
    classicGetRemainingTime: () => 0,
    classicGetCurrentDate: () => "2026-01-01",
    classicShouldResetStreak: () => false,
    classicGetActiveBall: () => null,
    classicGetStreakBall: () => null,
    mergeClassicGuestState: async () => null,
    updateStatsOnClassicWin: async () => null,
    state: guestRouteState,
  },
);
const guestClassicPostHandler = registeredRoutes.get("POST /classic");
const classicGuestRouteCheck = Promise.resolve(
  guestClassicPostHandler(
    { body: { uid: "test-guest", guess: "Pidgey" } },
    {
      status(status) {
        classicResponseStatus = status;
        return this;
      },
      send(body) {
        classicResponseBody = body;
        return this;
      },
    },
    (error) => {
      classicRouteError = error;
    },
  ),
).then(() => {
  if (
    classicRouteError ||
    classicResponseStatus !== 200 ||
    !Array.isArray(classicResponseBody) ||
    !classicPlayerStates.has("guest:test-guest")
  ) {
    failed = true;
    process.stderr.write("Classic guest route smoke check failed.\n");
  }
});
let winningClassicResponseStatus;
let winningClassicResponseBody;
let winningClassicRouteError;
const winningClassicRouteCheck = guestClassicPostHandler(
  { body: { uid: "test-winning-guest", guess: "Pikachu" } },
  {
    status(status) {
      winningClassicResponseStatus = status;
      return this;
    },
    send(body) {
      winningClassicResponseBody = body;
      return this;
    },
  },
  (error) => {
    winningClassicRouteError = error;
  },
).then(() => {
  if (
    winningClassicRouteError ||
    winningClassicResponseStatus !== 200 ||
    winningClassicResponseBody?.[2] !== true ||
    !winningClassicResponseBody?.[3] ||
    winningClassicResponseBody?.[4]?.tries !== 1 ||
    !classicPlayerStates.get("guest:test-winning-guest")?.winner
  ) {
    failed = true;
    process.stderr.write("Classic winning route smoke check failed.\n");
  }
});

const shopRoutePaths = new Set();
const mockShopApp = {
  get(path) {
    shopRoutePaths.add(`GET ${path}`);
  },
  post(path) {
    shopRoutePaths.add(`POST ${path}`);
  },
  patch(path) {
    shopRoutePaths.add(`PATCH ${path}`);
  },
};
registerShopRoutes(mockShopApp, {});
const expectedShopRoutes = [
  "GET /shop",
  "GET /shop/state",
  "POST /shop/purchase",
  "PATCH /shop/equipped-background",
  "POST /shop/collectibles/purchase",
  "POST /shop/boost/purchase",
  "POST /shop/boost/activate",
  "PATCH /shop/collectibles/equipped",
  "PATCH /shop/equipped-loadout",
];
if (expectedShopRoutes.some((route) => !shopRoutePaths.has(route))) {
  failed = true;
  process.stderr.write("Shop route registration smoke check failed.\n");
}

const viewsDirectory = path.resolve(__dirname, "../views");
for (const file of getFiles(viewsDirectory, ".ejs")) {
  ejs.compile(fs.readFileSync(file, "utf8"), { filename: file });
}
const headPartialPath = path.join(viewsDirectory, "partials", "head.ejs");
const headPartialCheck = Promise.all([
  ejs.renderFile(
    headPartialPath,
    {
      title: "Check",
      modules: [],
      appVersion: "check",
      preconnect: true,
    },
    { root: viewsDirectory },
  ),
  ejs.renderFile(
    headPartialPath,
    {
      title: "Error",
      modules: [],
      appVersion: "check",
      includeAuthState: false,
      preconnect: false,
    },
    { root: viewsDirectory },
  ),
])
  .then(([standardHead, errorHead]) => {
    if (
      !standardHead.includes("<title>Check</title>") ||
      !standardHead.includes("pokedleAuthState") ||
      !standardHead.includes("www.gstatic.com") ||
      !errorHead.includes("<title>Error</title>") ||
      errorHead.includes("pokedleAuthState")
    ) {
      failed = true;
      process.stderr.write("Shared page head smoke check failed.\n");
    }
  })
  .catch((error) => {
    failed = true;
    process.stderr.write(`Shared page head smoke check failed: ${error.message}\n`);
  });

const gameRuntimeState = {
  classicWinners: [],
  classicPlayerStates: new Map(),
  shopDiscounts: {},
  sentryChallenges: {},
  pokemonCache: new Map(),
  validSentryIds: [],
};
const testPokemon = [
  { id: "132", name: "Ditto", ID: 132 },
  { id: "25", name: "Pikachu", ID: 25 },
  { id: "1", name: "Bulbasaur", ID: 1 },
  { id: "4", name: "Charmander", ID: 4 },
];
let nextGameId = 0;
const gameRuntime = createGameRuntime({
  state: gameRuntimeState,
  firestore: {
    collection: () => ({
      get: async () => ({
        docs: testPokemon.map((pokemon) => ({
          id: pokemon.id,
          data: () => pokemon,
        })),
      }),
    }),
  },
  badFootprints: [],
  eventPokemonPool: [],
  randomUUID: () => `game-${++nextGameId}`,
  classicGetRemainingTime: () => 1000,
  sentryDurationMs: 30000,
  desktopBackgroundCount: 2,
  mobileBackgroundCount: 2,
  shopBackgrounds: [],
  overlayItems: [],
  companionItems: [],
  boostItems: [],
  setTimeoutFn: () => null,
});
const gameRuntimeCheck = gameRuntime
  .initializeClassicGame()
  .then(() =>
    gameRuntime.generateSentryChallenge("test-session", {}),
  )
  .then((challenge) => {
    if (
      gameRuntimeState.classicPreviousPokemon?.name !== "Ditto" ||
      !gameRuntimeState.classicCurrentPokemon ||
      challenge.options.length !== 4 ||
      !challenge.options.includes(gameRuntimeState.sentryChallenges[challenge.challengeID].answer) ||
      challenge.durationMs !== 30000
    ) {
      failed = true;
      process.stderr.write("Game runtime smoke check failed.\n");
    }
  })
  .catch((error) => {
    failed = true;
    process.stderr.write(`Game runtime smoke check failed: ${error.message}\n`);
  });

Promise.all([
  classicGuestRouteCheck,
  winningClassicRouteCheck,
  gameRuntimeCheck,
  headPartialCheck,
  classicGuestMergeCheck,
  shopServicesCheck,
]).then(finishChecks);

if (
  reward !== 500 ||
  monthlyPoints !== 80 ||
  collectible?.id !== "companion-test" ||
  cache.generation !== 1 ||
  guess[2] !== true ||
  safePokedollars({ pokedollars: 125 }) !== 125 ||
  safePokedollars({ pokedollars: Number.MAX_SAFE_INTEGER + 1 }) !== 0 ||
  pokemonNames.getPokemonDisplayName("Nidoranf") !== "Nidoran♀" ||
  pokemonNames.getPokemonSlug("Mr. Mime") !== "mr-mime" ||
  browserPokemonNames.getPokemonDisplayName("Nidoranf") !== "Nidoran♀" ||
  browserPokemonNames.getPokemonSlug("Mr. Mime") !== "mr-mime" ||
  bearerToken !== "test-token" ||
  !catalogRoutes.has("/data/shopBackgrounds.json") ||
  !catalogRoutes.has("/data/shopOverlays.json")
) {
  failed = true;
  process.stderr.write("Pure helper smoke checks failed.\n");
}

function finishChecks() {
  if (failed) process.exit(1);
  console.log(`Syntax and smoke checks passed (${files.length} JavaScript files).`);
}
