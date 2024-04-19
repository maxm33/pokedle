import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { pokemons } from "./pokemon.js";
import { AppState } from "./appState.js";

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

// request for browser notifications
Notification.requestPermission((permission) => {
  if (permission != "granted")
    console.log("Permission for notifications was not granted.");
  else console.log("Notifications enabled.");
});

let appState = new AppState(); // initializing app state
// get all important html elements to manage
let loginButton = document.getElementById("loginButton");
let profileButton = document.getElementById("profileButton");
let pokedexButton = document.getElementById("pokedexButton");
let rankingsButton = document.getElementById("rankingsButton");
let sendButton = document.getElementById("bouncyButton");
let timer = document.getElementById("timer");
let containerbar = document.getElementById("bar-container");
let subtitle = document.getElementById("subtitle");
let titles = document.getElementById("category-titles");
let inp = document.getElementById("myInput");
autocomplete(inp, pokemons); // initializing autocomplete textbar

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

appState.setSavedID(); // set the saved unique id from localStorage (if not present, request it)
// send a request to server to retrieve various info
axios.get("/id/status/" + appState.getID()).then((response) => {
  if (response.data[0])
    subtitle.textContent = "You can't make anymore tries... Come back later...";
  else {
    containerbar.style.animation = "fadeIn 1.5s";
    containerbar.style.visibility = "visible";
    subtitle.textContent = "I'm thinking of a Pokémon, can you guess it?";
  }
  var remainingTime = response.data[1];
  // reload page automatically after remaining time has passed
  setTimeout(() => {
    appState.removeState();
    window.location.reload();
  }, remainingTime);

  appState.setSavedState();
  if (appState.isPresent()) {
    appState.renderAll();
    titles.style.visibility = "visible";
  }

  const totalSeconds = Math.floor(remainingTime / 1000);
  const remainingSecondsAfterHours = totalSeconds % 3600;

  var hours = Math.floor(totalSeconds / 3600);
  var minutes = Math.floor(remainingSecondsAfterHours / 60);
  var seconds = remainingSecondsAfterHours % 60;

  // updates the timer every second
  setInterval(() => {
    if (hours <= 0 && minutes <= 0 && seconds <= 0) return;
    else if (hours >= 1 && minutes == 0 && seconds == 0) {
      hours--;
      minutes = 59;
      seconds = 59;
    } else if (minutes >= 1 && seconds == 0) {
      minutes--;
      seconds = 59;
    } else seconds--;

    timer.textContent =
      "New Pokémon in " +
      (hours < 10 ? "0" + hours : hours) +
      ":" +
      (minutes < 10 ? "0" + minutes : minutes) +
      ":" +
      (seconds < 10 ? "0" + seconds : seconds);
  }, 1000);
});

loginButton.addEventListener("click", () => {
  if (auth.currentUser == null)
    signInWithPopup(auth, provider).then(() => {
      sendNotification("Welcome back, " + auth.currentUser.displayName + "!");
    });
  else
    signOut(auth).then(() => {
      sendNotification("Logged out successfully.");
    });
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
  var myGuess = inp.value;
  inp.value = "";
  // in case of some types of errors, textbar will shake to notify the user
  if (myGuess == "" || !pokemons.includes(myGuess)) {
    var textbox = document.getElementById("autocomplete");
    textbox.classList.remove("shake");
    void textbox.offsetWidth;
    textbox.classList.add("shake");
    return;
  }
  var updatedTries = appState.getTries() + 1;
  if (auth.currentUser != null) {
    var uid = auth.currentUser.uid;
    var name = auth.currentUser.displayName;
  } else {
    var uid = null;
    var name = null;
  }
  axios
    .post("/", {
      googleID: uid,
      googleName: name,
      guess: myGuess,
      tries: updatedTries,
      uid: appState.getID(),
    })
    .then((response) => {
      if (!appState.isPresent()) titles.style.visibility = "visible"; // hint categories will be shown
      // forward to appState to generate the hints on the guess
      appState.add(response.data);
      if (response.data[1].hasWon) {
        inp.disabled = true; // textbar is disabled
        setTimeout(() => {
          onVictory(updatedTries, response.data[0].name);
        }, 1000);
        appState.removeState(); // resetting the state
      }
    })
    .catch((error) => {
      console.log(error);
    });
});

function onVictory(tries, pokename) {
  var div = document.createElement("DIV");
  div.setAttribute("id", "victory-ad");
  subtitle.insertAdjacentElement("afterend", div);
  var audio = new Audio("public/audio/victory-sound.mp3");
  audio.volume = 0.1;
  audio.play();
  setTimeout(() => {
    div.innerHTML = `<div><br><br><br><br><b>GG!</b><br><br><br><br></div>
    <div><b>It was ${pokename} indeed!</b></div><div><img src='/public/images/sprites/${pokename}.png' width='180px' height='180px'>
    </div><div><br><br><b>You guessed it in ${tries} tries...</b></div><div><br><br><b>Think you can do better? Let's see!</b>
    <br><br></div><div><br><a href='/'><button id='victoryButton'>Continue</button></a></div>`;
  }, 1500);
}

// sends notifications on login/logout, if enabled
function sendNotification(message) {
  if ("Notification" in window)
    Notification.requestPermission().then((permission) => {
      if (permission === "granted")
        new Notification("Pokédle", {
          body: message,
          icon: "/public/images/icon-192x192.png",
        });
    });
}

// management of autocomplete textbar
function autocomplete(input, arr) {
  input.addEventListener("input", function (e) {
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
          input.value = this.getElementsByTagName("input")[0].value;
          closeAllLists();
        });
        a.appendChild(b);
      }
    }
  });

  function closeAllLists(elmnt) {
    var x = document.getElementsByClassName("autocomplete-items");
    for (var i = 0; i < x.length; i++)
      if (elmnt != x[i] && elmnt != input) x[i].parentNode.removeChild(x[i]);
  }

  document.addEventListener("click", (e) => {
    closeAllLists(e.target);
  });
}
