(function (root) {
  const helpers = { getPokemonDisplayName, getPokemonSlug };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = helpers;
  } else {
    root.PokemonNameHelpers = helpers;
  }

  function getPokemonDisplayName(name) {
    return name
      .replace("Farfetchd", "Farfetch'd")
      .replace(/NidoranF/i, "Nidoran♀")
      .replace(/NidoranM/i, "Nidoran♂")
      .replace("Ho Oh", "Ho-Oh");
  }

  function getPokemonSlug(name) {
    return name
      .toLowerCase()
      .replace("mr. mime", "mr-mime")
      .replace("nidoranf", "nidoran-female")
      .replace("nidoranm", "nidoran-male")
      .replace("mime jr.", "mime-jr")
      .replaceAll(" ", "-");
  }
})(globalThis);
