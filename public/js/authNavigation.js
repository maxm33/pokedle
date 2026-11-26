import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { animateFadeIn } from "./uiAnimations.js";
import { STORAGE_KEYS } from "./storageKeys.js";

export function initializeAuthNavigation(auth) {
  const logImage = document.getElementById("login-img");
  const loginButton = document.getElementById("login-button");
  const rankingButton = document.getElementById("ranking-button");
  const shopButton = document.getElementById("shop-button");
  const pokedexButton = document.getElementById("pokedex-button");
  const profileButton = document.getElementById("profile-button");
  const profileName = document.getElementById("profile-name");
  const profileNameEditButton = document.getElementById(
    "edit-profile-name-button",
  );
  const profileNameForm = document.getElementById("profile-name-form");
  const authLoading = document.getElementById("auth-loading");
  let displayedAuthState = document.documentElement.dataset.authState;

  const unsubscribe = onAuthStateChanged(
    auth,
    (user) => {
      const authState = user ? "signed-in" : "signed-out";
      const shouldAnimate = displayedAuthState !== authState;
      displayedAuthState = authState;
      document.documentElement.dataset.authState = authState;
      try {
        sessionStorage.setItem(STORAGE_KEYS.authState, authState);
      } catch (error) {
        console.error("Failed to cache navigation state:", error);
      }

      if (loginButton && logImage && rankingButton) {
        loginButton.style.backgroundColor = user ? "#ff6666" : "#8cff66";
        logImage.src = user
          ? "/public/images/misc/logout.webp"
          : "/public/images/misc/login.webp";
        rankingButton.style.borderRadius = user
          ? "0"
          : "1.5em 0 0 1.5em";
        if (shouldAnimate) {
          animateFadeIn(loginButton, "1s");
          animateFadeIn(rankingButton, "1s");
          if (shopButton) animateFadeIn(shopButton, "1s");
          if (user && pokedexButton) animateFadeIn(pokedexButton, "1s");
          if (user && profileButton) animateFadeIn(profileButton, "1s");
        }
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
    },
    (error) => {
      console.error("Authentication check failed:", error);
      document.documentElement.removeAttribute("data-auth-state");
      if (authLoading) {
        authLoading.textContent = "Unable to check authentication.";
        authLoading.hidden = false;
      }
    },
  );

  profileButton?.addEventListener("click", async () => {
    await auth.authStateReady();
    if (auth.currentUser)
      window.location.href = `/user/${auth.currentUser.uid}/profile`;
  });

  pokedexButton?.addEventListener("click", async () => {
    await auth.authStateReady();
    if (auth.currentUser)
      window.location.href = `/user/${auth.currentUser.uid}/pokedex`;
  });

  rankingButton?.addEventListener("click", () => {
    const currentUrl = new URL(window.location.href);
    const mode =
      currentUrl.pathname.startsWith("/sentry") ||
      (currentUrl.pathname === "/ranking" &&
        currentUrl.searchParams.get("mode") === "sentry")
        ? "sentry"
        : "classic";
    window.location.href = `/ranking?mode=${mode}`;
  });

  shopButton?.addEventListener("click", () => {
    window.location.href = "/shop";
  });

  return { loginButton, unsubscribe };
}
