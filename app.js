const fs = require("fs");
const { v4: uuid } = require("uuid");
const express = require("express");
const device = require("express-device");
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const logger = require("morgan");
const createError = require("http-errors");
const packageJson = require("./package.json");
const badFootprints = require("./data/badFootprints.json");
const serviceAccount = require("/etc/secrets/service_account_admin_sdk");

// initialize Firebase with admin privileges
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: functions.config().databaseURL,
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
const auth = admin.auth(); // reference to auth service
const firestore = admin.firestore(); // reference to firestore cloud storage service
const appVersion = packageJson.version;

firestore
  .collection("pokemons")
  .doc("132")
  .get()
  .then((pokemon) => {
    classicCurrentPokemon = pokemon.data();
    classicGeneratePokemon(); // first pokemon is generated here
  });

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
    .then((queryResult) => {
      if (queryResult.docs.length != 1)
        next(createError(404, "Pokémon not found"));
      let guess = queryResult.docs[0].data();
      // confront guess with answer, return the hints to help user's guesses
      let result = classicVerifyGuess(guess, classicCurrentPokemon);
      // if player has won
      if (result[2]) {
        if (!classicWinners.includes(req.body.uid))
          classicWinners[classicWinners.length] = req.body.uid;
        if (req.body.token != null)
          auth
            .verifyIdToken(req.body.token)
            .then((decodedToken) => {
              if (!classicWinners.includes(decodedToken.uid)) {
                // user is logged in, update his stats
                updateStatsOnClassicWin(
                  decodedToken.uid,
                  req.body.guess,
                  req.body.tries,
                );
                classicWinners[classicWinners.length] = decodedToken.uid;
              }
            })
            .catch((err) => console.error(err));
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
  ]);
});

