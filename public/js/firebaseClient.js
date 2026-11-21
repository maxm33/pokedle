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
  const storedVersion = localStorage.getItem("pokedleAppVersion");
  if (storedVersion)
    axios.defaults.headers.common["X-Client-Version"] = storedVersion;

  try {
    const response = await axios.get("/app/version", {
      headers: storedVersion ? { "X-Client-Version": storedVersion } : {},
    });
    const version = response.data?.version;
    if (!version) return;
    localStorage.setItem("pokedleAppVersion", version);
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
