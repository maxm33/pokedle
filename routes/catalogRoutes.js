function registerCatalogRoutes(app) {
  app.get("/data/shopBackgrounds.json", (_, res, next) => {
    res.setHeader("Cache-Control", "public, max-age=86400, must-revalidate");
    res.sendFile(require.resolve("../data/shopBackgrounds.json"), (err) => {
      if (err) next(err);
    });
  });

  app.get("/data/shopOverlays.json", (_, res, next) => {
    res.setHeader("Cache-Control", "public, max-age=86400, must-revalidate");
    res.sendFile(require.resolve("../data/shopOverlays.json"), (err) => {
      if (err) next(err);
    });
  });
}

module.exports = registerCatalogRoutes;
