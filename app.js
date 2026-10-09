const fs = require("fs");
const { randomUUID } = require("crypto");
const express = require("express");
const device = require("express-device");
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
let classicGameID; // to store uuid of current game
let classicPreviousPokemon; // to store the previous generated pokemon
let classicCurrentPokemon; // to store the current generated pokemon
let classicEventActive = false;

// --- SENTRY DUTY MODE VARIABLES ---
let sentryChallenges = {}; // store active sentry duty challenges
const sentryDurationMs = 30 * 1000; // duration for each sentry guess
const sentryFailureLimit = 3; // maximum session failures before game over

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
const appVersion = packageJson.version;

async function initializeClassicGame() {
  const initialPokemon = await firestore
    .collection("pokemons")
    .doc("132")
    .get();
  if (!initialPokemon.exists || !initialPokemon.data())
    throw new Error("Initial Pokémon 132 was not found");

  classicCurrentPokemon = initialPokemon.data();
  await classicGeneratePokemon();
}

app.locals.initializeClassicGame = initializeClassicGame;

// EJS view engine setup
app.set("views", __dirname + "/views");
app.set("view engine", "ejs");

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
  });
});

// generate hints based on user's guess, check if user has won and, if so, call an update to his stats
app.post("/classic", async (req, res, next) => {
  firestore
    .collection("pokemons")
    .where("name", "==", req.body.guess)
    .get()
    .then(async (queryResult) => {
      if (queryResult.docs.length != 1)
        return next(createError(404, "Pokémon not found"));
      let guess = queryResult.docs[0].data();
      // confront guess with answer, return the hints to help user's guesses
      let result = classicVerifyGuess(guess, classicCurrentPokemon);
      // if player has won
      if (result[2]) {
        const shinyRoll = Math.random();
        result[3] = {
          ball: null,
          shiny: shinyRoll < classicGetShinyChance(null),
        };
        if (!classicWinners.includes(req.body.uid))
          classicWinners[classicWinners.length] = req.body.uid;
        if (req.body.token != null) {
          try {
            const decodedToken = await auth.verifyIdToken(req.body.token);
            if (!classicWinners.includes(decodedToken.uid)) {
              result[3] = await updateStatsOnClassicWin(
                decodedToken.uid,
                req.body.guess,
                req.body.tries,
                shinyRoll,
              );
              classicWinners[classicWinners.length] = decodedToken.uid;
            }
          } catch (err) {
            console.error(err);
          }
        }
      }
      res.status(200);
      res.send(result);
    })
    .catch((err) => {
      console.error(err);
      next(createError(500));
    });
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

app.get("/classic/ball", async (req, res, next) => {
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
      const daysSinceLastWin = classicGetDaysBetween(
        user.classicLastWinDate,
        currentDate,
      );
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
  firestore
    .collection("users")
    .orderBy("classicWins", "desc")
    .limit(10)
    .get()
    .then((queryResult) => {
      let topTen = [];
      queryResult.forEach((user) => {
        topTen[topTen.length] = {
          id: user.id,
          username: user.data().username,
          classicWins: user.data().classicWins,
        };
      });
      res.status(200);
      res.render("classicRanking", {
        rankingData: topTen,
        bg: bgPathSelector(req.device.type),
      });
    })
    .catch((err) => {
      console.error(err);
      next(createError(500));
    });
});

// send a boolean stating if user can play the current game
app.get("/classic/canPlay/uid=:uid&gid=:gid", (req, res) => {
  let canPlay = !classicWinners.includes(req.params.uid);
  if (canPlay && req.params.gid != null)
    canPlay = !classicWinners.includes(req.params.gid);
  res.status(200);
  res.send(canPlay);
});

// render sentry duty mode page
app.get("/sentry", (req, res) => {
  res.render("sentryMode", {
    bg: bgPathSelector(req.device.type),
  });
});

// verify the player's sentry duty guess
app.post("/sentry", async (req, res, next) => {
  try {
    const challengeID = req.body.challengeID;
    const selected = req.body.selected;
    const challenge = sentryChallenges[challengeID];

    if (!challenge || Date.now() > challenge.expiration) {
      res.status(410);
      res.send({ correct: false, timeout: true });
      return;
    }

    const elapsedMs = Date.now() - challenge.startTime;
    const timedOut = elapsedMs > sentryDurationMs;
    const correct = selected === challenge.answer && !timedOut;
    const baseScore = 1000;
    const decayFactor = 0.92;
    const score = correct
      ? Math.max(
          0,
          Math.ceil(baseScore * Math.pow(decayFactor, elapsedMs / 1000)),
        )
      : 0;

    if (req.body.token != null) {
      auth
        .verifyIdToken(req.body.token)
        .then((decodedToken) => {
          updateStatsOnSentryRound(
            decodedToken.uid,
            score,
            !correct,
            req.body.sessionTotalScore + (correct ? score : 0),
            req.body.sessionRounds || 0,
            req.body.gameOver || false,
          );
        })
        .catch((err) => console.error(err));
    }

    delete sentryChallenges[challengeID];
    res.status(200);
    res.send({
      correct: correct,
      score: score,
      answer: challenge.answer,
      timeout: timedOut,
      elapsedMs: elapsedMs,
    });
  } catch (err) {
    console.error(err);
    next(createError(500));
  }
});

// send current sentry duty challenge to the user
app.get("/sentry/state", async (_, res, next) => {
  try {
    const challenge = await generateSentryChallenge();
    res.status(200);
    res.send(challenge);
  } catch (err) {
    console.error(err);
    next(createError(500));
  }
});

// render top 10 sentry duty users page
app.get("/sentry/ranking", async (req, res) => {
  firestore
    .collection("users")
    .orderBy("sentryBestScore", "desc")
    .limit(10)
    .get()
    .then((queryResult) => {
      let topTen = [];
      queryResult.forEach((user) => {
        topTen[topTen.length] = {
          id: user.id,
          username: user.data().username,
          score: user.data().sentryBestScore || 0,
        };
      });
      res.status(200);
      res.render("sentryRanking", {
        rankingData: topTen,
        bg: bgPathSelector(req.device.type),
      });
    })
    .catch((err) => {
      console.error(err);
      next(createError(500));
    });
});

// generate new unique id (uuid) on request
app.get("/user/id", (_, res) => {
  res.status(201);
  res.send(randomUUID());
});

app.put("/user/:gid", async (req, res, next) => {
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

app.patch("/user/:gid/username", async (req, res, next) => {
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
    const doc = await userRef.get();
    if (!doc.exists) return res.status(404).send({ error: "User not found" });

    await userRef.update({ username });
    return res.status(204).end();
  } catch (err) {
    console.error(err);
    next(createError(500));
  }
});

// render requested user's profile page
app.get("/user/:gid/profile", async (req, res, next) => {
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
          bg: bgPathSelector(req.device.type),
        });
      }
    })
    .catch((err) => {
      console.error(err);
      next(createError(500));
    });
});

