const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createOptionalAuthMiddleware,
  createRequiredAuthMiddleware,
} = require("../routes/authMiddleware");

function createRequest(authorization) {
  return {
    get(name) {
      return name === "authorization" ? authorization : undefined;
    },
  };
}

test("optional auth accepts missing and invalid tokens", async () => {
  const middleware = createOptionalAuthMiddleware({
    verifyIdToken: async () => {
      throw new Error("invalid");
    },
  });
  const missingReq = createRequest(undefined);
  let nextCalls = 0;
  await middleware(missingReq, {}, () => nextCalls++);
  assert.equal(missingReq.authenticatedUid, null);
  assert.equal(nextCalls, 1);

  const invalidReq = createRequest("Bearer bad");
  await middleware(invalidReq, {}, () => nextCalls++);
  assert.equal(invalidReq.authenticatedUid, null);
  assert.equal(nextCalls, 2);
});

test("required auth rejects missing tokens", async () => {
  const middleware = createRequiredAuthMiddleware({
    verifyIdToken: async () => ({ uid: "user-1" }),
  });
  const req = createRequest(undefined);
  let status;
  const res = {
    status(code) {
      status = code;
      return this;
    },
    send() {
      return this;
    },
  };
  await middleware(req, res, () => {});
  assert.equal(status, 401);
});
