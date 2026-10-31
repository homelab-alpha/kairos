# Project Status

Last updated: 2026-10-31. Card version: 0.1.0.

## State

The card is feature complete for the Nord Pool Netherlands source. Versions
below 1.0.0 may change options and behavior without a migration path. This
repository starts with a clean history. The first release, `v0.1.0`, was
published on 2026-10-27 with the Release Manager.

Done:

- Price, heatmap, and breakdown views with bar and line charts.
- Ranges: week, month, year, quarter, and custom periods from the calendar, with
  per-range resolution (15 min, hour, day, week, month) and week numbers.
- Zoom with separate options for desktop and touch gestures and for the buttons.
- Visual editor with grouped sections, validation, an option to open all
  sections, and period options that follow the start day.
- Cheapest summary (heatmap view) with a countdown.
- Min/max labels show the price only, without the time.
- Display mode per device type: desktop/laptop, tablet/smartphone, and kiosk.
- Compact layout below 720 px, which is how the card looks in the Home Assistant
  card configuration dialog.
- Kairos brand: name, slogan, logo, icons, favicon, and brand guide in
  `.github/branding/`.

## Verified

- Chromium with a mocked Home Assistant (`npm run test:smoke` and manual
  scripts).
- DST days (92 slots on 2026-03-29, 100 slots on 2026-10-25) and the states
  `unavailable`, `unknown`, malformed rows, and missing tomorrow data, in the
  same mock.
- Real devices, reported by the maintainer (Home Assistant app = the official
  Home Assistant app). This check was made before the rename to Kairos, with the
  same code.

  | Device                             | Browsers and app                              |
  | :--------------------------------- | :-------------------------------------------- |
  | Desktop: Fedora                    | Brave, Firefox                                |
  | Laptop: MacBook Air M4             | Brave, Safari; Home Assistant app on macOS 27 |
  | Smartphone: iPhone 17 Pro Max      | Safari; Home Assistant app on iOS 27          |
  | Tablet: iPad Air (3rd generation)  | Safari; Home Assistant app on iPadOS 26       |
  | Kiosk: ultrawide monitor (34 inch) | Wall display reported OK                      |

  Checked: the 25-hour day of 2026-10-25 (bars, axis, min/max, cheapest
  summary), all history ranges including the recorder `week` statistics period,
  display modes (also on a real wall display and with the `kiosk` switch), touch
  gestures and zoom buttons on a real iPhone and iPad (also an iPad with a
  mouse), the countdown of the cheapest summary, light and dark mode with
  `prefers-reduced-motion`, the experimental edit button (sections view and
  other views), the dashboard resource button (Check, Update, Reload) with the
  `update_menu` option, and the edit link in the footer. Firefox was not part of
  the last check.

- The code of version 0.1.0 in Home Assistant (2026-10-27, reported by the
  maintainer), installed by hand with `/local/kairos_card.js` and
  `custom:kairos-card`: it works as expected. Devices: desktop, laptop, tablet,
  smartphone, and the ultrawide monitor (kiosk). Browsers: Brave, Safari, and
  Firefox, and the Home Assistant app.

- Page scroll over the breakdown tables no longer stalls (resize loop fixed;
  reproduced and checked with wheel events in Chromium).

- The Release Manager in this repository (2026-10-27): a dry run passed, then
  the real run (bump `minor`, release type `final`) published `v0.1.0` as the
  latest release, with a verified tag and an announcement in GitHub Discussions.
  The changelog pull request was merged.

- The repository settings after the clean start (2026-10-27, checked by the
  maintainer and through the GitHub API): the `main` ruleset is active; squash
  merge is the only merge method; the Actions allow list, pinning to a full
  commit SHA, read-only workflow permissions, and pull requests created by
  Actions are set; secret scanning, push protection, Dependabot alerts, malware
  alerts, security updates, and private vulnerability reporting are on; code
  scanning (CodeQL) ran and has no alerts.

- The Smoke Test no longer depends on the run date (2026-10-31): the scroll test
  uses a fixed clock. It had failed on the last day of the month. Checked in
  Chromium, 165 checks pass.

## Not verified

- The cleanup made after the Home Assistant check (dead VAT switch code removed,
  seven long lines split, `kairos-card` named in the architecture notes) was
  checked with the smoke test and a comparison of the rendered HTML for 12
  configurations (identical), not in Home Assistant.
- The failure paths of the Release Manager (an existing tag, an open changelog
  pull request, a leftover branch, a failing pull request step) were tested with
  a stubbed `gh` only.

## Open items

- Read ENTSO-E data (and its credentials) in the card; `source` only brands the
  header today.
- Native Home Assistant sensor with the cheapest time blocks, for automations
  such as charging a home battery (see `ROADMAP.md` backlog). The card cannot do
  this itself: it only runs while a dashboard is open.
- Version 1.0.0 is the first stable release; contributions open then.

## Next step

Continue with ENTSO-E and additional endpoints, on a
`dev/v<major>.<minor>.<patch>/...` branch for the next planned version.
