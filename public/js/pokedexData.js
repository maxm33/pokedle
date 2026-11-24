export function parseHistoryDate(dateString) {
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

export function getPokemonGeneration(id) {
  if (id <= 151) return "Generation I";
  if (id <= 251) return "Generation II";
  if (id <= 386) return "Generation III";
  if (id <= 493) return "Generation IV";
  return "Generation V";
}

export function filterAndSortPokedexRecords(
  records,
  discoveredPokemon,
  { hideUndiscovered, shinyOnly, sortLatest },
) {
  const filtered = records.filter((record) => {
    const discovered = discoveredPokemon.has(record.name);
    return (
      (!hideUndiscovered || discovered) &&
      (!shinyOnly || record.history?.shiny === true)
    );
  });
  if (sortLatest) {
    filtered.sort((left, right) => {
      if (left.historyDate !== right.historyDate) {
        if (left.historyDate === null) return 1;
        if (right.historyDate === null) return -1;
        return right.historyDate - left.historyDate;
      }
      return left.id - right.id;
    });
  }
  return filtered;
}
