import { getPokemonDisplayName } from "./pokemonNames.js";

export function showClassicVictory({
  tries,
  pokemon,
  shiny,
  pokedollarsEarned,
  signedIn,
  delay = 1000,
}) {
  const pokemonDisplayName = getPokemonDisplayName(pokemon.name);
  const gifName = encodeURIComponent(pokemon.name.toLowerCase());
  const victoryImageUrl = `/public/images/animations/${gifName}${shiny ? "_shiny" : ""}.gif`;
  const victoryText = shiny
    ? `It was a shiny ${pokemonDisplayName}!`
    : `It was ${pokemonDisplayName}!`;
  const pokedollarsText =
    pokedollarsEarned > 0
      ? `You earned ${pokedollarsEarned} Pokédollars!`
      : signedIn
        ? ""
        : "Log in to earn Pokédollars!";

  window.setTimeout(() => {
    const ad = document.createElement("div");
    ad.id = "victory-ad-container";
    document.body.appendChild(ad);

    const content = document.createElement("div");
    content.className = "victory-ad-content";
    ad.appendChild(content);

    const appendVictoryText = (id, text) => {
      const container = document.createElement("div");
      container.id = id;
      const boldText = document.createElement("b");
      boldText.textContent = text;
      container.appendChild(boldText);
      content.appendChild(container);
    };

    appendVictoryText("victory-text1", "GG!");
    appendVictoryText("victory-text2", victoryText);

    const imageContainer = document.createElement("div");
    const image = document.createElement("img");
    image.className = "victory-pokemon-image";
    image.alt = `${pokemonDisplayName}${shiny ? " (Shiny)" : ""}`;
    image.style.animation = "fadeIn 500ms";
    image.src = victoryImageUrl;
    image.width = 180;
    image.height = 180;
    imageContainer.appendChild(image);
    content.appendChild(imageContainer);

    appendVictoryText("victory-text3", `You guessed it in ${tries} tries...`);
    appendVictoryText("victory-text5", pokedollarsText);
    appendVictoryText("victory-text4", "Think you can do better? Let's see!");

    const homeLink = document.createElement("a");
    homeLink.setAttribute("aria-label", "Go to Home");
    homeLink.href = "/";
    const continueButton = document.createElement("button");
    continueButton.id = "continue-button";
    continueButton.textContent = "Continue";
    homeLink.appendChild(continueButton);
    content.appendChild(homeLink);
  }, delay);
}
