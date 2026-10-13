import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth } from "./auth.js";

const wallet = document.getElementById("shop-wallet");
const walletLoader = document.getElementById("shop-wallet-loader");
const items = document.getElementById("shop-items");
const emptyState = document.getElementById("shop-empty-state");
const inventoryCount = document.getElementById("shop-inventory-count");
const sectionTabs = document.querySelectorAll("[data-shop-section]");
let currentUser = null;
let shopState = null;
let requestPending = false;
let activeSection = "background";

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
});

sectionTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    activeSection = tab.dataset.shopSection;
    renderShop();
  });
});

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
    const token = await user.getIdToken();
    const headers = { Authorization: `Bearer ${token}` };
    if (type === "background") {
      if (action === "purchase") {
        await axios.post(
          "/shop/purchase",
          { backgroundId: itemId },
          { headers },
        );
      } else {
        const nextBackground = action === "unequip" ? null : itemId;
        await axios.patch(
          "/shop/equipped-background",
          { backgroundId: nextBackground },
          { headers },
        );
      }
    } else if (action === "purchase") {
      await axios.post(
        "/shop/collectibles/purchase",
        { type, itemId },
        { headers },
      );
    } else {
      const nextItem = action === "unequip" ? null : itemId;
      await axios.patch(
        "/shop/collectibles/equipped",
        { type, itemId: nextItem },
        { headers },
      );
    }
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
    const token = await user.getIdToken();
    const response = await axios.get("/shop/state", {
      headers: { Authorization: `Bearer ${token}` },
    });
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
  } finally {
    renderShop();
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

function getOwnedItems(type) {
  if (!shopState) return [];
  return (
    shopState[
      type === "background"
        ? "ownedBackgrounds"
        : type === "overlay"
          ? "ownedOverlays"
          : "ownedCompanions"
    ] ?? []
  );
}

function getEquippedItem(type) {
  return shopState?.[
    type === "background"
      ? "equippedBackground"
      : type === "overlay"
        ? "equippedOverlay"
        : "equippedCompanion"
  ];
}

function renderShop() {
  const totalOwned =
    getOwnedItems("background").length +
    getOwnedItems("overlay").length +
    getOwnedItems("companion").length;
  inventoryCount.textContent = String(totalOwned);
  sectionTabs.forEach((tab) => {
    const selected = tab.dataset.shopSection === activeSection;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-pressed", String(selected));
  });

  let visibleCount = 0;
  items.querySelectorAll(".shop-item").forEach((item) => {
    const itemId = item.dataset.itemId;
    const type = item.dataset.itemType;
    const button = item.querySelector(".shop-item-action");
    const owned = getOwnedItems(type).includes(itemId);
    const equipped = getEquippedItem(type) === itemId;
    const purchasable = item.dataset.purchasable === "true";
    const visible =
      activeSection === "inventory"
        ? owned
        : type === activeSection && purchasable && !owned;
    item.hidden = !visible;
    if (!visible) return;
    visibleCount++;

    button.dataset.action = owned
      ? equipped
        ? "unequip"
        : "equip"
      : "purchase";
    button.textContent = owned ? (equipped ? "Remove" : "Use") : "Buy";
    const price = Number(button.dataset.price);
    const cannotAfford =
      button.dataset.action === "purchase" && getPokedollars() < price;
    button.disabled =
      !currentUser || !shopState || requestPending || cannotAfford;
  });

  emptyState.hidden = visibleCount > 0;
  if (visibleCount === 0)
    emptyState.textContent =
      activeSection === "inventory"
        ? "Your inventory is empty."
        : `No ${activeSection} items are available.`;
}
