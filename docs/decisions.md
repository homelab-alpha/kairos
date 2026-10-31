# Decisions

Newest first. Add a dated entry for every decision that is not obvious from the
code. The sections under "Foundations" describe how the project works today.

## 2026-10-31: Smoke tests use a fixed clock

- The scroll test clicked a calendar day after today. The mock only has prices
  for today, so on the last day of a month no such day exists and the Smoke Test
  failed on every pull request (found on the Node.js update, #7).
- A smoke test that depends on the current date gets a fixed clock with the
  `now` option of `installMock`, so the result does not depend on the run date.

## 2026-10-27: Clean start and the first release

- Kairos starts in a clean repository with one commit that holds the code at
  version 0.1.0. The first release, `v0.1.0`, is a final release made with the
  Release Manager (bump `minor`, release type `final`).
- There is no `v0.0.0` tag. The Release Manager treats a missing tag as
  `v0.0.0`.
- Versions below 1.0.0 may change options and behavior without a migration path.
  Version 1.0.0 is the first stable release; contributions open then.
- The card is installed by hand. Home Assistant is building its own marketplace
  (HACS is becoming that marketplace), so the card moves there when it is ready.

## Foundations

### Card

- Single file, no dependencies, no build step. Shadow DOM and hand-written SVG.
- No backward compatibility and no migration code before 1.0.0.
- Brand: the name **Kairos** (Greek καιρός, the right moment), the slogan
  "Charge at the right moment.", and a logo of a price line with quarter-hour
  steps and one highlighted dip. The style follows the Apple HIG. The logo text
  is converted to outlines (Inter, SIL Open Font License).
- The logo accent is teal (`#30B0C7` light, `#40CBE0` dark). The card uses blue
  (Now marker, links), purple (cheapest slots), and the green to red heat
  colors, so teal is never mistaken for a data color. Brand colors are for brand
  assets only; the card keeps its own tokens.
- The card type is `custom:kairos-card`, the file is `kairos_card.js`, and the
  resource path is `/local/kairos_card.js`. The code prefix is `KAIROS_`.
- The default header (`source: custom`) shows the Kairos logo on a neutral tile
  and the title `Kairos`. `title` and `icon` belong to the custom source and
  override them; the other sources show their own title and logo and ignore both
  options (the editor hides the rows).
- `source` (`custom`, `nord_pool`, `entsoe`) picks the title and logo. The marks
  of Nord Pool and ENTSO-E are drawn as inline SVG. `KAIROS_SOURCES` is the
  place for source specific settings. When a source needs a username, password,
  or API key, list those fields there and show them in the editor for the
  selected source. Keys in a dashboard configuration are visible to everyone who
  can edit the dashboard, so prefer a Home Assistant secret or the integration
  itself.
- Display mode per device type: `display_mode_desktop` (mouse),
  `display_mode_touch` (tablet and smartphone), and `display_mode_kiosk`. The
  first two offer `auto`, `compact`, and `regular`; the kiosk offers all five
  modes. The browser cannot tell a wall display from a desktop, so a `kiosk`
  switch marks the card. Touch is found with `pointer: coarse`, so an iPad with
  a mouse may count as touch.
- `auto` reads the width of the card, not the screen: compact below 720 px, then
  regular. On a kiosk it goes on to `large` above 1024 px and `kiosk` above 1600
  px. This keeps the card readable in the narrow editor preview.
- `period` follows the start day: a day offers 15 min and hour, a week hour and
  day, a month day and week, a year week and month, a quarter day, week, and
  month. Calendar periods are chosen with two taps.
- Zoom is off by default. Desktop and touch gestures and the buttons are four
  separate options. On touch only a reset button is shown, and only while
  zoomed. The zoom buttons sit inside the chart at the top right and have no
  backdrop blur (it left white artifacts on iOS).
- The cheapest summary (heatmap view) replaces a list of cheapest windows. The
  selection readout below the chart is removed; the callout shows the selected
  slot and its breakdown. The chart keeps a fixed height per display mode.
- The min/max labels show only the price, with one decimal in ct units (or the
  `decimals` option).
- Price defaults are neutral: `energy_tax` and `fixed_price` are `0` and
  `fixed_label` is empty, so a new install shows the market price plus VAT. An
  empty `fixed_label` shows the translated name of the energy company. VAT is on
  at 21 percent, because the only source is Dutch.
- The card reads no `yesterday` attribute. Yesterday and older days come only
  from the recorder history of `history_entity`.
- `chart_style` (`auto`, `bars`, `line`) is the only chart option; it defaults
  to `bars`. `chart_type` stays as the name of the on-screen control and the
  internal state.
- On the day the clock goes back, the repeated hour is written `02A` (summer
  time) and `02B` (winter time), like the power market. The mark comes from the
  clock itself, so the card needs no list of DST dates.
- The visual editor has English and Dutch text next to the card text. It follows
  the language of Home Assistant and falls back to English. A smoke test checks
  that both languages have the same keys and that every row has a text.
- Every translation placed in HTML goes through `_th`, the escaped version of
  `_t`. `_t` stays unescaped because its result is also used as plain text.
  `fixed_label`, `unit`, and `currency` are validated as text in `setConfig`.
- The card has no line over 120 characters. Long HTML and SVG strings are split
  into `+` concatenations at tag or attribute boundaries.

### Experimental options

- All experimental options sit in an `Experimental` section at the end of the
  visual editor, so they are easy to find and to remove. They use internal Home
  Assistant behavior that can change.
- Edit button (`edit_button`, off by default; icon `edit_button_icon`) and edit
  link (`edit_link`, an `Edit` text link in the footer, in the accent color).
  Home Assistant has no public API for opening a card editor, so the first press
  turns on the dashboard edit mode with `?edit=1`, waits up to five seconds for
  the card path, and fires `ll-edit-card` once. Only administrators see them.
- Dashboard resource button (Check, Update, Reload): one smart button that shows
  the next step. Check reads the version from the file on the server (fetched
  without cache) and compares it with the resource URL. Update sets the resource
  to `/local/kairos_card.js?v=<version>` with the admin WebSocket commands
  `lovelace/resources` and `lovelace/resources/update`; it does not create a
  resource and does not work with YAML mode. Reload saves or cancels the card
  dialog, presses Done in the dashboard toolbar, removes `?edit=1`, and reloads;
  if the dialog does not close, the page is not reloaded, so no changes are
  lost. A `sessionStorage` flag makes the new page press Done again while
  `?edit=1` is in the address. The `update_menu` option (off by default) shows
  the same row in an `Update` section at the top of the editor.

### Versioning and releases

- On a `dev/v<major>.<minor>.<patch>/...` branch `KAIROS_VERSION` has a fourth
  number (`0.2.5.0`, `0.2.5.1`, ...) that goes up with every update. It makes
  every test build recognizable and busts the browser cache without using up the
  real version. Before the merge the version is set to the final three-number
  version, and only that version reaches `main`.
- Branches for a planned version are `dev/v<major>.<minor>.<patch>/<topic>`, for
  the maintainer only. All other branches use `type/short-description`.
  Wildcards such as `v0.2.*` are never used in a branch name.
- Every pull request description is built from
  `.github/pull_request_template.md`.
- The Release Manager checks before it starts that the tag does not exist and
  that no changelog pull request is open. It resets a leftover changelog branch.
  The changelog pull request does not block the release: when it fails, the
  release is still published and the job summary says what to check. The
  repository setting that lets GitHub Actions create pull requests must be on;
  the error message and `docs/development.md` name it.
- The changelog follows Keep a Changelog. The text in `[Unreleased]` moves to a
  `## [version] - date` section and becomes the release notes, and an empty
  `[Unreleased]` stays on top. The commit list is only the fallback.
- Workflows read `inputs.*` through job-level variables (`env`), not straight
  into `run:` scripts.

### Linting and tests

- Pull requests run `npm run lint` (`scripts/lint.sh`): Prettier, textlint
  terminology, and merge conflict markers, on the files changed in the pull
  request, with the configuration of Super Linter (`.prettierrc`,
  `.prettierignore`, `.github/linters/.textlintrc`). It also checks `npm audit`
  (high and critical) and the registry signatures. `npm run lint:fix` repairs
  simple problems; check `git diff` afterwards, because textlint rewrites words.
- Super Linter runs only on pushes to `main` and by hand. It adds actionlint,
  Gitleaks, Checkov, and the others, so a workflow error or a secret is found
  after the merge. Run it locally before a pull request that changes a workflow.
- CI fixes nothing: a commit pushed by a workflow does not start the required
  checks again and cannot be pushed to a fork.
- `CONTRIBUTORS.md` is generated and is in `.prettierignore`. ESLint is not set
  up.
- The smoke test runs on a pull request only when the card, `tests/`,
  `package.json`, `package-lock.json`, or `smoke_test.yml` changed. The workflow
  still starts on every pull request and the job reports success when it skips
  the slow steps, because a `paths` filter would leave the required check
  waiting forever.
- Which real devices and browsers the maintainer tested on is asked as one
  multiple-choice call (Desktop, Laptop, Tablet, Smartphone, Ultra wide monitor
  (kiosk); Brave, Safari, Firefox). Only ticked items on real devices are
  recorded as verified in `docs/project_status.md`.

### Dependencies

- Node.js 24 LTS (`engines` is `^24.22.1`, and CI reads it). Renovate keeps
  Node.js on major version 24; the project moves to 26 when it becomes LTS.
- `ignore-scripts=true` in `.npmrc`, and CI uses `npm ci --ignore-scripts`. All
  dependencies are exact. Renovate pins npm ranges and waits 7 days
  (`minimumReleaseAge`) before a non-security update; security updates skip the
  wait.

### Repository

- The repository is public. Files are written as public: no personal data,
  credentials, or private entity names.
- The author and owner name is Homelab-Alpha, and the license is Apache-2.0. The
  public contact address is the one already used in the other public
  repositories of the maintainer.
- The blueprint rules apply: Conventional Commits, branches with pull requests,
  `[Unreleased]` in the changelog, releases through the release workflow.
- Contributions are not accepted until release v1.0.0 is published; from then on
  they are very welcome.
- `docs/design_guidelines.md` is the fixed design standard. Every UI change
  follows it, and a changed rule is updated there in the same pull request.
- Project state and rules live in the repository (`CLAUDE.md`, `docs/`) so work
  can continue on any computer.
- Security settings: Dependabot alerts, malware alerts, and security updates on;
  version updates stay with Renovate. Ruleset for `main`: pull request required
  (0 approvals, squash only), required checks `GitGuardian Security Checks`,
  `Run Browser Smoke Test`, and `Perform npm Linting`, signed commits, no force
  pushes, no deletion; repository admins, Renovate, and Dependabot may bypass
  it. "Require branches to be up to date" is off. Actions use an allow list
  (`actions/*`, `github/codeql-action/*`, `super-linter/super-linter@*`,
  `super-linter/super-linter/*`, `eps1lon/actions-label-merge-conflict@*`) with
  pinning to a full-length commit SHA, read-only workflow permissions, and only
  squash merging.
