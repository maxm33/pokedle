import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth } from "./auth.js";

const wallet = document.getElementById("shop-wallet");
const walletLoader = document.getElementById("shop-wallet-loader");
const items = document.getElementById("shop-items");
const emptyState = document.getElementById("shop-empty-state");
const inventoryCount = document.getElementById("shop-inventory-count");
const sectionTabs = document.querySelectorAll("[data-shop-section]");
const searchInput = document.getElementById("shop-search");
const inventoryButton = document.getElementById("inventory-button");
const filterButton = document.getElementById("shop-filter-button");
const filterDialog = document.getElementById("shop-filter-dialog");
const filterForm = document.getElementById("shop-filter-form");
const filterClose = document.getElementById("shop-filter-close");
const filterReset = document.getElementById("shop-filter-reset");
const sortSelect = document.getElementById("shop-sort");
const discountOnly = document.getElementById("shop-discount-only");
const discountFilter = document.getElementById("shop-discount-filter");
const sortLabel = document.getElementById("shop-sort-label");
let currentUser = null;
let shopState = null;
let requestPending = false;
let activeSection = "background";
let activeSort = "default";
let discountOnlyActive = false;
let inventoryCategory = null;

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

function updateFilterOptions() {
  if (!sortSelect) return;

  if (activeSection === "inventory") {
    if (sortLabel) sortLabel.textContent = "Inventory filter";
    sortSelect.innerHTML =
      '<option value="all">All items</option>' +
      '<option value="background">Backgrounds</option>' +
      '<option value="overlay">Overlays</option>' +
      '<option value="companion">Companions</option>' +
      '<option value="boost">Boosts</option>';
    sortSelect.value = inventoryCategory || "all";
  } else {
    if (sortLabel) sortLabel.textContent = "Sort items";
    sortSelect.innerHTML =
      '<option value="default">Default order</option>' +
      '<option value="price-asc">Price: lowest to highest</option>' +
      '<option value="price-desc">Price: highest to lowest</option>' +
      '<option value="date-asc">Date: oldest first</option>' +
      '<option value="date-desc">Date: newest first</option>';
    sortSelect.value = activeSort;
  }
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

if (filterButton && filterDialog) {
  filterButton.addEventListener("click", () => {
    filterButton.setAttribute("aria-expanded", "true");
    if (discountFilter) {
      discountFilter.hidden = activeSection === "inventory";
    }
    updateFilterOptions();
    if (typeof filterDialog.showModal === "function") {
      filterDialog.showModal();
    } else {
      filterDialog.setAttribute("open", "");
    }
  });
}

function closeFilterDialog() {
  if (typeof filterDialog?.close === "function") {
    filterDialog.close();
  } else {
    filterDialog?.removeAttribute("open");
    filterButton?.setAttribute("aria-expanded", "false");
  }
}

if (filterClose && filterDialog) {
  filterClose.addEventListener("click", closeFilterDialog);
}

if (filterDialog) {
  filterDialog.addEventListener("close", () => {
    filterButton?.setAttribute("aria-expanded", "false");
  });
  filterDialog.addEventListener("click", (event) => {
    if (event.target === filterDialog) closeFilterDialog();
  });
}

if (filterReset) {
  filterReset.addEventListener("click", () => {
    if (discountOnly) discountOnly.checked = false;
    inventoryCategory = null;
    activeSort = "default";
    discountOnlyActive = false;
    updateFilterOptions();
    renderShop();
    closeFilterDialog();
  });
}

if (filterForm) {
  filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (activeSection === "inventory") {
      inventoryCategory =
        sortSelect?.value && sortSelect.value !== "all"
          ? sortSelect.value
          : null;
      activeSort = "default";
    } else {
      activeSort = sortSelect?.value || "default";
      inventoryCategory = null;
    }
    discountOnlyActive = Boolean(discountOnly?.checked);
    renderShop();
    closeFilterDialog();
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
  let purchaseSucceeded = false;

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
        purchaseSucceeded = true;
      } else {
        const nextBackground = action === "unequip" ? null : itemId;
        await axios.patch(
          "/shop/equipped-background",
          { backgroundId: nextBackground },
          { headers },
        );
      }
    } else if (type === "boost") {
      if (action === "purchase") {
        await axios.post("/shop/boost/purchase", { itemId }, { headers });
        purchaseSucceeded = true;
      } else if (action === "activate") {
        await axios.post("/shop/boost/activate", { itemId }, { headers });
      }
    } else if (action === "purchase") {
      await axios.post(
        "/shop/collectibles/purchase",
        { type, itemId },
        { headers },
      );
      purchaseSucceeded = true;
    } else {
      const nextItem = action === "unequip" ? null : itemId;
      await axios.patch(
        "/shop/collectibles/equipped",
        { type, itemId: nextItem },
        { headers },
      );
    }
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

function getOwnedBoostCount(itemId) {
  const quantity = shopState?.boostInventory?.[itemId];
  return Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 0;
}

function isBoostActive(itemId) {
  if (!shopState) return false;
  if (itemId === "boost-master-ball") {
    return Boolean(shopState.masterBallBoostActive);
  }
  if (itemId === "boost-double-earnings") {
    return (shopState.doubleEarningsRemainingDays || 0) > 0;
  }
  return false;
}

