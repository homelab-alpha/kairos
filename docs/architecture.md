# Architecture

How `kairos_card.js` works. Names are the ones used in the code.

## Overview

One file defines two custom elements: `kairos-card` and `kairos-card-editor`.
Both render into a Shadow DOM. The chart is hand-written SVG. There are no
dependencies.

## Data

- The price sensor provides the attributes `today` and `tomorrow` as lists of
  `{start, end, energy_price}` (15-minute slots, EUR/kWh).
- The history sensor provides past days and ranges through recorder statistics
  (`recorder/statistics_during_period`) and the history WebSocket
  (`history/history_during_period`). Data older than the quarter-hour history
  window is hourly.

## State and ranges

- `_eff()` returns the effective view state: style, view, period, heat, vat,
  day, and range.
- `_rangeSpec(key, off)` returns `{key, kind, res, start, end}` for a range:
  kind is hours, days, or months; res is hour, day, week, or month.
- The custom range key is `custom`, with `_ui.custom = {from, to}`.
- `_periodChoices(range)` and `_rangeRes(key)` define the resolution options and
  defaults. The start day of the configuration uses the configured `period` when
  it applies.
- `_ui` holds what the user changed at runtime (`res`, `period`, `day`, `range`,
  `view`); the configuration holds the defaults.
- Day keys are `today`, `yesterday`, `tomorrow`, or `YYYY-MM-DD`. Always
  normalize through `_key(_dayParts(x))` before comparing.
- Weeks start on Monday (`_weekStart`, `_weekNo`, `_bucketEnd`).

## Calendar

Two taps select a period (`_calAnchor`, `_pickCalDay`). The selected custom
period is tinted with the `.inr` class. `_pickRange` resets `res` and `period`.

## Zoom

`this._zoom = {a, b}` holds the visible fractions of the full time span and is
reset when the signature (`_zoomSig`) changes. `_chart` computes the visible
window, a clip path `#kairos-view`, and `inView()`. `_redrawChart` redraws the
SVG in place. Gestures: wheel, ctrl+wheel and trackpad pinch, sideways scroll,
mouse drag, keys `+ - 0`, touch double tap, and two-finger pan. The primary
pointer is detected with `matchMedia("(pointer:coarse)")` in `_coarse()`.

## Layout

`_measure()` picks the display mode from the host width: compact below 720 px,
otherwise regular. On a card marked as kiosk (the `kiosk` option), `auto` goes
on to large above 1024 px and kiosk above 1600 px. The controls are
`.bar > .dgrp (calendar button, stepper) + .tools (view, period, chart type)`.

## Editor

`KAIROS_FORM` defines the sections and rows (`seg`, `select`, `num`, `bool`,
`text`, `list`, `entity`, `bands`, with `dep` for dependent rows). `KAIROS_ED`
provides the text in English and Dutch: labels, hints, option names, section
titles, and buttons and messages. The editor builds its rows again when Home
Assistant reports another language. `_sync()` writes the values into the
controls; `_syncPeriod()` shows only the periods that apply to the start day.
Units in number rows sit in a fixed-width column so the inputs align.
