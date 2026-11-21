const shopCatalog = require("../lib/shopCatalog");

function getPurchaseBalance(user, price) {
  const balance = shopCatalog.getSafePokedollars(user);
  return balance >= price ? balance - price : null;
}

function registerShopPurchaseRoutes(app, dependencies) {
  const {
    shopLimiter,
    firestore,
    verifyShopUserToken,
    getShopBackground,
    getOwnedShopBackgrounds,
    getCollectible,
    getOwnedCollectibles,
    getOwnedCollectiblesField,
    getOwnedBoostInventory,
    getMasterBallBoostProfileUpdates,
    boostItems,
    state,
    createError,
  } = dependencies;

  app.post("/shop/purchase", shopLimiter, async (req, res, next) => {
    const decodedToken = await verifyShopUserToken(req, res);
    if (!decodedToken) return;

    const background = getShopBackground(req.body?.backgroundId);
    if (!background || background.purchasable === false)
      return res.status(400).send({ error: "Unknown background" });

    const discount = state.shopDiscounts[background.id];
    const actualPrice = discount
      ? Math.round(background.price * (1 - discount / 100))
      : background.price;

    try {
      const userRef = firestore.collection("users").doc(decodedToken.uid);
      const result = await firestore.runTransaction(async (transaction) => {
        const doc = await transaction.get(userRef);
        const user = doc.data();
        if (!user) return { error: "User not found", status: 404 };

        const ownedBackgrounds = getOwnedShopBackgrounds(user);
        if (ownedBackgrounds.includes(background.id))
          return { error: "You already own this background", status: 409 };

        const pokedollars = getPurchaseBalance(user, actualPrice);
        if (pokedollars === null)
          return { error: "Not enough Pokédollars", status: 400 };

        ownedBackgrounds.push(background.id);
        transaction.update(userRef, {
          pokedollars,
          ownedBackgrounds,
        });
        return { pokedollars, ownedBackgrounds };
      });

      if (result.error)
        return res.status(result.status).send({ error: result.error });
      res.status(200).send(result);
    } catch (err) {
      console.error(err);
      next(createError(500));
    }
  });

  app.post("/shop/collectibles/purchase", shopLimiter, async (req, res, next) => {
    const decodedToken = await verifyShopUserToken(req, res);
    if (!decodedToken) return;

    const { type, itemId } = req.body || {};
    const item = getCollectible(type, itemId);
    if (!item) return res.status(400).send({ error: "Unknown shop item" });

    const discount = state.shopDiscounts[item.id];
    const actualPrice = discount
      ? Math.round(item.price * (1 - discount / 100))
      : item.price;

    try {
      const userRef = firestore.collection("users").doc(decodedToken.uid);
      const result = await firestore.runTransaction(async (transaction) => {
        const doc = await transaction.get(userRef);
        const user = doc.data();
        if (!user) return { error: "User not found", status: 404 };

        const ownedItems = getOwnedCollectibles(user, type);
        if (ownedItems.includes(item.id))
          return { error: "You already own this item", status: 409 };

        const pokedollars = getPurchaseBalance(user, actualPrice);
        if (pokedollars === null)
          return { error: "Not enough Pokédollars", status: 400 };

        ownedItems.push(item.id);
        transaction.update(userRef, {
          pokedollars,
          [getOwnedCollectiblesField(type)]: ownedItems,
        });
        return { pokedollars, ownedItems };
      });

      if (result.error)
        return res.status(result.status).send({ error: result.error });
      res.status(200).send(result);
    } catch (err) {
      console.error(err);
      next(createError(500));
    }
  });

  app.post("/shop/boost/purchase", shopLimiter, async (req, res, next) => {
    const decodedToken = await verifyShopUserToken(req, res);
    if (!decodedToken) return;

    const { itemId } = req.body || {};
    const boost = boostItems.find((item) => item.id === itemId);
    if (!boost) return res.status(400).send({ error: "Unknown boost item" });

    const discount = state.shopDiscounts[boost.id];
    const actualPrice = discount
      ? Math.round(boost.price * (1 - discount / 100))
      : boost.price;

    try {
      const userRef = firestore.collection("users").doc(decodedToken.uid);
      const result = await firestore.runTransaction(async (transaction) => {
        const doc = await transaction.get(userRef);
        const user = doc.data();
        if (!user) return { error: "User not found", status: 404 };

        const pokedollars = getPurchaseBalance(user, actualPrice);
        if (pokedollars === null)
          return { error: "Not enough Pokédollars", status: 400 };
        const ownedBoosts = getOwnedBoostInventory(user);
        ownedBoosts[boost.id]++;
        transaction.update(userRef, {
          pokedollars,
          ownedBoosts,
          ...getMasterBallBoostProfileUpdates(user.activeMasterBallBoost),
        });
        return {
          pokedollars,
          boostInventory: ownedBoosts,
        };
      });

      if (result.error)
        return res.status(result.status).send({ error: result.error });
      res.status(200).send(result);
    } catch (err) {
      console.error(err);
      next(createError(500));
    }
  });
}

module.exports = registerShopPurchaseRoutes;
