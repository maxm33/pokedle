import { STORAGE_KEYS } from "./storageKeys.js";

export class ClassicAppState {
  guesses = [];
  rendered = [];
  stateLoaded = false;

  readStorage(key) {
    try {
      return JSON.parse(window.localStorage.getItem(key));
    } catch (_) {
      return null;
    }
  }
  writeStorage(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
  getUserID() {
    return this.readStorage(STORAGE_KEYS.classicUserId);
  }
  setUserID(id) {
    this.writeStorage(STORAGE_KEYS.classicUserId, id);
  }
  getGameID() {
    return this.readStorage(STORAGE_KEYS.classicGameId);
  }
  setGameID(id) {
    this.writeStorage(STORAGE_KEYS.classicGameId, id);
  }
  getTries() {
    this.refreshState();
    return this.guesses.length;
  }
  isPokemonGuessed(pokemonName) {
    this.refreshState();
    return isPokemonAlreadyGuessed(pokemonName, this.guesses);
  }
  notRendered() {
    return this.rendered.length === 0;
  }
  refreshState(force = false) {
    if (this.stateLoaded && !force) return;
    const state = this.readStorage(STORAGE_KEYS.classicState);
    if (state != null) this.guesses = state;
    else this.guesses = [];
    this.stateLoaded = true;
  }
  removeState() {
    window.localStorage.removeItem(STORAGE_KEYS.classicState);
    this.guesses = [];
    this.rendered = [];
    this.stateLoaded = false;
  }
  addGuess(guess) {
    this.refreshState(true);
    this.guesses.unshift(guess);
    window.localStorage.setItem(STORAGE_KEYS.classicState, JSON.stringify(this.guesses));
    this.renderGuess(this.guesses[0]);
  }
  renderGuess(guess) {
    const pokemon = guess[0];
    const response = guess[1];
    const menucontainer = document.getElementById("answers-container");
    const menuoption = document.createElement("DIV");
    menuoption.setAttribute("class", "answers");
    const pokemonImage = document.createElement("img");
    pokemonImage.alt = "";
    pokemonImage.setAttribute("aria-label", pokemon.name);
    pokemonImage.src = `/public/images/sprites/${encodeURIComponent(
      pokemon.name,
    )}.webp`;
    pokemonImage.width = 100;
    pokemonImage.height = 100;
    menuoption.appendChild(pokemonImage);
    const getColorHex = (color) =>
      Array.isArray(color)
        ? color[1]
        : color && typeof color === "object"
          ? color.hex
          : color;
    for (let property in response) {
      const card = document.createElement("DIV");
      card.setAttribute("class", response[property]);
      let text;
      switch (property) {
        case "habitat": {
          const habitatImage = document.createElement("img");
          habitatImage.alt = "";
          habitatImage.setAttribute("aria-label", pokemon[property]);
          habitatImage.className = "habitat";
          habitatImage.src = `/public/images/classic/habitats/${encodeURIComponent(
            pokemon[property],
          )}.webp`;
          card.appendChild(habitatImage);
          break;
        }
        case "colors": {
          const colors = pokemon[property];
          const colorCount = colors[1] == null ? 1 : 2;
          for (let i = 0; i < colorCount; i++) {
            const square = document.createElement("div");
            square.className = "color-square";
            square.style.backgroundColor = getColorHex(colors[i]);
            card.appendChild(square);
          }
          break;
        }
        case "types": {
          const types = pokemon[property];
          const typeCount = types[1] == null ? 1 : 2;
          for (let i = 0; i < typeCount; i++) {
            const typeImage = document.createElement("img");
            typeImage.alt = "";
            typeImage.setAttribute("aria-label", types[i]);
            typeImage.className = "types";
            typeImage.src = `/public/images/classic/types/${encodeURIComponent(
              types[i],
            )}.webp`;
            card.appendChild(typeImage);
          }
          break;
        }
        case "fullyEvolved":
          text = pokemon[property] ? "Yes" : "No";
          break;
        default:
          text = pokemon[property];
      }
      if (!["habitat", "colors", "types"].includes(property)) {
        const answerText = document.createElement("p");
        answerText.className = "answers-text";
        answerText.textContent = text;
        card.appendChild(answerText);
      }
      menuoption.appendChild(card);
    }
    menucontainer.insertAdjacentElement("afterbegin", menuoption);
    this.rendered[this.rendered.length] = guess;
  }
  renderState() {
    this.refreshState(true);
    for (let i = this.guesses.length - 1; i >= 0; i--)
      this.renderGuess(this.guesses[i]);
  }
  renderStateDiff() {
    this.refreshState(true);
    const copy = [...this.guesses];
    for (let i = 0; i < this.rendered.length; i++) {
      const index = copy.findIndex((e) => e[0].name == this.rendered[i][0].name);
      if (index >= 0) copy.splice(index, 1);
    }
    for (let i = copy.length - 1; i >= 0; i--) this.renderGuess(copy[i]);
  }
}

function isPokemonAlreadyGuessed(pokemonName, guesses = []) {
  const normalizedGuess = pokemonName?.trim().toLowerCase();
  if (!normalizedGuess) return false;
  return guesses.some(
    (guess) =>
      typeof guess?.[0]?.name === "string" &&
      guess[0].name.trim().toLowerCase() === normalizedGuess,
  );
}
