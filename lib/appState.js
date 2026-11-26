function createAppState() {
  return {
    redisGameState: null,
    classicWinners: [],
    classicPlayerStates: new Map(),
    classicGameID: undefined,
    classicPreviousPokemon: undefined,
    classicCurrentPokemon: undefined,
    classicEventActive: false,
    classicDoubleEarningsEventActive: false,
    classicShinyEventActive: false,
    shopDiscounts: {},
    sentryChallenges: {},
    sentrySessions: new Map(),
    pokemonCache: new Map(),
    pokemonByName: new Map(),
    sentryPokemonNames: [],
    validSentryIds: [],
    bg_desktop_option: undefined,
    bg_mobile_option: undefined,
  };
}

module.exports = createAppState;
