import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth } from "./auth.js";
import {
  getProfilePresetSlotCount,
  getProfilePresetStorageKey,
  readProfilePresets,
  writeProfilePresets,
} from "./profilePresetStorage.js";

const sidebar = document.getElementById("profile-presets");
const profileId = sidebar.dataset.profileId;
const toggle = document.getElementById("profile-presets-toggle");
const presetButtons = [...sidebar.querySelectorAll(".profile-preset-button")];
const deleteButtons = [...sidebar.querySelectorAll(".profile-preset-delete")];
const storageKey = getProfilePresetStorageKey(profileId);
const slotCount = getProfilePresetSlotCount();

let currentUser = null;
let presets = Array(slotCount).fill(null);
let operationPending = false;

function readPresets() {
  const storedPresets = readProfilePresets(profileId);
  return storedPresets === null
    ? Array(slotCount).fill(null)
    : storedPresets;
}

function getCompanionImageUrl(companionId) {
  const fileName = companionId.slice("companion-".length);
  if (!fileName || /[\\/]/.test(fileName))
    throw new Error("Invalid saved companion.");
  return `/public/images/animations/${encodeURIComponent(`${fileName}.gif`)}`;
}

function writePresets() {
  return writeProfilePresets(profileId, presets);
}

function renderPresets() {
  presetButtons.forEach((button, index) => {
    const preset = presets[index];
    const hasPreset = preset !== null;
    const companionIcon = button.querySelector(".profile-preset-companion");
    button.querySelector(".profile-preset-add").hidden = hasPreset;
    companionIcon.hidden = !hasPreset;
    if (hasPreset)
      companionIcon.src = getCompanionImageUrl(preset.companionId);
    else companionIcon.removeAttribute("src");
    button.setAttribute(
      "aria-label",
      `${hasPreset ? "Apply saved" : "Save current"} configuration in slot ${index + 1}`,
    );
    button.disabled = operationPending || !currentUser;
    deleteButtons[index].hidden = !hasPreset;
    deleteButtons[index].disabled = operationPending || !currentUser;
  });
  toggle.disabled = operationPending;
}

async function loadShopState(user) {
  try {
    const token = await user.getIdToken();
    const response = await axios.get("/shop/state", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (currentUser?.uid !== user.uid) return null;
    return response.data;
  } catch (error) {
    console.error("Could not load equipped profile items:", error);
    return null;
  }
}

async function handlePresetClick(index) {
  const user = currentUser;
  if (!user || operationPending) return;

  operationPending = true;
  renderPresets();

  try {
    const preset = presets[index];
    if (preset) {
      const token = await user.getIdToken();
      await axios.patch("/shop/equipped-loadout", preset, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (currentUser?.uid === user.uid) window.location.reload();
      return;
    }

    const shopState = await loadShopState(user);
    if (currentUser?.uid !== user.uid) return;
    if (!shopState) {
      return;
    }

    const configuration = {
      backgroundId: shopState.equippedBackground,
      overlayId: shopState.equippedOverlay,
      companionId: shopState.equippedCompanion,
    };
    if (
      !configuration.backgroundId ||
      !configuration.overlayId ||
      !configuration.companionId
    ) {
      console.warn(
        "Equip a background, overlay, and companion before saving a profile configuration.",
      );
      return;
    }

    presets[index] = configuration;
    if (!writePresets()) {
      presets[index] = null;
      return;
    }
    renderPresets();
  } catch (error) {
    console.error("Could not apply profile configuration:", error);
  } finally {
    operationPending = false;
    renderPresets();
  }
}

function deletePreset(index) {
  if (!currentUser || operationPending || presets[index] === null) return;

  const deletedPreset = presets[index];
  presets[index] = null;
  if (!writePresets()) {
    presets[index] = deletedPreset;
    return;
  }
  renderPresets();
}

toggle.addEventListener("click", () => {
  const isCollapsed = sidebar.classList.toggle("is-collapsed");
  toggle.setAttribute("aria-expanded", String(!isCollapsed));
  const label = isCollapsed
    ? "Expand saved configurations"
    : "Collapse saved configurations";
  toggle.setAttribute("aria-label", label);
  toggle.title = label;
});

presetButtons.forEach((button, index) => {
  button.addEventListener("click", () => handlePresetClick(index));
});

deleteButtons.forEach((button, index) => {
  button.addEventListener("click", () => deletePreset(index));
});

window.addEventListener("storage", (event) => {
  if (event.key !== storageKey || !currentUser) return;

  try {
    presets = readPresets();
  } catch (error) {
    console.error("Could not read profile configurations:", error);
    presets = Array(slotCount).fill(null);
  }
  renderPresets();
});

onAuthStateChanged(
  auth,
  (user) => {
    currentUser =
      user && user.uid === profileId
        ? user
        : null;
    sidebar.hidden = !currentUser;
    if (!currentUser) {
      presets = Array(slotCount).fill(null);
      renderPresets();
      return;
    }

    try {
      presets = readPresets();
    } catch (error) {
      console.error("Could not read profile configurations:", error);
      presets = Array(slotCount).fill(null);
    }
    renderPresets();
  },
  (error) => {
    console.error("Could not verify profile configuration access:", error);
    sidebar.hidden = true;
  },
);
