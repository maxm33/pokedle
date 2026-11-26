const fs = require("fs");
const path = require("path");

function createShopItems(rootDirectory) {
  const shopBackgrounds = require("../data/shopBackgrounds.json");
  const shopOverlays = require("../data/shopOverlays.json");
  const companionPrice = 2400;
  const overlayItems = shopOverlays.map((overlay) => ({
    ...overlay,
    type: "overlay",
  }));
  let companionItems;
  try {
    companionItems = require("../data/shopCompanions.json");
  } catch (_) {
    companionItems = fs
      .readdirSync(path.join(rootDirectory, "public", "images", "animations"))
      .filter((file) => file.toLowerCase().endsWith(".gif"))
      .sort((a, b) => a.localeCompare(b))
      .map((file) => ({
        id: `companion-${file.slice(0, -4).toLowerCase()}`,
        name: file
          .slice(0, -4)
          .replace(/[-_]/g, " ")
          .replace(/\b\w/g, (letter) => letter.toUpperCase()),
        imageUrl: `/public/images/animations/${encodeURIComponent(file)}`,
        type: "companion",
        price: file.toLowerCase().endsWith("_shiny.gif")
          ? companionPrice * 2
          : companionPrice,
      }));
  }
  const boostItems = [
    {
      id: "boost-master-ball",
      name: "Master Ball Upgrade",
      type: "boost",
      price: 2500,
      imageUrl: "/public/images/shop/boosts/masterball.webp",
      description: "Upgrades to Master Ball tier for the next catch.",
    },
    {
      id: "boost-double-earnings",
      name: "2x Earnings (7 Days)",
      type: "boost",
      price: 3000,
      imageUrl: "/public/images/shop/boosts/2x_multiplier.webp",
      description: "Doubles Pokédollars earned for the next 7 days.",
    },
  ];

  return {
    shopBackgrounds,
    overlayItems,
    companionItems,
    boostItems,
    collectibleCatalog: {
      overlay: overlayItems,
      companion: companionItems,
    },
  };
}

module.exports = createShopItems;
