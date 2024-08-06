import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { pokemons } from "./pokemon.js";
import { AppState } from "./appState.js";

// request for browser notifications
Notification.requestPermission((permission) => {
  if (permission != "granted")
    console.log("Permission for notifications was not granted.");
  else console.log("Notifications enabled.");
});

// get all important HTML elements to manage
let loginButton = document.getElementById("login-button");
let profileButton = document.getElementById("profile-button");
let pokedexButton = document.getElementById("pokedex-button");
let rankingsButton = document.getElementById("rankings-button");
let guessButton = document.getElementById("guess-button");
let timer = document.getElementById("timer");
let subtitle = document.getElementById("subtitle");
let titles = document.getElementById("titles-container");
let containerbar = document.getElementById("textbar-container");
let input = document.getElementById("textbar");
let textbox = document.getElementById("autocomplete");

let appState = new AppState(); // initialize app state
let provider = new GoogleAuthProvider();
let config = await axios.get("/env/fb");
let auth = getAuth(initializeApp(config.data));

// get user ID or request and set if null
if (appState.getID() == null) {
  await axios.get("/user/id").then((response) => {
    appState.setID(response.data);
  });
}
var userID = appState.getID();

const unsubscribe = onAuthStateChanged(auth, (user) => {
  // user is signed in
  if (user) {
    loginButton.value = "Logout";
    profileButton.style.animation = "fadeIn 1.5s";
    pokedexButton.style.animation = "fadeIn 1.5s";
    profileButton.style.visibility = "visible";
    pokedexButton.style.visibility = "visible";
    axios
      .get("/user/" + auth.currentUser.uid + "/status")
      .then((res) => manageGameStatus(res.data[0], res.data[1], res.data[2]));
  } else {
    // user is signed out
    loginButton.value = "Login";
    profileButton.style.animation = "fadeOut 1.5s";
    pokedexButton.style.animation = "fadeOut 1.5s";
    setTimeout(() => {
      profileButton.style.visibility = "hidden";
      pokedexButton.style.visibility = "hidden";
    }, 1400);
    axios
      .get("/user/" + userID + "/status")
      .then((res) => manageGameStatus(res.data[0], res.data[1], res.data[2]));
  }
});

autocomplete(input, pokemons); // initialize autocomplete textbar

loginButton.addEventListener("click", () => {
  unsubscribe();
  if (auth.currentUser == null)
    signInWithPopup(auth, provider).then(() => {
      sendNotification("Welcome back, " + auth.currentUser.displayName + "!");
      axios.put("/user/" + auth.currentUser.uid + "/update", {
        name: auth.currentUser.displayName,
      });
      window.location.reload();
    });
  else
    signOut(auth).then(() => {
      sendNotification("Logged out successfully.");
      window.location.reload();
    });
});

profileButton.addEventListener("click", () => {
  window.location.href = `/user/${auth.currentUser.uid}/profile`;
});

pokedexButton.addEventListener("click", () => {
  window.location.href = `/user/${auth.currentUser.uid}/pokedex`;
});

rankingsButton.addEventListener("click", () => {
  window.location.href = "/users/ranking";
});

guessButton.addEventListener("click", () => {
  var myGuess = input.value;
  input.value = "";
  // in case of type errors, textbar will shake
  if (myGuess == "" || !pokemons.includes(myGuess)) {
    textbox.classList.remove("shake");
    void textbox.offsetWidth;
    textbox.classList.add("shake");
    return;
  }
  var gid = null;
  if (auth.currentUser != null) gid = auth.currentUser.uid;
  var updatedTries = appState.getTries() + 1;
  axios
    .post("/", {
      gid: gid,
      uid: userID,
      guess: myGuess,
      tries: updatedTries,
    })
    .then((response) => {
      if (!appState.exists()) {
        titles.style.animation = "fadeIn 1.5s";
        titles.style.visibility = "visible"; // hint categories will be shown
      }
      appState.add(response.data); // rendering hints related to current guess
      if (response.data[1].hasWon) {
        input.disabled = true; // textbar is disabled
        appState.removeState(); // reset the state
        onVictory(updatedTries, response.data[0].name);
      }
    });
});

