import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

function showAuthError(message) {
  document.documentElement.removeAttribute("data-auth-state");
  const authLoading = document.getElementById("auth-loading");
  if (authLoading) {
    authLoading.textContent = message;
    authLoading.hidden = false;
  }
}

async function syncAppVersion() {
  const appVersionCacheTtlMs = 24 * 60 * 60 * 1000;
  const expiresAtKey = "pokedleAppVersionExpiresAt";
  const storedVersion = localStorage.getItem("pokedleAppVersion");
  const expiresAt = Number(localStorage.getItem(expiresAtKey));
  const storedVersionIsFresh =
    storedVersion &&
    Number.isFinite(expiresAt) &&
    expiresAt > Date.now();

  if (storedVersionIsFresh) {
    axios.defaults.headers.common["X-Client-Version"] = storedVersion;
    return;
  }

  try {
    const response = await axios.get("/app/version", {
      headers: storedVersionIsFresh
        ? { "X-Client-Version": storedVersion }
        : {},
    });
    const version = response.data?.version;
    if (!version) return;
    localStorage.setItem("pokedleAppVersion", version);
    localStorage.setItem(
      expiresAtKey,
      String(Date.now() + appVersionCacheTtlMs),
    );
    axios.defaults.headers.common["X-Client-Version"] = version;
  } catch (error) {
    console.error("Could not synchronize the app version:", error);
  }
}

await syncAppVersion();

let config;
try {
  const response = await axios.get("/env/fb");
  config = response.data;
} catch (error) {
  console.error("Failed to initialize authentication:", error);
  showAuthError("Unable to check authentication.");
  throw error;
}

export const auth = getAuth(initializeApp(config));

axios.interceptors.request.use(async (requestConfig) => {
  await auth.authStateReady();
  if (!auth.currentUser) return requestConfig;

  try {
    const token = await auth.currentUser.getIdToken();
    requestConfig.headers = requestConfig.headers || {};
    requestConfig.headers.Authorization = `Bearer ${token}`;
  } catch (error) {
    console.error("Could not attach authentication to the request:", error);
  }
  return requestConfig;
});
