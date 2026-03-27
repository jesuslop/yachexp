const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
const {
  setupGlobals,
  loadModules,
  resetMigrations
} = require("../helpers/test-globals");
const {
  makeV1Settings,
  stripSchema,
  withSchema,
  applyV2Adds,
  applyV3Deletes,
  applyV4Uppercase,
  buildMigrationSteps
} = require("../helpers/fixtures");

let migrations;
let settingsUpdate;
let steps;

beforeEach(() => {
  setupGlobals();
  steps = buildMigrationSteps();
  ({ migrations, settingsUpdate } = loadModules());
  resetMigrations(migrations);
});

function setMigrations(list) {
  migrations.STORAGE_MIGRATIONS.splice(0, migrations.STORAGE_MIGRATIONS.length, ...list);
}

const cases = [
  {
    name: "length 0 - no migrations",
    steps: [],
    transforms: []
  },
  {
    name: "length 1 - v1 to v2",
    steps: ["v1ToV2"],
    transforms: [applyV2Adds]
  },
  {
    name: "length 1 - v1 to v3",
    steps: ["v1ToV3"],
    transforms: [applyV3Deletes]
  },
  {
    name: "length 1 - v1 to v4",
    steps: ["v1ToV4"],
    transforms: [applyV4Uppercase]
  },
  {
    name: "length 2 - v1 to v2 to v3",
    steps: ["v1ToV2", "v2ToV3"],
    transforms: [applyV2Adds, applyV3Deletes]
  },
  {
    name: "length 2 - v1 to v2 to v4",
    steps: ["v1ToV2", "v2ToV4"],
    transforms: [applyV2Adds, applyV4Uppercase]
  },
  {
    name: "length 2 - v1 to v3 to v4",
    steps: ["v1ToV3", "v3ToV4"],
    transforms: [applyV3Deletes, applyV4Uppercase]
  },
  {
    name: "length 3 - v1 to v2 to v3 to v4",
    steps: ["v1ToV2", "v2ToV3", "v3ToV4"],
    transforms: [applyV2Adds, applyV3Deletes, applyV4Uppercase]
  }
];

for (const testCase of cases) {
  test(testCase.name, async () => {
    const v1Settings = makeV1Settings();
    if (!testCase.steps.length) {
      setMigrations([]);
      const result = await settingsUpdate.normalizeSettings(v1Settings);
      assert.equal(result.resetReason, null);
      assert.deepEqual(result.settings, v1Settings);
      return;
    }

    setMigrations(testCase.steps.map((name) => steps[name]));
    const latestTarget = migrations.getLatestMigrationTarget();
    let expected = stripSchema(v1Settings);
    for (const transform of testCase.transforms) {
      expected = transform(expected);
    }
    expected = withSchema(expected, latestTarget);

    const result = await settingsUpdate.normalizeSettings(v1Settings);
    assert.equal(result.resetReason, null);
    assert.deepEqual(result.settings, expected);
  });
}
