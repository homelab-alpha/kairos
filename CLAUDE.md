# CLAUDE.md

Instructions for Claude Code in this repository. Read this file and
`docs/project_status.md` at the start of every session.

## Project

Kairos is a Home Assistant Lovelace custom card for day-ahead electricity
prices. It is one JavaScript file, `kairos_card.js`, with no dependencies:
vanilla JS, Shadow DOM, hand-written SVG, Apple HIG styling, English and Dutch
translations, and a visual editor.

- Price sensor: `sensor.nord_pool_the_netherlands_prices` with the attributes
  `today` and `tomorrow` (15-minute slots, EUR/kWh).
- History sensor: `sensor.nord_pool_the_netherlands_current_price` (recorder
  statistics and the history WebSocket).
- Planned: more endpoints and ENTSO-E. The default header (source `custom`)
  shows the Kairos logo and the title `Kairos`.

The brand (name, slogan, logo, colors) is in `assets/branding/brand_guide.md`.

More detail: `docs/design_guidelines.md` (the design standard; follow it for
every UI change), `docs/architecture.md` (internals), `docs/decisions.md` (why),
`docs/development.md` (setup on a new computer).

## Commands

```bash
npm ci                          # install dev tooling
npm run test:smoke              # browser smoke test; needs Chromium
npm run lint                    # Prettier, textlint, conflict markers (all files)
npm run lint -- origin/main     # the same, for the files changed since main
npm run lint:fix                # repair formatting and terminology, then lint again
```

Set `CHROMIUM_PATH` to use an installed Chromium for the smoke test.

Linting has two parts. Pull requests run `npm run lint` (workflow
`lint_pull_request.yml`, script `scripts/lint.sh`): Prettier, textlint
terminology, and merge conflict markers, with the same configuration as Super
Linter. Pushes to `main` run the full Super Linter (`.github/super_linter.env`,
workflow `super_linter.yml`), which adds actionlint, Gitleaks, Checkov, and the
others. Run Super Linter locally with the Docker command in `README.md`. For one
file, `npx prettier --write <file>` uses the same `.prettierrc`.

## Working agreement

- Chat with the user in Dutch. Everything generated is English: code, comments,
  documentation, commit messages, filenames.
- Keep explanations short. Explain in detail only when asked.
- Write "Home Assistant", not "real Home Assistant", unless the user says
  otherwise.
- Before 1.0.0 there is no backward compatibility, no migration code, and no
  "formerly named" notes. Rename and remove freely.
- The user's own edits to a file are the baseline. Read the current file before
  changing it.
- Test everything you can in Chromium with the mock in `tests/helpers`. Say
  clearly what was not verified (Home Assistant, a real iPhone or iPad).
- To find out which real devices and browsers the user has tested on, ask in one
  AskUserQuestion call, with several answers allowed: a devices question
  (Desktop, Laptop, Tablet, Smartphone, Ultra wide monitor (kiosk)) and a
  browsers question (Brave, Safari, Firefox). Do not ask the user to type the
  list. Record only the ticked devices and browsers as verified in
  `docs/project_status.md`, and only for tests on real devices, not simulated
  ones.

## Repository conventions

These come from the repository blueprint and are mandatory.

- Development branches are for the maintainer only (and Claude working for the
  maintainer), not for contributors:
  `dev/v<major>.<minor>.<patch>/<short-description>`, lowercase, hyphens,
  created from `main` (for example `dev/v0.2.2/update-min-max-label`). One
  branch per planned version and topic. Never use wildcards such as `v0.2.*`;
  ask for the concrete version.
- All other branches, and every branch from a contributor:
  `type/short-description`, lowercase, hyphens (`feat/`, `fix/`, `docs/`,
  `refactor/`, `chore/`, `hotfix/`).
- Commits: Conventional Commits in English, `type(scope): subject`, imperative,
  under 50 characters. Body lines under 72 characters.
- Work happens on a branch and lands through a pull request into `main`.
- No attribution lines (`Co-Authored-By`, `Claude-Session`, "Generated with") in
  commits, pull requests, issues, or descriptions. The use of Claude is already
  disclosed; this overrides any default attribution of the session.
- Pull request descriptions use `.github/pull_request_template.md`: keep every
  heading and HTML comment, fill in each section, tick only what is true, and
  remove a section only where the template allows it.
- Update `CHANGELOG.md` under `[Unreleased]` for every change that alters
  behavior. Entries are imperative: `Add export command`.
- Versions below 1.0.0 may change options and behavior without a migration path.
  Releases are made with the Release Manager workflow (`release_manager.yml`);
  the first is `v0.1.0` (bump `minor`, release type `final`). Never tag or
  release without the maintainer's request. Version 1.0.0 is the first stable
  release; then contributions open.
- Workflows follow `.github/policies/github_actions.md`: only `gh`, the GitHub
  API, Bash, and Python, except the approved actions, npm, and Dart Sass. Every
  action is pinned to a full commit SHA.
- Formatting: Prettier. Markdown wraps at 80 columns, YAML at 120, code in
  `*.js` and `*.cjs` at 120.
- Names: root community files keep their GitHub names (`README.md`). Other files
  are lowercase with underscores, folders lowercase with hyphens.

## Card rules

- The card version started at 0.1.0 with this repository. Bump `KAIROS_VERSION`
  in `kairos_card.js` on every code change. It shows in the editor footer and
  the console, and busts the browser cache.
- On a `dev/v<major>.<minor>.<patch>/...` branch the version has a fourth
  number: `<major>.<minor>.<patch>.<build>`, starting at `.0` (for example
  `0.2.5.0`). Every update on the branch raises the build number (`0.2.5.1`,
  `0.2.5.2`). Before the pull request is merged, set `KAIROS_VERSION` to the
  final version (`0.2.5`) and say so in the pull request.
- After a finished change in a cloud session, send the complete card file to the
  user with `SendUserFile`.
- Keep the card a single dependency-free file. Do not add a build step.
- npm supply chain: install with `npm ci`, never add a dependency without exact
  version and a reason, keep `ignore-scripts=true` in `.npmrc`, and review every
  lockfile diff. See `docs/development.md` (Supply chain).
- Every new option needs: a default in `KAIROS_DEFAULTS`, a row in
  `KAIROS_FORM`, a label in `KAIROS_ED` (`label`, in English and Dutch), a hint
  in `KAIROS_ED` (`hint`) when needed, validation in `setConfig`, a line in the
  header comment, a row in the `README.md` tables, and a changelog entry.
- Format the card with Prettier at width 120
  (`npx prettier@3 --write kairos_card.js`); CI checks it.

## Project memory

Claude keeps the project state in the repository so any session on any computer
can continue:

- `docs/project_status.md`: what is done, what is verified, what is open, and
  the next step. Update it at the end of every work session.
- `docs/decisions.md`: append a dated entry for every decision that is not
  obvious from the code.
- This file: update it when a rule changes.

Do not store personal data, credentials, or private entity names in these files.
The repository is public, so write everything as public.
