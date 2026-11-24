const { getBearerToken, verifyAuthToken } = require("./authTokens");

function createShopServices({
  auth,
  bgPathSelector,
  getShopBackground,
}) {
  function profileBgPathSelector(backgroundId, device) {
    const background = getShopBackground?.(backgroundId);
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
      return { uid: await verifyAuthToken(auth, token) };
    } catch (_) {
      res.status(401).send({ error: "Invalid authentication token" });
      return null;
    }
  }

  return {
    profileBgPathSelector,
    verifyShopUserToken,
  };
}

module.exports = createShopServices;
