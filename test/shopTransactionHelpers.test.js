const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getDiscountedPrice,
  prepareBackgroundPurchase,
  prepareShopSale,
} = require("../lib/shopTransactionHelpers");

const catalog = {
  getOwnedShopBackgrounds: (user) => user.ownedBackgrounds || [],
  getOwnedCollectibles: () => [],
  getOwnedBoostInventory: (user) => ({ ...user.ownedBoosts }),
};

test("discounted prices are rounded and bounded", () => {
  assert.equal(getDiscountedPrice({ id: "x", price: 100 }, { x: 25 }), 75);
  assert.equal(getDiscountedPrice({ id: "x", price: 100 }, { x: 101 }), 100);
});

test("background purchase rejects ownership and insufficient balance", () => {
  const background = { id: "bg", price: 100 };
  assert.equal(
    prepareBackgroundPurchase({
      user: { pokedollars: 50, ownedBackgrounds: [] },
      catalog,
      background,
      price: 100,
    }).error,
    "Not enough Pokédollars",
  );
  assert.equal(
    prepareBackgroundPurchase({
      user: { pokedollars: 500, ownedBackgrounds: ["bg"] },
      catalog,
      background,
      price: 100,
    }).error,
    "You already own this background",
  );
});

test("background sale clears equipped background", () => {
  const result = prepareShopSale({
    user: {
      pokedollars: 100,
      ownedBackgrounds: ["bg"],
      equippedBackground: "bg",
      shopPurchaseCosts: { "background:bg": 80 },
    },
    catalog,
    type: "background",
    item: { id: "bg", price: 100 },
  });
  assert.equal(result.result.refundAmount, 80);
  assert.equal(result.updates.equippedBackground, null);
  assert.deepEqual(result.updates.ownedBackgrounds, []);
});
