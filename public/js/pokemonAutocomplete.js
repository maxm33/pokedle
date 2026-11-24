import { getPokemonDisplayName } from "./pokemonNames.js";

export function initializePokemonAutocomplete(element, options, submitGuess) {
  const searchableNames = options.names.map((originalName) => {
    const displayName = getPokemonDisplayName(originalName);
    return {
      originalName,
      displayName,
      normalizedOriginal: originalName.toUpperCase(),
      normalizedDisplay: displayName.toUpperCase(),
    };
  });

  const closeList = (eventTarget) => {
    const items = document.getElementsByClassName("autocomplete-items");
    for (let i = items.length - 1; i >= 0; i--) {
      if (eventTarget !== items[i] && eventTarget !== element)
        items[i].parentNode.removeChild(items[i]);
    }
  };

  element.addEventListener("input", function () {
    const value = this.value;
    closeList();
    if (!value) return;

    const list = document.createElement("div");
    list.id = "autocomplete-list";
    list.className = "autocomplete-items";
    this.parentNode.appendChild(list);

    const normalizedValue = value.toUpperCase();
    const availableOptions = searchableNames
      .filter(
        ({ originalName, normalizedOriginal, normalizedDisplay }) =>
          !options.isPokemonGuessed(originalName) &&
          (normalizedOriginal.startsWith(normalizedValue) ||
            normalizedDisplay.startsWith(normalizedValue)),
      );

    availableOptions.forEach(({ originalName, displayName }) => {
      const displayMatch = displayName.slice(0, value.length);
      const displayRest = displayName.slice(value.length);
      const option = document.createElement("div");
      option.className = "list-options";

      const image = document.createElement("img");
      image.alt = "";
      image.src = `/public/images/sprites/${encodeURIComponent(originalName)}.webp`;
      image.width = 70;
      image.height = 70;
      option.appendChild(image);

      const match = document.createElement("strong");
      match.className = "autocomplete-match";
      match.textContent = displayMatch;
      option.appendChild(match);
      option.appendChild(document.createTextNode(displayRest));

      const input = document.createElement("input");
      input.type = "hidden";
      input.value = originalName;
      option.appendChild(input);
      option.addEventListener("click", async () => {
        element.value = originalName;
        closeList();
        await submitGuess(originalName, element);
      });
      list.appendChild(option);
    });
  });

  document.addEventListener("click", (event) => closeList(event.target));
}
