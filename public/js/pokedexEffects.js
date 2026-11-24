const dexLights = [...document.querySelectorAll(".dex-light")];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const lightTimers = new Map();

function stopLightBlinking() {
  for (const timer of lightTimers.values()) window.clearTimeout(timer);
  lightTimers.clear();
  for (const light of dexLights)
    light.classList.remove("dex-light-glowing");
}

function scheduleLightBlink(light, delay) {
  const timer = window.setTimeout(() => {
    light.classList.toggle("dex-light-glowing");
    scheduleLightBlink(light, 1100 + Math.random() * 1600);
  }, delay);
  lightTimers.set(light, timer);
}

function updateLightBlinking() {
  stopLightBlinking();
  if (reducedMotion.matches) return;
  for (const light of dexLights)
    scheduleLightBlink(light, Math.random() * 1400);
}

reducedMotion.addEventListener("change", updateLightBlinking);
updateLightBlinking();
