const { getBearerToken, verifyAuthToken } = require("../lib/authTokens");

function createOptionalAuthMiddleware(auth) {
  return async function optionalAuth(req, res, next) {
    const token = getBearerToken(req);
    if (!token) {
      req.authenticatedUid = null;
      return next();
    }
    try {
      req.authenticatedUid = await verifyAuthToken(auth, token);
    } catch (_) {
      req.authenticatedUid = null;
    }
    return next();
  };
}

function createRequiredAuthMiddleware(auth) {
  return async function requiredAuth(req, res, next) {
    const token = getBearerToken(req);
    if (!token)
      return res.status(401).send({ error: "Authentication required" });
    try {
      req.authenticatedUid = await verifyAuthToken(auth, token);
      return next();
    } catch (_) {
      return res.status(401).send({ error: "Invalid authentication token" });
    }
  };
}

module.exports = {
  createOptionalAuthMiddleware,
  createRequiredAuthMiddleware,
};
