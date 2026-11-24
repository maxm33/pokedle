function expireSentrySessions({ state, now }) {
  for (const [sessionId, session] of state.sentrySessions) {
    if (session.expiresAt > now) continue;
    if (session.currentChallengeID)
      delete state.sentryChallenges[session.currentChallengeID];
    state.sentrySessions.delete(sessionId);
  }
}

function createSentrySession({
  state,
  sessionId,
  authenticatedUid,
  sentrySessionTtlMs,
  now = Date.now(),
}) {
  const session = {
    uid: authenticatedUid,
    totalScore: 0,
    failures: 0,
    rounds: 0,
    gameOver: false,
    currentChallengeID: null,
    expiresAt: now + sentrySessionTtlMs,
  };
  state.sentrySessions.set(sessionId, session);
  return session;
}

function bindGuestSessionToUser(session, authenticatedUid) {
  if (session.uid) return true;
  if (!authenticatedUid) return true;
  session.uid = authenticatedUid;
  session.totalScore = 0;
  session.failures = 0;
  session.rounds = 0;
  return true;
}

function beginChallengeProcessing(state, session) {
  const challenge =
    session.currentChallengeID
      ? state.sentryChallenges[session.currentChallengeID]
      : null;
  if (!challenge || challenge.processing) return null;
  challenge.processing = true;
  return challenge;
}

function cancelChallengeProcessing(state, challenge) {
  if (challenge) challenge.processing = false;
}

module.exports = {
  expireSentrySessions,
  createSentrySession,
  bindGuestSessionToUser,
  beginChallengeProcessing,
  cancelChallengeProcessing,
};
