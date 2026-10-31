# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Move the brand assets from `branding/` to `.github/branding/` and drop the
  `kairos_` prefix from the filenames.
- Replace the third-party README badges with self-hosted SVG badges, rendered
  by the new `badges.yml` workflow and `.github/scripts/generate_badges.py` to the
  `badges` branch.
- Sync the repository with the Blueprint template: the label sync retries and
  skips unchanged labels, the dependency review comments on a pull request only
  on failure, Prettier and the lint script also check `.mjs` files, and the
  Terms of Service, the policies, and the style guide describe the current
  lint, pinning, and license rules.
- Move the repository tooling (`lint.sh`, `generate_badges.py`, `setup_gpg.sh`,
  and `verify_signatures.sh`) from `scripts/` to `.github/scripts/`, and the code
  style guide from `docs/` to `.github/docs/`. `docs/` keeps the project
  documentation.
- Add a 20 px protective border to the logo SVGs and show the logo in
  `README.md` at a fixed height of 100 px.
- Update the badges only after Lint Repository and CodeQL ran and passed for the
  same commit: remove the `push` trigger from `badges.yml` and add the
  `check-workflows` job.

### Security

- Override the transitive dev dependencies `glob` (14.0.3) and `minimatch`
  (11.0.3) to fix Dependabot alerts, which textlint pulls in.

## [0.1.0] - 2026-10-27

### Added

- Add Kairos, a Home Assistant Lovelace card for day-ahead electricity prices.
  It reads the Nord Pool integration (Netherlands, 15-minute prices) and is
  installed by hand.
- Add the price, heatmap, and breakdown views with bar and line charts.
- Add the ranges week, month, year, quarter, and custom periods, with a
  resolution per range and week numbers.
- Add zoom with separate options for desktop and touch, and for the buttons.
- Add the cheapest summary with a countdown in the heatmap view.
- Add display modes for desktop and laptop, tablet and smartphone, and kiosk,
  and a compact layout below 720 px.
- Add the visual editor with grouped sections, validation, and English and Dutch
  translations.
- Add the `source` option (`custom`, `nord_pool`, or `entsoe`) for the header.
  The default header shows the Kairos logo and the title `Kairos`.
- Add an experimental edit button and an experimental dashboard resource button
  (Check, Update, Reload).
- Add the Kairos brand: the name, the slogan `Charge at the right moment.`, and
  the logo, app icons, and favicon as SVG files in `assets/branding/`, with a brand
  guide.
