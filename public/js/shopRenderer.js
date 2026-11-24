import {
  orderShopInventory,
  sortShopItems,
} from "./shopCollection.js";

export function createShopRenderer({ elements, getState, filters, getPokedollars, shopFields }) {
  const {
    items,
    emptyState,
    inventoryCount,
    sectionTabs,
    searchInput,
    inventoryButton,
    favoritesFilterButton,
  } = elements;

  function getOwnedItems(shopState, type) {
    if (!shopState) return [];
    const field = shopFields[type]?.owned;
    return field ? shopState[field] ?? [] : [];
  }

  function getEquippedItem(shopState, type) {
    const field = shopFields[type]?.equipped;
    return field ? shopState?.[field] : undefined;
  }

  function getOwnedBoostCount(shopState, itemId) {
    const quantity = shopState?.boostInventory?.[itemId];
    return Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 0;
  }

  function isBoostActive(shopState, itemId) {
    if (!shopState) return false;
    if (itemId === "boost-master-ball") {
      return Boolean(shopState.masterBallBoostActive);
    }
    if (itemId === "boost-double-earnings") {
      return (shopState.doubleEarningsRemainingDays || 0) > 0;
    }
    return false;
  }

  const itemViews = new Map();
  const shopItems = Array.from(items.querySelectorAll(".shop-item"));

  function getItemView(item) {
    if (!itemViews.has(item)) {
      itemViews.set(item, {
        button: item.querySelector(".shop-item-action"),
        favoriteButton: item.querySelector(".shop-item-favorite"),
        sellButton: item.querySelector(".shop-item-sell"),
        priceDisplay: item.querySelector(".shop-price"),
        boostQuantity: item.querySelector(".shop-boost-quantity"),
        titleElement: item.querySelector("h2"),
      });
    }
    return itemViews.get(item);
  }

  function getItemName(item) {
    return getItemView(item).titleElement?.textContent.toLowerCase() || "";
  }

  function renderShop() {
    const {
      currentUser,
      shopState,
      requestPending,
      activeSection,
      favorites,
      favoritesOnly,
    } = getState();
    const ownedBackgrounds = getOwnedItems(shopState, "background");
    const ownedOverlays = getOwnedItems(shopState, "overlay");
    const ownedCompanions = getOwnedItems(shopState, "companion");
    const ownedItemIdsByType = new Map([
      ["background", new Set(ownedBackgrounds)],
      ["overlay", new Set(ownedOverlays)],
      ["companion", new Set(ownedCompanions)],
    ]);
    const favoriteItemIdsByType = new Map();
    favorites.forEach(({ type, itemId }) => {
      if (!favoriteItemIdsByType.has(type))
        favoriteItemIdsByType.set(type, new Set());
      favoriteItemIdsByType.get(type).add(itemId);
    });
    items.classList.toggle("is-request-pending", requestPending);
    filters.updateOptions();
    if (filters.discountFilter) {
      filters.discountFilter.hidden = activeSection === "inventory";
    }
    const ownedBoostsCount =
      getOwnedBoostCount(shopState, "boost-master-ball") +
      getOwnedBoostCount(shopState, "boost-double-earnings");
    const activeBoostsCount =
      (isBoostActive(shopState, "boost-master-ball") ? 1 : 0) +
      (isBoostActive(shopState, "boost-double-earnings") ? 1 : 0);
    const totalOwned =
      ownedBackgrounds.length +
      ownedOverlays.length +
      ownedCompanions.length +
      ownedBoostsCount +
      activeBoostsCount;
    inventoryCount.textContent = String(totalOwned);
    if (favoritesFilterButton) {
      favoritesFilterButton.setAttribute("aria-pressed", String(favoritesOnly));
      favoritesFilterButton.setAttribute(
        "aria-label",
        favoritesOnly ? "Show all items" : "Show favorite items only",
      );
      favoritesFilterButton.title = favoritesOnly
        ? "Show all items"
        : "Show favorite items only";
    }
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
    const pokedollars = getPokedollars();
    let visibleCount = 0;
    shopItems.forEach((item) => {
      const itemId = item.dataset.itemId;
      const type = item.dataset.itemType;
      const {
        button,
        favoriteButton,
        sellButton,
        priceDisplay,
        boostQuantity,
        titleElement,
      } = getItemView(item);
      const itemName = getItemName(item);
      const matchesSearch = itemName.includes(searchQuery);
      const matchesDiscount =
        !filters.discountOnlyActive || item.dataset.discounted === "true";
      const favorite = favoriteItemIdsByType.get(type)?.has(itemId) || false;
      if (favoriteButton) {
        favoriteButton.setAttribute("aria-pressed", String(favorite));
        favoriteButton.setAttribute(
          "aria-label",
          `${favorite ? "Remove" : "Add"} ${titleElement?.textContent || "item"} ${
            favorite ? "from" : "to"
          } favorites`,
        );
        favoriteButton.title = favorite
          ? "Remove from favorites"
          : "Add to favorites";
      }
      const matchesFavorites = !favoritesOnly || favorite;

      if (type === "boost") {
        const active = isBoostActive(shopState, itemId);
        const quantity = getOwnedBoostCount(shopState, itemId);
        const inInventory = activeSection === "inventory";
        if (sellButton) {
          sellButton.hidden = !inInventory || quantity === 0;
          sellButton.disabled = !currentUser || !shopState || requestPending;
        }
        const streakMasterBallAvailable =
          itemId === "boost-master-ball" &&
          Boolean(shopState?.streakMasterBallUpcoming);
        const visible =
          (inInventory ? active || quantity > 0 : activeSection === "boost") &&
          matchesSearch &&
          matchesDiscount &&
          matchesFavorites &&
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
          button.dataset.action === "purchase" && pokedollars < price;

        button.disabled =
          !currentUser ||
          !shopState ||
          requestPending ||
          cannotAfford ||
          (inInventory &&
            (quantity === 0 || active || streakMasterBallAvailable));
        return;
      }

      const owned = ownedItemIdsByType.get(type)?.has(itemId) || false;
      const equipped = getEquippedItem(shopState, type) === itemId;
      const purchasable = item.dataset.purchasable === "true";
      if (sellButton) {
        sellButton.hidden = activeSection !== "inventory" || !owned;
        sellButton.disabled = !currentUser || !shopState || requestPending;
      }
      const visible =
        (activeSection === "inventory"
          ? owned
          : type === activeSection && purchasable && !owned) &&
        matchesSearch &&
        matchesDiscount &&
        matchesFavorites &&
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
        button.dataset.action === "purchase" && pokedollars < price;
      button.disabled =
        !currentUser || !shopState || requestPending || cannotAfford;
    });

    const visibleItems = shopItems.filter((item) => !item.hidden);
    const activeSort = filters.activeSort;
    let orderedItems =
      activeSort === "default"
        ? visibleItems
        : sortShopItems(visibleItems, activeSort);
    if (activeSection === "inventory") {
      orderedItems = orderShopInventory(orderedItems);
    }
    orderedItems.forEach((item, index) => {
      item.style.order = String(index);
    });

    emptyState.hidden = visibleCount > 0;
    if (visibleCount === 0) {
      if (searchQuery) {
        emptyState.textContent = "No items match your search.";
      } else if (favoritesOnly) {
        emptyState.textContent =
          activeSection === "inventory"
            ? "No favorite items in your inventory."
            : "No favorite items in this section.";
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
