const { getSafePokedollars } = require("../lib/shopCatalog");
const getPokemonDisplayName = require("../lib/pokemonNames").getPokemonDisplayName;
const registerShopPurchaseRoutes = require("./shopPurchaseRoutes");
const registerShopEquipmentRoutes = require("./shopEquipmentRoutes");
const { getDiscountedPrice } = require("../lib/shopTransactionHelpers");

function registerShopRoutes(app, dependencies) {
  const {
    bgPathSelector,
    shopBackgrounds,
    overlayItems,
    companionItems,
    boostItems,
    verifyShopUserToken,
    firestoreReadLimiter,
    firestore,
    createError,
    classicGetCurrentDate,
    isUserBoostActive,
    classicGetDaysBetween,
    getOwnedShopBackgrounds,
    getShopBackground,
    getOwnedCollectibles,
    getOwnedBoostInventory,
    getCollectible,
    classicGetStreakBall,
    state,
    shopFields,
  } = dependencies;

  app.get("/shop", (req, res) => {
    const discountedItems = [
      ...shopBackgrounds.map((item) => ({ ...item, type: "background" })),
      ...overlayItems,
      ...companionItems,
      ...boostItems,
    ].map((item, index) => {
      const discount = state.shopDiscounts[item.id];
      const actualPrice = getDiscountedPrice(item, state.shopDiscounts);
      if (discount) {
        return {
          ...item,
          originalPrice: item.price,
          price: actualPrice,
          discountPercent: discount,
          publishedOrder: item.publishedAt ? undefined : index,
        };
      }
      return item.publishedAt
        ? item
        : {
            ...item,
            publishedOrder: index,
          };
    });

    res.render("shop", {
      bg: bgPathSelector(req.device.type),
      shopFields,
      shopItems: discountedItems.map((item) => ({
        ...item,
        displayName: getPokemonDisplayName(item.name),
      })),
    });
  });

  app.get("/shop/state", firestoreReadLimiter, async (req, res, next) => {
    const decodedToken = await verifyShopUserToken(req, res);
    if (!decodedToken) return;

    try {
      const userRef = firestore.collection("users").doc(decodedToken.uid);
      const user = await firestore.runTransaction(async (transaction) => {
        const doc = await transaction.get(userRef);
        const profile = doc.data();
        if (!profile) return null;
        return profile;
      });
      if (!user) return res.status(404).send({ error: "User not found" });

      const currentDate = classicGetCurrentDate();
      const masterBallBoostActive = isUserBoostActive(
        user,
        "boost-master-ball",
        currentDate,
      );
      const doubleEarningsUntilDate = user.doubleEarningsUntilDate || null;
      const remainingDays = doubleEarningsUntilDate
        ? classicGetDaysBetween(currentDate, doubleEarningsUntilDate)
        : null;
      const doubleEarningsActive = remainingDays !== null && remainingDays >= 0;

      res.set("Cache-Control", "no-store");
      res.status(200).send({
        pokedollars: getSafePokedollars(user),
        [shopFields.background.owned]: getOwnedShopBackgrounds(user),
        [shopFields.background.equipped]:
          getShopBackground(user[shopFields.background.equipped])?.id ||
          null,
        [shopFields.overlay.owned]: getOwnedCollectibles(user, "overlay"),
        [shopFields.overlay.equipped]:
          getCollectible(
            "overlay",
            user[shopFields.overlay.equipped],
          )?.id || null,
        [shopFields.companion.owned]:
          getOwnedCollectibles(user, "companion"),
        boostInventory: getOwnedBoostInventory(user),
        [shopFields.companion.equipped]:
          getCollectible(
            "companion",
            user[shopFields.companion.equipped],
          )?.id || null,
        masterBallBoostActive,
        streakMasterBallUpcoming:
          classicGetStreakBall(user, currentDate) === "master-ball",
        doubleEarningsUntilDate,
        doubleEarningsRemainingDays: doubleEarningsActive ? remainingDays + 1 : 0,
      });
    } catch (err) {
      console.error(err);
      next(createError(500));
    }
  });

  registerShopPurchaseRoutes(app, dependencies);
  registerShopEquipmentRoutes(app, dependencies);
}

module.exports = registerShopRoutes;
