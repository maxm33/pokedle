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
let profileName = document.getElementById("profile-name");
let profileNameEditButton = document.getElementById("edit-profile-name-button");
let profileNameForm = document.getElementById("profile-name-form");
let profileNameInput = document.getElementById("profile-name-input");
let profileNameSaveButton = document.getElementById("save-profile-name-button");
let profileNameSaveLoader = document.getElementById("save-profile-name-loader");
let authLoading = document.getElementById("auth-loading");
let profileNameCancelButton = document.getElementById(
  "cancel-profile-name-button",
);
let profileNameError = document.getElementById("profile-name-error");

let provider = new GoogleAuthProvider();

await syncAppVersion();

let config;
try {
  config = await axios.get("/env/fb");
} catch (err) {
  console.error("Failed to initialize authentication:", err);
  if (authLoading) authLoading.textContent = "Unable to check authentication.";
  throw err;
}
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

  if (profileNameEditButton && profileName) {
    const canEditProfileName =
      user && user.uid === profileName.dataset.profileUid;
    profileNameEditButton.hidden = !canEditProfileName;
    if (!canEditProfileName && profileNameForm) {
      profileNameForm.hidden = true;
      profileName.hidden = false;
    }
  }

  if (authLoading) authLoading.hidden = true;
}, (error) => {
  console.error("Authentication check failed:", error);
  if (authLoading) authLoading.textContent = "Unable to check authentication.";
});

loginButton.addEventListener("click", () => {
  unsubscribe();
  if (!auth.currentUser)
    signInWithPopup(auth, provider)
      .then(async () => {
        const user = auth.currentUser;
        const token = await user.getIdToken();
        await axios.put("/user/" + user.uid, {
          token: token,
        });
        window.location.reload();
      })
      .catch((err) => console.error(err));
  else {
    if (profileNameEditButton) profileNameEditButton.hidden = true;
    if (profileNameForm) profileNameForm.hidden = true;
    if (profileName) profileName.hidden = false;
    signOut(auth).then(() => {
      window.location.reload();
    });
  }
});

profileButton.addEventListener("click", () => {
  window.location.href = `/user/${auth.currentUser.uid}/profile`;
});

if (
  profileName &&
  profileNameEditButton &&
  profileNameForm &&
  profileNameInput &&
  profileNameSaveButton &&
  profileNameCancelButton &&
  profileNameError
) {
  profileNameEditButton.addEventListener("click", () => {
    profileNameInput.value = profileName.textContent.trim();
    profileNameError.textContent = "";
    profileName.hidden = true;
    profileNameEditButton.hidden = true;
    profileNameForm.hidden = false;
    profileNameInput.focus();
  });

  profileNameCancelButton.addEventListener("click", () => {
    profileNameForm.hidden = true;
    profileName.hidden = false;
    profileNameEditButton.hidden =
      auth.currentUser?.uid !== profileName.dataset.profileUid;
    profileNameError.textContent = "";
  });

  profileNameForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const currentUser = auth.currentUser;
    const username = profileNameInput.value.trim();
    if (!currentUser || currentUser.uid !== profileName.dataset.profileUid) {
      profileNameError.textContent = "Sign in to edit this profile name.";
      return;
    }
    if (username.length < 1 || username.length > 16) {
      profileNameError.textContent = "Username must be 1-16 characters.";
      return;
    }

    profileNameSaveButton.disabled = true;
    profileNameCancelButton.disabled = true;
    profileNameForm.setAttribute("aria-busy", "true");
    if (profileNameSaveLoader) profileNameSaveLoader.hidden = false;
    profileNameError.textContent = "";
    try {
      const token = await currentUser.getIdToken();
      await axios.patch(
        `/user/${currentUser.uid}/username`,
        { username },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      profileName.textContent = username;
      profileNameForm.hidden = true;
      profileName.hidden = false;
      profileNameEditButton.hidden =
        auth.currentUser?.uid !== profileName.dataset.profileUid;
    } catch (err) {
      console.error(err);
      profileNameError.textContent =
        err.response?.data?.error ||
        "Unable to update your name. Please try again.";
    } finally {
      profileNameSaveButton.disabled = false;
      profileNameCancelButton.disabled = false;
      profileNameForm.removeAttribute("aria-busy");
      if (profileNameSaveLoader) profileNameSaveLoader.hidden = true;
    }
  });
}

pokedexButton.addEventListener("click", () => {
  window.location.href = `/user/${auth.currentUser.uid}/pokedex`;
});

rankingButton.addEventListener("click", () => {
  window.location.href = window.location.pathname.startsWith("/sentry")
    ? "/sentry/ranking"
    : "/classic/ranking";
});

export function animateFadeIn(element, duration) {
  element.style.animation = "fadeIn " + duration;
  element.style.visibility = "visible";
}

function animateFadeOut(element, duration) {
  element.style.animation = "fadeOut " + duration;
  setTimeout(() => (element.style.visibility = "hidden"), 750);
}

function getStoredAppVersion() {
  return localStorage.getItem("pokedleAppVersion");
}

function setStoredAppVersion(version) {
  if (!version) return;
  localStorage.setItem("pokedleAppVersion", version);
  axios.defaults.headers.common["X-Client-Version"] = version;
}

async function syncAppVersion() {
  const storedVersion = getStoredAppVersion();
  if (storedVersion) {
    axios.defaults.headers.common["X-Client-Version"] = storedVersion;
  }

  try {
    const response = await axios.get("/app/version", {
      headers: storedVersion ? { "X-Client-Version": storedVersion } : {},
    });
    const version = response.data?.version;
    if (version) setStoredAppVersion(version);
  } catch (err) {
    console.error(err);
  }
}
