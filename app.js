const fs = require("fs");
const { randomUUID } = require("crypto");
const express = require("express");
const device = require("express-device");
const { rateLimit } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const { createClient } = require("redis");
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const logger = require("morgan");
const createError = require("http-errors");
const packageJson = require("./package.json");
const badFootprints = require("./data/badFootprints.json");
const eventPokemonPool = require("./data/legendaryPokemon.json");
const serviceAccount = require("/etc/secrets/service_account_admin_sdk");

// initialize Firebase with admin privileges
initializeApp({
  credential: cert(serviceAccount),
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

// --- CLASSIC MODE VARIABLES ---
let classicWinners = []; // to store uuid of players who have won the current game
const classicPlayerStates = new Map();
let classicGameID; // to store uuid of current game
let classicPreviousPokemon; // to store the previous generated pokemon
let classicCurrentPokemon; // to store the current generated pokemon
let classicEventActive = false;

// --- SENTRY DUTY MODE VARIABLES ---
let sentryChallenges = {}; // store active sentry duty challenges
const sentrySessions = new Map();
const sentryDurationMs = 30 * 1000; // duration for each sentry guess
const sentryFailureLimit = 3;
const sentrySessionTtlMs = 60 * 60 * 1000;
const pokemonCache = new Map();
let validSentryIds = [];

const rankingCacheTtlMs = 1 * 60 * 60 * 1000;
const classicRankingCache = { data: null, expiresAt: 0, pending: null };
const sentryRankingCache = { data: null, expiresAt: 0, pending: null };
const shopBackgrounds = require("./data/shopBackgrounds.json");
const legacyShopBackgrounds = [
  {
    id: "background-1",
    name: "Hoenn Legends",
    price: 1200,
    purchasable: false,
    desktopUrl: "/public/images/backgrounds_desktop/1.webp",
    mobileUrl: "/public/images/backgrounds_mobile/1.webp",
  },
  {
    id: "background-2",
    name: "Mega Evolution",
    price: 2200,
    purchasable: false,
    desktopUrl: "/public/images/backgrounds_desktop/2.webp",
    mobileUrl: "/public/images/backgrounds_mobile/2.webp",
  },
  {
    id: "background-3",
    name: "Psychic Showdown",
    price: 3500,
    purchasable: false,
    desktopUrl: "/public/images/backgrounds_desktop/3.webp",
    mobileUrl: "/public/images/backgrounds_mobile/3.webp",
  },
  {
    id: "background-4",
    name: "Sinnoh Legends",
    price: 5000,
    purchasable: false,
    desktopUrl: "/public/images/backgrounds_desktop/4.webp",
    mobileUrl: "/public/images/backgrounds_mobile/4.webp",
  },
];

// Background images per device type
let bg_desktop_option; // to store current background option for rendering desktop views
let bg_mobile_option; // to store current background option for rendering mobile views
const bg_desktop_number = fs.readdirSync(
  "./public/images/backgrounds_desktop",
).length; // number of desktop background options
const bg_mobile_number = fs.readdirSync(
  "./public/images/backgrounds_mobile",
).length; //number of mobile background options

const app = express(); // new express app
const auth = getAuth(); // reference to auth service
const firestore = getFirestore(); // reference to firestore cloud storage service
const rateLimitRedis = createClient({ url: process.env.REDIS_URL });
const appVersion = packageJson.version;

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

async function cachePokemonData() {
  const snapshot = await firestore.collection("pokemons").get();

  for (const doc of snapshot.docs) {
    const pokemon = doc.data();
    pokemonCache.set(doc.id, pokemon);
    if (pokemon.name && !badFootprints.includes(pokemon.name))
      validSentryIds.push(doc.id);
  }

  if (pokemonCache.size === 0) throw new Error("Pokémon collection is empty");
  if (validSentryIds.length === 0)
    throw new Error("No Pokémon are available for Sentry challenges");
}

async function getCachedRanking(cache, orderField, mapUser) {
  if (cache.data !== null && Date.now() < cache.expiresAt) return cache.data;

  if (!cache.pending) {
    cache.pending = firestore
      .collection("users")
      .orderBy(orderField, "desc")
      .limit(10)
      .get()
      .then((queryResult) => {
        cache.data = queryResult.docs.map(mapUser);
        cache.expiresAt = Date.now() + rankingCacheTtlMs;
        return cache.data;
      })
      .finally(() => {
        cache.pending = null;
      });
  }

  return cache.pending;
}

async function mergeClassicGuestState(uid, guestId) {
  const userKey = `user:${uid}`;
  let userState = classicPlayerStates.get(userKey);
  if (!userState) {
    userState = { guesses: new Map(), winner: false, pendingWinner: null };
    classicPlayerStates.set(userKey, userState);
  }

  const guestState = classicPlayerStates.get(`guest:${guestId}`);
  if (!guestState || guestState === userState || userState.winner)
    return userState;

  for (const [name, entry] of guestState.guesses) {
    if (entry.pending) await entry.pending;
    if (!userState.guesses.has(name)) userState.guesses.set(name, entry);
  }

  if (guestState.winner) {
    const winningEntry = [...guestState.guesses.values()].find(
      (entry) => entry.result?.[2],
    );
    if (winningEntry) {
      await updateStatsOnClassicWin(
        uid,
        winningEntry.result[0].name,
        userState.guesses.size,
        Math.random(),
      );
    }
    userState.winner = true;
    if (!classicWinners.includes(userKey)) classicWinners.push(userKey);
  }

  return userState;
}

async function initializeClassicGame() {
  if (pokemonCache.size === 0) await cachePokemonData();

  const initialPokemon = pokemonCache.get("132");
  if (!initialPokemon) throw new Error("Initial Pokémon 132 was not found");

  classicCurrentPokemon = initialPokemon;
  await classicGeneratePokemon();
}

app.locals.initializeRateLimitStore = initializeRateLimitStore;
app.locals.initializeClassicGame = initializeClassicGame;

// EJS view engine setup
app.set("views", __dirname + "/views");
app.set("view engine", "ejs");

app.set("trust proxy", 3);

function handleRateLimit(req, res, next, options) {
  const message =
    typeof options.message === "string"
      ? options.message
      : options.message?.error || "Too many requests. Please try again later.";

  if (req.get("sec-fetch-dest") === "document") {
    const referer = req.get("referer");
    if (referer) {
      let refererUrl;
      try {
        refererUrl = new URL(referer);
      } catch (_) {
        refererUrl = null;
      }
      const appOrigin = `${req.protocol}://${req.get("host")}`;
      if (refererUrl?.origin === appOrigin) {
        const sourceUrl = `${refererUrl.pathname}${refererUrl.search}`;
        if (sourceUrl !== req.originalUrl) {
          refererUrl.searchParams.set("rateLimitToast", message);
          return res.redirect(
            303,
            `${refererUrl.pathname}${refererUrl.search}${refererUrl.hash}`,
          );
        }
      }
    }

    res.locals.rateLimitToast = message;
    return next();
  }

  return res.status(options.statusCode).send(options.message);
}

const firestoreReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  message: { error: "Too many data requests, please slow down." },
  handler: handleRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: sendRateLimitRedisCommand,
    prefix: "pokedle:rate-limit:firestore-read:",
  }),
});
const shopLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  message: { error: "Too many shop requests. Please try again later." },
  handler: handleRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: sendRateLimitRedisCommand,
    prefix: "pokedle:rate-limit:shop:",
  }),
});
const sentryStatsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  message: { error: "Too many game requests, please slow down." },
  handler: handleRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: sendRateLimitRedisCommand,
    prefix: "pokedle:rate-limit:sentry-stats:",
  }),
});
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: { error: "Too many account modification requests." },
  handler: handleRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: sendRateLimitRedisCommand,
    prefix: "pokedle:rate-limit:account:",
  }),
});

