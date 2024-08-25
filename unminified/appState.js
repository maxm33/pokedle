export class AppState {
  guesses = [];
  rendered = [];

  getID() {
    return JSON.parse(window.localStorage.getItem("userID"));
  }
  setID(id) {
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
  add(guess) {
    this.refreshState();
    this.guesses.unshift(guess);
    window.localStorage.setItem("state", JSON.stringify(this.guesses));
    this.renderGuess(this.guesses[0]);
  }
  renderGuess(guess) {
    var menucontainer = document.getElementById("answers-container");
    var menuoption = document.createElement("DIV");
    menuoption.setAttribute("class", "answers");
    menuoption.innerHTML = `<img alt="" aria-label="${guess[0].name}" class="pokeimage" src='/public/images/sprites/${guess[0].name}.webp'>`;
    for (var prop in guess[1]) {
      if (
        Object.hasOwnProperty.call(guess[1], prop) &&
        guess[1][prop] != true &&
        guess[1][prop] != false
      ) {
        var card = document.createElement("DIV");
        card.setAttribute("class", guess[1][prop]);
        switch (prop) {
          case "habitat":
            card.innerHTML = `<img alt="" aria-label="${guess[0][prop]}" class="habitat" src="/public/images/habitats/${guess[0][prop]}.webp"/>`;
            break;
          case "color":
            var colors = guess[0][prop].split(" , ");
            card.innerHTML =
              colors[1] == null
                ? `<div class="color-square" style="background-color: ${colors[0]}"></div>`
                : `<div class="color-square" style="background-color: ${colors[0]}"></div><div class="color-square" style="background-color: ${colors[1]}"></div>`;
            break;
          case "type":
            var types = guess[0][prop].split(" , ");
            card.innerHTML =
              types[1] == null
                ? `<img alt="" aria-label="${types[0]}" class="types" src="/public/images/types/${types[0]}.webp"/>`
                : `<img alt="" aria-label="${types[0]}" class="types" src="/public/images/types/${types[0]}.webp"/><img alt="" aria-label="${types[1]}" class="types" src="/public/images/types/${types[1]}.webp"/>`;
            break;
          default:
            card.innerHTML = `<p class="answers-text">${guess[0][prop]}</p>`;
        }
        menuoption.appendChild(card);
      }
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
