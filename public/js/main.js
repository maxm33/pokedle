import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { pokemons } from "./pokemon.js";

const firebaseConfig = {
  apiKey: "AIzaSyBkHJGjV3MdHdqX54BwTrCkKuQt3tmzEhQ",
  authDomain: "pokedle-14739.firebaseapp.com",
  projectId: "pokedle-14739",
  storageBucket: "pokedle-14739.appspot.com",
  messagingSenderId: "576792023907",
  appId: "1:576792023907:web:87bfee996f8bb14b2c3956",
  measurementId: "G-TBRPL5L80L",
};

// initialize Firebase Authentication
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const provider = new GoogleAuthProvider();

class AppState {
  constructor() {
    this.guesses = [];
    this.tries = 0;
    this.uuid = "";
  }
  setGuesses(guesses) {
    this.guesses = guesses;
  }
  getGuesses() {
    return this.guesses;
  }
  setTries(tries) {
    this.tries = tries;
  }
  getTries() {
    return this.tries;
  }
  incrementTries() {
    this.tries++;
  }
  setID(id) {
    this.uuid = id;
  }
  getID() {
    return this.uuid;
  }
  getSavedID() {
    var uuid = JSON.parse(window.localStorage.getItem("uuid"));
    // if uuid is not been set already
    if (uuid == null) {
      // ask server to generate a unique id
      axios.get("/id").then(function (response) {
        window.localStorage.setItem("uuid", JSON.stringify(response.data));
      });
    }
    this.uuid = uuid;
  }
  getSavedState() {
    var guesses = JSON.parse(window.localStorage.getItem("state"));
    var tries = JSON.parse(window.localStorage.getItem("tries"));
    if (guesses != null && tries != null) {
      this.guesses = guesses;
      this.tries = tries;
      return console.log("State has been restored from localStorage");
    }
    return console.log("State is not present");
  }
  saveState() {
    this.removeState();
    window.localStorage.setItem("state", JSON.stringify(this.guesses));
    window.localStorage.setItem("tries", JSON.stringify(this.tries));
  }
  removeState() {
    window.localStorage.removeItem("state");
    window.localStorage.removeItem("tries");
  }
  add(guess) {
    this.guesses.unshift(guess);
    this.saveState();
    this.showTitles();
    this.render(this.guesses[0]);
  }
  render(guess) {
    var menucontainer = document.getElementById("answer-container");
    var menuoption = document.createElement("DIV");
    menuoption.setAttribute("class", "answer");
    menuoption.innerHTML = `<img src='/public/images/sprites/${guess[0].name}.png' width='100px' height='100px'>`;
    for (var prop in guess[1]) {
      if (
        Object.hasOwnProperty.call(guess[1], prop) &&
        guess[1][prop] != true &&
        guess[1][prop] != false
      ) {
        var card = document.createElement("DIV");
        card.setAttribute("class", guess[1][prop]);
        card.innerHTML = `<p>${guess[0][prop]}</p>`;
        menuoption.appendChild(card);
      }
    }
    menucontainer.insertAdjacentElement("afterbegin", menuoption);
  }
  renderAll() {
    for (var i = this.guesses.length - 1; i >= 0; i--) {
      this.render(this.guesses[i]);
    }
  }
  showTitles() {
    var titles = document.getElementById("answer-titles");
    titles.style.visibility = "visible";
  }
  getTimestamp() {
    return JSON.parse(window.localStorage.getItem("timestamp"));
  }
  removeTimestamp() {
    window.localStorage.removeItem("timestamp");
  }
}

/*
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/service-worker.js");
  });
}
*/

// request for browser notifications
Notification.requestPermission((permission) => {
  if (permission != "granted") {
    console.log("Permission for notifications was not granted.");
  } else {
    console.log("Notifications enabled.");
  }
});

var appState = new AppState(); // initializing app state
autocomplete(document.getElementById("myInput"), pokemons); // initializing autocomplete textbar
// get all important html elements to manage
let loginButton = document.getElementById("loginButton");
let profileButton = document.getElementById("profileButton");
let pokedexButton = document.getElementById("pokedexButton");
let rankingsButton = document.getElementById("rankingsButton");
let sendButton = document.getElementById("myButton");
let timer = document.getElementById("timer");
let containerbar = document.getElementById("bar-container");
let subtitle = document.getElementById("subtitle");

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginButton.value = "Logout";
    profileButton.style.visibility = "visible";
    pokedexButton.style.visibility = "visible";
  } else {
    loginButton.value = "Login with Google";
    profileButton.style.visibility = "hidden";
    pokedexButton.style.visibility = "hidden";
  }
});

appState.getSavedID(); // get the saved unique id (or request it to server if not present)
// send a request to server to retrieve various info
axios.get("/id/status/" + appState.getID()).then((response) => {
  // check if user can play or not
  if (response.data[0]) {
    subtitle.textContent = "You can't make anymore tries... Come back later...";
  } else {
    containerbar.style.animation = "fadeIn 1s";
    containerbar.style.visibility = "visible";
    subtitle.textContent = "Sto pensando ad un Pokémon, riesci ad indovinarlo?";
  }
  var timestamp = appState.getTimestamp(); // timestamp of the generation of current state
  // second index of response is the timestamp of the pokemon generation
  if (timestamp == null || timestamp < response.data[1]) {
    appState.removeState(); // state expired, discard
    appState.removeTimestamp();
  } else {
    appState.getSavedState(); // get state in localStorage
    // render previous state if present
    if (appState.getGuesses().length != 0) {
      appState.renderAll();
      appState.showTitles();
    }
  }
  var remainingTime = response.data[1] + 300 * 1000 - Date.now();
  // reload page automatically when the new pokemon is generated
  setTimeout(function () {
    window.location.reload();
  }, remainingTime);
  // set up the timer to inform user about new pokemon generation
  var minutes = Math.floor(remainingTime / 60000);
  var seconds = ((remainingTime % 60000) / 1000).toFixed(0);
  setInterval(function () {
    if (minutes <= 0 && seconds <= 0) return;
    if (minutes >= 1 && seconds == 0) {
      minutes--;
      seconds = 59;
    } else seconds--;
    timer.textContent =
      "Nuovo Pokémon in " + minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
  }, 1000);
});

