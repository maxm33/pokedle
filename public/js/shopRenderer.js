import { compareShopItems, orderShopInventory } from "./shopCollection.js";

export function createShopRenderer({ elements, getState, filters, getPokedollars }) {
  const {
    items,
    emptyState,
    inventoryCount,
    sectionTabs,
    searchInput,
    inventoryButton,
  } = elements;

  function getOwnedItems(type) {
    const { shopState } = getState();
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
    const { shopState } = getState();
    return shopState?.[
      type === "background"
        ? "equippedBackground"
        : type === "overlay"
          ? "equippedOverlay"
          : "equippedCompanion"
    ];
  }

  function getOwnedBoostCount(itemId) {
    const { shopState } = getState();
    const quantity = shopState?.boostInventory?.[itemId];
    return Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 0;
  }

  function isBoostActive(itemId) {
    const { shopState } = getState();
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
    const { currentUser, shopState, requestPending, activeSection } = getState();
    filters.updateOptions();
    if (filters.discountFilter) {
      filters.discountFilter.hidden = activeSection === "inventory";
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
        !filters.discountOnlyActive || item.dataset.discounted === "true";

      if (type === "boost") {
        const active = isBoostActive(itemId);
        const quantity = getOwnedBoostCount(itemId);
        const inInventory = activeSection === "inventory";
        const streakMasterBallAvailable =
          itemId === "boost-master-ball" &&
          Boolean(shopState?.streakMasterBallUpcoming);
        const visible =
          (inInventory ? active || quantity > 0 : activeSection === "boost") &&
          matchesSearch &&
          matchesDiscount &&
          (!inInventory ||
            filters.inventoryCategory === null ||
            filters.inventoryCategory === "boost");

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
            : streakMasterBallAvailable
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
          (inInventory &&
            (quantity === 0 || active || streakMasterBallAvailable));
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
          filters.inventoryCategory === null ||
          filters.inventoryCategory === type);
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
    if (filters.activeSort !== "default") {
      visibleItems.sort((left, right) =>
        compareShopItems(left, right, filters.activeSort),
      );
    }

    let orderedItems = visibleItems;
    if (activeSection === "inventory") {
      orderedItems = orderShopInventory(visibleItems);
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

  return renderShop;
}
