const shopCatalog = require("./shopCatalog");
const getBearerToken = require("./authTokens");

function createShopServices({
  auth,
  shopBackgrounds,
  collectibleCatalog,
  boostItems,
  bgPathSelector,
}) {
  function getShopBackground(backgroundId) {
    return shopCatalog.getShopBackground(shopBackgrounds, backgroundId);
  }

  function getCollectible(type, itemId) {
    return shopCatalog.getCollectible(collectibleCatalog, type, itemId);
  }

  function getOwnedCollectibles(user, type) {
    return shopCatalog.getOwnedCollectibles(collectibleCatalog, user, type);
  }

  function getOwnedShopBackgrounds(user) {
    return shopCatalog.getOwnedShopBackgrounds(shopBackgrounds, user);
  }

  function getOwnedBoostInventory(user) {
    return shopCatalog.getOwnedBoostInventory(boostItems, user);
  }

  function profileBgPathSelector(backgroundId, device) {
    const background = getShopBackground(backgroundId);
    if (!background) return bgPathSelector(device);
    return device === "phone" ? background.mobileUrl : background.desktopUrl;
  }

  async function verifyShopUserToken(req, res) {
    const token = getBearerToken(req);
    if (!token) {
      res.status(401).send({ error: "Authentication required" });
      return null;
    }

    try {
      return await auth.verifyIdToken(token);
    } catch (_) {
      res.status(401).send({ error: "Invalid authentication token" });
      return null;
    }
  }

  return {
    getCollectible,
    getOwnedBoostInventory,
    getOwnedCollectibles,
    getOwnedShopBackgrounds,
    getShopBackground,
    profileBgPathSelector,
    verifyShopUserToken,
  };
}

module.exports = createShopServices;
