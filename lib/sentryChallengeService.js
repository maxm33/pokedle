function createSentryChallengeService({
  state,
  randomUUID,
  sentryDurationMs,
}) {
  function getFootprintUrl(pokemonName) {
    return `/public/images/sentry/footprints/${encodeURIComponent(pokemonName)}.png`;
  }

  function generateSentryChallenge(sessionID, session) {
    const challengeID = randomUUID();
    const answerID =
      state.validSentryIds[
        Math.floor(Math.random() * state.validSentryIds.length)
      ];
    const answer = state.pokemonCache.get(answerID);
    if (!answer) throw new Error("Pokémon not found for sentry challenge");

    const options = [answer.name];
    const wrongOptions = [
      ...new Set(
        (state.sentryPokemonNames?.length
          ? state.sentryPokemonNames
          : Array.from(state.pokemonCache.values(), (pokemon) => pokemon.name)
        ).filter(
          (name) =>
            typeof name === "string" &&
            name !== answer.name &&
            name,
        ),
      ),
    ];
    if (wrongOptions.length < 3)
      throw new Error("Not enough Pokémon for Sentry challenge options");

    while (options.length < 4) {
      const optionIndex = Math.floor(Math.random() * wrongOptions.length);
      options.push(wrongOptions.splice(optionIndex, 1)[0]);
    }

    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    const startTime = Date.now();
    const footprintUrl = getFootprintUrl(answer.name);
    state.sentryChallenges[challengeID] = {
      answer: answer.name,
      options,
      startTime,
      sessionID,
      processing: false,
    };
    session.currentChallengeID = challengeID;

    return Promise.resolve({
      challengeID,
      options,
      durationMs: sentryDurationMs,
      createdAt: startTime,
      footprintUrl,
    });
  }

  return { generateSentryChallenge };
}

module.exports = createSentryChallengeService;
