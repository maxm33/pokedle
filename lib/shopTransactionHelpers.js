const shopCatalog = require("./shopCatalog");
const {
  addSafePokedollars,
  getOwnedCollectiblesField,
  getEquippedCollectibleField,
} = shopCatalog;

function getPurchaseBalance(user, price) {
  const balance = shopCatalog.getSafePokedollars(user);
  return balance >= price ? balance - price : null;
}

function getShopPurchaseCosts(user) {
  const costs = user.shopPurchaseCosts;
  return costs && typeof costs === "object" && !Array.isArray(costs)
    ? { ...costs }
    : {};
}

function getPurchaseCostKey(type, itemId) {
  return `${type}:${itemId}`;
}

function getStoredPurchaseCost(costs, type, itemId, fallback) {
  const price = costs[getPurchaseCostKey(type, itemId)];
  return Number.isSafeInteger(price) && price >= 0 ? price : fallback;
}

function getDiscountedPrice(item, discounts) {
  const discount = discounts?.[item.id];
  if (!Number.isSafeInteger(discount) || discount < 0 || discount > 100)
    return item.price;
  return Math.round(item.price * (1 - discount / 100));
}

function prepareBackgroundPurchase({ user, catalog, background, price }) {
  const ownedBackgrounds = catalog.getOwnedShopBackgrounds(user);
  if (ownedBackgrounds.includes(background.id))
    return { error: "You already own this background", status: 409 };
  const pokedollars = getPurchaseBalance(user, price);
  if (pokedollars === null)
    return { error: "Not enough Pokédollars", status: 400 };
  ownedBackgrounds.push(background.id);
  const shopPurchaseCosts = getShopPurchaseCosts(user);
  shopPurchaseCosts[getPurchaseCostKey("background", background.id)] = price;
  return {
    updates: { pokedollars, ownedBackgrounds, shopPurchaseCosts },
    result: { pokedollars, ownedBackgrounds },
  };
}

function prepareCollectiblePurchase({ user, catalog, type, item, price }) {
  const ownedItems = catalog.getOwnedCollectibles(user, type);
  if (ownedItems.includes(item.id))
    return { error: "You already own this item", status: 409 };
  const pokedollars = getPurchaseBalance(user, price);
  if (pokedollars === null)
    return { error: "Not enough Pokédollars", status: 400 };
  ownedItems.push(item.id);
  const shopPurchaseCosts = getShopPurchaseCosts(user);
  shopPurchaseCosts[getPurchaseCostKey(type, item.id)] = price;
  return {
    updates: {
      pokedollars,
      [getOwnedCollectiblesField(type)]: ownedItems,
      shopPurchaseCosts,
    },
    result: { pokedollars, ownedItems },
  };
}

function prepareBoostPurchase({ user, catalog, boost, price }) {
  const pokedollars = getPurchaseBalance(user, price);
  if (pokedollars === null)
    return { error: "Not enough Pokédollars", status: 400 };
  const ownedBoosts = catalog.getOwnedBoostInventory(user);
  if (
    !Number.isSafeInteger(ownedBoosts[boost.id]) ||
    ownedBoosts[boost.id] >= Number.MAX_SAFE_INTEGER
  )
    return { error: "Boost inventory limit reached", status: 409 };
  ownedBoosts[boost.id]++;
  const shopPurchaseCosts = getShopPurchaseCosts(user);
  const purchaseCostKey = getPurchaseCostKey("boost", boost.id);
  const purchaseCosts = Array.isArray(shopPurchaseCosts[purchaseCostKey])
    ? shopPurchaseCosts[purchaseCostKey].filter(
        (cost) => Number.isSafeInteger(cost) && cost >= 0,
      )
    : [];
  purchaseCosts.push(price);
  shopPurchaseCosts[purchaseCostKey] = purchaseCosts;
  return {
    updates: { pokedollars, ownedBoosts, shopPurchaseCosts },
    result: { pokedollars, boostInventory: ownedBoosts },
  };
}

