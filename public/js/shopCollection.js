export function compareShopItems(left, right, sort) {
  if (sort.startsWith("price")) {
    const leftPrice = Number(left.querySelector(".shop-item-action")?.dataset.price || 0);
    const rightPrice = Number(right.querySelector(".shop-item-action")?.dataset.price || 0);
    return sort === "price-asc" ? leftPrice - rightPrice : rightPrice - leftPrice;
  }

  const leftDate = Date.parse(left.dataset.publishedAt || "");
  const rightDate = Date.parse(right.dataset.publishedAt || "");
  if (Number.isFinite(leftDate) && Number.isFinite(rightDate)) {
    return sort === "date-asc" ? leftDate - rightDate : rightDate - leftDate;
  }

  const leftOrder = Number(left.dataset.publishedOrder || 0);
  const rightOrder = Number(right.dataset.publishedOrder || 0);
  return sort === "date-asc"
    ? leftOrder - rightOrder
    : rightOrder - leftOrder;
}

export function orderShopInventory(items) {
  const boostItems = items.filter((item) => item.dataset.itemType === "boost");
  const otherItems = items.filter((item) => item.dataset.itemType !== "boost");
  return [...boostItems, ...otherItems];
}
