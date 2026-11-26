function createClassicGuestStateService({ state, updateStatsOnClassicWin }) {
  async function mergeClassicGuestState(uid, guestId) {
    const userKey = `user:${uid}`;
    if (state.redisGameState) {
      const gameId = state.classicGameID;
      const userState =
        (await state.redisGameState.getClassicPlayer(gameId, userKey)) || {
          guesses: new Map(),
          winner: false,
          pendingWinner: null,
        };
      if (!guestId) {
        await state.redisGameState.setClassicPlayer(gameId, userKey, userState);
        return userState;
      }
      const guestKey = `guest:${guestId}`;
      const guestState = await state.redisGameState.getClassicPlayer(
        gameId,
        guestKey,
      );
      if (!guestState || guestState === userState || userState.winner) {
        await state.redisGameState.setClassicPlayer(gameId, userKey, userState);
        if (guestState) await state.redisGameState.deleteClassicPlayer(gameId, guestKey);
        return userState;
      }
      for (const [name, entry] of guestState.guesses) {
        if (!userState.guesses.has(name)) userState.guesses.set(name, entry);
      }
      if (guestState.winner) {
        const winningEntry = [...guestState.guesses.values()].find(
          (entry) => entry.result?.[2],
        );
        if (winningEntry) {
          await updateStatsOnClassicWin(
            uid,
            winningEntry.result[0].name,
            winningEntry.result[4]?.tries ||
              [...guestState.guesses.values()].filter((entry) => entry.result).length,
            winningEntry.result[3]?.shiny === true ||
              winningEntry.guaranteedShiny === true,
            winningEntry.guaranteedShiny,
          );
        }
        userState.winner = true;
        await state.redisGameState.markClassicWinner(gameId, userKey);
      }
      await state.redisGameState.setClassicPlayer(gameId, userKey, userState);
      await state.redisGameState.deleteClassicPlayer(gameId, guestKey);
      return userState;
    }
    let userState = state.classicPlayerStates.get(userKey);
    if (!userState) {
      userState = { guesses: new Map(), winner: false, pendingWinner: null };
      state.classicPlayerStates.set(userKey, userState);
    }

    const guestState = state.classicPlayerStates.get(`guest:${guestId}`);
    if (!guestState || guestState === userState || userState.winner) {
      if (guestState && guestState !== userState)
        state.classicPlayerStates.delete(`guest:${guestId}`);
      return userState;
    }

    for (const [name, entry] of guestState.guesses) {
      if (entry.pending) await entry.pending;
      if (!userState.guesses.has(name)) userState.guesses.set(name, entry);
    }

    if (guestState.winner) {
      const winningEntry = [...guestState.guesses.values()].find(
        (entry) => entry.result?.[2],
      );
      if (winningEntry) {
        await updateStatsOnClassicWin(
          uid,
          winningEntry.result[0].name,
          winningEntry.result[4]?.tries ||
            [...guestState.guesses.values()].filter((entry) => entry.result).length,
          winningEntry.result[3]?.shiny === true ||
            winningEntry.guaranteedShiny === true,
          winningEntry.guaranteedShiny,
        );
      }
      userState.winner = true;
      if (!state.classicWinners.includes(userKey))
        state.classicWinners.push(userKey);
    }

    state.classicPlayerStates.delete(`guest:${guestId}`);
    return userState;
  }

  return { mergeClassicGuestState };
}

module.exports = createClassicGuestStateService;
