const test = require("node:test");
const assert = require("node:assert/strict");
const { createRequestCache } = require("../lib/requestCache");

test("request cache reuses pending and cached requests", async () => {
  const cache = createRequestCache(1000);
  let loads = 0;
  const load = () => {
    loads++;
    return Promise.resolve({ loads });
  };
  const first = cache.get(load);
  const second = cache.get(load);
  assert.strictEqual(first, second);
  assert.deepEqual(await first, { loads: 1 });
  assert.deepEqual(await cache.get(load), { loads: 1 });
  assert.equal(loads, 1);
});

test("cache invalidation forces a fresh load", async () => {
  const cache = createRequestCache(1000);
  let value = 1;
  await cache.get(() => Promise.resolve(value));
  cache.invalidate();
  value = 2;
  assert.equal(await cache.get(() => Promise.resolve(value)), 2);
});