loginButton.addEventListener("click", () => {
  if (auth.currentUser == null) {
    signInWithPopup(auth, provider).then(() => {
      axios.put("/profile/" + auth.currentUser.uid, {
        name: auth.currentUser.displayName,
      });
      sendNotification("Welcome back, " + auth.currentUser.displayName + "!");
    });
  } else {
    signOut(auth).then(() => {
      sendNotification("Logged out successfully.");
    });
  }
});

profileButton.addEventListener("click", () => {
  window.location.href = `/profile/${auth.currentUser.uid}`;
});

pokedexButton.addEventListener("click", () => {
  window.location.href = `/profile/${auth.currentUser.uid}/pokedex`;
});

rankingsButton.addEventListener("click", () => {
  window.location.href = "/rankings";
});

sendButton.addEventListener("click", () => {
  var inp = document.getElementById("myInput");
  var myGuess = inp.value;
  inp.value = "";
  // in case of some types of errors, textbox will shake to notify the user
  if (myGuess == "" || !pokemons.includes(myGuess)) {
    var textbox = document.getElementById("autocomplete");
    textbox.classList.remove("shake");
    void textbox.offsetWidth;
    textbox.classList.add("shake");
    return;
  }
  appState.incrementTries();
  if (auth.currentUser != null) var uid = auth.currentUser.uid;
  else var uid = null;
  axios
    .post("/", {
      googleID: uid,
      guess: myGuess,
      tries: appState.getTries(),
      uid: appState.getID(),
    })
    .then(function (response) {
      appState.showTitles(); // hint categories will be shown
      // if this is the first attempt, saves the timestamp in localStorage
      if (appState.getGuesses().length == 0)
        window.localStorage.setItem("timestamp", JSON.stringify(Date.now()));
      // forward to appState to generate the hints on the guess
      appState.add(response.data);
      if (response.data[1].hasWon) {
        inp.disabled = true; // textbar is disabled
        setTimeout(() => {
          onVictory(appState.getTries(), response.data[0].name);
        }, 1000);
        appState.removeState(); // resetting the state
        appState.removeTimestamp();
      }
    })
    .catch(function (error) {
      console.log(error);
    });
});

function onVictory(tries, pokename) {
  var sub = document.getElementById("subtitle");
  var div = document.createElement("DIV");
  div.setAttribute("id", "victory-ad");
  sub.insertAdjacentElement("afterend", div);
  var audio = new Audio("public/audio/victory-sound.mp3");
  audio.volume = 0.1;
  audio.play();
  setTimeout(() => {
    div.innerHTML = `<div><br><br><br><br><b>Congratulazioni!</b><br><br><br><br></div>
    <div><b>Era proprio ${pokename}!</b></div><div><img src='/public/images/sprites/${pokename}.png' width='180px' height='180px'>
    </div><div><br><br><b>E ci sei riuscito in ${tries} tentativo/i</b></div><div><br><br><b>Pensi di poter fare di meglio? Capiamo!</b>
    <br><br></div><div><br><a href='/'><button class='victory-button'>Continua</button></a></div>`;
  }, 1500);
}
// sends notifications on login/logout, if enabled
function sendNotification(message) {
  if (!("Notification" in window)) {
    alert("This browser does not support desktop notifications!");
    return;
  }
  Notification.requestPermission().then((permission) => {
    if (permission === "granted") {
      const notification = new Notification("Pokédle", {
        body: message,
        icon: "/public/images/icon-192x192.png",
      });
    }
  });
}

function autocomplete(inp, arr) {
  inp.addEventListener("input", function (e) {
    var a, b;
    var val = this.value;
    closeAllLists();
    if (!val) return false;
    a = document.createElement("DIV");
    a.setAttribute("id", this.id + "autocomplete-list");
    a.setAttribute("class", "autocomplete-items");
    this.parentNode.appendChild(a);
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].substr(0, val.length).toUpperCase() == val.toUpperCase()) {
        b = document.createElement("DIV");
        b.className = "list-option";
        b.innerHTML = `<img src='/public/images/sprites/${
          arr[i]
        }.png' width='70px' height='70px'>
          <strong>${arr[i].substr(0, val.length)}</strong>${arr[i].substr(
          val.length
        )}
      <input type='hidden' value='${arr[i]}'>`;
        b.addEventListener("click", function (e) {
          inp.value = this.getElementsByTagName("input")[0].value;
          closeAllLists();
        });
        a.appendChild(b);
      }
    }
  });

  function closeAllLists(elmnt) {
    var x = document.getElementsByClassName("autocomplete-items");
    for (var i = 0; i < x.length; i++) {
      if (elmnt != x[i] && elmnt != inp) {
        x[i].parentNode.removeChild(x[i]);
      }
    }
  }

  document.addEventListener("click", function (e) {
    closeAllLists(e.target);
  });
}