function renderShop() {
  updateFilterOptions();
  if (discountFilter) {
    discountFilter.hidden = activeSection === "inventory";
  }
  const ownedBoostsCount =
    getOwnedBoostCount("boost-master-ball") +
    getOwnedBoostCount("boost-double-earnings");
  const activeBoostsCount =
    (isBoostActive("boost-master-ball") ? 1 : 0) +
    (isBoostActive("boost-double-earnings") ? 1 : 0);
  const totalOwned =
    getOwnedItems("background").length +
    getOwnedItems("overlay").length +
    getOwnedItems("companion").length +
    ownedBoostsCount +
    activeBoostsCount;
  inventoryCount.textContent = String(totalOwned);
  if (inventoryButton) {
    const isInventoryActive = activeSection === "inventory";
    inventoryButton.classList.toggle("is-active", isInventoryActive);
    inventoryButton.setAttribute("aria-pressed", String(isInventoryActive));
  }
  sectionTabs.forEach((tab) => {
    const selected = tab.dataset.shopSection === activeSection;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-pressed", String(selected));
  });

  const searchQuery = searchInput ? searchInput.value.trim().toLowerCase() : "";
  let visibleCount = 0;
  const shopItems = Array.from(items.querySelectorAll(".shop-item"));
  shopItems.forEach((item) => {
    const itemId = item.dataset.itemId;
    const type = item.dataset.itemType;
    const button = item.querySelector(".shop-item-action");
    const priceDisplay = item.querySelector(".shop-price");
    const boostQuantity = item.querySelector(".shop-boost-quantity");
    const titleElement = item.querySelector("h2");
    const itemName = titleElement ? titleElement.textContent.toLowerCase() : "";
    const matchesSearch = itemName.includes(searchQuery);
    const matchesDiscount =
      !discountOnlyActive || item.dataset.discounted === "true";

    if (type === "boost") {
      const active = isBoostActive(itemId);
      const quantity = getOwnedBoostCount(itemId);
      const inInventory = activeSection === "inventory";
      const visible =
        (inInventory ? active || quantity > 0 : activeSection === "boost") &&
        matchesSearch &&
        matchesDiscount &&
        (!inInventory ||
          inventoryCategory === null ||
          inventoryCategory === "boost");

      item.hidden = !visible;
      if (!visible) return;
      visibleCount++;

      if (priceDisplay) {
        priceDisplay.style.display = inInventory ? "none" : "";
      }
      if (boostQuantity) {
        boostQuantity.hidden = !inInventory;
        boostQuantity.textContent = `Quantity: ${quantity}`;
      }

      if (itemId === "boost-double-earnings" && titleElement) {
        if (inInventory && active) {
          const daysLeft = shopState.doubleEarningsRemainingDays || 0;
          titleElement.textContent = `2x Earnings (${daysLeft} ${
            daysLeft === 1 ? "day" : "days"
          } left)`;
        } else {
          titleElement.textContent = "2x Earnings (7 Days)";
        }
      } else if (itemId === "boost-master-ball" && titleElement) {
        titleElement.textContent = "Master Ball Upgrade";
      }

      button.dataset.action = inInventory
        ? quantity > 0
          ? "activate"
          : "active"
        : "purchase";
      button.textContent = inInventory
        ? active
          ? "Already active"
          : "Activate"
        : "Buy";

      const price = Number(button.dataset.price);
      const cannotAfford =
        button.dataset.action === "purchase" && getPokedollars() < price;

      button.disabled =
        !currentUser ||
        !shopState ||
        requestPending ||
        cannotAfford ||
        (inInventory && (quantity === 0 || active));
      return;
    }

    const owned = getOwnedItems(type).includes(itemId);
    const equipped = getEquippedItem(type) === itemId;
    const purchasable = item.dataset.purchasable === "true";
    const visible =
      (activeSection === "inventory"
        ? owned
        : type === activeSection && purchasable && !owned) &&
      matchesSearch &&
      matchesDiscount &&
      (activeSection !== "inventory" ||
        inventoryCategory === null ||
        inventoryCategory === type);
    item.hidden = !visible;
    if (!visible) return;
    visibleCount++;

    if (priceDisplay) {
      priceDisplay.style.display = activeSection === "inventory" ? "none" : "";
    }

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

  const visibleItems = shopItems.filter((item) => !item.hidden);
  if (activeSort !== "default") {
    visibleItems.sort((left, right) => {
      if (activeSort.startsWith("price")) {
        const leftPrice = Number(
          left.querySelector(".shop-item-action")?.dataset.price || 0,
        );
        const rightPrice = Number(
          right.querySelector(".shop-item-action")?.dataset.price || 0,
        );
        return activeSort === "price-asc"
          ? leftPrice - rightPrice
          : rightPrice - leftPrice;
      }

      const leftDate = Date.parse(left.dataset.publishedAt || "");
      const rightDate = Date.parse(right.dataset.publishedAt || "");
      if (Number.isFinite(leftDate) && Number.isFinite(rightDate)) {
        return activeSort === "date-asc"
          ? leftDate - rightDate
          : rightDate - leftDate;
      }
      const leftOrder = Number(left.dataset.publishedOrder || 0);
      const rightOrder = Number(right.dataset.publishedOrder || 0);
      return activeSort === "date-asc"
        ? leftOrder - rightOrder
        : rightOrder - leftOrder;
    });
  }

  let orderedItems = visibleItems;
  if (activeSection === "inventory") {
    const boostItems = visibleItems.filter(
      (item) => item.dataset.itemType === "boost",
    );
    const otherItems = visibleItems.filter(
      (item) => item.dataset.itemType !== "boost",
    );
    orderedItems = [...boostItems, ...otherItems];
  }
  orderedItems.forEach((item, index) => {
    item.style.order = String(index);
  });

  emptyState.hidden = visibleCount > 0;
  if (visibleCount === 0) {
    if (searchQuery) {
      emptyState.textContent = "No items match your search.";
    } else {
      emptyState.textContent =
        activeSection === "inventory"
          ? "Your inventory is empty."
          : `No ${activeSection} items are available.`;
    }
  }
}