app.use(logger("dev"));
app.use(express.json());
app.use(device.capture());

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

// render classic mode page
app.get("/classic", (req, res) => {
  res.render("classicMode", {
    bg: bgPathSelector(req.device.type),
    prev: classicPreviousPokemon,
    appVersion: appVersion,
  });
});

// generate hints based on user's guess, check if user has won and, if so, call an update to his stats
app.post("/classic", async (req, res, next) => {
  try {
    let authenticatedUid = null;
    if (req.body.token != null) {
      try {
        authenticatedUid = (await auth.verifyIdToken(req.body.token)).uid;
      } catch (_) {
        return res.status(401).send({ error: "Invalid authentication token" });
      }
    }

    const guestId =
      typeof req.body.uid === "string" &&
      req.body.uid.trim().length > 0 &&
      req.body.uid.length <= 128
        ? req.body.uid
        : null;
    const playerId = authenticatedUid
      ? `user:${authenticatedUid}`
      : guestId
        ? `guest:${guestId}`
        : null;
    if (!playerId)
      return res.status(400).send({ error: "Player ID is required" });

    // Search the local cache instead of querying Firestore
    const guess = Array.from(pokemonCache.values()).find(
      (p) => p.name === req.body.guess,
    );

    if (!guess) {
      return next(createError(404, "Pokémon not found"));
    }

    let state;
    if (authenticatedUid) {
      state = await mergeClassicGuestState(authenticatedUid, guestId);
    } else {
      state = classicPlayerStates.get(playerId);
      if (!state) {
        state = { guesses: new Map(), winner: false, pendingWinner: null };
        classicPlayerStates.set(playerId, state);
      }
    }

    const existingGuess = state.guesses.get(guess.name);
    if (existingGuess) {
      try {
        const previousResult = existingGuess.pending
          ? await existingGuess.pending
          : existingGuess.result;
        const duplicateResult = [...previousResult];
        duplicateResult[4] = {
          tries: state.guesses.size,
          duplicate: true,
        };
        return res.status(200).send(duplicateResult);
      } catch (err) {
        console.error(err);
        return next(createError(500));
      }
    }

    if (state.pendingWinner) await state.pendingWinner;
    if (state.winner)
      return res.status(409).send({ error: "Already won this game" });

    const tries = state.guesses.size + 1;
    let result = classicVerifyGuess(guess, classicCurrentPokemon);
    result[4] = { tries, duplicate: false };

    if (result[2]) {
      const shinyRoll = Math.random();
      result[3] = {
        ball: null,
        shiny: shinyRoll < classicGetShinyChance(null),
        pokedollarsEarned: 0,
      };
      const entry = { tries, result: null, pending: null };
      state.guesses.set(guess.name, entry);
      state.pendingWinner = (async () => {
        try {
          if (authenticatedUid) {
            result[3] =
              (await updateStatsOnClassicWin(
                authenticatedUid,
                guess.name,
                tries,
                shinyRoll,
              )) || result[3];
          }
          entry.result = result;
          state.winner = true;
          if (!classicWinners.includes(playerId)) classicWinners.push(playerId);
          return result;
        } catch (err) {
          state.guesses.delete(guess.name);
          throw err;
        } finally {
          state.pendingWinner = null;
        }
      })();
      entry.pending = state.pendingWinner;
      result = await state.pendingWinner;
    } else {
      state.guesses.set(guess.name, { tries, result, pending: null });
    }
    res.status(200).send(result);
  } catch (err) {
    console.error(err);
    next(createError(500));
  }
});

