(() => {
  const SCHEMA_VERSION_KEY = 'schema_version';
  const DEFAULT_SETTINGS_PATH = 'default-settings.json';

  async function loadDefaultSettings() {
    const url = browser.runtime.getURL(DEFAULT_SETTINGS_PATH);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${DEFAULT_SETTINGS_PATH}: ${response.status}`);
    }
    return response.json();
  }

  function getYuppeeApi() {
    if (globalThis.Yuppee) return globalThis.Yuppee;
    return null;
  }

  async function normalizeSettings(data, options = {}) {
    const { allowMissingSchema = false } = options;

    const loadDefaults = async (reason) => ({
      settings: await loadDefaultSettings(),
      resetReason: reason
    });

    if (!data || typeof data !== 'object') {
      return loadDefaults('settings are invalid');
    }

    const hasSchemaVersion = Object.prototype.hasOwnProperty.call(
      data,
      SCHEMA_VERSION_KEY
    );
    if (!hasSchemaVersion && allowMissingSchema) {
      return loadDefaults('schema_version is missing');
    }

    const currentVersion = data[SCHEMA_VERSION_KEY];

    const migrationApi = globalThis.YachexpStorageMigrations;
    const latestTarget = migrationApi?.getLatestMigrationTarget?.() ?? null;
    if (latestTarget !== null && currentVersion > latestTarget) {
      return loadDefaults('schema_version is higher than latest target');
    }
    if (latestTarget === null || currentVersion === latestTarget) {
      return {
        settings: data,
        resetReason: null
      };
    }

    try {
      const migrator = migrationApi?.buildStorageMigrator?.(getYuppeeApi());
      if (!migrator) {
        throw new Error('Storage migrator could not be created.');
      }

      const state = { ...data };
      delete state[SCHEMA_VERSION_KEY];

      const result = migrator({ ...state, version: currentVersion });
      if (!result || typeof result !== 'object') {
        throw new Error('Migration did not return a result.');
      }

      const { version, ...nextState } = result;
      return {
        settings: {
          ...nextState,
          [SCHEMA_VERSION_KEY]: latestTarget
        },
        resetReason: null
      };
    } catch (err) {
      console.error('Storage migration failed. Resetting to defaults.', err);
      return loadDefaults('migration failed');
    }
  }

  async function replaceStorage(nextState, currentState) {
    const keysToRemove = Object.keys(currentState).filter(
      (key) => !(key in nextState)
    );
    if (keysToRemove.length) {
      await browser.storage.local.remove(keysToRemove);
    }
    await browser.storage.local.set(nextState);
  }

  globalThis.YachexpSettingsUpdate = {
    SCHEMA_VERSION_KEY,
    DEFAULT_SETTINGS_PATH,
    loadDefaultSettings,
    normalizeSettings,
    replaceStorage
  };
})();
