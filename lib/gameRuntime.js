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
  setTimeoutFn = setTimeout,
}) {
  async function cachePokemonData() {
    const snapshot = await firestore.collection("pokemons").get();

    for (const doc of snapshot.docs) {
      const pokemon = doc.data();
      state.pokemonCache.set(doc.id, pokemon);
      if (pokemon.name && !badFootprints.includes(pokemon.name))
        state.validSentryIds.push(doc.id);
    }

    if (state.pokemonCache.size === 0)
      throw new Error("Pokémon collection is empty");
    if (state.validSentryIds.length === 0)
      throw new Error("No Pokémon are available for Sentry challenges");
  }

  function generateShopDiscounts() {
    state.shopDiscounts = {};
    const allItems = [
      ...shopBackgrounds,
      ...overlayItems,
      ...companionItems,
      ...boostItems,
    ];
    for (const item of allItems) {
      if (item.purchasable !== false && Math.random() < 0.25) {
        const discountPercent = Math.floor(Math.random() * 31) + 20;
        state.shopDiscounts[item.id] = discountPercent;
      }
    }
  }

  async function classicGeneratePokemon() {
    if (!state.classicCurrentPokemon)
      throw new Error("Cannot generate a game before the initial Pokémon loads");

    const previousPokemon = state.classicCurrentPokemon;
    const eligibleEventPokemon = eventPokemonPool.filter(
      (pokemonName) => pokemonName !== previousPokemon.name,
    );
    const useEventPool = eligibleEventPokemon.length > 0 && Math.random() < 0.1;
    const useDoubleEarnings = Math.random() < 0.2;
    const useShinyEvent = Math.random() < 0.1;

    let nextPokemon;
    if (useEventPool) {
      const pokemonName =
        eligibleEventPokemon[
          Math.floor(Math.random() * eligibleEventPokemon.length)
        ];
      nextPokemon = Array.from(state.pokemonCache.values()).find(
        (pokemon) => pokemon.name === pokemonName,
      );
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
        availablePokemon[Math.floor(Math.random() * availablePokemon.length)];
    }
    if (!nextPokemon) throw new Error("Generated Pokémon was not found");

    let nextDesktopBackground = state.bg_desktop_option;
    while (nextDesktopBackground == state.bg_desktop_option)
      nextDesktopBackground =
        Math.floor(Math.random() * desktopBackgroundCount) + 1;
    let nextMobileBackground = state.bg_mobile_option;
    while (nextMobileBackground == state.bg_mobile_option)
      nextMobileBackground =
        Math.floor(Math.random() * mobileBackgroundCount) + 1;

    state.classicPreviousPokemon = previousPokemon;
    state.classicCurrentPokemon = nextPokemon;
    state.classicGameID = randomUUID();
    state.classicWinners = [];
    state.classicPlayerStates.clear();
    state.classicEventActive = useEventPool;
    state.classicDoubleEarningsEventActive = useDoubleEarnings;
    state.classicShinyEventActive = useShinyEvent;
    state.bg_desktop_option = nextDesktopBackground;
    state.bg_mobile_option = nextMobileBackground;

    generateShopDiscounts();
    scheduleClassicGeneration();
  }

  function scheduleClassicGeneration(delay = classicGetRemainingTime()) {
    setTimeoutFn(() => {
      classicGeneratePokemon().catch((err) => {
        console.error(
          "Failed to generate the daily Pokémon; retrying in 60 seconds.",
          err,
        );
        scheduleClassicGeneration(60 * 1000);
      });
    }, delay);
  }

  async function initializeClassicGame() {
    if (state.pokemonCache.size === 0) await cachePokemonData();

    const initialPokemon = state.pokemonCache.get("132");
    if (!initialPokemon) throw new Error("Initial Pokémon 132 was not found");

    state.classicCurrentPokemon = initialPokemon;
    await classicGeneratePokemon();
  }

  async function generateSentryChallenge(sessionID, session) {
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
        Array.from(state.pokemonCache.values(), (pokemon) => pokemon.name).filter(
          (name) => typeof name === "string" && name !== answer.name,
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

    return {
      challengeID,
      options,
      durationMs: sentryDurationMs,
      createdAt: startTime,
      footprintUrl,
    };
  }

  return {
    cachePokemonData,
    generateSentryChallenge,
    initializeClassicGame,
  };
}

function getFootprintUrl(pokemonName) {
  return `/public/images/sentry/footprints/${encodeURIComponent(pokemonName)}.png`;
}

module.exports = createGameRuntime;