// send game ID and remaining time before next generation
app.get("/classic/state", (_, res) => {
  res.status(200);
  res.send([
    classicGameID,
    classicGetRemainingTime(),
    classicPreviousPokemon == null
      ? null
      : { ID: classicPreviousPokemon.ID, name: classicPreviousPokemon.name },
    classicEventActive,
  ]);
});

app.get("/classic/ball", firestoreReadLimiter, async (req, res, next) => {
  const token = req.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return res.status(401).send({ error: "Authentication required" });

  let decodedToken;
  try {
    decodedToken = await auth.verifyIdToken(token);
  } catch (err) {
    return res.status(401).send({ error: "Invalid authentication token" });
  }

  try {
    const userRef = firestore.collection("users").doc(decodedToken.uid);
    const ball = await firestore.runTransaction(async (transaction) => {
      const doc = await transaction.get(userRef);
      const user = doc.data();
      if (!user) return null;

      const currentDate = classicGetCurrentDate();
      if (classicShouldResetStreak(user, currentDate)) {
        transaction.update(userRef, { classicWinStreak: 0 });
        user.classicWinStreak = 0;
      }

      return classicGetActiveBall(user, currentDate);
    });
    res.status(200).send({ ball });
  } catch (err) {
    console.error(err);
    next(createError(500));
  }
});

// render top 10 classic mode users page
app.get("/classic/ranking", async (req, res) => {
  try {
    const topTen = await getCachedRanking(
      classicRankingCache,
      "classicWins",
      (user) => ({
        id: user.id,
        username: user.data().username,
        classicWins: user.data().classicWins,
      }),
    );
    res.status(200).render("classicRanking", {
      rankingData: topTen,
      bg: bgPathSelector(req.device.type),
    });
  } catch (err) {
    console.error(err);
    next(createError(500));
  }
});

// send a boolean stating if user can play the current game
app.get("/classic/canPlay/uid=:uid&gid=:gid", async (req, res, next) => {
  try {
    const token = req.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    let authenticatedUid = null;
    if (token) {
      try {
        authenticatedUid = (await auth.verifyIdToken(token)).uid;
      } catch (_) {
        return res.status(401).send({ error: "Invalid authentication token" });
      }
      if (authenticatedUid !== req.params.gid)
        return res.status(403).send({ error: "User ID does not match token" });
      await mergeClassicGuestState(authenticatedUid, req.params.uid);
    }

    const canPlay =
      !classicWinners.includes(`guest:${req.params.uid}`) &&
      (!authenticatedUid ||
        !classicWinners.includes(`user:${authenticatedUid}`));
    res.status(200).send(canPlay);
  } catch (err) {
    console.error(err);
    next(createError(500));
  }
});

// render sentry duty mode page
app.get("/sentry", (req, res) => {
  res.render("sentryMode", {
    bg: bgPathSelector(req.device.type),
    appVersion: appVersion,
  });
});

// verify the player's sentry duty guess
app.post("/sentry", sentryStatsLimiter, async (req, res, next) => {
  try {
    const challengeID = req.body.challengeID;
    const selected = req.body.selected;
    const challenge = sentryChallenges[challengeID];

    if (!challenge || challenge.processing) {
      res.status(410);
      res.send({ correct: false, timeout: true });
      return;
    }

    const session = sentrySessions.get(challenge.sessionID);
    if (
      !session ||
      session.currentChallengeID !== challengeID ||
      session.gameOver ||
      session.expiresAt <= Date.now()
    )
      return res.status(410).send({ correct: false, timeout: true });

    let authenticatedUid = null;
    const token = typeof req.body.token === "string" ? req.body.token : null;
    if (token) {
      try {
        authenticatedUid = (await auth.verifyIdToken(token)).uid;
      } catch (_) {
        return res.status(401).send({ error: "Invalid authentication token" });
      }
    }
    if (session.uid && authenticatedUid !== session.uid)
      return res.status(401).send({ error: "Authentication required" });
    if (!session.uid && authenticatedUid) {
      session.uid = authenticatedUid;
      session.totalScore = 0;
      session.failures = 0;
      session.rounds = 0;
    }

    challenge.processing = true;
    const elapsedMs = Date.now() - challenge.startTime;
    const timedOut = elapsedMs > sentryDurationMs;
    const correct =
      selected === challenge.answer &&
      challenge.options.includes(selected) &&
      !timedOut;
    const baseScore = 1000;
    const decayFactor = 0.92;
    const score = correct
      ? Math.max(
          0,
          Math.ceil(baseScore * Math.pow(decayFactor, elapsedMs / 1000)),
        )
      : 0;
    const totalScore = session.totalScore + score;
    const rounds = session.rounds + 1;
    const failures = session.failures + (correct ? 0 : 1);
    const gameOver = failures >= sentryFailureLimit;

    try {
      if (session.uid)
        await updateStatsOnSentryRound(
          session.uid,
          totalScore,
          !correct,
          rounds,
          gameOver,
        );
    } catch (err) {
      challenge.processing = false;
      throw err;
    }

    delete sentryChallenges[challengeID];
    session.currentChallengeID = null;
    session.totalScore = totalScore;
    session.rounds = rounds;
    session.failures = failures;
    session.gameOver = gameOver;
    session.expiresAt = Date.now() + sentrySessionTtlMs;
    res.status(200);
    res.send({
      correct: correct,
      score: score,
      answer: challenge.answer,
      timeout: timedOut,
      elapsedMs: elapsedMs,
      totalScore: totalScore,
      rounds: rounds,
      failures: failures,
      gameOver: gameOver,
    });
  } catch (err) {
    console.error(err);
    next(createError(500));
  }
});

