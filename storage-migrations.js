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

  function runJsonata(expression, state) {
    if (typeof jsonata !== 'function') {
      throw new Error('jsonata is not available. Did you sync lib/jsonata.js?');
    }
    return jsonata(expression).evaluate(state);
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
      migrate: (input) => {
        const { version, ...payload } = input;
        let output = payload;
        if (step.jsonata) {
          output = runJsonata(step.jsonata, output);
        }
        if (typeof step.hook === 'function') {
          output = step.hook(output);
        }
        return output;
      }
    }));

    return yuppeeApi.createMigrator({
      migrations,
      init: () => ({})
    });
  }

  window.YachexpStorageMigrations = {
    STORAGE_MIGRATIONS,
    getLatestMigrationTarget,
    buildStorageMigrator
  };
})();
