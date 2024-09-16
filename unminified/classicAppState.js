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
  notRendered() {
    return this.rendered.length == 0 ? true : false;
  }
  refreshState() {
    var state = JSON.parse(window.localStorage.getItem("state"));
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
    var pokemon = guess[0];
    var response = guess[1];
    var menucontainer = document.getElementById("answers-container");
    var menuoption = document.createElement("DIV");
    menuoption.setAttribute("class", "answers");
    menuoption.innerHTML = `<img alt="" aria-label="${pokemon.name}" src='/public/images/sprites/${pokemon.name}.webp' width="100px" height="100px">`;
    for (var property in response) {
      var card = document.createElement("DIV");
      card.setAttribute("class", response[property]);
      switch (property) {
        case "habitat":
          card.innerHTML = `<img alt="" aria-label="${pokemon[property]}" class="habitat" src="/public/images/classic/habitats/${pokemon[property]}.webp"/>`;
          break;
        case "colors":
          var colors = pokemon[property];
          card.innerHTML =
            colors[1] == null
              ? `<div class="color-square" style="background-color: ${colors[0]}"></div>`
              : `<div class="color-square" style="background-color: ${colors[0]}"></div><div class="color-square" style="background-color: ${colors[1]}"></div>`;
          break;
        case "types":
          var types = pokemon[property];
          card.innerHTML =
            types[1] == null
              ? `<img alt="" aria-label="${types[0]}" class="types" src="/public/images/classic/types/${types[0]}.webp"/>`
              : `<img alt="" aria-label="${types[0]}" class="types" src="/public/images/classic/types/${types[0]}.webp"/><img alt="" aria-label="${types[1]}" class="types" src="/public/images/classic/types/${types[1]}.webp"/>`;
          break;
        case "fullyEvolved":
          card.innerHTML = `<p class="answers-text">${
            pokemon[property] ? "Yes" : "No"
          }</p>`;
          break;
        default:
          card.innerHTML = `<p class="answers-text">${pokemon[property]}</p>`;
      }
      menuoption.appendChild(card);
    }
    menucontainer.insertAdjacentElement("afterbegin", menuoption);
    this.rendered[this.rendered.length] = guess;
  }
  renderState() {
    this.refreshState();
    for (var i = this.guesses.length - 1; i >= 0; i--)
      this.renderGuess(this.guesses[i]);
  }
  renderStateDiff() {
    this.refreshState();
    var copy = this.guesses;
    for (var i = 0; i < this.rendered.length; i++) {
      var index = copy.findIndex((e) => e[0].name == this.rendered[i][0].name);
      if (index >= 0) copy.splice(index, 1);
    }
    for (var i = copy.length - 1; i >= 0; i--) this.renderGuess(copy[i]);
  }
}
