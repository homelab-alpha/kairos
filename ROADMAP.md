# Roadmap

This document outlines the planned direction, current focus areas, and long-term
goals for **Kairos**. It is a living document and is updated as priorities shift
or new milestones are defined.

> [!IMPORTANT]
>
> This roadmap reflects the current intentions of the maintainers and is subject
> to change based on community feedback, new requirements, and project
> priorities. Items listed here are not guaranteed to be implemented or released
> on any specific timeline.

<details>
  <summary>Table of Contents (click to expand)</summary>
  <p>

1. [Roadmap](#roadmap)
   1. [Project Vision](#project-vision)
   2. [Current Status](#current-status)
   3. [Milestones](#milestones)
      1. [v0.1.0 — Initial Release](#v010--initial-release)
      2. [v0.2.0 — Verification](#v020--verification)
      3. [v0.x.0 — Sources and Stabilization](#v0x0--sources-and-stabilization)
      4. [v1.0.0 — First Stable Release](#v100--first-stable-release)
   4. [Backlog](#backlog)
   5. [Out of Scope](#out-of-scope)
   6. [Contributing to the Roadmap](#contributing-to-the-roadmap)

  </p>
</details>

## Project Vision

A Home Assistant card that makes day-ahead electricity prices easy to read and
act on: on a phone, a tablet, or a wall display. It reads prices from the
integrations people already use, stays a single dependency-free file, and
follows the Apple Human Interface Guidelines.

## Current Status

**Phase:** Alpha. The card is usable and changes frequently.

| Area                      | Status         |
| :------------------------ | :------------- |
| Price, heatmap, breakdown | ✅ Complete    |
| Ranges and calendar       | ✅ Complete    |
| Zoom (desktop and touch)  | ✅ Complete    |
| Visual editor             | ✅ Complete    |
| Repository and CI         | 🔄 In progress |
| Automated tests           | 🔄 In progress |
| More price sources        | ⏳ Planned     |
| First stable release      | ⏳ Planned     |

## Milestones

### v0.1.0 — Initial Release

**Goal:** A published, reproducible project that can be continued on any
computer.

- [ ] Publish the repository and cut the first release.
- [x] Document the zoom, button, and editor options in `README.md`.
- [x] Extend the browser smoke test in `tests/`.

### v0.2.0 — Verification

**Goal:** Confirm the card on real systems.

- [x] Verify all history ranges, including weeks, in Home Assistant.
- [x] Verify touch gestures and zoom buttons on a real iPhone and iPad.

### v0.x.0 — Sources and Stabilization

**Goal:** More price sources and a stable option set.

- [ ] A logo per source.
- [ ] Support more endpoints and ENTSO-E.
- [ ] Add a changelog entry and a test for every fixed bug.
- [ ] Publish the card in the Home Assistant marketplace when it is ready.

### v1.0.0 — First Stable Release

**Goal:** Production-ready, documented, and fully supported.

- [ ] All known bugs resolved.
- [ ] Open contributions from the community.
- [ ] Documentation complete and reviewed.
- [ ] No open security advisories.
- [ ] Announcement posted in GitHub Discussions.

## Backlog

The following items are under consideration but not yet scheduled for a specific
milestone. Community feedback on priority is welcome via
[GitHub Discussions](https://github.com/homelab-alpha/kairos/discussions/categories/feature-request).

- Additional languages beyond English and Dutch.
- Export of the visible range as CSV.
- Native Home Assistant sensor with the cheapest time blocks, the same blocks as
  the cheapest summary in the card. It is calculated in Home Assistant from the
  existing price sensor, so automations, such as charging a home battery in the
  cheapest quarters, keep working when no dashboard is open. The sensor only
  exposes the blocks and whether the current quarter is in one; switching
  devices stays in the user's own automations (see
  [Out of Scope](#out-of-scope)).
- Check the repository security settings: secret scanning, push protection,
  private vulnerability reporting, code scanning, and the ruleset for `main`.
- ENTSO-E as a source: reading ENTSO-E data with a username, password, or API
  key. The card only reads sensors today (see [Out of Scope](#out-of-scope)), so
  reading data needs a decision first.
- A sturdier update button. The experimental button for the dashboard resource
  relies on the undocumented `lovelace/resources` WebSocket command, which can
  stop working after a Home Assistant update.

## Out of Scope

The following are explicitly **not** planned for this project:

- A backend or integration that fetches prices; the card only reads sensors.
- Controlling devices or automations based on prices.

## Contributing to the Roadmap

We welcome input on the project's direction. To suggest a new feature or change
a priority:

1. Check the
   [existing feature requests](https://github.com/homelab-alpha/kairos/discussions/categories/feature-request)
   to avoid duplicates.
2. Open a new discussion in the Feature Request category.
3. Provide a clear problem statement and proposed solution.

Accepted proposals may be added to the backlog or a future milestone at the
maintainers' discretion. See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines
on how to contribute an implementation.