// render requested user's pokedex page
app.get("/user/:gid/pokedex", async (req, res, next) => {
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
  let pokemonSnapshot;
  if (useEventPool) {
    const pokemonName =
      eligibleEventPokemon[
        Math.floor(Math.random() * eligibleEventPokemon.length)
      ];
    const queryResult = await firestore
      .collection("pokemons")
      .where("name", "==", pokemonName)
      .limit(1)
      .get();
    if (queryResult.docs.length !== 1)
      throw new Error(`Event Pokémon "${pokemonName}" was not found`);
    pokemonSnapshot = queryResult.docs[0];
  } else {
    let pokemonID = previousPokemon.ID;
    while (pokemonID == previousPokemon.ID)
      pokemonID = Math.floor(Math.random() * 649 + 1);

    pokemonSnapshot = await firestore
      .collection("pokemons")
      .doc(pokemonID.toString())
      .get();
  }
  const nextPokemon = pokemonSnapshot.data();
  if (!pokemonSnapshot.exists || !nextPokemon)
    throw new Error("Generated Pokémon was not found");

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
    return { ball, shiny };
  });
}

async function generateSentryChallenge() {
  const challengeID = randomUUID();
  let answer, answerDoc, answerID;

  // pick a random pokemon that is not in the bad footprints list
  for (let tries = 0; tries < 100; tries++) {
    answerID = Math.floor(Math.random() * 649 + 1);
    answerDoc = await firestore
      .collection("pokemons")
      .doc(answerID.toString())
      .get();
    if (!answerDoc.exists) continue;

    const candidate = answerDoc.data();
    if (badFootprints.includes(candidate.name)) continue;

    answer = candidate;
    break;
  }

  if (!answer) throw new Error("Pokémon not found for sentry challenge");

  const options = [answer.name];

  while (options.length < 4) {
    const optionID = Math.floor(Math.random() * 649 + 1);
    if (optionID == answerID) continue;

    const optionDoc = await firestore
      .collection("pokemons")
      .doc(optionID.toString())
      .get();
    if (!optionDoc.exists) continue;

    const optionName = optionDoc.data().name;
    if (!options.includes(optionName)) options.push(optionName);
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
  };

  setTimeout(() => {
    delete sentryChallenges[challengeID];
  }, sentryDurationMs * 2);

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
  _,
  failed,
  sessionTotal,
  sessionRounds,
  gameOver,
) {
  firestore
    .collection("users")
    .doc(id)
    .get()
    .then((doc) => {
      let user = doc.data();
      if (user != undefined) {
        user.sentryBestScore = user.sentryBestScore || 0;
        if (sessionTotal > user.sentryBestScore)
          user.sentryBestScore = sessionTotal;
        user.sentrySessionsCompleted = (user.sentrySessionsCompleted || 0) + 1;
        user.sentryFailures = user.sentryFailures || 0;
        if (failed) user.sentryFailures++;
        user.sentryBestSession = user.sentryBestSession || 0;
        if (gameOver && sessionRounds > user.sentryBestSession)
          user.sentryBestSession = sessionRounds;
        firestore.collection("users").doc(id).set(user);
      }
    })
    .catch((err) => console.error(err));
}

const getFootprintUrl = (pokemonName) =>
  `/public/images/footprints/${encodeURIComponent(pokemonName)}.png`;

const bgPathSelector = (device) =>
  device === "phone"
    ? `/public/images/backgrounds_mobile/${bg_mobile_option}.webp`
    : `/public/images/backgrounds_desktop/${bg_desktop_option}.webp`;

const applyAssetCacheHeaders = (res, maxAge) => {
  res.setHeader("Cache-Control", `public, max-age=${maxAge}, must-revalidate`);
};

module.exports = app;
