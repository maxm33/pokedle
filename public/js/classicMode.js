import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { pokemons } from "./pokemons.js";
import { classicAppState } from "./classicAppState.js";
import { animateFadeIn, auth } from "./auth.js";

// request for browser notifications
if ("Notification" in window) Notification.requestPermission();

// get all important HTML elements to manage
let timer = document.getElementById("timer");
let subtitle = document.getElementById("subtitle");
let containerbar = document.getElementById("textbar-container");
let textbar = document.getElementById("textbar");
let guessButton = document.getElementById("guess-button");
let containerstate = document.getElementById("state-container");
let containertitles = document.getElementById("titles-container");
let stateLoading = document.getElementById("state-loading");
let stateLoadingMessage = document.getElementById("state-loading-message");
let eventNotification = document.getElementById("event-notification");
let eventNotificationDouble = document.getElementById(
  "event-notification-double",
);
let eventNotificationShiny = document.getElementById(
  "event-notification-shiny",
);
let eventNotifications = document.getElementById("event-notifications");
let eventNotificationSwiper = document.getElementById(
  "event-notification-swiper",
);
let eventNotificationIndicators = document.getElementById(
  "event-notification-indicators",
);
let eventNotificationPrevious = document.getElementById(
  "event-notification-previous",
);
let eventNotificationNext = document.getElementById(
  "event-notification-next",
);
let eventNotificationIndicatorButtons = [];
let visibleEventNotifications = [];
let activeEventNotificationIndex = 0;
let eventNotificationAutoAdvance;
let eventNotificationPointerInteraction = false;
let rankingEventNotifications = [];
let guessBallScene = document.querySelector(".guess-pokeball-scene");
const guessBallVariants = ["great-ball", "ultra-ball", "master-ball"];
const eventNotificationDismissalStorageKey = "eventNotificationDismissals";

