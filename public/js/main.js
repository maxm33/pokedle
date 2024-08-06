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

var auth = null;
var gid = null;
var provider = new GoogleAuthProvider();

axios
  .get("/env/fb")
  .then((config) => {
    // initialize firebase authentication
    auth = getAuth(initializeApp(config.data));

    onAuthStateChanged(auth, (user) => {
      if (user) {
        gid = auth.currentUser.uid;
        loginButton.value = "Logout";
        profileButton.style.visibility = "visible";
        pokedexButton.style.visibility = "visible";
      } else {
        gid = null;
        loginButton.value = "Login";
        profileButton.style.visibility = "hidden";
        pokedexButton.style.visibility = "hidden";
      }
    });
  })
  .catch((error) => {
    console.error("Error caught while setting environment: ", error);
    return;
  });

let appState = new AppState(); // initialize app state
// get all important HTML elements to manage
let loginButton = document.getElementById("login-button");
let profileButton = document.getElementById("profile-button");
let pokedexButton = document.getElementById("pokedex-button");
let rankingsButton = document.getElementById("rankings-button");
let sendButton = document.getElementById("bouncy-button");
let timer = document.getElementById("timer");
let subtitle = document.getElementById("subtitle");
let titles = document.getElementById("titles-container");
let containerbar = document.getElementById("textbar-container");
let input = document.getElementById("textbar");
autocomplete(input, pokemons); // initialize autocomplete textbar

appState.setSavedID(); // set the saved unique id from localStorage (if not present, request it)
// send a request to server to retrieve various info
axios.get("/user/" + appState.getID() + "/status").then((response) => {
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

  var gameID = appState.getGameID();
  if (gameID == null || gameID != response.data[2]) {
    appState.removeState();
    appState.setGameID(response.data[2]);
  }

  appState.setSavedState();
  if (appState.isPresent()) {
    appState.renderAll();
    titles.style.visibility = "visible";
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
});

loginButton.addEventListener("click", () => {
  if (auth.currentUser == null)
    signInWithPopup(auth, provider).then(() => {
      sendNotification("Welcome back, " + auth.currentUser.displayName + "!");
      axios.put("/user/" + gid + "/update", {
        name: auth.currentUser.displayName,
      });
    });
  else
    signOut(auth).then(() => {
      sendNotification("Logged out successfully.");
    });
});

profileButton.addEventListener("click", () => {
  window.location.href = `/user/${gid}/profile`;
});

pokedexButton.addEventListener("click", () => {
  window.location.href = `/user/${gid}/pokedex`;
});

rankingsButton.addEventListener("click", () => {
  window.location.href = "/users/ranking";
});

sendButton.addEventListener("click", () => {
  var myGuess = input.value;
  input.value = "";
  // in case of type errors, textbar will shake
  if (myGuess == "" || !pokemons.includes(myGuess)) {
    var textbox = document.getElementById("autocomplete");
    textbox.classList.remove("shake");
    void textbox.offsetWidth;
    textbox.classList.add("shake");
    return;
  }
  var updatedTries = appState.getTries() + 1;
  axios
    .post("/", {
      googleID: gid,
      uid: appState.getID(),
      guess: myGuess,
      tries: updatedTries,
    })
    .then((response) => {
      if (!appState.isPresent()) titles.style.visibility = "visible"; // hint categories will be shown
      appState.add(response.data); // rendering hints related to current guess
      if (response.data[1].hasWon) {
        input.disabled = true; // textbar is disabled
        onVictory(updatedTries, response.data[0].name);
        appState.removeState(); // reset the state
      }
    })
    .catch((error) => {
      console.error(error);
    });
});

function onVictory(tries, pokename) {
  var audio = new Audio("public/audio/victory-sound.mp3");
  audio.volume = 0.1;
  audio.play();
  setTimeout(() => {
    var div = document.createElement("DIV");
    div.setAttribute("id", "victory-ad");
    subtitle.insertAdjacentElement("afterend", div);
    div.innerHTML = `<div id="victory-ad-text"><div><br><br><br><br><b>GG!</b><br><br><br><br></div>
    <div><b>It was ${pokename} indeed!</b></div><div><img src='/public/images/sprites/${pokename}.png' width='180px' height='180px'>
    </div><div><br><br><b>You guessed it in ${tries} tries...</b></div><div><br><br><b>Think you can do better? Let's see!</b>
    <br><br></div><div><br><a href='/'><button id='victory-ad-button'>Continue</button></a></div></div>`;
  }, 1000);
}

// sends notifications on login/logout (if enabled)
function sendNotification(message) {
  if ("Notification" in window)
    Notification.requestPermission().then((permission) => {
      if (permission === "granted")
        new Notification("Pokédle", {
          body: message,
          timeout: 5000,
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