// send current sentry duty challenge to the user
app.get("/sentry/state", async (req, res, next) => {
  try {
    const token = req.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    let authenticatedUid = null;
    if (token) {
      try {
        authenticatedUid = (await auth.verifyIdToken(token)).uid;
      } catch (_) {
        return res.status(401).send({ error: "Invalid authentication token" });
      }
    }

    const now = Date.now();
    for (const [id, activeSession] of sentrySessions) {
      if (activeSession.expiresAt <= now) {
        if (activeSession.currentChallengeID)
          delete sentryChallenges[activeSession.currentChallengeID];
        sentrySessions.delete(id);
      }
    }

    let sessionID = req.query.sessionID;
    let session;
    if (sessionID == null) {
      sessionID = randomUUID();
      session = {
        uid: authenticatedUid,
        totalScore: 0,
        failures: 0,
        rounds: 0,
        gameOver: false,
        currentChallengeID: null,
        expiresAt: now + sentrySessionTtlMs,
      };
      sentrySessions.set(sessionID, session);
    } else {
      session = sentrySessions.get(sessionID);
      if (!session) return res.status(410).send({ error: "Session expired" });
      if (session.uid && session.uid !== authenticatedUid)
        return res.status(401).send({ error: "Authentication required" });
      if (!session.uid && authenticatedUid) {
        session.uid = authenticatedUid;
        session.totalScore = 0;
        session.failures = 0;
        session.rounds = 0;
      }
    }

    if (session.gameOver)
      return res.status(410).send({ error: "Game over; start a new session" });

    if (session.currentChallengeID) {
      const previousChallenge = sentryChallenges[session.currentChallengeID];
      if (!previousChallenge || previousChallenge.processing)
        return res.status(409).send({ error: "Challenge is being processed" });

      previousChallenge.processing = true;
      const rounds = session.rounds + 1;
      const failures = session.failures + 1;
      const gameOver = failures >= sentryFailureLimit;
      try {
        if (session.uid)
          await updateStatsOnSentryRound(
            session.uid,
            session.totalScore,
            true,
            rounds,
            gameOver,
          );
      } catch (err) {
        previousChallenge.processing = false;
        throw err;
      }

      delete sentryChallenges[session.currentChallengeID];
      session.currentChallengeID = null;
      session.rounds = rounds;
      session.failures = failures;
      session.gameOver = gameOver;
    }

    if (session.gameOver)
      return res.status(410).send({ error: "Game over; start a new session" });

    session.expiresAt = Date.now() + sentrySessionTtlMs;
    const challenge = await generateSentryChallenge(sessionID, session);
    res.status(200).send({
      ...challenge,
      sessionID: sessionID,
      totalScore: session.totalScore,
      rounds: session.rounds,
      failures: session.failures,
    });
  } catch (err) {
    console.error(err);
    next(createError(500));
  }
});

// render top 10 sentry duty users page
app.get("/sentry/ranking", async (req, res) => {
  try {
    const topTen = await getCachedRanking(
      sentryRankingCache,
      "sentryBestScore",
      (user) => ({
        id: user.id,
        username: user.data().username,
        score: user.data().sentryBestScore || 0,
      }),
    );
    res.status(200).render("sentryRanking", {
      rankingData: topTen,
      bg: bgPathSelector(req.device.type),
    });
  } catch (err) {
    console.error(err);
    next(createError(500));
  }
});

// generate new unique id (uuid) on request
app.get("/user/id", (_, res) => {
  res.status(201);
  res.send(randomUUID());
});

app.put("/user/:gid", authLimiter, async (req, res, next) => {
  let decodedToken;
  try {
    decodedToken = await auth.verifyIdToken(req.body.token);
  } catch (err) {
    console.error(err);
    return res.status(401).end();
  }

  if (decodedToken.uid != req.params.gid) return res.status(401).end();

  const userRef = firestore.collection("users").doc(decodedToken.uid);
  try {
    const doc = await userRef.get();
    if (doc.data() == undefined) {
      await userRef.set({
        username: `user-${randomUUID().replaceAll("-", "").slice(0, 11)}`,
        classicWins: 0,
        classicAvgTries: 0,
        classicWinStreak: 0,
        classicLastWinDate: null,
        classicHistory: [],
        pokedollars: 0,
        ownedBackgrounds: [],
        equippedBackground: null,
        sentryBestScore: 0,
        sentrySessionsCompleted: 0,
        sentryFailures: 0,
        sentryBestSession: 0,
      });
      return res.status(201).end();
    }
    return res.status(204).end();
  } catch (err) {
    console.error(err);
    next(createError(500));
  }
});

