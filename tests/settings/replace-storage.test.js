const assert = require("node:assert/strict");
const { test } = require("node:test");
const { setupGlobals, loadModules } = require("../helpers/test-globals");

test("replaceStorage removes missing keys and sets new state", async () => {
  const removedKeys = [];
  const setCalls = [];

  setupGlobals({
    storageLocal: {
      remove: async (keys) => {
        removedKeys.push(keys);
      },
      set: async (state) => {
        setCalls.push(state);
      }
    }
  });

  const { settingsUpdate } = loadModules();
  const currentState = { a: 1, b: 2, c: 3 };
  const nextState = { a: 1, c: 3, d: 4 };

  await settingsUpdate.replaceStorage(nextState, currentState);

  assert.deepEqual(removedKeys, [["b"]]);
  assert.deepEqual(setCalls, [nextState]);
});
