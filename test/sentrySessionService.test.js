const test = require("node:test");
const assert = require("node:assert/strict");
const {
  expireSentrySessions,
  createSentrySession,
  bindGuestSessionToUser,
  beginChallengeProcessing,
  cancelChallengeProcessing,
} = require("../lib/sentrySessionService");

test("Sentry session creation and expiration", () => {
  const state = {
    sentrySessions: new Map(),
    sentryChallenges: { challenge: { sessionID: "expired" } },
  };
  const session = createSentrySession({
    state,
    sessionId: "expired",
    authenticatedUid: "user-1",
    sentrySessionTtlMs: 1000,
    now: 100,
  });
  session.currentChallengeID = "challenge";
  expireSentrySessions({ state, now: 1101 });
  assert.equal(state.sentrySessions.size, 0);
  assert.equal(state.sentryChallenges.challenge, undefined);
});

test("guest Sentry session binds to a signed-in user", () => {
  const session = {
    uid: null,
    totalScore: 10,
    failures: 2,
    rounds: 3,
  };
  assert.equal(bindGuestSessionToUser(session, "user-1"), true);
  assert.equal(session.uid, "user-1");
  assert.equal(session.totalScore, 0);
  assert.equal(session.failures, 0);
  assert.equal(session.rounds, 0);
});

test("challenge processing is cancelled safely", () => {
  const state = {
    sentryChallenges: {
      challenge: { processing: false },
    },
  };
  const session = { currentChallengeID: "challenge" };
  assert.equal(beginChallengeProcessing(state, session).processing, true);
  cancelChallengeProcessing(state, state.sentryChallenges.challenge);
  assert.equal(state.sentryChallenges.challenge.processing, false);
});
