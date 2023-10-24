const initializeApp = require("firebase/app").initializeApp;
const Firestore = require("firebase/firestore");
var createError = require("http-errors");
var logger = require("morgan");
var path = require("path");
var express = require("express");

const { v4: uuidv4 } = require("uuid");

const firebaseConfig = {
  apiKey: "AIzaSyBkHJGjV3MdHdqX54BwTrCkKuQt3tmzEhQ",
  authDomain: "pokedle-14739.firebaseapp.com",
  projectId: "pokedle-14739",
  storageBucket: "pokedle-14739.appspot.com",
  messagingSenderId: "576792023907",
  appId: "1:576792023907:web:87bfee996f8bb14b2c3956",
  measurementId: "G-TBRPL5L80L",
};

// initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = Firestore.getFirestore(firebaseApp);

var index = 0; // index of winners array
var winners = []; // to store uuid of players who have won the current round
var timestamp; // to store the time when pokemon is generated
var generatedPokemon; // to store the generated pokemon
var generateInterval = 180; // in seconds

// picks a random pokemon from db
async function generatePokemon() {
  index = 0;
  winners.length = 0;
  timestamp = Date.now();
  var id = Math.floor(Math.random() * 151 + 1);
  var pokemonRef = Firestore.doc(db, "pokemons", id.toString());
  var pokemonDoc = await Firestore.getDoc(pokemonRef);
  generatedPokemon = pokemonDoc.data();
  console.log("!!! Current Pokemon: " + generatedPokemon.name + " !!!");
}

// function to verify the client's guess
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
    for (var i = 0; i < guessColors.length; i++) {
      if (answer.color.includes(guessColors[i])) {
        count++;
      }
    }
    var colors = answer.color.split(", ");
    if (count == 0) response.color = "wrong";
    else if (colors.length != count || guessColors.length != count)
      response.color = "partial";
    count = 0;

    var guessTypes = guess.type.split(", ");
    for (var i = 0; i < guessTypes.length; i++) {
      if (answer.type.includes(guessTypes[i])) {
        count++;
      }
    }
    var types = answer.type.split(", ");
    if (count == 0) response.type = "wrong";
    else if (types.length != count || guessTypes.length != count)
      response.type = "partial";
  }
  return response;
}

// function to get a user from db given its id
async function getUserById(id) {
  var userRef = Firestore.doc(db, "users", id);
  var userDoc = await Firestore.getDoc(userRef);
  return userDoc.data();
}

// Invoked when a logged user wins a game, to update his statistics
async function updateStatsOnWinning(id, pokemon, tries) {
  // get user statistics
  var user = await getUserById(id);
  // update with new statistics
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
  if (!found) {
    user.history.push({ pokemon: pokemon, timesGuessed: 1 });
  }
  // update the document
  var userRef = Firestore.doc(db, "users", id);
  Firestore.setDoc(userRef, user);
}

// the first pokemon is generated here
generatePokemon();
setInterval(() => generatePokemon(), generateInterval * 1000); // and from now on a new pokemon will be generated every 3 minutes

var app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(express.json());
app.use(express.static(path.join(__dirname, "")));

// renders home page
app.get("/", (req, res) => {
  res.render("index");
});

// When a user guesses, checks if user has won and updates stats if user is logged in.
app.post("/", async (req, res) => {
  // make a query to get data about guessed pokémon
  var q = Firestore.query(
    Firestore.collection(db, "pokemons"),
    Firestore.where("name", "==", req.body.guess)
  );
  pokemonDoc = await Firestore.getDocs(q);
  pokemonDoc.forEach((doc) => {
    var guess = doc.data();
    // confronting guess with answer, this function returns the hints to help user's guesses
    var response = verifyGuess(guess, generatedPokemon);
    if (response.hasWon) {
      // winners won't be able to play until a new pokemon is generated
      winners[index] = req.body.uid;
      index++;
      if (req.body.googleID != null) {
        // means that user is logged in.
        updateStatsOnWinning(req.body.googleID, req.body.guess, req.body.tries);
      }
    }
    res.send([guess, response]);
  });
});

// renders rankings page, top 10 users
app.get("/rankings", async (req, res) => {
  var userRef = Firestore.collection(db, "users");
  const q = Firestore.query(
    userRef,
    Firestore.orderBy("wins", "desc"),
    Firestore.limit(10)
  );
  var userDocs = await Firestore.getDocs(q);
  var i = 0;
  var topTen = [];
  userDocs.forEach((doc) => {
    var obj = {};
    obj.id = doc.id;
    obj.name = doc.data().name;
    obj.wins = doc.data().wins;
    topTen[i] = obj;
    i++;
  });
  res.render("rankings", { rankingData: topTen });
});

// renders profile data about requested user
app.get("/profile/:id", async (req, res, next) => {
  // user.uid is always a 28 characters string
  if (req.params.id.length != 28) next();
  // check if user actually exists
  var answer = await getUserById(req.params.id);
  if (answer == null) next();
  else {
    res.locals.name = answer.name;
    res.locals.wins = answer.wins;
    res.locals.avgTries = Math.round(answer.avgTries * 100) / 100;
    res.render("profile");
  }
});

// Invoked on login, creates a document if user is not existent
app.put("/profile/:id", async (req, res) => {
  if (req.params.id.length != 28 || req.body.name == null)
    res.status(400).end();
  var answer = await getUserById(req.params.id);
  if (answer == null) {
    answer = {
      name: req.body.name,
      wins: 0,
      avgTries: 0,
      history: [],
    };
    var userRef = Firestore.doc(db, "users", req.params.id);
    Firestore.setDoc(userRef, answer);
    // end request-response cycle
    res.status(201).end();
  } else res.status(304).end();
});

// renders requested user's pokedex page
app.get("/profile/:id/pokedex", async (req, res, next) => {
  // user.uid is always a 28 characters string
  if (req.params.id.length != 28) next();
  // check if user actually exists
  var answer = await getUserById(req.params.id);
  if (answer == null) next();
  else res.render("pokedex", { name: answer.name, history: answer.history });
});

// generates new uuid for user
app.get("/id", (req, res) => {
  // user has no ID, so generate userID and pokemonID
  var id = uuidv4();
  res.send(id);
});

// sends a boolean that states if user can play right now and a timestamp of when the current word has been generated
app.get("/id/status/:id", (req, res) => {
  res.send([winners.includes(req.params.id), timestamp]);
});

// catches 404 and forwards to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
