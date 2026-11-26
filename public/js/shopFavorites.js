import { STORAGE_KEYS } from "./storageKeys.js";

const STORAGE_KEY = STORAGE_KEYS.shopFavorites;
const ITEM_TYPES = new Set(["background", "overlay", "companion", "boost"]);

export function readShopFavorites() {
  const storedFavorites = window.localStorage.getItem(STORAGE_KEY);
  if (storedFavorites === null) return [];

  const favorites = JSON.parse(storedFavorites);
  if (!Array.isArray(favorites))
    throw new Error("Invalid saved shop favorites.");

  return favorites.filter(
    (favorite) =>
      favorite &&
      ITEM_TYPES.has(favorite.type) &&
      typeof favorite.itemId === "string" &&
      favorite.itemId.length > 0,
  );
}

export function isShopItemFavorite(favorites, type, itemId) {
  return favorites.some(
    (favorite) => favorite.type === type && favorite.itemId === itemId,
  );
}

export function toggleShopFavorite(favorites, type, itemId) {
  if (!ITEM_TYPES.has(type) || typeof itemId !== "string" || !itemId)
    throw new Error("Invalid shop favorite.");

  const isFavorite = isShopItemFavorite(favorites, type, itemId);
  const updatedFavorites = isFavorite
    ? favorites.filter(
        (favorite) => favorite.type !== type || favorite.itemId !== itemId,
      )
    : [...favorites, { type, itemId }];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedFavorites));
  return updatedFavorites;
}
