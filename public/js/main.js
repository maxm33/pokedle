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
  if (permission != "granted") console.log("Notifications: no permission");
  else console.log("Notifications: enabled");
});

// get all important HTML elements to manage
let loginButton = document.getElementById("login-button");
let profileButton = document.getElementById("profile-button");
let pokedexButton = document.getElementById("pokedex-button");
let rankingButton = document.getElementById("ranking-button");
let guessButton = document.getElementById("guess-button");
let timer = document.getElementById("timer");
let subtitle = document.getElementById("subtitle");
let titles = document.getElementById("titles-container");
let containerbar = document.getElementById("textbar-container");
let containerstate = document.getElementById("state-container");
let input = document.getElementById("textbar");
let textbar = document.getElementById("autocomplete");

let appState = new AppState(); // initialize app state
let provider = new GoogleAuthProvider();
let config = await axios.get("/env/fb");
let auth = getAuth(initializeApp(config.data));

// get user ID or request and set if null
if (appState.getID() == null) {
  await axios.get("/user/id").then((res) => {
    appState.setID(res.data);
  });
}
var userID = appState.getID();

// get game status to update timer and render guesses
axios.get("/game/status").then((res) => {
  manageGameStatus(res.data[0], res.data[1]);
});

autocomplete(input, pokemons); // initialize autocomplete textbar

const unsubscribe = onAuthStateChanged(auth, (user) => {
  // user is signed in
  if (user) {
    loginButton.value = "Logout";
    showElement(profileButton);
    showElement(pokedexButton);
  } else {
    // user is not signed in
    loginButton.value = "Login";
    hideElement(profileButton);
    hideElement(pokedexButton);
  }
  axios
    .get("/user/" + (user ? auth.currentUser.uid : userID) + "/play")
    .then((res) => {
      // manage the elements according whether the user can play or not
      var string_play = "I'm thinking of a Pokémon, can you guess it?";
      var string_nope = "Don't move! Next will be legen... Wait for it...";
      if (res.data) {
        if (subtitle.textContent != string_play) {
          triggerElementAnimation(subtitle, "fadeIn");
          subtitle.textContent = string_play;
        }
        if (containerbar.style.display == "none") {
          triggerElementAnimation(containerbar, "fadeIn");
          containerbar.style.display = "block";
        }
        if (containerstate.style.display == "none") {
          triggerElementAnimation(containerstate, "fadeIn");
          containerstate.style.display = "block";
        }
      } else {
        if (subtitle.textContent != string_nope) {
          triggerElementAnimation(subtitle, "fadeIn");
          subtitle.textContent = string_nope;
        }
        if (containerbar.style.display == "block") {
          triggerElementAnimation(containerbar, "fadeOut");
          setTimeout(() => (containerbar.style.display = "none"), 1150);
        }
        if (containerstate.style.display == "block") {
          triggerElementAnimation(containerstate, "fadeOut");
          setTimeout(() => (containerstate.style.display = "none"), 1150);
        }
      }
    });
});

