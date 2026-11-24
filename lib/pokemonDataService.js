function createPokemonDataService({ firestore, state, badFootprints }) {
  async function cachePokemonData() {
    const snapshot = await firestore.collection("pokemons").get();

    state.pokemonCache = new Map();
    state.pokemonByName = new Map();
    state.sentryPokemonNames = [];
    state.validSentryIds = [];

    for (const doc of snapshot.docs) {
      const pokemon = doc.data();
      state.pokemonCache.set(doc.id, pokemon);
      if (pokemon.name) {
        state.pokemonByName.set(pokemon.name, pokemon);
      }
      if (pokemon.name && !badFootprints.includes(pokemon.name)) {
        state.validSentryIds.push(doc.id);
        state.sentryPokemonNames.push(pokemon.name);
      }
    }

    if (state.pokemonCache.size === 0)
      throw new Error("Pokémon collection is empty");
    if (state.validSentryIds.length === 0)
      throw new Error("No Pokémon are available for Sentry challenges");
  }

  return { cachePokemonData };
}

module.exports = createPokemonDataService;
