function createRankingCache() {
  return {
    data: null,
    expiresAt: 0,
    pending: null,
    generation: 0,
  };
}

async function getCachedRanking(firestore, cache, orderField, mapUser, ttlMs) {
  if (cache.data !== null && Date.now() < cache.expiresAt) return cache.data;

  if (!cache.pending) {
    const generation = cache.generation;
    let request;
    request = firestore
      .collection("users")
      .orderBy(orderField, "desc")
      .limit(10)
      .get()
      .then((queryResult) => {
        const data = queryResult.docs.map(mapUser);
        if (cache.generation === generation) {
          cache.data = data;
          cache.expiresAt = Date.now() + ttlMs;
        }
        return data;
      })
      .finally(() => {
        if (cache.pending === request) cache.pending = null;
      });
    cache.pending = request;
  }

  return cache.pending;
}

function invalidateRankingCache(cache) {
  cache.generation++;
  cache.data = null;
  cache.expiresAt = 0;
  cache.pending = null;
}

module.exports = {
  createRankingCache,
  getCachedRanking,
  invalidateRankingCache,
};