app.patch("/user/:gid/username", authLimiter, async (req, res, next) => {
  const token = req.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return res.status(401).send({ error: "Authentication required" });

  let decodedToken;
  try {
    decodedToken = await auth.verifyIdToken(token);
  } catch (err) {
    return res.status(401).send({ error: "Invalid authentication token" });
  }

  if (decodedToken.uid !== req.params.gid)
    return res
      .status(403)
      .send({ error: "Cannot update another user's username" });

  const username =
    typeof req.body.username === "string" ? req.body.username.trim() : "";
  if (username.length < 1 || username.length > 16)
    return res
      .status(400)
      .send({ error: "Username must be between 1 and 16 characters" });

  try {
    const userRef = firestore.collection("users").doc(decodedToken.uid);
    await userRef.update({ username });
    return res.status(204).end();
  } catch (err) {
    if (err.code === 5 || err.code === "not-found")
      return res.status(404).send({ error: "User not found" });
    console.error(err);
    next(createError(500));
  }
});

// render requested user's profile page
app.get("/user/:gid/profile", firestoreReadLimiter, async (req, res, next) => {
  firestore
    .collection("users")
    .doc(req.params.gid)
    .get()
    .then((doc) => {
      let user = doc.data();
      if (user == undefined) next(createError(404, "User does not exist"));
      else {
        res.status(200);
        let sessions = user.sentrySessionsCompleted || 0;
        let failures = user.sentryFailures || 0;
        let accuracy =
          sessions > 0
            ? Math.round(((sessions - failures) / sessions) * 1000) / 10
            : 0;
        res.render("profile", {
          profileId: req.params.gid,
          username: user.username,
          classicWins: user.classicWins,
          classicAvgTries: Math.round(user.classicAvgTries * 100) / 100,
          sentryBestScore: user.sentryBestScore || 0,
          sentrySessionsCompleted: sessions,
          sentryAccuracy: accuracy,
          sentryBestSession: user.sentryBestSession || 0,
          bg: profileBgPathSelector(user.equippedBackground, req.device.type),
        });
      }
    })
    .catch((err) => {
      console.error(err);
      next(createError(500));
    });
});

app.get("/shop", (req, res) => {
  res.render("shop", {
    bg: bgPathSelector(req.device.type),
    shopItems: [...shopBackgrounds, ...legacyShopBackgrounds],
  });
});

app.get("/shop/state", firestoreReadLimiter, async (req, res, next) => {
  const decodedToken = await verifyShopUserToken(req, res);
  if (!decodedToken) return;

  try {
    const doc = await firestore.collection("users").doc(decodedToken.uid).get();
    const user = doc.data();
    if (!user) return res.status(404).send({ error: "User not found" });
    res.set("Cache-Control", "no-store");
    res.status(200).send({
      pokedollars:
        Number.isSafeInteger(user.pokedollars) && user.pokedollars >= 0
          ? user.pokedollars
          : 0,
      ownedBackgrounds: getOwnedShopBackgrounds(user),
      equippedBackground:
        getShopBackground(user.equippedBackground)?.id || null,
    });
  } catch (err) {
    console.error(err);
    next(createError(500));
  }
});

app.post("/shop/purchase", shopLimiter, async (req, res, next) => {
  const decodedToken = await verifyShopUserToken(req, res);
  if (!decodedToken) return;

  const background = getShopBackground(req.body?.backgroundId);
  if (!background || background.purchasable === false)
    return res.status(400).send({ error: "Unknown background" });

  try {
    const userRef = firestore.collection("users").doc(decodedToken.uid);
    const result = await firestore.runTransaction(async (transaction) => {
      const doc = await transaction.get(userRef);
      const user = doc.data();
      if (!user) return { error: "User not found", status: 404 };

      const ownedBackgrounds = getOwnedShopBackgrounds(user);
      if (ownedBackgrounds.includes(background.id))
        return { error: "You already own this background", status: 409 };

      const pokedollars =
        Number.isSafeInteger(user.pokedollars) && user.pokedollars >= 0
          ? user.pokedollars
          : 0;
      if (pokedollars < background.price)
        return { error: "Not enough Pokédollars", status: 400 };

      ownedBackgrounds.push(background.id);
      transaction.update(userRef, {
        pokedollars: pokedollars - background.price,
        ownedBackgrounds,
      });
      return { pokedollars: pokedollars - background.price, ownedBackgrounds };
    });

    if (result.error)
      return res.status(result.status).send({ error: result.error });
    res.status(200).send(result);
  } catch (err) {
    console.error(err);
    next(createError(500));
  }
});

app.patch("/shop/equipped-background", shopLimiter, async (req, res, next) => {
  const decodedToken = await verifyShopUserToken(req, res);
  if (!decodedToken) return;

  const backgroundId = req.body?.backgroundId;
  if (
    backgroundId !== null &&
    (typeof backgroundId !== "string" || !getShopBackground(backgroundId))
  )
    return res.status(400).send({ error: "Unknown background" });

  try {
    const userRef = firestore.collection("users").doc(decodedToken.uid);
    const result = await firestore.runTransaction(async (transaction) => {
      const doc = await transaction.get(userRef);
      const user = doc.data();
      if (!user) return { error: "User not found", status: 404 };

      if (
        backgroundId !== null &&
        !getOwnedShopBackgrounds(user).includes(backgroundId)
      )
        return { error: "You do not own this background", status: 403 };

      transaction.update(userRef, { equippedBackground: backgroundId });
      return { equippedBackground: backgroundId };
    });

    if (result.error)
      return res.status(result.status).send({ error: result.error });
    res.status(200).send(result);
  } catch (err) {
    console.error(err);
    next(createError(500));
  }
});

