function createShopDiscountService({ state, shopBackgrounds, overlayItems, companionItems, boostItems }) {
  function generateShopDiscounts() {
    state.shopDiscounts = {};
    const allItems = [
      ...shopBackgrounds,
      ...overlayItems,
      ...companionItems,
      ...boostItems,
    ];
    for (const item of allItems) {
      if (item.purchasable !== false && Math.random() < 0.25) {
        const discountPercent = Math.floor(Math.random() * 31) + 20;
        state.shopDiscounts[item.id] = discountPercent;
      }
    }
  }

  return { generateShopDiscounts };
}

module.exports = createShopDiscountService;
