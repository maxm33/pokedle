const express = require("express");
const fs = require("fs");
const logger = require("morgan");
const createError = require("http-errors");
const path = require("path");
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

app.get("/service-worker.js", (_, res) => {
  res.set({
    "Cache-Control": "no-store",
    "Content-Type": "application/javascript; charset=utf-8",
  });
  res.send(`
const APP_VERSION = ${JSON.stringify(appVersion)};
const STATIC_CACHE = \`pokedle-static-\${APP_VERSION}\`;
const CACHE_PREFIX = "pokedle-";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(
            (name) =>
              name.startsWith(CACHE_PREFIX) &&
              name !== STATIC_CACHE,
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isAppAsset =
    url.pathname.startsWith("/public/") ||
    url.pathname.startsWith("/vendor/") ||
    url.pathname.startsWith("/audio/");
  const isNavigation =
    request.mode === "navigate";

  if (!isAppAsset && !isNavigation) return;

  event.respondWith(
    (async () => {
      try {
        const networkRequest =
          isAppAsset
            ? new Request(request, { cache: "no-store" })
            : new Request(request, { cache: "no-store" });
        const response = await fetch(networkRequest);
        if (response.ok) {
          const cache = await caches.open(STATIC_CACHE);
          await cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        throw error;
      }
    })(),
  );
});
`);
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

async function readMp3Album(filePath) {
  const file = await fs.promises.open(filePath, "r");

  try {
    const header = Buffer.alloc(10);
    const headerRead = await file.read(header, 0, header.length, 0);
    if (headerRead.bytesRead !== header.length || header.toString("ascii", 0, 3) !== "ID3") {
      return "";
    }

    const version = header[3];
    if (version < 2 || version > 4) {
      return "";
    }

    const tagSize =
      (header[6] << 21) | (header[7] << 14) | (header[8] << 7) | header[9];
    const tagData = Buffer.alloc(Math.min(tagSize, 1024 * 1024));
    const tagRead = await file.read(tagData, 0, tagData.length, header.length);
    const data = tagData.subarray(0, tagRead.bytesRead);
    let offset = 0;

    if (header[5] & 0x40) {
      const extendedSize =
        version === 4
          ? (data[0] << 21) | (data[1] << 14) | (data[2] << 7) | data[3]
          : data.readUInt32BE(0) + 4;
      offset += extendedSize;
    }

    while (offset < data.length) {
      const idLength = version === 2 ? 3 : 4;
      const frameHeaderLength = version === 2 ? 6 : 10;
      if (offset + frameHeaderLength > data.length) {
        break;
      }

      const frameId = data.toString("ascii", offset, offset + idLength);
      if (!frameId.trim()) {
        break;
      }

      const frameSize =
        version === 2
          ? data.readUIntBE(offset + 3, 3)
          : version === 4
            ? (data[offset + 4] << 21) |
              (data[offset + 5] << 14) |
              (data[offset + 6] << 7) |
              data[offset + 7]
            : data.readUInt32BE(offset + 4);
      const frameStart = offset + frameHeaderLength;
      const frameEnd = frameStart + frameSize;
      if (frameEnd > data.length) {
        break;
      }

      if (frameId === "TALB" || frameId === "TAL") {
        const encoding = data[frameStart];
        let text = data.subarray(frameStart + 1, frameEnd);
        if (encoding === 0) {
          return text.toString("latin1").replace(/\0+$/g, "").trim();
        }
        if (encoding === 2) {
          text = text.subarray(0, text.length - (text.length % 2));
          return Buffer.from(text).swap16().toString("utf16le").replace(/\0+$/g, "").trim();
        }
        if (encoding === 1 && text[0] === 0xfe && text[1] === 0xff) {
          text = text.subarray(2, text.length - ((text.length - 2) % 2));
          return Buffer.from(text).swap16().toString("utf16le").replace(/\0+$/g, "").trim();
        }
        if (encoding === 1 && text[0] === 0xff && text[1] === 0xfe) {
          text = text.subarray(2);
        }
        return text.toString(encoding === 1 ? "utf16le" : "utf8").replace(/\0+$/g, "").trim();
      }

      offset = frameEnd;
    }

    return "";
  } finally {
    await file.close();
  }
}

let audioPlaylistPromise;
app.get("/audio/playlist", async (_, res, next) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    if (!audioPlaylistPromise) {
      audioPlaylistPromise = (async () => {
        const audioDirectory = path.join(__dirname, "public", "audio");
        const filenames = await fs.promises.readdir(audioDirectory);
        const numberedFilenames = filenames.filter((filename) =>
          /^\d-\d{2}\. .+\.mp3$/i.test(filename),
        );

        return Promise.all(
          numberedFilenames.map(async (filename) => ({
            filename,
            title: filename.replace(/^\d-\d{2}\. /, "").replace(/\.mp3$/i, ""),
            album:
              (await readMp3Album(path.join(audioDirectory, filename))) ||
              "Album unknown",
          })),
        );
      })();
    }

    res.json(await audioPlaylistPromise);
  } catch (error) {
    audioPlaylistPromise = undefined;
    next(error);
  }
});

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
