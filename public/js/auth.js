import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth } from "./firebaseClient.js";
import { initializeAuthNavigation } from "./authNavigation.js";
import {
  ACCOUNT_RATE_LIMIT_STORAGE_KEY,
  initializeAuthRateLimit,
} from "./authRateLimit.js";
import { initializeProfileNameEditor } from "./profileNameEditor.js";
import { STORAGE_KEYS } from "./storageKeys.js";

export { auth };

const provider = new GoogleAuthProvider();
const { loginButton, unsubscribe } = initializeAuthNavigation(auth);
const rateLimit = initializeAuthRateLimit(loginButton);
initializeProfileNameEditor(auth);

loginButton?.addEventListener("click", async () => {
  await auth.authStateReady();
  unsubscribe();
  if (!auth.currentUser) {
    try {
      const credential = await signInWithPopup(auth, provider);
      const token = await credential.user.getIdToken();
      await axios.put(`/user/${credential.user.uid}`, { token });
      window.location.reload();
    } catch (error) {
      console.error(error);
      if (rateLimit.isAccountModificationRateLimit(error)) {
        const retryAfterSeconds = Number(error.response.headers["retry-after"]);
        const retryAfterMs =
          Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
            ? retryAfterSeconds * 1000
            : rateLimit.fallbackWindowMs;
        const until = Date.now() + retryAfterMs;

        try {
          localStorage.setItem(STORAGE_KEYS.accountRateLimit, String(until));
        } catch (storageError) {
          console.error("Failed to save account rate limit state:", storageError);
        }
        rateLimit.applyAccountRateLimit(until);

        try {
          await signOut(auth);
        } catch (signOutError) {
          console.error(
            "Failed to sign out after account rate limit:",
            signOutError,
          );
        }
      }
    }
    return;
  }

  const profileNameEditButton = document.getElementById(
    "edit-profile-name-button",
  );
  const profileNameForm = document.getElementById("profile-name-form");
  const profileName = document.getElementById("profile-name");
  if (profileNameEditButton) profileNameEditButton.hidden = true;
  if (profileNameForm) profileNameForm.hidden = true;
  if (profileName) profileName.hidden = false;
  try {
    await signOut(auth);
    try {
      sessionStorage.setItem(STORAGE_KEYS.authState, "signed-out");
    } catch (error) {
      console.error("Failed to cache navigation state:", error);
    }
    window.location.reload();
  } catch (error) {
    console.error("Failed to sign out:", error);
  }
});
