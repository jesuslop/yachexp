const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
const {
  setupGlobals,
  loadModules,
  resetMigrations
} = require("../helpers/test-globals");
const { makeV1Settings, buildMigrationSteps } = require("../helpers/fixtures");

let migrations;
let settingsUpdate;
let steps;

beforeEach(() => {
  setupGlobals();
  ({ migrations, settingsUpdate } = loadModules());
  resetMigrations(migrations);
  steps = buildMigrationSteps();
});

test("invalid settings reset to defaults", async () => {
  const result = await settingsUpdate.normalizeSettings(null);
  assert.equal(result.resetReason, "settings are invalid");
  assert.deepEqual(result.settings, makeV1Settings());
});

test("missing schema_version resets when allowed", async () => {
  const result = await settingsUpdate.normalizeSettings(
    { profiles: {} },
    { allowMissingSchema: true }
  );
  assert.equal(result.resetReason, "schema_version is missing");
  assert.deepEqual(result.settings, makeV1Settings());
});

test("schema_version higher than latest target resets", async () => {
  migrations.STORAGE_MIGRATIONS.push(steps.v1ToV2);
  const data = makeV1Settings();
  data.schema_version = 99;
  const result = await settingsUpdate.normalizeSettings(data);
  assert.equal(
    result.resetReason,
    "schema_version is higher than latest target"
  );
  assert.deepEqual(result.settings, makeV1Settings());
});

test("migration failure resets to defaults", async () => {
  const failingStep = {
    name: "v1-to-v2-fail",
    from: 1,
    to: 2,
    hook: () => {
      throw new Error("boom");
    }
  };
  migrations.STORAGE_MIGRATIONS.push(failingStep);
  const originalError = console.error;
  console.error = () => {};
  try {
    const result = await settingsUpdate.normalizeSettings(makeV1Settings());
    assert.equal(result.resetReason, "migration failed");
    assert.deepEqual(result.settings, makeV1Settings());
  } finally {
    console.error = originalError;
  }
});
