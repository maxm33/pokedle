function createRedisGameState({
  sendCommand,
  sentrySessionTtlMs,
  classicTtlMs = 26 * 60 * 60 * 1000,
}) {
  const prefix = "pokedle:game:";

  function classicKey(gameId, playerId) {
    return `${prefix}classic:${gameId}:player:${encodeURIComponent(playerId)}`;
  }

  function sentrySessionKey(sessionId) {
    return `${prefix}sentry:session:${encodeURIComponent(sessionId)}`;
  }

  function sentryChallengeKey(challengeId) {
    return `${prefix}sentry:challenge:${encodeURIComponent(challengeId)}`;
  }

  function serializeClassicState(state) {
    return JSON.stringify({
      guesses: [...state.guesses.entries()].map(([name, entry]) => [
        name,
        {
          tries: entry.tries,
          result: entry.result,
          guaranteedShiny: entry.guaranteedShiny,
        },
      ]),
      winner: Boolean(state.winner),
    });
  }

  async function getClassicPlayer(gameId, playerId) {
    const value = await sendCommand("GET", classicKey(gameId, playerId));
    if (!value) return null;
    const stored = JSON.parse(value);
    return {
      guesses: new Map(stored.guesses || []),
      winner: Boolean(stored.winner),
      pendingWinner: null,
    };
  }

  async function setClassicPlayer(gameId, playerId, state) {
    await sendCommand(
      "SET",
      classicKey(gameId, playerId),
      serializeClassicState(state),
      "PX",
      String(classicTtlMs),
    );
  }

  async function deleteClassicPlayer(gameId, playerId) {
    await sendCommand("DEL", classicKey(gameId, playerId));
  }

  async function markClassicWinner(gameId, playerId) {
    await sendCommand("SADD", `${prefix}classic:${gameId}:winners`, playerId);
    await sendCommand(
      "PEXPIRE",
      `${prefix}classic:${gameId}:winners`,
      String(classicTtlMs),
    );
  }

  async function isClassicWinner(gameId, playerId) {
    return (
      (await sendCommand(
        "SISMEMBER",
        `${prefix}classic:${gameId}:winners`,
        playerId,
      )) === 1
    );
  }

  async function resetClassicGame(gameId) {
    await sendCommand("DEL", `${prefix}classic:${gameId}:winners`);
  }

  async function getSentrySession(sessionId) {
    const value = await sendCommand("GET", sentrySessionKey(sessionId));
    return value ? JSON.parse(value) : null;
  }

  async function setSentrySession(sessionId, session) {
    await sendCommand(
      "SET",
      sentrySessionKey(sessionId),
      JSON.stringify(session),
      "PX",
      String(sentrySessionTtlMs),
    );
  }

  async function deleteSentrySession(sessionId) {
    await sendCommand("DEL", sentrySessionKey(sessionId));
  }

  async function getSentryChallenge(challengeId) {
    const value = await sendCommand("GET", sentryChallengeKey(challengeId));
    return value ? JSON.parse(value) : null;
  }

  async function setSentryChallenge(challengeId, challenge) {
    await sendCommand(
      "SET",
      sentryChallengeKey(challengeId),
      JSON.stringify(challenge),
      "PX",
      String(sentrySessionTtlMs),
    );
  }

  async function deleteSentryChallenge(challengeId) {
    await sendCommand("DEL", sentryChallengeKey(challengeId));
  }

  return {
    getClassicPlayer,
    setClassicPlayer,
    deleteClassicPlayer,
    markClassicWinner,
    isClassicWinner,
    resetClassicGame,
    getSentrySession,
    setSentrySession,
    deleteSentrySession,
    getSentryChallenge,
    setSentryChallenge,
    deleteSentryChallenge,
  };
}

module.exports = createRedisGameState;
