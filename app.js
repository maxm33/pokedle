const initializeApp = require("firebase/app").initializeApp;
const firestore = require("firebase/firestore");
const { v4: uuidv4 } = require("uuid");

var createError = require("http-errors");
var logger = require("morgan");
var path = require("path");
var express = require("express");

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
const db = firestore.getFirestore(firebaseApp);

var index = 0; // index of winners array
var winners = []; // to store unique id of players who have won the current game
var timestamp; // to store the time when pokemon is generated
var generatedPokemon; // to store the generated pokemon
var generateInterval = 24 * 60 * 60 * 1000; // in milliseconds, the interval between each generation

async function generatePokemon() {
  index = 0;
  winners.length = 0;
  timestamp = Date.now();
  var pokemonID = Math.floor(Math.random() * 151 + 1);
  var pokemonRef = firestore.doc(db, "pokemons", pokemonID.toString());
  var pokemonDoc = await firestore.getDoc(pokemonRef);
  generatedPokemon = pokemonDoc.data();
  console.log("!!! Current Pokemon: " + generatedPokemon.name + " !!!");
}

// verify the client's guess, generate hints based on it
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

// get a user from database given his id
async function getUserById(id) {
  var userRef = firestore.doc(db, "users", id);
  var userDoc = await firestore.getDoc(userRef);
  if (userDoc.exists()) return userDoc.data();
  else return null;
}

// update user's stats and pokedex on winning
async function updateStatsOnWinning(id, name, pokemon, tries) {
  var user = await getUserById(id);
  if (user == null)
    // if is a first-login user, set up a fresh document
    user = {
      name: name,
      wins: 1,
      avgTries: tries,
      history: [{ pokemon: pokemon, timesGuessed: 1 }],
    };
  else {
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
  }
  // update (or create) the document
  var userRef = firestore.doc(db, "users", id);
  firestore.setDoc(userRef, user);
}

generatePokemon(); // first pokemon is generated here
setInterval(() => generatePokemon(), generateInterval); // new pokemon will be generated at set intervals

var app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(express.json());
app.use(express.static(path.join(__dirname, "")));

// render home page
app.get("/", (req, res) => {
  res.render("index");
});

// generate hints based on user's guess, check if user has won and, if so, call an update to his stats
app.post("/", async (req, res) => {
  var query = firestore.query(
    firestore.collection(db, "pokemons"),
    firestore.where("name", "==", req.body.guess)
  );
  var pokemonDocs = await firestore.getDocs(query);
  pokemonDocs.forEach((doc) => {
    var guess = doc.data();
    // confronting guess with answer, returns the hints to help user's guesses
    var response = verifyGuess(guess, generatedPokemon);
    if (response.hasWon) {
      // winners won't be able to play until a new pokemon is generated
      winners[index] = req.body.uid;
      index++;
      // if user is logged in, update his stats
      if (req.body.googleID != null)
        updateStatsOnWinning(
          req.body.googleID,
          req.body.googleName,
          req.body.guess,
          req.body.tries
        );
    }
    res.status(201);
    res.send([guess, response]);
  });
});

// render profile data about requested user
app.get("/profile/:id", async (req, res, next) => {
  var user = await getUserById(req.params.id);
  if (user == null)
    next(createError("This user does not exist or has not played yet!"));
  else {
    res.status(200);
    res.render("profile", {
      name: user.name,
      wins: user.wins,
      avgTries: Math.round(user.avgTries * 100) / 100,
    });
  }
});

// render requested user's pokedex page
app.get("/profile/:id/pokedex", async (req, res, next) => {
  var user = await getUserById(req.params.id);
  if (user == null)
    next(createError("This user does not exist or has not played yet!"));
  else {
    res.status(200);
    res.render("pokedex", { name: user.name, history: user.history });
  }
});

// render rankings page with top 10 users
app.get("/rankings", async (req, res) => {
  var query = firestore.query(
    firestore.collection(db, "users"),
    firestore.orderBy("wins", "desc"),
    firestore.limit(10)
  );
  var userDocs = await firestore.getDocs(query);
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
  res.status(200);
  res.render("rankings", { rankingData: topTen });
});

// generate new unique id for user
app.get("/id", (req, res) => {
  res.status(201);
  res.send(uuidv4());
});

// send a boolean that states if user can play current game and the remaining time before next pokemon generation
app.get("/id/status/:id", (req, res) => {
  var remainingTime = timestamp + generateInterval - Date.now();
  res.status(200);
  res.send([winners.includes(req.params.id), remainingTime]);
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = err;
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
