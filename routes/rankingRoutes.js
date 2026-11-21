const getBearerToken = require("../lib/authTokens");

function registerRankingRoutes(app, dependencies) {
  const {
    auth,
    firestore,
    createError,
    ensureMonthlyRankingPeriod,
    getRankingPeriod,
    classicRankingCache,
    sentryRankingCache,
    getCachedRanking,
    getMonthlyRanking,
    bgPathSelector,
    rankingNotificationCollection,
  } = dependencies;

  function redirectToRanking(res, mode) {
    res.redirect(302, `/ranking?mode=${mode}`);
  }

  app.get("/classic/ranking", (_, res) => redirectToRanking(res, "classic"));
  app.get("/sentry/ranking", (_, res) => redirectToRanking(res, "sentry"));

  app.get("/ranking", async (req, res, next) => {
    const mode = req.query.mode === "sentry" ? "sentry" : "classic";
    try {
      await ensureMonthlyRankingPeriod();
      const period = getRankingPeriod();
      const [
        classicAllTimeRankingData,
        sentryAllTimeRankingData,
        classicMonthlyRankingData,
        sentryMonthlyRankingData,
      ] = await Promise.all([
        getCachedRanking(classicRankingCache, "classicWins", (user) => ({
          id: user.id,
          username: user.data().username,
          score: user.data().classicWins || 0,
        })),
        getCachedRanking(sentryRankingCache, "sentryBestScore", (user) => ({
          id: user.id,
          username: user.data().username,
          score: user.data().sentryBestScore || 0,
        })),
        getMonthlyRanking(period, "classic"),
        getMonthlyRanking(period, "sentry"),
      ]);

      res.status(200).render("ranking", {
        activeMode: mode,
        classicAllTimeRankingData,
        sentryAllTimeRankingData,
        classicMonthlyRankingData,
        sentryMonthlyRankingData,
        bg: bgPathSelector(req.device.type),
      });
    } catch (err) {
      console.error(err);
      next(createError(500));
    }
  });

  app.get("/notifications/stream", async (req, res) => {
    const token = getBearerToken(req);
    if (!token) return res.status(401).end();

    let uid;
    try {
      uid = (await auth.verifyIdToken(token)).uid;
    } catch (err) {
      return res.status(401).end();
    }

    res.set({
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    const send = (notification) => {
      if (!res.writableEnded)
        res.write(`data: ${JSON.stringify(notification)}\n\n`);
    };
    const query = firestore
      .collection("users")
      .doc(uid)
      .collection(rankingNotificationCollection)
      .orderBy("createdAt", "desc")
      .limit(20);
    const unsubscribe = query.onSnapshot(
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added")
            send({ id: change.doc.id, ...change.doc.data() });
        });
      },
      (err) => {
        console.error("Ranking notification stream failed:", err);
        res.end();
      },
    );
    const heartbeat = setInterval(() => res.write(": keep-alive\n\n"), 25000);
    res.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}

module.exports = registerRankingRoutes;
