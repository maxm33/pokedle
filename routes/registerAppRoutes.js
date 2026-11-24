const registerClassicRoutes = require("./classicRoutes");
const registerRankingRoutes = require("./rankingRoutes");
const registerSentryRoutes = require("./sentryRoutes");
const registerUserRoutes = require("./userRoutes");
const registerPokedexRoutes = require("./pokedexRoutes");
const registerShopRoutes = require("./shopRoutes");

function registerAppRoutes(app, dependencies) {
  const common = dependencies.common || dependencies;
  registerClassicRoutes(app, { ...common, ...(dependencies.classic || {}) });
  registerRankingRoutes(app, { ...common, ...(dependencies.ranking || {}) });
  registerSentryRoutes(app, { ...common, ...(dependencies.sentry || {}) });
  registerUserRoutes(app, { ...common, ...(dependencies.user || {}) });
  registerShopRoutes(app, { ...common, ...(dependencies.shop || {}) });
  registerPokedexRoutes(app, { ...common, ...(dependencies.pokedex || {}) });
}

module.exports = registerAppRoutes;
