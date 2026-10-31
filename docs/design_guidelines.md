# Design Guidelines

The fixed standard for how the Kairos looks, behaves, and uses its resources.
Every UI change follows this document. When a rule changes, change it here in
the same pull request.

The values below are taken from `kairos_card.js`. If the code and this document
disagree, fix whichever is wrong.

## Reference sources

Reference sources (follow these as the authority for design decisions):

- Interface guidelines:
  <https://developer.apple.com/design/human-interface-guidelines/getting-started>
- Developer documentation: <https://developer.apple.com/documentation>

Relevant HIG sections to apply: Foundations (Color, Dark Mode, Typography,
Layout, Materials, Motion, Accessibility, SF Symbols, Writing), Patterns
(Charting data, Loading, Feedback, Managing notifications is out of scope),
Components (Charts, Segmented controls, Buttons, Labels, Lists, Toolbars,
Popovers, Tooltips), and Inputs (Touch, Pointer, Keyboard, Gestures).

## Principles

1. **Apple Human Interface Guidelines first.** Clear hierarchy, system fonts,
   semantic colors, 44 pt touch targets, and motion that explains a change.
2. **Readable at a glance.** The current price and the cheapest moments are
   visible without interaction, also on a wall display.
3. **One file, no dependencies.** Vanilla JavaScript, Shadow DOM, hand-written
   SVG. No build step, no external fonts, icons, or scripts.
4. **Works everywhere.** Phone, tablet, desktop, and wall display; light and
   dark; touch and mouse; keyboard and screen reader.
5. **Everything configurable, nothing required.** Every option has a sensible
   default and a row in the visual editor.

## Typography

System font stack: `-apple-system`, `BlinkMacSystemFont`, `SF Pro Text`,
`system-ui`, `Segoe UI`, `Roboto`, `sans-serif`. No web fonts.

All sizes scale with the display mode factor `--s`.

| Token       | Size (rem)             | Use                   |
| :---------- | :--------------------- | :-------------------- |
| `--t-large` | 2.125                  | Hero price            |
| `--t-t1`    | 1.75                   | Tile values           |
| `--t-t2`    | 1.375                  | Section titles        |
| `--t-t3`    | 1.25                   | Secondary titles      |
| `--t-head`  | 1.0625                 | Headlines             |
| `--t-body`  | 1.0625                 | Body                  |
| `--t-call`  | 1                      | Callouts              |
| `--t-sub`   | 0.9375                 | Subheads, table cells |
| `--t-foot`  | 0.8125                 | Footnotes, labels     |
| `--t-c1`    | 0.75                   | Captions              |
| `--t-c2`    | 0.6875 (11 px minimum) | Smallest captions     |

Numbers use tabular figures (`font-variant-numeric: tabular-nums`) wherever
values line up or change.

## Color

Colors are semantic tokens defined in `KAIROS_TOK` for light and dark. Never use
a raw color outside the token tables. In `auto` mode the text and surface colors
follow the Home Assistant theme (`--primary-text-color`,
`--secondary-text-color`, `--card-background-color`).

| Token     | Light     | Dark      | Use                       |
| :-------- | :-------- | :-------- | :------------------------ |
| `label`   | `#000000` | `#ffffff` | Primary text              |
| `label2`  | `#5c5c61` | `#aeaeb2` | Secondary text            |
| `label3`  | `#8e8e93` | `#8e8e93` | Tertiary text, disabled   |
| `surface` | `#ffffff` | `#1c1c1e` | Card background           |
| `group`   | `#f2f2f7` | `#2c2c2e` | Grouped rows and tiles    |
| `accent`  | `#0062cc` | `#4da3ff` | Actions, selection, "now" |
| `green`   | `#1b7a34` | `#30d158` | Cheap, positive           |
| `orange`  | `#b34700` | `#ff9f0a` | Warning                   |
| `red`     | `#c4161c` | `#ff6961` | Expensive, error          |

Also: `sep` (separators), `fill` and `fill2` (control backgrounds), `bg`,
`thumb`, `onaccent`.

**Contrast.** Every data color has at least 3:1 against the card surface, and
text at least 4.5:1. Check both schemes when you add a color.

**Price bands** (cheap, average, expensive) split the day by percentile (lower
and upper third) unless `price_bands` sets thresholds. A flat day shows one
band. Band colors come from the heat scale (`KAIROS_HEAT`): purple for the
cheapest, then dark green, yellow, orange, and dark red.

**Breakdown layers** (`KAIROS_LAYERS`): energy, tax, surcharge, VAT, fixed rate,
and VAT off each have one fixed color per scheme.

