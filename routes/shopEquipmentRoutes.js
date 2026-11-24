const {
  createVerifiedShopMutationRunner,
} = require("./shopRouteHelpers");
const {
  prepareBackgroundEquip,
  prepareCollectibleEquip,
  prepareLoadoutEquip,
} = require("../lib/shopTransactionHelpers");

function registerShopEquipmentRoutes(app, dependencies) {
  const {
    shopLimiter,
    verifyShopUserToken,
    firestore,
    createError,
    getShopBackground,
    getOwnedShopBackgrounds,
    getBoost,
    classicGetCurrentDate,
    isUserBoostActive,
    classicGetStreakBall,
    getOwnedBoostInventory,
    getMasterBallBoostProfileUpdates,
    classicGetDoubleEarningsUntilDate,
    collectibleCatalog,
    getCollectible,
    getOwnedCollectibles,
  } = dependencies;
  const catalog = {
    getOwnedShopBackgrounds,
    getOwnedCollectibles,
  };
  const runMutation = createVerifiedShopMutationRunner({
    verifyShopUserToken,
    firestore,
    createError,
  });

  app.patch("/shop/equipped-background", shopLimiter, async (req, res, next) => {
    const backgroundId = req.body?.backgroundId;
    if (
      backgroundId !== null &&
      (typeof backgroundId !== "string" || !getShopBackground(backgroundId))
    )
      return res.status(400).send({ error: "Unknown background" });

    return runMutation(req, res, next, async (transaction, userRef, user) => {
        const equipment = prepareBackgroundEquip({
          user,
          catalog,
          backgroundId,
        });
        if (equipment.error) return equipment;
        transaction.update(userRef, equipment.updates);
        return equipment.result;
    });
  });

  app.post("/shop/boost/activate", shopLimiter, async (req, res, next) => {
    const { itemId } = req.body || {};
    const boost = getBoost(itemId);
    if (!boost) return res.status(400).send({ error: "Unknown boost item" });

    return runMutation(req, res, next, async (transaction, userRef, user) => {
        const currentDate = classicGetCurrentDate();
        if (isUserBoostActive(user, itemId, currentDate)) {
          return { error: "This boost is already active", status: 409 };
        }
        if (
          itemId === "boost-master-ball" &&
          classicGetStreakBall(user, currentDate) === "master-ball"
        ) {
          return {
            error: "A Master Ball is already available from your streak",
            status: 409,
          };
        }

        const ownedBoosts = getOwnedBoostInventory(user);
        if (ownedBoosts[itemId] < 1) {
          return {
            error: "You do not have this boost in your inventory",
            status: 409,
          };
        }
        ownedBoosts[itemId]--;
        const updates = {
          ownedBoosts,
          ...getMasterBallBoostProfileUpdates(
            itemId === "boost-master-ball" || user.activeMasterBallBoost,
          ),
        };

        if (itemId !== "boost-master-ball") {
          updates.doubleEarningsUntilDate =
            classicGetDoubleEarningsUntilDate(currentDate);
        }

        transaction.update(userRef, updates);
        return { boostInventory: ownedBoosts, active: itemId };
    });
  });

  app.patch(
    "/shop/collectibles/equipped",
    shopLimiter,
    async (req, res, next) => {
      const { type, itemId } = req.body || {};
      if (
        !Object.prototype.hasOwnProperty.call(collectibleCatalog, type) ||
        (itemId !== null &&
          (typeof itemId !== "string" || !getCollectible(type, itemId)))
      )
        return res.status(400).send({ error: "Unknown shop item" });

      return runMutation(req, res, next, async (transaction, userRef, user) => {
          const equipment = prepareCollectibleEquip({
            user,
            catalog,
            type,
            itemId,
          });
          if (equipment.error) return equipment;
          transaction.update(userRef, equipment.updates);
          return equipment.result;
      });
    },
  );

  app.patch("/shop/equipped-loadout", shopLimiter, async (req, res, next) => {
    const { backgroundId, overlayId, companionId } = req.body || {};
    if (
      typeof backgroundId !== "string" ||
      !getShopBackground(backgroundId) ||
      typeof overlayId !== "string" ||
      !getCollectible("overlay", overlayId) ||
      typeof companionId !== "string" ||
      !getCollectible("companion", companionId)
    )
      return res.status(400).send({ error: "Invalid profile configuration" });

    return runMutation(req, res, next, async (transaction, userRef, user) => {
        const equipment = prepareLoadoutEquip({
          user,
          catalog,
          backgroundId,
          overlayId,
          companionId,
        });
        if (equipment.error) return equipment;
        transaction.update(userRef, equipment.updates);
        return equipment.result;
    });
  });
}

module.exports = registerShopEquipmentRoutes;
