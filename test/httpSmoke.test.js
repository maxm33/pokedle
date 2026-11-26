const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const {
  createOptionalAuthMiddleware,
  createRequiredAuthMiddleware,
} = require("../routes/authMiddleware");

function createSmokeApp(auth) {
  const app = express();
  app.use(express.json());

  app.get(
    "/optional",
    createOptionalAuthMiddleware(auth),
    (req, res) => res.status(200).json({ uid: req.authenticatedUid }),
  );
  app.get(
    "/required",
    createRequiredAuthMiddleware(auth),
    (req, res) => res.status(200).json({ uid: req.authenticatedUid }),
  );
  app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

  return app;
}

test("HTTP smoke: health endpoint is reachable", async () => {
  const app = createSmokeApp({
    verifyIdToken: async () => ({ uid: "user-1" }),
  });
  const response = await request(app).get("/health");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true });
});

test("HTTP smoke: optional authentication tolerates missing or invalid credentials", async () => {
  const app = createSmokeApp({
    verifyIdToken: async () => {
      throw new Error("invalid");
    },
  });
  const missing = await request(app).get("/optional");
  assert.equal(missing.status, 200);
  assert.equal(missing.body.uid, null);

  const invalid = await request(app)
    .get("/optional")
    .set("Authorization", "Bearer invalid");
  assert.equal(invalid.status, 200);
  assert.equal(invalid.body.uid, null);
});

test("HTTP smoke: required authentication accepts and rejects tokens", async () => {
  const app = createSmokeApp({
    verifyIdToken: async (token) => {
      if (token !== "valid") throw new Error("invalid");
      return { uid: "user-1" };
    },
  });

  const missing = await request(app).get("/required");
  assert.equal(missing.status, 401);

  const invalid = await request(app)
    .get("/required")
    .set("Authorization", "Bearer invalid");
  assert.equal(invalid.status, 401);

  const valid = await request(app)
    .get("/required")
    .set("Authorization", "Bearer valid");
  assert.equal(valid.status, 200);
  assert.equal(valid.body.uid, "user-1");
});
