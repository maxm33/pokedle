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

  let activeSort = "default";
  let discountOnlyActive = false;
  let inventoryCategory = null;

  function updateOptions() {
    const activeSection = getActiveSection();
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
      if (discountOnly) discountOnly.checked = false;
      inventoryCategory = null;
      activeSort = "default";
      discountOnlyActive = false;
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
        activeSort = "default";
      } else {
        activeSort = sortSelect?.value || "default";
        inventoryCategory = null;
      }
      discountOnlyActive = Boolean(discountOnly?.checked);
      onChange();
      closeDialog();
    });
  }

  return {
    updateOptions,
    get activeSort() {
      return activeSort;
    },
    get discountOnlyActive() {
      return discountOnlyActive;
    },
    get inventoryCategory() {
      return inventoryCategory;
    },
    get discountFilter() {
      return discountFilter;
    },
  };
}