// render top 10 classic mode users page
app.get("/classic/ranking", async (req, res) => {
  firestore
    .collection("users")
    .orderBy("wins", "desc")
    .limit(10)
    .get()
    .then((queryResult) => {
      let topTen = [];
      queryResult.forEach((user) => {
        topTen[topTen.length] = {
          id: user.id,
          name: user.data().name,
          wins: user.data().wins,
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
    .orderBy("bestSentryScore", "desc")
    .limit(10)
    .get()
    .then((queryResult) => {
      let topTen = [];
      queryResult.forEach((user) => {
        topTen[topTen.length] = {
          id: user.id,
          name: user.data().name,
          score: user.data().bestSentryScore || 0,
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
  res.send(uuid());
});

app.put("/user/:gid", async (req, res) => {
  auth
    .verifyIdToken(req.body.token)
    .then((decodedToken) => {
      if (decodedToken.uid == req.params.gid)
        firestore
          .collection("users")
          .doc(decodedToken.uid)
          .get()
          .then((doc) => {
            let user = doc.data();
            if (user == undefined) {
              // first-login user, set up a fresh document
              user = {
                name: req.body.name,
                wins: 0,
                avgTries: 0,
                history: [],
                bestSentryScore: 0,
                sentrySessionsCompleted: 0,
                sentryFailures: 0,
                bestSentrySession: 0,
              };
              // create the new document
              firestore.collection("users").doc(decodedToken.uid).set(user);
              res.status(201);
            } else res.status(204);
          });
      else res.status(401);
    })
    .catch((err) => {
      console.error(err);
      res.status(401);
    });
  res.end();
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
          name: user.name,
          wins: user.wins,
          avgTries: Math.round(user.avgTries * 100) / 100,
          bestSentryScore: user.bestSentryScore || 0,
          sentrySessionsCompleted: sessions,
          sentryAccuracy: accuracy,
          bestSentrySession: user.bestSentrySession || 0,
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
          name: user.name,
          history: user.history,
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
  classicWinners = [];
  classicGameID = uuid();
  let previous_bg = bg_desktop_option;
  while (previous_bg == bg_desktop_option)
    bg_desktop_option = Math.floor(Math.random() * bg_desktop_number) + 1;
  previous_bg = bg_mobile_option;
  while (previous_bg == bg_mobile_option)
    bg_mobile_option = Math.floor(Math.random() * bg_mobile_number) + 1;
  let pokemonID;
  classicPreviousPokemon = classicCurrentPokemon;
  pokemonID = classicPreviousPokemon.ID;
  while (pokemonID == classicPreviousPokemon.ID)
    pokemonID = Math.floor(Math.random() * 649 + 1);
  firestore
    .collection("pokemons")
    .doc(pokemonID.toString())
    .get()
    .then((pokemon) => {
      classicCurrentPokemon = pokemon.data();
      console.log("#DEV Solution: " + classicCurrentPokemon.name);
    })
    .catch((err) => console.error(err));
  setTimeout(classicGeneratePokemon, classicGetRemainingTime());
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

    let guessColors = guess.colors || [];
    let answerColors = answer.colors || [];
    const COLOR_MATCH_THRESHOLD = 8;
    let matchedColors = 0;

    // --------------------------------------------------------
    // Find the optimal one-to-one color matching.
    //
    // A pair of colors is considered a match if:
    //     ΔE94 < 8
    //
    // Each guess color can match at most one answer color.
    // Each answer color can match at most one guess color.
    //
    // The order of the colors in either array has no influence
    // on the result.
    // --------------------------------------------------------

    function findBestColorMatching(guessIndex, usedAnswerColors, matchCount) {
      // All guess colors have been considered.
      if (guessIndex >= guessColors.length) {
        matchedColors = Math.max(matchedColors, matchCount);
        return;
      }

      // Option 1: do not match this guess color.
      findBestColorMatching(guessIndex + 1, usedAnswerColors, matchCount);

      const guessColor = guessColors[guessIndex].toLowerCase();

      // Try matching this guess color with every unused
      // answer color whose ΔE94 is below the threshold.
      for (
        let answerIndex = 0;
        answerIndex < answerColors.length;
        answerIndex++
      ) {
        if (usedAnswerColors.has(answerIndex)) continue;

        const answerColor = answerColors[answerIndex].toLowerCase();
        const distance = colorDistance(guessColor, answerColor);
        if (distance > COLOR_MATCH_THRESHOLD) continue;

        usedAnswerColors.add(answerIndex);
        findBestColorMatching(guessIndex + 1, usedAnswerColors, matchCount + 1);
        usedAnswerColors.delete(answerIndex);
      }
    }

    findBestColorMatching(0, new Set(), 0);

    if (
      guessColors.length === answerColors.length &&
      matchedColors === answerColors.length
    )
      response.colors = "correct";
    else if (matchedColors > 0) response.colors = "partial";
    else response.colors = "wrong";
  }
  return [guess, response, hasWon];
}

function classicGetRemainingTime() {
  let nextGeneration = new Date();
  nextGeneration.setDate(nextGeneration.getDate() + 1);
  nextGeneration.setHours(0, 0, 0, 0);
  return nextGeneration.getTime() - Date.now();
}

// update a logged user's document on winning
async function updateStatsOnClassicWin(id, pokemon, tries) {
  firestore
    .collection("users")
    .doc(id)
    .get()
    .then((doc) => {
      let user = doc.data();
      if (user != undefined) {
        // updating stats
        user.avgTries = (user.wins * user.avgTries + tries) / (user.wins + 1);
        user.wins++;
        // updating the pokedex
        let found = false;
        for (let i = 0; i < user.history.length; i++) {
          if (user.history[i].pokemon == pokemon) {
            user.history[i].timesGuessed++;
            found = true;
            break;
          }
        }
        if (!found) user.history.push({ pokemon: pokemon, timesGuessed: 1 });
        // update the modified document
        firestore.collection("users").doc(id).set(user);
      }
    })
    .catch((err) => console.error(err));
}

async function generateSentryChallenge() {
  const challengeID = uuid();
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
        user.bestSentryScore = user.bestSentryScore || 0;
        if (sessionTotal > user.bestSentryScore)
          user.bestSentryScore = sessionTotal;
        user.sentrySessionsCompleted = (user.sentrySessionsCompleted || 0) + 1;
        user.sentryFailures = user.sentryFailures || 0;
        if (failed) user.sentryFailures++;
        user.bestSentrySession = user.bestSentrySession || 0;
        if (gameOver && sessionRounds > user.bestSentrySession)
          user.bestSentrySession = sessionRounds;
        firestore.collection("users").doc(id).set(user);
      }
    })
    .catch((err) => console.error(err));
}

function hexToRgb(hex) {
  hex = hex.replace("#", "");
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
  };
}

function rgbToLab({ r, g, b }) {
  r /= 255;
  g /= 255;
  b /= 255;

  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

  const transform = (value) =>
    value > 0.008856 ? Math.pow(value, 1 / 3) : 7.787 * value + 16 / 116;

  const fx = transform(x);
  const fy = transform(y);
  const fz = transform(z);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

function colorDistance(hex1, hex2) {
  const lab1 = rgbToLab(hexToRgb(hex1));
  const lab2 = rgbToLab(hexToRgb(hex2));
  const deltaL = lab1.l - lab2.l;

  const C1 = Math.sqrt(lab1.a * lab1.a + lab1.b * lab1.b);
  const C2 = Math.sqrt(lab2.a * lab2.a + lab2.b * lab2.b);
  const deltaC = C1 - C2;

  const deltaA = lab1.a - lab2.a;
  const deltaB = lab1.b - lab2.b;
  let deltaH2 = deltaA * deltaA + deltaB * deltaB - deltaC * deltaC;
  deltaH2 = Math.max(0, deltaH2);

  const K1 = 0.045;
  const K2 = 0.015;
  const SL = 1;
  const SC = 1 + K1 * C1;
  const SH = 1 + K2 * C1;

  return Math.sqrt(
    Math.pow(deltaL / SL, 2) +
      Math.pow(deltaC / SC, 2) +
      deltaH2 / Math.pow(SH, 2),
  );
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
