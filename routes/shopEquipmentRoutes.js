function registerShopEquipmentRoutes(app, dependencies) {
  const {
    shopLimiter,
    verifyShopUserToken,
    firestore,
    createError,
    getShopBackground,
    getOwnedShopBackgrounds,
    boostItems,
    classicGetCurrentDate,
    isUserBoostActive,
    classicGetStreakBall,
    getOwnedBoostInventory,
    getMasterBallBoostProfileUpdates,
    classicGetDoubleEarningsUntilDate,
    collectibleCatalog,
    getCollectible,
    getOwnedCollectibles,
    getEquippedCollectibleField,
  } = dependencies;

  app.patch("/shop/equipped-background", shopLimiter, async (req, res, next) => {
    const decodedToken = await verifyShopUserToken(req, res);
    if (!decodedToken) return;

    const backgroundId = req.body?.backgroundId;
    if (
      backgroundId !== null &&
      (typeof backgroundId !== "string" || !getShopBackground(backgroundId))
    )
      return res.status(400).send({ error: "Unknown background" });

    try {
      const userRef = firestore.collection("users").doc(decodedToken.uid);
      const result = await firestore.runTransaction(async (transaction) => {
        const doc = await transaction.get(userRef);
        const user = doc.data();
        if (!user) return { error: "User not found", status: 404 };

        if (
          backgroundId !== null &&
          !getOwnedShopBackgrounds(user).includes(backgroundId)
        )
          return { error: "You do not own this background", status: 403 };

        transaction.update(userRef, { equippedBackground: backgroundId });
        return { equippedBackground: backgroundId };
      });

      if (result.error)
        return res.status(result.status).send({ error: result.error });
      res.status(200).send(result);
    } catch (err) {
      console.error(err);
      next(createError(500));
    }
  });

  app.post("/shop/boost/activate", shopLimiter, async (req, res, next) => {
    const decodedToken = await verifyShopUserToken(req, res);
    if (!decodedToken) return;

    const { itemId } = req.body || {};
    const boost = boostItems.find((item) => item.id === itemId);
    if (!boost) return res.status(400).send({ error: "Unknown boost item" });

    try {
      const userRef = firestore.collection("users").doc(decodedToken.uid);
      const result = await firestore.runTransaction(async (transaction) => {
        const doc = await transaction.get(userRef);
        const user = doc.data();
        if (!user) return { error: "User not found", status: 404 };
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

      if (result.error)
        return res.status(result.status).send({ error: result.error });
      res.status(200).send(result);
    } catch (err) {
      console.error(err);
      next(createError(500));
    }
  });

  app.patch(
    "/shop/collectibles/equipped",
    shopLimiter,
    async (req, res, next) => {
      const decodedToken = await verifyShopUserToken(req, res);
      if (!decodedToken) return;

      const { type, itemId } = req.body || {};
      if (
        !Object.prototype.hasOwnProperty.call(collectibleCatalog, type) ||
        (itemId !== null &&
          (typeof itemId !== "string" || !getCollectible(type, itemId)))
      )
        return res.status(400).send({ error: "Unknown shop item" });

      try {
        const userRef = firestore.collection("users").doc(decodedToken.uid);
        const result = await firestore.runTransaction(async (transaction) => {
          const doc = await transaction.get(userRef);
          const user = doc.data();
          if (!user) return { error: "User not found", status: 404 };

          if (
            itemId !== null &&
            !getOwnedCollectibles(user, type).includes(itemId)
          )
            return { error: "You do not own this item", status: 403 };

          transaction.update(userRef, {
            [getEquippedCollectibleField(type)]: itemId,
          });
          return { itemId };
        });

        if (result.error)
          return res.status(result.status).send({ error: result.error });
        res.status(200).send(result);
      } catch (err) {
        console.error(err);
        next(createError(500));
      }
    },
  );

  app.patch("/shop/equipped-loadout", shopLimiter, async (req, res, next) => {
    const decodedToken = await verifyShopUserToken(req, res);
    if (!decodedToken) return;

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

    try {
      const userRef = firestore.collection("users").doc(decodedToken.uid);
      const result = await firestore.runTransaction(async (transaction) => {
        const doc = await transaction.get(userRef);
        const user = doc.data();
        if (!user) return { error: "User not found", status: 404 };

        if (!getOwnedShopBackgrounds(user).includes(backgroundId))
          return { error: "You do not own this background", status: 403 };
        if (!getOwnedCollectibles(user, "overlay").includes(overlayId))
          return { error: "You do not own this overlay", status: 403 };
        if (!getOwnedCollectibles(user, "companion").includes(companionId))
          return { error: "You do not own this companion", status: 403 };

        transaction.update(userRef, {
          equippedBackground: backgroundId,
          equippedOverlay: overlayId,
          equippedCompanion: companionId,
        });
        return { backgroundId, overlayId, companionId };
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

module.exports = registerShopEquipmentRoutes;
