import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth } from "./auth.js";

const wallet = document.getElementById("shop-wallet");
const walletLoader = document.getElementById("shop-wallet-loader");
const status = document.getElementById("shop-status");
const items = document.getElementById("shop-items");
const emptyState = document.getElementById("shop-empty-state");
const inventoryCount = document.getElementById("shop-inventory-count");
const marketplaceTab = document.getElementById("shop-marketplace-tab");
const inventoryTab = document.getElementById("shop-inventory-tab");
let currentUser = null;
let shopState = null;
let requestPending = false;
let activeTab = "marketplace";

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  shopState = null;
  setWalletLoading(true);
  if (!user) {
    setWalletLoading(false);
    wallet.textContent = "0";
    status.textContent = "";
    renderShop();
    return;
  }

  renderShop();
  await loadShopState(user);
});

marketplaceTab.addEventListener("click", () => {
  activeTab = "marketplace";
  renderShop();
});

inventoryTab.addEventListener("click", () => {
  activeTab = "inventory";
  renderShop();
});

items.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  const user = currentUser;
  if (!button || !user || !shopState || requestPending) return;

  const backgroundId = button.dataset.backgroundId;
  const action = button.dataset.action;
  if (
    action === "purchase" &&
    getPokedollars() < Number(button.dataset.price)
  )
    return;
  requestPending = true;
  renderShop();
  status.textContent = "";

  try {
    const token = await user.getIdToken();
    const headers = { Authorization: `Bearer ${token}` };
    if (action === "purchase") {
      await axios.post("/shop/purchase", { backgroundId }, { headers });
      status.textContent = "Background added to your inventory.";
    } else {
      const nextBackground = action === "unequip" ? null : backgroundId;
      await axios.patch(
        "/shop/equipped-background",
        { backgroundId: nextBackground },
        { headers },
      );
      status.textContent = nextBackground
        ? "Profile background updated."
        : "Profile background reset.";
    }
    await loadShopState(user);
  } catch (error) {
    console.error(error);
    if (currentUser?.uid !== user.uid) return;
    status.textContent =
      error.response?.data?.error ||
      "Unable to update the shop. Please try again.";
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
    wallet.textContent = "Unavailable";
    status.textContent =
      error.response?.data?.error ||
      "Unable to load the shop. Please try again.";
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

function renderShop() {
  const ownedBackgrounds = shopState?.ownedBackgrounds ?? [];
  inventoryCount.textContent = String(ownedBackgrounds.length);
  marketplaceTab.classList.toggle("is-active", activeTab === "marketplace");
  inventoryTab.classList.toggle("is-active", activeTab === "inventory");
  marketplaceTab.setAttribute(
    "aria-pressed",
    String(activeTab === "marketplace"),
  );
  inventoryTab.setAttribute("aria-pressed", String(activeTab === "inventory"));

  let visibleCount = 0;
  items.querySelectorAll(".shop-item").forEach((item) => {
    const backgroundId = item.dataset.backgroundId;
    const button = item.querySelector(".shop-item-action");
    const owned = ownedBackgrounds.includes(backgroundId);
    const equipped = shopState?.equippedBackground === backgroundId;
    const purchasable = item.dataset.purchasable === "true";
    const visible = activeTab === "marketplace" ? purchasable && !owned : owned;
    item.hidden = !visible;
    if (!visible) return;
    visibleCount++;

    if (owned) {
      button.dataset.action = equipped ? "unequip" : "equip";
      button.textContent = equipped
        ? "Using on profile (Reset)"
        : "Set as profile background";
    } else {
      button.dataset.action = "purchase";
      button.textContent = `Buy`;
    }
    const price = Number(button.dataset.price);
    const cannotAfford =
      button.dataset.action === "purchase" && getPokedollars() < price;
    button.disabled = !currentUser || !shopState || requestPending || cannotAfford;
  });

  emptyState.hidden = visibleCount > 0;
  if (visibleCount === 0)
    emptyState.textContent =
      activeTab === "marketplace"
        ? "The marketplace is completely sold out!"
        : "Your inventory is empty. Go buy some backgrounds!";
}
