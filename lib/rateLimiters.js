const { rateLimit } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");

function createRateLimiters(sendCommand) {
  function handleRateLimit(req, res, next, options) {
    const message =
      typeof options.message === "string"
        ? options.message
        : options.message?.error || "Too many requests. Please try again later.";

    if (req.get("sec-fetch-dest") === "document") {
      const referer = req.get("referer");
      if (referer) {
        let refererUrl;
        try {
          refererUrl = new URL(referer);
        } catch (_) {
          refererUrl = null;
        }
        const appOrigin = `${req.protocol}://${req.get("host")}`;
        if (refererUrl?.origin === appOrigin) {
          const sourceUrl = `${refererUrl.pathname}${refererUrl.search}`;
          if (sourceUrl !== req.originalUrl) {
            refererUrl.searchParams.set("rateLimitToast", message);
            return res.redirect(
              303,
              `${refererUrl.pathname}${refererUrl.search}${refererUrl.hash}`,
            );
          }
        }
      }

      res.locals.rateLimitToast = message;
      return next();
    }

    return res.status(options.statusCode).send(options.message);
  }

  function createRedisRateLimiter({ windowMs, limit, message, prefix }) {
    return rateLimit({
      windowMs,
      limit,
      message,
      handler: handleRateLimit,
      standardHeaders: true,
      legacyHeaders: false,
      store: new RedisStore({
        sendCommand,
        prefix,
      }),
    });
  }

  return {
    firestoreReadLimiter: createRedisRateLimiter({
      windowMs: 60 * 1000,
      limit: 15,
      message: { error: "Too many data requests, please slow down." },
      prefix: "pokedle:rate-limit:firestore-read:",
    }),
    shopLimiter: createRedisRateLimiter({
      windowMs: 60 * 1000,
      limit: 20,
      message: { error: "Too many shop requests. Please try again later." },
      prefix: "pokedle:rate-limit:shop:",
    }),
    sentryStatsLimiter: createRedisRateLimiter({
      windowMs: 60 * 1000,
      limit: 30,
      message: { error: "Too many game requests, please slow down." },
      prefix: "pokedle:rate-limit:sentry-stats:",
    }),
    authLimiter: createRedisRateLimiter({
      windowMs: 60 * 60 * 1000,
      limit: 5,
      message: { error: "Too many account modification requests." },
      prefix: "pokedle:rate-limit:account:",
    }),
  };
}

module.exports = createRateLimiters;