function prepareShopSale({ user, catalog, type, item }) {
  const shopPurchaseCosts = getShopPurchaseCosts(user);
  let refundAmount;
  let updates;
  if (type === "background") {
    const ownedBackgrounds = catalog.getOwnedShopBackgrounds(user);
    if (!ownedBackgrounds.includes(item.id))
      return { error: "You do not own this background", status: 409 };
    refundAmount = getStoredPurchaseCost(
      shopPurchaseCosts,
      type,
      item.id,
      item.price,
    );
    delete shopPurchaseCosts[getPurchaseCostKey(type, item.id)];
    updates = {
      ownedBackgrounds: ownedBackgrounds.filter(
        (backgroundId) => backgroundId !== item.id,
      ),
    };
    if (user.equippedBackground === item.id)
      updates.equippedBackground = null;
  } else if (type === "boost") {
    const ownedBoosts = catalog.getOwnedBoostInventory(user);
    if (ownedBoosts[item.id] < 1)
      return { error: "You do not own this boost", status: 409 };
    ownedBoosts[item.id]--;
    const purchaseCostKey = getPurchaseCostKey(type, item.id);
    const purchaseCosts = Array.isArray(shopPurchaseCosts[purchaseCostKey])
      ? shopPurchaseCosts[purchaseCostKey].filter(
          (cost) => Number.isSafeInteger(cost) && cost >= 0,
        )
      : [];
    refundAmount = purchaseCosts.pop() ?? item.price;
    if (purchaseCosts.length) {
      shopPurchaseCosts[purchaseCostKey] = purchaseCosts;
    } else {
      delete shopPurchaseCosts[purchaseCostKey];
    }
    updates = { ownedBoosts };
  } else {
    const ownedItems = catalog.getOwnedCollectibles(user, type);
    if (!ownedItems.includes(item.id))
      return { error: "You do not own this item", status: 409 };
    refundAmount = getStoredPurchaseCost(
      shopPurchaseCosts,
      type,
      item.id,
      item.price,
    );
    delete shopPurchaseCosts[getPurchaseCostKey(type, item.id)];
    const field = getOwnedCollectiblesField(type);
    updates = {
      [field]: ownedItems.filter((ownedItemId) => ownedItemId !== item.id),
    };
    const equippedField = getEquippedCollectibleField(type);
    if (user[equippedField] === item.id)
      updates[equippedField] = null;
  }

  const pokedollars = addSafePokedollars(user, refundAmount);
  if (pokedollars === null)
    return { error: "Pokédollar balance limit reached", status: 409 };
  return {
    updates: { ...updates, pokedollars, shopPurchaseCosts },
    result: { pokedollars, refundAmount },
  };
}

function prepareBackgroundEquip({ user, catalog, backgroundId }) {
  if (
    backgroundId !== null &&
    !catalog.getOwnedShopBackgrounds(user).includes(backgroundId)
  )
    return { error: "You do not own this background", status: 403 };
  return {
    updates: { equippedBackground: backgroundId },
    result: { equippedBackground: backgroundId },
  };
}

function prepareCollectibleEquip({ user, catalog, type, itemId }) {
  if (
    itemId !== null &&
    !catalog.getOwnedCollectibles(user, type).includes(itemId)
  )
    return { error: "You do not own this item", status: 403 };
  return {
    updates: { [getEquippedCollectibleField(type)]: itemId },
    result: { itemId },
  };
}

function prepareLoadoutEquip({
  user,
  catalog,
  backgroundId,
  overlayId,
  companionId,
}) {
  if (!catalog.getOwnedShopBackgrounds(user).includes(backgroundId))
    return { error: "You do not own this background", status: 403 };
  if (!catalog.getOwnedCollectibles(user, "overlay").includes(overlayId))
    return { error: "You do not own this item", status: 403 };
  if (!catalog.getOwnedCollectibles(user, "companion").includes(companionId))
    return { error: "You do not own this item", status: 403 };
  return {
    updates: {
      equippedBackground: backgroundId,
      equippedOverlay: overlayId,
      equippedCompanion: companionId,
    },
    result: { backgroundId, overlayId, companionId },
  };
}

module.exports = {
  getDiscountedPrice,
  prepareBackgroundPurchase,
  prepareBoostPurchase,
  prepareCollectiblePurchase,
  prepareShopSale,
  prepareBackgroundEquip,
  prepareCollectibleEquip,
  prepareLoadoutEquip,
};
