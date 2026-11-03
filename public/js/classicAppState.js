export class classicAppState {
  guesses = [];
  rendered = [];

  getUserID() {
    return JSON.parse(window.localStorage.getItem("userID"));
  }
  setUserID(id) {
    window.localStorage.setItem("userID", JSON.stringify(id));
  }
  getGameID() {
    return JSON.parse(window.localStorage.getItem("gameID"));
  }
  setGameID(id) {
    window.localStorage.setItem("gameID", JSON.stringify(id));
  }
  getTries() {
    this.refreshState();
    return this.guesses.length;
  }
  getGuessedPokemonNames() {
    this.refreshState();
    return this.guesses
      .map((guess) => guess?.[0]?.name)
      .filter((name) => typeof name === "string" && name.length > 0);
  }
  isPokemonGuessed(pokemonName) {
    this.refreshState();
    return isPokemonAlreadyGuessed(pokemonName, this.guesses);
  }
  notRendered() {
    return this.rendered.length == 0 ? true : false;
  }
  refreshState() {
    let state = JSON.parse(window.localStorage.getItem("state"));
    if (state != null) this.guesses = state;
    else this.guesses = [];
  }
  removeState() {
    window.localStorage.removeItem("state");
  }
  addGuess(guess) {
    this.refreshState();
    this.guesses.unshift(guess);
    window.localStorage.setItem("state", JSON.stringify(this.guesses));
    this.renderGuess(this.guesses[0]);
  }
  renderGuess(guess) {
    let pokemon = guess[0];
    let response = guess[1];
    let menucontainer = document.getElementById("answers-container");
    let menuoption = document.createElement("DIV");
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
      let card = document.createElement("DIV");
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
          let colors = pokemon[property];
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
          let types = pokemon[property];
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
    this.refreshState();
    for (let i = this.guesses.length - 1; i >= 0; i--)
      this.renderGuess(this.guesses[i]);
  }
  renderStateDiff() {
    this.refreshState();
    let copy = this.guesses;
    for (let i = 0; i < this.rendered.length; i++) {
      let index = copy.findIndex((e) => e[0].name == this.rendered[i][0].name);
      if (index >= 0) copy.splice(index, 1);
    }
    for (let i = copy.length - 1; i >= 0; i--) this.renderGuess(copy[i]);
  }
}

function getGuessedPokemonNames(guesses = []) {
  return guesses
    .map((guess) => guess?.[0]?.name)
    .filter((name) => typeof name === "string" && name.length > 0);
}

function isPokemonAlreadyGuessed(pokemonName, guesses = []) {
  const normalizedGuess = pokemonName?.trim().toLowerCase();
  if (!normalizedGuess) return false;
  return getGuessedPokemonNames(guesses).some(
    (name) => name.trim().toLowerCase() === normalizedGuess,
  );
}
