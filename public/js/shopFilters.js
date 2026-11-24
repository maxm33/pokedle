export function createShopFilterController({ getActiveSection, onChange }) {
  const filterButton = document.getElementById("shop-filter-button");
  const filterDialog = document.getElementById("shop-filter-dialog");
  const filterForm = document.getElementById("shop-filter-form");
  const filterClose = document.getElementById("shop-filter-close");
  const filterReset = document.getElementById("shop-filter-reset");
  const sortSelect = document.getElementById("shop-sort");
  const discountOnly = document.getElementById("shop-discount-only");
  const discountFilter = document.getElementById("shop-discount-filter");
  const sortLabel = document.getElementById("shop-sort-label");
  const filterTitle = document.getElementById("shop-filter-title");

  let shopSort = "default";
  let shopDiscountOnlyActive = false;
  let inventoryCategory = null;
  let optionMode = null;

  function updateOptions() {
    const activeSection = getActiveSection();
    const hasActiveFilter =
      activeSection === "inventory"
        ? inventoryCategory !== null
        : shopSort !== "default" || shopDiscountOnlyActive;
    filterButton?.classList.toggle("is-active", hasActiveFilter);
    if (filterTitle)
      filterTitle.textContent =
        activeSection === "inventory" ? "Filter Items" : "Sort Items";
    if (!sortSelect) return;

    const nextOptionMode =
      activeSection === "inventory" ? "inventory" : "shop";
    if (optionMode !== nextOptionMode) {
      sortSelect.innerHTML =
        nextOptionMode === "inventory"
          ? '<option value="all">All items</option>' +
            '<option value="background">Backgrounds</option>' +
            '<option value="overlay">Overlays</option>' +
            '<option value="companion">Companions</option>' +
            '<option value="boost">Boosts</option>'
          : '<option value="default">Default order</option>' +
            '<option value="price-asc">Price: lowest to highest</option>' +
            '<option value="price-desc">Price: highest to lowest</option>' +
            '<option value="date-asc">Date: oldest first</option>' +
            '<option value="date-desc">Date: newest first</option>';
      optionMode = nextOptionMode;
    }

    if (nextOptionMode === "inventory") {
      if (discountOnly) discountOnly.checked = false;
      if (sortLabel) sortLabel.textContent = "Filter Items";
      sortSelect.value = inventoryCategory || "all";
    } else {
      if (discountOnly) discountOnly.checked = shopDiscountOnlyActive;
      if (sortLabel) sortLabel.textContent = "Sort Items";
      sortSelect.value = shopSort;
    }
  }

  function closeDialog() {
    if (typeof filterDialog?.close === "function") {
      filterDialog.close();
    } else {
      filterDialog?.removeAttribute("open");
      filterButton?.setAttribute("aria-expanded", "false");
    }
  }

  if (filterButton && filterDialog) {
    filterButton.addEventListener("click", () => {
      filterButton.setAttribute("aria-expanded", "true");
      if (discountFilter)
        discountFilter.hidden = getActiveSection() === "inventory";
      updateOptions();
      if (typeof filterDialog.showModal === "function") {
        filterDialog.showModal();
      } else {
        filterDialog.setAttribute("open", "");
      }
    });
  }

  if (filterClose && filterDialog)
    filterClose.addEventListener("click", closeDialog);

  if (filterDialog) {
    filterDialog.addEventListener("close", () => {
      filterButton?.setAttribute("aria-expanded", "false");
    });
    filterDialog.addEventListener("click", (event) => {
      if (event.target === filterDialog) closeDialog();
    });
  }

  if (filterReset) {
    filterReset.addEventListener("click", () => {
      if (getActiveSection() === "inventory") {
        inventoryCategory = null;
      } else {
        shopSort = "default";
        shopDiscountOnlyActive = false;
      }
      updateOptions();
      onChange();
      closeDialog();
    });
  }

  if (filterForm) {
    filterForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (getActiveSection() === "inventory") {
        inventoryCategory =
          sortSelect?.value && sortSelect.value !== "all"
            ? sortSelect.value
            : null;
      } else {
        shopSort = sortSelect?.value || "default";
        shopDiscountOnlyActive = Boolean(discountOnly?.checked);
      }
      onChange();
      closeDialog();
    });
  }

  return {
    updateOptions,
    get activeSort() {
      return getActiveSection() === "inventory" ? "default" : shopSort;
    },
    get discountOnlyActive() {
      return getActiveSection() === "inventory"
        ? false
        : shopDiscountOnlyActive;
    },
    get inventoryCategory() {
      return getActiveSection() === "inventory" ? inventoryCategory : null;
    },
    get discountFilter() {
      return discountFilter;
    },
  };
}
