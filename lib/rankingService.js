const { getSafePokedollars } = require("./shopCatalog");

function createRankingService({
  firestore,
  rankingCache,
  rankingNotificationCollection,
  classicGetDateTimeParts,
  classicGetCurrentDate,
  getOwnedBoostInventory,
  getMasterBallBoostProfileUpdates,
  randomUUID,
}) {
  const rankingCacheTtlMs = 60 * 60 * 1000;
  const monthlyRankingRewards = {
    1: { pokedollars: 20000, doubleEarningsBoosts: 2, masterBallBoosts: 2 },
    2: { pokedollars: 12500, doubleEarningsBoosts: 1, masterBallBoosts: 2 },
    3: { pokedollars: 8000, doubleEarningsBoosts: 1, masterBallBoosts: 1 },
    4: { pokedollars: 5000, doubleEarningsBoosts: 0, masterBallBoosts: 1 },
    5: { pokedollars: 2500, doubleEarningsBoosts: 0, masterBallBoosts: 1 },
  };

  function getRankingPeriod(date = new Date()) {
    const { year, month } = classicGetDateTimeParts(date);
    return `${year}-${String(month).padStart(2, "0")}`;
  }

  function getMonthlyRankingCollection(period, mode) {
    return firestore.collection("monthlyRankings").doc(period).collection(mode);
  }

  function getCachedRanking(cache, orderField, mapUser) {
    return rankingCache.getCachedRanking(
      firestore,
      cache,
      orderField,
      mapUser,
      rankingCacheTtlMs,
    );
  }

  function invalidateRankingCache(cache) {
    rankingCache.invalidateRankingCache(cache);
  }

  async function ensureMonthlyRankingPeriod() {
    const period = getRankingPeriod();
    const periodRef = firestore.collection("rankingPeriods").doc("current");

    await firestore.runTransaction(async (transaction) => {
      const periodDoc = await transaction.get(periodRef);
      const previousPeriod = periodDoc.data()?.period;
      if (previousPeriod === period) return;

      if (previousPeriod) {
        const previousRankings = await Promise.all(
          ["classic", "sentry"].map((mode) =>
            transaction.get(
              getMonthlyRankingCollection(previousPeriod, mode)
                .orderBy("score", "desc")
                .limit(5),
            ),
          ),
        );
        const awards = previousRankings.flatMap((ranking, modeIndex) =>
          ranking.docs.map((player, index) => ({
            userId: player.id,
            mode: modeIndex === 0 ? "classic" : "sentry",
            place: index + 1,
          })),
        );
        const profileRefs = new Map(
          awards.map((award) => [
            award.userId,
            firestore.collection("users").doc(award.userId),
          ]),
        );
        const profiles = await Promise.all(
          [...profileRefs.values()].map((profileRef) =>
            transaction.get(profileRef),
          ),
        );
        const profilesById = new Map(
          profiles.map((profile) => [profile.id, profile]),
        );
        const rewardsByUser = new Map();

        awards.forEach((award) => {
          const profile = profilesById.get(award.userId);
          if (!profile?.exists) return;

          const reward = monthlyRankingRewards[award.place];
          let total = rewardsByUser.get(award.userId);
          if (!total) {
            total = {
              profile,
              pokedollars: 0,
              doubleEarningsBoosts: 0,
              masterBallBoosts: 0,
            };
            rewardsByUser.set(award.userId, total);
          }
          total.pokedollars += reward.pokedollars;
          total.doubleEarningsBoosts += reward.doubleEarningsBoosts;
          total.masterBallBoosts += reward.masterBallBoosts;
        });

        const awardedNotifications = awards.filter(
          (award) => profilesById.get(award.userId)?.exists,
        );
        for (const reward of rewardsByUser.values()) {
          const user = reward.profile.data();
          const ownedBoosts = getOwnedBoostInventory(user);
          ownedBoosts["boost-master-ball"] += reward.masterBallBoosts;
          ownedBoosts["boost-double-earnings"] += reward.doubleEarningsBoosts;
          transaction.update(reward.profile.ref, {
            pokedollars: getSafePokedollars(user) + reward.pokedollars,
            ownedBoosts,
            ...getMasterBallBoostProfileUpdates(user.activeMasterBallBoost),
          });
        }

        awardedNotifications.forEach((award) => {
          const reward = monthlyRankingRewards[award.place];
          const boostRewards = [];
          if (reward.doubleEarningsBoosts > 0)
            boostRewards.push("a 2x earnings boost (7 days)");
          if (reward.masterBallBoosts > 0)
            boostRewards.push("a Master Ball boost");
          const boostDescription =
            boostRewards.length > 1
              ? `${boostRewards.slice(0, -1).join(", ")}, and ${
                  boostRewards[boostRewards.length - 1]
                }`
              : boostRewards[0];
          const rewardMessage = `received ${new Intl.NumberFormat("en-US").format(reward.pokedollars)} Pokédollars${
            boostDescription
              ? ` and added ${boostDescription} to your inventory`
              : ""
          }`;
          const notificationRef = firestore
            .collection("users")
            .doc(award.userId)
            .collection(rankingNotificationCollection)
            .doc(randomUUID());
          transaction.set(notificationRef, {
            type: "monthly-award",
            mode: award.mode,
            place: award.place,
            message: `Congratulations! You finished ${award.place}${award.place === 1 ? "st" : award.place === 2 ? "nd" : award.place === 3 ? "rd" : "th"} in the ${award.mode === "classic" ? "Classic" : "Sentry Duty"} monthly ranking and ${rewardMessage}.`,
            createdAt: new Date(),
          });
        });
      }

      transaction.set(periodRef, { period });
    });
  }

  function scheduleMonthlyRankingReset() {
    setInterval(() => {
      ensureMonthlyRankingPeriod().catch((err) => {
        console.error("Failed to reset monthly rankings:", err);
      });
    }, 5 * 60 * 1000);
  }

  async function addSurpassedNotifications(
    transaction,
    {
      mode,
      period,
      userId,
      username,
      previousAllTimeScore,
      newAllTimeScore,
      previousMonthlyScore,
      newMonthlyScore,
    },
  ) {
    const scoreField = mode === "classic" ? "classicWins" : "sentryBestScore";
    const queries = [];
    if (newAllTimeScore > previousAllTimeScore)
      queries.push({
        monthly: false,
        query: firestore
          .collection("users")
          .where(scoreField, ">", previousAllTimeScore)
          .where(scoreField, "<", newAllTimeScore),
      });
    if (newMonthlyScore > previousMonthlyScore)
      queries.push({
        monthly: true,
        query: getMonthlyRankingCollection(period, mode)
          .where("score", ">", previousMonthlyScore)
          .where("score", "<", newMonthlyScore),
      });

    const results = await Promise.all(
      queries.map(({ query }) => transaction.get(query)),
    );
    results.forEach((players, index) => {
      const { monthly } = queries[index];
      const rankingName = monthly
        ? `${mode === "classic" ? "Classic" : "Sentry Duty"} monthly`
        : `${mode === "classic" ? "Classic" : "Sentry Duty"} All-Time`;
      players.docs
        .filter((player) => player.id !== userId)
        .forEach((player) => {
          const notificationRef = firestore
            .collection("users")
            .doc(player.id)
            .collection(rankingNotificationCollection)
            .doc(randomUUID());
          transaction.set(notificationRef, {
            type: "surpassed",
            mode,
            monthly,
            message: `${username} has surpassed you in the ${rankingName} ranking.`,
            createdAt: new Date(),
          });
        });
    });
  }

  async function getMonthlyRanking(period, mode) {
    const snapshot = await getMonthlyRankingCollection(period, mode)
      .orderBy("score", "desc")
      .limit(10)
      .get();
    const currentDate = mode === "classic" ? classicGetCurrentDate() : null;
    return snapshot.docs.map((player) => {
      const data = player.data();
      return {
        id: player.id,
        username: data.username,
        score: data.score,
        streak: Number.isInteger(data.streak) ? data.streak : 0,
        pointsToday:
          mode === "classic" &&
          data.pointsDate === currentDate &&
          Number.isSafeInteger(data.pointsToday) &&
          data.pointsToday > 0
            ? data.pointsToday
            : 0,
      };
    });
  }

  async function initializeMonthlyRankings() {
    await ensureMonthlyRankingPeriod();
    scheduleMonthlyRankingReset();
  }

  return {
    addSurpassedNotifications,
    ensureMonthlyRankingPeriod,
    getCachedRanking,
    getMonthlyRanking,
    getMonthlyRankingCollection,
    getRankingPeriod,
    initializeMonthlyRankings,
    invalidateRankingCache,
  };
}

module.exports = createRankingService;
