const {
  createVerifiedShopMutationRunner,
} = require("./shopRouteHelpers");
const {
  getDiscountedPrice,
  prepareBackgroundPurchase,
  prepareBoostPurchase,
  prepareCollectiblePurchase,
  prepareShopSale,
} = require("../lib/shopTransactionHelpers");

function registerShopPurchaseRoutes(app, dependencies) {
  const {
    shopLimiter,
    firestore,
    verifyShopUserToken,
    getShopBackground,
    getOwnedShopBackgrounds,
    getCollectible,
    getBoost,
    getOwnedCollectibles,
    getOwnedBoostInventory,
    getMasterBallBoostProfileUpdates,
    state,
    createError,
  } = dependencies;
  const catalog = {
    getShopBackground,
    getCollectible,
    getBoost,
    getOwnedShopBackgrounds,
    getOwnedCollectibles,
    getOwnedBoostInventory,
  };
  const runMutation = createVerifiedShopMutationRunner({
    verifyShopUserToken,
    firestore,
    createError,
  });

  app.post("/shop/purchase", shopLimiter, async (req, res, next) => {
    const background = getShopBackground(req.body?.backgroundId);
    if (!background || background.purchasable === false)
      return res.status(400).send({ error: "Unknown background" });

    const actualPrice = getDiscountedPrice(background, state.shopDiscounts);

    return runMutation(req, res, next, async (transaction, userRef, user) => {
        const purchase = prepareBackgroundPurchase({
          user,
          catalog,
          background,
          price: actualPrice,
        });
        if (purchase.error) return purchase;
        transaction.update(userRef, purchase.updates);
        return purchase.result;
    });
  });

  app.post("/shop/collectibles/purchase", shopLimiter, async (req, res, next) => {
    const { type, itemId } = req.body || {};
    const item = getCollectible(type, itemId);
    if (!item) return res.status(400).send({ error: "Unknown shop item" });

    const actualPrice = getDiscountedPrice(item, state.shopDiscounts);

    return runMutation(req, res, next, async (transaction, userRef, user) => {
        const purchase = prepareCollectiblePurchase({
          user,
          catalog,
          type,
          item,
          price: actualPrice,
        });
        if (purchase.error) return purchase;
        transaction.update(userRef, purchase.updates);
        return purchase.result;
    });
  });

  app.post("/shop/boost/purchase", shopLimiter, async (req, res, next) => {
    const { itemId } = req.body || {};
    const boost = getBoost(itemId);
    if (!boost) return res.status(400).send({ error: "Unknown boost item" });

    const actualPrice = getDiscountedPrice(boost, state.shopDiscounts);

    return runMutation(req, res, next, async (transaction, userRef, user) => {
        const purchase = prepareBoostPurchase({
          user,
          catalog,
          boost,
          price: actualPrice,
        });
        if (purchase.error) return purchase;
        transaction.update(userRef, {
          ...purchase.updates,
          ...getMasterBallBoostProfileUpdates(user.activeMasterBallBoost),
        });
        return purchase.result;
    });
  });

  app.post("/shop/sell", shopLimiter, async (req, res, next) => {
    const { type, itemId } = req.body || {};
    const item =
      type === "background"
        ? getShopBackground(itemId)
        : type === "boost"
          ? getBoost(itemId)
          : getCollectible(type, itemId);
    if (!item)
      return res.status(400).send({ error: "Unknown shop item" });
    if (!Number.isSafeInteger(item.price) || item.price < 0)
      return res.status(400).send({ error: "Invalid shop item price" });

    return runMutation(req, res, next, async (transaction, userRef, user) => {
        const sale = prepareShopSale({ user, catalog, type, item });
        if (sale.error) return sale;
        transaction.update(userRef, sale.updates);
        return sale.result;
    });
  });
}

module.exports = registerShopPurchaseRoutes;
