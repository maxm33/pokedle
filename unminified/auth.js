import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

// get all important HTML elements to manage
let logimg = document.getElementById("login-img");
let loginButton = document.getElementById("login-button");
let rankingButton = document.getElementById("ranking-button");
let pokedexButton = document.getElementById("pokedex-button");
let profileButton = document.getElementById("profile-button");

let provider = new GoogleAuthProvider();
let config = await axios.get("/env/fb");
export const auth = getAuth(initializeApp(config.data));

const unsubscribe = onAuthStateChanged(auth, (user) => {
  if (user) {
    // user is signed in
    loginButton.style.backgroundColor = "#ff6666";
    logimg.src = "/public/images/misc/logout.webp";
    rankingButton.style.borderRadius = "0";
    animateFadeIn(loginButton, "1s");
    animateFadeIn(rankingButton, "1s");
    animateFadeIn(pokedexButton, "1s");
    animateFadeIn(profileButton, "1s");
  } else {
    // user is not signed in
    loginButton.style.backgroundColor = "#8cff66";
    logimg.src = "/public/images/misc/login.webp";
    rankingButton.style.borderRadius = "1.5em 0 0 1.5em";
    animateFadeIn(loginButton, "1s");
    animateFadeIn(rankingButton, "1s");
    animateFadeOut(pokedexButton, "1s");
    animateFadeOut(profileButton, "1s");
  }
});

loginButton.addEventListener("click", () => {
  unsubscribe();
  if (!auth.currentUser)
    signInWithPopup(auth, provider).then(() => {
      auth.currentUser.getIdToken().then((token) => {
        axios.put("/user/" + auth.currentUser.uid, {
          name: auth.currentUser.displayName,
          token: token,
        });
        window.location.reload();
      });
    });
  else
    signOut(auth).then(() => {
      window.location.reload();
    });
});

profileButton.addEventListener("click", () => {
  window.location.href = `/user/${auth.currentUser.uid}/profile`;
});

pokedexButton.addEventListener("click", () => {
  window.location.href = `/user/${auth.currentUser.uid}/pokedex`;
});

rankingButton.addEventListener("click", () => {
  window.location.href = "/classic/ranking";
});

export function animateFadeIn(element, duration) {
  element.style.animation = "fadeIn " + duration;
  element.style.visibility = "visible";
}

function animateFadeOut(element, duration) {
  element.style.animation = "fadeOut " + duration;
  setTimeout(() => (element.style.visibility = "hidden"), 750);
}