// where the ability to play the game and the timer is managed
function manageGameStatus(canPlay, remainingTime, id) {
  // remove any old game states
  var gameID = appState.getGameID();
  if (gameID == null || gameID != id) {
    appState.removeState();
    appState.setGameID(id);
  }

  // reload page automatically when time is up
  setTimeout(() => {
    appState.removeState();
    sendNotification("A new Pokémon is waiting for you!");
    window.location.reload();
  }, remainingTime);

  // manage the elements according whether the user can play or not
  if (canPlay) {
    subtitle.style.animation = "fadeIn 1.5s";
    subtitle.textContent = "I'm thinking of a Pokémon, can you guess it?";
    containerbar.style.animation = "fadeIn 1.5s";
    containerbar.style.visibility = "visible";

    // render previous guesses, if any
    appState.getSavedState();
    if (appState.exists()) {
      appState.renderAll();
      titles.style.animation = "fadeIn 1.5s";
      titles.style.visibility = "visible";
    }
  } else {
    subtitle.style.animation = "fadeIn 1.5s";
    subtitle.textContent = "Don't move! Next will be legen... Wait for it...";
    containerbar.style.animation = "fadeOut 1.5s";
    setTimeout(() => {
      containerbar.style.visibility = "hidden";
    }, 1150);
  }

  var totalSeconds = Math.floor(remainingTime / 1000);
  var remainingSecondsAfterHours = totalSeconds % 3600;
  var hours = Math.floor(totalSeconds / 3600);
  var minutes = Math.floor(remainingSecondsAfterHours / 60);
  var seconds = remainingSecondsAfterHours % 60;

  // update the timer every second
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
}

// victory event
function onVictory(tries, pokename) {
  var audio = new Audio("public/audio/victory-sound.mp3");
  audio.volume = 0.1;
  audio.play();
  setTimeout(() => {
    var div = document.createElement("DIV");
    div.setAttribute("id", "victory-ad-container");
    subtitle.insertAdjacentElement("afterend", div);
    div.innerHTML = `<div id="victory-ad"><div><br><br><b>GG!</b><br><br></div><div><b>It was ${pokename} indeed!</b></div><div><img src='/public/images/sprites/${pokename}.png' width='180px' height='180px'></div><div><br><b>You guessed it in ${tries} tries...</b><br><br></div><div><b>Think you can do better? Let's see!</b><br><br></div><a href='/'><button id='continue-button'>Continue</button></a></div>`;
  }, 1000);
}

// send notifications on login/logout, if enabled
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
function autocomplete(inp, arr) {
  inp.addEventListener("input", function () {
    var val = this.value;
    closeAllLists();
    if (!val) return false;
    var a = document.createElement("DIV");
    a.setAttribute("id", this.id + "autocomplete-list");
    a.setAttribute("class", "autocomplete-items");
    this.parentNode.appendChild(a);
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].substr(0, val.length).toUpperCase() == val.toUpperCase()) {
        var b = document.createElement("DIV");
        b.className = "list-options";
        b.innerHTML = `<img src='/public/images/sprites/${
          arr[i]
        }.png' width='70px' height='70px'>
          <strong style="color: lightgreen;">${arr[i].substr(
            0,
            val.length
          )}</strong>${arr[i].substr(val.length)}
      <input type='hidden' value='${arr[i]}'>`;
        b.addEventListener("click", function () {
          inp.value = this.getElementsByTagName("input")[0].value;
          closeAllLists();
        });
        a.appendChild(b);
      }
    }
  });

  function closeAllLists(elem) {
    var x = document.getElementsByClassName("autocomplete-items");
    for (var i = 0; i < x.length; i++)
      if (elem != x[i] && elem != inp) x[i].parentNode.removeChild(x[i]);
  }

  document.addEventListener("click", (e) => {
    closeAllLists(e.target);
  });
}