// render requested user's pokedex page
app.get("/user/:gid/pokedex", firestoreReadLimiter, async (req, res, next) => {
  firestore
    .collection("users")
    .doc(req.params.gid)
    .get()
    .then((doc) => {
      let user = doc.data();
      if (user == undefined) next(createError(404, "User does not exist"));
      else {
        res.status(200);
        res.render("pokedex", {
          username: user.username,
          history: user.classicHistory,
          bg: bgPathSelector(req.device.type),
        });
      }
    })
    .catch((err) => {
      console.error(err);
      next(createError(500));
    });
});

app.all("/*", (req, res, next) => {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, _) {
  res.locals.message = err.message;
  res.locals.error = err;
  res.status(err.status || 500);
  res.render("error", { bg: bgPathSelector(req.device.type) });
});

async function classicGeneratePokemon() {
  if (!classicCurrentPokemon)
    throw new Error("Cannot generate a game before the initial Pokémon loads");

  const previousPokemon = classicCurrentPokemon;
  const eligibleEventPokemon = eventPokemonPool.filter(
    (pokemonName) => pokemonName !== previousPokemon.name,
  );
  const useEventPool = eligibleEventPokemon.length > 0 && Math.random() < 0.1;
  let nextPokemon;
  if (useEventPool) {
    const pokemonName =
      eligibleEventPokemon[
        Math.floor(Math.random() * eligibleEventPokemon.length)
      ];
    nextPokemon = Array.from(pokemonCache.values()).find(
      (pokemon) => pokemon.name === pokemonName,
    );
    if (!nextPokemon)
      throw new Error(`Event Pokémon "${pokemonName}" was not found`);
  } else {
    const availablePokemon = Array.from(pokemonCache.entries())
      .filter(
        ([id, pokemon]) =>
          Number(id) >= 1 &&
          Number(id) <= 649 &&
          id !== String(previousPokemon.ID) &&
          pokemon,
      )
      .map(([, pokemon]) => pokemon);
    if (availablePokemon.length === 0)
      throw new Error("No Pokémon available for the next Classic game");
    nextPokemon =
      availablePokemon[Math.floor(Math.random() * availablePokemon.length)];
  }
  if (!nextPokemon) throw new Error("Generated Pokémon was not found");

  let nextDesktopBackground = bg_desktop_option;
  while (nextDesktopBackground == bg_desktop_option)
    nextDesktopBackground = Math.floor(Math.random() * bg_desktop_number) + 1;
  let nextMobileBackground = bg_mobile_option;
  while (nextMobileBackground == bg_mobile_option)
    nextMobileBackground = Math.floor(Math.random() * bg_mobile_number) + 1;

  classicPreviousPokemon = previousPokemon;
  classicCurrentPokemon = nextPokemon;
  classicGameID = randomUUID();
  classicWinners = [];
  classicPlayerStates.clear();
  classicEventActive = useEventPool;
  bg_desktop_option = nextDesktopBackground;
  bg_mobile_option = nextMobileBackground;
  console.log("#DEV Solution: " + classicCurrentPokemon.name);
  scheduleClassicGeneration();
}

function scheduleClassicGeneration(delay = classicGetRemainingTime()) {
  setTimeout(() => {
    classicGeneratePokemon().catch((err) => {
      console.error(
        "Failed to generate the daily Pokémon; retrying in 60 seconds.",
        err,
      );
      scheduleClassicGeneration(60 * 1000);
    });
  }, delay);
}

// verify the client's guess, generate related hints
function classicVerifyGuess(guess, answer) {
  let response = {
    habitat: "correct",
    colors: "correct",
    types: "correct",
    fullyEvolved: "correct",
    evolutionLevel: "correct",
    gen: "correct",
  };
  let count = 0;
  let hasWon = true;

  if (guess.name != answer.name) {
    hasWon = false;
    if (guess.habitat != answer.habitat) response.habitat = "wrong";
    if (guess.fullyEvolved != answer.fullyEvolved)
      response.fullyEvolved = "wrong";
    if (guess.evolutionLevel > answer.evolutionLevel)
      response.evolutionLevel = "wrong-lower";
    if (guess.evolutionLevel < answer.evolutionLevel)
      response.evolutionLevel = "wrong-higher";
    if (guess.gen > answer.gen) response.gen = "wrong-lower";
    if (guess.gen < answer.gen) response.gen = "wrong-higher";
    for (let i = 0; i < guess.types.length; i++)
      if (answer.types.includes(guess.types[i])) count++;
    if (count == 0) response.types = "wrong";
    else if (answer.types.length != count || guess.types.length != count)
      response.types = "partial";

    const getColorName = (color) => {
      let name;
      if (Array.isArray(color)) name = color[0];
      else if (color && typeof color === "object") name = color.name;
      else if (
        typeof color === "string" &&
        !/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color)
      )
        name = color;

      return typeof name === "string" && name.trim()
        ? name.trim().toLowerCase()
        : null;
    };
    const guessColors = (guess.colors || []).map(getColorName);
    const answerColors = (answer.colors || []).map(getColorName);
    const remainingAnswerColors = new Map();
    for (const colorName of answerColors)
      if (colorName)
        remainingAnswerColors.set(
          colorName,
          (remainingAnswerColors.get(colorName) || 0) + 1,
        );
    let matchedColors = 0;
    for (const colorName of guessColors) {
      const remaining = colorName
        ? remainingAnswerColors.get(colorName) || 0
        : 0;
      if (remaining > 0) {
        matchedColors++;
        remainingAnswerColors.set(colorName, remaining - 1);
      }
    }

    if (
      guessColors.length === answerColors.length &&
      guessColors.every(Boolean) &&
      answerColors.every(Boolean) &&
      matchedColors === answerColors.length
    )
      response.colors = "correct";
    else if (matchedColors > 0) response.colors = "partial";
    else response.colors = "wrong";
  }
  return [guess, response, hasWon];
}

