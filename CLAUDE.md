# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Run from the repository root:

```bash
npm ci                                      # install locked dependencies
npm test                                    # run all tests (Node's built-in test runner)
node --test tests/extension-extraction.test.js  # run one test file
node --test --test-name-pattern="pattern" tests/settings/normalize-settings.test.js  # filter tests by name
npm run deps:sync                           # copy pinned browser bundles into lib/
npm run build:xpi                           # package the extension as an XPI
npm run build:source-review                  # create the source-review package
npm run sign:unlisted                        # invoke AMO unlisted signing
```

The packaging scripts use PowerShell. There is no lint script or configured linter in `package.json`.

## Architecture

This is a Firefox extension that exports selected ChatGPT conversations as Markdown. The browser integration is wired in `manifest.json`: it injects the vendored Turndown libraries and `extension.js` on `chatgpt.com`, and registers `background.js` plus the options page.

The toolbar click is handled by `background.js`, which sends an export message to the active tab. `extension.js` is the main content-script pipeline: it extracts conversation turns from available page data, the same-origin conversation endpoint, or rendered DOM; ranks usable candidates; presents the question-selection dialog; preprocesses HTML/math; converts it with customized Turndown rules; applies the active export profile's templates; and downloads Markdown. The README describes the two-pass HTML preparation and Markdown conversion strategy. ChatGPT's page structure changes can affect extraction, so keep the alternate data/DOM paths and conversion rules in mind when changing this flow.

`options.html` and `options.js` implement profile editing and JSON settings import/export. Defaults live in `default-settings.json`; `background.js` initializes stored settings through `settings-update.js`, which validates/normalizes settings and delegates version transitions to `storage-migrations.js`. Migration and settings behavior is covered by Node tests under `tests/`; shared browser globals and fixtures are in `tests/helpers/` (see `testing.md` for the test conventions).

Third-party browser bundles are kept in `lib/`; `npm run deps:sync` refreshes them from the pinned npm dependencies. The packaging scripts collect extension files based on the manifest/options entry points and write build artifacts under `dist/`.
