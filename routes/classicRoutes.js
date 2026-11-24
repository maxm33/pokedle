const { getBearerToken, verifyAuthToken } = require("../lib/authTokens");
const { getPokemonDisplayName, getPokemonSlug } = require("../lib/pokemonNames");

function registerClassicRoutes(app, dependencies) {
  const {
    auth,
    firestore,
    firestoreReadLimiter,
    createError,
    bgPathSelector,
    mergeClassicGuestState,
    classicVerifyGuess,
    classicGetShinyChance,
    updateStatsOnClassicWin,
    classicGetRemainingTime,
    classicGetCurrentDate,
    classicShouldResetStreak,
    classicGetActiveBall,
    classicGetStreakBall,
    state: routeState,
  } = dependencies;

  // render classic mode page
  app.get("/classic", (req, res) => {
    res.render("classicMode", {
      bg: bgPathSelector(req.device.type),
      prev: routeState.classicPreviousPokemon,
      prevDisplayName: routeState.classicPreviousPokemon
        ? getPokemonDisplayName(routeState.classicPreviousPokemon.name)
        : null,
      prevSlug: routeState.classicPreviousPokemon
        ? getPokemonSlug(routeState.classicPreviousPokemon.name)
        : null,
    });
  });

  // generate hints based on user's guess, check if user has won and, if so, call an update to his stats
  app.post("/classic", async (req, res, next) => {
    try {
      let authenticatedUid = null;
      if (req.body.token != null) {
        try {
          authenticatedUid = await verifyAuthToken(auth, req.body.token);
        } catch (_) {
          return res.status(401).send({ error: "Invalid authentication token" });
        }
      }

      const guestId =
        typeof req.body.uid === "string" &&
        req.body.uid.trim().length > 0 &&
        req.body.uid.length <= 128
          ? req.body.uid
          : null;
      const playerId = authenticatedUid
        ? `user:${authenticatedUid}`
        : guestId
          ? `guest:${guestId}`
          : null;
      if (!playerId)
        return res.status(400).send({ error: "Player ID is required" });

      // Search the local cache instead of querying Firestore
      const guess = routeState.pokemonByName?.get(req.body.guess);

      if (!guess) {
        return next(createError(404, "Pokémon not found"));
      }

      let playerState;
      if (authenticatedUid) {
        playerState = await mergeClassicGuestState(authenticatedUid, guestId);
      } else {
        playerState = routeState.classicPlayerStates.get(playerId);
        if (!playerState) {
          playerState = {
            guesses: new Map(),
            winner: false,
            pendingWinner: null,
          };
          routeState.classicPlayerStates.set(playerId, playerState);
        }
      }

      const existingGuess = playerState.guesses.get(guess.name);
      if (existingGuess) {
        try {
          const previousResult = existingGuess.pending
            ? await existingGuess.pending
            : existingGuess.result;
          const duplicateResult = [...previousResult];
          duplicateResult[4] = {
            tries: playerState.guesses.size,
            duplicate: true,
          };
          return res.status(200).send(duplicateResult);
        } catch (err) {
          console.error(err);
          return next(createError(500));
        }
      }

      if (playerState.pendingWinner) await playerState.pendingWinner;
      if (playerState.winner)
        return res.status(409).send({ error: "Already won this game" });

      const tries = playerState.guesses.size + 1;
      const guaranteedShiny = routeState.classicShinyEventActive;
      const result = classicVerifyGuess(guess, routeState.classicCurrentPokemon);
      result[4] = { tries, duplicate: false };

      if (result[2]) {
        const shinyRoll = Math.random();
        result[3] = {
          ball: null,
          shiny: guaranteedShiny || shinyRoll < classicGetShinyChance(null),
          pokedollarsEarned: 0,
        };
        const entry = { tries, result: null, pending: null, guaranteedShiny };
        playerState.guesses.set(guess.name, entry);
        playerState.pendingWinner = (async () => {
          try {
            if (authenticatedUid) {
              result[3] =
                (await updateStatsOnClassicWin(
                  authenticatedUid,
                  guess.name,
                  tries,
                  shinyRoll,
                  guaranteedShiny,
                )) || result[3];
            }
            entry.result = result;
            playerState.winner = true;
            if (!routeState.classicWinners.includes(playerId))
              routeState.classicWinners.push(playerId);
            return result;
          } catch (err) {
            playerState.guesses.delete(guess.name);
            throw err;
          } finally {
            playerState.pendingWinner = null;
          }
        })();
        entry.pending = playerState.pendingWinner;
        await playerState.pendingWinner;
      } else {
        playerState.guesses.set(guess.name, { tries, result, pending: null });
      }
      res.status(200).send(result);
    } catch (err) {
      console.error(err);
      next(createError(500));
    }
  });

  // send game ID and remaining time before next generation
  app.get("/classic/state", (_, res) => {
    res.status(200);
    res.send([
      routeState.classicGameID,
      classicGetRemainingTime(),
      routeState.classicPreviousPokemon == null
        ? null
        : {
            ID: routeState.classicPreviousPokemon.ID,
            name: routeState.classicPreviousPokemon.name,
          },
      routeState.classicEventActive,
      routeState.classicDoubleEarningsEventActive,
      routeState.classicShinyEventActive,
    ]);
  });

  app.get("/classic/today", async (req, res, next) => {
    try {
      const token = getBearerToken(req);
      let authenticatedUid = null;

      if (token) {
        try {
          authenticatedUid = await verifyAuthToken(auth, token);
        } catch (_) {}
      }

      const guestId =
        typeof req.query.guestId === "string" ? req.query.guestId : null;
      const playerId = authenticatedUid
        ? `user:${authenticatedUid}`
        : guestId
          ? `guest:${guestId}`
          : null;

      // If the requesting player has won today, reveal the Pokémon
      if (
        playerId &&
        routeState.classicWinners.includes(playerId) &&
        routeState.classicCurrentPokemon
      ) {
        res.status(200).send({ pokemon: routeState.classicCurrentPokemon.name });
      } else {
        res.status(403).send({ error: "User has not won today's game" });
      }
    } catch (err) {
      console.error(err);
      next(createError(500));
    }
  });

  app.get("/classic/ball", firestoreReadLimiter, async (req, res, next) => {
    const token = getBearerToken(req);
    if (!token) return res.status(401).send({ error: "Authentication required" });

    let authenticatedUid;
    try {
      authenticatedUid = await verifyAuthToken(auth, token);
    } catch (err) {
      return res.status(401).send({ error: "Invalid authentication token" });
    }

    try {
      const userRef = firestore.collection("users").doc(authenticatedUid);
      const ball = await firestore.runTransaction(async (transaction) => {
        const doc = await transaction.get(userRef);
        const user = doc.data();
        if (!user) return null;

        const currentDate = classicGetCurrentDate();
        if (classicShouldResetStreak(user, currentDate)) {
          transaction.update(userRef, { classicWinStreak: 0 });
          user.classicWinStreak = 0;
        }

        return classicGetActiveBall(user, currentDate);
      });
      res.status(200).send({ ball });
    } catch (err) {
      console.error(err);
      next(createError(500));
    }
  });

  // send a boolean stating if user can play the current game
  app.get("/classic/canPlay/uid=:uid&gid=:gid", async (req, res, next) => {
    try {
      const token = getBearerToken(req);
      let authenticatedUid = null;
      if (token) {
        try {
          authenticatedUid = await verifyAuthToken(auth, token);
        } catch (_) {
          return res.status(401).send({ error: "Invalid authentication token" });
        }
        if (authenticatedUid !== req.params.gid)
          return res.status(403).send({ error: "User ID does not match token" });
        await mergeClassicGuestState(authenticatedUid, req.params.uid);
      }

      const canPlay =
        !routeState.classicWinners.includes(`guest:${req.params.uid}`) &&
        (!authenticatedUid ||
          !routeState.classicWinners.includes(`user:${authenticatedUid}`));
      res.status(200).send(canPlay);
    } catch (err) {
      console.error(err);
      next(createError(500));
    }
  });
}

module.exports = registerClassicRoutes;