function getEventNotificationDate() {
  const dateParts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

function getDismissedEventNotificationIds(date) {
  const storedDismissals = JSON.parse(
    window.localStorage.getItem(eventNotificationDismissalStorageKey) || "null",
  );
  if (
    storedDismissals?.date !== date ||
    !Array.isArray(storedDismissals.ids)
  ) {
    return new Set();
  }
  return new Set(
    storedDismissals.ids.filter((id) => typeof id === "string"),
  );
}

let eventNotificationDismissalDate = getEventNotificationDate();
let dismissedEventNotificationIds = getDismissedEventNotificationIds(
  eventNotificationDismissalDate,
);

function updateEventNotificationIndicators() {
  if (!visibleEventNotifications.length) return;

  const swiperLeft = eventNotificationSwiper.getBoundingClientRect().left;
  activeEventNotificationIndex = visibleEventNotifications.reduce(
    (closestIndex, notification, index) => {
      const closestDistance = Math.abs(
        visibleEventNotifications[closestIndex].getBoundingClientRect().left -
          swiperLeft,
      );
      const distance = Math.abs(
        notification.getBoundingClientRect().left - swiperLeft,
      );
      return distance < closestDistance ? index : closestIndex;
    },
    0,
  );
  eventNotificationIndicatorButtons.forEach((button, index) => {
    if (index === activeEventNotificationIndex)
      button.setAttribute("aria-current", "true");
    else button.removeAttribute("aria-current");
  });
}

function showEventNotification(index) {
  const notification = visibleEventNotifications[index];
  if (!notification) return;

  activeEventNotificationIndex = index;
  updateEventNotificationIndicators();
  eventNotificationSwiper.scrollTo({
    left: notification.offsetLeft,
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
}

function resetEventNotificationAutoAdvance() {
  window.clearInterval(eventNotificationAutoAdvance);
  if (visibleEventNotifications.length > 1) {
    eventNotificationAutoAdvance = window.setInterval(() => {
      showEventNotification(
        (activeEventNotificationIndex + 1) % visibleEventNotifications.length,
      );
    }, 10000);
  }
}

function pauseEventNotificationAutoAdvance() {
  window.clearInterval(eventNotificationAutoAdvance);
}

function startEventNotificationPointerInteraction() {
  eventNotificationPointerInteraction = true;
  pauseEventNotificationAutoAdvance();
}

function finishEventNotificationPointerInteraction() {
  if (!eventNotificationPointerInteraction) return;
  eventNotificationPointerInteraction = false;
  resetEventNotificationAutoAdvance();
}

function renderEventNotifications() {
  visibleEventNotifications = [
    eventNotification,
    eventNotificationDouble,
    eventNotificationShiny,
    ...rankingEventNotifications,
  ].filter((notification) => notification && !notification.hidden);

  eventNotifications.hidden = visibleEventNotifications.length === 0;
  eventNotificationIndicators.hidden = visibleEventNotifications.length < 2;
  eventNotificationPrevious.hidden = visibleEventNotifications.length < 2;
  eventNotificationNext.hidden = visibleEventNotifications.length < 2;
  eventNotificationIndicators.replaceChildren();
  eventNotificationIndicatorButtons = visibleEventNotifications.map(
    (notification, index) => {
      notification.setAttribute(
        "aria-label",
        `Event notification ${index + 1} of ${visibleEventNotifications.length}`,
      );

      const button = document.createElement("button");
      button.className = "event-notification-indicator";
      button.type = "button";
      button.setAttribute(
        "aria-label",
        `Show notification ${index + 1} of ${visibleEventNotifications.length}`,
      );
      button.addEventListener("click", () => {
        showEventNotification(index);
        resetEventNotificationAutoAdvance();
      });
      eventNotificationIndicators.appendChild(button);
      return button;
    },
  );

  activeEventNotificationIndex = 0;
  eventNotificationSwiper.scrollTo({ left: 0, behavior: "auto" });
  updateEventNotificationIndicators();

  resetEventNotificationAutoAdvance();
}

window.addEventListener("ranking-notification", (event) => {
  const notification = event.detail?.card;
  if (!notification || rankingEventNotifications.includes(notification)) return;
  rankingEventNotifications.push(notification);
  eventNotificationSwiper.appendChild(notification);
  renderEventNotifications();
  showEventNotification(visibleEventNotifications.length - 1);
});
window.addEventListener(
  "ranking-notification-dismissed",
  renderEventNotifications,
);

eventNotificationSwiper.addEventListener(
  "scroll",
  updateEventNotificationIndicators,
);
eventNotificationSwiper.addEventListener(
  "pointerdown",
  startEventNotificationPointerInteraction,
);
eventNotificationSwiper.addEventListener(
  "wheel",
  resetEventNotificationAutoAdvance,
  { passive: true },
);
eventNotificationSwiper.addEventListener("keydown", (event) => {
  if (
    ["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(
      event.key,
    )
  )
    resetEventNotificationAutoAdvance();
});
window.addEventListener("pointerup", finishEventNotificationPointerInteraction);
window.addEventListener(
  "pointercancel",
  finishEventNotificationPointerInteraction,
);
eventNotificationPrevious.addEventListener("click", () => {
  showEventNotification(
    (activeEventNotificationIndex - 1 + visibleEventNotifications.length) %
      visibleEventNotifications.length,
  );
  resetEventNotificationAutoAdvance();
});
eventNotificationNext.addEventListener("click", () => {
  showEventNotification(
    (activeEventNotificationIndex + 1) % visibleEventNotifications.length,
  );
  resetEventNotificationAutoAdvance();
});
[eventNotification, eventNotificationDouble, eventNotificationShiny].forEach(
  (notification) => {
    notification
      ?.querySelector(".event-notification-dismiss")
      .addEventListener("click", () => {
        const currentDate = getEventNotificationDate();
        if (currentDate !== eventNotificationDismissalDate) {
          eventNotificationDismissalDate = currentDate;
          dismissedEventNotificationIds =
            getDismissedEventNotificationIds(currentDate);
        }
        dismissedEventNotificationIds.add(notification.id);
        window.localStorage.setItem(
          eventNotificationDismissalStorageKey,
          JSON.stringify({
            date: eventNotificationDismissalDate,
            ids: [...dismissedEventNotificationIds],
          }),
        );
        notification.hidden = true;
        renderEventNotifications();
      });
  },
);

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
axios
  .get("/classic/state")
  .then((res) => {
    manageGameState(res.data[0], res.data[1], res.data[2]);
    eventNotification.hidden =
      !res.data[3] || dismissedEventNotificationIds.has(eventNotification.id);
    if (eventNotificationDouble)
      eventNotificationDouble.hidden =
        !res.data[4] ||
        dismissedEventNotificationIds.has(eventNotificationDouble.id);
    if (eventNotificationShiny)
      eventNotificationShiny.hidden =
        !res.data[5] ||
        dismissedEventNotificationIds.has(eventNotificationShiny.id);
    renderEventNotifications();
    stateLoading.hidden = true;
  })
  .catch((err) => {
    console.error("Failed to retrieve game state:", err);
    stateLoading.querySelector(".profile-loader").hidden = true;
    stateLoadingMessage.textContent = "Unable to retrieve game state.";
  });

initializeAutocomplete(textbar, pokemons); // initialize autocomplete textbar

onAuthStateChanged(auth, async (user) => {
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

  let token = null;
  if (user) {
    try {
      token = await user.getIdToken();
    } catch (err) {
      console.error(err);
    }
  }

  axios
    .get(
      "/classic/canPlay/uid=" + userID + "&gid=" + (user ? user.uid : null),
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
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
    });
    let pokemon = res.data[0];
    let hasWon = res.data[2];
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

function onVictory(tries, pokemon, shiny, pokedollarsEarned) {
  let pokemonDisplayName = getPokemonDisplayName(pokemon.name);
  let gifName = encodeURIComponent(pokemon.name.toLowerCase());
  let victoryImageUrl = `/public/images/animations/${gifName}${shiny ? "_shiny" : ""}.gif`;
  let victoryText = shiny
    ? `It was a shiny ${pokemonDisplayName}!`
    : `It was ${pokemonDisplayName}!`;
  const pokedollarsText =
    pokedollarsEarned > 0
      ? `You earned ${pokedollarsEarned} Pokédollars!`
      : auth.currentUser
        ? ""
        : "Log in to earn Pokédollars!";
  let audio = new Audio("public/audio/classic_victory_ost.mp3");
  audio.volume = 0.1;
  audio.play();
  setTimeout(() => {
    let ad = document.createElement("DIV");
    ad.setAttribute("id", "victory-ad-container");
    document.body.appendChild(ad);
    const content = document.createElement("div");
    content.className = "victory-ad-content";
    ad.appendChild(content);
    const appendVictoryText = (id, text) => {
      const container = document.createElement("div");
      container.id = id;
      const boldText = document.createElement("b");
      boldText.textContent = text;
      container.appendChild(boldText);
      content.appendChild(container);
    };

    appendVictoryText("victory-text1", "GG!");
    appendVictoryText("victory-text2", victoryText);

    const imageContainer = document.createElement("div");
    const image = document.createElement("img");
    image.className = "victory-pokemon-image";
    image.alt = `${pokemonDisplayName}${shiny ? " (Shiny)" : ""}`;
    image.style.animation = "fadeIn 500ms";
    image.src = victoryImageUrl;
    image.width = 180;
    image.height = 180;
    imageContainer.appendChild(image);
    content.appendChild(imageContainer);

    appendVictoryText("victory-text3", `You guessed it in ${tries} tries...`);
    appendVictoryText("victory-text5", pokedollarsText);
    appendVictoryText("victory-text4", "Think you can do better? Let's see!");

    const homeLink = document.createElement("a");
    homeLink.setAttribute("aria-label", "Go to Home");
    homeLink.href = "/";
    const continueButton = document.createElement("button");
    continueButton.id = "continue-button";
    continueButton.textContent = "Continue";
    homeLink.appendChild(continueButton);
    content.appendChild(homeLink);
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
      const image = document.createElement("img");
      image.alt = "";
      image.src = `/public/images/sprites/${encodeURIComponent(
        originalName,
      )}.webp`;
      image.width = 70;
      image.height = 70;
      option.appendChild(image);

      const match = document.createElement("strong");
      match.style.color = "#8cff66";
      match.textContent = displayMatch;
      option.appendChild(match);
      option.appendChild(document.createTextNode(displayRest));

      const input = document.createElement("input");
      input.type = "hidden";
      input.value = originalName;
      option.appendChild(input);
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
