export class AppState {
  guesses = [];
  uuid = "";

  isPresent() {
    return this.guesses.length != 0 ? true : false;
  }
  getTries() {
    return this.guesses.length;
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
    if (guesses != null) {
      this.guesses = guesses;
      console.log("State has been restored from localStorage");
    } else console.log("State is not present");
  }
  saveState() {
    window.localStorage.setItem("state", JSON.stringify(this.guesses));
  }
  removeState() {
    window.localStorage.removeItem("state");
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
