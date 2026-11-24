const sortValueCache = new WeakMap();

function getShopItemSortValues(item, sort) {
  if (!sortValueCache.has(item)) sortValueCache.set(item, new Map());
  const itemCache = sortValueCache.get(item);
  if (itemCache.has(sort)) return itemCache.get(sort);

  let values;
  if (sort.startsWith("price")) {
    values = {
      price: Number(item.querySelector(".shop-item-action")?.dataset.price || 0),
    };
  } else {
    values = {
      publishedAt: Date.parse(item.dataset.publishedAt || ""),
      publishedOrder: Number(item.dataset.publishedOrder || 0),
    };
  }
  itemCache.set(sort, values);
  return values;
}

export function sortShopItems(items, sort) {
  const keyedItems = items.map((item, index) => ({
    item,
    index,
    ...getShopItemSortValues(item, sort),
  }));

  keyedItems.sort((left, right) => {
    let comparison;
    if (sort.startsWith("price")) {
      comparison =
        sort === "price-asc"
          ? left.price - right.price
          : right.price - left.price;
    } else if (
      Number.isFinite(left.publishedAt) &&
      Number.isFinite(right.publishedAt)
    ) {
      comparison =
        sort === "date-asc"
          ? left.publishedAt - right.publishedAt
          : right.publishedAt - left.publishedAt;
    } else {
      comparison =
        sort === "date-asc"
          ? left.publishedOrder - right.publishedOrder
          : right.publishedOrder - left.publishedOrder;
    }

    return comparison || left.index - right.index;
  });

  return keyedItems.map(({ item }) => item);
}

export function orderShopInventory(items) {
  const boostItems = items.filter((item) => item.dataset.itemType === "boost");
  const otherItems = items.filter((item) => item.dataset.itemType !== "boost");
  return [...boostItems, ...otherItems];
}

