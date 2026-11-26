const { addSafePokedollars } = require("./shopCatalog");

function createGameStatsService({
  firestore,
  rankingService,
  classicStats,
  isClassicDoubleEarningsEventActive,
}) {
  async function updateStatsOnClassicWin(
    id,
    pokemon,
    tries,
    shinyRoll,
    guaranteedShiny,
  ) {
    const now = new Date();
    const { year, month, day } = classicStats.classicGetDateTimeParts(now);
    const streakDate = classicStats.classicGetCurrentDate();
    const historyDate = `${String(day).padStart(2, "0")}-${String(
      month,
    ).padStart(2, "0")}-${year}`;
    const userRef = firestore.collection("users").doc(id);
    await rankingService.ensureMonthlyRankingPeriod();
    const rankingPeriod = rankingService.getRankingPeriod();
    const monthlyRankingRef = rankingService
      .getMonthlyRankingCollection(rankingPeriod, "classic")
      .doc(id);

    const result = await firestore.runTransaction(async (transaction) => {
      const doc = await transaction.get(userRef);
      const user = doc.data();
      if (!user) return null;
      const monthlyRankingDoc = await transaction.get(monthlyRankingRef);

      const previousStreak = Number.isInteger(user.classicWinStreak)
        ? user.classicWinStreak
        : 0;
      const daysSinceLastWin = classicStats.classicGetDaysBetween(
        user.classicLastWinDate,
        streakDate,
      );
      if (daysSinceLastWin === 0)
        return {
          ball: classicStats.classicGetBallForStreak(previousStreak),
          shiny: guaranteedShiny,
          pokedollarsEarned: 0,
          rankingUpdated: false,
        };

      const streakBall = classicStats.classicGetStreakBall(user, streakDate);
      const masterBallBoostActive =
        classicStats.classicIsMasterBallBoostActive(user);
      const ball = masterBallBoostActive ? "master-ball" : streakBall;
      user.classicWinStreak = classicStats.classicGetNextStreak(
        previousStreak,
        user.classicLastWinDate,
        streakDate,
      );
      user.classicLastWinDate = streakDate;

      const classicWins = Number(user.classicWins) || 0;
      const previousMonthlyScore = monthlyRankingDoc.data()?.score || 0;
      const monthlyPointsEarned = classicStats.classicGetMonthlyRankingPoints(
        tries,
        previousStreak,
      );
      const monthlyScore = previousMonthlyScore + monthlyPointsEarned;
      const classicAvgTries = Number(user.classicAvgTries) || 0;
      user.classicAvgTries =
        (classicWins * classicAvgTries + tries) / (classicWins + 1);
      user.classicWins = classicWins + 1;
      let pokedollarsEarned = classicStats.classicGetPokedollarReward(tries);
      const doubleEarningsUntilDate = user.doubleEarningsUntilDate;
      const remainingDays = doubleEarningsUntilDate
        ? classicStats.classicGetDaysBetween(
            streakDate,
            doubleEarningsUntilDate,
          )
        : null;
      const hasDoubleEarningsBoost =
        remainingDays !== null && remainingDays >= 0;
      const earningsMultiplier =
        (isClassicDoubleEarningsEventActive() ? 2 : 1) *
        (hasDoubleEarningsBoost ? 2 : 1);
      pokedollarsEarned *= earningsMultiplier;
      const updatedBalance = addSafePokedollars(user, pokedollarsEarned);
      if (updatedBalance === null)
        throw new Error("Pokédollar balance limit reached");
      user.pokedollars = updatedBalance;

      if (masterBallBoostActive) {
        user.activeMasterBallBoost = false;
      }
      if (remainingDays !== null && remainingDays <= 0)
        user.doubleEarningsUntilDate = null;

      if (!Array.isArray(user.classicHistory)) user.classicHistory = [];
      const shiny =
        guaranteedShiny ||
        (typeof shinyRoll === "boolean"
          ? shinyRoll
          : shinyRoll < classicStats.classicGetShinyChance(ball));
      let found = false;
      for (let i = 0; i < user.classicHistory.length; i++) {
        if (user.classicHistory[i].pokemon == pokemon) {
          user.classicHistory[i].timesGuessed++;
          user.classicHistory[i].date = historyDate;
          if (shiny) user.classicHistory[i].shiny = true;
          found = true;
          break;
        }
      }
      if (!found)
        user.classicHistory.push({
          pokemon,
          timesGuessed: 1,
          date: historyDate,
          ...(shiny ? { shiny: true } : {}),
        });

      transaction.set(userRef, user);
      transaction.set(monthlyRankingRef, {
        username: user.username || "???",
        score: monthlyScore,
        streak: user.classicWinStreak,
        pointsDate: streakDate,
        pointsToday: monthlyPointsEarned,
      });
      return {
        ball,
        shiny,
        pokedollarsEarned,
        rankingUpdated: true,
      };
    });

    if (result?.rankingUpdated)
      rankingService.invalidateRankingCache("classic", rankingPeriod);
    if (!result) return null;
    const gameResult = {
      ball: result.ball,
      shiny: result.shiny,
      pokedollarsEarned: result.pokedollarsEarned,
    };
    return gameResult;
  }

  async function updateStatsOnSentryRound(
    id,
    sessionTotal,
    failed,
    sessionRounds,
    gameOver,
  ) {
    const userRef = firestore.collection("users").doc(id);
    await rankingService.ensureMonthlyRankingPeriod();
    const rankingPeriod = rankingService.getRankingPeriod();
    const monthlyRankingRef = rankingService
      .getMonthlyRankingCollection(rankingPeriod, "sentry")
      .doc(id);
    await firestore.runTransaction(async (transaction) => {
      const doc = await transaction.get(userRef);
      const user = doc.data();
      if (!user) return;

      const monthlyRankingDoc = await transaction.get(monthlyRankingRef);
      const previousAllTimeScore = user.sentryBestScore || 0;
      const previousMonthlyScore = monthlyRankingDoc.data()?.score || 0;
      const sentryBestScore = Math.max(previousAllTimeScore, sessionTotal);
      const monthlyScore = Math.max(previousMonthlyScore, sessionTotal);
      const sentrySessionsCompleted = (user.sentrySessionsCompleted || 0) + 1;
      const sentryFailures = (user.sentryFailures || 0) + (failed ? 1 : 0);
      const sentryBestSession =
        gameOver && sessionRounds > (user.sentryBestSession || 0)
          ? sessionRounds
          : user.sentryBestSession || 0;

      transaction.update(userRef, {
        sentryBestScore,
        sentrySessionsCompleted,
        sentryFailures,
        sentryBestSession,
      });
      if (monthlyScore > previousMonthlyScore)
        transaction.set(monthlyRankingRef, {
          username: user.username || "???",
          score: monthlyScore,
        });
    });
    rankingService.invalidateRankingCache("sentry", rankingPeriod);
  }

  return { updateStatsOnClassicWin, updateStatsOnSentryRound };
}

module.exports = createGameStatsService;
