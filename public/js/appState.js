export class AppState {
  constructor() {
    this.guesses = [];
    this.tries = 0;
    this.uuid = "";
  }
  getGuesses() {
    return this.guesses;
  }
  getTries() {
    return this.tries;
  }
  getID() {
    return this.uuid;
  }
  getTimestamp() {
    return JSON.parse(window.localStorage.getItem("timestamp"));
  }
  removeTimestamp() {
    window.localStorage.removeItem("timestamp");
  }
  incrementTries() {
    this.tries++;
  }
  setSavedID() {
    var uuid = JSON.parse(window.localStorage.getItem("uuid"));
    // if uuid is not been set already
    if (uuid == null) {
      // ask server to generate a unique id
      axios.get("/id").then(function (response) {
        window.localStorage.setItem("uuid", JSON.stringify(response.data));
      });
    }
    this.uuid = uuid;
  }
  setSavedState() {
    var guesses = JSON.parse(window.localStorage.getItem("state"));
    var tries = JSON.parse(window.localStorage.getItem("tries"));
    if (guesses != null && tries != null) {
      this.guesses = guesses;
      this.tries = tries;
      console.log("State has been restored from localStorage");
    } else console.log("State is not present");
  }
  saveState() {
    window.localStorage.setItem("state", JSON.stringify(this.guesses));
    window.localStorage.setItem("tries", JSON.stringify(this.tries));
  }
  removeState() {
    window.localStorage.removeItem("state");
    window.localStorage.removeItem("tries");
  }
  add(guess) {
    this.guesses.unshift(guess);
    this.saveState();
    this.render(this.guesses[0]);
  }
  render(guess) {
    var menucontainer = document.getElementById("answer-container");
    var menuoption = document.createElement("DIV");
    menuoption.setAttribute("class", "answer");
    menuoption.innerHTML = `<img src='/public/images/sprites/${guess[0].name}.png' width='100px' height='100px'>`;
    for (var prop in guess[1]) {
      if (
        Object.hasOwnProperty.call(guess[1], prop) &&
        guess[1][prop] != true &&
        guess[1][prop] != false
      ) {
        var card = document.createElement("DIV");
        card.setAttribute("class", guess[1][prop]);
        card.innerHTML = `<p>${guess[0][prop]}</p>`;
        menuoption.appendChild(card);
      }
    }
    menucontainer.insertAdjacentElement("afterbegin", menuoption);
  }
  renderAll() {
    for (var i = this.guesses.length - 1; i >= 0; i--) {
      this.render(this.guesses[i]);
    }
  }
}
