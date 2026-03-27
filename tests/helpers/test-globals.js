const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readDefaultSettings() {
  return readJson(path.join(PROJECT_ROOT, "default-settings.json"));
}

function createFetchStub() {
  return async (url) => {
    const rawPath = String(url);
    const filePath = rawPath.startsWith("file://")
      ? rawPath.replace(/^file:\/\//, "")
      : rawPath;
    const json = readJson(filePath);
    return {
      ok: true,
      status: 200,
      json: async () => json
    };
  };
}

function setupGlobals(options = {}) {
  const { storageLocal, fetchImpl, jsonataImpl, yuppeeImpl } = options;
  globalThis.window = globalThis;
  globalThis.jsonata = jsonataImpl || require("jsonata");
  globalThis.Yuppee = yuppeeImpl || require("yuppee");
  globalThis.browser = {
    runtime: {
      getURL: (relativePath) => path.join(PROJECT_ROOT, relativePath)
    },
    storage: {
      local: storageLocal || {
        set: async () => {},
        remove: async () => {}
      }
    }
  };
  globalThis.fetch = fetchImpl || createFetchStub();
}

function loadModules() {
  const migrationsPath = path.join(PROJECT_ROOT, "storage-migrations.js");
  const settingsPath = path.join(PROJECT_ROOT, "settings-update.js");
  delete require.cache[require.resolve(migrationsPath)];
  delete require.cache[require.resolve(settingsPath)];
  require(migrationsPath);
  require(settingsPath);
  return {
    migrations: globalThis.YachexpStorageMigrations,
    settingsUpdate: globalThis.YachexpSettingsUpdate
  };
}

function resetMigrations(migrationsApi) {
  migrationsApi.STORAGE_MIGRATIONS.length = 0;
}

module.exports = {
  PROJECT_ROOT,
  readDefaultSettings,
  setupGlobals,
  loadModules,
  resetMigrations
};
