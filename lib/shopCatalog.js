function getShopBackground(shopBackgrounds, backgroundId) {
  return shopBackgrounds.find((background) => background.id === backgroundId);
}

function getCollectible(collectibleCatalog, type, itemId) {
  if (
    typeof type !== "string" ||
    !Object.prototype.hasOwnProperty.call(collectibleCatalog, type) ||
    typeof itemId !== "string"
  )
    return null;
  return collectibleCatalog[type]?.find((item) => item.id === itemId) || null;
}

function getOwnedCollectiblesField(type) {
  return type === "overlay" ? "ownedOverlays" : "ownedCompanions";
}

function getEquippedCollectibleField(type) {
  return type === "overlay" ? "equippedOverlay" : "equippedCompanion";
}

function getOwnedCollectibles(collectibleCatalog, user, type) {
  const field = getOwnedCollectiblesField(type);
  if (!Array.isArray(user[field])) return [];
  return [
    ...new Set(
      user[field].filter((itemId) =>
        getCollectible(collectibleCatalog, type, itemId),
      ),
    ),
  ];
}

function getOwnedShopBackgrounds(shopBackgrounds, user) {
  if (!Array.isArray(user.ownedBackgrounds)) return [];
  return [
    ...new Set(
      user.ownedBackgrounds.filter((backgroundId) =>
        getShopBackground(shopBackgrounds, backgroundId),
      ),
    ),
  ];
}

function getOwnedBoostInventory(boostItems, user) {
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

function getSafePokedollars(user) {
  const pokedollars = user?.pokedollars;
  return Number.isSafeInteger(pokedollars) && pokedollars >= 0
    ? pokedollars
    : 0;
}

module.exports = {
  getCollectible,
  getEquippedCollectibleField,
  getOwnedBoostInventory,
  getOwnedCollectibles,
  getOwnedCollectiblesField,
  getSafePokedollars,
  getOwnedShopBackgrounds,
  getShopBackground,
};
