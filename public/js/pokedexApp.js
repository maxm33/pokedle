import { pokemons } from "./pokemons.js";
import { auth } from "./auth.js";
import { getPokemonDisplayName, getPokemonSlug } from "./pokemonNames.js";

const normalizeName = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]/g, "");

function getPokemonAnimationUrl(name, shiny = false) {
  return `/public/images/animations/${encodeURIComponent(
    `${name.toLowerCase()}${shiny ? "_shiny" : ""}`,
  )}.gif`;
}

function parseHistoryDate(dateString) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(dateString || "");
  if (!match) return null;
  const [day, month, year] = match.slice(1).map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCDate() !== day ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCFullYear() !== year
  )
    return null;
  return timestamp;
}

function getGeneration(id) {
  if (id <= 151) return "Generation I";
  if (id <= 251) return "Generation II";
  if (id <= 386) return "Generation III";
  if (id <= 493) return "Generation IV";
  return "Generation V";
}

function showDescriptionError(error) {
  console.error(error);
  document.getElementById("dex-error").textContent =
    "Pokédex descriptions could not be loaded. Please try again later.";
  document.getElementById("dex-error").hidden = false;
  document.getElementById("dex-pokemon-link").textContent =
    "Pokédex unavailable";
}

async function revealTodaysPokemon(history) {
  const secretIndex = history.findIndex(
    (entry) => entry.pokemon === "SECRET_TODAY",
  );
  if (secretIndex === -1) return;

  await auth.authStateReady();
  try {
    const guestId = localStorage
      .getItem("userID")
      ?.replace(/^["']|["']$/g, "");
    const token = auth.currentUser
      ? await auth.currentUser.getIdToken()
      : null;
    const response = await axios.get("/classic/today", {
      params: { guestId },
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    history[secretIndex].pokemon = response.data.pokemon;
  } catch (error) {
    history.splice(secretIndex, 1);
  }
}

async function initializePokedex() {
  const history = window.pokedexHistory ? [...window.pokedexHistory] : [];
  await revealTodaysPokemon(history);

  let rawDescriptions;
  try {
    const response = await fetch("/public/data/pokedexDescriptions.json");
    if (!response.ok)
      throw new Error(`Unable to load Pokédex descriptions: ${response.status}`);
    rawDescriptions = await response.json();
  } catch (error) {
    showDescriptionError(error);
    return;
  }

  const descriptions = new Map(
    Object.entries(rawDescriptions).map(([name, description]) => [
      normalizeName(name),
      description,
    ]),
  );
  const missingDescriptions = pokemons.filter(
    (name) => !descriptions.has(normalizeName(name)),
  );
  if (missingDescriptions.length > 0) {
    showDescriptionError(
      new Error(
        `Missing Pokédex descriptions for: ${missingDescriptions.join(", ")}`,
      ),
    );
    return;
  }

  const historyByPokemon = new Map(
    history.map((entry) => [entry.pokemon, entry]),
  );
  const discoveredPokemon = new Set(historyByPokemon.keys());
  const latestDate = history.reduce((latest, entry) => {
    const date = parseHistoryDate(entry.date);
    return date !== null && (latest === null || date > latest) ? date : latest;
  }, null);
  const records = pokemons.map((name, index) => ({
    id: index + 1,
    name,
    displayName: getPokemonDisplayName(name),
    history: historyByPokemon.get(name),
  }));
  let visibleRecords = [];
  let currentIndex = -1;
  let showShiny = false;

  const elements = {
    generation: document.getElementById("dex-generation"),
    description: document.getElementById("dex-description"),
    status: document.getElementById("dex-status"),
    guesses: document.getElementById("dex-guesses"),
    date: document.getElementById("dex-date"),
    discovered: document.getElementById("dex-discovered"),
    sprite: document.getElementById("dex-sprite"),
    new: document.getElementById("dex-new"),
    position: document.getElementById("dex-entry-position"),
    previous: document.getElementById("dex-previous"),
    next: document.getElementById("dex-next"),
    shinyToggle: document.getElementById("dex-shiny-toggle"),
    hideUndiscovered: document.getElementById("hide-undiscovered"),
    sortLatest: document.getElementById("sort-latest"),
    shinyOnly: document.getElementById("shiny-only"),
  };

  document.getElementById("dex-profile-link").href =
    window.location.pathname.replace(/\/pokedex\/?$/, "/profile");

  function getVisibleRecords() {
    const filtered = records.filter((record) => {
      const discovered = discoveredPokemon.has(record.name);
      return (
        (!elements.hideUndiscovered.checked || discovered) &&
        (!elements.shinyOnly.checked || record.history?.shiny === true)
      );
    });
    if (elements.sortLatest.checked) {
      filtered.sort((left, right) => {
        const leftDate = left.history
          ? parseHistoryDate(left.history.date)
          : null;
        const rightDate = right.history
          ? parseHistoryDate(right.history.date)
          : null;
        if (leftDate !== rightDate) {
          if (leftDate === null) return 1;
          if (rightDate === null) return -1;
          return rightDate - leftDate;
        }
        return left.id - right.id;
      });
    }
    return filtered;
  }

  function renderRecord() {
    const record = visibleRecords[currentIndex];
    const hasRecord = record !== undefined;
    elements.previous.disabled = !hasRecord || currentIndex === 0;
    elements.next.disabled =
      !hasRecord || currentIndex === visibleRecords.length - 1;

    if (!hasRecord) {
      showShiny = false;
      document.getElementById("dex-pokemon-number").textContent = "";
      const pokemonLink = document.getElementById("dex-pokemon-link");
      pokemonLink.removeAttribute("href");
      pokemonLink.classList.remove("dex-unknown-text");
      pokemonLink.textContent = "No Pokémon match these filters";
      elements.generation.textContent = "";
      elements.description.textContent = "";
      elements.description.classList.remove("dex-unknown-text");
      elements.status.textContent = "No matching entries";
      elements.guesses.textContent = "—";
      elements.date.textContent = "—";
      elements.sprite.src = "/public/images/sprites/unknown.webp";
      elements.sprite.alt = "";
      elements.new.hidden = true;
      elements.position.textContent = "0 / 0";
      elements.shinyToggle.hidden = true;
      return;
    }

    const entry = record.history;
    const shiny = entry?.shiny === true;
    const date = entry ? parseHistoryDate(entry.date) : null;
    showShiny = elements.shinyOnly.checked && shiny;
    const pokemonLink = document.getElementById("dex-pokemon-link");
    document.getElementById("dex-pokemon-number").textContent =
      `#${String(record.id).padStart(3, "0")}`;
    pokemonLink.classList.toggle("dex-unknown-text", !entry);
    elements.description.classList.toggle("dex-unknown-text", !entry);
    pokemonLink.textContent = entry
      ? record.displayName
      : record.displayName.toLowerCase();
    if (entry) {
      pokemonLink.href = `https://www.pokemon.com/it/pokedex/${getPokemonSlug(record.name)}`;
    } else {
      pokemonLink.removeAttribute("href");
    }
    elements.generation.textContent = getGeneration(record.id);
    const description = descriptions.get(normalizeName(record.name));
    elements.description.textContent = entry
      ? description
      : description.toLowerCase();
    elements.status.textContent = entry ? "Discovered" : "Not discovered";
    elements.guesses.textContent = entry ? String(entry.timesGuessed) : "—";
    elements.date.textContent = entry?.date || "—";
    elements.discovered.textContent = `${history.length}/${records.length}`;
    elements.sprite.src = entry
      ? getPokemonAnimationUrl(record.name, showShiny)
      : "/public/images/sprites/unknown.webp";
    elements.sprite.alt = entry ? record.displayName : "Undiscovered Pokémon";
    elements.new.hidden =
      !(entry?.timesGuessed === 1 && latestDate !== null && date === latestDate);
    elements.position.textContent =
      `${currentIndex + 1} / ${visibleRecords.length}`;
    elements.shinyToggle.hidden = !shiny;
    elements.shinyToggle.setAttribute("aria-pressed", String(showShiny));
    elements.shinyToggle.textContent = showShiny
      ? "Show base sprite"
      : "Show shiny sprite";
  }

  function updateVisibleRecords(resetToFirst = false) {
    const currentRecord = visibleRecords[currentIndex];
    visibleRecords = getVisibleRecords();
    if (resetToFirst || visibleRecords.length === 0) {
      currentIndex = visibleRecords.length > 0 ? 0 : -1;
    } else if (currentRecord) {
      const preservedIndex = visibleRecords.findIndex(
        (record) => record.name === currentRecord.name,
      );
      currentIndex = preservedIndex >= 0 ? preservedIndex : 0;
    } else {
      currentIndex = 0;
    }
    renderRecord();
  }

  function navigate(direction) {
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= visibleRecords.length) return;
    currentIndex = nextIndex;
    renderRecord();
  }

  elements.previous.addEventListener("click", () => navigate(-1));
  elements.next.addEventListener("click", () => navigate(1));
  elements.shinyToggle.addEventListener("click", () => {
    const record = visibleRecords[currentIndex];
    if (!record?.history?.shiny) return;
    showShiny = !showShiny;
    elements.sprite.src = getPokemonAnimationUrl(record.name, showShiny);
    elements.sprite.alt =
      `${record.displayName}${showShiny ? " (Shiny)" : ""}`;
  });
  for (const filter of [
    elements.hideUndiscovered,
    elements.sortLatest,
    elements.shinyOnly,
  ]) {
    filter.addEventListener("change", () => updateVisibleRecords(true));
  }
  document.addEventListener("keydown", (event) => {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLButtonElement ||
      event.target instanceof HTMLAnchorElement
    )
      return;
    if (event.key === "ArrowLeft") navigate(-1);
    if (event.key === "ArrowRight") navigate(1);
  });

  updateVisibleRecords();
  const dexDevice = document.getElementById("dex-device");
  dexDevice.style.visibility = "visible";
  dexDevice.classList.add("fadeIn");
}

initializePokedex();
