function createRequestCache(ttlMs) {
  let data = null;
  let expiresAt = 0;
  let pending = null;
  let generation = 0;

  function get(load) {
    if (data !== null && Date.now() < expiresAt) return Promise.resolve(data);
    if (!pending) {
      const requestGeneration = generation;
      const request = Promise.resolve()
        .then(load)
        .then((loadedData) => {
          if (generation === requestGeneration) {
            data = loadedData;
            expiresAt = Date.now() + ttlMs;
          }
          return loadedData;
        })
        .finally(() => {
          if (pending === request) pending = null;
        });
      pending = request;
    }
    return pending;
  }

  function invalidate() {
    generation++;
    data = null;
    expiresAt = 0;
    pending = null;
  }

  return { get, invalidate };
}

module.exports = { createRequestCache };
