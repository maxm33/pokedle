import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth } from "./auth.js";
import { createShopFilterController } from "./shopFilters.js";
import { fetchShopState, performShopAction } from "./shopApi.js";
import { createShopRenderer } from "./shopRenderer.js";

const wallet = document.getElementById("shop-wallet");
const walletLoader = document.getElementById("shop-wallet-loader");
const items = document.getElementById("shop-items");
const emptyState = document.getElementById("shop-empty-state");
const inventoryCount = document.getElementById("shop-inventory-count");
const sectionTabs = document.querySelectorAll("[data-shop-section]");
const searchInput = document.getElementById("shop-search");
const inventoryButton = document.getElementById("inventory-button");
let currentUser = null;
let shopState = null;
let requestPending = false;
let activeSection = "background";
const filters = createShopFilterController({
  getActiveSection: () => activeSection,
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
  },
  getState: () => ({ currentUser, shopState, requestPending, activeSection }),
  filters,
  getPokedollars,
});

function showPurchaseCount(button) {
  const { left, top, width } = button.getBoundingClientRect();
  const count = document.createElement("span");
  count.className = "shop-purchase-count";
  count.textContent = "+1";
  count.setAttribute("aria-hidden", "true");
  count.style.left = `${left + width / 2}px`;
  count.style.top = `${top}px`;
  document.body.appendChild(count);
  window.setTimeout(() => count.remove(), 1250);
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  shopState = null;
  setWalletLoading(true);
  if (!user) {
    setWalletLoading(false);
    wallet.textContent = "0";
    renderShop();
    return;
  }

  await loadShopState(user);
  if (currentUser?.uid === user.uid) renderShop();
});

sectionTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    activeSection = tab.dataset.shopSection;
    renderShop();
  });
});

if (inventoryButton) {
  inventoryButton.addEventListener("click", () => {
    activeSection = "inventory";
    renderShop();
  });
}

if (searchInput) {
  searchInput.addEventListener("input", () => {
    renderShop();
  });
}

items.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  const user = currentUser;
  if (!button || !user || !shopState || requestPending) return;

  const itemId = button.dataset.itemId;
  const type = button.dataset.itemType;
  const action = button.dataset.action;
  if (action === "purchase" && getPokedollars() < Number(button.dataset.price))
    return;
  requestPending = true;
  renderShop();
  try {
    const purchaseSucceeded = await performShopAction(user, {
      type,
      itemId,
      action,
    });
    if (purchaseSucceeded) showPurchaseCount(button);
    await loadShopState(user);
  } catch (error) {
    console.error(error);
    if (currentUser?.uid !== user.uid) return;
  } finally {
    requestPending = false;
    renderShop();
  }
});

async function loadShopState(user) {
  try {
    const response = await fetchShopState(user);
    if (currentUser?.uid !== user.uid) return;
    shopState = response.data;
    wallet.textContent = String(getPokedollars());
    setWalletLoading(false);
  } catch (error) {
    console.error(error);
    if (currentUser?.uid !== user.uid) return;
    shopState = null;
    setWalletLoading(false);
    wallet.textContent = "???";
  }
}

function getPokedollars() {
  const pokedollars = shopState?.pokedollars;
  return Number.isSafeInteger(pokedollars) && pokedollars >= 0
    ? pokedollars
    : 0;
}

function setWalletLoading(loading) {
  walletLoader.hidden = !loading;
  wallet.hidden = loading;
  wallet.parentElement.classList.toggle("is-loading", loading);
}
