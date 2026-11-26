const test = require("node:test");
const assert = require("node:assert/strict");
const classicStats = require("../lib/classicStats");

test("Classic reward scales with tries", () => {
  assert.equal(classicStats.classicGetPokedollarReward(3), 500);
  assert.equal(classicStats.classicGetPokedollarReward(6), 400);
  assert.equal(classicStats.classicGetPokedollarReward(10), 300);
  assert.equal(classicStats.classicGetPokedollarReward(20), 200);
  assert.equal(classicStats.classicGetPokedollarReward(21), 100);
});

test("Classic streak advances by one day and resets after gaps", () => {
  assert.equal(
    classicStats.classicGetNextStreak(2, "10-11-2026", "11-11-2026"),
    3,
  );
  assert.equal(
    classicStats.classicGetNextStreak(2, "09-11-2026", "11-11-2026"),
    1,
  );
  assert.equal(
    classicStats.classicShouldResetStreak(
      { classicWinStreak: 3, classicLastWinDate: "09-11-2026" },
      "11-11-2026",
    ),
    true,
  );
});

test("Date arithmetic rejects invalid dates", () => {
  assert.equal(
    classicStats.classicGetDaysBetween("31-02-2026", "01-03-2026"),
    null,
  );
  assert.equal(
    classicStats.classicGetDaysBetween("28-02-2024", "01-03-2024"),
    2,
  );
});

test("Ball tiers and shiny chances are stable", () => {
  assert.equal(classicStats.classicGetBallForStreak(6), "master-ball");
  assert.equal(classicStats.classicGetShinyChance("master-ball"), 0.1);
  assert.equal(classicStats.classicGetShinyChance(null), 0.01);
});
