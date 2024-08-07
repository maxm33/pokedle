export class AppState {
  guesses = [];
  rendered = 0;

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
    return this.guesses.length;
  }
  getRenderedTries() {
    return this.rendered;
  }
  exists() {
    return this.guesses.length != 0 ? true : false;
  }
  saveState() {
    window.localStorage.setItem("state", JSON.stringify(this.guesses));
  }
  removeState() {
    window.localStorage.removeItem("state");
  }
  getSavedState() {
    var guesses = JSON.parse(window.localStorage.getItem("state"));
    if (guesses != null) {
      this.guesses = guesses;
      console.log("State: restored");
    } else console.log("State: not found");
  }
  add(guess) {
    this.guesses.unshift(guess);
    this.saveState();
    this.renderGuess(this.guesses[0]);
  }
  renderGuess(guess) {
    var menucontainer = document.getElementById("answers-container");
    var menuoption = document.createElement("DIV");
    menuoption.setAttribute("class", "answers");
    menuoption.innerHTML = `<img src='/public/images/sprites/${guess[0].name}.png' width='100px' height='100px'>`;
    for (var prop in guess[1]) {
      if (
        Object.hasOwnProperty.call(guess[1], prop) &&
        guess[1][prop] != true &&
        guess[1][prop] != false
      ) {
        var card = document.createElement("DIV");
        card.setAttribute("class", guess[1][prop]);
        card.innerHTML = `<p class="answers-text">${guess[0][prop]}</p>`;
        menuoption.appendChild(card);
      }
    }
    menucontainer.insertAdjacentElement("afterbegin", menuoption);
    this.rendered++;
  }
  renderState() {
    for (var i = this.guesses.length - 1; i >= 0; i--)
      this.renderGuess(this.guesses[i]);
  }
}
