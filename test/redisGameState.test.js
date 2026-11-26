const test = require("node:test");
const assert = require("node:assert/strict");
const createRedisGameState = require("../lib/redisGameState");

test("Redis Classic state serializes guesses and winner state", async () => {
  const values = new Map();
  const commands = [];
  const sendCommand = async (...args) => {
    commands.push(args);
    if (args[0] === "GET") return values.get(args[1]) || null;
    if (args[0] === "SET") {
      values.set(args[1], args[2]);
      return "OK";
    }
    if (args[0] === "DEL") {
      values.delete(args[1]);
      return 1;
    }
    if (args[0] === "SADD") return 1;
    if (args[0] === "SISMEMBER") return 1;
    if (args[0] === "PEXPIRE") return 1;
    return null;
  };
  const state = createRedisGameState({
    sendCommand,
    sentrySessionTtlMs: 1000,
  });
  const player = {
    guesses: new Map([
      ["Pikachu", { tries: 1, result: ["result"], guaranteedShiny: false }],
    ]),
    winner: true,
    pendingWinner: null,
  };
  await state.setClassicPlayer("game-1", "user:user-1", player);
  const restored = await state.getClassicPlayer("game-1", "user:user-1");
  assert.equal(restored.winner, true);
  assert.equal(restored.guesses.get("Pikachu").tries, 1);
  await state.markClassicWinner("game-1", "user:user-1");
  assert.equal(await state.isClassicWinner("game-1", "user:user-1"), true);
  assert.ok(commands.length >= 4);
});

test("Redis Sentry state stores sessions and challenges", async () => {
  const values = new Map();
  const sendCommand = async (...args) => {
    if (args[0] === "GET") return values.get(args[1]) || null;
    if (args[0] === "SET") {
      values.set(args[1], args[2]);
      return "OK";
    }
    if (args[0] === "DEL") {
      values.delete(args[1]);
      return 1;
    }
    return null;
  };
  const state = createRedisGameState({
    sendCommand,
    sentrySessionTtlMs: 1000,
  });
  await state.setSentrySession("session-1", {
    uid: "user-1",
    totalScore: 100,
  });
  await state.setSentryChallenge("challenge-1", {
    answer: "Pikachu",
    processing: false,
  });
  assert.equal((await state.getSentrySession("session-1")).totalScore, 100);
  assert.equal(
    (await state.getSentryChallenge("challenge-1")).answer,
    "Pikachu",
  );
});
