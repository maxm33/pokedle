import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { pokemons } from "./pokemons.js";
import { classicAppState } from "./classicAppState.js";
import { animateFadeIn, auth } from "./auth.js";

// request for browser notifications
if ("Notification" in window)
  Notification.requestPermission((permission) => {
    if (permission != "granted") console.log("Notifications: no permission");
    else console.log("Notifications: enabled");
  });

// get all important HTML elements to manage
let timer = document.getElementById("timer");
let subtitle = document.getElementById("subtitle");
let containerbar = document.getElementById("textbar-container");
let textbar = document.getElementById("textbar");
let guessButton = document.getElementById("guess-button");
let containerstate = document.getElementById("state-container");
let containertitles = document.getElementById("titles-container");
let guessBallScene = document.querySelector(".guess-pokeball-scene");
const guessBallVariants = ["great-ball", "ultra-ball", "master-ball"];

function setGuessBallVariant(variant) {
  guessBallScene.classList.remove(...guessBallVariants);
  if (guessBallVariants.includes(variant))
    guessBallScene.classList.add(variant);
}

let classicState = new classicAppState(); // initialize app state

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

onAuthStateChanged(auth, (user) => {
  setGuessBallVariant(null);
  if (user) {
    user
      .getIdToken()
      .then((token) =>
        axios.get("/classic/ball", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      )
      .then((res) => setGuessBallVariant(res?.data?.ball ?? null))
      .catch((err) => {
        console.error(err);
        setGuessBallVariant(null);
      });
  }

  axios
    .get(
      "/classic/canPlay/uid=" +
        userID +
        "&gid=" +
        (auth.currentUser ? auth.currentUser.uid : null),
    )
    .then((res) => {
      // manage the elements according whether the user can play or not
      if (res.data) {
        // user can play
        if (subtitle.style.display == "block") {
          triggerElementAnimation(subtitle, "fadeOut");
          setTimeout(() => (subtitle.style.display = "none"), 1150);
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
        if (subtitle.style.display == "none") {
          triggerElementAnimation(subtitle, "fadeIn");
          subtitle.style.display = "block";
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

guessButton.addEventListener("click", async () => {
  await submitGuess(textbar.value);
});

async function submitGuess(guess, inputElement = textbar) {
  let normalizedGuess = guess?.trim();
  // in case of type errors, textbar will shake
  if (normalizedGuess == "" || !pokemons.includes(normalizedGuess)) {
    inputElement.value = "";
    triggerElementAnimation(inputElement, "shake");
    return;
  }
  if (classicState.isPokemonGuessed(normalizedGuess)) {
    inputElement.value = "";
    triggerElementAnimation(inputElement, "shake");
    return;
  }
  inputElement.value = "";
  guessButton.disabled = true;
  let keepInputDisabled = false;
  if (isAndroidDevice()) {
    inputElement.blur();
    window.setTimeout(() => inputElement.blur(), 0);
  }
  try {
    let token = null;
    if (auth.currentUser != null) token = await auth.currentUser.getIdToken();
    let res = await axios.post("/classic", {
      token: token,
      uid: userID,
      guess: normalizedGuess,
      tries: classicState.getTries() + 1,
    });
    let pokemon = res.data[0];
    let hasWon = res.data[2];
    inputElement.disabled = true;
    await playGuessSequence(hasWon, res.data[1]);
    if (classicState.notRendered()) animateFadeIn(containertitles, "1.5s"); // hint categories will be shown
    classicState.addGuess(res.data); // rendering hints related to this guess
    keepInputDisabled = hasWon;
    if (hasWon) {
      onVictory(classicState.getTries(), pokemon, res.data[3]?.shiny === true);
      classicState.removeState(); // reset the state
    }
  } catch (err) {
    console.error(err);
  } finally {
    inputElement.disabled = keepInputDisabled;
    guessButton.disabled = false;
  }
}

async function playGuessSequence(hasWon, response) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return Promise.resolve();

  let scene = document.querySelector(".guess-pokeball-scene");
  let bouncer = scene.querySelector(".guess-pokeball-bouncer");
  await waitForBounceCycle(bouncer);

  let shaker = scene.querySelector(".guess-pokeball-shaker");
  let openingLid = scene.querySelector(".guess-pokeball-top");
  let sequenceClass = hasWon ? "is-catching" : "is-releasing";
  let animationName = hasWon
    ? "guess-pokeball-catch-shake"
    : "guess-pokeball-release-shake";
  let correctCount = Object.values(response ?? {}).filter(
    (status) => status === "correct",
  ).length;
  let shakeCount = correctCount >= 4 ? 3 : correctCount >= 2 ? 2 : 1;

  return new Promise((resolve) => {
    let finishOpening = (event) => {
      if (
        event.target !== openingLid ||
        event.animationName !== "guess-pokeball-open-top"
      )
        return;
      openingLid.removeEventListener("animationend", finishOpening);
      scene.classList.remove("is-releasing", "is-opening");
      scene.style.removeProperty("--release-shake-count");
      resolve();
    };
    let finishSequence = (event) => {
      if (event.target !== shaker || event.animationName !== animationName)
        return;
      shaker.removeEventListener("animationend", finishSequence);
      if (hasWon) {
        scene.classList.remove(sequenceClass);
        resolve();
        return;
      }
      openingLid.addEventListener("animationend", finishOpening);
      scene.classList.add("is-opening");
    };
    if (!hasWon) scene.style.setProperty("--release-shake-count", shakeCount);
    shaker.addEventListener("animationend", finishSequence);
    scene.classList.add(sequenceClass);
  });
}

function waitForBounceCycle(bouncer) {
  return new Promise((resolve) => {
    let finishBounce = (event) => {
      if (
        event.target !== bouncer ||
        event.animationName !== "guess-pokeball-bounce"
      )
        return;
      bouncer.removeEventListener("animationiteration", finishBounce);
      resolve();
    };
    bouncer.addEventListener("animationiteration", finishBounce);
  });
}

// where timer and initial guess rendering are managed
function manageGameState(id, remainingTime) {
  // remove any old game states
  let gameID = classicState.getGameID();
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

  let totalSeconds = Math.floor(remainingTime / 1000);
  let remainingSecondsAfterHours = totalSeconds % 3600;
  let hours = Math.floor(totalSeconds / 3600);
  let minutes = Math.floor(remainingSecondsAfterHours / 60);
  let seconds = remainingSecondsAfterHours % 60;

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
    timer.innerHTML =
      "Reset in<br />" +
      (hours < 10 ? "0" + hours : hours) +
      ":" +
      (minutes < 10 ? "0" + minutes : minutes) +
      ":" +
      (seconds < 10 ? "0" + seconds : seconds);
  }, 1000);
}

function onVictory(tries, pokemon, shiny) {
  let pokemonDisplayName = getPokemonDisplayName(pokemon.name);
  let spriteName = shiny ? `${pokemon.name}_shiny` : pokemon.name;
  let victoryText = shiny
    ? `It was a shiny ${pokemonDisplayName} indeed!`
    : `It was ${pokemonDisplayName} indeed!`;
  let audio = new Audio("public/audio/classic_victory_ost.mp3");
  audio.volume = 0.1;
  audio.play();
  setTimeout(() => {
    let ad = document.createElement("DIV");
    ad.setAttribute("id", "victory-ad-container");
    subtitle.insertAdjacentElement("afterend", ad);
    ad.innerHTML = `<div id="victory-text1"><b>GG!</b></div><div id="victory-text2"><b>${victoryText}</b></div><div><img alt="${pokemonDisplayName}${shiny ? " (Shiny)" : ""}" style="animation: fadeIn 500ms" src='/public/images/sprites/${spriteName}.webp' width='180px' height='180px'></div><div id="victory-text3"><b>You guessed it in ${tries} tries...</b></div><div id="victory-text4"><b>Think you can do better? Let's see!</b></div><a aria-label="Go to Home" href='/'><button id='continue-button'>Continue</button></a>`;
  }, 1000);
}

function initializeAutocomplete(element, array) {
  element.addEventListener("input", function () {
    let val = this.value;
    closeList();
    if (!val) return false;
    let list = document.createElement("DIV");
    list.setAttribute("id", "autocomplete-list");
    list.setAttribute("class", "autocomplete-items");
    this.parentNode.appendChild(list);
    let availableOptions = array.filter(
      (name) =>
        !classicState.isPokemonGuessed(name) &&
        name.substr(0, val.length).toUpperCase() == val.toUpperCase(),
    );
    for (let i = 0; i < availableOptions.length; i++) {
      let originalName = availableOptions[i];
      let displayName = getPokemonDisplayName(originalName);
      let displayMatch = displayName.substr(0, val.length);
      let displayRest = displayName.substr(val.length);
      let option = document.createElement("DIV");
      option.className = "list-options";
      option.innerHTML = `
        <img alt="" src="/public/images/sprites/${originalName}.webp"
             width="70px" height="70px">
        <strong style="color: #8cff66;">${displayMatch}</strong>${displayRest}
        <input type="hidden" value="${originalName}">
      `;
      option.addEventListener("click", async function () {
        element.value = originalName;
        closeList();
        await submitGuess(originalName, element);
      });
      list.appendChild(option);
    }
  });

  function closeList(e) {
    let items = document.getElementsByClassName("autocomplete-items");
    for (let i = 0; i < items.length; i++)
      if (e != items[i] && e != element)
        items[i].parentNode.removeChild(items[i]);
  }

  document.addEventListener("click", (e) => {
    closeList(e.target);
  });
}

function getPokemonDisplayName(pokemonName) {
  return pokemonName
    .replace("Farfetchd", "Farfetch'd")
    .replace("NidoranF", "Nidoran♀")
    .replace("NidoranM", "Nidoran♂");
}

function isAndroidDevice() {
  return /android/i.test(navigator.userAgent || "");
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
          icon: "/public/images/icons/icon-192x192.webp",
        });
    });
}
