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
- Replace the deprecated `deny-licenses` option in `dependency_review.yml` with
  an `allow-licenses` list of permissive licenses and CC BY-NC-SA 4.0, so GPL
  and LGPL stay blocked.
- Check development dependencies too in `dependency_review.yml`, by setting
  `fail-on-scopes` to `runtime, development`.
- docs(status): record the v0.1.0 release [c281c1e](https://github.com/homelab-alpha/kairos/commit/c281c1e0222aeb33105bb9138d06b8ac48f6dadb) by [@homelab-alpha](https://github.com/homelab-alpha)
- docs(branding): add the social preview [70181af](https://github.com/homelab-alpha/kairos/commit/70181afb98be862d79cc1cb5a8ea5eb6a54482e4) by [@homelab-alpha](https://github.com/homelab-alpha)
- docs(branding): update social preview text [49e7945](https://github.com/homelab-alpha/kairos/commit/49e794536afaa9e2c185fb90a4de5b92847f1a20) by [@homelab-alpha](https://github.com/homelab-alpha)
- test(smoke): fix the clock in the scroll test [a81c2d5](https://github.com/homelab-alpha/kairos/commit/a81c2d5111b61e6ff4672be76b12f6923977f5b1) by [@homelab-alpha](https://github.com/homelab-alpha)
- docs(status): record the fixed smoke test clock [c8b7b86](https://github.com/homelab-alpha/kairos/commit/c8b7b866665882e20ab6cfd6a94263ad351cb122) by [@homelab-alpha](https://github.com/homelab-alpha)
- chore: adopt the blueprint template updates [31c404d](https://github.com/homelab-alpha/kairos/commit/31c404dc024efef9125722471e27e26be443918a) by [@homelab-alpha](https://github.com/homelab-alpha)
- chore(repo): sync the latest blueprint updates [1ad0d13](https://github.com/homelab-alpha/kairos/commit/1ad0d1300bd0048c698e81ea987027a19b245dcd) by [@homelab-alpha](https://github.com/homelab-alpha)
- chore(workflows): replace deny-licenses with allow-licenses [2e594e5](https://github.com/homelab-alpha/kairos/commit/2e594e51c8fc67db9d5d11f8cd0dd5a7d29057c2) by [@homelab-alpha](https://github.com/homelab-alpha)
- chore(blueprint): sync with the blueprint [404a89c](https://github.com/homelab-alpha/kairos/commit/404a89cb690b0cfe6bd738532885fa75e43eb59a) by [@homelab-alpha](https://github.com/homelab-alpha)
- ci(workflows): request a reviewer on bot PRs [02bfacc](https://github.com/homelab-alpha/kairos/commit/02bfacc7c0e18c3d1ea978a94c12f09e2e3b5e13) by [@homelab-alpha](https://github.com/homelab-alpha)
- chore(github): sync Hugo and Dart Sass rules [44598b7](https://github.com/homelab-alpha/kairos/commit/44598b7dbfd9a0e0a53731bbba460198b05ec2b9) by [@homelab-alpha](https://github.com/homelab-alpha)
- chore(github): sync runners, Renovate, and linters [d4c42ac](https://github.com/homelab-alpha/kairos/commit/d4c42ac64f46746b330837e4286bdd3300ebe06c) by [@homelab-alpha](https://github.com/homelab-alpha)
- ci(workflows): run workflows for bots [0b18235](https://github.com/homelab-alpha/kairos/commit/0b182357f9a3bcab60608d77c1e723a1e1020805) by [@homelab-alpha](https://github.com/homelab-alpha)
- ci(workflows): allow BlueOak-1.0.0 license [3fcf5c2](https://github.com/homelab-alpha/kairos/commit/3fcf5c26da87db241c7108720c72d94dfa011efd) by [@homelab-alpha](https://github.com/homelab-alpha)
- chore(labels): add dependency update labels [6bf7e72](https://github.com/homelab-alpha/kairos/commit/6bf7e728f753f8b64a81274c4107289406db5448) by [@homelab-alpha](https://github.com/homelab-alpha)

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
