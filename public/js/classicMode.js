import { pokemons } from "./pokemons.js";
import { ClassicAppState } from "./classicAppState.js";
import { auth } from "./auth.js";
import { animateFadeIn, triggerElementAnimation } from "./uiAnimations.js";
import {
  initializePokemonAutocomplete,
} from "./pokemonAutocomplete.js";
import { showClassicVictory } from "./classicVictory.js";
import { initializeClassicEventNotifications } from "./classicNotifications.js";
import {
  playGuessSequence,
} from "./classicGuessAnimation.js";
import { manageGameState } from "./classicGameClock.js";
import { initializeClassicPlayerAccess } from "./classicPlayerAccess.js";

// request for browser notifications
if ("Notification" in window) Notification.requestPermission();

const updateClassicEventNotifications = initializeClassicEventNotifications();
const timer = document.getElementById("timer");
const textbar = document.getElementById("textbar");
const guessButton = document.getElementById("guess-button");
const containertitles = document.getElementById("titles-container");
const stateLoading = document.getElementById("state-loading");
const stateLoadingMessage = document.getElementById("state-loading-message");

const classicState = new ClassicAppState(); // initialize app state

// get user ID or request and set if null
if (classicState.getUserID() == null) {
  await axios.get("/user/id").then((res) => {
    classicState.setUserID(res.data);
  });
}
const userID = classicState.getUserID();

// get game status to update timer and render guesses
axios
  .get("/classic/state")
  .then((res) => {
    const classicClock = manageGameState(res.data[0], res.data[1], {
      classicState,
      timer,
      titles: containertitles,
      animateFadeIn,
      sendNotification,
    });
    window.addEventListener(
      "pagehide",
      () => classicClock?.destroy(),
      { once: true },
    );
    document.dispatchEvent(
      new CustomEvent("pokedle:classic-game-ready", {
        detail: { gameId: classicState.getGameID() },
      }),
    );
    updateClassicEventNotifications(res.data[3], res.data[4], res.data[5]);
    stateLoading.hidden = true;
  })
  .catch((err) => {
    console.error("Failed to retrieve game state:", err);
    stateLoading.querySelector(".profile-loader").hidden = true;
    stateLoadingMessage.textContent = "Unable to retrieve game state.";
  });

initializePokemonAutocomplete(
  textbar,
  {
    names: pokemons,
    isPokemonGuessed: (name) => classicState.isPokemonGuessed(name),
  },
  submitGuess,
);

initializeClassicPlayerAccess(auth, userID);

guessButton.addEventListener("click", async () => {
  await submitGuess(textbar.value);
});

async function submitGuess(guess, inputElement = textbar) {
  const normalizedGuess = guess?.trim();
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
    const token = auth.currentUser
      ? await auth.currentUser.getIdToken()
      : null;
    const res = await axios.post("/classic", {
      token,
      uid: userID,
      guess: normalizedGuess,
    });
    const pokemon = res.data[0];
    const hasWon = res.data[2];
    inputElement.disabled = true;
    await playGuessSequence(hasWon, res.data[1]);
    if (classicState.notRendered()) animateFadeIn(containertitles, "1.5s"); // hint categories will be shown
    if (!classicState.isPokemonGuessed(pokemon.name))
      classicState.addGuess(res.data); // rendering hints related to this guess
    keepInputDisabled = hasWon;
    if (hasWon) {
      onVictory(
        res.data[4].tries,
        pokemon,
        res.data[3]?.shiny === true,
        res.data[3]?.pokedollarsEarned ?? 0,
      );
      classicState.removeState(); // reset the state
    }
  } catch (err) {
    console.error(err);
  } finally {
    inputElement.disabled = keepInputDisabled;
    guessButton.disabled = false;
  }
}

function onVictory(tries, pokemon, shiny, pokedollarsEarned) {
  document.dispatchEvent(
    new CustomEvent("pokedle:classic-victory", {
      detail: { gameId: classicState.getGameID() },
    }),
  );
  showClassicVictory({
    tries,
    pokemon,
    shiny,
    pokedollarsEarned,
    signedIn: Boolean(auth.currentUser),
  });
  const audio = new Audio("public/audio/classic_victory_ost.mp3");
  audio.volume = 0.1;
  audio.play();
}

function isAndroidDevice() {
  return /android/i.test(navigator.userAgent || "");
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
