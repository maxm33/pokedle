const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");

function createRateLimiters(sendCommand) {
  const maxCooldownMs = 24 * 60 * 60 * 1000;
  const cooldownScript = `
    local remaining = redis.call('PTTL', KEYS[1])
    if remaining > 0 then
      return remaining
    end

    local strikes = redis.call('INCR', KEYS[2])
    redis.call('PEXPIRE', KEYS[2], ARGV[3])
    local cooldown = math.min(
      tonumber(ARGV[1]) * (2 ^ (strikes - 1)),
      tonumber(ARGV[2])
    )
    redis.call('SET', KEYS[1], '1', 'PX', cooldown)
    return cooldown
  `;

  function sendRateLimitResponse(
    req,
    res,
    next,
    message,
    statusCode,
    cooldownMs,
  ) {
    const responseMessage =
      typeof message === "string"
        ? message
        : message?.error || "Too many requests. Please try again later.";

    res.setHeader(
      "Retry-After",
      String(Math.max(1, Math.ceil(cooldownMs / 1000))),
    );

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
            refererUrl.searchParams.set("rateLimitToast", responseMessage);
            return res.redirect(
              303,
              `${refererUrl.pathname}${refererUrl.search}${refererUrl.hash}`,
            );
          }
        }
      }

      res.locals.rateLimitToast = responseMessage;
      return next();
    }

    return res.status(statusCode).send(message);
  }

  function createRedisRateLimiter({
    windowMs,
    cooldownMs,
    limit,
    message,
    prefix,
  }) {
    const limiter = rateLimit({
      windowMs,
      limit,
      message,
      keyGenerator: (req) => ipKeyGenerator(req.ip),
      handler: (req, res, next, options) => {
        const clientKey = ipKeyGenerator(req.ip);
        sendCommand(
          "EVAL",
          cooldownScript,
          "2",
          `${prefix}cooldown:${clientKey}`,
          `${prefix}strikes:${clientKey}`,
          String(cooldownMs),
          String(maxCooldownMs),
          String(maxCooldownMs),
        )
          .then((remainingMs) =>
            sendRateLimitResponse(
              req,
              res,
              next,
              options.message,
              options.statusCode,
              Number(remainingMs),
            ),
          )
          .catch(next);
      },
      standardHeaders: true,
      legacyHeaders: false,
      store: new RedisStore({
        sendCommand,
        prefix,
      }),
    });

    return function rateLimitWithBackoff(req, res, next) {
      const clientKey = ipKeyGenerator(req.ip);
      sendCommand("PTTL", `${prefix}cooldown:${clientKey}`)
        .then((remainingMs) => {
          const cooldownRemainingMs = Number(remainingMs);
          if (cooldownRemainingMs > 0) {
            return sendRateLimitResponse(
              req,
              res,
              next,
              message,
              429,
              cooldownRemainingMs,
            );
          }
          return limiter(req, res, next);
        })
        .catch(next);
    };
  }

  return {
    firestoreReadLimiter: createRedisRateLimiter({
      windowMs: 60 * 1000,
      cooldownMs: 60 * 1000,
      limit: 15,
      message: { error: "Too many data requests, please slow down." },
      prefix: "pokedle:rate-limit:firestore-read:",
    }),
    shopLimiter: createRedisRateLimiter({
      windowMs: 60 * 1000,
      cooldownMs: 60 * 1000,
      limit: 20,
      message: { error: "Too many shop requests. Please try again later." },
      prefix: "pokedle:rate-limit:shop:",
    }),
    sentryStatsLimiter: createRedisRateLimiter({
      windowMs: 60 * 1000,
      cooldownMs: 60 * 1000,
      limit: 30,
      message: { error: "Too many game requests, please slow down." },
      prefix: "pokedle:rate-limit:sentry-stats:",
    }),
    authLimiter: createRedisRateLimiter({
      windowMs: 60 * 60 * 1000,
      cooldownMs: 60 * 60 * 1000,
      limit: 5,
      message: { error: "Too many account requests. Please try again later." },
      prefix: "pokedle:rate-limit:account:",
    }),
  };
}

module.exports = createRateLimiters;
