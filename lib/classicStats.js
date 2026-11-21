const CLASSIC_TIME_ZONE = "Europe/Rome";
const classicDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: CLASSIC_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

function classicGetDateTimeParts(date) {
  return Object.fromEntries(
    classicDateTimeFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
}

function classicGetRemainingTime() {
  const now = Date.now();
  const todayInRome = classicGetDateTimeParts(new Date(now));
  const nextMidnightAsUtc = Date.UTC(
    todayInRome.year,
    todayInRome.month - 1,
    todayInRome.day + 1,
  );
  const nextMidnightInRome = classicGetDateTimeParts(
    new Date(nextMidnightAsUtc),
  );
  const offset =
    Date.UTC(
      nextMidnightInRome.year,
      nextMidnightInRome.month - 1,
      nextMidnightInRome.day,
      nextMidnightInRome.hour,
      nextMidnightInRome.minute,
      nextMidnightInRome.second,
    ) - nextMidnightAsUtc;

  return nextMidnightAsUtc - offset - now;
}

function classicFormatDate(date) {
  const { year, month, day } = classicGetDateTimeParts(date);
  return `${String(day).padStart(2, "0")}-${String(month).padStart(
    2,
    "0",
  )}-${year}`;
}

function classicGetCurrentDate() {
  return classicFormatDate(new Date());
}

function classicGetDaysBetween(firstDate, secondDate) {
  const datePattern = /^(\d{2})-(\d{2})-(\d{4})$/;
  const firstMatch =
    typeof firstDate === "string" ? datePattern.exec(firstDate) : null;
  const secondMatch =
    typeof secondDate === "string" ? datePattern.exec(secondDate) : null;
  if (!firstMatch || !secondMatch) return null;

  const [, firstDay, firstMonth, firstYear] = firstMatch.map(Number);
  const [, secondDay, secondMonth, secondYear] = secondMatch.map(Number);
  const firstUtc = Date.UTC(firstYear, firstMonth - 1, firstDay);
  const secondUtc = Date.UTC(secondYear, secondMonth - 1, secondDay);
  const firstDateUtc = new Date(firstUtc);
  const secondDateUtc = new Date(secondUtc);
  if (
    firstDateUtc.getUTCDate() !== firstDay ||
    firstDateUtc.getUTCMonth() !== firstMonth - 1 ||
    firstDateUtc.getUTCFullYear() !== firstYear ||
    secondDateUtc.getUTCDate() !== secondDay ||
    secondDateUtc.getUTCMonth() !== secondMonth - 1 ||
    secondDateUtc.getUTCFullYear() !== secondYear
  )
    return null;

  return Math.round((secondUtc - firstUtc) / 86400000);
}

function getMasterBallBoostProfileUpdates(active) {
  return { activeMasterBallBoost: Boolean(active) };
}

function classicIsMasterBallBoostActive(user) {
  return typeof user.activeMasterBallBoost === "boolean"
    ? user.activeMasterBallBoost
    : false;
}

function isUserBoostActive(user, itemId, currentDate) {
  if (itemId === "boost-master-ball")
    return classicIsMasterBallBoostActive(user);
  if (itemId === "boost-double-earnings") {
    const remainingDays = user.doubleEarningsUntilDate
      ? classicGetDaysBetween(currentDate, user.doubleEarningsUntilDate)
      : null;
    return remainingDays !== null && remainingDays >= 0;
  }
  return false;
}

function classicGetDoubleEarningsUntilDate(currentDate) {
  const [day, month, year] = currentDate.split("-").map(Number);
  const targetDate = new Date(Date.UTC(year, month - 1, day + 6));
  return classicFormatDate(targetDate);
}

function classicGetBallForStreak(streak) {
  if (streak >= 6) return "master-ball";
  if (streak >= 4) return "ultra-ball";
  if (streak >= 2) return "great-ball";
  return null;
}

function classicGetShinyChance(ball) {
  switch (ball) {
    case "master-ball":
      return 0.1;
    case "ultra-ball":
      return 0.05;
    case "great-ball":
      return 0.02;
    default:
      return 0.01;
  }
}

function classicGetNextStreak(previousStreak, lastWinDate, currentDate) {
  const daysSinceLastWin = classicGetDaysBetween(lastWinDate, currentDate);
  if (daysSinceLastWin === 0) return previousStreak;
  if (daysSinceLastWin === 1 && previousStreak < 7) return previousStreak + 1;
  return 1;
}

function classicShouldResetStreak(user, currentDate) {
  const daysSinceLastWin = classicGetDaysBetween(
    user.classicLastWinDate,
    currentDate,
  );
  const streak = Number.isInteger(user.classicWinStreak)
    ? user.classicWinStreak
    : 0;
  return daysSinceLastWin !== 0 && !(daysSinceLastWin === 1 && streak < 7);
}

function classicGetStreakBall(user, currentDate = classicGetCurrentDate()) {
  if (!user) return null;
  const streak = Number.isInteger(user.classicWinStreak)
    ? user.classicWinStreak
    : 0;
  const daysSinceLastWin = classicGetDaysBetween(
    user.classicLastWinDate,
    currentDate,
  );
  if (daysSinceLastWin === 0) return classicGetBallForStreak(streak);
  if (daysSinceLastWin === 1 && streak < 7)
    return classicGetBallForStreak(streak);
  return null;
}

function classicGetActiveBall(user, currentDate = classicGetCurrentDate()) {
  if (!user) return null;
  if (classicIsMasterBallBoostActive(user)) return "master-ball";
  return classicGetStreakBall(user, currentDate);
}

function classicGetPokedollarReward(tries) {
  if (tries <= 3) return 500;
  if (tries <= 6) return 400;
  if (tries <= 10) return 300;
  if (tries <= 20) return 200;
  return 100;
}

function classicGetMonthlyRankingPoints(tries, previousStreak) {
  const validTries =
    Number.isSafeInteger(tries) && tries > 0 ? tries : 1;
  const validStreak =
    Number.isInteger(previousStreak) && previousStreak > 0
      ? previousStreak
      : 0;
  const basePoints = Math.round(200 / validTries);
  return Math.round(basePoints * (1 + validStreak / 2));
}

module.exports = {
  classicGetActiveBall,
  classicGetBallForStreak,
  classicGetCurrentDate,
  classicGetDateTimeParts,
  classicGetDaysBetween,
  classicGetDoubleEarningsUntilDate,
  classicGetMonthlyRankingPoints,
  classicGetNextStreak,
  classicGetPokedollarReward,
  classicGetRemainingTime,
  classicGetShinyChance,
  classicGetStreakBall,
  classicIsMasterBallBoostActive,
  classicShouldResetStreak,
  getMasterBallBoostProfileUpdates,
  isUserBoostActive,
};
