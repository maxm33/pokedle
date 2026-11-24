import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth } from "./auth.js";
import { createShopFilterController } from "./shopFilters.js";
import { fetchShopState, performShopAction } from "./shopApi.js";
import { createShopRenderer } from "./shopRenderer.js";
import { removeSavedProfilePresetsForItem } from "./profilePresetStorage.js";
import { readShopFavorites, toggleShopFavorite } from "./shopFavorites.js";
import { createShopAppState } from "./shopAppState.js";

const wallet = document.getElementById("shop-wallet");
const walletLoader = document.getElementById("shop-wallet-loader");
const items = document.getElementById("shop-items");
const emptyState = document.getElementById("shop-empty-state");
const inventoryCount = document.getElementById("shop-inventory-count");
const sectionTabs = document.querySelectorAll("[data-shop-section]");
const searchInput = document.getElementById("shop-search");
const inventoryButton = document.getElementById("inventory-button");
const favoritesFilterButton = document.getElementById(
  "shop-favorites-filter-button",
);
const scrollTopButton = document.getElementById("shop-scroll-top");
const topnav = document.getElementById("topnav");
const appState = createShopAppState(searchInput);
const shopFields = JSON.parse(document.body.dataset.shopFields || "{}");
const {
  state,
  getFavoritesOnly,
  setSearchQuery,
  switchSection,
  toggleFavoritesOnly,
} = appState;
try {
  state.favorites = readShopFavorites();
} catch (error) {
  console.error("Could not read shop favorites:", error);
}
const filters = createShopFilterController({
  getActiveSection: () => state.activeSection,
  onChange: () => renderShop(),
});
const renderShop = createShopRenderer({
  elements: {
    items,
    emptyState,
    inventoryCount,
    sectionTabs,
    searchInput,
    inventoryButton,
    favoritesFilterButton,
  },
  getState: () => ({
    currentUser: state.currentUser,
    shopState: state.shopState,
    requestPending: state.requestPending,
    activeSection: state.activeSection,
    favorites: state.favorites,
    favoritesOnly: getFavoritesOnly(),
  }),
  filters,
  getPokedollars,
  shopFields,
});
function showPurchaseCount(button, text, spending = false) {
  const { left, top, width } = button.getBoundingClientRect();
  const count = document.createElement("span");
  count.className = "shop-purchase-count";
  count.classList.toggle("is-spending", spending);
  count.textContent = text;
  count.setAttribute("aria-hidden", "true");
  count.style.left = `${left + width / 2}px`;
  count.style.top = `${top}px`;
  document.body.appendChild(count);
  window.setTimeout(() => count.remove(), 1250);
}

onAuthStateChanged(auth, async (user) => {
  state.currentUser = user;
  state.shopState = null;
  setWalletLoading(true);
  if (!user) {
    setWalletLoading(false);
    wallet.textContent = "0";
    renderShop();
    return;
  }

  await loadShopState(user);
  if (state.currentUser?.uid === user.uid) renderShop();
});

sectionTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    switchSection(tab.dataset.shopSection);
    renderShop();
  });
});

if (inventoryButton) {
  inventoryButton.addEventListener("click", () => {
    switchSection("inventory");
    renderShop();
  });
}

if (searchInput) {
  searchInput.addEventListener("input", () => {
    setSearchQuery(searchInput.value);
    renderShop();
  });
}

if (scrollTopButton) {
  const getScrollContainer = () => {
    const body = document.body;
    return body.scrollHeight > body.clientHeight &&
      window.getComputedStyle(body).overflowY !== "visible"
      ? body
      : document.scrollingElement || document.documentElement;
  };
  const updateScrollTopButton = () => {
    const scrollTop = Math.max(
      window.scrollY,
      document.body.scrollTop,
      document.documentElement.scrollTop,
    );
    const topnavBottom = topnav?.getBoundingClientRect().bottom || 0;
    scrollTopButton.style.top = `${Math.max(0, topnavBottom) + 8}px`;
    const isVisible = scrollTop > 160;
    scrollTopButton.classList.toggle("is-visible", isVisible);
    scrollTopButton.setAttribute("aria-hidden", String(!isVisible));
    scrollTopButton.tabIndex = isVisible ? 0 : -1;
  };

  window.addEventListener("scroll", updateScrollTopButton, { passive: true });
  document.body.addEventListener("scroll", updateScrollTopButton, {
    passive: true,
  });
  window.addEventListener("resize", updateScrollTopButton);
  scrollTopButton.addEventListener("click", () => {
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? "auto"
      : "smooth";
    getScrollContainer().scrollTo({ top: 0, behavior });
  });
  updateScrollTopButton();
}

if (favoritesFilterButton) {
  favoritesFilterButton.addEventListener("click", () => {
    toggleFavoritesOnly();
    renderShop();
  });
}

items.addEventListener("click", (event) => {
  const button = event.target.closest("button.shop-item-favorite");
  if (!button) return;

  try {
    state.favorites = toggleShopFavorite(
      state.favorites,
      button.dataset.itemType,
      button.dataset.itemId,
    );
    renderShop();
  } catch (error) {
    console.error("Could not update shop favorites:", error);
  }
});

items.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  const user = state.currentUser;
  if (!button || !user || !state.shopState || state.requestPending) return;

  const itemId = button.dataset.itemId;
  const type = button.dataset.itemType;
  const action = button.dataset.action;
  if (action === "purchase" && getPokedollars() < Number(button.dataset.price))
    return;
  state.requestPending = true;
  renderShop();
  try {
    const actionResult = await performShopAction(user, {
      type,
      itemId,
      action,
    });
    if (action === "purchase" && actionResult) {
      const spent = Number(button.dataset.price);
      if (Number.isSafeInteger(spent) && spent >= 0)
        showPurchaseCount(button, `-${spent}₽`, true);
    } else if (action === "sell" && Number.isSafeInteger(actionResult)) {
      showPurchaseCount(button, `+${actionResult}₽`);
      try {
        removeSavedProfilePresetsForItem(user.uid, type, itemId);
      } catch (error) {
        console.error(
          "Could not update saved profile configurations after sale:",
          error,
        );
      }
    }
    await loadShopState(user);
  } catch (error) {
    console.error(error);
    if (state.currentUser?.uid !== user.uid) return;
  } finally {
    state.requestPending = false;
    renderShop();
  }
});

async function loadShopState(user) {
  try {
    const response = await fetchShopState(user);
    if (state.currentUser?.uid !== user.uid) return;
    state.shopState = response.data;
    wallet.textContent = String(getPokedollars());
    setWalletLoading(false);
  } catch (error) {
    console.error(error);
    if (state.currentUser?.uid !== user.uid) return;
    state.shopState = null;
    setWalletLoading(false);
    wallet.textContent = "???";
  }
}

function getPokedollars() {
  const pokedollars = state.shopState?.pokedollars;
  return Number.isSafeInteger(pokedollars) && pokedollars >= 0
    ? pokedollars
    : 0;
}

function setWalletLoading(loading) {
  walletLoader.hidden = !loading;
  wallet.hidden = loading;
  wallet.parentElement.classList.toggle("is-loading", loading);
}
