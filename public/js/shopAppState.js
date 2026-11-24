export function createShopAppState(searchInput) {
  const state = {
    currentUser: null,
    shopState: null,
    requestPending: false,
    activeSection: "background",
    shopFavoritesOnly: false,
    inventoryFavoritesOnly: false,
    shopSearchQuery: "",
    inventorySearchQuery: "",
    favorites: [],
  };

  function getFavoritesOnly() {
    return state.activeSection === "inventory"
      ? state.inventoryFavoritesOnly
      : state.shopFavoritesOnly;
  }

  function switchSection(section) {
    if (state.activeSection === "inventory") {
      state.inventorySearchQuery = searchInput?.value || "";
    } else {
      state.shopSearchQuery = searchInput?.value || "";
    }
    state.activeSection = section;
    if (searchInput) {
      searchInput.value =
        state.activeSection === "inventory"
          ? state.inventorySearchQuery
          : state.shopSearchQuery;
    }
  }

  function setSearchQuery(value) {
    if (state.activeSection === "inventory") {
      state.inventorySearchQuery = value;
    } else {
      state.shopSearchQuery = value;
    }
  }

  function toggleFavoritesOnly() {
    if (state.activeSection === "inventory") {
      state.inventoryFavoritesOnly = !state.inventoryFavoritesOnly;
    } else {
      state.shopFavoritesOnly = !state.shopFavoritesOnly;
    }
  }

  return {
    state,
    getFavoritesOnly,
    setSearchQuery,
    switchSection,
    toggleFavoritesOnly,
  };
}
