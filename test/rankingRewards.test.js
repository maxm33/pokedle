const test = require("node:test");
const assert = require("node:assert/strict");
const {
  monthlyRankingRewards,
  formatRankingPlace,
  describeRankingRewards,
} = require("../lib/rankingRewards");

test("ranking places have stable labels", () => {
  assert.equal(formatRankingPlace(1), "1st");
  assert.equal(formatRankingPlace(2), "2nd");
  assert.equal(formatRankingPlace(3), "3rd");
  assert.equal(formatRankingPlace(4), "4th");
});

test("ranking reward descriptions include active boosts", () => {
  assert.equal(
    describeRankingRewards(monthlyRankingRewards[1]),
    "a 2x earnings boost (7 days), and a Master Ball boost",
  );
  assert.equal(describeRankingRewards(monthlyRankingRewards[5]), "a Master Ball boost");
});
