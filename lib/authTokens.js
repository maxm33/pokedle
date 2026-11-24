function getBearerToken(req) {
  return req.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] || null;
}

async function verifyAuthToken(auth, token) {
  return (await auth.verifyIdToken(token)).uid;
}

module.exports = { getBearerToken, verifyAuthToken };