**Meaning never relies on color alone.** Pair color with a label, an icon, or
position.

## Layout

An 8-point rhythm. Radius of a card or group is 14 px. Separators are hairlines:
1 px, and 0.5 px on 2x displays.

### Display modes

Three options choose the mode: `display_mode_desktop` (mouse),
`display_mode_touch` (touchscreens, found with `pointer: coarse`), and
`display_mode_kiosk`, which replaces both when `kiosk` is on. `auto` picks the
mode from the width of the card, not the screen.

| Mode      | When (auto)                             | Scale `--s` | Padding | Notes                            |
| :-------- | :-------------------------------------- | :---------- | :------ | :------------------------------- |
| `compact` | below 720 px                            | 1           | 16 px   | Stacked controls, 2-column tiles |
| `regular` | 720 px and above; to 1024 px on a kiosk | 1           | 20 px   | Controls in one row              |
| `large`   | kiosk only: 1024 to 1600 px             | 1.25        | 28 px   | Side column, large price         |
| `kiosk`   | kiosk only: above 1600 px               | 1.5         | 32 px   | Wall display, largest type       |

Desktop, laptop, tablet, and smartphone offer `auto`, `compact`, and `regular`.
`large` and `kiosk` can only be chosen on a kiosk.

The compact layout must look right at about 500 px, the width of the card in the
Home Assistant card configuration dialog.

### Structure

1. Header (optional): icon, title, and the current price as the hero.
2. Controls: calendar button and day stepper, then view, period, and chart type.
3. Chart.
4. Tiles: lowest, average, highest, and optionally the fixed rate.
5. Cheapest summary (heatmap view) and tables.

Tiles use 2 columns in compact mode when there are more than 3, otherwise one
column per tile.

## Views and charts

| View        | Shows                                                      |
| :---------- | :--------------------------------------------------------- |
| `price`     | Price per slot, colored by price band                      |
| `heatmap`   | Hours by quarter, colored by band, cheapest slots marked   |
| `breakdown` | Stacked cost layers, with off-peak 1, peak, and off-peak 2 |

Breakdown periods: off-peak 1 is 00:00 to 08:00, peak is 08:00 to 20:00,
off-peak 2 is 20:00 to 24:00.

Chart style `auto` uses bars while a bar is at least 3 px wide, otherwise a
line. Opacity is set per view and style (`*_bar_opacity`, `*_line_opacity`).

Axis: a unit label at the top left, few rounded horizontal ticks, an optional
hour grid, and a "Now" marker. Week resolution shows week numbers instead of
dates.

### Cheapest summary

Heatmap view, today and tomorrow. It sits in the left column under the tiles
(below the chart in compact and regular mode) and shows:

1. A caption with the number of cheapest slots and their total time.
2. The total time of the cheapest slots, their average price, and the difference
   with the daily average.
3. A highlighted card with the next window and a countdown that follows the
   clock. While a window is running it shows the time left. Tomorrow shows the
   first window without a countdown.
4. The other windows as chips in two columns, as wide as the tiles, in the
   groups "Earlier today" and "Later".

The card uses the cheap color of the heat scale for its outline. There is no
readout below the chart; the callout shows the selected slot.

### Resolution

| Start day | Options             | Default |
| :-------- | :------------------ | :------ |
| Day       | 15 min, 1 h         | 15 min  |
| Week      | 1 h, day            | 1 h     |
| Month     | day, week           | day     |
| Year      | week, month         | week    |
| Quarter   | day, week, month    | week    |
| Custom    | by length of period | first   |

Only options that apply are shown. Switching range resets the resolution to the
default of that range. Days older than `history_quarter_days` are hourly.

### Zoom

Off by default; four separate options. Desktop: wheel, drag, and keys `+`, `-`,
`0`. Touch: double tap to zoom in and out, two fingers to pan. The buttons sit
inside the chart at the top right: reset, minus, and plus on desktop; only reset
on touch, and only while zoomed. Buttons have no backdrop blur.

## Interaction

- **Touch targets** are at least 44 by 44 pt on coarse pointers.
- **Segmented controls** for 2 to 4 exclusive choices; a stepper for previous
  and next; a popover calendar for date choice.
- **Calendar:** two taps pick a period, also across months. The selection is
  tinted. Arrows step the whole period.
- **Keyboard:** every control is reachable and visibly focused.
- **Motion** is short, with the ease `cubic-bezier(.22, 1, .36, 1)`, and is
  removed under `prefers-reduced-motion`.
- **Selecting** a bar or slot shows a callout with its time and price.

## Accessibility

