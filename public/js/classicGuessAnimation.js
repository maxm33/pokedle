const guessBallScene = document.querySelector(".guess-pokeball-scene");
const guessBallVariants = ["great-ball", "ultra-ball", "master-ball"];

export function setGuessBallVariant(variant) {
  guessBallScene.classList.remove(...guessBallVariants);
  if (guessBallVariants.includes(variant))
    guessBallScene.classList.add(variant);
}

export async function playGuessSequence(hasWon, response) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return Promise.resolve();

  const scene = document.querySelector(".guess-pokeball-scene");
  const bouncer = scene.querySelector(".guess-pokeball-bouncer");
  await waitForBounceCycle(bouncer);

  const shaker = scene.querySelector(".guess-pokeball-shaker");
  const openingLid = scene.querySelector(".guess-pokeball-top");
  const sequenceClass = hasWon ? "is-catching" : "is-releasing";
  const animationName = hasWon
    ? "guess-pokeball-catch-shake"
    : "guess-pokeball-release-shake";
  const correctCount = Object.values(response ?? {}).filter(
    (status) => status === "correct",
  ).length;
  const shakeCount = correctCount >= 4 ? 3 : correctCount >= 2 ? 2 : 1;

  return new Promise((resolve) => {
    const finishOpening = (event) => {
      if (
        event.target !== openingLid ||
        event.animationName !== "guess-pokeball-open-top"
      )
        return;
      openingLid.removeEventListener("animationend", finishOpening);
      scene.classList.remove("is-releasing", "is-opening");
      scene.style.removeProperty("--release-shake-count");
      resolve();
    };
    const finishSequence = (event) => {
      if (event.target !== shaker || event.animationName !== animationName)
        return;
      shaker.removeEventListener("animationend", finishSequence);
      if (hasWon) {
        scene.classList.remove(sequenceClass);
        resolve();
        return;
      }
      openingLid.addEventListener("animationend", finishOpening);
      scene.classList.add("is-opening");
    };
    if (!hasWon) scene.style.setProperty("--release-shake-count", shakeCount);
    shaker.addEventListener("animationend", finishSequence);
    scene.classList.add(sequenceClass);
  });
}

function waitForBounceCycle(bouncer) {
  return new Promise((resolve) => {
    const finishBounce = (event) => {
      if (
        event.target !== bouncer ||
        event.animationName !== "guess-pokeball-bounce"
      )
        return;
      bouncer.removeEventListener("animationiteration", finishBounce);
      resolve();
    };
    bouncer.addEventListener("animationiteration", finishBounce);
  });
}
