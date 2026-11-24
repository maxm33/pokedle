const { getBearerToken, verifyAuthToken } = require("../lib/authTokens");

function registerUserRoutes(app, dependencies) {
  const {
    randomUUID,
    auth,
    authLimiter,
    firestore,
    createError,
    firestoreReadLimiter,
    getShopBackground,
    getCollectible,
    profileBgPathSelector,
    bgPathSelector,
  } = dependencies;

  // generate new unique id (uuid) on request
  app.get("/user/id", (_, res) => {
    res.status(201);
    res.send(randomUUID());
  });

  app.put("/user/:gid", authLimiter, async (req, res, next) => {
    let authenticatedUid;
    try {
      authenticatedUid = await verifyAuthToken(auth, req.body.token);
    } catch (err) {
      console.error(err);
      return res.status(401).end();
    }

    if (authenticatedUid != req.params.gid) return res.status(401).end();

    const userRef = firestore.collection("users").doc(authenticatedUid);
    try {
      const doc = await userRef.get();
      if (doc.data() == undefined) {
        await userRef.set({
          username: `user-${randomUUID().replaceAll("-", "").slice(0, 11)}`,
          classicWins: 0,
          classicAvgTries: 0,
          classicWinStreak: 0,
          classicLastWinDate: null,
          classicHistory: [],
          pokedollars: 0,
          ownedBoosts: {
            "boost-master-ball": 0,
            "boost-double-earnings": 0,
          },
          activeMasterBallBoost: false,
          ownedBackgrounds: [],
          equippedBackground: null,
          ownedOverlays: [],
          equippedOverlay: null,
          ownedCompanions: [],
          equippedCompanion: null,
          sentryBestScore: 0,
          sentrySessionsCompleted: 0,
          sentryFailures: 0,
          sentryBestSession: 0,
        });
        return res.status(201).end();
      }
      return res.status(204).end();
    } catch (err) {
      console.error(err);
      next(createError(500));
    }
  });

  app.patch("/user/:gid/username", authLimiter, async (req, res, next) => {
    const token = getBearerToken(req);
    if (!token) return res.status(401).send({ error: "Authentication required" });

    let authenticatedUid;
    try {
      authenticatedUid = await verifyAuthToken(auth, token);
    } catch (err) {
      return res.status(401).send({ error: "Invalid authentication token" });
    }

    if (authenticatedUid !== req.params.gid)
      return res
        .status(403)
        .send({ error: "Cannot update another user's username" });

    const username =
      typeof req.body.username === "string" ? req.body.username.trim() : "";
    if (username.length < 1 || username.length > 16)
      return res
        .status(400)
        .send({ error: "Username must be between 1 and 16 characters" });

    try {
      const userRef = firestore.collection("users").doc(authenticatedUid);
      await userRef.update({ username });
      return res.status(204).end();
    } catch (err) {
      if (err.code === 5 || err.code === "not-found")
        return res.status(404).send({ error: "User not found" });
      console.error(err);
      next(createError(500));
    }
  });

  // render requested user's profile page
  app.get("/user/:gid/profile", firestoreReadLimiter, async (req, res, next) => {
    try {
      const doc = await firestore
        .collection("users")
        .doc(req.params.gid)
        .get();
      const user = doc.data();
      if (user == undefined)
        return next(createError(404, "User does not exist"));

      const sessions = user.sentrySessionsCompleted || 0;
      const failures = user.sentryFailures || 0;
      const accuracy =
        sessions > 0
          ? Math.round(((sessions - failures) / sessions) * 1000) / 10
          : 0;
      const hasCustomBackground = Boolean(
        getShopBackground(user.equippedBackground),
      );
      return res.status(200).render("profile", {
        profileId: req.params.gid,
        username: user.username || "???",
        classicWins: Number(user.classicWins) || 0,
        classicAvgTries: Number(user.classicAvgTries)
          ? Math.round(user.classicAvgTries * 100) / 100
          : 0,
        sentryBestScore: user.sentryBestScore || 0,
        sentrySessionsCompleted: sessions,
        sentryAccuracy: accuracy,
        sentryBestSession: user.sentryBestSession || 0,
        hasCustomBackground,
        bg: profileBgPathSelector(user.equippedBackground, req.device.type),
        defaultBg: bgPathSelector(req.device.type),
        overlay:
          getCollectible("overlay", user.equippedOverlay)?.imageUrl || null,
        companion:
          getCollectible("companion", user.equippedCompanion)?.imageUrl || null,
      });
    } catch (err) {
      console.error(err);
      next(createError(500));
    }
  });
}

module.exports = registerUserRoutes;