loginButton.addEventListener("click", () => {
  unsubscribe();
  if (auth.currentUser == null)
    signInWithPopup(auth, provider).then(() => {
      sendNotification("Welcome back, " + auth.currentUser.displayName + "!");
      auth.currentUser.getIdToken().then((token) => {
        axios.put("/user/check", {
          name: auth.currentUser.displayName,
          token: token,
        });
        window.location.reload();
      });
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

rankingButton.addEventListener("click", () => {
  window.location.href = "/users/ranking";
});

guessButton.addEventListener("click", async () => {
  var guess = input.value;
  input.value = "";
  // in case of type errors, textbar will shake
  if (guess == "" || !pokemons.includes(guess)) {
    triggerElementAnimation(textbar, "shake");
    return;
  }
  var token = null;
  if (auth.currentUser != null) token = await auth.currentUser.getIdToken();
  axios
    .post("/", {
      token: token,
      uid: userID,
      guess: guess,
      tries: appState.getTries() + 1,
    })
    .then((res) => {
      if (!appState.exists()) showElement(titles); // hint categories will be shown
      appState.add(res.data); // rendering hints related to current guess
      if (res.data[1].hasWon) {
        input.disabled = true; // textbar is disabled
        appState.removeState(); // reset the state
        onVictory(appState.getTries(), res.data[0].name);
      }
    })
    .catch((err) => console.error(err));
});

// where timer and initial guess rendering are managed
function manageGameStatus(id, remainingTime) {
  // remove any old game states
  var gameID = appState.getGameID();
  if (gameID == null || gameID != id) {
    appState.removeState();
    appState.setGameID(id);
  }

  // render previous guesses, if any
  appState.getSavedState();
  if (appState.exists()) {
    appState.renderState();
    showElement(titles);
  }

  // keep state updated between different tabs, fired every 30 seconds
  setInterval(() => {
    appState.getSavedState();
    var total = appState.getTries();
    var rendered = appState.getRenderedTries();
    var toRender = total - rendered;
    if (total > 0 && rendered == 0 && titles.style.visibility == "hidden")
      showElement(titles);
    while (toRender > 0) {
      toRender--;
      appState.renderGuess(appState.guesses[toRender]);
    }
  }, 30000);

  // reload page automatically when time is up
  setTimeout(() => {
    appState.removeState();
    sendNotification("A new Pokémon is waiting for you!");
    window.location.reload();
  }, remainingTime);

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
      "A new Pokémon is spawning in " +
      (hours < 10 ? "0" + hours : hours) +
      ":" +
      (minutes < 10 ? "0" + minutes : minutes) +
      ":" +
      (seconds < 10 ? "0" + seconds : seconds);
  }, 1000);
}

function showElement(element) {
  element.style.animation = "fadeIn 1.5s";
  element.style.visibility = "visible";
}

function hideElement(element) {
  element.style.animation = "fadeOut 1.5s";
  setTimeout(() => (element.style.visibility = "hidden"), 1150);
}

function triggerElementAnimation(element, animationClass) {
  while (element.classList.length > 0)
    element.classList.remove(element.classList.item(0));
  void element.offsetWidth;
  element.classList.add(animationClass);
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
    div.innerHTML = `
      <div id="victory-text1">
        <b>GG!</b>
      </div>
      <div id="victory-text2">
        <b>It was ${pokename} indeed!</b>
      </div>
      <div>
        <img style="animation: fadeIn 500ms" src='/public/images/sprites/${pokename}.png' width='180px' height='180px'>
      </div>
      <div id="victory-text3">
        <b>You guessed it in ${tries} tries...</b>
      </div>
      <div id="victory-text4">
        <b>Think you can do better? Let's see!</b>
      </div>
      <a href='/'><button id='continue-button'>Continue</button></a>
      `;
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
    var list = document.createElement("DIV");
    list.setAttribute("id", this.id + "-autocomplete-list");
    list.setAttribute("class", "autocomplete-items");
    this.parentNode.appendChild(list);
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].substr(0, val.length).toUpperCase() == val.toUpperCase()) {
        var option = document.createElement("DIV");
        option.className = "list-options";
        option.innerHTML = `<img src='/public/images/sprites/${
          arr[i]
        }.png' width='70px' height='70px'>
          <strong style="color: lightgreen;">${arr[i].substr(
            0,
            val.length
          )}</strong>${arr[i].substr(val.length)}
      <input type='hidden' value='${arr[i]}'>`;
        option.addEventListener("click", function () {
          inp.value = this.getElementsByTagName("input")[0].value;
          closeAllLists();
        });
        list.appendChild(option);
      }
    }
  });

  function closeAllLists(e) {
    var items = document.getElementsByClassName("autocomplete-items");
    for (var i = 0; i < items.length; i++)
      if (e != items[i] && e != inp) items[i].parentNode.removeChild(items[i]);
  }

  document.addEventListener("click", (e) => {
    closeAllLists(e.target);
  });
}
