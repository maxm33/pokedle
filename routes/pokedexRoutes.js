function registerPokedexRoutes(app, dependencies) {
  const {
    firestore,
    firestoreReadLimiter,
    createError,
    classicGetCurrentDate,
    bgPathSelector,
    state,
  } = dependencies;

  // render requested user's pokedex page
  app.get("/user/:gid/pokedex", firestoreReadLimiter, async (req, res, next) => {
    firestore
      .collection("users")
      .doc(req.params.gid)
      .get()
      .then((doc) => {
        const user = doc.data();
        if (user == undefined) next(createError(404, "User does not exist"));
        else {
          const currentDate = classicGetCurrentDate();
          const currentPokemonName = state.classicCurrentPokemon
            ? state.classicCurrentPokemon.name
            : null;

          const history = (
            Array.isArray(user.classicHistory) ? user.classicHistory : []
          ).map((entry) => {
            if (
              entry.date === currentDate &&
              entry.pokemon === currentPokemonName
            )
              return { ...entry, pokemon: "SECRET_TODAY" };
            return entry;
          });

          res.status(200);
          res.render("pokedex", {
            username: user.username || "???",
            history,
            bg: bgPathSelector(req.device.type),
          });
        }
      })
      .catch((err) => {
        console.error(err);
        next(createError(500));
      });
  });
}

module.exports = registerPokedexRoutes;
