const { createClient } = require("redis");

function createRateLimitRedisStore(env) {
  const client = createClient({ url: env.REDIS_URL });
  let connection;

  client.on("error", (error) => {
    console.error("Shared rate-limit Redis connection error:", error);
  });

  async function initialize() {
    if (!env.REDIS_URL)
      throw new Error("REDIS_URL must be configured for shared rate limiting");
    if (!connection) connection = client.connect();
    await connection;
  }

  async function sendCommand(...args) {
    await initialize();
    return client.sendCommand(args);
  }

  async function close() {
    if (!connection) return;
    await connection;
    if (client.isOpen) await client.quit();
  }

  return { initialize, sendCommand, close };
}

module.exports = createRateLimitRedisStore;
