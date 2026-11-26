import { getProfilePresetStorageKey as getStorageKey } from "./storageKeys.js";

const presetFieldByItemType = {
  background: "backgroundId",
  overlay: "overlayId",
  companion: "companionId",
};

export function getProfilePresetStorageKey(profileId) {
  return getStorageKey(profileId);
}

export function getProfilePresetSlotCount() {
  return 5;
}

export function normalizeProfilePresets(storedPresets) {
  const slotCount = getProfilePresetSlotCount();
  if (!Array.isArray(storedPresets) || storedPresets.length !== slotCount)
    throw new Error("Invalid saved profile configurations.");

  return storedPresets.map((preset) => {
    if (preset === null) return null;
    if (
      !preset ||
      typeof preset !== "object" ||
      Array.isArray(preset) ||
      typeof preset.backgroundId !== "string" ||
      !preset.backgroundId ||
      typeof preset.overlayId !== "string" ||
      !preset.overlayId ||
      typeof preset.companionId !== "string" ||
      !preset.companionId.startsWith("companion-") ||
      /[\\/]/.test(preset.companionId)
    )
      throw new Error("Invalid saved profile configuration.");

    return {
      backgroundId: preset.backgroundId,
      overlayId: preset.overlayId,
      companionId: preset.companionId,
    };
  });
}

export function readProfilePresets(profileId) {
  const key = getProfilePresetStorageKey(profileId);
  try {
    const storedPresets = window.localStorage.getItem(key);
    if (storedPresets === null) return null;
    return normalizeProfilePresets(JSON.parse(storedPresets));
  } catch (error) {
    console.error("Could not read profile configurations:", error);
    return null;
  }
}

export function writeProfilePresets(profileId, presets) {
  const key = getProfilePresetStorageKey(profileId);
  try {
    const normalizedPresets = normalizeProfilePresets(presets);
    window.localStorage.setItem(key, JSON.stringify(normalizedPresets));
    return true;
  } catch (error) {
    console.error("Could not save profile configurations:", error);
    return false;
  }
}

export function removeSavedProfilePresetsForItem(profileId, type, itemId) {
  if (!Object.prototype.hasOwnProperty.call(presetFieldByItemType, type))
    return false;
  const presetField = presetFieldByItemType[type];

  const presets = readProfilePresets(profileId);
  if (presets === null) return false;

  let removed = false;
  const updatedPresets = presets.map((preset) => {
    if (
      preset &&
      typeof preset === "object" &&
      !Array.isArray(preset) &&
      preset[presetField] === itemId
    ) {
      removed = true;
      return null;
    }
    return preset;
  });

  if (removed) {
    if (!writeProfilePresets(profileId, updatedPresets)) return false;
  }
  return removed;
}
