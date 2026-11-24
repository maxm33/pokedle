const express = require("express");
const logger = require("morgan");
const createError = require("http-errors");
const createAppComposition = require("./lib/appComposition");
const registerAppRoutes = require("./routes/registerAppRoutes");

const composition = createAppComposition(__dirname, process.env);
const app = express();
const {
  appVersion,
  firebaseConfig,
  axiosBundlePath,
  bgPathSelector,
  routeDependencies,
} = composition;
app.locals.appVersion = appVersion;

app.locals.initializeRateLimitStore = composition.initializeRateLimitStore;
app.locals.initializeClassicGame = composition.initializeClassicGame;
app.locals.initializeMonthlyRankings = composition.initializeMonthlyRankings;
app.locals.stopScheduledClassicGeneration =
  composition.stopScheduledClassicGeneration;
app.locals.closeRateLimitRedisStore = composition.closeRateLimitRedisStore;
app.locals.stopMonthlyRankingReset = composition.stopMonthlyRankingReset;

// EJS view engine setup
app.set("views", __dirname + "/views");
app.set("view engine", "ejs");

app.set("trust proxy", 3);

app.use(logger("dev"));
app.use(express.json());
app.use((req, res, next) => {
  const ua = req.headers["user-agent"] || "";
  req.device = {
    type: /Mobi|Android|iPhone|iPod|Windows Phone/i.test(ua)
      ? "phone"
      : "desktop",
  };
  next();
});

// Client app version check, ignores cache policies if not synchronized with server's
app.use((req, res, next) => {
  const clientVersion = req.headers["x-client-version"];

  if (
    req.path.startsWith("/public/") &&
    clientVersion &&
    clientVersion !== appVersion
  ) {
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }

  res.setHeader("X-App-Version", appVersion);
  next();
});

app.get("/vendor/axios.min.js", (req, res, next) => {
  res.sendFile(
    axiosBundlePath,
    { maxAge: "1y", immutable: true },
    (err) => {
      if (err) next(err);
    },
  );
});

const applyAssetCacheHeaders = (res, maxAge) => {
  res.setHeader("Cache-Control", `public, max-age=${maxAge}, must-revalidate`);
};

// JS/CSS/assets cache control policies
app.use(
  "/public/js",
  express.static(__dirname + "/public/js", {
    setHeaders: function (res, _) {
      applyAssetCacheHeaders(res, 3600);
    },
  }),
);
app.use(
  "/public/stylesheets",
  express.static(__dirname + "/public/stylesheets", {
    setHeaders: function (res, _) {
      applyAssetCacheHeaders(res, 3600);
    },
  }),
);
app.use(
  "/public",
  express.static(__dirname + "/public", {
    setHeaders: function (res, _) {
      applyAssetCacheHeaders(res, 31536000);
    },
  }),
);

app.get("/app/version", (_, res) => {
  res.status(200);
  res.setHeader("X-App-Version", appVersion);
  res.send({ version: appVersion });
});

// send firebase configuration to client
app.get("/env/fb", (_, res) => {
  res.status(200);
  res.send(firebaseConfig);
});

// classic mode redirected as home page
app.get("/", (_, res) => {
  res.redirect("/classic");
});

registerAppRoutes(app, routeDependencies);

app.all("/*", (req, res, next) => {
  next(createError(404));
});

app.use(function (err, req, res, _) {
  res.locals.message = err.message;
  res.locals.error = err;
  res.status(err.status || 500);
  res.render("error", { bg: bgPathSelector(req.device.type) });
});

module.exports = app;
