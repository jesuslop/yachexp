# Release Action Plan (Firefox XPI Beta)

This plan is scoped to producing a beta-quality XPI for direct download via AMO unlisted distribution, setting up auto-updates, and adding a simple donation pathway. It assumes a solo dev workflow with manual tests and fast iteration.

## Goals
- Produce a signed, installable XPI for advanced users.
- Provide optional auto-update capability.
- Publish clearly scoped release notes and documentation.
- Add a lightweight “buy me a coffee” donation path.
- Keep the workflow simple and repeatable on Windows.

## Phase 1 — Baseline Readiness
1. Confirm core metadata
   - Ensure `manifest.json` has accurate `name`, `version`, `description`, `author`, `homepage_url`, and `browser_specific_settings.gecko.id`.
   - Ensure permissions are minimal and documented.

2. Document known limitations
   - List any current limitations and edge cases in `README.md` or `docs.md`.
   - Add a short “Beta” disclaimer in the README.

3. License and attribution
   - Confirm `LICENSE` is MIT and referenced in README.
   - Ensure third‑party dependencies are attributed if required.

## Phase 2 — Packaging Workflow (XPI)
1. Choose a packaging tool
   - Option A: `web-ext` CLI (Recommended)
     - Pros: Official Mozilla toolchain; validates manifest; signs XPI.
     - Cons: Requires a Mozilla developer account for signing.
   - Option B: Manual zip + signing
     - Pros: No extra CLI overhead.
     - Cons: Easy to get wrong; still needs signing for installability.

2. Set up a repeatable packaging script
   - Create a PowerShell script (e.g., `scripts/package.ps1`) that:
     - Cleans any build output
     - Runs `web-ext build` (or zips output)
     - Places XPI in a `dist/` folder

3. Store release artifacts
   - Keep `dist/` out of git, unless you want to attach artifacts to releases only.

## Minimal Packaging Script (PowerShell)
Create `scripts/package.ps1` with the following behavior:
- Ensure `dist/` exists.
- Run `web-ext build` from the project root.
- Output the XPI into `dist/`.

Example behavior (pseudocode):
- `web-ext build --overwrite-dest --artifacts-dir dist`

## Phase 3 — Signing and Auto‑Updates
1. Update strategy (Selected: AMO unlisted distribution)
   - Upload as “unlisted” to AMO for auto‑updates without public listing.
   - Pros: Mozilla handles updates; no public listing required.
   - Cons: Slower release turnaround; AMO review policy applies.

2. Set up signing
   - Create a Mozilla developer account.
   - Generate API keys for `web-ext sign`.
   - Store keys in environment variables (not in repo).

3. Configure updates
   - Use AMO “unlisted” channel and follow their update mechanism.

## AMO Unlisted Workflow (Concrete Steps)
1. Create a Mozilla developer account.
2. Create an unlisted add-on entry in AMO.
3. Generate API keys for `web-ext sign`.
4. Set environment variables for the API keys.
5. Run `web-ext sign` to produce a signed XPI.
6. Upload the signed XPI to the unlisted add-on page.
7. Share the unlisted download link with beta users.

## Phase 4 — Donation / Support
1. Platform (Selected: Ko‑fi with Stripe)
   - Pros: Easy setup; supports credit cards via Stripe.
   - Cons: Fees; limited customization.

2. Add entry points
   - Add a “Support” link in the README.
   - Optional: Add a non‑intrusive “Support” button in the extension UI.

## Phase 5 — Release Process
1. Create a release checklist
   - Bump version in `manifest.json`.
   - Run packaging script.
   - Sign XPI.
   - Upload signed XPI to AMO unlisted.
   - Publish GitHub release with changelog and link to AMO unlisted page.

2. Communicate clearly
   - Provide install steps for advanced users.
   - Include a short FAQ for permissions and privacy.

## Phase 6 — Post‑Release Maintenance
1. Track issues
   - Add a GitHub Issue template for bug reports.
   - Encourage users to include Firefox version and OS.

2. Keep a lightweight changelog
   - Use GitHub Releases or a simple `CHANGELOG.md`.

## Suggested Next Decisions
1. Decide if you want a minimal packaging script now or later.

If you want, I can turn this plan into a concrete, step‑by‑step workflow and draft the actual scripts and `updates.json` template once you choose the update strategy.
