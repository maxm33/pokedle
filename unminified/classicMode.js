import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { pokemons } from "./pokemons.js";
import { classicAppState } from "./classicAppState.js";

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
let prevtitle = document.getElementById("prev-title");
let timer = document.getElementById("timer");
let subtitle = document.getElementById("subtitle");
let containertitles = document.getElementById("titles-container");
let containerbar = document.getElementById("textbar-container");
let containerstate = document.getElementById("state-container");
let textbar = document.getElementById("textbar");

let classicState = new classicAppState(); // initialize app state
let provider = new GoogleAuthProvider();
let config = await axios.get("/env/fb");
let auth = getAuth(initializeApp(config.data));

// get user ID or request and set if null
if (classicState.getUserID() == null) {
  await axios.get("/user/id").then((res) => {
    classicState.setUserID(res.data);
  });
}
const userID = classicState.getUserID();

// get game status to update timer and render guesses
axios.get("/classic/state").then((res) => {
  manageGameState(res.data[0], res.data[1], res.data[2]);
});

initializeAutocomplete(textbar, pokemons); // initialize autocomplete textbar

const unsubscribe = onAuthStateChanged(auth, (user) => {
  if (user) {
    // user is signed in
    loginButton.value = "Logout";
    animateFadeIn(profileButton, "1s");
    animateFadeIn(pokedexButton, "1s");
  } else {
    // user is not signed in
    loginButton.value = "Login ";
    animateFadeOut(profileButton, "1.5s");
    animateFadeOut(pokedexButton, "1.5s");
  }
  axios
    .get(
      "/classic/canPlay/uid=" +
        userID +
        "&gid=" +
        (auth.currentUser ? auth.currentUser.uid : null)
    )
    .then((res) => {
      // manage the elements according whether the user can play or not
      var stringCanPlay = `<p>I'm thinking of a <span style="color:#8cff66">Pokémon</span>, can you guess it?</p>`;
      var stringCantPlay =
        "<p>Don't move! Next will be legen... Wait for it...</p>";
      if (res.data) {
        // user can play
        if (subtitle.innerHTML != stringCanPlay) {
          triggerElementAnimation(subtitle, "fadeIn");
          subtitle.innerHTML = stringCanPlay;
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
        //user can't play
        if (subtitle.innerHTML != stringCantPlay) {
          triggerElementAnimation(subtitle, "fadeIn");
          subtitle.innerHTML = stringCantPlay;
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
  if (!auth.currentUser)
    signInWithPopup(auth, provider).then(() => {
      auth.currentUser.getIdToken().then((token) => {
        axios.put("/user/" + auth.currentUser.uid, {
          name: auth.currentUser.displayName,
          token: token,
        });
        window.location.reload();
      });
    });
  else
    signOut(auth).then(() => {
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
  window.location.href = "/classic/ranking";
});

guessButton.addEventListener("click", async () => {
  var guess = textbar.value;
  textbar.value = "";
  // in case of type errors, textbar will shake
  if (guess == "" || !pokemons.includes(guess)) {
    triggerElementAnimation(textbar, "shake");
    return;
  }
  var token = null;
  if (auth.currentUser != null) token = await auth.currentUser.getIdToken();
  axios
    .post("/classic", {
      token: token,
      uid: userID,
      guess: guess,
      tries: classicState.getTries() + 1,
    })
    .then((res) => {
      var pokemon = res.data[0];
      var hasWon = res.data[2];
      if (classicState.notRendered()) animateFadeIn(containertitles, "1.5s"); // hint categories will be shown
      classicState.addGuess(res.data); // rendering hints related to current guess
      if (hasWon) {
        textbar.disabled = true; // textbar is disabled
        onVictory(classicState.getTries(), pokemon);
        classicState.removeState(); // reset the state
      }
    })
    .catch((err) => console.error(err));
});

// where timer and initial guess rendering are managed
function manageGameState(id, remainingTime, previousPokemon) {
  if (previousPokemon != null) {
    prevtitle.innerHTML =
      '<p>Previous Pokémon was <span style="color:#ff6666">' +
      previousPokemon.name +
      " #" +
      previousPokemon.ID;
    ("</span></p>");
    animateFadeIn(prevtitle, "1.5s");
  }

  // remove any old game states
  var gameID = classicState.getGameID();
  if (gameID == null || gameID != id) {
    classicState.setGameID(id);
    classicState.removeState();
  }

  // render previous guesses, if any
  if (classicState.notRendered() && classicState.getTries() > 0)
    animateFadeIn(containertitles, "1.5s");
  classicState.renderState();

  // keep state updated between different tabs, fired every minute
  setInterval(() => {
    if (classicState.notRendered() && classicState.getTries() > 0)
      animateFadeIn(containertitles, "1.5s");
    classicState.renderStateDiff();
  }, 60000);

  // reload page automatically when time is up
  setTimeout(() => {
    sendNotification("A new Pokémon is waiting for you!");
    classicState.removeState();
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

function onVictory(tries, pokemon) {
  var audio = new Audio("public/audio/victory-sound.mp3");
  audio.volume = 0.1;
  audio.play();
  setTimeout(() => {
    var ad = document.createElement("DIV");
    ad.setAttribute("id", "victory-ad-container");
    subtitle.insertAdjacentElement("afterend", ad);
    ad.innerHTML = `<div id="victory-text1"><b>GG!</b></div><div id="victory-text2"><b>It was ${pokemon.name} indeed!</b></div><div><img alt="" style="animation: fadeIn 500ms" src='/public/images/sprites/${pokemon.name}.webp' width='180px' height='180px'></div><div id="victory-text3"><b>You guessed it in ${tries} tries...</b></div><div id="victory-text4"><b>Think you can do better? Let's see!</b></div><a aria-label="Go to Home" href='/'><button id='continue-button'>Continue</button></a>`;
  }, 1000);
}

function initializeAutocomplete(element, array) {
  element.addEventListener("input", function () {
    var val = this.value;
    closeList();
    if (!val) return false;
    var list = document.createElement("DIV");
    list.setAttribute("id", "autocomplete-list");
    list.setAttribute("class", "autocomplete-items");
    this.parentNode.appendChild(list);
    for (var i = 0; i < array.length; i++) {
      if (array[i].substr(0, val.length).toUpperCase() == val.toUpperCase()) {
        var option = document.createElement("DIV");
        option.className = "list-options";
        option.innerHTML = `<img alt="" src='/public/images/sprites/${
          array[i]
        }.webp' width='70px' height='70px'><strong style="color: lightgreen;">${array[
          i
        ].substr(0, val.length)}</strong>${array[i].substr(
          val.length
        )}<input type='hidden' value='${array[i]}'>`;
        option.addEventListener("click", function () {
          element.value = this.getElementsByTagName("input")[0].value;
          closeList();
        });
        list.appendChild(option);
      }
    }
  });

  function closeList(e) {
    var items = document.getElementsByClassName("autocomplete-items");
    for (var i = 0; i < items.length; i++)
      if (e != items[i] && e != element)
        items[i].parentNode.removeChild(items[i]);
  }

  document.addEventListener("click", (e) => {
    closeList(e.target);
  });
}

function animateFadeIn(element, duration) {
  element.style.animation = "fadeIn " + duration;
  element.style.visibility = "visible";
}

function animateFadeOut(element, duration) {
  element.style.animation = "fadeOut " + duration;
  setTimeout(() => (element.style.visibility = "hidden"), 1150);
}

function triggerElementAnimation(element, animationClass) {
  while (element.classList.length > 0)
    element.classList.remove(element.classList.item(0));
  void element.offsetWidth;
  element.classList.add(animationClass);
}

function sendNotification(message) {
  if ("Notification" in window)
    Notification.requestPermission().then((permission) => {
      if (permission === "granted")
        new Notification("Pokédle", {
          body: message,
          icon: "/public/images/icon-192x192.webp",
        });
    });
}
