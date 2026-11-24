const { addSafePokedollars } = require("./shopCatalog");
const { createRequestCache } = require("./requestCache");
const {
  monthlyRankingRewards,
  formatRankingPlace,
  describeRankingRewards,
} = require("./rankingRewards");

function createRankingService({
  firestore,
  rankingNotificationCollection,
  classicGetDateTimeParts,
  classicGetCurrentDate,
  getOwnedBoostInventory,
  getMasterBallBoostProfileUpdates,
  randomUUID,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
}) {
  const rankingCacheTtlMs = 60 * 60 * 1000;
  const monthlyRankingCaches = new Map();
  const monthlyRankingCacheTtlMs = 60 * 1000;
  const allTimeCaches = {
    classic: createRequestCache(rankingCacheTtlMs),
    sentry: createRequestCache(rankingCacheTtlMs),
  };
  function getRankingPeriod(date = new Date()) {
    const { year, month } = classicGetDateTimeParts(date);
    return `${year}-${String(month).padStart(2, "0")}`;
  }

  function getMonthlyRankingCollection(period, mode) {
    return firestore.collection("monthlyRankings").doc(period).collection(mode);
  }

  async function getCachedRanking(mode, mapUser) {
    const cache = allTimeCaches[mode];
    if (!cache) throw new Error(`Unknown ranking mode: ${mode}`);
    const orderField = mode === "classic" ? "classicWins" : "sentryBestScore";
    return cache.get(async () => {
      const queryResult = await firestore
        .collection("users")
        .orderBy(orderField, "desc")
        .limit(10)
        .get();
      return queryResult.docs.map(mapUser);
    });
  }

  function invalidateRankingCache(mode, period) {
    const cache = allTimeCaches[mode];
    if (cache) cache.invalidate();
    if (period) {
      monthlyRankingCaches.get(`${period}:${mode}`)?.invalidate();
    } else {
      for (const [key, monthlyCache] of monthlyRankingCaches) {
        if (key.endsWith(`:${mode}`)) monthlyCache.invalidate();
      }
    }
  }

  async function ensureMonthlyRankingPeriod() {
    const period = getRankingPeriod();
    const periodRef = firestore.collection("rankingPeriods").doc("current");

    let periodChanged = false;
    await firestore.runTransaction(async (transaction) => {
      const periodDoc = await transaction.get(periodRef);
      const previousPeriod = periodDoc.data()?.period;
      if (previousPeriod === period) return;
      periodChanged = true;

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
          const updatedBalance = addSafePokedollars(user, reward.pokedollars);
          if (updatedBalance === null)
            throw new Error("Pokédollar balance limit reached");
          transaction.update(reward.profile.ref, {
            pokedollars: updatedBalance,
            ownedBoosts,
            ...getMasterBallBoostProfileUpdates(user.activeMasterBallBoost),
          });
        }

        awardedNotifications.forEach((award) => {
          const reward = monthlyRankingRewards[award.place];
          const boostDescription = describeRankingRewards(reward);
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
            message: `Congratulations! You finished ${formatRankingPlace(award.place)} in the ${award.mode === "classic" ? "Classic" : "Sentry Duty"} monthly ranking and ${rewardMessage}.`,
            createdAt: new Date(),
          });
        });
      }

      transaction.set(periodRef, { period });
    });
    if (periodChanged) monthlyRankingCaches.clear();
  }

  let monthlyRankingResetInterval = null;

  function scheduleMonthlyRankingReset() {
    if (monthlyRankingResetInterval !== null) return monthlyRankingResetInterval;
    monthlyRankingResetInterval = setIntervalFn(() => {
      ensureMonthlyRankingPeriod().catch((err) => {
        console.error("Failed to reset monthly rankings:", err);
      });
    }, 5 * 60 * 1000);
    return monthlyRankingResetInterval;
  }

  function stopMonthlyRankingReset() {
    if (monthlyRankingResetInterval === null) return;
    clearIntervalFn(monthlyRankingResetInterval);
    monthlyRankingResetInterval = null;
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
    const key = `${period}:${mode}`;
    let cache = monthlyRankingCaches.get(key);
    if (!cache) {
      cache = createRequestCache(monthlyRankingCacheTtlMs);
      monthlyRankingCaches.set(key, cache);
    }
    return cache.get(async () => {
      const snapshot = await getMonthlyRankingCollection(period, mode)
        .orderBy("score", "desc")
        .limit(10)
        .get();
      const currentDate = mode === "classic" ? classicGetCurrentDate() : null;
      return snapshot.docs.map((player) => {
        const playerData = player.data();
        return {
          id: player.id,
          username: playerData.username,
          score: playerData.score,
          streak: Number.isInteger(playerData.streak) ? playerData.streak : 0,
          pointsToday:
            mode === "classic" &&
            playerData.pointsDate === currentDate &&
            Number.isSafeInteger(playerData.pointsToday) &&
            playerData.pointsToday > 0
              ? playerData.pointsToday
              : 0,
        };
      });
    });
  }

  async function initializeMonthlyRankings() {
    await ensureMonthlyRankingPeriod();
    return scheduleMonthlyRankingReset();
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
    stopMonthlyRankingReset,
  };
}

module.exports = createRankingService;
