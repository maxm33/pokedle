function createClassicGuestStateService({ state, updateStatsOnClassicWin }) {
  async function mergeClassicGuestState(uid, guestId) {
    const userKey = `user:${uid}`;
    let userState = state.classicPlayerStates.get(userKey);
    if (!userState) {
      userState = { guesses: new Map(), winner: false, pendingWinner: null };
      state.classicPlayerStates.set(userKey, userState);
    }

    const guestState = state.classicPlayerStates.get(`guest:${guestId}`);
    if (!guestState || guestState === userState || userState.winner)
      return userState;

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
          userState.guesses.size,
          Math.random(),
          winningEntry.guaranteedShiny,
        );
      }
      userState.winner = true;
      if (!state.classicWinners.includes(userKey))
        state.classicWinners.push(userKey);
    }

    return userState;
  }

  return { mergeClassicGuestState };
}

module.exports = createClassicGuestStateService;
