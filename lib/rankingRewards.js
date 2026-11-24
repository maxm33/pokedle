const monthlyRankingRewards = {
  1: { pokedollars: 20000, doubleEarningsBoosts: 2, masterBallBoosts: 2 },
  2: { pokedollars: 12500, doubleEarningsBoosts: 1, masterBallBoosts: 2 },
  3: { pokedollars: 8000, doubleEarningsBoosts: 1, masterBallBoosts: 1 },
  4: { pokedollars: 5000, doubleEarningsBoosts: 0, masterBallBoosts: 1 },
  5: { pokedollars: 2500, doubleEarningsBoosts: 0, masterBallBoosts: 1 },
};

function formatRankingPlace(place) {
  if (place === 1) return "1st";
  if (place === 2) return "2nd";
  if (place === 3) return "3rd";
  return `${place}th`;
}

function describeRankingRewards(reward) {
  const boosts = [];
  if (reward.doubleEarningsBoosts > 0)
    boosts.push("a 2x earnings boost (7 days)");
  if (reward.masterBallBoosts > 0) boosts.push("a Master Ball boost");
  if (boosts.length === 0) return null;
  if (boosts.length === 1) return boosts[0];
  return `${boosts.slice(0, -1).join(", ")}, and ${boosts.at(-1)}`;
}

module.exports = {
  monthlyRankingRewards,
  formatRankingPlace,
  describeRankingRewards,
};