- Interactive elements have roles, `aria-label`s, and `aria-checked` or
  `aria-expanded` where they apply.
- A table with all prices can be shown under the chart (a link toggles it).
- Honor `prefers-color-scheme`, `prefers-contrast`, `prefers-reduced-motion`,
  `prefers-reduced-transparency`, and `forced-colors`.
- Layout uses logical properties, so right-to-left works.
- Decorative icons are `aria-hidden`.

## Visual editor

The editor mirrors iOS Settings: grouped rows in inset sections.

- Sections follow `KAIROS_FORM`. All sections start open
  (`editor_expand_sections`).
- Row controls: a switch for booleans, a segmented control for 2 to 4 choices, a
  menu for more, a number field with its unit, and a text or entity field below
  its label.
- **Number fields line up.** The unit sits in a fixed-width column, so all
  inputs end at the same edge, with or without a unit.
- Dependent rows (`dep`) are greyed out and inert while their parent is off.
- Invalid input gets a red outline and a message in place of the hint; it never
  reaches the card.
- Options that depend on another option show only what applies, for example the
  period options for the start day.
- Label in sentence case, hint in one short sentence. The footer shows the card
  version.

## Content and language

- English is the default and the fallback; Dutch is complete. Every visible
  string goes through the dictionary (`KAIROS_I18N`). New text needs both
  languages.
- Dates and numbers use the locale of the user. Time is 24 h by default
  (`time_format`).
- Prices show in ct/kWh below one currency unit and in the currency above it;
  `unit`, `decimals`, `currency`, and `currency_display` override this.
- Keep text short: tiles and controls must not wrap in compact mode.

## Brand

The brand is **Kairos**, with the slogan "Charge at the right moment." The logo
is a price line with quarter-hour steps and one highlighted dip: the cheapest
moment. Logo files, colors, and usage rules are in
`assets/branding/brand_guide.md`.

- The brand colors (teal accent, ink, paper, night) are for brand assets only.
  The card UI uses the tokens in `KAIROS_TOK` and `KAIROS_HEAT`, never a brand
  color as a raw color.
- The footer shows the name `Kairos` and the version.
- Use the light logo files on light backgrounds and the dark ones on dark
  backgrounds. Do not recolor, stretch, or add effects to the logo.

## Icons

Hand-drawn SVG paths in `KAIROS_ICONS` on a 24 px grid with rounded strokes:
bolt, arrows, calendar, flat, warn, euro, flame (heatmap), receipt (breakdown),
bars, lines, retry, table, target, clock, check, minus, plus, fit, and restore.
Add new icons to the same set and style. The header icon may be any `mdi:` icon.

## Resources

What the card depends on, and what it must never depend on.

### Home Assistant entities

| Option           | Default                                          | Purpose                   |
| :--------------- | :----------------------------------------------- | :------------------------ |
| `entity`         | `sensor.nord_pool_the_netherlands_prices`        | Today and tomorrow prices |
| `history_entity` | `sensor.nord_pool_the_netherlands_current_price` | Past days and ranges      |
| `entities`       | none                                             | Fallback sensors          |

- The price sensor has the attributes `today` and `tomorrow`, each a list of
  `{start, end, energy_price}` in EUR/kWh, in 15-minute slots.
- The history sensor has `state_class: measurement` so the recorder keeps
  statistics.

### Home Assistant interfaces

- `recorder/statistics_during_period` with periods `hour`, `day`, `week`, and
  `month` for ranges and the calendar.
- `history/history_during_period` for quarter-hour prices of recent days.
- The Home Assistant theme variables listed under Color.

### Rules for resources

- Read data only through the sensors and interfaces above. The card does not
  fetch from the internet.
- A missing or unavailable sensor shows a clear status message, not a broken
  chart.
- New sources (for example ENTSO-E) must deliver the same slot structure, so the
  views and ranges work unchanged. The default header is the Kairos logo and
  title; a source shows its own title and logo only when `source` is set.
- No external fonts, images, icon sets, or scripts. Everything ships in the
  single file.

## Checklist for a UI change

- [ ] Uses tokens and the type scale; no raw colors or sizes.
- [ ] Looks right in light, dark, and at 500 px, 720 px, and 1100 px wide.
- [ ] Touch targets are 44 pt; works with keyboard.
- [ ] Contrast is at least 3:1 for data and 4.5:1 for text in both schemes.
- [ ] Strings exist in English and Dutch.
- [ ] New option: default, editor row, label, hint, validation, header comment,
      and changelog entry.
- [ ] `KAIROS_VERSION` is bumped and Super Linter and `npm run test:smoke` pass.
- [ ] This document is updated when a rule changed.
