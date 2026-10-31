<!-- markdownlint-disable MD041 -->

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/branding/logo_dark.svg" />
    <img src="assets/branding/logo_light.svg" alt="Kairos" width="320" />
  </picture>
</p>

[![Super Linter](https://github.com/homelab-alpha/kairos/raw/badges/super_linter.svg)](https://github.com/homelab-alpha/kairos/actions/workflows/super_linter.yml)
[![CodeQL](https://github.com/homelab-alpha/kairos/raw/badges/codeql.svg)](https://github.com/homelab-alpha/kairos/actions/workflows/codeql.yml)
[![Last commit](https://github.com/homelab-alpha/kairos/raw/badges/last_commit.svg)](https://github.com/homelab-alpha/kairos/commits/main/)
[![Repo size](https://github.com/homelab-alpha/kairos/raw/badges/repo_size.svg)](https://github.com/homelab-alpha/kairos/tree/main)
[![Changelog](https://github.com/homelab-alpha/kairos/raw/badges/changelog.svg)](https://github.com/homelab-alpha/kairos/blob/main/CHANGELOG.md)
[![Contributor Covenant](https://github.com/homelab-alpha/kairos/raw/badges/contributor_covenant.svg)](https://github.com/homelab-alpha/kairos/blob/main/CODE_OF_CONDUCT.md)
[![Conventional Commits](https://github.com/homelab-alpha/kairos/raw/badges/conventional_commits.svg)](https://conventionalcommits.org)
[![Semantic Versioning](https://github.com/homelab-alpha/kairos/raw/badges/semver.svg)](https://semver.org/spec/v2.0.0.html)
[![License](https://github.com/homelab-alpha/kairos/raw/badges/license.svg)](https://github.com/homelab-alpha/kairos/blob/main/LICENSE)

# Kairos

A Home Assistant Lovelace card for day-ahead electricity prices.

<details>
  <summary>Table of Contents (click to expand)</summary>
  <p>

1. [Kairos](#kairos)
   1. [Description](#description)
   2. [Features](#features)
   3. [Screenshots](#screenshots)
      1. [Desktop](#desktop)
      2. [Kiosk](#kiosk)
      3. [Smartphone](#smartphone)
      4. [Visual editor](#visual-editor)
   4. [Project Status](#project-status)
   5. [Getting Started](#getting-started)
      1. [Requirements](#requirements)
      2. [Prepare Home Assistant](#prepare-home-assistant)
         1. [Step 1: Install the Nord Pool integration](#step-1-install-the-nord-pool-integration)
         2. [Step 2: Create the template sensor](#step-2-create-the-template-sensor)
         3. [Step 3: Load the templates in `configuration.yaml`](#step-3-load-the-templates-in-configurationyaml)
         4. [Step 4: Check the sensors](#step-4-check-the-sensors)
      3. [Installation](#installation)
      4. [Configuration](#configuration)
         1. [Entities](#entities)
         2. [Header](#header)
         3. [Data and view](#data-and-view)
         4. [Prices and units](#prices-and-units)
         5. [Highlights](#highlights)
         6. [Chart](#chart)
         7. [Sections and controls](#sections-and-controls)
         8. [Opacity](#opacity)
         9. [Appearance](#appearance)
         10. [Experimental](#experimental)
   6. [Development](#development)
   7. [Project Structure](#project-structure)
   8. [CI/CD and Automation](#cicd-and-automation)
      1. [Workflows](#workflows)
      2. [Linting](#linting)
      3. [Dependency Management](#dependency-management)
   9. [Policies and Standards](#policies-and-standards)
   10. [Working with Claude](#working-with-claude)
   11. [Known Issues](#known-issues)
       1. [Currently Being Addressed](#currently-being-addressed)
   12. [Contributing](#contributing)
   13. [Support](#support)
   14. [Security](#security)
   15. [Roadmap](#roadmap)
   16. [License](#license)

  </p>
</details>

## Description

**Kairos** shows day-ahead electricity prices in Home Assistant as a price
chart, a heatmap, or a cost breakdown. It is a single JavaScript file with no
dependencies, built with Shadow DOM and hand-written SVG, and it follows the
Apple Human Interface Guidelines for layout, type, and touch targets.

The name comes from the Greek _kairos_ (καιρός), the right moment. The card
shows when electricity is cheapest, so you can charge your EV or your home
battery at the right moment, for a better price.

The card currently reads the Nord Pool integration (Netherlands) with 15-minute
prices. Support for more sources, such as ENTSO-E, is planned.

## Features

- **Three views** — Price, Heatmap, and Breakdown (off-peak, peak, off-peak),
  with bar or line charts.
- **Navigation** — Step through days, jump to a week, month, quarter, or year,
  or pick any period in the calendar, also across months.
- **Resolution** — 15 minutes, hours, days, weeks, or months, depending on the
  period; the editor only offers the options that apply.
- **History** — Past days and ranges come from the recorder statistics of a
  history sensor.
- **Zoom** — Mouse wheel, drag, and keys on desktop; double tap and two-finger
  pan on iPhone and iPad. Each is a separate option.
- **Responsive** — Compact, regular, large, and kiosk layouts; light and dark
  mode; works on phones, tablets, and wall displays.
- **Visual editor** — All options in grouped sections, with validation.
- **Languages** — English and Dutch, in the card and in the visual editor.

## Screenshots

These screenshots show the card in Home Assistant, with prices from the Nord
Pool integration. The card supports both light and dark mode; the screenshots
use dark mode.

### Desktop

<details>
  <summary>Desktop views (click to expand)</summary>

Price view:

![Price view on desktop](./docs/images/screenshot_desktop_price.png)

Heatmap view:

![Heatmap view on desktop](./docs/images/screenshot_desktop_heatmap.png)

Breakdown view:

![Breakdown view on desktop](./docs/images/screenshot_desktop_breakdown.png)

Period and calendar menu:

![Calendar on desktop](./docs/images/screenshot_desktop_calendar.png)

</details>

### Kiosk

<details>
  <summary>Kiosk views (click to expand)</summary>

Price view:

![Price view in kiosk mode](./docs/images/screenshot_kiosk_price.png)

Heatmap view:

![Heatmap view in kiosk mode](./docs/images/screenshot_kiosk_heatmap.png)

Breakdown view:

![Breakdown view in kiosk mode](./docs/images/screenshot_kiosk_breakdown.png)

Period and calendar menu:

![Calendar in kiosk mode](./docs/images/screenshot_kiosk_calendar.png)

</details>

### Smartphone

<details>
  <summary>Smartphone views (click to expand)</summary>

Price view:

![Price view on a smartphone](./docs/images/screenshot_smartphone_price.png)

Heatmap view:

![Heatmap view on a smartphone](./docs/images/screenshot_smartphone_heatmap.png)

Breakdown view:

![Breakdown view on a smartphone](./docs/images/screenshot_smartphone_breakdown.png)

Period and calendar menu:

![Calendar on a smartphone](./docs/images/screenshot_smartphone_calendar.png)

</details>

### Visual editor

<details>
  <summary>Editor sections (click to expand)</summary>

![Editor: entities and header](./docs/images/screenshot_editor_1_entity_header.png)

![Editor: data, view, prices, and VAT](./docs/images/screenshot_editor_2_data_prices.png)

![Editor: units, formatting, and highlights](./docs/images/screenshot_editor_3_units_highlights.png)

![Editor: chart elements](./docs/images/screenshot_editor_4_chart_elements.png)

![Editor: summary sections and controls](./docs/images/screenshot_editor_5_summary_controls.png)

![Editor: opacity and appearance](./docs/images/screenshot_editor_6_opacity_appearance.png)

![Editor: kiosk and experimental](./docs/images/screenshot_editor_7_kiosk_experimental.png)

</details>

## Project Status

> [!WARNING]
>
> **Status:** Alpha
>
> This project is under **active development**. Options and behavior can change
> between versions without a migration path.

> [!IMPORTANT]
>
> Contributions are not accepted for now. When release v1.0.0 is published,
> contributions are very welcome.

Verified so far: the card in Chromium with a mocked Home Assistant. Not yet
verified: a Home Assistant instance for all history ranges, and real iPhone and
iPad touch gestures. See [`docs/project_status.md`](./docs/project_status.md)
for the current state and open items.

## Getting Started

### Requirements

- Home Assistant with the recorder (included in `default_config`).
- The
  [Nord Pool integration](https://www.home-assistant.io/integrations/nordpool/),
  set up for the Netherlands.
- A template sensor that turns the integration prices into the attributes the
  card reads (step 2 below).
- The **Current price** sensor of the Nord Pool integration, with
  `state_class: measurement`, as `history_entity`. Yesterday and older days,
  ranges, and the calendar are read from the recorder history of this sensor.
  The history builds up over time: Home Assistant only records from the moment
  the sensor exists, so a new setup has no history at first. Today and tomorrow
  work immediately; earlier days appear day by day.

### Prepare Home Assistant

#### Step 1: Install the Nord Pool integration

Add the
[Nord Pool integration](https://www.home-assistant.io/integrations/nordpool/) in
**Settings**, **Devices & services**, **Add integration**. Choose the area `NL`
(the Netherlands) and the currency `EUR`.

#### Step 2: Create the template sensor

Create `config/templates/nord-pool/the_netherlands_prices.yaml` with the content
below. The sensor refreshes at startup, at 13:05 (when tomorrow's prices are
published), and every 15 minutes. It converts the prices from EUR/MWh to EUR/kWh
and exposes them as the attributes `today` and `tomorrow`.

Replace `<config_entry_id>` with the ID of your Nord Pool entry. To find it,
open **Developer tools**, **Actions**, choose **Nord Pool: Get prices for
date**, and switch to **YAML mode**.

<!-- prettier-ignore -->
```yaml
- triggers:
    - trigger: homeassistant
      event: start
    - trigger: time
      at: '13:05:00'
    - trigger: time_pattern
      minutes: /15

  actions:
    - variables:
        today_response: {}
        tomorrow_response: {}

    - action: nordpool.get_prices_for_date
      continue_on_error: true
      data:
        config_entry: <config_entry_id>
        areas: NL
        currency: EUR
        date: "{{ now().date() + timedelta(days=0) }}"
      response_variable: today_response

    - action: nordpool.get_prices_for_date
      continue_on_error: true
      data:
        config_entry: <config_entry_id>
        areas: NL
        currency: EUR
        date: "{{ now().date() + timedelta(days=1) }}"
      response_variable: tomorrow_response

    - variables:
        prices: >
          {% macro convert(response) %}
            {% set raw_prices = response.get('NL', []) if response is mapping else [] %}
            {% set ns = namespace(items=[]) %}
            {% for epex in raw_prices %}
              {% set raw = epex.price | float(0) / 1000 %}
              {% set ns.items = ns.items + [{
                'start': epex.start | string,
                'end': epex.end | string,
                'energy_price': raw | round(5),
              }] %}
            {% endfor %}
            {{ ns.items | tojson }}
          {% endmacro %}
          {{ {
            'today': convert(today_response) | from_json,
            'tomorrow': convert(tomorrow_response) | from_json,
          } }}

  sensor:
    - name: "Nord Pool - the Netherlands prices"
      unique_id: nord_pool_the_netherlands_prices
      state_class: measurement
      icon: mdi:cash-clock

      availability: "{{ prices is defined and prices.today | count > 0 }}"
      state: "{{ prices.today | map(attribute='energy_price') | min }}"
      attributes:
        today: "{{ prices.today }}"
        tomorrow: "{{ prices.tomorrow }}"
```

The sensor gets the entity ID `sensor.nord_pool_the_netherlands_prices`, which
is the default `entity` of the card.

#### Step 3: Load the templates in `configuration.yaml`

Make sure `config/configuration.yaml` loads the `templates` folder. This line
merges every template file in it, including the subfolder `nord-pool`:

```yaml
template: !include_dir_merge_list templates
```

Without a split configuration, include the file directly instead:

```yaml
template: !include templates/nord-pool/the_netherlands_prices.yaml
```

A complete `configuration.yaml` that splits its configuration over folders looks
like this:

```yaml
default_config:

automation split: !include_dir_merge_list automations
binary_sensor split: !include_dir_merge_list binary_sensors
rest: !include_dir_merge_list rest
scene split: !include_dir_merge_list scenes
script split: !include_dir_merge_list scripts
sensor split: !include_dir_merge_list sensors
template: !include_dir_merge_list templates

automation: !include automations.yaml
binary_sensor: !include binary_sensors.yaml
scene: !include scenes.yaml
script: !include scripts.yaml
sensor: !include sensors.yaml
```

Restart Home Assistant afterwards.

#### Step 4: Check the sensors

Open **Developer tools**, **States**. The sensor
`sensor.nord_pool_the_netherlands_prices` must have the attributes `today` and
`tomorrow`, each a list of `{start, end, energy_price}`. Tomorrow stays empty
until the prices are published. Also note the entity ID of the **Current price**
sensor; it is the `history_entity` of the card. It starts without history, so
days before the installation stay empty.

### Installation

Install the card by hand. Home Assistant is building its own marketplace, and
the card will move there when it is ready.

1. Download `kairos_card.js` from the
   [latest release](https://github.com/homelab-alpha/kairos/releases) (source
   code archive) and copy it to `/config/www/`.
2. Add a dashboard resource `/local/kairos_card.js` of the type **JavaScript
   module**.
3. Reload the browser.

### Configuration

A minimal card:

```yaml
type: custom:kairos-card
entity: sensor.nord_pool_the_netherlands_prices
history_entity: sensor.nord_pool_the_netherlands_current_price
view: heatmap
day: today
```

Every option is available in the visual editor, in the same order as below.
Booleans are `true` or `false`. A wrong value shows a configuration error.

#### Entities

| Option                 | Default                                          | Description                                                                       |
| :--------------------- | :----------------------------------------------- | :-------------------------------------------------------------------------------- |
| `entity`               | `sensor.nord_pool_the_netherlands_prices`        | Sensor with the `today` and `tomorrow` attributes (15-minute slots).              |
| `entities`             | none                                             | Fallback sensors; the first one that is usable wins.                              |
| `history_entity`       | `sensor.nord_pool_the_netherlands_current_price` | Sensor with the bare price in EUR/kWh. Feeds past days, ranges, and the calendar. |
| `history_quarter_days` | `7`                                              | Days back (0-10) that show quarter hours; older days show hourly averages.        |

#### Header

| Option        | Default  | Description                                                                        |
| :------------ | :------- | :--------------------------------------------------------------------------------- |
| `source`      | `custom` | `custom`, `nord_pool`, or `entsoe`: the title and logo of the header.              |
| `show_header` | `true`   | Show the header.                                                                   |
| `title`       | empty    | Title for `source: custom`; `{day}` is the selected day. Empty uses the default.   |
| `icon`        | empty    | Icon for `source: custom`: an `mdi` icon such as `mdi:flash`, or `false` for none. |

The default titles are `Kairos` (`custom`, with the Kairos logo),
`Nord Pool · Day-Ahead Market`, and `ENTSO-E · Day-Ahead Market`. Only the
`custom` source uses your own `title` and `icon`; the other sources ignore them,
and the editor hides those two options. For now `source` only sets the title and
the logo; the card still reads the sensors you configure. Reading ENTSO-E data
is planned.

#### Data and view

| Option                  | Default | Description                                                                                                                                                         |
| :---------------------- | :------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `day`                   | `today` | `today`, `tomorrow`, `yesterday`, `week`, `month`, `year`, `q1` to `q4`, or a date (`YYYY-MM-DD`).                                                                  |
| `auto_advance_tomorrow` | `false` | Switch to tomorrow when its prices are published.                                                                                                                   |
| `view`                  | `price` | `price`, `heatmap`, or `breakdown`.                                                                                                                                 |
| `period`                | `15min` | Follows `day`: a day offers `15min` and `hour`, a week `hour` and `day`, a month `day` and `week`, a year `week` and `month`, a quarter `day`, `week`, and `month`. |
| `chart_style`           | `bars`  | `auto`, `bars`, or `line`; `auto` picks by the available width.                                                                                                     |

#### Prices and units

| Option             | Default   | Description                                                    |
| :----------------- | :-------- | :------------------------------------------------------------- |
| `vat`              | `true`    | Include VAT.                                                   |
| `vat_rate`         | `21`      | VAT rate in percent.                                           |
| `energy_tax`       | `0`       | Energy tax in EUR/kWh, before VAT.                             |
| `surcharge`        | `0`       | Supplier surcharge in EUR/kWh, before VAT.                     |
| `fixed_price`      | `0`       | Fixed rate in EUR/kWh, before VAT; 0 hides it.                 |
| `fixed_label`      | empty     | Energy company shown on the rate; empty uses the default name. |
| `unit`             | `auto`    | `auto`, `ct/kWh`, `EUR/kWh`, `SEK/kWh`, and so on.             |
| `decimals`         | automatic | Whole number from 0 to 6.                                      |
| `currency`         | `EUR`     | Currency code used for amounts.                                |
| `currency_display` | `symbol`  | `symbol` or `code`.                                            |
| `time_format`      | `24`      | `auto` (Home Assistant profile), `12`, or `24`.                |
| `axis_am_pm`       | `false`   | Show AM/PM on the time axis.                                   |
| `axis_minutes`     | `false`   | Show `00:00` instead of `00` on the time axis.                 |

#### Highlights

| Option              | Default | Description                                                             |
| :------------------ | :------ | :---------------------------------------------------------------------- |
| `cheapest_quarters` | `10`    | Number of cheapest slots highlighted in the heatmap view.               |
| `best_window_hours` | `0`     | Highlight the cheapest contiguous window of this many hours (0 is off). |
| `price_bands`       | `auto`  | `auto` (percentiles), `[low, high]`, or `{ low, high }` as displayed.   |

#### Chart

| Option                 | Default      | Description                                                                                |
| :--------------------- | :----------- | :----------------------------------------------------------------------------------------- |
| `show_chart`           | `true`       | Show the chart.                                                                            |
| `show_hour_grid`       | `true`       | Show the hour grid.                                                                        |
| `show_now_marker`      | `true`       | Show the marker for the current time.                                                      |
| `show_extremes`        | `false`      | Show the lowest and highest price labels.                                                  |
| `show_average_line`    | `false`      | Show the average line.                                                                     |
| `average_line_size`    | `medium`     | `small`, `medium`, or `large`.                                                             |
| `show_fixed_line`      | `false`      | Show the fixed rate line.                                                                  |
| `fixed_line_size`      | `medium`     | `small`, `medium`, or `large`.                                                             |
| `heat_gradient`        | `horizontal` | `horizontal` (one gradient over the chart height) or `vertical` (one solid color per bar). |
| `zoom_desktop`         | `false`      | Zoom on desktop and laptop: mouse wheel, drag to pan, and the `+`, `-`, and `0` keys.      |
| `zoom_touch`           | `false`      | Zoom on iPhone and iPad: double tap, and two fingers to pan.                               |
| `zoom_buttons_desktop` | `true`       | Show the reset, `-`, and `+` buttons on desktop and laptop.                                |
| `zoom_buttons_touch`   | `true`       | Show the reset button while zoomed on iPhone and iPad.                                     |

#### Sections and controls

| Option                   | Default | Description                                                                  |
| :----------------------- | :------ | :--------------------------------------------------------------------------- |
| `show_stats`             | `true`  | Show the tiles.                                                              |
| `show_legend`            | `true`  | Show the legend and the cheapest summary.                                    |
| `show_controls`          | `true`  | Show the controls. The buttons below need this.                              |
| `show_day_button`        | `true`  | Day control.                                                                 |
| `show_period_button`     | `true`  | Period control.                                                              |
| `show_chart_type_button` | `true`  | Chart type control.                                                          |
| `show_price_button`      | `true`  | Price view button.                                                           |
| `show_heatmap_button`    | `true`  | Heatmap view button.                                                         |
| `show_breakdown_button`  | `true`  | Breakdown view button.                                                       |
| `show_cheapest_stepper`  | `false` | Stepper for the number of cheapest slots (heatmap view, today and tomorrow). |

#### Opacity

Values from 0 to 100, for each view and chart type.

| Option                                                                 | Default |
| :--------------------------------------------------------------------- | :------ |
| `price_bar_opacity`, `heatmap_bar_opacity`, `breakdown_bar_opacity`    | `75`    |
| `price_line_opacity`, `heatmap_line_opacity`, `breakdown_line_opacity` | `60`    |

#### Appearance

| Option                   | Default | Description                                                                          |
| :----------------------- | :------ | :----------------------------------------------------------------------------------- |
| `color_scheme`           | `auto`  | `auto`, `light`, or `dark`.                                                          |
| `display_mode_desktop`   | `auto`  | `auto`, `compact`, or `regular` on desktop and laptop. Auto is compact below 720 px. |
| `display_mode_touch`     | `auto`  | Same values, on tablet and smartphone.                                               |
| `kiosk`                  | `false` | Mark the card as a kiosk or wall display. It then uses `display_mode_kiosk`.         |
| `display_mode_kiosk`     | `auto`  | `auto`, `compact`, `regular`, `large`, or `kiosk`. Auto picks by the card width.     |
| `pixel_shift`            | `false` | Move the card slightly to prevent burn-in on wall displays.                          |
| `editor_expand_sections` | `true`  | Open every section of the visual editor.                                             |

#### Experimental

These can stop working after a Home Assistant update.

| Option             | Default   | Description                                                                    |
| :----------------- | :-------- | :----------------------------------------------------------------------------- |
| `edit_button`      | `false`   | A header button that opens the card editor (administrators only).              |
| `edit_button_icon` | `sliders` | `sliders`, `gear`, `pencil`, or `pencil_square`.                               |
| `edit_link`        | `false`   | An `Edit` link in the footer that opens the card editor (administrators only). |
| `update_menu`      | `false`   | Show the Dashboard resource button (Check, Update, Reload) in the editor.      |

## Development

Set up on any computer:

```bash
git clone https://github.com/homelab-alpha/kairos.git
cd kairos
npm ci
npx playwright install chromium
npm run test:smoke
```

Linting has two parts. Every pull request runs `npm run lint` (Prettier,
textlint terminology, and merge conflict markers on the changed files), which
you can also run locally. `npm run lint:fix` repairs formatting and terminology
for you. Every push to `main` runs the full Super Linter, which you can run
locally with Docker:

```bash
docker run --rm -e RUN_LOCAL=true -e USE_FIND_ALGORITHM=true \
  -e VALIDATE_ALL_CODEBASE=true --env-file .github/super_linter.env \
  -v "$PWD":/tmp/lint ghcr.io/super-linter/super-linter:v8.7.0
```

For quick formatting of a single file, `npx prettier --write <file>` uses the
same `.prettierrc`. The smoke test needs Chromium. See
[`docs/development.md`](./docs/development.md) for the full workflow, including
how to try the card in Home Assistant.

## Project Structure

```treeview
kairos/
├── .claude/                                     # Claude Code project settings (shared)
│   └── settings.json                            # Shared permissions for Claude Code
├── .github/                                     # GitHub-specific configuration and automation
│   ├── DISCUSSION_TEMPLATE/                     # GitHub Discussions templates
│   │   ├── announcements.yml                    # Template for announcements
│   │   ├── feature-request.yml                  # Template for feature requests
│   │   ├── feedback.yml                         # Template for feedback
│   │   ├── help-support.yml                     # Template for help and support
│   │   └── q-a.yml                              # Template for Q&A
│   ├── ISSUE_TEMPLATE/                          # GitHub issue templates
│   │   ├── bug_report.yml                       # Template for bug reports
│   │   ├── config.yml                           # Issue template configuration
│   │   ├── i18n_issue.yml                       # Template for translation & localization
│   │   └── security_report.yml                  # Template for security issues
│   ├── linters/                                 # Configuration files for Super Linter
│   │   ├── .checkov.yaml                        # Infrastructure-as-code security rules
│   │   ├── .gitleaks.toml                       # Gitleaks secret scanning configuration
│   │   ├── .markdown-lint.yml                   # Markdown linting rules
│   │   ├── .powershell-psscriptanalyzer.psd1    # PowerShell static analysis rules
│   │   ├── .textlintrc                          # Text/grammar linting configuration
│   │   ├── .yaml-lint.yml                       # YAML linting rules
│   │   └── actionlint.yml                       # GitHub Actions workflow linting rules
│   ├── policies/                                # Internal policies and documentation
│   │   ├── github_actions.md                    # Workflow standards (ENG-CI-001)
│   │   ├── labels.md                            # Label color strategy and rules
│   │   ├── logs.md                              # Logging policies and practices
│   │   ├── review_process.md                    # Code review process
│   │   ├── security.md                          # Security policy
│   │   └── tests.md                             # Testing policy
│   ├── workflows/                               # GitHub Actions workflows
│   │   ├── badges.yml                           # Self-hosted README badges
│   │   ├── codeql.yml                           # CodeQL security analysis
│   │   ├── contributors.yml                     # Contributors list generator
│   │   ├── dependency_review.yml                # Dependency review
│   │   ├── housekeeping.yml                     # Cache and run cleanup
│   │   ├── issues.yml                           # Issue automation
│   │   ├── labels.yml                           # Label synchronization
│   │   ├── merge_conflicts.yml                  # Merge conflict detection
│   │   ├── lint_pull_request.yml                # npm linting for pull requests
│   │   ├── milestone_manager.yml                # Milestone automation
│   │   ├── pull_request.yml                     # Pull request automation
│   │   ├── release_manager.yml                  # Release automation
│   │   ├── signing_test.yml                     # Test API-based commit and tag signing
│   │   ├── smoke_test.yml                       # Browser smoke test
│   │   ├── stale_issues_and_pull_requests.yml   # Stale issue management
│   │   ├── super_linter.yml                     # Super Linter
│   │   └── unreproducible_issues.yml            # Unreproducible issue management
│   ├── CODEOWNERS                               # Code ownership definitions
│   ├── labels.yml                               # Repository label definitions
│   ├── pull_request_template.md                 # Pull request template
│   ├── renovate.json                            # Renovate dependency automation
│   └── super_linter.env                         # Super Linter environment configuration
│
├── assets/                                      # Static project assets
│   └── branding/                            # Brand assets (logo, icons, favicon, social preview) and brand guide
│       ├── brand_guide.md                   # Name, slogan, colors, typography, usage rules
│       ├── favicon.svg                      # Favicon (simplified, follows the theme)
│       ├── icon_dark.svg                    # App icon, dark
│       ├── icon_light.svg                   # App icon, light
│       ├── logo_dark.svg                    # Logo with wordmark, for dark backgrounds
│       ├── logo_light.svg                   # Logo with wordmark, for light backgrounds
│       ├── logo_tagline_dark.svg            # Logo with slogan, for dark backgrounds
│       ├── logo_tagline_light.svg           # Logo with slogan, for light backgrounds
│       ├── mark_dark.svg                    # Mark only, for dark backgrounds
│       ├── mark_light.svg                   # Mark only, for light backgrounds
│       ├── social_preview.png               # GitHub social preview (1280×640)
│       └── social_preview.svg               # Source of the social preview
│
├── docs/                                        # Project documentation (API, usage, guides)
│   ├── architecture.md                          # How the card works internally
│   ├── code_style_and_standards_guides.md       # Coding standards and style guidelines
│   ├── design_guidelines.md                     # Design standard: look, behavior, resources
│   ├── decisions.md                             # Decision log
│   ├── development.md                           # Set up and continue on any computer
│   ├── images/                                  # README screenshots (desktop, kiosk, smartphone, editor)
│   └── project_status.md                        # Current state, open items, next steps
│
├── scripts/                                     # Utility and automation shell scripts
│   ├── generate_badges.py                       # Renders the README badges as SVG files
│   ├── lint.sh                                  # Pull request lint (Prettier, textlint, conflict markers)
│   ├── setup_gpg.sh                             # Configures API or GPG signing for Git operations
│   └── verify_signatures.sh                     # Verifies commit and tag signatures
│
├── tests/                                       # Automated test suite
│   ├── helpers/                                 # Shared test helpers
│   │   └── mock_hass.cjs                        # Mocked Home Assistant for browser tests
│   └── smoke.cjs                                # Browser smoke test (card and editor)
│
├── .editorconfig                                # Editor settings (indent, line endings)
├── .gitignore                                   # Git ignore rules
├── .gitleaksignore                              # Gitleaks secret scanning allowlist
├── .npmrc                                       # npm settings (ignore-scripts)
├── .pre-commit-config.yaml                      # Local pre-commit hooks (mirrors CI)
├── .prettierignore                              # Files excluded from Prettier formatting
├── .prettierrc                                  # Prettier configuration file
├── CHANGELOG.md                                 # Project change history
├── CLAUDE.md                                    # Instructions and conventions for Claude Code
├── CODE_OF_CONDUCT.md                           # Contributor Covenant Code of Conduct
├── CONTRIBUTING.md                              # Contribution guidelines
├── CONTRIBUTORS.md                              # Auto-generated contributors list
├── GOVERNANCE.md                                # Project governance model
├── kairos_card.js                               # The card (single file, no dependencies)
├── LICENSE                                      # Apache License 2.0
├── MAINTAINERS.md                               # Project maintainer list and process
├── NOTICE                                       # Attribution and license notice
├── package-lock.json                            # Locked dev dependencies
├── package.json                                 # Dev tooling (browser tests); not shipped
├── README.md                                    # Primary repository documentation
├── ROADMAP.md                                   # Planned features and milestones
├── SECURITY.md                                  # Security policy and reporting guidelines
├── SUPPORT.md                                   # Support channels and response times
└── TERMS_OF_SERVICE.md                          # Terms of service
```

## CI/CD and Automation

The repository includes a comprehensive set of GitHub Actions workflows that run
automatically on push, pull request, and scheduled triggers.

### Workflows

| Workflow                             | Trigger                   | Purpose                                              |
| :----------------------------------- | :------------------------ | :--------------------------------------------------- |
| `badges.yml`                         | Push, workflow run, daily | Renders the README badges to the `badges` branch     |
| `codeql.yml`                         | Push, PR, schedule        | CodeQL static analysis for security vulnerabilities  |
| `contributors.yml`                   | Push to `main`            | Auto-generates `CONTRIBUTORS.md`                     |
| `dependency_review.yml`              | PR                        | Reviews dependency changes for known vulnerabilities |
| `housekeeping.yml`                   | Weekly schedule, manual   | Cleans up old workflow runs and Actions caches       |
| `issues.yml`                         | Issue events              | Automates issue labeling and triage                  |
| `labels.yml`                         | Push, manual              | Synchronizes repository labels from `labels.yml`     |
| `merge_conflicts.yml`                | Push, PR                  | Detects merge conflicts in open pull requests        |
| `lint_pull_request.yml`              | PR, manual                | Runs `npm run lint` (Prettier, textlint)             |
| `milestone_manager.yml`              | Manual                    | Automates milestone creation and lifecycle           |
| `pull_request.yml`                   | PR events                 | Pull request automation and validation               |
| `release_manager.yml`                | Manual                    | Automates GitHub Releases                            |
| `signing_test.yml`                   | Manual                    | Tests API-based commit and tag signing               |
| `smoke_test.yml`                     | Push, PR, manual          | Browser smoke test; on a PR only when it can change  |
| `stale_issues_and_pull_requests.yml` | Schedule                  | Marks and closes stale issues and pull requests      |
| `super_linter.yml`                   | Push to `main`, manual    | Runs Super Linter across the codebase                |
| `unreproducible_issues.yml`          | Schedule                  | Manages issues that cannot be reproduced             |

All workflows follow the standards documented in
[`.github/policies/github_actions.md`](./.github/policies/github_actions.md),
including pinned action versions, concurrency controls, timeout limits, bot
filtering, and structured job summaries.

The README badges are not fetched from a third-party service. `badges.yml`
renders them with `scripts/generate_badges.py` (Python standard library only)
and publishes the SVG files to the `badges` branch, which the README links to
through `github.com/<owner>/<repo>/raw/badges/`, which also works in a private
repository for signed-in viewers with access. The Super Linter and CodeQL badges
show the latest run on the default branch and refresh when those workflows
finish (the `workflow_run` trigger lists their names, so update it when you
rename them). The workflow creates the branch on its first run. The badges
follow the colors in
[`assets/branding/brand_guide.md`](./assets/branding/brand_guide.md) and switch
to a dark variant with the system theme.

### Linting

Pull requests are linted with `npm run lint` (`scripts/lint.sh`), which uses
Prettier, textlint, and a merge conflict marker check with the configuration
files below. Pushes to `main` run
[Super Linter](https://github.com/super-linter/super-linter), configured through
`.github/super_linter.env`. The following linters are enabled by default: Bash,
Bash Exec, Checkov, ENV, GitHub Actions (actionlint), Gitleaks, Git merge
conflict markers, JavaScript (Prettier), JSON (Prettier), Markdown (Prettier),
Natural Language (textlint), PowerShell, Pre-commit, and YAML (Prettier).

Linter-specific configuration files are stored in `.github/linters/` and include
rules for Checkov, Gitleaks, markdownlint, textlint, yamllint, and actionlint.

### Dependency Management

Dependency updates are managed by [Renovate](https://github.com/apps/renovate).
The configuration in `.github/renovate.json` includes automatic patch-level
automerge with squash, security update prioritization, a dependency dashboard,
and scheduling during business hours (Europe/Amsterdam timezone). Major and
minor updates require manual review.

## Policies and Standards

The repository includes internal policies that define how the project operates.
These are documented in `.github/policies/` and in root-level files:

| Document                                                                               | Purpose                                              |
| :------------------------------------------------------------------------------------- | :--------------------------------------------------- |
| [`.github/policies/github_actions.md`](./.github/policies/github_actions.md)           | Workflow structure, security, and logging standards  |
| [`.github/policies/labels.md`](./.github/policies/labels.md)                           | Label naming, color strategy, and usage rules        |
| [`.github/policies/logs.md`](./.github/policies/logs.md)                               | Logging conventions for workflows and scripts        |
| [`.github/policies/review_process.md`](./.github/policies/review_process.md)           | Code review stages, criteria, and merge strategy     |
| [`.github/policies/security.md`](./.github/policies/security.md)                       | Security scanning and vulnerability management       |
| [`.github/policies/tests.md`](./.github/policies/tests.md)                             | Testing standards, structure, and conventions        |
| [`docs/code_style_and_standards_guides.md`](./docs/code_style_and_standards_guides.md) | Coding style guidelines and Prettier configuration   |
| [`GOVERNANCE.md`](./GOVERNANCE.md)                                                     | Project governance model and decision-making process |
| [`MAINTAINERS.md`](./MAINTAINERS.md)                                                   | Maintainer roles, responsibilities, and current list |

## Working with Claude

Project rules and conventions for Claude Code live in
[`CLAUDE.md`](./CLAUDE.md). The shared settings are in
[`.claude/settings.json`](./.claude/settings.json). The current state, the
decisions, and the architecture notes are in [`docs/`](./docs/), so a session on
any computer can continue where the previous one stopped.

## Known Issues

The maintainers strive to provide a seamless experience. Below are any known
bugs, limitations, or issues you might encounter. This section is updated
regularly.

### Currently Being Addressed

No known issues at this time.

If you discover a bug or experience an issue not listed here, please
[open an issue on GitHub](https://github.com/homelab-alpha/kairos/issues/new/choose).

## Contributing

> [!IMPORTANT]
>
> Contributions are not accepted for now. When release v1.0.0 is published,
> contributions are very welcome.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines, branch
naming conventions, commit message format, and the review process.

## Support

For setup questions, troubleshooting, and general help, see
[SUPPORT.md](./SUPPORT.md).

## Security

To report a security vulnerability, please follow the process described in
[SECURITY.md](./SECURITY.md). Do **not** report security issues via public
GitHub issues or discussions.

## Roadmap

Planned features, milestones, and the long-term direction of the project are
documented in [ROADMAP.md](./ROADMAP.md).

## License

This project is licensed under the **Apache License 2.0**. See the
[LICENSE](./LICENSE) and [NOTICE](./NOTICE) files for the full license text and
attribution requirements.
