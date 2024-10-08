const express = require("express");
const device = require("express-device");
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const fs = require("fs");
const createError = require("http-errors");
const logger = require("morgan");
const { v4: uuid } = require("uuid");
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

var classicWinners = []; // to store uuid of players who have won the current game
var classicGameID; // to store uuid of current game
var classicPreviousPokemon; // to store the previous generated pokemon
var classicCurrentPokemon; // to store the current generated pokemon
var bg_desktop_option; // to store current background option for rendering desktop views
var bg_mobile_option; // to store current background option for rendering mobile views

var bg_desktop_number = fs.readdirSync(
  "./public/images/backgrounds_desktop"
).length; // number of desktop background options
var bg_mobile_number = fs.readdirSync(
  "./public/images/backgrounds_mobile"
).length; //number of mobile background options

const app = express(); // new express app
const auth = admin.auth(); // reference to auth service
const firestore = admin.firestore(); // reference to firestore cloud storage service

firestore
  .collection("pokemons")
  .doc("132")
  .get()
  .then((pokemon) => {
    classicCurrentPokemon = pokemon.data();
    classicGeneratePokemon(); // first pokemon is generated here
  });

// view engine setup
app.set("views", __dirname + "/views");
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(express.json());
app.use(device.capture());
app.use(
  "/public/js",
  express.static(__dirname + "/public/js", {
    setHeaders: function (res, path) {
      res.setHeader("Cache-Control", `public, max-age=3600, must-revalidate`);
    },
  })
);
app.use(
  "/public/stylesheets",
  express.static(__dirname + "/public/stylesheets", {
    setHeaders: function (res, path) {
      res.setHeader("Cache-Control", `public, max-age=3600, must-revalidate`);
    },
  })
);
app.use(
  "/public",
  express.static(__dirname + "/public", {
    setHeaders: function (res, path) {
      res.setHeader(
        "Cache-Control",
        `public, max-age=31536000, must-revalidate`
      );
    },
  })
);

// send firebase configuration to client
app.get("/env/fb", (req, res) => {
  res.status(200);
  res.send(firebaseConfig);
});

// remove if there will be more game modes in the future
app.get("/", (req, res) => {
  res.redirect("/classic");
});

// render home page
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
      var guess = queryResult.docs[0].data();
      // confront guess with answer, return the hints to help user's guesses
      var result = classicVerifyGuess(guess, classicCurrentPokemon);
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
                  req.body.tries
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

// send a boolean stating if user can play the current game
app.get("/classic/canPlay/uid=:uid&gid=:gid", (req, res) => {
  var canPlay = !classicWinners.includes(req.params.uid);
  if (canPlay && req.params.gid != null)
    canPlay = !classicWinners.includes(req.params.gid);
  res.status(200);
  res.send(canPlay);
});

// send game ID and remaining time before next generation
app.get("/classic/state", (req, res) => {
  res.status(200);
  res.send([
    classicGameID,
    getClassicRemainingTime(),
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
      var topTen = [];
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

// generate new unique id (uuid) on request
app.get("/user/id", (req, res) => {
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
            var user = doc.data();
            if (user == undefined) {
              // first-login user, set up a fresh document
              user = {
                name: req.body.name,
                wins: 0,
                avgTries: 0,
                history: [],
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
      var user = doc.data();
      if (user == undefined) next(createError(404, "User does not exist"));
      else {
        res.status(200);
        res.render("profile", {
          name: user.name,
          wins: user.wins,
          avgTries: Math.round(user.avgTries * 100) / 100,
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
      var user = doc.data();
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
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = err;
  res.status(err.status || 500);
  res.render("error", { bg: bgPathSelector(req.device.type) });
});

module.exports = app;

async function classicGeneratePokemon() {
  classicWinners = [];
  classicGameID = uuid();
  var previous_bg = bg_desktop_option;
  while (previous_bg == bg_desktop_option)
    bg_desktop_option = Math.floor(Math.random() * bg_desktop_number) + 1;
  previous_bg = bg_mobile_option;
  while (previous_bg == bg_mobile_option)
    bg_mobile_option = Math.floor(Math.random() * bg_mobile_number) + 1;
  var pokemonID;
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
  setTimeout(classicGeneratePokemon, getClassicRemainingTime());
}

function getClassicRemainingTime() {
  var nextGeneration = new Date();
  nextGeneration.setDate(nextGeneration.getDate() + 1);
  nextGeneration.setHours(0, 0, 0, 0);
  return nextGeneration.getTime() - Date.now();
}

function bgPathSelector(device) {
  if (device == "phone")
    return "/public/images/backgrounds_mobile/" + bg_mobile_option + ".webp";
  else
    return "/public/images/backgrounds_desktop/" + bg_desktop_option + ".webp";
}

// verify the client's guess, generate related hints
function classicVerifyGuess(guess, answer) {
  var response = {
    habitat: "correct",
    colors: "correct",
    types: "correct",
    fullyEvolved: "correct",
    evolutionLevel: "correct",
    gen: "correct",
  };
  var count = 0;
  var hasWon = true;

  if (guess.name != answer.name) {
    hasWon = false;
    if (guess.fullyEvolved != answer.fullyEvolved)
      response.fullyEvolved = "wrong";
    if (guess.evolutionLevel > answer.evolutionLevel)
      response.evolutionLevel = "wrong-lower";
    if (guess.evolutionLevel < answer.evolutionLevel)
      response.evolutionLevel = "wrong-higher";
    if (guess.habitat != answer.habitat) response.habitat = "wrong";
    if (guess.gen > answer.gen) response.gen = "wrong-lower";
    if (guess.gen < answer.gen) response.gen = "wrong-higher";

    var guessColors = guess.colors;
    for (var i = 0; i < guessColors.length; i++)
      if (answer.colors.includes(guessColors[i])) count++;
    var colors = answer.colors;
    if (count == 0) response.colors = "wrong";
    else if (colors.length != count || guessColors.length != count)
      response.colors = "partial";
    count = 0;

    var guessTypes = guess.types;
    for (var i = 0; i < guessTypes.length; i++)
      if (answer.types.includes(guessTypes[i])) count++;
    var types = answer.types;
    if (count == 0) response.types = "wrong";
    else if (types.length != count || guessTypes.length != count)
      response.types = "partial";
  }
  return [guess, response, hasWon];
}

// update a logged user's document on winning
async function updateStatsOnClassicWin(id, pokemon, tries) {
  firestore
    .collection("users")
    .doc(id)
    .get()
    .then((doc) => {
      var user = doc.data();
      if (user != undefined) {
        // updating stats
        user.avgTries = (user.wins * user.avgTries + tries) / (user.wins + 1);
        user.wins++;
        // updating the pokedex
        var found = false;
        for (var i = 0; i < user.history.length; i++) {
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
