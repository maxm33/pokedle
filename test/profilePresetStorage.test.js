const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

async function loadProfilePresetStorage() {
  const filePath = path.join(
    process.cwd(),
    "public",
    "js",
    "profilePresetStorage.js",
  );
  let source = fs.readFileSync(filePath, "utf8");
  source = source.replace(
    /^import[^\r\n]*(?:\r?\n){2}/u,
    'const getStorageKey = (profileId) => `pokedleProfilePresets:${profileId}`;\n\n',
  );
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  return import(moduleUrl);
}

function createLocalStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

function validPresets() {
  return Array.from({ length: 5 }, (_, index) =>
    index === 0
      ? {
          backgroundId: "background-day",
          overlayId: "overlay-frame",
          companionId: "companion-pikachu",
        }
      : null,
  );
}

test("profile preset storage: cross-tab storage updates are visible", async () => {
  const values = new Map();
  const localStorage = {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
  global.window = { localStorage };
  const storage = await loadProfilePresetStorage();
  assert.equal(storage.writeProfilePresets("user-1", validPresets()), true);

  global.window = {
    localStorage: {
      getItem(key) {
        return values.has(key) ? values.get(key) : null;
      },
      setItem() {},
    },
  };
  assert.deepEqual(storage.readProfilePresets("user-1"), validPresets());
});

test("profile preset storage: valid presets round-trip", async () => {
  global.window = { localStorage: createLocalStorage() };
  const storage = await loadProfilePresetStorage();
  assert.equal(storage.writeProfilePresets("user-1", validPresets()), true);
  assert.deepEqual(
    storage.readProfilePresets("user-1"),
    validPresets(),
  );
});

test("profile preset storage: malformed JSON resets safely", async () => {
  global.window = {
    localStorage: createLocalStorage({
      "pokedleProfilePresets:user-1": "{bad json",
    }),
  };
  const storage = await loadProfilePresetStorage();
  assert.equal(storage.readProfilePresets("user-1"), null);
});

test("profile preset storage: invalid or quota-blocked writes fail safely", async () => {
  global.window = {
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {
        throw new Error("quota exceeded");
      },
    },
  };
  const storage = await loadProfilePresetStorage();
  assert.equal(storage.writeProfilePresets("user-1", validPresets()), false);
  assert.equal(
    storage.writeProfilePresets("user-1", [{ backgroundId: "invalid" }]),
    false,
  );
});

test("profile preset storage: removes sold companion and preserves other slots", async () => {
  global.window = { localStorage: createLocalStorage() };
  const storage = await loadProfilePresetStorage();
  const presets = validPresets();
  presets[1] = {
    backgroundId: "background-night",
    overlayId: "overlay-frame",
    companionId: "companion-pikachu",
  };
  assert.equal(storage.writeProfilePresets("user-1", presets), true);
  assert.equal(
    storage.removeSavedProfilePresetsForItem(
      "user-1",
      "companion",
      "companion-pikachu",
    ),
    true,
  );
  const updated = storage.readProfilePresets("user-1");
  assert.equal(updated[0], null);
  assert.equal(updated[1], null);
  assert.equal(updated[2], null);
});
