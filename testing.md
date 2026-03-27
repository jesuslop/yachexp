# Testing

This repo uses Node’s built-in test runner (`node:test`) with a small set of helpers under `tests/helpers/`. The focus is on deterministic, fast, dependency-light tests for the settings migration system and related utilities.

**Quick Run (Developer Users)**
Run all tests:
```bash
npm test
```
Run with Node directly:
```bash
node --test
```

**Testing Philosophy (Future Developers)**
- Keep tests deterministic and fast. Prefer real code paths over heavy mocking.
- Use real `yuppee` in tests to validate migration graph behavior.
- Use a JSONata mock for migration-path tests to avoid async JSONata evaluation in Node while still validating that JSONata transformations are wired correctly.
- Isolate browser globals in `tests/helpers/test-globals.js` so production files can be loaded without changes.
- Keep fixtures readable and centrally defined in `tests/helpers/fixtures.js`.

**How the Test System Is Organized**
- `tests/helpers/test-globals.js` sets up globals such as `browser`, `fetch`, `jsonata`, and `Yuppee`.
- `tests/helpers/fixtures.js` contains v1 settings builders, migration step definitions, and transformation helpers.
- `tests/migrations/migrate-paths.test.js` covers the migration path matrix.
- `tests/settings/normalize-settings.test.js` covers reset and error handling behavior.
- `tests/settings/replace-storage.test.js` covers storage replacement behavior.

**Adding New Test Cases**
When adding new migration cases:
1. Define new migration steps in `tests/helpers/fixtures.js` using JSONata strings or hooks that mirror the production pattern.
2. If the migration uses JSONata, add the JSONata expression to the mock mapping in `buildJsonataMock` so migration-path tests stay deterministic.
3. Add a path test to `tests/migrations/migrate-paths.test.js` to cover the new route and expected output.

When adding behavior tests:
1. Use `setupGlobals()` from `tests/helpers/test-globals.js` to load the production modules.
2. Add focused tests to `tests/settings/normalize-settings.test.js` or create a new file under `tests/settings/` if the scope is different.
3. Prefer table-driven tests when covering multiple similar cases.

**Notes**
- The tests load `settings-update.js` and `storage-migrations.js` directly, so they rely on globals. Keep test setup centralized in `tests/helpers/test-globals.js`.
- If you remove JSONata mocking and want to use real JSONata in migration-path tests, you will need to update `storage-migrations.js` or the test harness to handle async JSONata evaluation.
