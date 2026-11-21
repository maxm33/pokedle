const getBearerToken = require("../lib/authTokens");

function registerSentryRoutes(app, dependencies) {
  const {
    auth,
    createError,
    bgPathSelector,
    sentryStatsLimiter,
    sentryDurationMs,
    sentryFailureLimit,
    sentrySessionTtlMs,
    updateStatsOnSentryRound,
    randomUUID,
    generateSentryChallenge,
    state,
  } = dependencies;

  // render sentry duty mode page
  app.get("/sentry", (req, res) => {
    res.render("sentryMode", {
      bg: bgPathSelector(req.device.type),
    });
  });

  // verify the player's sentry duty guess
  app.post("/sentry", sentryStatsLimiter, async (req, res, next) => {
    try {
      const challengeID = req.body.challengeID;
      const selected = req.body.selected;
      const challenge = state.sentryChallenges[challengeID];

      if (!challenge || challenge.processing) {
        res.status(410);
        res.send({ correct: false, timeout: true });
        return;
      }

      const session = state.sentrySessions.get(challenge.sessionID);
      if (
        !session ||
        session.currentChallengeID !== challengeID ||
        session.gameOver ||
        session.expiresAt <= Date.now()
      )
        return res.status(410).send({ correct: false, timeout: true });

      let authenticatedUid = null;
      const token = typeof req.body.token === "string" ? req.body.token : null;
      if (token) {
        try {
          authenticatedUid = (await auth.verifyIdToken(token)).uid;
        } catch (_) {
          return res.status(401).send({ error: "Invalid authentication token" });
        }
      }
      if (session.uid && authenticatedUid !== session.uid)
        return res.status(401).send({ error: "Authentication required" });
      if (!session.uid && authenticatedUid) {
        session.uid = authenticatedUid;
        session.totalScore = 0;
        session.failures = 0;
        session.rounds = 0;
      }

      challenge.processing = true;
      const elapsedMs = Date.now() - challenge.startTime;
      const timedOut = elapsedMs > sentryDurationMs;
      const correct =
        selected === challenge.answer &&
        challenge.options.includes(selected) &&
        !timedOut;
      const baseScore = 1000;
      const decayFactor = 0.92;
      const score = correct
        ? Math.max(
            0,
            Math.ceil(baseScore * Math.pow(decayFactor, elapsedMs / 1000)),
          )
        : 0;
      const totalScore = session.totalScore + score;
      const rounds = session.rounds + 1;
      const failures = session.failures + (correct ? 0 : 1);
      const gameOver = failures >= sentryFailureLimit;

      try {
        if (session.uid)
          await updateStatsOnSentryRound(
            session.uid,
            totalScore,
            !correct,
            rounds,
            gameOver,
          );
      } catch (err) {
        challenge.processing = false;
        throw err;
      }

      delete state.sentryChallenges[challengeID];
      session.currentChallengeID = null;
      session.totalScore = totalScore;
      session.rounds = rounds;
      session.failures = failures;
      session.gameOver = gameOver;
      session.expiresAt = Date.now() + sentrySessionTtlMs;
      res.status(200);
      res.send({
        correct: correct,
        score: score,
        answer: challenge.answer,
        timeout: timedOut,
        elapsedMs: elapsedMs,
        totalScore: totalScore,
        rounds: rounds,
        failures: failures,
        gameOver: gameOver,
      });
    } catch (err) {
      console.error(err);
      next(createError(500));
    }
  });

  // send current sentry duty challenge to the user
  app.get("/sentry/state", async (req, res, next) => {
    try {
      const token = getBearerToken(req);
      let authenticatedUid = null;
      if (token) {
        try {
          authenticatedUid = (await auth.verifyIdToken(token)).uid;
        } catch (_) {
          return res.status(401).send({ error: "Invalid authentication token" });
        }
      }

      const now = Date.now();
      for (const [id, activeSession] of state.sentrySessions) {
        if (activeSession.expiresAt <= now) {
          if (activeSession.currentChallengeID)
            delete state.sentryChallenges[activeSession.currentChallengeID];
          state.sentrySessions.delete(id);
        }
      }

      let sessionID = req.query.sessionID;
      let session;
      if (sessionID == null) {
        sessionID = randomUUID();
        session = {
          uid: authenticatedUid,
          totalScore: 0,
          failures: 0,
          rounds: 0,
          gameOver: false,
          currentChallengeID: null,
          expiresAt: now + sentrySessionTtlMs,
        };
        state.sentrySessions.set(sessionID, session);
      } else {
        session = state.sentrySessions.get(sessionID);
        if (!session) return res.status(410).send({ error: "Session expired" });
        if (session.uid && session.uid !== authenticatedUid)
          return res.status(401).send({ error: "Authentication required" });
        if (!session.uid && authenticatedUid) {
          session.uid = authenticatedUid;
          session.totalScore = 0;
          session.failures = 0;
          session.rounds = 0;
        }
      }

      if (session.gameOver)
        return res.status(410).send({ error: "Game over; start a new session" });

      if (session.currentChallengeID) {
        const previousChallenge = state.sentryChallenges[session.currentChallengeID];
        if (!previousChallenge || previousChallenge.processing)
          return res.status(409).send({ error: "Challenge is being processed" });

        previousChallenge.processing = true;
        const rounds = session.rounds + 1;
        const failures = session.failures + 1;
        const gameOver = failures >= sentryFailureLimit;
        try {
          if (session.uid)
            await updateStatsOnSentryRound(
              session.uid,
              session.totalScore,
              true,
              rounds,
              gameOver,
            );
        } catch (err) {
          previousChallenge.processing = false;
          throw err;
        }

        delete state.sentryChallenges[session.currentChallengeID];
        session.currentChallengeID = null;
        session.rounds = rounds;
        session.failures = failures;
        session.gameOver = gameOver;
      }

      if (session.gameOver)
        return res.status(410).send({ error: "Game over; start a new session" });

      session.expiresAt = Date.now() + sentrySessionTtlMs;
      const challenge = await generateSentryChallenge(sessionID, session);
      res.status(200).send({
        ...challenge,
        sessionID: sessionID,
        totalScore: session.totalScore,
        rounds: session.rounds,
        failures: session.failures,
      });
    } catch (err) {
      console.error(err);
      next(createError(500));
    }
  });
}

module.exports = registerSentryRoutes;
