const express = require("express");
const device = require("express-device");
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const fs = require("fs");
const createError = require("http-errors");
const logger = require("morgan");
const path = require("path");
const serviceAccount = require("/etc/secrets/service_account_admin_sdk");
const { v4: uuid } = require("uuid");

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

var winners = []; // to store uuid of players who have won the current game
var gameID; // to store uuid of current game
var currentPokemon; // to store the generated pokemon
var generateTimestamp; // to store the time of pokemon generation
const generateInterval = 5 * 60 * 1000; // the interval between each generation (ms)

var bg_desktop_option; // to store current background option for rendering desktop views
var bg_mobile_option; // to store current background option for rendering mobile views

var bg_desktop_number = fs.readdirSync(
  "./public/images/backgrounds_desktop"
).length; // number of desktop background options
var bg_mobile_number = fs.readdirSync(
  "./public/images/backgrounds_mobile"
).length; //number of mobile background options

const app = express(); // new express app
const firestore = admin.firestore(); // reference to firestore cloud storage

generatePokemon(); // first pokemon is generated here
setInterval(() => generatePokemon(), generateInterval); // new pokemon will be generated at set intervals

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(express.json());
app.use(express.static(path.join(__dirname, "")));
app.use(device.capture());

// send firebase configuration to client
app.get("/env/fb", (req, res) => {
  res.status(200);
  res.send(firebaseConfig);
});

// render home page
app.get("/", (req, res) => {
  if (req.device.type == "phone")
    var bgPath =
      "/public/images/backgrounds_mobile/" + bg_mobile_option + ".webp";
  else
    var bgPath =
      "/public/images/backgrounds_desktop/" + bg_desktop_option + ".webp";
  res.render("index", { bg: bgPath });
});

// generate hints based on user's guess, check if user has won and, if so, call an update to his stats
app.post("/", async (req, res) => {
  firestore
    .collection("pokemons")
    .where("name", "==", req.body.guess)
    .get()
    .then((queryResult) => {
      var guess = queryResult.docs[0].data();
      // confronting guess with answer, returns the hints to help user's guesses
      var response = verifyGuess(guess, currentPokemon);
      if (response.hasWon) {
        // winners won't be able to play until a new pokemon is generated
        winners[winners.length] = req.body.uid;
        // if user is logged in, update his stats
        if (req.body.googleID != null)
          updateStatsOnWinning(
            req.body.googleID,
            req.body.guess,
            req.body.tries
          );
      }
      res.status(201);
      res.send([guess, response]);
    });
});

// generate new unique id (uuid) on request
app.get("/user/id", (req, res) => {
  res.status(201);
  res.send(uuid());
});

// send a boolean stating if user can play current game, remaining time before next pokemon generation and current game ID
app.get("/user/:uuid/status", (req, res) => {
  var remainingTime = generateTimestamp + generateInterval - Date.now();
  res.status(200);
  res.send([winners.includes(req.params.uuid), remainingTime, gameID]);
});

app.put("/user/:gid/update", async (req, res) => {
  firestore
    .collection("users")
    .doc(req.params.gid)
    .get()
    .then((doc) => {
      var user = doc.data();
      if (user == undefined) {
        // if is a first-login user, set up a fresh document
        user = {
          name: req.body.name,
          wins: 0,
          avgTries: 0,
          history: [],
        };
        // create the new document
        firestore.collection("users").doc(req.params.gid).set(user);
        res.status(201);
      } else res.status(304);
      res.end();
    });
});

// render requested user's profile page
app.get("/user/:gid/profile", async (req, res, next) => {
  firestore
    .collection("users")
    .doc(req.params.gid)
    .get()
    .then((doc) => {
      var user = doc.data();
      if (user == undefined)
        next(createError(404, "User does not exist or has not played yet."));
      else {
        if (req.device.type == "phone")
          var bgPath =
            "/public/images/backgrounds_mobile/" + bg_mobile_option + ".webp";
        else
          var bgPath =
            "/public/images/backgrounds_desktop/" + bg_desktop_option + ".webp";
        res.status(200);
        res.render("profile", {
          name: user.name,
          wins: user.wins,
          avgTries: Math.round(user.avgTries * 100) / 100,
          bg: bgPath,
        });
      }
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
      if (user == undefined)
        next(createError(404, "User does not exist or has not played yet."));
      else {
        if (req.device.type == "phone")
          var bgPath =
            "/public/images/backgrounds_mobile/" + bg_mobile_option + ".webp";
        else
          var bgPath =
            "/public/images/backgrounds_desktop/" + bg_desktop_option + ".webp";
        res.status(200);
        res.render("pokedex", {
          name: user.name,
          history: user.history,
          bg: bgPath,
        });
      }
    });
});

// render top 10 users' ranking page
app.get("/users/ranking", async (req, res) => {
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
      if (req.device.type == "phone")
        var bgPath =
          "/public/images/backgrounds_mobile/" + bg_mobile_option + ".webp";
      else
        var bgPath =
          "/public/images/backgrounds_desktop/" + bg_desktop_option + ".webp";
      res.status(200);
      res.render("rankings", { rankingData: topTen, bg: bgPath });
    });
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = err;
  if (req.device.type == "phone")
    var bgPath =
      "/public/images/backgrounds_mobile/" + bg_mobile_option + ".webp";
  else
    var bgPath =
      "/public/images/backgrounds_desktop/" + bg_desktop_option + ".webp";
  res.status(err.status || 500);
  res.render("error", { bg: bgPath });
});

module.exports = app;

async function generatePokemon() {
  winners.length = 0;
  gameID = uuid();
  generateTimestamp = Date.now();
  bg_desktop_option = Math.floor(Math.random() * bg_desktop_number) + 1;
  bg_mobile_option = Math.floor(Math.random() * bg_mobile_number) + 1;
  var pokemonID = Math.floor(Math.random() * 151 + 1);
  firestore
    .collection("pokemons")
    .doc(pokemonID.toString())
    .get()
    .then((pokemon) => {
      currentPokemon = pokemon.data();
      console.log("!!! Current Pokemon: " + currentPokemon.name + " !!!");
    });
}

// verify the client's guess, generate related hints
function verifyGuess(guess, answer) {
  var response = {
    hasWon: true,
    habitat: "correct",
    color: "correct",
    type: "correct",
    fullyEvolved: "correct",
    evolutionLevel: "correct",
  };
  var count = 0;

  if (guess.name != answer.name) {
    response.hasWon = false;
    if (guess.fullyEvolved != answer.fullyEvolved)
      response.fullyEvolved = "wrong";
    if (guess.evolutionLevel != answer.evolutionLevel)
      response.evolutionLevel = "wrong";
    if (guess.habitat != answer.habitat) response.habitat = "wrong";

    var guessColors = guess.color.split(", ");
    for (var i = 0; i < guessColors.length; i++)
      if (answer.color.includes(guessColors[i])) count++;
    var colors = answer.color.split(", ");
    if (count == 0) response.color = "wrong";
    else if (colors.length != count || guessColors.length != count)
      response.color = "partial";
    count = 0;

    var guessTypes = guess.type.split(", ");
    for (var i = 0; i < guessTypes.length; i++)
      if (answer.type.includes(guessTypes[i])) count++;
    var types = answer.type.split(", ");
    if (count == 0) response.type = "wrong";
    else if (types.length != count || guessTypes.length != count)
      response.type = "partial";
  }
  return response;
}

// update a logged user's document on winning
async function updateStatsOnWinning(id, pokemon, tries) {
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
    });
}
