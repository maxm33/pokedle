const createPokemonDataService = require("./pokemonDataService");
const createShopDiscountService = require("./shopDiscountService");
const createSentryChallengeService = require("./sentryChallengeService");

function createGameRuntime({
  state,
  firestore,
  badFootprints,
  eventPokemonPool,
  randomUUID,
  classicGetRemainingTime,
  sentryDurationMs,
  desktopBackgroundCount,
  mobileBackgroundCount,
  shopBackgrounds,
  overlayItems,
  companionItems,
  boostItems,
  randomFn = Math.random,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
}) {
  let scheduledClassicTimeout = null;
  const pokemonData = createPokemonDataService({
    firestore,
    state,
    badFootprints,
  });
  const shopDiscounts = createShopDiscountService({
    state,
    shopBackgrounds,
    overlayItems,
    companionItems,
    boostItems,
  });
  const sentryChallenges = createSentryChallengeService({
    state,
    randomUUID,
    sentryDurationMs,
  });

  async function classicGeneratePokemon() {
    if (!state.classicCurrentPokemon)
      throw new Error("Cannot generate a game before the initial Pokémon loads");

    const previousPokemon = state.classicCurrentPokemon;
    const eligibleEventPokemon = eventPokemonPool.filter(
      (pokemonName) => pokemonName !== previousPokemon.name,
    );
    const useEventPool = eligibleEventPokemon.length > 0 && randomFn() < 0.1;
    const useDoubleEarnings = randomFn() < 0.2;
    const useShinyEvent = randomFn() < 0.1;

    let nextPokemon;
    if (useEventPool) {
      const pokemonName =
        eligibleEventPokemon[
        Math.floor(randomFn() * eligibleEventPokemon.length)
        ];
      nextPokemon = state.pokemonByName?.get(pokemonName);
      if (!nextPokemon)
        throw new Error(`Event Pokémon "${pokemonName}" was not found`);
    } else {
      const availablePokemon = Array.from(state.pokemonCache.entries())
        .filter(
          ([id, pokemon]) =>
            Number(id) >= 1 &&
            Number(id) <= 649 &&
            id !== String(previousPokemon.ID) &&
            pokemon,
        )
        .map(([, pokemon]) => pokemon);
      if (availablePokemon.length === 0)
        throw new Error("No Pokémon available for the next Classic game");
      nextPokemon =
        availablePokemon[Math.floor(randomFn() * availablePokemon.length)];
    }
    if (!nextPokemon) throw new Error("Generated Pokémon was not found");

    let nextDesktopBackground = state.bg_desktop_option;
    while (nextDesktopBackground == state.bg_desktop_option)
      nextDesktopBackground =
        Math.floor(randomFn() * desktopBackgroundCount) + 1;
    let nextMobileBackground = state.bg_mobile_option;
    while (nextMobileBackground == state.bg_mobile_option)
      nextMobileBackground =
        Math.floor(randomFn() * mobileBackgroundCount) + 1;

    state.classicPreviousPokemon = previousPokemon;
    state.classicCurrentPokemon = nextPokemon;
    state.classicGameID = randomUUID();
    state.classicWinners = [];
    state.classicPlayerStates.clear();
    if (state.redisGameState)
      await state.redisGameState.resetClassicGame(state.classicGameID);
    state.classicEventActive = useEventPool;
    state.classicDoubleEarningsEventActive = useDoubleEarnings;
    state.classicShinyEventActive = useShinyEvent;
    state.bg_desktop_option = nextDesktopBackground;
    state.bg_mobile_option = nextMobileBackground;

    shopDiscounts.generateShopDiscounts();
    scheduleClassicGeneration();
  }

  function scheduleClassicGeneration(delay = classicGetRemainingTime()) {
    stopScheduledClassicGeneration();
    scheduledClassicTimeout = setTimeoutFn(() => {
      scheduledClassicTimeout = null;
      classicGeneratePokemon().catch((err) => {
        console.error(
          "Failed to generate the daily Pokémon; retrying in 60 seconds.",
          err,
        );
        scheduleClassicGeneration(60 * 1000);
      });
    }, delay);
  }

  function stopScheduledClassicGeneration() {
    if (scheduledClassicTimeout === null) return;
    clearTimeoutFn(scheduledClassicTimeout);
    scheduledClassicTimeout = null;
  }

  async function initializeClassicGame() {
    if (state.pokemonCache.size === 0) await pokemonData.cachePokemonData();

    const initialPokemon = state.pokemonCache.get("132");
    if (!initialPokemon) throw new Error("Initial Pokémon 132 was not found");

    state.classicCurrentPokemon = initialPokemon;
    await classicGeneratePokemon();
  }

  return {
    generateSentryChallenge: sentryChallenges.generateSentryChallenge,
    initializeClassicGame,
    stopScheduledClassicGeneration,
  };
}

module.exports = createGameRuntime;
