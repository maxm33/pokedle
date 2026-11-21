function getBearerToken(req) {
  return req.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] || null;
}

module.exports = getBearerToken;
