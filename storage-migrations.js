(() => {
  'use strict';

  const STORAGE_MIGRATIONS = [
    // Example:
    // {
    //   name: 'v1-to-v2',
    //   from: 1,
    //   to: 2,
    //   jsonata: `
    //     $merge([
    //       $,
    //       { "newField": "value" }
    //     ])
    //   `,
    //   hook: (state) => {
    //     delete state.legacyField;
    //     return state;
    //   }
    // }
  ];

  function getLatestMigrationTarget() {
    if (!STORAGE_MIGRATIONS.length) return null;
    return STORAGE_MIGRATIONS.reduce(
      (max, step) => Math.max(max, step.to),
      -Infinity
    );
  }

  async function runJsonata(expression, state) {
    if (typeof jsonata !== 'function') {
      throw new Error('jsonata is not available. Did you sync lib/jsonata.js?');
    }
    return await jsonata(expression).evaluate(state);
  }

  function buildStorageMigrator(yuppeeApi) {
    if (!yuppeeApi ||
      typeof yuppeeApi.createMigrator !== 'function' ||
      typeof yuppeeApi.createMigration !== 'function') {
      throw new Error('yuppee is not available. Did you sync lib/yuppee.js?');
    }

    const migrations = STORAGE_MIGRATIONS.map((step) => yuppeeApi.createMigration({
      name: step.name || `storage-v${step.from}-to-v${step.to}`,
      from: step.from,
      to: step.to,
      migrate: async (input) => {
        const { version, ...payload } = input;
        let output = payload;
        if (step.jsonata) {
          output = await runJsonata(step.jsonata, output);
        }
        if (typeof step.hook === 'function') {
          output = step.hook(output);
        }
        return output;
      }
    }));

    const latestTarget = migrations.length
      ? Math.max(...migrations.map((migration) => migration.to))
      : undefined;

    return async (input = { version: 1 }) => {
      const currentVersion = input.version;
      const target = latestTarget ?? currentVersion;
      if (typeof currentVersion !== 'number') {
        throw new Error(
          `Expected object with version number but version was ${currentVersion}`
        );
      }
      if (currentVersion > target) {
        throw new Error(
          `Cannot process state with version ${currentVersion}, highest known version is ${target}`
        );
      }
      if (currentVersion === target) {
        return { ...input, version: target };
      }

      let state = { ...input };
      let cursor = currentVersion;
      while (cursor < target) {
        const candidates = migrations
          .filter((migration) => migration.from === cursor && migration.to > cursor)
          .sort((a, b) => (a.to > b.to ? -1 : 1));
        const step = candidates.at(0);
        if (!step) {
          throw new Error(`Migration from v${cursor} to v${cursor + 1} missing`);
        }
        const migrated = await step.migrate(state);
        state = { ...migrated, version: step.to };
        cursor = step.to;
      }
      return state;
    };
  }

  window.YachexpStorageMigrations = {
    STORAGE_MIGRATIONS,
    getLatestMigrationTarget,
    buildStorageMigrator
  };
})();
