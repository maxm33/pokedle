import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { setGuessBallVariant } from "./classicGuessAnimation.js";
import { triggerElementAnimation } from "./uiAnimations.js";

export function initializeClassicPlayerAccess(auth, userID) {
  const subtitle = document.getElementById("subtitle");
  const inputContainer = document.getElementById("textbar-container");
  const stateContainer = document.getElementById("state-container");

  onAuthStateChanged(auth, async (user) => {
    setGuessBallVariant(null);
    if (user) {
      user
        .getIdToken()
        .then((token) =>
          axios.get("/classic/ball", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        )
        .then((response) =>
          setGuessBallVariant(response?.data?.ball ?? null),
        )
        .catch((error) => {
          console.error(error);
          setGuessBallVariant(null);
        });
    }

    const token = user
      ? await user.getIdToken().catch((error) => {
          console.error(error);
          return null;
        })
      : null;

    axios
      .get(`/classic/canPlay/uid=${userID}&gid=${user ? user.uid : null}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      .then((response) => {
        if (response.data) {
          if (subtitle.style.display === "block") {
            triggerElementAnimation(subtitle, "fadeOut");
            window.setTimeout(() => (subtitle.style.display = "none"), 1150);
          }
          if (inputContainer.style.display === "none") {
            triggerElementAnimation(inputContainer, "fadeIn");
            inputContainer.style.display = "block";
          }
          if (stateContainer.style.display === "none") {
            triggerElementAnimation(stateContainer, "fadeIn");
            stateContainer.style.display = "block";
          }
        } else {
          if (subtitle.style.display === "none") {
            triggerElementAnimation(subtitle, "fadeIn");
            subtitle.style.display = "block";
          }
          if (inputContainer.style.display === "block") {
            triggerElementAnimation(inputContainer, "fadeOut");
            window.setTimeout(
              () => (inputContainer.style.display = "none"),
              1150,
            );
          }
          if (stateContainer.style.display === "block") {
            triggerElementAnimation(stateContainer, "fadeOut");
            window.setTimeout(
              () => (stateContainer.style.display = "none"),
              1150,
            );
          }
        }
      });
  });
}