const classicTimeZone = "Europe/Rome";
const classicDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: classicTimeZone,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

function classicGetDateTimeParts(date) {
  return Object.fromEntries(
    classicDateTimeFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
}

function classicGetRemainingTime() {
  const now = Date.now();
  const todayInRome = classicGetDateTimeParts(new Date(now));
  const nextMidnightAsUtc = Date.UTC(
    todayInRome.year,
    todayInRome.month - 1,
    todayInRome.day + 1,
  );
  const nextMidnightInRome = classicGetDateTimeParts(
    new Date(nextMidnightAsUtc),
  );
  const offset =
    Date.UTC(
      nextMidnightInRome.year,
      nextMidnightInRome.month - 1,
      nextMidnightInRome.day,
      nextMidnightInRome.hour,
      nextMidnightInRome.minute,
      nextMidnightInRome.second,
    ) - nextMidnightAsUtc;

  return nextMidnightAsUtc - offset - now;
}

function classicGetCurrentDate() {
  const { year, month, day } = classicGetDateTimeParts(new Date());
  return `${String(day).padStart(2, "0")}-${String(month).padStart(
    2,
    "0",
  )}-${year}`;
}

function classicGetDaysBetween(firstDate, secondDate) {
  const datePattern = /^(\d{2})-(\d{2})-(\d{4})$/;
  const firstMatch =
    typeof firstDate === "string" ? datePattern.exec(firstDate) : null;
  const secondMatch =
    typeof secondDate === "string" ? datePattern.exec(secondDate) : null;
  if (!firstMatch || !secondMatch) return null;

  const [, firstDay, firstMonth, firstYear] = firstMatch.map(Number);
  const [, secondDay, secondMonth, secondYear] = secondMatch.map(Number);
  const firstUtc = Date.UTC(firstYear, firstMonth - 1, firstDay);
  const secondUtc = Date.UTC(secondYear, secondMonth - 1, secondDay);
  const firstDateUtc = new Date(firstUtc);
  const secondDateUtc = new Date(secondUtc);
  if (
    firstDateUtc.getUTCDate() !== firstDay ||
    firstDateUtc.getUTCMonth() !== firstMonth - 1 ||
    firstDateUtc.getUTCFullYear() !== firstYear ||
    secondDateUtc.getUTCDate() !== secondDay ||
    secondDateUtc.getUTCMonth() !== secondMonth - 1 ||
    secondDateUtc.getUTCFullYear() !== secondYear
  )
    return null;

  return Math.round((secondUtc - firstUtc) / 86400000);
}

function classicGetBallForStreak(streak) {
  if (streak >= 6) return "master-ball";
  if (streak >= 4) return "ultra-ball";
  if (streak >= 2) return "great-ball";
  return null;
}

function classicGetShinyChance(ball) {
  switch (ball) {
    case "master-ball":
      return 0.1;
    case "ultra-ball":
      return 0.05;
    case "great-ball":
      return 0.02;
    default:
      return 0.01;
  }
}

function classicGetNextStreak(previousStreak, lastWinDate, currentDate) {
  const daysSinceLastWin = classicGetDaysBetween(lastWinDate, currentDate);
  if (daysSinceLastWin === 0) return previousStreak;
  if (daysSinceLastWin === 1 && previousStreak < 7) return previousStreak + 1;
  return 1;
}

function classicShouldResetStreak(user, currentDate) {
  const daysSinceLastWin = classicGetDaysBetween(
    user.classicLastWinDate,
    currentDate,
  );
  const streak = Number.isInteger(user.classicWinStreak)
    ? user.classicWinStreak
    : 0;
  return daysSinceLastWin !== 0 && !(daysSinceLastWin === 1 && streak < 7);
}

function classicGetActiveBall(user, currentDate = classicGetCurrentDate()) {
  if (!user) return null;

  const streak = Number.isInteger(user.classicWinStreak)
    ? user.classicWinStreak
    : 0;
  const daysSinceLastWin = classicGetDaysBetween(
    user.classicLastWinDate,
    currentDate,
  );
  if (daysSinceLastWin === 0) return classicGetBallForStreak(streak);
  if (daysSinceLastWin === 1 && streak < 7)
    return classicGetBallForStreak(streak);
  return null;
}

function classicGetPokedollarReward(tries) {
  if (tries <= 3) return 500;
  if (tries <= 6) return 400;
  if (tries <= 10) return 300;
  if (tries <= 20) return 200;
  return 100;
}

// update a logged user's document on winning
async function updateStatsOnClassicWin(id, pokemon, tries, shinyRoll) {
  const now = new Date();
  const { year, month, day } = classicGetDateTimeParts(now);
  const streakDate = classicGetCurrentDate();
  const historyDate = `${String(day).padStart(2, "0")}-${String(month).padStart(
    2,
    "0",
  )}-${year}`;
  const userRef = firestore.collection("users").doc(id);

  return firestore.runTransaction(async (transaction) => {
    const doc = await transaction.get(userRef);
    const user = doc.data();
    if (!user) return null;

    const previousStreak = Number.isInteger(user.classicWinStreak)
      ? user.classicWinStreak
      : 0;
    const daysSinceLastWin = classicGetDaysBetween(
      user.classicLastWinDate,
      streakDate,
    );
    if (daysSinceLastWin === 0)
      return {
        ball: classicGetBallForStreak(previousStreak),
        shiny: false,
        pokedollarsEarned: 0,
      };

    const ball = classicGetActiveBall(user, streakDate);
    user.classicWinStreak = classicGetNextStreak(
      previousStreak,
      user.classicLastWinDate,
      streakDate,
    );
    user.classicLastWinDate = streakDate;

    const classicWins = Number(user.classicWins) || 0;
    const classicAvgTries = Number(user.classicAvgTries) || 0;
    user.classicAvgTries =
      (classicWins * classicAvgTries + tries) / (classicWins + 1);
    user.classicWins = classicWins + 1;
    const pokedollarsEarned = classicGetPokedollarReward(tries);
    const currentPokedollars =
      Number.isSafeInteger(user.pokedollars) && user.pokedollars >= 0
        ? user.pokedollars
        : 0;
    user.pokedollars = currentPokedollars + pokedollarsEarned;
    if (!Array.isArray(user.classicHistory)) user.classicHistory = [];
    const shiny = shinyRoll < classicGetShinyChance(ball);
    let found = false;
    for (let i = 0; i < user.classicHistory.length; i++) {
      if (user.classicHistory[i].pokemon == pokemon) {
        user.classicHistory[i].timesGuessed++;
        user.classicHistory[i].date = historyDate;
        if (shiny) user.classicHistory[i].shiny = true;
        found = true;
        break;
      }
    }
    if (!found)
      user.classicHistory.push({
        pokemon: pokemon,
        timesGuessed: 1,
        date: historyDate,
        ...(shiny ? { shiny: true } : {}),
      });

    transaction.set(userRef, user);
    return { ball, shiny, pokedollarsEarned };
  });
}

async function generateSentryChallenge(sessionID, session) {
  const challengeID = randomUUID();
  const answerID =
    validSentryIds[Math.floor(Math.random() * validSentryIds.length)];
  const answer = pokemonCache.get(answerID);
  if (!answer) throw new Error("Pokémon not found for sentry challenge");

  const options = [answer.name];
  const wrongOptions = [
    ...new Set(
      Array.from(pokemonCache.values(), (pokemon) => pokemon.name).filter(
        (name) => typeof name === "string" && name !== answer.name,
      ),
    ),
  ];
  if (wrongOptions.length < 3)
    throw new Error("Not enough Pokémon for Sentry challenge options");
  while (options.length < 4) {
    const optionIndex = Math.floor(Math.random() * wrongOptions.length);
    options.push(wrongOptions.splice(optionIndex, 1)[0]);
  }

  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  const startTime = Date.now();
  const footprintUrl = getFootprintUrl(answer.name);
  sentryChallenges[challengeID] = {
    answer: answer.name,
    options: options,
    startTime: startTime,
    expiration: startTime + sentryDurationMs,
    sessionID: sessionID,
    processing: false,
  };
  session.currentChallengeID = challengeID;

  return {
    challengeID: challengeID,
    options: options,
    durationMs: sentryDurationMs,
    createdAt: startTime,
    footprintUrl: footprintUrl,
  };
}

// update a logged user's sentry duty stats
async function updateStatsOnSentryRound(
  id,
  sessionTotal,
  failed,
  sessionRounds,
  gameOver,
) {
  const userRef = firestore.collection("users").doc(id);
  await firestore.runTransaction(async (transaction) => {
    const doc = await transaction.get(userRef);
    const user = doc.data();
    if (!user) return;

    const sentryBestScore = Math.max(user.sentryBestScore || 0, sessionTotal);
    const sentrySessionsCompleted = (user.sentrySessionsCompleted || 0) + 1;
    const sentryFailures = (user.sentryFailures || 0) + (failed ? 1 : 0);
    const sentryBestSession =
      gameOver && sessionRounds > (user.sentryBestSession || 0)
        ? sessionRounds
        : user.sentryBestSession || 0;

    transaction.update(userRef, {
      sentryBestScore,
      sentrySessionsCompleted,
      sentryFailures,
      sentryBestSession,
    });
  });
}

const getFootprintUrl = (pokemonName) =>
  `/public/images/footprints/${encodeURIComponent(pokemonName)}.png`;

const bgPathSelector = (device) =>
  device === "phone"
    ? `/public/images/backgrounds_mobile/${bg_mobile_option}.webp`
    : `/public/images/backgrounds_desktop/${bg_desktop_option}.webp`;

function getShopBackground(backgroundId) {
  return (
    shopBackgrounds.find((background) => background.id === backgroundId) ||
    legacyShopBackgrounds.find((background) => background.id === backgroundId)
  );
}

function getOwnedShopBackgrounds(user) {
  if (!Array.isArray(user.ownedBackgrounds)) return [];
  return [
    ...new Set(
      user.ownedBackgrounds.filter((backgroundId) =>
        getShopBackground(backgroundId),
      ),
    ),
  ];
}

function profileBgPathSelector(backgroundId, device) {
  const background = getShopBackground(backgroundId);
  if (!background) return bgPathSelector(device);
  return device === "phone" ? background.mobileUrl : background.desktopUrl;
}

async function verifyShopUserToken(req, res) {
  const token = req.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    res.status(401).send({ error: "Authentication required" });
    return null;
  }

  try {
    return await auth.verifyIdToken(token);
  } catch (_) {
    res.status(401).send({ error: "Invalid authentication token" });
    return null;
  }
}

const applyAssetCacheHeaders = (res, maxAge) => {
  res.setHeader("Cache-Control", `public, max-age=${maxAge}, must-revalidate`);
};

module.exports = app;
