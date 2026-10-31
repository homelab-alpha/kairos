# Development

How to set up and continue on any computer, without a previous session.

## Set up

```bash
git clone https://github.com/homelab-alpha/kairos.git
cd kairos
npm ci
npx playwright install chromium
npm run test:smoke
```

Requirements: Git, Node.js 24 (LTS).

## Continue with Claude Code

1. Open the repository folder in Claude Code.
2. Claude reads `CLAUDE.md` automatically. Ask it to read
   `docs/project_status.md` and continue.
3. At the end of a session Claude updates `docs/project_status.md` and
   `docs/decisions.md`. Commit them with the work.

Shared permissions are in `.claude/settings.json`. Personal overrides go in
`.claude/settings.local.json`, which is ignored by Git.

## Work flow

1. Branch from `main`: `git switch -c feat/short-description`.
2. Change the card. Bump `KAIROS_VERSION` (on a `dev/` branch the fourth number,
   for example `0.2.5.1`; the final version has three numbers).
3. Add a line under `[Unreleased]` in `CHANGELOG.md`.
4. Run `npm run test:smoke` and Super Linter (see below).
5. Commit with a Conventional Commit message and open a pull request.

## Try the card in Home Assistant

Copy `kairos_card.js` to `/config/www/` and add the resource
`/local/kairos_card.js?v=<version>` as a JavaScript module. Change the `v`
parameter after each change, or the browser keeps the old file. The card is
installed by hand.

## Linting

Linting has two parts, to save Actions minutes.

- **Pull requests** run `npm run lint -- origin/main` (workflow
  `lint_pull_request.yml`, script `.github/scripts/lint.sh`). It checks the
  changed files with Prettier (JS, JSON, Markdown, YAML), textlint terminology
  (`.github/linters/.textlintrc`), and merge conflict markers. Run
  `npm run lint` to check every file. It uses the same configuration as Super
  Linter, so the results match for these checks. Every problem is shown with its
  file and line, as an annotation on the pull request, and in the job summary.
  `npm run lint:fix` repairs formatting, wrapping, and the terminology that
  textlint can fix; check `git diff` before you commit.
- **Pushes to `main`** run the full Super Linter, configured in
  `.github/super_linter.env`. It adds actionlint, Gitleaks, Checkov, the ENV
  linter, and the others. A problem in a workflow file or a secret is only found
  there, after the merge, so run the Docker command below before a pull request
  that changes a workflow.

```bash
docker run --rm -e RUN_LOCAL=true -e USE_FIND_ALGORITHM=true \
  -e VALIDATE_ALL_CODEBASE=true --env-file .github/super_linter.env \
  -v "$PWD":/tmp/lint ghcr.io/super-linter/super-linter:v8.7.0
```

For one file, `npx prettier --write <file>` uses the same `.prettierrc`.

## Tests

`tests/helpers/mock_hass.cjs` mounts the card or the editor with a mocked Home
Assistant. `tests/smoke.cjs` uses it. Add a check for every fixed bug. Anything
that cannot be checked in Chromium (Home Assistant, real touch devices) goes in
the "Not verified" list of `docs/project_status.md`.

## Releases

Releases are made by hand with the Release Manager workflow (Actions, Release
Manager, Run workflow). Before the first run:

- Turn on **Allow GitHub Actions to create and approve pull requests** in
  Settings, Actions, General, Workflow permissions. It is off by default, and
  without it the workflow cannot open the changelog pull request.
- Write the changes of the release under `[Unreleased]` in `CHANGELOG.md`.

How it works:

1. Run it first with the simulation (dry run) on. It shows the version, the
   release notes, and the changelog without changing anything.
2. The workflow checks that the tag does not exist and that no changelog pull
   request is open.
3. It moves the text of `[Unreleased]` into a new `## [version] - date` section,
   keeps an empty `[Unreleased]` above it, and uses that text as the release
   notes. When `[Unreleased]` is empty, it uses the commit list instead.
4. It opens a pull request with the changelog change, publishes the release (a
   prerelease for `alpha` and `beta`), and posts an announcement.
5. Merge the changelog pull request after the release is published.

If the changelog pull request cannot be created, the release is still published.
The changelog commit is on the branch `chore/changelog-<tag>`: open the pull
request from there. A branch left over from an earlier run is reset on the next
run.

## Supply chain

The dev tooling comes from npm, so the install is locked down:

- `.npmrc` turns off install scripts (`ignore-scripts=true`), so no dependency
  runs code when it is installed. None of the current packages needs one. CI
  also passes `--ignore-scripts` to `npm ci`, so a pull request cannot turn the
  scripts back on by changing `.npmrc`.
- Every dependency has an exact version in `package.json`, and
  `package-lock.json` holds the integrity hash of each package. Always install
  with `npm ci`, which fails when the lockfile and `package.json` disagree. Use
  `npm install` only to add or update a package, and review the lockfile diff.
- `engine-strict=true` and `engines` keep installs on Node.js 24.
- The pull request lint runs `npm audit --audit-level=high` and
  `npm audit signatures`, which checks the registry signatures.
- Renovate waits 7 days after a release before it opens a pull request, so a
  hijacked release is usually found and pulled first. Security updates are not
  delayed.
- The workflows have read-only permissions, do not keep credentials after
  checkout, and use actions pinned to a commit SHA.
- Browsers: Playwright downloads Chromium with
  `npx playwright install chromium`, from its own host. That is the only
  download outside npm.
