const shopFields = require("../data/shopFields.json");

function getOwnedCollectiblesField(type) {
  return shopFields[type]?.owned || null;
}

function getEquippedCollectibleField(type) {
  return shopFields[type]?.equipped || null;
}

function getSafePokedollars(user) {
  const pokedollars = user?.pokedollars;
  return Number.isSafeInteger(pokedollars) && pokedollars >= 0
    ? pokedollars
    : 0;
}

function addSafePokedollars(user, amount) {
  if (!Number.isSafeInteger(amount) || amount < 0) return null;
  const pokedollars = getSafePokedollars(user);
  if (pokedollars > Number.MAX_SAFE_INTEGER - amount) return null;
  return pokedollars + amount;
}

function createShopCatalogService({
  shopBackgrounds,
  collectibleCatalog,
  boostItems,
}) {
  const backgroundIds = new Set(
    shopBackgrounds.map((background) => background.id),
  );
  const backgroundById = new Map(
    shopBackgrounds.map((background) => [background.id, background]),
  );
  const collectiblesByType = new Map(
    Object.entries(collectibleCatalog).map(([type, items]) => [
      type,
      new Map(items.map((item) => [item.id, item])),
    ]),
  );
  const collectibleIdsByType = new Map(
    [...collectiblesByType].map(([type, items]) => [
      type,
      new Set(items.keys()),
    ]),
  );
  const boostsById = new Map(
    boostItems.map((boost) => [boost.id, boost]),
  );
  function getOwnedBoostInventory(user) {
    const storedBoosts =
      user.ownedBoosts &&
      typeof user.ownedBoosts === "object" &&
      !Array.isArray(user.ownedBoosts)
        ? user.ownedBoosts
        : {};
    const inventory = { ...storedBoosts };
    boostItems.forEach((boost) => {
      const quantity = inventory[boost.id];
      inventory[boost.id] =
        Number.isSafeInteger(quantity) && quantity >= 0 ? quantity : 0;
    });
    return inventory;
  }

  return {
    getShopBackground: (backgroundId) =>
      typeof backgroundId === "string"
        ? backgroundById.get(backgroundId) || null
        : null,
    getCollectible: (type, itemId) =>
      typeof itemId === "string"
        ? collectiblesByType.get(type)?.get(itemId) || null
        : null,
    getOwnedCollectibles: (user, type) => {
      const field = getOwnedCollectiblesField(type);
      if (!Array.isArray(user[field])) return [];
      const validIds = collectibleIdsByType.get(type);
      if (!validIds) return [];
      return [...new Set(user[field].filter((itemId) => validIds.has(itemId)))];
    },
    getOwnedShopBackgrounds: (user) => {
      if (!Array.isArray(user.ownedBackgrounds)) return [];
      return [
        ...new Set(
          user.ownedBackgrounds.filter((backgroundId) =>
            backgroundIds.has(backgroundId),
          ),
        ),
      ];
    },
    getOwnedBoostInventory: (user) =>
      getOwnedBoostInventory(user),
    getBoost: (boostId) =>
      typeof boostId === "string" ? boostsById.get(boostId) || null : null,
  };
}

module.exports = {
  createShopCatalogService,
  getEquippedCollectibleField,
  getOwnedCollectiblesField,
  getSafePokedollars,
  addSafePokedollars,
};
