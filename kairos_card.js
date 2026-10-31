/**
 * Kairos
 *
 * Home Assistant custom card (Lovelace) that shows day-ahead electricity prices from a template sensor with the
 * attributes `today` and `tomorrow` (lists of { start, end, energy_price }). Yesterday and older come from the
 * recorder history of `history_entity`.
 *
 * Rendering: hand-written SVG inside a Shadow DOM. No dependencies, no build step, no web fonts.
 * Layout: a ResizeObserver measures the host (display mode) and the chart cell (SVG pixel width); the host is also a
 * CSS size container (`container-type: inline-size`), and the fluid price size uses container units (`cqi`).
 *
 * APIs that need a fallback: ResizeObserver (window resize), `color-mix()` (flat colors), `backdrop-filter` (opaque
 * callout), `:dir(rtl)` (LTR thumb), `cqi` units (`clamp()` minimum), Pointer Events (required, widely supported).
 *
 * Configuration (all options are also available in the visual editor, in the same order):
 *   Entity
 *     entity, entities         Sensor entity id; `entities` is an optional fallback list (first usable entity wins).
 *     history_entity           Sensor with the bare price per slot (EUR/kWh); its long-term statistics give the
 *                              history for the calendar (days, months, years) and for past days in the chart.
 *     history_quarter_days     Days back (0-10) that show quarter-hour prices from the recorded states of the history
 *                              entity (needs the recorder to keep that many days); older days show hourly averages.
 *   Header
 *     source                   custom (default) | nord_pool | entsoe. The last two show their own title and logo.
 *     show_header, title, icon Card title ({day} placeholder, default `Kairos`) and an `ha-icon` (default the Kairos
 *                              logo; false for none). Only the custom source uses them; the other sources ignore
 *                              them. The editor hides them for those.
 *   Data and view
 *     day                      today | tomorrow | yesterday | week | month | year | q1 | q2 | q3 | q4 | YYYY-MM-DD.
 *     auto_advance_tomorrow    Switch to tomorrow automatically when its prices are published.
 *     view                     price | heatmap | breakdown.
 *     period                   Follows `day`: day 15min | hour; week hour | day; month day | week; year week | month;
 *                              quarter day | week | month.
 *     chart_style              auto | bars | line; auto picks by available width.
 *
 *   Prices and VAT
 *     vat, vat_rate, energy_tax, surcharge, fixed_price, fixed_label  Price build-up. Neutral by default: no energy
 *                              tax or surcharge, and no fixed rate (fixed_price 0 hides it).
 *   Units and formatting
 *     unit, decimals, currency, currency_display  `auto` | `ct/kWh` | `EUR/kWh` | `SEK/kWh`; rounding; symbol or code.
 *     time_format              auto (Home Assistant profile) | 12 | 24 hour clock.
 *     axis_am_pm, axis_minutes Time axis labels: with or without AM/PM, "02:00" or "02".
 *
 *   Highlights
 *     cheapest_quarters        Number of cheapest slots highlighted in the heatmap view.
 *     best_window_hours        Highlight the cheapest contiguous window of N hours (0 = off).
 *     price_bands              auto (percentiles), [low, high], or { low, high } in EUR/kWh as displayed.
 *
 *   Chart elements
 *     show_chart, show_hour_grid, show_now_marker, show_extremes, show_average_line, show_fixed_line,
 *     average_line_size,       small | medium (default) | large: stroke width of the average line and of the
 *     fixed_line_size          fixed rate line.
 *     heat_gradient            horizontal (default: one color gradient over the chart height) | vertical (one solid
 *                              color per bar, by its price).
 *     zoom_desktop             Zoom the time axis on desktop and laptop: wheel over the chart, drag, keys, buttons.
 *     zoom_touch               Zoom the time axis on iPhone and iPad: double tap, two-finger pan, buttons.
 *     zoom_buttons_desktop     Show the -, +, and reset buttons on desktop and laptop (true by default).
 *     zoom_buttons_touch       Show the reset button while zoomed on iPhone and iPad (true by default).
 *
 *   Summary sections
 *     show_stats, show_legend  Tiles, and the cheapest summary (total time, average, next window, other windows).
 *
 *   Controls
 *     show_controls, show_day_button, show_period_button, show_chart_type_button, show_price_button,
 *     show_heatmap_button, show_breakdown_button, show_cheapest_stepper
 *
 *   Opacity (0..100)
 *     price_bar_opacity, price_line_opacity, heatmap_bar_opacity, heatmap_line_opacity,
 *     breakdown_bar_opacity, breakdown_line_opacity
 *
 *   Appearance
 *     color_scheme (auto | light | dark), pixel_shift,
 *     display_mode_desktop     Display mode on desktop and laptop: auto | compact | regular. Auto is compact below
 *                              720 px card width and regular above.
 *     display_mode_touch       Display mode on tablet and smartphone (touch screens), same values as above.
 *     kiosk                    This card is on a kiosk or wall display (false by default). It then uses
 *                              display_mode_kiosk instead of the two options above, whatever the pointer.
 *     display_mode_kiosk       Display mode on a kiosk: auto | compact | regular | large | kiosk. Auto picks by the
 *                              card width: compact below 720 px, regular to 1024, large to 1600, kiosk above.
 *     editor_expand_sections (true by default: every section of the visual editor starts open).
 *
 *   Experimental (can stop working after a Home Assistant update)
 *     edit_button              A button in the header that opens the card editor (false by default; admins only).
 *     edit_button_icon         Icon of the edit button: sliders (default) | gear | pencil | pencil_square.
 *     edit_link                An Edit text link at the right of the footer line that opens the card editor
 *                              like the edit button does (false by default; admins only).
 *     update_menu              Show the Dashboard resource button in an Update section at the top of the editor
 *                              (false by default).
 *     (button) Dashboard resource  One smart button, also at the top of the editor (see update_menu): Check (is
 *                              there a newer file?), then Update when there is one (sets the Dashboard Resource to
 *                              /local/kairos_card.js?v=<version of that file>), then Reload (saves the card,
 *                              leaves the dashboard edit mode, and reloads the page).
 */

const PERIOD_KEYS = {
  "15min": ["t_15", "n_15"],
  hour: ["t_60", "n_60"],
  day: ["t_d", "n_d"],
  week: ["t_w", "n_w"],
  month: ["t_m", "n_m"],
};
const KAIROS_VERSION = "0.1.0";
/** A Home Assistant entity id: domain and object id, lowercase letters, digits, and underscores. */
const KAIROS_ENTITY_ID = /^[a-z0-9_]+\.[a-z0-9_]+$/;

/** Escapes text for HTML content and double- or single-quoted attributes. Every dynamic value goes through it. */
function kairosEsc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
const KAIROS_IDLE_MS = 30000;
const KAIROS_CHART_STYLES = ["auto", "bars", "line"];
const KAIROS_VIEWS = ["price", "heatmap", "breakdown"];
const KAIROS_MODES = ["auto", "compact", "regular", "large", "kiosk"];
/** Modes for desktop, laptop, tablet, and smartphone; large and kiosk are only for a kiosk. */
const KAIROS_MODES_SMALL = ["auto", "compact", "regular"];
/** Icons for the edit button (keys of KAIROS_ICONS). */
const KAIROS_EDIT_ICONS = ["sliders", "gear", "pencil", "pencil_square"];

/** Path of the card file in the Home Assistant `www` folder; the dashboard resource must point to it. */
const KAIROS_RESOURCE_PATH = "/local/kairos_card.js";

/** Finds the first element that matches `sel`, looking through all shadow roots below `root`. */
function kairosDeepQuery(root, sel) {
  const hit = root.querySelector(sel);
  if (hit) return hit;
  for (const el of root.querySelectorAll("*")) {
    if (el.shadowRoot) {
      const found = kairosDeepQuery(el.shadowRoot, sel);
      if (found) return found;
    }
  }
  return null;
}

/** Presses Done in the dashboard toolbar (the only text button of the edit mode bar). True when it was pressed. */
function kairosPressDone() {
  const root = kairosDeepQuery(document, "hui-root");
  const bar = root && root.shadowRoot;
  if (!bar) return false;
  const scope = bar.querySelector(".edit-mode") || bar;
  const done = [...scope.querySelectorAll("ha-button, mwc-button")].find((b) => !b.disabled);
  if (!done) return false;
  done.click();
  return true;
}

const KAIROS_EXIT_EDIT_KEY = "kairos_exit_edit";

/**
 * Experimental: right after a Reload from the dashboard edit mode, Home Assistant can bring the edit mode back
 * (the browser history still holds the `?edit=1` entry from before). While the flag set by the Reload is fresh, this
 * presses Done again for a few seconds, so the dashboard ends outside the edit mode.
 */
function kairosGuardEditMode(flag, getHref, ms = 10000) {
  if (!flag || Date.now() - flag > 20000) return;
  const end = Date.now() + ms;
  let last = 0;
  const tick = () => {
    if (Date.now() > end) return;
    let editing = false;
    try {
      editing = new URL(getHref()).searchParams.has("edit");
    } catch (e) {
      editing = false;
    }
    if (editing && Date.now() - last > 1500 && kairosPressDone()) last = Date.now();
    setTimeout(tick, 250);
  };
  tick();
}

/**
 * Experimental: looks up the version of the file on the server and the Dashboard Resource of this card. An update is
 * available when the resource does not point to `/local/kairos_card.js?v=<version of the file>` yet.
 * Home Assistant only offers the resource list through admin WebSocket commands.
 */
async function kairosCheckResource(hass) {
  if (!hass || typeof hass.callWS !== "function") throw kairosUiError("not_connected");
  const res = await fetch(`${KAIROS_RESOURCE_PATH}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw kairosUiError("cannot_read", { path: KAIROS_RESOURCE_PATH, status: res.status });
  const m = /const KAIROS_VERSION = "([^"]+)"/.exec(await res.text());
  if (!m) throw kairosUiError("no_version", { path: KAIROS_RESOURCE_PATH });
  const version = m[1];
  const list = await hass.callWS({ type: "lovelace/resources" });
  const found = (list || []).find((r) => String(r.url).split("?")[0].endsWith(KAIROS_RESOURCE_PATH));
  if (!found) {
    throw kairosUiError("no_resource", { path: KAIROS_RESOURCE_PATH });
  }
  const url = `${KAIROS_RESOURCE_PATH}?v=${version}`;
  return { version, found, url, available: found.url !== url };
}

/**
 * Experimental: sets the Dashboard Resource to the version of the file on the server. Returns the editor message key
 * (`up_to_date` or `resource_set`) with the version; the editor shows it in its own language.
 */
async function kairosUpdateResource(hass) {
  const st = await kairosCheckResource(hass);
  if (!st.available) return { key: "up_to_date", version: st.version };
  const { found, url, version } = st;
  await hass.callWS({ type: "lovelace/resources/update", resource_id: found.id, res_type: found.type, url });
  return { key: "resource_set", version };
}
/** Closed bar outline with rounded outer corners; `yv` is the value end, `yz` the baseline. */
function kairosBarPath(x, w, yv, yz, k) {
  let top = yv;
  if (Math.abs(yz - yv) < 2) top = yv <= yz ? yz - 2 : yz + 2;
  const up = top <= yz;
  const h = Math.abs(yz - top);
  const r = Math.max(0, Math.min(3 * k, w / 2, h));
  return up
    ? `M${x},${yz}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${yz}Z`
    : `M${x},${yz}V${top - r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top - r}V${yz}Z`;
}

/** Smooth monotone cubic path through the points; `move = false` continues an existing path. */
function kairosCurve(pts, move = true) {
  const n = pts.length;
  let d = move ? `M${pts[0][0]},${pts[0][1]}` : "";
  if (n < 2) return d;
  const dx = [];
  const sl = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0] || 1e-9;
    sl[i] = (pts[i + 1][1] - pts[i][1]) / dx[i];
  }
  const t = [sl[0]];
  for (let i = 1; i < n - 1; i++) t[i] = sl[i - 1] * sl[i] <= 0 ? 0 : (2 * sl[i - 1] * sl[i]) / (sl[i - 1] + sl[i]);
  t[n - 1] = sl[n - 2];
  for (let i = 0; i < n - 1; i++) {
    const hh = dx[i];
    d +=
      ` C${pts[i][0] + hh / 3},${pts[i][1] + (t[i] * hh) / 3} ` +
      `${pts[i + 1][0] - hh / 3},${pts[i + 1][1] - (t[i + 1] * hh) / 3} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

/** Fills `{name}` placeholders in a text. */
function kairosFmt(text, vars) {
  return vars ? String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : String(text);
}
/** An error with an English message and the editor message key, so the editor can show it in its own language. */
function kairosUiError(key, vars) {
  const err = new Error(kairosFmt(KAIROS_ED.en.ui[key], vars));
  err.kairosKey = key;
  err.kairosVars = vars;
  return err;
}
/** Time of an edit button press that still waits for the dashboard edit mode (0 = none); see `_openEditor`. */
let kairosEditorPending = 0;
const KAIROS_RANGES = ["week", "month", "year", "q1", "q2", "q3", "q4"];

/** Periods that apply to a start day, with the default first; a single day offers quarter hours and hours. */
function kairosPeriodsFor(day) {
  if (day === "week") return { o: ["hour", "day"], d: "hour" };
  if (day === "month") return { o: ["day", "week"], d: "day" };
  if (day === "year") return { o: ["week", "month"], d: "week" };
  if (/^q[1-4]$/.test(day)) return { o: ["day", "week", "month"], d: "week" };
  return { o: ["15min", "hour"], d: "15min" };
}
/**
 * The data sources the header can brand. `title` is the default title; the logo is the mark in KAIROS_MARKS for the
 * source key (see BRAND MARKS), or the `mdi` icon of the source when it has no mark. `custom` shows the Kairos
 * title and logo unless the configuration sets `title` or `icon`. Credentials
 * for a source that needs them (username, password, API key) will be listed here as `fields`, and the editor will
 * show them for the selected source.
 */
const KAIROS_SOURCES = {
  custom: { title: "Kairos" },
  nord_pool: { title: "Nord Pool \u00B7 Day-Ahead Market" },
  entsoe: { title: "ENTSO-E \u00B7 Day-Ahead Market" },
};
const KAIROS_DEFAULTS = {
  // Entity
  entity: "sensor.nord_pool_the_netherlands_prices",
  history_entity: "sensor.nord_pool_the_netherlands_current_price",
  history_quarter_days: 7,
  // Header
  source: "custom",
  show_header: true,
  title: "",
  icon: "",
  // Data and view
  day: "today",
  auto_advance_tomorrow: false,
  view: "price",
  period: "15min",
  chart_style: "bars",
  // Prices and VAT
  vat: true,
  vat_rate: 21,
  energy_tax: 0,
  surcharge: 0.0,
  fixed_price: 0,
  fixed_label: "",
  // Units and formatting
  unit: "auto",
  decimals: null,
  currency: "EUR",
  currency_display: "symbol",
  time_format: "24",
  axis_am_pm: false,
  axis_minutes: false,
  // Highlights
  cheapest_quarters: 10,
  best_window_hours: 0,
  price_bands: "auto",
  // Chart elements
  heat_gradient: "horizontal",
  show_chart: true,
  show_hour_grid: true,
  show_now_marker: true,
  show_extremes: false,
  zoom_desktop: false,
  zoom_touch: false,
  zoom_buttons_desktop: true,
  zoom_buttons_touch: true,
  show_average_line: false,
  average_line_size: "medium",
  fixed_line_size: "medium",
  show_fixed_line: false,
  // Summary sections
  show_stats: true,
  show_legend: true,
  // Controls
  show_controls: true,
  show_day_button: true,
  show_period_button: true,
  show_chart_type_button: true,
  show_price_button: true,
  show_heatmap_button: true,
  show_breakdown_button: true,
  show_cheapest_stepper: false,
  // Opacity
  price_bar_opacity: 75,
  price_line_opacity: 60,
  heatmap_bar_opacity: 75,
  heatmap_line_opacity: 60,
  breakdown_bar_opacity: 75,
  breakdown_line_opacity: 60,
  // Appearance
  color_scheme: "auto",
  display_mode_desktop: "auto",
  display_mode_touch: "auto",
  kiosk: false,
  display_mode_kiosk: "auto",
  pixel_shift: false,
  editor_expand_sections: true,
  // Experimental
  edit_button: false,
  edit_button_icon: "sliders",
  edit_link: false,
  update_menu: false,
};

/** Heat scale and layer colors per color scheme (all >= 3:1 against the card surface). */
const KAIROS_HEAT = {
  light: {
    cheap: "#7d3c98",
    dgreen: "#1e8449",
    yellow: "#b88a00",
    mid: "#d4600a",
    dred: "#b3261e",
    txt: "#6e6e73",
  },
  dark: {
    cheap: "#bf6fe0",
    dgreen: "#32b562",
    yellow: "#f4d03f",
    mid: "#ff9f0a",
    dred: "#ff5b50",
    txt: "#98989d",
  },
};
const KAIROS_LAYERS = {
  light: {
    e: "#6b7280",
    t: "#2f6fb0",
    sc: "#c0105a",
    v: "#005a9c",
    fixed: "#c0105a",
    vatOff: "#6b7280",
  },
  dark: {
    e: "#9ca3af",
    t: "#5aa9f0",
    sc: "#ff6aa2",
    v: "#8cc8ff",
    fixed: "#ff6aa2",
    vatOff: "#9ca3af",
  },
};

/** Apple-style semantic color tokens (light and dark). */
const KAIROS_TOK = {
  light: {
    label: "#000000",
    label2: "#5c5c61",
    label3: "#8e8e93",
    sep: "rgba(60,60,67,0.29)",
    fill: "rgba(120,120,128,0.12)",
    fill2: "rgba(120,120,128,0.2)",
    bg: "#f2f2f7",
    group: "#f2f2f7",
    surface: "#ffffff",
    thumb: "#ffffff",
    accent: "#0062cc",
    onaccent: "#ffffff",
    green: "#1b7a34",
    orange: "#b34700",
    red: "#c4161c",
  },
  dark: {
    label: "#ffffff",
    label2: "#aeaeb2",
    label3: "#8e8e93",
    sep: "rgba(84,84,88,0.65)",
    fill: "rgba(120,120,128,0.24)",
    fill2: "rgba(120,120,128,0.36)",
    bg: "#000000",
    group: "#2c2c2e",
    surface: "#1c1c1e",
    thumb: "#636366",
    accent: "#4da3ff",
    onaccent: "#000000",
    green: "#30d158",
    orange: "#ff9f0a",
    red: "#ff6961",
  },
};
const KAIROS_HA_VARS = {
  label: "--primary-text-color",
  label2: "--secondary-text-color",
  surface: "--card-background-color",
};

/** Token stylesheet; Home Assistant theme variables override text and surface colors in `auto` mode. */
function kairosTokens(scheme, auto) {
  const t = KAIROS_TOK[scheme] || KAIROS_TOK.light;
  const val = (k) => (auto && KAIROS_HA_VARS[k] ? `var(${KAIROS_HA_VARS[k]},${t[k]})` : t[k]);
  return `.kairos,.ed{${Object.keys(t)
    .map((k) => `--${k}:${val(k)}`)
    .join(";")};color-scheme:${scheme}}`;
}

/** Translation dictionary. English is the default and the fallback for missing keys. */
const KAIROS_I18N = {
  en: {
    week: "This week",
    last_week: "Last week",
    week_n: "Week {n}",
    week_s: "W{n}",
    last_month: "Last month",
    last_year: "Last year",
    quarter_1: "First quarter",
    quarter_2: "Second quarter",
    quarter_3: "Third quarter",
    quarter_4: "Fourth quarter",
    month: "This month",
    year: "This year",
    grp_days: "Days",
    grp_quarters: "Quarter",
    tab_ranges: "Ranges",
    tab_cal: "Calendar",
    avg_range: "Average",
    d1: "day",
    ds: "days",
    mo1: "month",
    w1: "week",
    ws: "weeks",
    mos: "months",
    prev_day: "Previous day",
    next_day: "Next day",
    prev_period: "Previous period",
    next_period: "Next period",
    choose_day: "Choose a day",
    prev_month: "Previous month",
    prev_year: "Previous year",
    next_year: "Next year",
    prev_years: "Previous years",
    next_years: "Next years",
    cal_up_month: "Choose a month",
    cal_up_year: "Choose a year",
    cal_loading: "Loading price history\u2026",
    cal_pick_end: "Choose the last day of the period",
    zoom: "Zoom",
    zoom_in: "Zoom in",
    zoom_out: "Zoom out",
    zoom_reset: "Reset zoom",
    custom_range: "Period",
    cal_nohist: "Price history is not available",
    next_month: "Next month",
    cal_note: "Prices are available for yesterday, today and tomorrow",
    go_today: "Today",
    today: "Today",
    tomorrow: "Tomorrow",
    yesterday: "Yesterday",
    now: "Now",
    g_day: "Day",
    g_period: "Period",
    g_chart: "Chart type",
    g_view: "View",
    n_15: "15 minutes",
    t_15: "15 min",
    n_60: "1 hour",
    t_60: "1 h",
    n_d: "Per day",
    t_d: "Day",
    n_w: "Per week",
    t_w: "Week",
    n_m: "Per month",
    t_m: "Month",
    n_bar: "Bar chart",
    n_line: "Line chart",
    t_bar: "Bar",
    t_line: "Line",
    v_price: "Price",
    v_heat: "Heatmap",
    v_brk: "Breakdown",
    vat: "VAT",
    pending: "Available around 13:00 CET",
    daily_avg: "Daily average",
    average: "Average",
    lowest: "Cheapest",
    highest: "Most expensive",
    fixed: "Fixed rate",
    fixed_label: "Energy company",
    all_slots: "all {slot}",
    lvl_low: "Cheap",
    lvl_mid: "Average",
    lvl_high: "Expensive",
    next_q: "Next quarter",
    next_h: "Next hour",
    q1: "quarter",
    h1: "hour",
    qs: "quarters",
    hs: "hours",
    above: "above average",
    below: "below average",
    equal: "equal to average",
    win_total: "Total time",
    win_avg: "Average price",
    win_next: "Next window",
    win_active: "Active window",
    win_in: "In {t}",
    win_now: "Ends in {t}",
    win_first: "First window",
    win_earlier: "Earlier today",
    win_later: "Later",
    show_data: "Show data",
    hide_data: "Hide data",
    updated: "Updated {time}",
    stale: "Data may be outdated",
    loading: "Loading prices",
    e_missing: "Entity not found",
    e_unavail: "Prices unavailable",
    e_unavail_d: "The sensor is not reporting prices right now.",
    e_render: "Unable to show the chart",
    retry: "Retry",
    edit_card: "Edit card",
    edit_link: "Edit",
    empty: "No price data yet",
    empty_d: "Day-ahead prices are usually published around 13:00 CET.",
    show_today: "Show today",
    incl: "incl. VAT",
    bare: "bare price",
    best: "Best {n} h window",
    cheapest_x: "Cheapest {x}",
    more: "More",
    fewer: "Fewer",
    off: "off",
    step_q: "Cheapest quarters",
    step_h: "Cheapest hours",
    brk_e: "Bare price",
    brk_t: "Energy tax",
    brk_sc: "Surcharge",
    brk_v: "VAT",
    off1: "Off-peak 1",
    peak: "Peak",
    off2: "Off-peak 2",
    hour: "Hour",
    col_time: "Time",
    col_price: "Price",
    col_level: "Level",
    data_cap: "All prices for {day}",
    chart_name: "Electricity prices {day}, {vat}",
    summary:
      "Electricity prices {day}, {vat}. Cheapest {slot} {lo} at {lot}. Most expensive {slot} {hi} at {hit}. " +
      "{avl} {av}.{now} Use the arrow keys to step through the {slot}s.",
    sum_now: " Now {price}, level {level}.",
    next_in: "{slot} after this",
  },
  nl: {
    week: "Deze week",
    last_week: "Vorige week",
    week_n: "Week {n}",
    week_s: "wk {n}",
    last_month: "Vorige maand",
    last_year: "Vorig jaar",
    quarter_1: "Eerste kwartaal",
    quarter_2: "Tweede kwartaal",
    quarter_3: "Derde kwartaal",
    quarter_4: "Vierde kwartaal",
    month: "Deze maand",
    year: "Dit jaar",
    grp_days: "Dagen",
    grp_quarters: "Kwartaal",
    tab_ranges: "Periodes",
    tab_cal: "Kalender",
    avg_range: "Gemiddeld",
    d1: "dag",
    ds: "dagen",
    mo1: "maand",
    w1: "week",
    ws: "weken",
    mos: "maanden",
    prev_day: "Vorige dag",
    next_day: "Volgende dag",
    prev_period: "Vorige periode",
    next_period: "Volgende periode",
    choose_day: "Kies een dag",
    prev_month: "Vorige maand",
    prev_year: "Vorig jaar",
    next_year: "Volgend jaar",
    prev_years: "Vorige jaren",
    next_years: "Volgende jaren",
    cal_up_month: "Kies een maand",
    cal_up_year: "Kies een jaar",
    cal_loading: "Prijshistorie laden\u2026",
    cal_pick_end: "Kies de laatste dag van de periode",
    zoom: "Zoom",
    zoom_in: "Inzoomen",
    zoom_out: "Uitzoomen",
    zoom_reset: "Zoom herstellen",
    custom_range: "Periode",
    cal_nohist: "Prijshistorie is niet beschikbaar",
    next_month: "Volgende maand",
    cal_note: "Prijzen zijn beschikbaar voor gisteren, vandaag en morgen",
    go_today: "Vandaag",
    today: "Vandaag",
    tomorrow: "Morgen",
    yesterday: "Gisteren",
    now: "Nu",
    g_day: "Dag",
    g_period: "Periode",
    g_chart: "Grafiektype",
    g_view: "Weergave",
    n_15: "15 minuten",
    t_15: "15 min",
    n_60: "1 uur",
    t_60: "1 u",
    n_d: "Per dag",
    t_d: "Dag",
    n_w: "Per week",
    t_w: "Week",
    n_m: "Per maand",
    t_m: "Maand",
    n_bar: "Staafgrafiek",
    n_line: "Lijngrafiek",
    t_bar: "Staaf",
    t_line: "Lijn",
    v_price: "Prijs",
    v_heat: "Heatmap",
    v_brk: "Opbouw",
    vat: "BTW",
    pending: "Beschikbaar rond 13:00 CET",
    daily_avg: "Daggemiddelde",
    average: "Gemiddeld",
    lowest: "Goedkoopst",
    highest: "Duurst",
    fixed: "Vast tarief",
    fixed_label: "Energiebedrijf",
    all_slots: "alle {slot}",
    lvl_low: "Goedkoop",
    lvl_mid: "Gemiddeld",
    lvl_high: "Duur",
    next_q: "Volgend kwartier",
    next_h: "Volgend uur",
    q1: "kwartier",
    h1: "uur",
    qs: "kwartieren",
    hs: "uur",
    above: "boven gemiddelde",
    below: "onder gemiddelde",
    equal: "gelijk aan gemiddelde",
    win_total: "Totale tijd",
    win_avg: "Gemiddelde prijs",
    win_next: "Volgend venster",
    win_active: "Actief venster",
    win_in: "Over {t}",
    win_now: "Eindigt over {t}",
    win_first: "Eerste venster",
    win_earlier: "Eerder vandaag",
    win_later: "Later",
    show_data: "Toon data",
    hide_data: "Verberg data",
    updated: "Bijgewerkt {time}",
    stale: "Gegevens mogelijk verouderd",
    loading: "Prijzen laden",
    e_missing: "Entiteit niet gevonden",
    e_unavail: "Prijzen niet beschikbaar",
    e_unavail_d: "De sensor geeft op dit moment geen prijzen door.",
    e_render: "Grafiek kan niet worden getoond",
    retry: "Opnieuw proberen",
    edit_card: "Kaart bewerken",
    edit_link: "Bewerken",
    empty: "Nog geen prijsgegevens",
    empty_d: "De day-ahead prijzen worden meestal rond 13:00 CET gepubliceerd.",
    show_today: "Toon vandaag",
    incl: "incl. btw",
    bare: "kale prijs",
    best: "Beste venster van {n} u",
    cheapest_x: "Goedkoopste {x}",
    more: "Meer",
    fewer: "Minder",
    off: "uit",
    step_q: "Goedkoopste kwartieren",
    step_h: "Goedkoopste uren",
    brk_e: "Kale prijs",
    brk_t: "Energiebelasting",
    brk_sc: "Opslag",
    brk_v: "BTW",
    off1: "Dal 1",
    peak: "Piek",
    off2: "Dal 2",
    hour: "Uur",
    col_time: "Tijd",
    col_price: "Prijs",
    col_level: "Niveau",
    data_cap: "Alle prijzen voor {day}",
    chart_name: "Elektriciteitsprijzen {day}, {vat}",
    summary:
      "Elektriciteitsprijzen {day}, {vat}. Goedkoopste {slot} {lo} om {lot}. Duurste {slot} {hi} om {hit}. " +
      "{avl} {av}.{now} Gebruik de pijltjestoetsen om door de {slot}s te lopen.",
    sum_now: " Nu {price}, niveau {level}.",
    next_in: "{slot} hierna",
  },
};

/** Original inline icons in the SF Symbols style: 24 px grid, 1.75 stroke, round caps and joins. */
const KAIROS_ICONS = {
  bolt: '<path d="M13 2.5 5.5 13.5H11l-1 8 7.5-11H12z"/>',
  left: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  right: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
  up: '<path d="M5.5 14.5 12 8l6.5 6.5"/>',
  down: '<path d="M5.5 9.5 12 16l6.5-6.5"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="3.5"/><path d="M8 3.5v4M16 3.5v4M4 10.5h16"/>',
  arrowUp: '<path d="M12 19V5.5M6.5 11 12 5.5 17.5 11"/>',
  arrowDown: '<path d="M12 5v13.5M6.5 13 12 18.5 17.5 13"/>',
  flat: '<path d="M5 12h14"/>',
  warn: '<path d="M12 4 3 19.5h18z"/><path d="M12 10v4.5M12 17.2v.1"/>',
  euro: '<path d="M16.5 7.2a6 6 0 1 0 0 9.6M5 10.2h8M5 13.8h8"/>',
  flame:
    '<path d="M12 21a6 6 0 0 0 6-6c0-3.5-2.5-5.5-3.5-9-2 1-3 2.8-3 4.5-1.5-.5-2.3-1.7-2.5-3C7.5 9 6 11.5 6 15a6 6 ' +
    '0 0 0 6 6z"/>',
  receipt: '<path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z"/><path d="M9.5 8.5h5M9.5 12.5h5"/>',
  bars: '<path d="M6 20v-8M12 20V5M18 20v-5"/>',
  lines: '<path d="m3.5 17 6-6.5 4 4 7-8"/>',
  retry: '<path d="M19.5 12a7.5 7.5 0 1 1-2.4-5.5M19.5 4.5V9H15"/>',
  sliders: '<path d="M5 8h14M5 16h14"/><circle cx="9" cy="8" r="2.2"/><circle cx="15" cy="16" r="2.2"/>',
  pencil: '<path d="M4.5 19.5 5.3 15 15.8 4.5a2.1 2.1 0 0 1 3 3L8.3 18z"/><path d="m14 6.3 3.7 3.7"/>',
  pencil_square:
    '<path d="M11 5H7a2.5 2.5 0 0 0-2.5 2.5v9A2.5 2.5 0 0 0 7 19h9a2.5 2.5 0 0 0 2.5-2.5V13"/><path d="M17.8 4.7a1.9 ' +
    '1.9 0 0 1 2.7 2.7L12.5 15.4 9 16l.6-3.5z"/>',
  gear:
    '<path d="M10.36 4.89L10.69 2.69L13.31 2.69L13.64 4.89A7.3 7.3 0 0 1 15.87 5.81L17.66 4.49L19.51 6.34L18.19 ' +
    "8.13A7.3 7.3 0 0 1 19.11 10.36L21.31 10.69L21.31 13.31L19.11 13.64A7.3 7.3 0 0 1 18.19 15.87L19.51 17.66L17.66 " +
    "19.51L15.87 18.19A7.3 7.3 0 0 1 13.64 19.11L13.31 21.31L10.69 21.31L10.36 19.11A7.3 7.3 0 0 1 8.13 18.19L6.34 " +
    "19.51L4.49 17.66L5.81 15.87A7.3 7.3 0 0 1 4.89 13.64L2.69 13.31L2.69 10.69L4.89 10.36A7.3 7.3 0 0 1 5.81 " +
    '8.13L4.49 6.34L6.34 4.49L8.13 5.81A7.3 7.3 0 0 1 10.36 4.89ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>',
  table: '<rect x="4" y="5" width="16" height="14" rx="3"/><path d="M4 10h16M10 10v9"/>',
  target: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8.5 12.5 12 16l3.5-3.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  check: '<path d="M5 12.5 10 17.5 19 7"/>',
  minus: '<path d="M6 12h12"/>',
  plus: '<path d="M6 12h12M12 6v12"/>',
  fit: '<path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/>',
  restore: '<path d="M4.5 12a7.5 7.5 0 1 0 2.3-5.4"/><path d="M4.5 4.5v4.2h4.2"/>',
};

/** Returns an inline SVG icon; decorative (aria-hidden) by design. */
function kairosIcon(name) {
  return `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${KAIROS_ICONS[name] || ""}</svg>`;
}

/* ==================================================================================================
 * BRAND MARKS (header logos)
 * A source shows a mark when KAIROS_MARKS has an entry for its key in KAIROS_SOURCES; otherwise it shows an `mdi` icon.
 * To add a mark: write a function that returns an inline SVG string (class "mark"), then add it to KAIROS_MARKS.
 * ================================================================================================== */

/**
 * Nord Pool mark: the pixel-column mark, redrawn as inline SVG (no external image needed).
 * Columns are [x index, [top, bottom, color]...] on a 116 x 138 grid.
 */
const KAIROS_NORD_POOL_MARK = [
  [
    [46, 83, "#86bfdf"],
    [83, 111, "#63b3e1"],
  ],
  [
    [19, 59, "#67abd3"],
    [59, 104, "#4fa1cb"],
  ],
  [
    [26, 69, "#6fb0a8"],
    [69, 120, "#51998d"],
  ],
  [
    [0, 45, "#a9cdc7"],
    [45, 130, "#41897e"],
  ],
  [
    [22, 45, "#5f9c7a"],
    [45, 83, "#41905a"],
    [83, 135, "#31726a"],
  ],
  [
    [11, 83, "#5f9a43"],
    [83, 137, "#2e6b60"],
  ],
  [
    [11, 64, "#8dba3f"],
    [64, 120, "#37785a"],
  ],
  [
    [47, 75, "#aed06f"],
    [75, 104, "#479547"],
  ],
  [
    [38, 64, "#b4d78c"],
    [64, 94, "#8eb94e"],
  ],
];

function kairosNordPoolMark() {
  const w = 116 / 9;
  const rects = KAIROS_NORD_POOL_MARK.map((col, i) =>
    col
      .map(
        ([a, b, c]) =>
          `<rect x="${(i * w).toFixed(2)}" y="${a}" width="${(w + 0.3).toFixed(2)}" height="${b - a + 0.3}" ` +
          `fill="${c}"/>`,
      )
      .join(""),
  ).join("");
  return '<svg class="mark" viewBox="0 0 116 138" aria-hidden="true" focusable="false">' + `${rects}</svg>`;
}

/**
 * ENTSO-E mark, redrawn as inline SVG (no external image needed).
 * Shapes are drawn in order on a 512 x 512 grid: a `path` is a list of path segments, an `ellipse` is [cx, cy, rx, ry].
 * `opacity` is the fill opacity; `rule` is the fill rule.
 */
const KAIROS_ENTSOE_MARK = [
  {
    path: [
      "M137 224",
      "C127 151 176 79 245 43",
      "C302 13 369 2 411 35",
      "C461 73 484 143 474 210",
      "C469 245 454 274 432 297",
      "C395 339 340 360 279 361",
      "C213 362 161 326 142 278",
      "C135 260 134 242 137 224Z",
    ],
    fill: "#A5A0D0",
  },
  { ellipse: [207, 274, 170, 123], fill: "#514593", opacity: 0.88 },
  {
    path: [
      "M179 225",
      "C214 180 271 166 326 177",
      "C388 189 439 228 456 282",
      "C476 345 453 414 406 458",
      "C366 495 301 501 245 478",
      "C192 457 159 418 151 366",
      "C143 313 151 263 179 225Z",
    ],
    fill: "#7169AD",
    opacity: 0.88,
  },
  { ellipse: [228, 274, 149, 159], fill: "#292078", opacity: 0.82 },
  {
    path: [
      "M330 283",
      "H154",
      "C157 331 183 364 224 364",
      "C253 364 275 346 287 316",
      "L329 322",
      "C312 370 273 397 223 397",
      "C157 397 112 349 112 275",
      "C112 202 156 150 222 150",
      "C287 150 330 197 330 266",
      "Z",
      "M156 251",
      "H288",
      "C285 209 260 183 223 183",
      "C187 183 162 209 156 251Z",
    ],
    fill: "#FFBE00",
    rule: "evenodd",
  },
];

function kairosEntsoEMark() {
  const shapes = KAIROS_ENTSOE_MARK.map((s) => {
    const paint =
      `fill="${s.fill}"` + (s.opacity ? ` fill-opacity="${s.opacity}"` : "") + (s.rule ? ` fill-rule="${s.rule}"` : "");
    if (s.ellipse) {
      const [cx, cy, rx, ry] = s.ellipse;
      return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${paint}/>`;
    }
    return `<path d="${s.path.join(" ")}" ${paint}/>`;
  }).join("");
  return '<svg class="mark" viewBox="0 0 512 512" aria-hidden="true" focusable="false">' + `${shapes}</svg>`;
}

/**
 * Kairos mark: the price line with quarter-hour steps and one highlighted dip. The line follows the label color and
 * the dip uses the brand accent (see `.logo.brand` in the styles and assets/branding/brand_guide.md).
 */
function kairosBrandMark() {
  return (
    '<svg class="mark" viewBox="34 26 84 84" aria-hidden="true" focusable="false">' +
    '<path d="M40 60 H52 V48 H64 V84 H76 V66 H88 V54 H100 V72 H112" class="bl" fill="none" ' +
    'stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle class="bd" cx="70" cy="84" r="7.5"/></svg>'
  );
}

/** Marks by source key (see KAIROS_SOURCES). A source without an entry shows its `icon`. */
const KAIROS_MARKS = {
  custom: kairosBrandMark,
  nord_pool: kairosNordPoolMark,
  entsoe: kairosEntsoEMark,
};

/** Linearly interpolates between two hex colors. t is clamped to 0..1. */
function kairosInterpolateColor(color1, color2, t) {
  const a = Math.max(0, Math.min(1, t));
  const rgb = (hex) => {
    const v = hex.replace("#", "");
    return {
      r: parseInt(v.slice(0, 2), 16),
      g: parseInt(v.slice(2, 4), 16),
      b: parseInt(v.slice(4, 6), 16),
    };
  };
  const c1 = rgb(color1);
  const c2 = rgb(color2);
  const ch = (s, e) => Math.round(s + (e - s) * a);
  const hx = (v) => v.toString(16).padStart(2, "0");
  return "#" + hx(ch(c1.r, c2.r)) + hx(ch(c1.g, c2.g)) + hx(ch(c1.b, c2.b));
}

/**
 * True when slot "b" belongs to the same clock hour as the directly preceding slot "a".
 * The minute must increase: on the day that daylight saving time ends, the hour 02:00-03:00 occurs twice
 * in a row, and the second occurrence (minute drops back to 0) must start a new hour.
 */
function kairosSameHour(a, b) {
  return a.hour === b.hour && b.minute > a.minute;
}

const kairosClamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Shared control styles (segmented control, switch, stepper); used by the card and its editor. */
const KAIROS_CSS_CTL = `
.seg{position:relative;display:inline-grid;grid-auto-flow:column;grid-auto-columns:1fr;padding:2px;border-radius:10px;
  background:var(--fill)}
.seg .th{position:absolute;inset-block:2px;inset-inline-start:2px;width:calc((100% - 4px) / var(--n,1));
  border-radius:8px;background:var(--thumb);box-shadow:0 1px 3px rgba(0,0,0,.22),0 0 0 .5px rgba(0,0,0,.06);
  transform:translateX(calc(var(--i,0) * 100%));transition:transform .3s var(--ease,cubic-bezier(.22,1,.36,1))}
.seg.none .th{opacity:0}
.seg:dir(rtl) .th{transform:translateX(calc(var(--i,0) * -100%))}
.seg button{position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;
  min-width:44px;min-height:32px;padding:0 12px;border:0;border-radius:8px;background:transparent;
  color:var(--label2);font:inherit;font-size:var(--t-foot,13px);font-weight:500;white-space:nowrap;cursor:pointer;
  transition:color .2s,opacity .1s;-webkit-tap-highlight-color:transparent}
.seg button[aria-checked="true"]{color:var(--label);font-weight:600}
.seg button[aria-disabled="true"]{opacity:.4;cursor:default}
.seg button:active:not([aria-disabled="true"]){opacity:.6}
.seg .ic{width:18px;height:18px}
.sw{position:relative;display:inline-flex;align-items:center;gap:10px;min-height:44px;padding:0;border:0;
  background:transparent;color:var(--label);font:inherit;font-size:var(--t-sub,15px);cursor:pointer;
  -webkit-tap-highlight-color:transparent}
.sw .swl{color:var(--label2)}
.sw .track{position:relative;flex:none;width:51px;height:31px;border-radius:16px;background:var(--fill2);
  transition:background-color .25s}
.sw .k{position:absolute;top:2px;inset-inline-start:2px;width:27px;height:27px;border-radius:50%;background:#fff;
  box-shadow:0 3px 8px rgba(0,0,0,.15),0 1px 1px rgba(0,0,0,.16),0 3px 1px rgba(0,0,0,.1);
  transition:transform .25s var(--ease,cubic-bezier(.22,1,.36,1)),width .2s}
.sw[aria-checked="true"] .track{background:#34c759}
.sw[aria-checked="true"] .k{transform:translateX(20px)}
.sw:dir(rtl)[aria-checked="true"] .k{transform:translateX(-20px)}
.sw:active .k{width:33px}
.sw .mark{position:absolute;top:50%;width:2px;height:10px;margin-top:-5px;border-radius:1px;background:#fff;
  inset-inline-start:13px;opacity:0;transition:opacity .25s}
.sw[aria-checked="true"] .mark{opacity:1}
.step{display:inline-flex;align-items:center;padding:2px;border-radius:999px;background:var(--fill)}
.step .stv{min-width:32px;text-align:center;color:var(--label);font-size:var(--t-sub,15px);font-weight:600;
  font-variant-numeric:tabular-nums}
.step button{position:relative;display:inline-flex;align-items:center;justify-content:center;width:40px;
  min-height:32px;padding:0;border:0;border-radius:999px;background:transparent;color:var(--label);cursor:pointer;
  transition:background-color .15s,opacity .15s}
.step button:active:not(:disabled){background:var(--fill2)}
.step button:disabled{opacity:.3;cursor:default}
.step .ic{width:18px;height:18px}
.ic{width:1.25em;height:1.25em;flex:none;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;
  stroke-linejoin:round}
button:focus-visible,[tabindex]:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--accent);
  outline-offset:2px}
@media (pointer:coarse){.seg button,.step button{min-height:44px}}
@media (hover:hover) and (pointer:fine){.seg button:hover:not([aria-checked="true"]):not([aria-disabled="true"])
  {color:var(--label)}.step button:hover:not(:disabled){background:var(--fill2)}}
@media (forced-colors:active){.seg .th{background:Canvas;border:2px solid Highlight;box-shadow:none}
  .seg button[aria-checked="true"]{color:ButtonText}.sw .track{border:1px solid ButtonText}
  .sw[aria-checked="true"] .track{background:Highlight}.sw .k{background:ButtonText}
  button:focus-visible,[tabindex]:focus-visible{outline-color:Highlight}}
@media (prefers-contrast:more){.seg,.step{box-shadow:inset 0 0 0 1px var(--label2)}
  .seg .th{box-shadow:0 0 0 1.5px var(--label)}}
`;

const KAIROS_CSS = `
:host{display:block;container-type:inline-size}
*,*::before,*::after{box-sizing:border-box}
ha-card{display:block;background:var(--surface);color:var(--label);border:0;border-radius:22px;
  --ha-card-border-radius:22px;box-shadow:0 1px 2px rgba(0,0,0,.05),0 6px 20px rgba(0,0,0,.07);overflow:hidden}
.kairos{--font:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display","SF Pro Rounded",system-ui,"Segoe UI",
  Roboto,sans-serif;--s:1;--pad:16px;--gap:16px;--ease:cubic-bezier(.22,1,.36,1);--hair:1px;--r-card:14px;
  --t-large:calc(2.125rem * var(--s));--t-t1:calc(1.75rem * var(--s));--t-t2:calc(1.375rem * var(--s));
  --t-t3:calc(1.25rem * var(--s));--t-head:calc(1.0625rem * var(--s));--t-body:calc(1.0625rem * var(--s));
  --t-call:calc(1rem * var(--s));--t-sub:calc(.9375rem * var(--s));--t-foot:calc(.8125rem * var(--s));
  --t-c1:calc(.75rem * var(--s));--t-c2:max(11px,calc(.6875rem * var(--s)));
  position:relative;display:grid;grid-template-columns:minmax(0,1fr);
  grid-template-areas:"head" "sum" "ctl" "chart" "stats" "extra" "data" "foot";
  padding-block:max(var(--pad),env(safe-area-inset-top)) max(var(--pad),env(safe-area-inset-bottom));
  padding-inline:max(var(--pad),env(safe-area-inset-left)) max(var(--pad),env(safe-area-inset-right));
  font-family:var(--font);font-size:var(--t-body);line-height:1.3;background:var(--surface);color:var(--label);
  transform:translate(var(--sx,0px),var(--sy,0px));transition:transform 1.2s ease}
@media (min-resolution:2dppx){.kairos{--hair:.5px}}
.kairos[data-mode="regular"]{--pad:20px}
.kairos[data-mode="large"],.kairos[data-mode="kiosk"]{column-gap:32px;
  grid-template-columns:minmax(0,5fr) minmax(0,13fr);
  grid-template-areas:"head head" "sum ctl" "stats chart" "extra ." "data data" "foot foot"}
.kairos[data-mode="large"]{--s:1.25;--pad:28px;--gap:24px}
.kairos[data-mode="kiosk"]{--s:1.5;--pad:32px;--gap:28px}
.kairos>.r:not(:empty),.kairos>.chart{padding-block-end:var(--gap)}
.kairos>.r.foot:not(:empty){padding-block-end:0}
.head{grid-area:head}.sum{grid-area:sum;align-self:start}.ctl{grid-area:ctl}.chart{grid-area:chart;min-width:0}
.stats{grid-area:stats;align-self:start}
.kairos[data-mode="large"]>.stats,.kairos[data-mode="kiosk"]>.stats{display:flex;flex-direction:column;
  align-items:stretch;
  justify-self:stretch;align-self:stretch;
  padding-top:calc(30px * var(--s) - 5px)}
.kairos[data-mode="large"] .sgrid,.kairos[data-mode="kiosk"] .sgrid{flex:1 1 auto;width:100%;align-self:stretch;
  grid-auto-rows:1fr;
  margin-bottom:calc(8px * var(--s))}.extra{grid-area:extra}.data{grid-area:data}.foot{grid-area:foot}
.hrow{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.ttl{display:flex;align-items:center;gap:12px;min-width:0}
.logo{flex:none;display:inline-flex;align-items:center;justify-content:center;width:calc(48px * var(--s));
  height:calc(48px * var(--s));padding:calc(8px * var(--s));border-radius:calc(11px * var(--s));
  background:var(--fill);color:#fff}
.logo .mark{width:auto;height:100%;display:block}
.logo.brand{padding:calc(6px * var(--s))}
.logo.brand .bl{stroke:var(--label)}
.logo.brand .bd{fill:#30b0c7}
[data-scheme=dark] .logo.brand .bd{fill:#40cbe0}
.logo.custom{background:linear-gradient(145deg,#0a84ff,#5e5ce6);box-shadow:0 1px 3px rgba(0,0,0,.25)}
.ic.fill{fill:currentColor;stroke-width:1.2}
.logo ha-icon{--mdc-icon-size:calc(24px * var(--s));color:#fff}
.logo .ic{width:calc(24px * var(--s));height:calc(24px * var(--s));color:#fff}
.tt{min-width:0}
.tt-t{font-size:var(--t-t3);font-weight:600;letter-spacing:-.01em;line-height:1.2;overflow-wrap:anywhere}
.tt-s{margin-top:2px;font-size:var(--t-sub);line-height:1.3;color:var(--label2)}
.cap{font-size:var(--t-sub);color:var(--label2)}
.price{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;margin-top:2px}
.big{font-size:var(--t-large);font-weight:600;line-height:1.05;letter-spacing:-.02em;font-variant-numeric:tabular-nums;
  animation:fade .3s var(--ease) both}
.kairos[data-mode="large"] .big{font-size:clamp(3.5rem,7cqi,6rem)}
.kairos[data-mode="kiosk"] .big{font-size:clamp(4.5rem,9cqi,8rem)}
.unit{font-size:var(--t-foot);color:var(--label2);font-variant-numeric:tabular-nums}
.chips{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin-top:10px}
.badge{display:inline-flex;align-items:center;gap:4px;min-height:28px;padding:0 10px;border-radius:14px;
  font-size:var(--t-foot);font-weight:600;color:var(--c);background:var(--fill);
  background:color-mix(in srgb,var(--c) 14%,transparent)}
.badge .ic{width:16px;height:16px}
.band-low{--c:var(--green)}.band-mid{--c:var(--orange)}.band-high{--c:var(--red)}
.trend{display:inline-flex;align-items:center;gap:4px;font-size:var(--t-foot);color:var(--label2);
  font-variant-numeric:tabular-nums}
.trend .ic{width:16px;height:16px}
.ctl{display:flex;flex-direction:column;gap:12px}
.bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 16px}
.tools{display:flex;flex-wrap:wrap;align-items:center;gap:12px 16px;margin-inline-start:auto}
.kairos[data-mode="compact"] .bar>.seg{width:100%}
.kairos[data-mode="compact"] .tools{width:100%;margin-inline-start:0;gap:12px 8px}
.kairos[data-mode="compact"] .tools>.seg,.kairos[data-mode="compact"] .tools>.step{flex:1 1 auto}
.kairos[data-mode="compact"] .tools .seg button{padding:0 8px}
.note{font-size:var(--t-c1);color:var(--label2)}
.dwrap{position:relative;display:inline-flex}
.dstep{display:inline-flex;align-items:center;padding:2px;border-radius:10px;background:var(--fill)}
.dstep button{border:0;background:none;color:var(--label);font:inherit;cursor:pointer;
  -webkit-tap-highlight-color:transparent}
.dstep .nav{display:inline-flex;align-items:center;justify-content:center;width:44px;height:32px;border-radius:8px}
.dstep .dlabel{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:96px;height:32px;
  padding:0 8px;border-radius:8px;line-height:1.15}
.dl1{font-size:var(--t-sub);font-weight:600}
.dl2{font-size:var(--t-c1);font-weight:400;color:var(--label2)}
.dstep button:disabled{opacity:.3;cursor:default}
.dstep button:active:not(:disabled){background:var(--fill2)}
/* Day stepper and the Today button; all controls share one height (36 pt, 48 pt on touch like the segmented
   controls). */
.dgrp{display:inline-flex;align-items:center}
.dwrap{gap:8px;align-items:center}
#calwrap{position:absolute;inset:0;pointer-events:none}
#calwrap>*{pointer-events:auto}
.cbtn{flex:none;display:flex;align-items:center;justify-content:center;width:36px;height:36px;padding:0;border:0;
  border-radius:10px;
  background:var(--fill);color:var(--label);cursor:pointer;-webkit-tap-highlight-color:transparent}
.cbtn .ic{width:18px;height:18px}
.cbtn:active{background:var(--fill2)}
@media (pointer:coarse){.dstep .nav,.dstep .dlabel{height:44px}.cbtn{width:48px;height:48px}}
.kairos[data-mode="compact"] .dgrp,.kairos[data-mode="compact"] .dstep{width:100%}
.kairos[data-mode="compact"] .dgrp .dwrap{flex:1;min-width:0}
.kairos[data-mode="compact"] .dstep{flex:1;width:auto}
.kairos[data-mode="compact"] .dstep .dlabel{flex:1}
.pop{position:absolute;z-index:5;top:calc(100% + 8px);inset-inline-start:0;width:min(344px,calc(100vw - 32px));
  padding:12px;
  border-radius:16px;background:var(--surface);box-shadow:0 0 0 var(--hair) var(--sep),0 12px 32px rgba(0,0,0,.35);
  animation:fade .15s var(--ease) both}
.kairos[data-mode="compact"] .pop{width:100%}
.ph{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.ph .pt{display:inline-flex;align-items:center;gap:4px;width:auto;height:44px;padding:0 10px;border:0;
  border-radius:10px;
  background:none;color:var(--label);font:inherit;font-size:var(--t-sub);font-weight:600}
.ph button.pt{cursor:pointer}.ph button.pt .ic{width:16px;height:16px}
.ph button{display:flex;align-items:center;justify-content:center;width:44px;height:44px;border:0;border-radius:10px;
  background:none;color:var(--label);cursor:pointer}
.pg{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
.kairos.busy .sum,.kairos.busy .chart,.kairos.busy .stats,.kairos.busy .extra{opacity:.45;transition:opacity .2s}
.kairos.busy .chart{pointer-events:none}
.kairos.swap .sum,.kairos.swap .chart,.kairos.swap .stats,.kairos.swap .extra{animation:soft .28s var(--ease) both}
@keyframes soft{from{opacity:.4}to{opacity:1}}
.pop{max-height:min(72vh,560px);overflow:auto}
.pop{width:min(560px,calc(100vw - 32px))}
.pbody{display:grid;grid-template-columns:176px minmax(0,1fr);gap:12px;align-items:start}
.prng{max-height:372px;overflow:auto;padding:3px 8px 3px 3px;border-inline-end:var(--hair) solid var(--sep)}
.rg+.rg{margin-top:8px;padding-top:8px;border-top:var(--hair) solid var(--sep)}
.rb{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:36px;padding:0 10px;
  border:0;border-radius:8px;background:none;color:var(--label);font:inherit;font-size:var(--t-sub);text-align:start;
    cursor:pointer}
@media (pointer:coarse){.rb{min-height:44px}}
@media (hover:hover) and (pointer:fine){.rb:hover{background:var(--fill)}}
@container (max-width:620px){
  .pop{width:min(344px,calc(100vw - 32px))}
  .pbody{grid-template-columns:minmax(0,1fr)}
  .prng{display:flex;gap:6px;max-height:none;padding:3px 3px 10px;border-inline-end:0;
    border-bottom:var(--hair) solid var(--sep);
    overflow-x:auto;overflow-y:hidden;scrollbar-width:none}
  .rg{display:contents}.rg+.rg{margin:0;padding:0;border:0}
  .rb{flex:none;width:auto;min-height:36px;padding:0 14px;border-radius:999px;background:var(--fill);
    font-size:var(--t-foot);white-space:nowrap}
  .rb .ic{display:none}
  .rb[aria-pressed="true"]{background:color-mix(in srgb,var(--accent) 12%,transparent)}
}
.rb[aria-pressed="true"]{color:var(--accent);font-weight:600}
.rq .sh{padding:2px 10px 6px}
.qs{display:grid;grid-template-columns:repeat(var(--n,4),minmax(0,1fr));padding:2px;margin:0 2px;border-radius:9px;
  background:var(--fill)}
.qb{min-height:32px;border:0;border-radius:7px;background:none;color:var(--label2);font:inherit;font-size:var(--t-foot);
  font-weight:500;cursor:pointer}
.qb[aria-pressed="true"]{background:var(--thumb);color:var(--label);font-weight:600;
  box-shadow:0 1px 3px rgba(0,0,0,.22)}
@container (max-width:620px){
  .rq .sh{display:none}.qs{display:contents}
  .qb{flex:none;min-height:36px;padding:0 14px;border-radius:999px;background:var(--fill);color:var(--label);
    box-shadow:none;
    white-space:nowrap}
  .qb[aria-pressed="true"]{background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent);
    box-shadow:none}
}
/* Touch targets are at least 44 pt, also for the chips of the narrow layout. */
@media (pointer:coarse){.rb,.qb{min-height:44px;min-width:44px}}
.pg3{grid-template-columns:repeat(3,minmax(0,1fr))}
.pg3 button{min-height:56px;font-size:var(--t-sub)}
.pg .pad{min-height:1px}
.pg .wd{padding:4px 0;text-align:center;font-size:var(--t-c1);color:var(--label2)}
.pg button{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;
  min-height:44px;padding:0;border:0;border-radius:10px;overflow:hidden;background:var(--group);color:var(--label);
  font:inherit;font-size:var(--t-foot);cursor:pointer}
.pg button:disabled{opacity:.35;cursor:default}
.pg button[aria-pressed="true"]{box-shadow:inset 0 0 0 2px var(--accent)}
.pg button.inr{box-shadow:inset 0 0 0 1px var(--accent);background:color-mix(in srgb,var(--accent) 22%,var(--group))}
.pg .dv{font-size:var(--t-c2);color:var(--label2);font-variant-numeric:tabular-nums}
.pg .hb{position:absolute;inset-inline:0;bottom:0;height:4px;background:var(--c)}
.pf{margin-top:10px;font-size:var(--t-c1)}
.plot{position:relative;touch-action:pan-y;border-radius:12px;-webkit-user-select:none;user-select:none;
  -webkit-tap-highlight-color:transparent}
.zm{position:absolute;top:var(--zy,36px);z-index:2;display:flex;gap:2px;padding:2px;
  border-radius:12px;background:color-mix(in srgb,var(--surface) 92%,transparent);box-shadow:0 0 0 .5px var(--sep)}
.zm button{display:flex;align-items:center;justify-content:center;width:36px;height:36px;padding:0;border:0;
  border-radius:8px;
  background:transparent;color:var(--label);cursor:pointer;-webkit-tap-highlight-color:transparent}
.zm button:disabled{opacity:.3;cursor:default}
.zm button[hidden]{display:none}
.zm button[data-z="reset"]{color:var(--accent)}
.zm button:active:not(:disabled){background:var(--fill2)}
.zm .ic{width:16px;height:16px}
@media (pointer:coarse){.zm{padding:0}.zm button{width:44px;height:44px}
  .zm button[data-z="in"],.zm button[data-z="out"]{display:none}.zm:not(.on){display:none}}
.plot svg{display:block;width:100%;height:auto;direction:ltr;overflow:visible}
.ax{fill:var(--label2);font-size:var(--t-c1);font-family:var(--font);font-variant-numeric:tabular-nums}
.axb{font-weight:600;fill:var(--accent)}
.lbl{fill:var(--label);font-size:var(--t-c1);font-weight:600;font-family:var(--font);font-variant-numeric:tabular-nums}
.lblbg{fill:var(--surface);fill-opacity:.85}
.grid{stroke:var(--sep);stroke-width:var(--hair);fill:none}
.axis{stroke:var(--label3);stroke-width:1;fill:none}
.zero{stroke:var(--label2);stroke-width:1;fill:none}
.ref{stroke:var(--label);stroke-width:1.25;stroke-dasharray:5 4;opacity:.75;fill:none}
.nowline{stroke:var(--accent);stroke-width:1.5;fill:none}
.nowpill{fill:var(--accent)}
.nowtxt{fill:var(--onaccent);font-size:var(--t-c1);font-weight:600;font-family:var(--font)}
.win{fill:var(--accent);fill-opacity:.12}
.veil{fill:var(--surface);fill-opacity:.5;pointer-events:none}
.cur{opacity:0;transition:opacity .15s;pointer-events:none}
.cur.on{opacity:1}
.cur .mv{transition:transform .08s linear}
.cur .rule{fill:var(--label2);fill-opacity:.85}
.cur .dot{fill:var(--surface);stroke:var(--accent);stroke-width:2}
.enter{animation:rise .35s var(--ease) both}
.callout{position:absolute;top:0;left:0;z-index:2;min-width:112px;max-width:240px;padding:8px 12px;border-radius:12px;
  background:var(--surface);color:var(--label);box-shadow:0 0 0 var(--hair) var(--sep),0 8px 24px rgba(0,0,0,.18);
  pointer-events:none;opacity:0;transition:opacity .15s;font-variant-numeric:tabular-nums}
.callout.on{opacity:1}
@supports (backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px)){
  .callout{background:color-mix(in srgb,var(--surface) 72%,transparent);
    -webkit-backdrop-filter:blur(20px) saturate(180%);
  backdrop-filter:blur(20px) saturate(180%)}}
@media (prefers-reduced-transparency:reduce){.callout{background:var(--surface);-webkit-backdrop-filter:none;
  backdrop-filter:none}}
.cl-t{font-size:var(--t-c1);color:var(--label2)}
.cl-p{font-size:var(--t-head);font-weight:600}.cl-p span{font-size:var(--t-c1);font-weight:400;color:var(--label2)}
.cl-b{display:inline-flex;align-items:center;gap:4px;margin-top:4px;font-size:var(--t-c1);font-weight:600;
  color:var(--c)}
.cl-b .ic{width:14px;height:14px}
.cl-l{display:flex;align-items:center;gap:6px;margin-top:2px;font-size:var(--t-c1);color:var(--label2)}
.cl-l i{width:8px;height:8px;border-radius:2px;flex:none}.cl-l b{margin-inline-start:auto;color:var(--label)}
.grp{background:var(--group);border-radius:var(--r-card);overflow:hidden}
.sh{padding:0 14px 6px;font-size:var(--t-c1);letter-spacing:.04em;text-transform:uppercase;color:var(--label2)}
.row{display:flex;align-items:center;gap:12px;min-height:44px;padding:6px 14px}
.row+.row{border-top:var(--hair) solid var(--sep)}
.row .v{margin-inline-start:auto;font-weight:600;font-variant-numeric:tabular-nums;text-align:end}
.row .n{font-size:var(--t-c1);color:var(--label2);font-weight:400}
.row .n .ic{width:14px;height:14px}
.sq{width:12px;height:12px;border-radius:4px;flex:none}
.csum{display:flex;flex-direction:column;gap:12px}
.cs-next+div{margin-top:4px}
.cs-k .pill{max-width:100%;line-height:1.25}
.cs-top{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.cs-k{display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:4px;min-width:0;
  padding:12px 14px;border-radius:var(--r-card);background:var(--group)}
.cs-c{font-size:var(--t-c1);font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--label2)}
.cs-dur,.cs-v{font-size:var(--t-head);font-weight:600;line-height:1.2;letter-spacing:-.01em;
  font-variant-numeric:tabular-nums}
.cs-next{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;
  border-radius:var(--r-card);background:var(--group);box-shadow:inset 0 0 0 1.5px var(--c)}
@supports (background:color-mix(in srgb,red 10%,blue)){.cs-next{
  background:color-mix(in srgb,var(--c) 14%,var(--group))}}
.cs-nc{margin-top:2px;font-size:var(--t-c1);color:var(--label2);font-variant-numeric:tabular-nums;white-space:nowrap}
.cs-nl{font-size:var(--t-c1);font-weight:600;letter-spacing:.03em;text-transform:uppercase;color:var(--label2)}
.cs-nr{margin-top:2px;font-size:var(--t-t2);font-weight:600;line-height:1.2;font-variant-numeric:tabular-nums}
.cs-na{flex:none;text-align:end}
.cs-nv{font-size:var(--t-head);font-weight:600;font-variant-numeric:tabular-nums}
.cs-nd{font-size:var(--t-c1);color:var(--label2)}
.cs-gl{padding:0 4px 6px;font-size:var(--t-c1);color:var(--label2)}
.cs-chips{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.cs-chip{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:2px 8px;min-width:0;
  padding:8px 12px;border-radius:var(--r-card);background:var(--group);font-size:var(--t-c1);color:var(--label2);
  font-variant-numeric:tabular-nums}
.cs-chip b{font-weight:600;color:var(--label)}
.cs-u{margin-inline-start:4px;font-size:.8em;font-weight:400;letter-spacing:0;color:var(--label2)}
.sgrid{display:grid;grid-template-columns:repeat(var(--cols,2),minmax(0,1fr));gap:12px;align-self:start}
.sgrid[data-c="2"] .stat:last-child:nth-child(odd){grid-column:1 / -1}
.stat{display:flex;flex-direction:column;justify-content:space-between;gap:16px;min-width:0;min-height:44px;
  padding:14px 16px;border-radius:var(--r-card);background:var(--group)}
.sl{display:flex;align-items:center;gap:6px;font-size:var(--t-foot);font-weight:600;color:var(--label2)}
.sic{display:inline-flex;flex:none;color:var(--c)}
.sic .ic{width:calc(18px * var(--s));height:calc(18px * var(--s));stroke-width:2}
.sv{font-size:var(--t-t1);font-weight:600;line-height:1.1;letter-spacing:-.01em;font-variant-numeric:tabular-nums;
  overflow-wrap:anywhere}
.su{margin-inline-start:4px;font-size:var(--t-foot);font-weight:400;letter-spacing:0;color:var(--label2)}
.sx{margin-top:2px;font-size:var(--t-c1);color:var(--label2);font-variant-numeric:tabular-nums}
.sn{padding-top:10px}

.pill{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:10px;font-size:var(--t-c1);
  font-weight:600;color:var(--pc);background:var(--fill);background:color-mix(in srgb,var(--pc) 14%,transparent)}
.pill .ic{width:14px;height:14px}
.extra{display:flex;flex-direction:column;gap:20px;align-self:start}
.extra:not(:empty){padding-top:calc(12px * var(--s))}
.tables{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px 16px;align-items:start}
.tbl header{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:0 4px 8px}
.tbl .tt{font-size:var(--t-sub);font-weight:600}
.tbl .ts,.tbl .ta{font-size:var(--t-c1);color:var(--label2)}
.tbl .ta b{color:var(--label);font-weight:600;font-variant-numeric:tabular-nums}
.tbl table,.dt table{width:100%;border-collapse:separate;border-spacing:0;border-radius:var(--r-card);overflow:hidden;
  background:var(--group);font-variant-numeric:tabular-nums}
.tbl th,.tbl td,.dt th,.dt td{padding:10px 4px;text-align:center;font-size:var(--t-sub);font-weight:400;
  border-top:var(--hair) solid var(--sep)}
.tbl thead th,.dt thead th{padding:8px 4px;border-top:0;color:var(--label2);font-size:var(--t-c2);font-weight:500}
.tbl tbody th,.dt tbody th{color:var(--label2);font-weight:500;font-size:var(--t-foot)}
.tbl tr.nowrow th{color:var(--accent);font-weight:700}
.tbl td[data-s]{cursor:pointer;min-height:44px}
.tbl td.min{color:var(--green);font-weight:700}.tbl td.max{color:var(--red);font-weight:700}
.tbl td.now b{display:inline-block;padding:1px 8px;border-radius:10px;background:var(--accent);color:var(--onaccent)}
.dt{margin-top:16px;max-height:340px;overflow:auto;border-radius:var(--r-card)}
.dt caption{caption-side:top;padding:0 4px 8px;text-align:start;font-size:var(--t-sub);font-weight:600}
.dt th[scope="row"]{text-align:start;padding-inline-start:14px}
.sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;
  border:0}
.foot{display:flex;flex-wrap:wrap;align-items:center;gap:0 16px;font-size:var(--t-c1);color:var(--label2)}
.foot .lnk{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0;border:0;background:none;
  color:var(--accent);font:inherit;font-size:var(--t-foot);cursor:pointer}
.foot .lnk:first-of-type{margin-inline-start:auto}
.stale{display:inline-flex;align-items:center;gap:4px;font-weight:600;color:var(--orange)}
.stale .ic{width:16px;height:16px}
.status{display:flex;flex-direction:column;align-items:center;gap:6px;padding:32px 16px;text-align:center}
.status .ic{width:34px;height:34px;margin-bottom:6px;color:var(--label2)}
.status .st{font-size:var(--t-head);font-weight:600}
.status .sd{font-size:var(--t-foot);color:var(--label2)}
.btn{min-height:44px;margin-top:10px;padding:0 20px;border:0;border-radius:22px;background:var(--accent);
  color:var(--onaccent);font:inherit;font-size:var(--t-sub);font-weight:600;cursor:pointer}
.skel{border-radius:10px;background:linear-gradient(90deg,var(--fill) 25%,var(--fill2) 50%,var(--fill) 75%);
  background-size:200% 100%;animation:shimmer 1.4s linear infinite}
@keyframes rise{from{opacity:0;transform:scaleY(.6)}to{opacity:1;transform:none}}
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes shimmer{from{background-position:200% 0}to{background-position:-200% 0}}
@media (hover:hover) and (pointer:fine){.tbl td[data-s]:hover{background:var(--fill)}
  .foot .lnk:hover{text-decoration:underline}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important}
  .kairos.swap .sum,.kairos.swap .chart,.kairos.swap .stats,.kairos.swap .extra{animation:none}
  .enter{animation:fade .15s both!important}.skel{animation:none}.big{animation:none}}
@media (prefers-contrast:more){.kairos{--sep:var(--label2);--label2:var(--label)}.stat,.grp,.tbl table,.dt table
  {box-shadow:inset 0 0 0 1px var(--label2)}.grid{stroke-opacity:1}}
@media (forced-colors:active){.logo.custom{forced-color-adjust:none;border:1px solid CanvasText}.ax,.lbl{
  fill:CanvasText}.grid,.axis,.zero{stroke:GrayText}
  .nowline{stroke:Highlight}.nowpill{fill:Highlight}.nowtxt{fill:HighlightText}
  .bar-el{stroke:CanvasText;stroke-width:1}.mk{forced-color-adjust:none}
  .callout{border:1px solid CanvasText;background:Canvas}}
${KAIROS_CSS_CTL}
`;

class KairosCard extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._config = null;
    this._ui = {};
    this._renderKey = "";
    this._animKey = "";
    this._animate = true;
    this._m = null;
    this._hover = null;
    this._pinned = null;
    this._idle = null;
    this._tick = null;
    this._shift = null;
    this._clock = null;
    this._ro = null;
    this._raf = 0;
    this._selRaf = 0;
    this._announceT = null;
    this._mql = null;
    this._drag = null;
    this._ptrY = null;
    this._showData = false;
    this._calOpen = false;
    this._calView = null;
    this._calMode = "days";
    this._histPending = false;
    this._rendered = false;
    this._hist = {
      days: {},
      months: {},
      hours: {},
      req: {},
      series: {},
      err: null,
      pending: 0,
      earliest: null,
    };
    this._onDocDown = (e) => {
      if (!e.composedPath().includes(this)) this._closeCal(false);
    };
    this._ctlKey = "";
    this._tokKey = "";
    this._cw = 0;
    this._mode = "regular";
    this._k = 1;
    this._scheme = "light";
    this._p = { ct: true, unit: "ct/kWh", code: "EUR", dec: null };
    this._cache = {};
    this._tzFormat = null;
    this._tzKey = null;
    this._resolvedStyle = "bar";
    this._onScheme = () => this._update();
    this._onResize = () => {
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => {
        this._raf = 0;
        this._update();
      });
    };
    this.attachShadow({ mode: "open" });
    this._buildShell();
  }

  /* ------------------------------------------------------------------ Home Assistant card API */

  static getStubConfig(hass) {
    let entity = KAIROS_DEFAULTS.entity;
    const states = (hass && hass.states) || {};
    const found = Object.keys(states).find(
      (id) => id.startsWith("sensor.") && states[id].attributes && Array.isArray(states[id].attributes.today),
    );
    if (found) entity = found;
    return { type: "custom:kairos-card", entity, day: "today" };
  }

  static getConfigElement() {
    return document.createElement("kairos-card-editor");
  }

  /** The configured period as it applies to a single day: only 15 min and 1 h exist there. */
  _dayPeriod(p) {
    return p === "hour" ? "hour" : "15min";
  }

  _normPeriod(p) {
    const v = String(p ?? "")
      .toLowerCase()
      .replace(/\s+/g, "");
    if (["15min", "15m", "quarter", "quarters", "auto"].includes(v)) return "15min";
    if (["hour", "hours", "1h", "60min"].includes(v)) return "hour";
    if (["day", "days", "1d"].includes(v)) return "day";
    if (["week", "weeks", "1w"].includes(v)) return "week";
    if (["month", "months", "1m"].includes(v)) return "month";
    return null;
  }

  /** Validates and stores the configuration. Throws helpful errors for invalid values. */
  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    const day = config.day ?? KAIROS_DEFAULTS.day;
    if (
      !["today", "tomorrow", "yesterday", ...KAIROS_RANGES].includes(day) &&
      !/^\d{4}-\d{2}-\d{2}$/.test(String(day))
    ) {
      throw new Error(
        "day must be one of: today, tomorrow, yesterday, " + KAIROS_RANGES.join(", ") + ", or a date (YYYY-MM-DD)",
      );
    }

    const view = config.view ?? KAIROS_DEFAULTS.view;
    if (!KAIROS_VIEWS.includes(view)) {
      throw new Error("view must be one of: " + KAIROS_VIEWS.join(", "));
    }
    const style = config.chart_style ?? KAIROS_DEFAULTS.chart_style;
    if (!KAIROS_CHART_STYLES.includes(style)) {
      throw new Error("chart_style must be one of: " + KAIROS_CHART_STYLES.join(", "));
    }
    const period = this._normPeriod(config.period ?? KAIROS_DEFAULTS.period);
    if (!period) throw new Error("period must be one of: 15min, hour, day, week, month");
    if (!KAIROS_EDIT_ICONS.includes(config.edit_button_icon ?? "sliders")) {
      throw new Error("edit_button_icon must be one of: " + KAIROS_EDIT_ICONS.join(", "));
    }
    for (const [key, modes] of [
      ["display_mode_desktop", KAIROS_MODES_SMALL],
      ["display_mode_touch", KAIROS_MODES_SMALL],
      ["display_mode_kiosk", KAIROS_MODES],
    ]) {
      if (!modes.includes(config[key] ?? "auto")) {
        throw new Error(key + " must be one of: " + modes.join(", "));
      }
    }
    if (!["small", "medium", "large"].includes(config.average_line_size ?? "small")) {
      throw new Error("average_line_size must be one of: small, medium, large");
    }
    if (!["small", "medium", "large"].includes(config.fixed_line_size ?? "small")) {
      throw new Error("fixed_line_size must be one of: small, medium, large");
    }
    if (!["horizontal", "vertical"].includes(config.heat_gradient ?? "horizontal")) {
      throw new Error("heat_gradient must be one of: horizontal, vertical");
    }
    if (!["auto", "light", "dark"].includes(config.color_scheme ?? "auto")) {
      throw new Error("color_scheme must be one of: auto, light, dark");
    }
    if (!["auto", "12", "24"].includes(String(config.time_format ?? "auto"))) {
      throw new Error("time_format must be one of: auto, 12, 24");
    }
    const isEntityId = (id) => typeof id === "string" && KAIROS_ENTITY_ID.test(id);
    // An empty value is allowed: the editor sends it when a field is cleared, and the default applies.
    for (const key of ["entity", "history_entity"]) {
      const id = config[key];
      if (id !== undefined && id !== "" && !isEntityId(id)) {
        throw new Error(`${key} must be an entity id such as sensor.name`);
      }
    }
    if (config.source !== undefined && !Object.keys(KAIROS_SOURCES).includes(config.source)) {
      throw new Error("source must be one of: " + Object.keys(KAIROS_SOURCES).join(", "));
    }
    if (config.title !== undefined && typeof config.title !== "string") {
      throw new Error("title must be text");
    }
    if (config.icon !== undefined && config.icon !== false && typeof config.icon !== "string") {
      throw new Error("icon must be text or false");
    }
    for (const key of ["fixed_label", "unit", "currency"]) {
      if (config[key] !== undefined && typeof config[key] !== "string") throw new Error(key + " must be text");
    }
    const hq = config.history_quarter_days;
    if (hq !== undefined && !(Number.isInteger(Number(hq)) && Number(hq) >= 0 && Number(hq) <= 10)) {
      throw new Error("history_quarter_days must be a whole number between 0 and 10");
    }
    if (config.entities !== undefined && !(Array.isArray(config.entities) && config.entities.every(isEntityId))) {
      throw new Error("entities must be a list of entity ids such as sensor.name");
    }
    const bw = this._n(config.best_window_hours, 0);
    if (bw < 0 || bw > 24) throw new Error("best_window_hours must be between 0 and 24");
    const pb = config.price_bands;
    if (pb !== undefined && pb !== "auto") {
      const ok =
        (Array.isArray(pb) && pb.length === 2 && pb.every((x) => Number.isFinite(Number(x)))) ||
        (pb && typeof pb === "object" && Number.isFinite(Number(pb.low)) && Number.isFinite(Number(pb.high)));
      if (!ok) throw new Error("price_bands must be 'auto', [low, high], or { low, high }");
    }
    const dec =
      config.decimals === undefined || config.decimals === null || config.decimals === ""
        ? null
        : Number(config.decimals);
    if (dec !== null && !(Number.isInteger(dec) && dec >= 0 && dec <= 6)) {
      throw new Error("decimals must be an integer between 0 and 6");
    }

    this._config = {
      ...KAIROS_DEFAULTS,
      ...config,
      day,
      chart_style: style,
      view,
      period,
      decimals: dec,
    };
    this._ui = {};
    this._hist = {
      days: {},
      months: {},
      hours: {},
      req: {},
      series: {},
      err: null,
      pending: 0,
      earliest: null,
    };
    this._calOpen = false;
    this._renderKey = "";
    this._ctlKey = "";
    this._hover = null;
    this._pinned = null;
    this._showData = false;
    this._update();
  }

  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;
    if (prev && this._config && this._sameInputs(prev, hass)) return;
    this._update();
  }

  /** The edit button and the edit link are for administrators only (a missing user, as in tests, counts as allowed). */
  _canEdit() {
    const user = this._hass && this._hass.user;
    return !(user && user.is_admin === false);
  }

  /**
   * Path of this card in the dashboard, exposed by the edit-mode wrapper of Home Assistant (null outside edit mode).
   */
  _cardPath() {
    for (let n = this; n; n = n.parentNode || n.host) {
      if (Array.isArray(n.path) && n.path.length >= 2 && n.path.every(Number.isInteger)) return n.path;
    }
    return null;
  }

  /**
   * Experimental: opens the Home Assistant card editor. Home Assistant has no public API for this. The card path is
   * only
   * known in the dashboard edit mode, and the card cannot be clicked there. So the first press turns the edit mode on
   * (`?edit=1`) and then waits, also in a card that is created again, until the path shows up; the internal
   * `ll-edit-card` event is then fired with it.
   */
  _openEditor() {
    if (this._cardPath()) {
      kairosEditorPending = Date.now();
      this._resumeEditor();
      return;
    }
    kairosEditorPending = Date.now();
    const url = new URL(window.location.href);
    url.searchParams.set("edit", "1");
    window.history.pushState(null, "", url.pathname + url.search + url.hash);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
    this._resumeEditor();
  }

  /** Fires `ll-edit-card` once the card path is known, for up to five seconds after the button press. */
  _resumeEditor() {
    clearTimeout(this._editTimer);
    if (!kairosEditorPending || !this.isConnected) return;
    if (Date.now() - kairosEditorPending > 5000) {
      kairosEditorPending = 0;
      return;
    }
    const path = this._cardPath();
    if (path) {
      kairosEditorPending = 0;
      this.dispatchEvent(new CustomEvent("ll-edit-card", { detail: { path }, bubbles: true, composed: true }));
      return;
    }
    this._editTimer = setTimeout(() => this._resumeEditor(), 200);
  }

  /** Change detection: the DOM only updates when a relevant entity, locale, time zone, or theme changed. */
  _sameInputs(a, b) {
    const ids = [this._config.entity, ...(Array.isArray(this._config.entities) ? this._config.entities : [])];
    return (
      ids.every((id) => a.states && b.states && a.states[id] === b.states[id]) &&
      a.language === b.language &&
      (a.locale && a.locale.language) === (b.locale && b.locale.language) &&
      (a.locale && a.locale.time_format) === (b.locale && b.locale.time_format) &&
      (a.config && a.config.time_zone) === (b.config && b.config.time_zone) &&
      (a.themes && a.themes.darkMode) === (b.themes && b.themes.darkMode)
    );
  }

  connectedCallback() {
    if (typeof ResizeObserver !== "undefined") {
      // Only a width change matters; the layout depends on the width alone. Reacting to height changes would make the
      // card re-render after every one of its own re-renders, which fights the page scroll.
      this._roWidth = null;
      this._ro = new ResizeObserver((entries) => {
        const w = Math.round(entries[entries.length - 1].contentRect.width);
        if (w === this._roWidth) return;
        this._roWidth = w;
        this._onResize();
      });
      this._ro.observe(this);
    } else {
      window.addEventListener("resize", this._onResize);
    }
    if (window.matchMedia) {
      this._mql = window.matchMedia("(prefers-color-scheme: dark)");
      if (this._mql.addEventListener) this._mql.addEventListener("change", this._onScheme);
    }
    this._scheduleTick();
    this._scheduleShift();
    this._scheduleClock();
    this._update();
    this._resumeEditor();
  }

  disconnectedCallback() {
    clearTimeout(this._editTimer);
    if (this._ro) this._ro.disconnect();
    this._ro = null;
    window.removeEventListener("resize", this._onResize);
    document.removeEventListener("pointerdown", this._onDocDown, true);
    this._calOpen = false;
    if (this._mql && this._mql.removeEventListener) this._mql.removeEventListener("change", this._onScheme);
    this._mql = null;
    [this._idle, this._tick, this._shift, this._clock, this._announceT].forEach((t) => clearTimeout(t));
    this._idle = this._tick = this._shift = this._clock = this._announceT = null;
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._selRaf) cancelAnimationFrame(this._selRaf);
    this._raf = this._selRaf = 0;
  }

  getCardSize() {
    return this._eff().view === "price" ? 12 : 9;
  }

  getGridOptions() {
    return { columns: "full", rows: "auto", min_columns: 6, min_rows: 4 };
  }

  /* ------------------------------------------------------------------ timers */

  /** Refreshes the "now" marker at the next quarter-hour boundary instead of using a drifting interval. */
  _scheduleTick() {
    clearTimeout(this._tick);
    const q = 900000;
    this._tick = setTimeout(
      () => {
        this._update();
        this._scheduleTick();
      },
      q - (Date.now() % q) + 250,
    );
  }

  /** Keeps the "Now 10:00" clock in the summary current: updates the text at every full minute, no re-render. */
  _scheduleClock() {
    clearTimeout(this._clock);
    this._clock = setTimeout(
      () => {
        const cap = this.shadowRoot.getElementById("cap");
        if (cap && cap.dataset.live) cap.textContent = this._nowText();
        // The countdown of the cheapest summary follows the clock; the quarter-hour refresh replaces it at the end.
        const cd = this.shadowRoot.getElementById("cd");
        if (cd) cd.textContent = this._t(cd.dataset.k, { t: this._durText(Number(cd.dataset.t) - Date.now()) });
        this._scheduleClock();
      },
      60000 - (Date.now() % 60000) + 50,
    );
  }

  _nowText() {
    return `${this._t("now")} ${this._hhmm(new Date())}`;
  }

  /** Burn-in protection for wall panels: a small shift of the content every few minutes. */
  _scheduleShift() {
    clearTimeout(this._shift);
    this._shift = setTimeout(() => {
      const on = this._config && this._config.pixel_shift && ["large", "kiosk"].includes(this._mode);
      const r = () => (on ? Math.round((Math.random() * 2 - 1) * 4) : 0);
      this._el.root.style.setProperty("--sx", r() + "px");
      this._el.root.style.setProperty("--sy", r() + "px");
      this._scheduleShift();
    }, 300000);
  }

  /** Restarts the idle timer: a hovered or pinned slot is released after KAIROS_IDLE_MS. */
  _touch() {
    clearTimeout(this._idle);
    this._idle = null;
    if (this._hover === null || this._hover === undefined) return;
    this._idle = setTimeout(() => {
      this._idle = null;
      this._hover = null;
      this._pinned = null;
      this._show(null);
    }, KAIROS_IDLE_MS);
  }

  /* ------------------------------------------------------------------ shell and environment */

  _buildShell() {
    this.shadowRoot.innerHTML =
      `<style id="tok"></style><style>${KAIROS_CSS}</style><ha-card><div class="kairos" id="root">` +
      `<div class="r head" id="head"></div><div class="r sum" id="sum"></div><div class="r ctl" id="ctl"></div>` +
      `<div class="chart" id="chart"></div><div class="r stats" id="stats"></div>` +
      `<div class="r extra" id="extra"></div><div class="r data" id="data"></div>` +
      `<div class="r foot" id="foot"></div></div></ha-card>`;
    const q = (id) => this.shadowRoot.getElementById(id);
    this._el = {
      root: q("root"),
      tok: q("tok"),
      head: q("head"),
      sum: q("sum"),
      ctl: q("ctl"),
      chart: q("chart"),
      stats: q("stats"),
      extra: q("extra"),
      data: q("data"),
      foot: q("foot"),
    };
    const root = this._el.root;
    root.addEventListener("click", (e) => this._onClick(e));
    root.addEventListener("pointerover", (e) => this._onCellHover(e, true));
    root.addEventListener("pointerout", (e) => this._onCellHover(e, false));
    root.addEventListener("keydown", (e) => this._onKey(e));
    const chart = this._el.chart;
    chart.addEventListener("pointerdown", (e) => this._onPointerDown(e));
    chart.addEventListener("pointermove", (e) => this._onPointerMove(e));
    chart.addEventListener("pointerup", (e) => this._onPointerUp(e));
    chart.addEventListener("pointercancel", (e) => this._onPointerUp(e, true));
    chart.addEventListener("pointerleave", (e) => this._onPointerLeave(e));
    chart.addEventListener("wheel", (e) => this._onWheel(e), { passive: false });
  }

  /** Resolves color scheme, display mode, font scale, and the pixel width of the chart cell. */
  _measure() {
    const cfg = this._config;
    const hw = this.getBoundingClientRect().width || this.clientWidth || 0;
    const device = cfg.kiosk ? "kiosk" : this._coarse() ? "touch" : "desktop";
    let mode = cfg["display_mode_" + device] || "auto";
    if (mode === "auto") {
      if (!hw) mode = "regular";
      else if (hw < 720) mode = "compact";
      else if (device !== "kiosk") mode = "regular";
      else mode = hw > 1600 ? "kiosk" : hw > 1024 ? "large" : "regular";
    }
    this._mode = mode;
    this._el.root.setAttribute("data-mode", mode);
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    this._k = (rem / 16) * { compact: 1, regular: 1, large: 1.25, kiosk: 1.5 }[mode];

    let scheme = cfg.color_scheme;
    if (scheme !== "light" && scheme !== "dark") {
      const dm = this._hass && this._hass.themes && this._hass.themes.darkMode;
      scheme =
        typeof dm === "boolean"
          ? dm
            ? "dark"
            : "light"
          : window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
    }
    this._scheme = scheme;
    const auto = (cfg.color_scheme || "auto") === "auto";
    const key = scheme + "|" + auto;
    if (key !== this._tokKey) {
      this._tokKey = key;
      this._el.tok.textContent = kairosTokens(scheme, auto);
    }
    this._el.root.setAttribute("data-scheme", scheme);

    let cw = this._el.chart.clientWidth;
    if (!cw) {
      const pad = { compact: 16, regular: 20, large: 28, kiosk: 32 }[mode];
      const inner = (hw || 360) - 2 * pad;
      cw = mode === "large" || mode === "kiosk" ? ((inner - 32) * 13) / 18 : inner;
    }
    this._cw = Math.max(240, Math.round(cw));
  }

  /* ------------------------------------------------------------------ locale and formatting */

  _loc() {
    const h = this._hass;
    return (
      (h && ((h.locale && h.locale.language) || h.language)) ||
      (typeof navigator !== "undefined" && navigator.language) ||
      "en"
    );
  }

  _lang() {
    return String(this._loc()).toLowerCase().split("-")[0];
  }

  /** Translation lookup with fallback to English, then to the key itself. */
  _t(key, vars) {
    const d = KAIROS_I18N[this._lang()] || KAIROS_I18N.en;
    let s = d[key] !== undefined ? d[key] : KAIROS_I18N.en[key] !== undefined ? KAIROS_I18N.en[key] : key;
    if (vars) Object.keys(vars).forEach((k) => (s = s.split("{" + k + "}").join(vars[k])));
    return s;
  }

  /** Like `_t`, but escaped for HTML content and attributes; use it for every translation placed in markup. */
  _th(key, vars) {
    return kairosEsc(this._t(key, vars));
  }

  _tz() {
    return (this._hass && this._hass.config && this._hass.config.time_zone) || undefined;
  }

  _cached(key, make) {
    if (!this._cache[key]) this._cache[key] = make();
    return this._cache[key];
  }

  _nf(min, max) {
    const loc = this._loc();
    return this._cached(`nf|${loc}|${min}|${max}`, () => {
      const o = { minimumFractionDigits: min, maximumFractionDigits: max };
      try {
        return new Intl.NumberFormat(loc, o);
      } catch (err) {
        return new Intl.NumberFormat("en", o);
      }
    });
  }

  _hour12() {
    // The `time_format` option (auto | 12 | 24) wins; `auto` follows the Home Assistant profile.
    const own = String(this._config && this._config.time_format);
    if (own === "12") return true;
    if (own === "24") return false;
    const tf = this._hass && this._hass.locale && this._hass.locale.time_format;
    return tf === "12" ? true : tf === "24" ? false : undefined;
  }

  _dtf(name, extra) {
    const loc = this._loc();
    const tz = this._tz();
    const h12 = this._hour12();
    return this._cached(`dt|${name}|${loc}|${tz}|${h12}`, () => {
      const o = { timeZone: tz, ...extra };
      if (h12 === true) o.hour12 = true;
      else if (h12 === false) o.hourCycle = "h23";
      try {
        return new Intl.DateTimeFormat(loc, o);
      } catch (err) {
        return new Intl.DateTimeFormat("en-GB", { ...o, timeZone: undefined });
      }
    });
  }

  /** Local hour and minute in the Home Assistant time zone (24 h, used for grouping and tick positions). */
  _localParts(date) {
    const tz = (this._hass && this._hass.config && this._hass.config.time_zone) || "";
    if (!this._tzFormat || this._tzKey !== tz) {
      this._tzFormat = new Intl.DateTimeFormat("en-GB", {
        timeZone: tz || undefined,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      });
      this._tzKey = tz;
    }
    const parts = this._tzFormat.formatToParts(date);
    const get = (t) => parseInt(parts.find((p) => p.type === t).value, 10);
    return { hour: get("hour") % 24, minute: get("minute") };
  }

  _tzName(date) {
    try {
      const part = new Intl.DateTimeFormat("en-GB", {
        timeZone: this._tz(),
        timeZoneName: "short",
      })
        .formatToParts(date)
        .find((p) => p.type === "timeZoneName");
      return part ? part.value : "";
    } catch (err) {
      return "";
    }
  }

  /**
   * "A" for the first pass and "B" for the second pass of the hour that repeats when the clock goes back (like the
   * power market writes 02A and 02B), else "". The same clock time one hour earlier or later tells which pass it is.
   */
  _dstMark(date) {
    const t = date.getTime();
    if (!Number.isFinite(t)) return "";
    const tz = this._tz() || "";
    if (this._markTz !== tz) {
      this._markTz = tz;
      this._marks = new Map();
    }
    const bucket = Math.floor(t / 36e5);
    if (this._marks.has(bucket)) return this._marks.get(bucket);
    const a = this._localParts(date);
    const same = (ms) => {
      const b = this._localParts(new Date(t + ms));
      return a.hour === b.hour && a.minute === b.minute;
    };
    const mark = same(36e5) ? "A" : same(-36e5) ? "B" : "";
    this._marks.set(bucket, mark);
    return mark;
  }

  _hhmm(date) {
    return this._dtf("hm", { hour: "2-digit", minute: "2-digit" }).format(date) + this._dstMark(date);
  }

  /** Axis label: "02:00" / "2:00 AM" by default; `axis_minutes: false` gives "02", `axis_am_pm: false` drops AM/PM. */
  _hourLabel(date) {
    const mins = this._config.axis_minutes !== false;
    const f = mins ? this._dtf("hm", { hour: "2-digit", minute: "2-digit" }) : this._dtf("h2", { hour: "2-digit" });
    const mark = this._dstMark(date);
    if (this._config.axis_am_pm !== false) return f.format(date) + mark;
    return (
      f
        .formatToParts(date)
        .filter((p) => p.type !== "dayPeriod")
        .map((p) => p.value)
        .join("")
        .trim() + mark
    );
  }

  _pad(n) {
    return String(n).padStart(2, "0");
  }

  _esc(value) {
    return kairosEsc(value);
  }

  _decs() {
    const p = this._p;
    return p.dec !== null ? p.dec : p.ct ? 1 : 3;
  }

  /** Plain number in the display unit (ct or major currency), locale aware. */
  _numText(x) {
    const d = this._decs();
    return this._nf(d, d).format(this._p.ct ? x * 100 : x);
  }

  _cur(x, dec) {
    const p = this._p;
    const loc = this._loc();
    if (this._config.currency_display === "none") return this._nf(dec, dec).format(x);
    const f = this._cached(`cf|${loc}|${p.code}|${dec}|${this._config.currency_display}`, () => {
      try {
        return new Intl.NumberFormat(loc, {
          style: "currency",
          currency: p.code,
          minimumFractionDigits: dec,
          maximumFractionDigits: dec,
          currencyDisplay: this._config.currency_display === "code" ? "code" : "symbol",
        });
      } catch (err) {
        return { format: (v) => p.code + " " + this._nf(dec, dec).format(v) };
      }
    });
    return f.format(x);
  }

  _ctLabel() {
    return String(this._p.unit).split("/")[0] || "ct";
  }

  /** Short price with unit: "12,5 ct" or "\u20AC 0,125". */
  _fmt(x) {
    const p = this._p;
    if (p.ct && x >= 1) return this._cur(x, 2);
    if (p.ct) return this._numText(x) + " " + this._ctLabel();
    return this._cur(x, this._decs());
  }

  /** Splits a formatted price into [value, unit]; the unit is empty for currency amounts. */
  _valueParts(x) {
    return this._p.ct && x < 1 ? [this._numText(x), this._p.unit] : [this._fmt(x), ""];
  }

  /** Price with the full unit ("37,5 ct/kWh"); amounts of one currency unit or more keep the currency format. */
  _fmtU(x) {
    return this._p.ct && x < 1 ? this._numText(x) + " " + this._p.unit : this._fmt(x);
  }

  _pctDiff(v, ref) {
    if (!Number.isFinite(v) || !Number.isFinite(ref) || !(ref > 0)) return null;
    return Math.round((v / ref - 1) * 1000) / 10;
  }

  _pctText(d) {
    return this._nf(1, 1).format(Math.abs(d)) + "%";
  }

  /** Parses a config/state value to a number; returns "fallback" when empty or invalid. */
  _n(v, fallback = 0) {
    if (v === null || v === undefined || v === "") return fallback;
    const n = parseFloat(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : fallback;
  }

  _opacity(key) {
    const v = this._n(this._config[key], KAIROS_DEFAULTS[key]);
    return Math.max(0, Math.min(100, v)) / 100;
  }

  /** VAT multiplier: 1 when VAT is excluded; otherwise vat_rate (1.21 or 21 = 21%), default 1.21. */
  _vatMul() {
    if (!this._eff().vat) return 1;
    let r = this._n(this._config.vat_rate, 1.21);
    if (r >= 2) r = 1 + r / 100;
    return r > 0 ? r : 1;
  }

  /** vat true: (base + energy_tax + surcharge) * vat multiplier; vat false: bare base price. */
  _price(base) {
    const c = this._config;
    if (!this._eff().vat) return base;
    return (base + this._n(c.energy_tax) + this._n(c.surcharge)) * this._vatMul();
  }

  /* ------------------------------------------------------------------ settings and data access */

  _entityId() {
    const c = this._config;
    const ids = [c.entity, ...(Array.isArray(c.entities) ? c.entities : [])].filter(Boolean);
    const states = (this._hass && this._hass.states) || {};
    for (const id of ids) {
      const s = states[id];
      if (s && s.state !== "unavailable" && s.state !== "unknown") return id;
    }
    return ids[0] || KAIROS_DEFAULTS.entity;
  }

  /** True when the tomorrow attribute holds price data. */
  _hasTomorrow() {
    const st = this._hass && this._hass.states && this._hass.states[this._entityId()];
    return !!st && Array.isArray(st.attributes && st.attributes.tomorrow) && st.attributes.tomorrow.length > 0;
  }

  /**
   * Effective settings: interactive controls override the configured defaults.
   * style: "bar" | "line" | "auto"; view: "price" | "heatmap" | "breakdown".
   */
  _eff() {
    const c = this._config;
    const style = this._ui.chart_type || { auto: "auto", bars: "bar", line: "line" }[c.chart_style];
    const view = this._ui.view || c.view;
    const breakdown = view === "breakdown";
    const rangeCfg = KAIROS_RANGES.includes(c.day) ? c.day : null;
    let day = this._ui.day || (rangeCfg ? "today" : c.day);
    if (!this._ui.day && c.auto_advance_tomorrow && this._hasTomorrow()) day = "tomorrow";
    // A tomorrow selection falls back to today when the data disappears (for example after midnight).
    if (this._ui.day === "tomorrow" && !this._hasTomorrow()) day = "today";
    // A range (week, month, year, quarter) replaces the single day.
    const range = this._ui.day
      ? null
      : this._ui.range === "custom" && !this._customSpan()
        ? null
        : this._ui.range || rangeCfg;
    if (range) day = range;
    return {
      style,
      view,
      // Data without quarter-hour prices (older history, ranges) is always shown per hour or coarser.
      period: range
        ? this._rangeRes(range)
        : this._hourOnly
          ? "hour"
          : this._ui.period === "hour" || this._ui.period === "15min"
            ? this._ui.period
            : this._dayPeriod(c.period),
      heat: view === "heatmap",
      vat: breakdown ? true : this._ui.vat !== undefined ? this._ui.vat === "true" : !!c.vat,
      day,
      range,
    };
  }

  /** The cheapest slots are marked for today and tomorrow only (not for other days, history, or ranges). */
  _cheapestApplies() {
    const eff = this._eff();
    if (eff.view !== "heatmap" || eff.range) return false;
    const name = this._isDateKey(eff.day) ? this._nameOfDate(this._dayParts(eff.day)) : eff.day;
    return name === "today" || name === "tomorrow";
  }

  /** Effective number of cheapest quarters (heatmap view, today and tomorrow only; 0 = off). */
  _cheapest() {
    if (!this._cheapestApplies()) return 0;
    const v = this._ui.cheapest !== undefined ? this._ui.cheapest : this._config.cheapest_quarters;
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  /* ------------------------------------------------------------------ update cycle */

  /**
   * Freezes the card height (it can only grow) and remembers the scroll position of the page and of every scrolling
   * ancestor.
   * The returned function restores both, so a re-render never makes the page jump.
   */
  _scrollGuard(hold) {
    const spots = [];
    for (let n = this; n; n = n.assignedSlot || n.parentNode || n.host) {
      if (n.nodeType === 1 && n.scrollTop > 0) spots.push([n, n.scrollTop]);
    }
    const keep = this.offsetHeight;
    if (keep > 0) this.style.minHeight = keep + "px";
    const restore = () => spots.forEach(([n, top]) => n.scrollTop !== top && (n.scrollTop = top));
    // With `hold` the height stays frozen while the person keeps stepping; the next update releases it.
    // The scroll position is restored once, right after the render. A later restore would undo scrolling by the person.
    return () => {
      restore();
      requestAnimationFrame(() => {
        if (!hold) this.style.minHeight = "";
      });
    };
  }

  /** Re-renders without moving the page: the card height and every scroll position are kept during the update. */
  _update() {
    if (this._still) return this._render();
    this.style.minHeight = "";
    const guard = this._scrollGuard();
    try {
      this._render();
    } finally {
      guard();
    }
  }

  _render() {
    if (!this._config || !this._el) return;
    this._measure();
    if (!this._hass) {
      this._renderLoading();
      return;
    }
    this._probeHistory();
    const id = this._entityId();
    const st = this._hass.states[id];
    const q = Math.floor(Date.now() / 900000);
    const viewKey = [st ? st.last_updated : "none", JSON.stringify(this._config), JSON.stringify(this._ui)].join("|");
    const key = [
      viewKey,
      st ? st.state : "",
      q,
      this._cw,
      this._mode,
      this._scheme,
      this._loc(),
      this._tz(),
      this._hour12(),
      this._showData,
    ].join("|");
    if (key === this._renderKey) return;
    this._renderKey = key;
    // Animate only when the person changes what is shown (config, day, view), not on a data or clock refresh.
    const animKey = JSON.stringify(this._config) + "|" + JSON.stringify(this._ui);
    this._animate = animKey !== this._animKey && !this._still;
    this._animKey = animKey;

    this._m = null;
    this._renderControls();
    this._renderHead();
    let notice = null;
    if (!st) {
      notice = this._status("warn", this._t("e_missing"), this._esc(id), false);
    } else {
      try {
        const m = this._buildModel(st);
        if (m) {
          this._renderOk(m, st);
          return;
        }
        if (st.state === "unavailable")
          notice = this._status("warn", this._t("e_unavail"), this._t("e_unavail_d"), true);
        else if (st.state === "unknown" || this._histPending) {
          // While a day loads, keep the previous content (dimmed) instead of replacing it with a skeleton:
          // the layout keeps its height, so stepping from day to day does not jump.
          if (this._histPending && this._rendered) {
            this._el.root.classList.add("busy");
            return;
          }
          notice = this._skeleton();
        } else notice = this._emptyStatus();
      } catch (err) {
        console.error("kairos-card: unable to render the chart", err);
        this._m = null;
        notice = this._status("warn", this._t("e_render"), this._esc(err && err.message ? err.message : err), true);
      }
    }
    this._rendered = false;
    this._el.root.classList.remove("busy");
    this._setRegions({ chart: notice });
  }

  _setRegions(map) {
    ["sum", "chart", "stats", "extra", "data", "foot"].forEach((k) => {
      this._el[k].innerHTML = map[k] || "";
    });
  }

  _status(icon, title, detail, retry) {
    return (
      `<div class="status" role="status">${kairosIcon(icon)}<div class="st">${title}</div>` +
      `<div class="sd">${detail}</div>` +
      (retry ? `<button type="button" class="btn" data-act="retry">${this._th("retry")}</button>` : "") +
      `</div>`
    );
  }

  _emptyStatus() {
    const alt =
      this._eff().day !== "today"
        ? `<button type="button" class="btn" data-act="today">${this._th("show_today")}</button>`
        : "";
    return (
      `<div class="status" role="status">${kairosIcon("clock")}<div class="st">${this._th("empty")}</div>` +
      `<div class="sd">${this._th(this._histKey(this._eff().day) ? "cal_nohist" : "empty_d")}</div>${alt}</div>`
    );
  }

  _skeleton() {
    return (
      `<div role="status" aria-label="${this._esc(this._t("loading"))}" aria-busy="true">` +
      `<div class="skel" style="height:${this._mode === "compact" ? 200 : 260}px"></div>` +
      `<div class="skel" style="height:64px;margin-top:16px"></div></div>`
    );
  }

  _renderLoading() {
    this._renderKey = "";
    this._renderHead();
    this._setRegions({
      sum: `<div class="skel" style="height:56px;width:60%"></div>`,
      chart: this._skeleton(),
    });
  }

  _renderHead() {
    const c = this._config;
    if (!c.show_header) {
      this._el.head.innerHTML = "";
      return;
    }
    const eff = this._eff();
    const day = this._dayName(eff.day);
    // The source gives the title and logo; the custom source uses the title and icon of the configuration.
    const src = KAIROS_SOURCES[c.source] || KAIROS_SOURCES.custom;
    // `title` and `icon` belong to the custom source; the other sources show their own title and logo.
    const own = (c.source || "custom") === "custom";
    const text = this._esc(String((own && c.title) || src.title).replace(/\{day\}/g, day));
    const iconLogo = (name) =>
      customElements.get("ha-icon")
        ? `<span class="logo custom"><ha-icon icon="${this._esc(name)}"></ha-icon></span>`
        : `<span class="logo custom">${kairosIcon("bolt")}</span>`;
    let logo = "";
    if (own && c.icon === false) logo = "";
    else if (own && c.icon) logo = iconLogo(c.icon);
    else if (own) logo = `<span class="logo brand">${KAIROS_MARKS.custom()}</span>`;
    else logo = KAIROS_MARKS[c.source] ? `<span class="logo">${KAIROS_MARKS[c.source]()}</span>` : iconLogo(src.icon);
    // Subtitle: the selected day and its date in the Home Assistant time zone.
    let date = "";
    try {
      date = this._dtf("date", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(this._dayDate(eff.day));
    } catch (err) {
      date = "";
    }
    // A specific date is its own label, so the long date alone is enough.
    let sub = date ? (this._isDateKey(eff.day) ? date : `${day} \u00B7 ${date}`) : day;
    const sp = eff.range ? this._rangeSpec(eff.range) : null;
    if (sp) {
      const md = (ms, y) =>
        this._dtf(
          y ? "mdy" : "md",
          y ? { day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short" },
        ).format(new Date(ms));
      sub = `${day} \u00B7 ${md(sp.start)} \u2013 ${md(sp.end - 1, true)}`;
    }
    sub = this._esc(sub);
    const ttl =
      `<div class="ttl">${logo}<div class="tt"><div class="tt-t">${text}</div><div class="tt-s">${sub}</div>` +
      `</div></div>`;
    this._el.head.innerHTML =
      c.edit_button && this._canEdit()
        ? `<div class="hrow">${ttl}<button type="button" class="cbtn" data-act="edit" ` +
          `aria-label="${this._esc(this._t("edit_card"))}">` +
          kairosIcon(KAIROS_EDIT_ICONS.includes(c.edit_button_icon) ? c.edit_button_icon : "sliders") +
          "</button></div>"
        : ttl;
  }

  /* ------------------------------------------------------------------ controls (patched, not re-created) */

  _renderControls() {
    if (!this._config.show_controls || this._mode === "kiosk") {
      this._el.ctl.innerHTML = "";
      this._ctlKey = "";
      return;
    }
    const html = this._controlsHtml();
    if (html !== this._ctlKey) {
      this._ctlKey = html;
      this._el.ctl.innerHTML = html;
    }
    this._syncControls();
  }

  _controlsHtml() {
    const c = this._config;
    const eff = this._eff();
    const on = (opt) => c[opt] !== false;
    const esc = (s) => this._esc(s);

    // Segmented control: mutually exclusive choices. Icon-only options use their name as label and tooltip.
    const seg = (key, groupName, options) => {
      const items = options.filter(Boolean);
      if (items.length < 2) return "";
      const buttons = items
        .map((o) => {
          const name = o.name || o.text;
          const dis = o.disabled ? ' aria-disabled="true"' : "";
          const desc = o.describedby ? ` aria-describedby="${o.describedby}"` : "";
          return (
            `<button type="button" role="radio" aria-checked="false" data-k="${key}" data-v="${o.v}" ` +
            `aria-label="${esc(name)}" title="${esc(o.title || name)}"${dis}${desc}>` +
            `${o.icon ? kairosIcon(o.icon) : ""}${o.text ? `<span>${esc(o.text)}</span>` : ""}</button>`
          );
        })
        .join("");
      return (
        `<div class="seg" role="radiogroup" aria-label="${esc(groupName)}" data-g="${key}" ` +
        `style="--n:${items.length}">${`<span class="th"></span>`}${buttons}</div>`
      );
    };

    // Day control: a stepper "< Today >" (Today returns to today) and a separate calendar button on the right.
    const chev = (d) => kairosIcon(d < 0 ? "left" : "right");
    const days = on("show_day_button")
      ? `<div class="dgrp"><div class="dwrap">` +
        `<div class="dstep" role="group" aria-label="${esc(this._t("g_day"))}">` +
        `<button type="button" class="nav" data-k="day_step" data-v="-1" aria-label="${esc(this._t("prev_day"))}" ` +
        `title="${esc(this._t("prev_day"))}">${chev(-1)}</button>` +
        `<button type="button" class="dlabel" data-act="today" aria-label="${esc(this._t("go_today"))}" ` +
        `title="${esc(this._t("go_today"))}"><span class="dl1">${esc(this._t("go_today"))}</span></button>` +
        `<button type="button" class="nav" data-k="day_step" data-v="1" aria-label="${esc(this._t("next_day"))}" ` +
        `title="${esc(this._t("next_day"))}">${chev(1)}</button></div>` +
        `<button type="button" class="cbtn" id="cbtn" data-act="cal" aria-haspopup="dialog" aria-expanded="false" ` +
        `aria-label="${esc(this._t("choose_day"))}" ` +
        `title="${esc(this._t("choose_day"))}">${kairosIcon("calendar")}</button>` +
        `<div id="calwrap"></div></div></div>`
      : "";
    const period = on("show_period_button")
      ? seg("period", this._t("g_period"), [
          ...this._periodChoices(eff.range).map((v) => ({
            v,
            text: this._t(PERIOD_KEYS[v][0]),
            name: this._t(PERIOD_KEYS[v][1]),
          })),
        ])
      : "";
    const style = on("show_chart_type_button")
      ? seg("chart_type", this._t("g_chart"), [
          { v: "bar", icon: "bars", name: this._t("n_bar") },
          { v: "line", icon: "lines", name: this._t("n_line") },
        ])
      : "";
    const views = seg("view", this._t("g_view"), [
      on("show_price_button") ? { v: "price", icon: "euro", name: this._t("v_price") } : null,
      on("show_heatmap_button") ? { v: "heatmap", icon: "flame", name: this._t("v_heat") } : null,
      on("show_breakdown_button") ? { v: "breakdown", icon: "receipt", name: this._t("v_brk") } : null,
    ]);
    // Stepper for the cheapest slots; heatmap view on today and tomorrow only, while the legend is visible.
    let step = "";
    if (c.show_cheapest_stepper === true && this._cheapestApplies() && c.show_legend) {
      step =
        `<div class="step" role="group" id="stp">` +
        `<button type="button" data-k="cheapest_step" data-v="-1" aria-label="${esc(this._t("fewer"))}" ` +
        `title="${esc(this._t("fewer"))}">${kairosIcon("minus")}</button>` +
        `<span class="stv" aria-hidden="true"></span>` +
        `<button type="button" data-k="cheapest_step" data-v="1" aria-label="${esc(this._t("more"))}" ` +
        `title="${esc(this._t("more"))}">${kairosIcon("plus")}</button></div>`;
    }
    const tools = [views, period, style, step].filter(Boolean).join("");
    if (!days && !tools) return "";
    return `<div class="bar">${days}${tools ? `<div class="tools">${tools}</div>` : ""}</div>`;
  }

  /** Updates the state of the persistent controls so the segmented thumb can animate. */
  _syncControls() {
    this._syncDayStepper();
    const eff = this._eff();
    const cur = {
      day: eff.day,
      period: eff.period,
      chart_type: this._resolvedStyle || eff.style,
      view: eff.view,
    };
    this._el.ctl.querySelectorAll(".seg").forEach((seg) => {
      const btns = [...seg.querySelectorAll("button")];
      const v = cur[seg.dataset.g];
      let idx = btns.findIndex((b) => b.dataset.v === v);
      btns.forEach((b, i) => b.setAttribute("aria-checked", String(i === idx)));
      if (idx < 0) idx = 0;
      seg.style.setProperty("--i", idx);
      seg.classList.toggle("none", btns.findIndex((b) => b.dataset.v === v) < 0);
    });
    const stp = this._el.ctl.querySelector("#stp");
    if (stp) {
      const { val, max } = this._stepValue();
      stp.querySelector(".stv").textContent = String(val);
      const hourly = eff.period === "hour";
      const name = `${this._t(hourly ? "step_h" : "step_q")}: ${val > 0 ? val : this._t("off")}`;
      stp.setAttribute("aria-label", name);
      stp.title = name;
      const [minus, plus] = stp.querySelectorAll("button");
      minus.disabled = val <= 0;
      plus.disabled = val >= max;
    }
  }

  /* ---------------------------------------------------------------- dates (Home Assistant time zone) */

  /** Local date parts { y, m (0-based), d } of an instant in the Home Assistant time zone. */
  _ymd(date) {
    const parts = this._dtf("ymd", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(date);
    const g = (t) => parseInt(parts.find((x) => x.type === t).value, 10);
    return { y: g("year"), m: g("month") - 1, d: g("day") };
  }

  _key(p) {
    return `${p.y}-${String(p.m + 1).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
  }

  _addDays(p, n) {
    const t = new Date(Date.UTC(p.y, p.m, p.d + n));
    return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() };
  }

  _utc(p) {
    return Date.UTC(p.y, p.m, p.d);
  }

  _isDateKey(day) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(day));
  }

  /** Date key of a day that comes from the price history (yesterday and older), or null. */
  _histKey(day) {
    if (this._isDateKey(day)) return day;
    return day === "yesterday" ? this._key(this._dayParts("yesterday")) : null;
  }

  /** Date parts of an effective day: yesterday, today, tomorrow, or a "YYYY-MM-DD" key. */
  _dayParts(day) {
    if (this._isDateKey(day)) {
      const [y, m, d] = day.split("-").map(Number);
      return { y, m: m - 1, d };
    }
    return this._addDays(this._ymd(new Date()), { yesterday: -1, today: 0, tomorrow: 1 }[day] ?? 0);
  }

  /** Name of a date: yesterday, today, tomorrow (these use the sensor attributes) or a "YYYY-MM-DD" key. */
  _nameOfDate(p) {
    const diff = Math.round((this._utc(p) - this._utc(this._ymd(new Date()))) / 864e5);
    return diff === -1 ? "yesterday" : diff === 0 ? "today" : diff === 1 ? "tomorrow" : this._key(p);
  }

  /** Label of a day: Yesterday, Today, Tomorrow, or the date itself ("Mon, October 19"). */
  _dayName(day) {
    if (day === "custom" || KAIROS_RANGES.includes(day)) return this._rangeLabel(day);
    if (!this._isDateKey(day)) return this._t(day);
    const p = this._dayParts(day);
    return this._dtf("dnum", {
      weekday: "short",
      month: "long",
      day: "numeric",
    }).format(new Date(Date.UTC(p.y, p.m, p.d, 12)));
  }

  /** A date at noon UTC, safe to format in any time zone. */
  _dayDate(day) {
    const p = this._dayParts(day);
    return new Date(Date.UTC(p.y, p.m, p.d, 12));
  }

  /** Last day that has prices: tomorrow once published, otherwise today. */
  _lastDay() {
    return this._addDays(this._ymd(new Date()), this._hasTomorrow() ? 1 : 0);
  }

  /* ---------------------------------------------------------------- price history (recorder statistics) */

  /** Average price per day (today, tomorrow, yesterday) from the sensor attributes, keyed by "YYYY-MM-DD". */
  _attrAverages() {
    const st = this._hass && this._hass.states && this._hass.states[this._entityId()];
    const attrs = (st && st.attributes) || {};
    const out = {};
    ["today", "tomorrow"].forEach((d) => {
      const rows = (Array.isArray(attrs[d]) ? attrs[d] : []).filter(
        (p) => p && Number.isFinite(Date.parse(p.start)) && Number.isFinite(this._n(p.energy_price, NaN)),
      );
      if (!rows.length) return;
      const avg = rows.reduce((a, p) => a + this._price(this._n(p.energy_price)), 0) / rows.length;
      out[this._key(this._ymd(new Date(rows[0].start)))] = avg;
    });
    return out;
  }

  /** Reads long-term statistics (mean) of the history entity; null when unavailable. */
  async _callStats(period, startMs, endMs) {
    const id = this._config.history_entity;
    if (!id || !this._hass || !this._hass.callWS) {
      this._hist.err = "history is not available";
      return null;
    }
    try {
      const res = await this._hass.callWS({
        type: "recorder/statistics_during_period",
        start_time: new Date(startMs).toISOString(),
        end_time: new Date(endMs).toISOString(),
        statistic_ids: [id],
        period,
        types: ["mean"],
      });
      this._hist.err = null;
      return ((res && res[id]) || [])
        .map((r) => ({
          t: typeof r.start === "number" ? r.start : Date.parse(r.start),
          mean: r.mean,
        }))
        .filter((r) => Number.isFinite(r.t) && Number.isFinite(r.mean));
    } catch (err) {
      this._hist.err = String((err && err.message) || err);
      return null;
    }
  }

  /** Runs a history request once per signature and refreshes the calendar (and day view) when it completes. */
  _histRun(sig, job) {
    if (this._hist.req[sig]) return;
    this._hist.req[sig] = true;
    this._hist.pending += 1;
    Promise.resolve()
      .then(job)
      .catch(() => {})
      .then(() => {
        this._hist.pending -= 1;
        this._syncDayStepper();
        const eff = this._eff();
        const hk = this._histKey(eff.day);
        if ((hk && this._hist.hours[hk]) || eff.range) {
          this._renderKey = "";
          this._update();
        }
      });
  }

  _noteEarliest(p) {
    const k = this._key(p);
    if (!this._hist.earliest || k < this._hist.earliest) this._hist.earliest = k;
  }

  _loadMonthDays(y, m) {
    this._histRun(`d:${y}-${m}`, async () => {
      const rows = await this._callStats("day", Date.UTC(y, m, 1) - 14 * 36e5, Date.UTC(y, m + 1, 1) + 14 * 36e5);
      (rows || []).forEach((r) => {
        const p = this._ymd(new Date(r.t));
        if (p.y === y && p.m === m) {
          this._hist.days[this._key(p)] = r.mean;
          this._noteEarliest(p);
        }
      });
    });
  }

  _loadMonths(a, b) {
    this._histRun(`m:${a}-${b}`, async () => {
      const rows = await this._callStats("month", Date.UTC(a, 0, 1) - 14 * 36e5, Date.UTC(b + 1, 0, 1) + 14 * 36e5);
      (rows || []).forEach((r) => {
        const p = this._ymd(new Date(r.t));
        this._hist.months[`${p.y}-${String(p.m + 1).padStart(2, "0")}`] = r.mean;
        this._noteEarliest({ y: p.y, m: p.m, d: 1 });
      });
    });
  }

  /**
   * Quarter-hour prices of a recent day from the recorded states of the history entity.
   * Returns null when the recorder has too little data for that day.
   */
  async _rawQuarters(slots) {
    const id = this._config.history_entity;
    if (!id || !this._hass || !this._hass.callWS || !slots.length) return null;
    try {
      const res = await this._hass.callWS({
        type: "history/history_during_period",
        start_time: new Date(slots[0]).toISOString(),
        end_time: new Date(slots[slots.length - 1] + 9e5).toISOString(),
        entity_ids: [id],
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false,
      });
      const ev = ((res && res[id]) || [])
        .map((e) => ({
          t: e.lu !== undefined ? e.lu * 1000 : Date.parse(e.last_updated),
          v: parseFloat(e.s !== undefined ? e.s : e.state),
        }))
        .filter((e) => Number.isFinite(e.t) && Number.isFinite(e.v))
        .sort((a, b) => a.t - b.t);
      // A state is only stored when it changes, so every slot takes the last state at or before its start.
      const out = [];
      let i = 0;
      let cur = null;
      slots.forEach((t) => {
        while (i < ev.length && ev[i].t <= t + 30000) {
          cur = ev[i].v;
          i += 1;
        }
        if (cur !== null) out.push({ t, mean: cur, dur: 9e5 });
      });
      return out.length >= slots.length * 0.9 ? out : null;
    } catch (err) {
      return null;
    }
  }

  /** Prices of one past day: quarter hours for recent days, otherwise hourly means from the statistics. */
  _loadHours(key) {
    this._histRun(`h:${key}`, async () => {
      const p = this._dayParts(key);
      const from = this._utc(p) - 14 * 36e5;
      const slots = [];
      for (let t = from; t < from + 52 * 36e5; t += 9e5) if (this._key(this._ymd(new Date(t))) === key) slots.push(t);
      const age = Math.round((this._utc(this._ymd(new Date())) - this._utc(p)) / 864e5);
      const quarterDays = Number.isFinite(Number(this._config.history_quarter_days))
        ? Number(this._config.history_quarter_days)
        : 7;
      let rows = age >= 1 && age <= quarterDays ? await this._rawQuarters(slots) : null;
      if (!rows) {
        const stats = await this._callStats("hour", from, from + 52 * 36e5);
        rows = (stats || [])
          .filter((r) => this._key(this._ymd(new Date(r.t))) === key)
          .map((r) => ({ t: r.t, mean: r.mean, dur: 36e5 }));
      }
      this._hist.hours[key] = rows;
    });
  }

  /* ---------------------------------------------------------------- ranges (week, month, year, quarters) */

  /** Local midnight (ms) of a date in the Home Assistant time zone. */
  _dayStart(p) {
    p = this._addDays(p, 0);
    const key = this._key(p);
    return this._cached(`ds|${this._tz()}|${key}`, () => {
      const from = Date.UTC(p.y, p.m, p.d) - 14 * 36e5;
      for (let t = from; t < from + 40 * 36e5; t += 9e5) if (this._key(this._ymd(new Date(t))) === key) return t;
      return Date.UTC(p.y, p.m, p.d);
    });
  }

  /**
   * Year of quarter q (1-4): the current year once that quarter has started, otherwise the previous year.
   * Null when no data exists.
   */
  _quarterYear(q) {
    const t = this._ymd(new Date());
    for (let yy = t.y; yy >= t.y - 1; yy--) {
      // A quarter that has started is shown (the current one is partial); one that has not started uses last year.
      if (this._dayStart({ y: yy, m: 3 * (q - 1), d: 1 }) > Date.now()) continue;
      const has = [0, 1, 2].some(
        (i) => this._hist.months[`${yy}-${String(3 * (q - 1) + i + 1).padStart(2, "0")}`] !== undefined,
      );
      if (has) return yy;
    }
    return null;
  }

  /** A range option is only offered when its data is present. */
  _rangeAvailable(key) {
    const t = this._ymd(new Date());
    const avg = this._attrAverages();
    const has = (off) => avg[this._key(this._addDays(t, off))] !== undefined;
    if (key === "today") return has(0);
    if (key === "tomorrow") return has(1);
    if (["week", "month"].includes(key)) return has(0);
    if (key === "year") return Object.keys(this._hist.months).some((k) => k.startsWith(`${t.y}-`));
    if (/^q[1-4]$/.test(key)) return this._quarterYear(Number(key[1])) !== null;
    return false;
  }

  /** Selected custom period as { from, to } day parts, or null. */
  _customSpan() {
    const c = this._ui.custom;
    if (!c || !this._isDateKey(c.from) || !this._isDateKey(c.to)) return null;
    return { from: this._dayParts(c.from), to: this._dayParts(c.to) };
  }

  /** Length of the custom period in days. */
  _customDays() {
    const c = this._customSpan();
    return c ? Math.round((this._utc(c.to) - this._utc(c.from)) / 864e5) + 1 : 1;
  }

  /** Period options that apply to a view: a day, or a range (week, month, year, quarter, custom). */
  _periodChoices(range) {
    if (!range) return this._hourOnly ? ["hour"] : ["15min", "hour"];
    if (range === "week") return ["hour", "day"];
    if (range === "year") return ["week", "month"];
    if (/^q[1-4]$/.test(range)) return ["day", "week", "month"];
    if (range === "custom") {
      const n = this._customDays();
      return n <= 14 ? ["hour", "day"] : n <= 92 ? ["day", "week"] : ["week", "month"];
    }
    return ["day", "week"];
  }

  /** Resolution of a range: the chosen one when it applies, otherwise the default of that range. */
  _rangeRes(key) {
    const choices = this._periodChoices(key);
    if (choices.includes(this._ui.res)) return this._ui.res;
    // The start day of the configuration uses the configured period when it applies to that range.
    if (!this._ui.res && key === this._config.day && choices.includes(this._config.period)) return this._config.period;
    if (key === "custom") return choices[0];
    return key === "week" ? "hour" : key === "year" || /^q[1-4]$/.test(key) ? "week" : "day";
  }

  /** Monday 00:00 of the week that contains an instant. */
  _weekStart(ms) {
    const p = this._ymd(new Date(ms + 12 * 36e5));
    const dow = (new Date(Date.UTC(p.y, p.m, p.d)).getUTCDay() + 6) % 7;
    return this._dayStart(this._addDays(p, -dow));
  }

  /** Periods the range is stepped away from the current one (0 = current, -1 = one period back). */
  _rangeOffset() {
    return Math.min(0, Math.round(Number(this._ui.rangeOffset)) || 0);
  }

  /** Short date ("Oct 19"), optionally with the year. */
  _mdText(ms, y) {
    return this._dtf(
      y ? "mdy" : "md",
      y ? { day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short" },
    ).format(new Date(ms));
  }

  /** ISO week number of an instant. */
  _weekNo(ms) {
    return this._isoWeek(this._ymd(new Date(ms + 12 * 36e5)));
  }

  /** ISO week number of a date (y, m, d). */
  _isoWeek(p) {
    const d = new Date(Date.UTC(p.y, p.m, p.d));
    d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7)); // Thursday of this week
    const thursday = d.valueOf();
    d.setUTCMonth(0, 1);
    if (d.getUTCDay() !== 4) d.setUTCMonth(0, 1 + ((4 - d.getUTCDay() + 7) % 7));
    return 1 + Math.ceil((thursday - d.valueOf()) / 604800000);
  }

  /**
   * Label of a range: This week, Last week, Week 41; This month, Last month, September 2026; This year, Last year,
   * 2024; First quarter 2026. `plain` ignores the step (used by the list).
   */
  _rangeLabel(key, plain) {
    const off = plain ? 0 : this._rangeOffset();
    const sp = off ? this._rangeSpec(key, off) : null;
    const a = sp ? this._ymd(new Date(sp.start + 12 * 36e5)) : null;
    if (/^q[1-4]$/.test(key)) {
      const y = sp ? a.y : this._quarterYear(Number(key[1]));
      // The year is left out for the current year.
      return `${this._t("quarter_" + key[1])}${y && y !== this._ymd(new Date()).y ? " " + y : ""}`;
    }
    if (key === "custom") return this._t("custom_range");
    if (!sp) return this._t(key);
    if (key === "week") return off === -1 ? this._t("last_week") : this._t("week_n", { n: this._isoWeek(a) });
    if (key === "month") {
      return off === -1
        ? this._t("last_month")
        : (a.y === this._ymd(new Date()).y
            ? this._dtf("monly", { month: "long" })
            : this._dtf("mon", { month: "long", year: "numeric" })
          ).format(new Date(sp.start + 12 * 36e5));
    }
    if (key === "year") return off === -1 ? this._t("last_year") : String(a.y);
    return this._t(key);
  }

  /** Whether the range can be stepped one period back: its data must exist (recorder history). */
  _canStepRange(eff) {
    const off = this._rangeOffset();
    const sp = this._rangeSpec(eff.range, off - 1);
    if (!sp) return false;
    const e = this._hist.earliest;
    return !e || this._key(this._ymd(new Date(sp.end - 1))) >= e;
  }

  /** Time span and resolution of a range: { kind: hours | days | months, res: quarter | hour | day | month }. */
  _rangeSpec(key, off = this._rangeOffset()) {
    const now = Date.now();
    const today = this._ymd(new Date());
    const lastEnd = this._dayStart(this._addDays(this._lastDay(), 1));
    const ds = (p) => this._dayStart(p);
    if (key === "custom") {
      const c = this._customSpan();
      if (!c) return null;
      const n = this._customDays();
      const first = this._addDays(c.from, n * off);
      const res = this._rangeRes(key);
      return {
        key,
        kind: res === "month" ? "months" : "days",
        res,
        start: ds(first),
        end: ds(this._addDays(first, n)),
      };
    }
    if (key === "week") {
      const dow = (new Date(Date.UTC(today.y, today.m, today.d)).getUTCDay() + 6) % 7;
      const first = this._addDays(today, -dow + 7 * off);
      return {
        key,
        kind: "days",
        res: this._rangeRes(key),
        start: ds(first),
        end: off ? ds(this._addDays(first, 7)) : lastEnd,
      };
    }
    if (key === "month") {
      const first = this._addDays({ y: today.y, m: today.m + off, d: 1 }, 0);
      const next = { y: first.y, m: first.m + 1, d: 1 };
      return {
        key,
        kind: "days",
        res: this._rangeRes(key),
        start: ds(first),
        end: off ? ds(next) : lastEnd,
      };
    }
    if (key === "year") {
      const y = today.y + off;
      const res = this._rangeRes(key);
      return {
        key,
        kind: res === "month" ? "months" : "days",
        res,
        start: ds({ y, m: 0, d: 1 }),
        end: off ? ds({ y: y + 1, m: 0, d: 1 }) : now,
      };
    }
    if (/^q[1-4]$/.test(key)) {
      const q = Number(key[1]);
      const base = this._quarterYear(q);
      if (base === null) return null;
      const yy = base + off;
      const res = this._rangeRes(key);
      return {
        key,
        kind: res === "month" ? "months" : "days",
        res,
        start: ds({ y: yy, m: 3 * (q - 1), d: 1 }),
        end: ds({ y: yy, m: 3 * q, d: 1 }),
      };
    }
    return null;
  }

  _bucketEnd(res, t) {
    if (res === "hour") return t + 36e5;
    const p = this._ymd(new Date(t + 12 * 36e5));
    if (res === "week") return this._dayStart(this._addDays(p, 7));
    return res === "day" ? this._dayStart(this._addDays(p, 1)) : this._dayStart({ y: p.y, m: p.m + 1, d: 1 });
  }

  /** Statistics (older periods) of a range; the results are cached per range and resolution. */
  _loadSeries(sig, spec) {
    this._histRun(`s:${sig}`, async () => {
      const cap = this._dayStart(this._ymd(new Date()));
      const end = spec.res === "month" ? spec.end : Math.min(spec.end, cap);
      const from = spec.res === "week" ? this._weekStart(spec.start) : spec.start;
      const rows = end > from ? (await this._callStats(spec.res, from, end)) || [] : [];
      this._hist.series[sig] = rows.map((r) => ({ t: r.t, mean: r.mean }));
    });
  }

  /**
   * Rows { start, end, energy_price } of a range, or null while the history is still loading. Long-term statistics
   * are combined with the attributes of today and tomorrow, aggregated to hours, days, or months.
   */
  _rangeRows(spec, attrs) {
    const quarters = [];
    ["today", "tomorrow"].forEach((d) =>
      (Array.isArray(attrs[d]) ? attrs[d] : []).forEach((p) => {
        const ms0 = Date.parse(p && p.start);
        const ms1 = Date.parse(p && p.end);
        const base = this._n(p && p.energy_price, NaN);
        if (
          Number.isFinite(ms0) &&
          Number.isFinite(ms1) &&
          Number.isFinite(base) &&
          ms0 >= spec.start &&
          ms0 < spec.end
        ) {
          quarters.push({ ms0, ms1, base });
        }
      }),
    );
    const iso = (t) => new Date(t).toISOString();
    const sig = `${spec.key}|${spec.res}|${spec.start}${spec.key === "custom" ? `|${spec.end}` : ""}`;
    const stat = this._hist.series[sig];
    if (!stat) {
      this._loadSeries(sig, spec);
      return null;
    }
    const map = new Map();
    stat.forEach((r) => map.set(r.t, r.mean));
    const lo = spec.res === "week" ? this._weekStart(spec.start) : spec.start;
    if (spec.res !== "month") {
      const bucket = (ms) =>
        spec.res === "hour"
          ? Math.floor(ms / 36e5) * 36e5
          : spec.res === "week"
            ? this._weekStart(ms)
            : this._dayStart(this._ymd(new Date(ms)));
      const groups = new Map();
      quarters.forEach((q) => {
        const b = bucket(q.ms0);
        groups.set(b, [...(groups.get(b) || []), q.base]);
      });
      groups.forEach((g, b) => map.set(b, g.reduce((a, x) => a + x, 0) / g.length));
    }
    return [...map.keys()]
      .filter((t) => t >= lo && t < spec.end)
      .sort((a, b) => a - b)
      .map((t) => ({
        start: iso(t),
        end: iso(this._bucketEnd(spec.res, t)),
        energy_price: map.get(t),
      }));
  }

  /** Date or time of an instant, in the form that fits the current range (time, date, date and time, or month). */
  _stampMs(ms) {
    const d = new Date(ms);
    if (this._kind === "months") return this._dtf("mon", { month: "long", year: "numeric" }).format(d);
    if (this._res === "day" || this._res === "week" || this._multi) {
      const date = this._dtf("wmd", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(d);
      return this._res === "day" || this._res === "week" ? date : `${date} ${this._hhmm(d)}`;
    }
    return this._hhmm(d);
  }

  _rangesHtml(eff) {
    const groups = [
      ["grp_days", ["tomorrow", "today", "week", "month", "year"]],
      ["grp_quarters", ["q1", "q2", "q3", "q4"]],
    ];
    return groups
      .map(([g, keys]) => {
        const avail = keys.filter((k) => this._rangeAvailable(k));
        if (g === "grp_quarters") {
          // Quarters: one segmented control (Q1-Q4); the full name is the accessible name.
          if (!avail.length) return "";
          const btns = avail
            .map((k) => {
              const full = this._esc(this._rangeLabel(k, true));
              return (
                `<button type="button" class="qb" data-r="${k}" aria-pressed="${k === eff.day}" ` +
                `aria-label="${full}" title="${full}">Q${k[1]}</button>`
              );
            })
            .join("");
          return (
            `<div class="rg rq" role="group" aria-label="${this._esc(this._t(g))}">` +
            `<div class="sh">${this._esc(this._t(g))}</div><div class="qs" style="--n:${avail.length}">${btns}</div>` +
            `</div>`
          );
        }
        const rows = avail.map((k) => {
          const on = k === eff.day;
          return (
            `<button type="button" class="rb" data-r="${k}" aria-pressed="${on}">` +
            `<span>${this._esc(this._rangeLabel(k, true))}</span>` +
            `${on ? kairosIcon("check") : ""}</button>`
          );
        });
        return rows.length
          ? `<div class="rg" role="group" aria-label="${this._esc(this._t(g))}">${rows.join("")}</div>`
          : "";
      })
      .join("");
  }

  _pickRange(key) {
    const isDay = ["today", "yesterday", "tomorrow"].includes(key);
    this._ui = isDay
      ? {
          ...this._ui,
          day: key,
          range: undefined,
          rangeOffset: 0,
          res: undefined,
          period: undefined,
        }
      : {
          ...this._ui,
          range: key,
          day: undefined,
          rangeOffset: 0,
          res: undefined,
          period: undefined,
        };
    this._hover = null;
    this._pinned = null;
    this._calOpen = false;
    document.removeEventListener("pointerdown", this._onDocDown, true);
    this._update();
    const l = this.shadowRoot.getElementById("cbtn");
    if (l) l.focus({ preventScroll: true });
  }

  _probeHistory() {
    const y = this._ymd(new Date()).y;
    this._loadMonths(y - 1, y);
  }

  /* ---------------------------------------------------------------- day stepper and calendar */

  _syncDayStepper() {
    const w = this._el.ctl.querySelector(".dstep");
    if (!w) return;
    const eff = this._eff();
    const p = this._dayParts(eff.day);
    const [prev, next] = w.querySelectorAll("button.nav");
    const earliest = this._hist.earliest;
    // The arrows step one day; for a range they step a whole period (see below).
    if (eff.range) {
      // For a range the arrows step a whole period (week, month, ...); forward only back to the current one.
      prev.disabled = !this._canStepRange(eff);
      next.disabled = this._rangeOffset() >= 0;
    } else {
      prev.disabled = !!earliest && this._key(p) <= earliest;
      next.disabled = this._utc(p) >= this._utc(this._lastDay());
    }
    [prev, next].forEach((b, i) => {
      const name = this._t(eff.range ? ["prev_period", "next_period"][i] : ["prev_day", "next_day"][i]);
      b.setAttribute("aria-label", name);
      b.title = name;
    });
    const cb = this._el.ctl.querySelector("#cbtn");
    cb.setAttribute("aria-expanded", String(this._calOpen));
    this._renderCal();
  }

  /**
   * Calendar popover with three levels: days of a month, the 12 months of a year, and a range of years.
   * The title drills up (month > year > years); selecting a year or month drills back down.
   */
  _renderCal() {
    const wrap = this._el.ctl.querySelector("#calwrap");
    if (!wrap) return;
    if (!this._calOpen) {
      wrap.innerHTML = "";
      return;
    }
    const eff = this._eff();
    const sel = this._dayParts(eff.day);
    if (!this._calView) {
      this._calView = { y: sel.y, m: sel.m };
    }
    // One popover: the quick ranges next to (or, on narrow cards, above) the calendar.
    const ranges = `<nav class="prng" aria-label="${this._esc(this._t("tab_ranges"))}">${this._rangesHtml(eff)}</nav>`;
    const { y, m } = this._calView;
    const mode = this._calMode;
    const today = this._ymd(new Date());
    const last = this._lastDay();
    const P = KAIROS_HEAT[this._scheme];
    const esc = (v) => this._esc(v);
    const colorOf = (v, lo, hi) => {
      if (!(hi - lo > 1e-9)) return P.yellow;
      const t = (v - lo) / (hi - lo);
      return t <= 0.5
        ? kairosInterpolateColor(P.dgreen, P.yellow, t * 2)
        : kairosInterpolateColor(P.yellow, P.dred, (t - 0.5) * 2);
    };
    const cs = eff.range === "custom" ? this._rangeSpec("custom") : null;
    const csFrom = cs ? this._key(this._ymd(new Date(cs.start + 12 * 36e5))) : "";
    const csTo = cs ? this._key(this._ymd(new Date(cs.end - 12 * 36e5))) : "";
    const inRange = (key) => !!cs && key >= csFrom && key <= csTo;
    const mm = (yy, i) => `${yy}-${String(i + 1).padStart(2, "0")}`;
    const items = []; // { label, v, attr, pressed, disabled }
    let title;
    let prevL;
    let nextL;
    let upL = "";
    let lead = 0;
    let weekdays = "";

    if (mode === "days") {
      this._loadMonthDays(y, m);
      title = this._dtf("mon", { month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m, 15, 12)));
      prevL = this._t("prev_month");
      nextL = this._t("next_month");
      upL = this._t("cal_up_month");
      lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
      const attrAvg = this._attrAverages();
      const count = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      for (let d = 1; d <= count; d++) {
        const p = { y, m, d };
        const key = this._key(p);
        let v = null;
        if (this._utc(p) <= this._utc(last)) {
          if (attrAvg[key] !== undefined) v = attrAvg[key];
          else if (this._hist.days[key] !== undefined) v = this._price(this._hist.days[key]);
        }
        const long = this._dtf("dlong", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date(Date.UTC(y, m, d, 12)));
        items.push({
          label: String(d),
          v,
          data: `data-d="${this._nameOfDate(p)}"`,
          long,
          pressed: !eff.range && key === this._key(sel),
          anchor: key === this._calAnchor,
          inr: inRange(key),
        });
      }
      weekdays = Array.from({ length: 7 }, (_, i) =>
        new Intl.DateTimeFormat(this._loc(), {
          weekday: "short",
          timeZone: "UTC",
        }).format(new Date(Date.UTC(2024, 0, 1 + i))),
      )
        .map((x) => `<span class="wd">${esc(x)}</span>`)
        .join("");
    } else if (mode === "months") {
      this._loadMonths(y, y);
      title = String(y);
      prevL = this._t("prev_year");
      nextL = this._t("next_year");
      upL = this._t("cal_up_year");
      for (let i = 0; i < 12; i++) {
        const raw = this._hist.months[mm(y, i)];
        const future = y > today.y || (y === today.y && i > today.m);
        const long = this._dtf("mlong", {
          month: "long",
          year: "numeric",
        }).format(new Date(Date.UTC(y, i, 15, 12)));
        items.push({
          label: new Intl.DateTimeFormat(this._loc(), {
            month: "short",
            timeZone: "UTC",
          }).format(new Date(Date.UTC(y, i, 15, 12))),
          v: raw !== undefined && !future ? this._price(raw) : null,
          data: `data-mo="${i}"`,
          long,
          pressed: !eff.range && sel.y === y && sel.m === i,
        });
      }
    } else {
      const base = y - (((y % 12) + 12) % 12);
      this._loadMonths(base, base + 11);
      title = `${base} \u2013 ${base + 11}`;
      prevL = this._t("prev_years");
      nextL = this._t("next_years");
      for (let yy = base; yy < base + 12; yy++) {
        const vals = Array.from({ length: 12 }, (_, i) => this._hist.months[mm(yy, i)]).filter((v) => v !== undefined);
        items.push({
          label: String(yy),
          v: vals.length && yy <= today.y ? this._price(vals.reduce((a, b) => a + b, 0) / vals.length) : null,
          data: `data-yr="${yy}"`,
          long: String(yy),
          pressed: !eff.range && sel.y === yy,
        });
      }
    }

    const vs = items.filter((x) => x.v !== null).map((x) => x.v);
    const lo = Math.min(...vs);
    const hi = Math.max(...vs);
    const cells = items
      .map((x) =>
        x.v === null
          ? `<button type="button" disabled class="dv0"><span>${esc(x.label)}</span></button>`
          : `<button type="button" ${x.data} aria-pressed="${x.pressed || !!x.anchor}"${x.inr ? ' class="inr"' : ""} ` +
            `style="--c:${colorOf(x.v, lo, hi)}" ` +
            `aria-label="${esc(`${x.long}, ${this._t("average")} ${this._fmtU(x.v)}`)}"><span>${esc(x.label)}</span>` +
            `<span class="dv">${this._numText(x.v)}</span><i class="hb"></i></button>`,
      )
      .join("");
    const nav = (dir, label) =>
      `<button type="button" data-cal="${dir}" ` +
      `aria-label="${esc(label)}">${kairosIcon(dir < 0 ? "left" : "right")}</button>`;
    const head = upL
      ? `<button type="button" class="pt" data-up="1" aria-label="${esc(upL)}">${esc(title)}` +
        `${kairosIcon("down")}</button>`
      : `<b class="pt">${esc(title)}</b>`;
    const note = this._calAnchor
      ? this._t("cal_pick_end")
      : this._hist.err
        ? this._t("cal_nohist")
        : this._hist.pending > 0
          ? this._t("cal_loading")
          : "";
    wrap.innerHTML =
      `<div class="pop" id="pop" role="dialog" aria-label="${esc(this._t("choose_day"))}"><div class="pbody">` +
      ranges +
      `<div class="pcal"><div class="ph">${nav(-1, prevL)}${head}${nav(1, nextL)}</div>` +
      `<div class="pg${mode === "days" ? "" : " pg3"}">${weekdays}` +
      `${'<span class="pad"></span>'.repeat(lead)}${cells}</div>` +
      `<div class="pf cap" role="status">${esc(note)}</div></div></div></div>`;
  }

  _openCal() {
    this._calOpen = true;
    this._calAnchor = null;
    this._calView = null;
    this._calMode = "days";
    document.addEventListener("pointerdown", this._onDocDown, true);
    this._syncDayStepper();
    requestAnimationFrame(() => {
      const t =
        this.shadowRoot.querySelector('#pop button[aria-pressed="true"]') ||
        this.shadowRoot.querySelector("#pop button:not(:disabled)");
      if (t) t.focus({ preventScroll: true });
    });
  }

  _closeCal(focus) {
    if (!this._calOpen) return;
    this._calOpen = false;
    this._calAnchor = null;
    document.removeEventListener("pointerdown", this._onDocDown, true);
    this._syncDayStepper();
    if (focus) {
      const l = this.shadowRoot.getElementById("cbtn");
      if (l) l.focus({ preventScroll: true });
    }
  }

  /** Two taps pick a period: the first sets the start, the second the end (the same day twice is one day). */
  _pickCalDay(day) {
    if (!this._calAnchor) {
      this._calAnchor = day;
      this._renderCal();
      const b = this.shadowRoot.querySelector(`#pop button[data-d="${day}"]`);
      if (b) b.focus({ preventScroll: true });
      return;
    }
    const a = this._calAnchor;
    this._calAnchor = null;
    if (a === day) return this._pickDay(day);
    const ka = this._key(this._dayParts(a));
    const kb = this._key(this._dayParts(day));
    const [from, to] = ka < kb ? [ka, kb] : [kb, ka];
    this._ui = {
      ...this._ui,
      range: "custom",
      day: undefined,
      custom: { from, to },
      rangeOffset: 0,
      res: undefined,
      period: undefined,
    };
    this._hover = null;
    this._pinned = null;
    this._calOpen = false;
    document.removeEventListener("pointerdown", this._onDocDown, true);
    this._update();
    const l = this.shadowRoot.getElementById("cbtn");
    if (l) l.focus({ preventScroll: true });
  }

  _pickDay(day) {
    this._ui = { ...this._ui, day, range: undefined };
    this._hover = null;
    this._pinned = null;
    this._calOpen = false;
    document.removeEventListener("pointerdown", this._onDocDown, true);
    this._update();
    const l = this.shadowRoot.getElementById("cbtn");
    if (l) l.focus({ preventScroll: true });
  }

  _stepValue() {
    const hourly = this._eff().period === "hour";
    const cq = this._cheapest();
    const val = hourly ? (cq > 0 ? Math.max(1, Math.round(cq / 4)) : 0) : cq;
    return { val, max: Math.max(hourly ? 12 : 48, val), hourly };
  }

  /* ------------------------------------------------------------------ model */

  /**
   * Reads the raw price rows of the selected day or range. Returns `{ list, spec }` (valid rows sorted by start, one
   * per start time), or null when there is nothing to show (`_histPending` tells whether history is still loading).
   */
  _modelRows(eff, attrs) {
    let raw;
    let spec = null;
    if (eff.range) {
      spec = this._rangeSpec(eff.range);
      if (!spec) return null;
      raw = this._rangeRows(spec, attrs);
      if (raw === null) {
        this._histPending = true;
        return null;
      }
    } else if (this._histKey(eff.day)) {
      // Yesterday and older days: quarter hours (recent) or hourly means from the price history (bare price).
      const hk = this._histKey(eff.day);
      const h = this._hist.hours[hk];
      if (!h) {
        this._loadHours(hk);
        this._histPending = true;
        return null;
      }
      raw = h.map((r) => ({
        start: new Date(r.t).toISOString(),
        end: new Date(r.t + (r.dur || 36e5)).toISOString(),
        energy_price: r.mean,
      }));
    } else raw = Array.isArray(attrs[eff.day]) ? attrs[eff.day] : [];

    // Entries without a valid start, end, or price cannot be placed and are skipped (they show as a gap).
    const rows = [];
    raw.forEach((p) => {
      if (!p) return;
      const ms0 = Date.parse(p.start);
      const ms1 = Date.parse(p.end);
      const base = this._n(p.energy_price, NaN);
      if (Number.isFinite(ms0) && Number.isFinite(ms1) && ms1 > ms0 && Number.isFinite(base)) {
        rows.push({ start: p.start, end: p.end, ms0, ms1, base });
      }
    });
    rows.sort((a, b) => a.ms0 - b.ms0);
    const list = rows.filter((r, i) => i === rows.length - 1 || rows[i + 1].ms0 !== r.ms0);
    return list.length ? { list, spec } : null;
  }

  /** Quarter hours with price components: e = energy, t = tax, sc = surcharge, v = VAT. */
  _modelQuarters(list, vatOn) {
    const cfg = this._config;
    const tax = vatOn ? this._n(cfg.energy_tax) : 0;
    const sur = vatOn ? this._n(cfg.surcharge) : 0;
    return list.map((r) => {
      const price = this._price(r.base);
      const lp = this._localParts(new Date(r.ms0));
      return {
        start: r.start,
        end: r.end,
        ms0: r.ms0,
        ms1: r.ms1,
        hour: lp.hour,
        minute: lp.minute,
        e: r.base,
        t: tax,
        sc: sur,
        v: price - (r.base + tax + sur),
        price,
      };
    });
  }

  /**
   * Slots: quarter hours, or hourly averages. History days are hourly by nature. The 15 min period is only offered
   * while the shown data really has quarter-hour prices.
   */
  _modelSlots(quarters, eff) {
    const cfg = this._config;
    if (!eff.range) this._hourOnly = quarters[0].ms1 - quarters[0].ms0 >= 36e5;
    const want =
      this._ui.period === "hour" || this._ui.period === "15min" ? this._ui.period : this._dayPeriod(cfg.period);
    if (!eff.range) eff.period = this._hourOnly ? "hour" : want;
    const hourly = this._hourOnly || want === "hour";
    if (!hourly) return { slots: quarters, hourly };
    const groups = [];
    quarters.forEach((q) => {
      const g = groups[groups.length - 1];
      if (g && kairosSameHour(g[g.length - 1], q)) g.push(q);
      else groups.push([q]);
    });
    const avg = (g, k) => g.reduce((a, x) => a + x[k], 0) / g.length;
    const slots = groups.map((g) => ({
      start: g[0].start,
      end: g[g.length - 1].end,
      ms0: g[0].ms0,
      ms1: g[g.length - 1].ms1,
      hour: g[0].hour,
      minute: g[0].minute,
      e: avg(g, "e"),
      t: avg(g, "t"),
      sc: avg(g, "sc"),
      v: avg(g, "v"),
      price: avg(g, "price"),
    }));
    return { slots, hourly };
  }

  /** Unit and number formatting context; stores it in `this._p` and returns `{ ct, unit }`. */
  _modelUnit(pmax) {
    const cfg = this._config;
    const unitCfg = String(cfg.unit || "auto").trim();
    const auto = unitCfg.toLowerCase() === "auto";
    const ct = auto ? pmax < 1 : /^(ct|c|cent|cents|öre|ore|øre)(\/|$)/i.test(unitCfg);
    const unit = auto ? (ct ? "ct/kWh" : "EUR/kWh") : unitCfg;
    const code = String(ct ? cfg.currency || "EUR" : unit.split("/")[0])
      .trim()
      .toUpperCase();
    this._p = {
      ct,
      unit,
      code,
      dec: cfg.decimals === null || cfg.decimals === undefined ? null : cfg.decimals,
    };
    return { ct, unit };
  }

  /** Cheapest slots (heatmap view only; `_cheapest()` returns 0 in the other views) and their contiguous ranges. */
  _modelCheapest(slots, prices, hourly) {
    const count = prices.length;
    const cq = this._cheapest();
    const nc = cq > 0 ? (hourly ? Math.max(1, Math.round(cq / 4)) : cq) : 0;
    const sorted = [...prices].sort((a, b) => a - b);
    const thr = nc > 0 ? sorted[Math.min(nc, count) - 1] : -Infinity;
    // Exactly nc slots: ties at the threshold are resolved in favor of the earliest slots.
    const isCheap = prices.map(() => false);
    if (nc > 0) {
      prices
        .map((v, i) => i)
        .sort((a, b) => prices[a] - prices[b] || a - b)
        .slice(0, nc)
        .forEach((i) => (isCheap[i] = true));
    }
    const ranges = [];
    let rg = null;
    const flush = () => {
      if (rg) {
        ranges.push({
          range: this._stampMs(new Date(rg.st).getTime()) + " – " + this._stampMs(new Date(rg.en).getTime()),
          avg: rg.sm / rg.ct,
          sm: rg.sm,
          ct: rg.ct,
          ms0: rg.ms0,
          ms1: rg.ms1,
        });
      }
      rg = null;
    };
    slots.forEach((p, i) => {
      if (rg && p.ms0 - slots[i - 1].ms1 > 1000) flush();
      if (isCheap[i]) {
        if (!rg) rg = { st: p.start, en: p.end, ms0: p.ms0, ms1: p.ms1, sm: 0, ct: 0 };
        rg.en = p.end;
        rg.ms1 = p.ms1;
        rg.sm += prices[i];
        rg.ct += 1;
      } else flush();
    });
    flush();
    return { cq, nc, sorted, thr, isCheap, ranges };
  }

  /** Per-hour columns; the daily average is the mean of the hourly averages. */
  _modelColumns(slots, prices) {
    const cols = [];
    slots.forEach((sl, i) => {
      if (i > 0 && kairosSameHour(slots[i - 1], sl)) {
        const c = cols[cols.length - 1];
        c.size += 1;
        c.ms1 = sl.ms1;
        c.vals.push(prices[i]);
      } else
        cols.push({
          off: i,
          size: 1,
          hour: sl.hour,
          ms0: sl.ms0,
          ms1: sl.ms1,
          vals: [prices[i]],
        });
    });
    const avgs = cols.map((c) => c.vals.reduce((a, b) => a + b, 0) / c.vals.length);
    const av = avgs.reduce((a, b) => a + b, 0) / avgs.length;
    return { cols, av };
  }

  /** Breakdown layers: energy price, tax, surcharge, VAT (empty layers are skipped), with cumulative sums per slot. */
  _modelLayers(slots) {
    const L = KAIROS_LAYERS[this._scheme];
    const layers = [{ k: "e", c: L.e }];
    if (slots.some((s) => Math.abs(s.t) > 1e-9)) layers.push({ k: "t", c: L.t });
    if (slots.some((s) => Math.abs(s.sc) > 1e-9)) layers.push({ k: "sc", c: L.sc });
    if (slots.some((s) => Math.abs(s.v) > 1e-9)) layers.push({ k: "v", c: L.v });
    const cums = slots.map((s) => {
      const out = [0];
      let a = 0;
      layers.forEach((l) => {
        a += s[l.k];
        out.push(a);
      });
      return out;
    });
    return { L, layers, cums };
  }

  /** Heat scale: percentage difference relative to the daily average. */
  _modelHeat(prices, av, thr) {
    const P = KAIROS_HEAT[this._scheme];
    const pricePct = (v) => (!Number.isFinite(v) || !Number.isFinite(av) || av <= 0 ? null : ((v - av) / av) * 100);
    const pcts = prices.map(pricePct).filter((p) => p !== null && Number.isFinite(p));
    const minPct = pcts.length ? Math.min(...pcts) : 0;
    const maxPct = pcts.length ? Math.max(...pcts) : 0;
    // Cheapest = dark green, daily average = yellow (0%), most expensive = dark red.
    const colorAtPct = (pct) => {
      if (!Number.isFinite(pct)) return P.txt;
      if (Math.abs(maxPct - minPct) < 1e-9) return P.yellow;
      if (pct <= 0) {
        const range = Math.abs(minPct);
        if (range < 1e-9) return P.yellow;
        const t = Math.max(0, Math.min(1, (pct - minPct) / range));
        return t <= 0 ? P.dgreen : kairosInterpolateColor(P.dgreen, P.yellow, t);
      }
      if (maxPct < 1e-9) return P.yellow;
      const t = Math.max(0, Math.min(1, pct / maxPct));
      return t <= 0.5
        ? kairosInterpolateColor(P.yellow, P.mid, t * 2)
        : kairosInterpolateColor(P.mid, P.dred, (t - 0.5) * 2);
    };
    // Colors change in 1-percentage-point steps; the cheapest slots keep the purple highlight.
    const colorFor = (v) => {
      const pct = pricePct(v);
      if (pct === null) return P.txt;
      if (v <= thr) return P.cheap;
      return colorAtPct(Math.round(pct));
    };
    return { P, pricePct, minPct, maxPct, colorAtPct, colorFor };
  }

  /** Price bands (cheap / average / expensive): percentile based or configured thresholds. */
  _modelBands(sorted, prices) {
    const count = prices.length;
    const at = (f) => sorted[Math.min(count - 1, Math.floor(f * (count - 1)))];
    let lo = at(1 / 3);
    let hi = at(2 / 3);
    const pb = this._config.price_bands;
    if (Array.isArray(pb)) {
      lo = Number(pb[0]);
      hi = Number(pb[1]);
    } else if (pb && typeof pb === "object") {
      lo = Number(pb.low);
      hi = Number(pb.high);
    }
    const flat = hi - lo < 1e-9 && (pb === "auto" || pb === undefined);
    const bandOf = (v) => (flat ? "mid" : v <= lo ? "low" : v >= hi ? "high" : "mid");
    return { lo, hi, bands: prices.map(bandOf) };
  }

  /** Best window: the cheapest contiguous window of N hours (null when off or not available). */
  _modelBestWindow(slots, prices) {
    const count = prices.length;
    let best = null;
    const bh = this._n(this._config.best_window_hours, 0);
    const slotMs = slots[0].ms1 - slots[0].ms0;
    const nWin = bh > 0 ? Math.round((bh * 3600000) / slotMs) : 0;
    if (nWin > 0 && nWin <= count) {
      for (let i = 0; i + nWin <= count; i++) {
        if (Math.abs(slots[i + nWin - 1].ms1 - slots[i].ms0 - nWin * slotMs) > 1000) continue;
        let sum = 0;
        for (let j = i; j < i + nWin; j++) sum += prices[j];
        if (!best || sum / nWin < best.avg) best = { a: i, n: nWin, avg: sum / nWin, hours: bh };
      }
      if (best)
        best.range =
          this._stampMs(new Date(slots[best.a].start).getTime()) +
          " – " +
          this._stampMs(new Date(slots[best.a + nWin - 1].end).getTime());
    }
    return { best, slotMs };
  }

  /** Builds the width-independent data model. Returns null when the entity holds no usable prices. */
  _buildModel(st) {
    const cfg = this._config;
    const eff = this._eff();
    this._histPending = false;
    const src = this._modelRows(eff, st.attributes || {});
    if (!src) return null;
    const { list, spec } = src;
    this._kind = spec ? spec.kind : "hours";
    this._res = spec ? spec.res : "quarter";
    this._multi =
      !!spec &&
      (spec.kind !== "hours" ||
        this._key(this._ymd(new Date(spec.start))) !== this._key(this._ymd(new Date(spec.end))));

    const vatOn = eff.vat;
    const quarters = this._modelQuarters(list, vatOn);
    const { slots, hourly } = this._modelSlots(quarters, eff);

    const prices = slots.map((s) => s.price);
    const count = prices.length;
    let pmax = -Infinity;
    let pmin = Infinity;
    let minI = 0;
    let maxI = 0;
    prices.forEach((v, i) => {
      if (v > pmax) {
        pmax = v;
        maxI = i;
      }
      if (v < pmin) {
        pmin = v;
        minI = i;
      }
    });

    const { ct, unit } = this._modelUnit(pmax);

    // Contiguous runs: a gap in the data breaks lines and areas instead of being interpolated.
    const runs = [];
    slots.forEach((s, i) => {
      if (i === 0 || s.ms0 - slots[i - 1].ms1 > 1000) runs.push([i, i]);
      else runs[runs.length - 1][1] = i;
    });

    const { cq, nc, sorted, thr, isCheap, ranges } = this._modelCheapest(slots, prices, hourly);
    const { cols, av } = this._modelColumns(slots, prices);

    const fixedBase = this._n(cfg.fixed_price, NaN);
    const fixed = fixedBase > 0 ? this._price(fixedBase) : NaN;
    const hasFixed = Number.isFinite(fixed) && fixed > 0;

    const { L, layers, cums } = this._modelLayers(slots);
    const { P, pricePct, minPct, maxPct, colorAtPct, colorFor } = this._modelHeat(prices, av, thr);
    const { lo, hi, bands } = this._modelBands(sorted, prices);
    const { best, slotMs } = this._modelBestWindow(slots, prices);

    let cur = -1;
    if (eff.day === "today" || eff.range) {
      const now = Date.now();
      slots.forEach((p, i) => {
        if (p.ms0 <= now && now < p.ms1) cur = i;
      });
    }

    const brkLabels = {
      e: this._t("brk_e"),
      t: this._t("brk_t"),
      sc: this._t("brk_sc"),
      v: this._t("brk_v"),
    };
    const stacked = eff.view === "breakdown";
    return {
      eff,
      hourly,
      vatOn,
      quarters,
      slots,
      prices,
      count,
      pmin,
      pmax,
      minI,
      maxI,
      ct,
      unit,
      av,
      cur,
      runs,
      thr,
      isCheap,
      nc,
      cq,
      ranges,
      cols,
      fixed,
      hasFixed,
      layers,
      cums,
      stacked,
      bands,
      best,
      lo,
      hi,
      minPct,
      maxPct,
      colorAtPct,
      colorFor,
      pricePct,
      slotMs,
      P,
      L,
      brk: stacked ? layers.map((l) => ({ k: l.k, c: l.c, label: brkLabels[l.k] })) : [],
      slotWord: this._t(
        this._res === "month" ? "mo1" : this._res === "week" ? "w1" : this._res === "day" ? "d1" : hourly ? "h1" : "q1",
      ),
      slotPlural: this._t(
        this._res === "month" ? "mos" : this._res === "week" ? "ws" : this._res === "day" ? "ds" : hourly ? "hs" : "qs",
      ),
      range: eff.range,
      kind: this._kind,
      res: this._res,
      multi: this._multi,
      avgLabel: this._t(eff.range ? "avg_range" : "daily_avg"),
      vatLabel: this._t(vatOn ? "incl" : "bare"),
    };
  }

  /* ------------------------------------------------------------------ rendering */

  _renderOk(m, st) {
    this._m = m;
    this._rendered = true;
    this._el.root.classList.remove("busy");
    if (this._animate) {
      // Soft cross-fade of the content when the day or range changes.
      this._el.root.classList.remove("swap");
      void this._el.root.offsetWidth;
      this._el.root.classList.add("swap");
    }
    const cfg = this._config;
    const chart = cfg.show_chart ? this._chart(m) : { html: "", meta: null };
    m.meta = chart.meta;
    this._syncControls();
    const chartHtml =
      chart.html +
      `<div class="sr" id="sumdesc">${this._esc(this._summaryText(m))}</div>` +
      `<div class="sr" id="live" role="status" aria-live="polite"></div>`;
    this._setRegions({
      sum: this._summaryHtml(m),
      chart: chartHtml,
      stats: this._statsHtml(m),
      extra: this._extraHtml(m),
      data: this._dataHtml(m),
      foot: this._footHtml(m, st),
    });
    this._syncZoomUi();
    this._show(this._hover);
    this._prefetch();
  }

  /** Loads the neighbouring past days in the background, so stepping from day to day is instant. */
  _prefetch() {
    const eff = this._eff();
    if (eff.range) return;
    const p = this._dayParts(eff.day);
    const today = this._utc(this._ymd(new Date()));
    [-1, -2, -3, 1].forEach((off) => {
      const n = this._addDays(p, off);
      if (this._utc(n) < today) this._loadHours(this._key(n));
    });
  }

  _slotRange(s) {
    const a = new Date(s.start);
    const end = new Date(s.end);
    if (this._res === "week") {
      const last = new Date(end.getTime() - 36e5);
      const n = this._t("week_n", { n: this._weekNo(a.getTime()) });
      return `${n} \u00b7 ${this._stampMs(a.getTime())} \u2013 ${this._stampMs(last.getTime())}`;
    }
    if (this._kind === "months" || this._res === "day") return this._stampMs(a.getTime());
    return `${this._multi ? this._stampMs(a.getTime()) : this._hhmm(a)} \u2013 ${this._hhmm(end)}`;
  }

  _bandBadge(band) {
    const icon = band === "low" ? "arrowDown" : band === "high" ? "arrowUp" : "flat";
    return `<span class="badge band-${band}">${kairosIcon(icon)}${this._th("lvl_" + band)}</span>`;
  }

  /** Header summary: the current price as the hero, with unit, price band, and trend. */
  _summaryHtml(m) {
    const has = m.cur >= 0 && !m.range;
    const val = has ? m.prices[m.cur] : m.av;
    const cap = has ? this._nowText() : m.avgLabel;
    let chips = "";
    if (has) {
      chips += this._bandBadge(m.bands[m.cur]);
      if (m.cur + 1 < m.count) {
        const d = this._pctDiff(m.prices[m.cur + 1], val);
        if (d !== null) {
          const icon = d === 0 ? "flat" : d < 0 ? "arrowDown" : "arrowUp";
          chips +=
            `<span class="trend">${kairosIcon(icon)}${this._th(m.hourly ? "next_h" : "next_q")} ` +
            `${d === 0 ? "" : d < 0 ? "\u2212" : "+"}${this._pctText(d)}</span>`;
        }
      }
    }
    return (
      `<div class="cap" id="cap"${has ? ' data-live="1"' : ""}>${this._esc(cap)}</div>` +
      `<div class="price"><span class="big">${this._numText(val)}</span>` +
      `<span class="unit">${this._esc(m.unit)} \u00B7 ${this._esc(m.vatLabel)}</span></div>` +
      (chips
        ? `<div class="chips">${chips}</div>`
        : // Without a current slot (yesterday, tomorrow) an invisible row keeps the layout height identical.
          `<div class="chips" aria-hidden="true" style="visibility:hidden"><span class="badge">&nbsp;</span></div>`)
    );
  }

  /** Pill with the difference to the daily average: icon + percentage + words (never color alone). */
  _deltaHtml(v, m) {
    const d = this._pctDiff(v, m.av);
    if (d === null) return "";
    if (d === 0)
      return `<span class="pill" style="--pc:var(--label2)">${kairosIcon("flat")}${this._th("equal")}</span>`;
    return (
      `<span class="pill" ` +
      `style="--pc:var(${d < 0 ? "--green" : "--red"})">${kairosIcon(d < 0 ? "arrowDown" : "arrowUp")}` +
      `${this._pctText(d)} ${this._th(d < 0 ? "below" : "above")}</span>`
    );
  }

  _statsHtml(m) {
    const cfg = this._config;
    if (cfg.show_stats === false || cfg.show_legend === false) return "";
    // Tile: round icon badge + label, large value with unit, a caption, and a delta pill.
    const tile = (c, icon, label, v, caption, note) => {
      const [num, unit] = this._valueParts(v);
      return (
        `<div class="stat" style="--c:${c}"><div class="sl"><span class="sic">${kairosIcon(icon)}</span>` +
        `<span class="slt">${this._esc(label)}</span></div><div class="sb">` +
        `<div class="sv">${this._esc(num)}${unit ? `<span class="su">${this._esc(unit)}</span>` : ""}</div>` +
        `<div class="sx">${this._esc(caption)}</div>${note ? `<div class="sn">${note}</div>` : ""}</div></div>`
      );
    };
    const at = (i) => this._stampMs(new Date(m.slots[i].start).getTime());
    // Percentage pills are only shown in the breakdown view.
    const note = (v) => (m.stacked ? this._deltaHtml(v, m) : "");
    const tiles = [
      tile(m.P.dgreen, "arrowDown", this._t("lowest"), m.pmin, at(m.minI), note(m.pmin)),
      tile(m.P.yellow, "flat", m.avgLabel, m.av, this._t("all_slots", { slot: m.slotPlural }), note(m.av)),
      tile(m.P.dred, "arrowUp", this._t("highest"), m.pmax, at(m.maxI), note(m.pmax)),
    ];
    if (m.hasFixed) {
      tiles.push(
        tile(m.L.fixed, "euro", cfg.fixed_label || this._t("fixed_label"), m.fixed, this._t("fixed"), note(m.fixed)),
      );
    }
    const big = this._mode === "large" || this._mode === "kiosk";
    const cols = big || (this._mode === "compact" && tiles.length > 3) ? 2 : tiles.length;
    return (
      `<div class="sgrid" data-c="${cols}" style="--cols:${cols}" role="group" ` +
      `aria-label="${this._esc(this._t("average"))}">${tiles.join("")}</div>`
    );
  }

  _extraHtml(m) {
    const cfg = this._config;
    let out = "";
    const rows = [];
    if (cfg.show_legend !== false && m.eff.heat && m.nc > 0 && m.ranges.length) rows.push(this._cheapestHtml(m));
    if (m.best) {
      rows.push(
        `<div><div class="grp"><div class="row"><span class="sq" style="background:var(--accent)"></span>` +
          `<span>${this._esc(this._t("best", { n: this._nf(0, 2).format(m.best.hours) }))}<div class="n">` +
          `${this._esc(m.best.range)}</div></span><span class="v">${this._esc(this._fmt(m.best.avg))}</span></div>` +
          `</div></div>`,
      );
    }
    return out + rows.join("");
  }

  /** Duration as "5 h", "1 h 15 min", or "15 min", rounded up to whole minutes. */
  _durText(ms) {
    const min = Math.max(1, Math.ceil(ms / 60000 - 1e-9));
    const h = Math.floor(min / 60);
    const mm = min % 60;
    return [h ? `${h} h` : "", mm ? `${mm} min` : ""].filter(Boolean).join(" ");
  }

  /**
   * Cheapest summary: total time and average price of the cheapest slots, the next (or current) window as a
   * highlighted card, and the other windows as chips. Other days show their first window without a countdown.
   */
  _cheapestHtml(m) {
    const esc = (s) => this._esc(s);
    // Same notation as the tiles: the number with the unit (ct/kWh) in a smaller size.
    const price = (v) => {
      const [num, unit] = this._valueParts(v);
      return esc(num) + (unit ? `<span class="cs-u">${esc(unit)}</span>` : "");
    };
    const x = m.hourly ? this._cheapestHours(m.nc) : this._cheapestQuarters(m.cq);
    const rg = m.ranges;
    const total = rg.reduce((a, r) => a + (r.ms1 - r.ms0), 0);
    const count = rg.reduce((a, r) => a + r.ct, 0);
    const avg = rg.reduce((a, r) => a + r.sm, 0) / count;
    const live = m.eff.day === "today";
    const now = Date.now();
    // Today: the first window that has not ended yet. Other days: the first window.
    const ni = live ? rg.findIndex((r) => r.ms1 > now) : 0;
    const next = ni >= 0 ? rg[ni] : null;
    const earlier = rg.slice(0, ni >= 0 ? ni : rg.length);
    const later = ni >= 0 ? rg.slice(ni + 1) : [];

    let card = "";
    if (next) {
      let label = esc(this._t("win_first"));
      let countdown = "";
      if (live) {
        const active = next.ms0 <= now;
        const key = active ? "win_now" : "win_in";
        const target = active ? next.ms1 : next.ms0;
        label = esc(this._t(active ? "win_active" : "win_next"));
        countdown =
          `<div class="cs-nc" id="cd" data-k="${key}" data-t="${target}">` +
          `${esc(this._t(key, { t: this._durText(target - now) }))}</div>`;
      }
      card =
        `<div class="cs-next" style="--c:${m.P.cheap}"><div><div class="cs-nl">${label}</div>` +
        `<div class="cs-nr">${esc(next.range)}</div>${countdown}</div><div class="cs-na">` +
        `<div class="cs-nv">${price(next.avg)}</div>` +
        `<div class="cs-nd">${esc(this._durText(next.ms1 - next.ms0))}</div></div></div>`;
    }
    const chips = (title, list) =>
      list.length
        ? `<div><div class="cs-gl">${esc(this._t(title))}</div><div class="cs-chips">` +
          list.map((r) => `<span class="cs-chip"><span>${esc(r.range)}</span><b>${price(r.avg)}</b></span>`).join("") +
          `</div></div>`
        : "";
    return (
      `<div class="csum" role="group" aria-label="${esc(this._t("cheapest_x", { x }))}">` +
      `<div class="sh">${esc(this._t("cheapest_x", { x }))}</div>` +
      `<div class="cs-top"><div class="cs-k"><div class="cs-c">${esc(this._t("win_total"))}</div>` +
      `<div class="cs-dur">${esc(this._durText(total))}</div></div><div class="cs-k">` +
      `<div class="cs-c">${esc(this._t("win_avg"))}</div><div class="cs-v">${price(avg)}</div>` +
      `${this._deltaHtml(avg, m)}</div></div>` +
      card +
      chips("win_earlier", earlier) +
      chips("win_later", later) +
      `</div>`
    );
  }

  _cheapestHours(n) {
    return n + " " + this._t(n === 1 ? "h1" : "hs");
  }

  _cheapestQuarters(n) {
    return `${n} ${this._t(n === 1 ? "q1" : "qs")} (${this._durText(n * 15 * 60000)})`;
  }

  _footHtml(m, st) {
    const parts = [];
    const lu = st.last_updated ? new Date(st.last_updated) : null;
    if (lu && Number.isFinite(lu.getTime()))
      parts.push(`<span>${this._esc(this._t("updated", { time: this._hhmm(lu) }))}</span>`);
    const now = Date.now();
    const stale =
      (m.eff.day === "today" && now >= m.slots[m.count - 1].ms1) ||
      (!this._histKey(m.eff.day) && lu && Number.isFinite(lu.getTime()) && now - lu.getTime() > 30 * 3600000) ||
      st.state === "unavailable";
    if (stale) parts.push(`<span class="stale">${kairosIcon("warn")}${this._th("stale")}</span>`);
    // "Show data" is only offered in the breakdown view; the table stays available to screen readers everywhere.
    if (this._mode !== "kiosk" && m.stacked) {
      parts.push(
        `<button type="button" class="lnk" data-act="data" aria-expanded="${this._showData}" aria-controls="dtbl">` +
          `${kairosIcon("table")}${this._th(this._showData ? "hide_data" : "show_data")}</button>`,
      );
    }
    if (this._config.edit_link && this._canEdit()) {
      parts.push(`<button type="button" class="lnk edit" data-act="edit">${this._esc(this._t("edit_link"))}</button>`);
    }
    return parts.join("");
  }

  /** Price tables (price view) and the accessible data table. */
  _dataHtml(m) {
    return this._tablesHtml(m) + this._dataTableHtml(m);
  }

  _dataTableHtml(m) {
    const cols = m.stacked ? m.brk : [];
    const head =
      `<th scope="col">${this._th("col_time")}</th><th scope="col">${this._th("col_price")}</th>` +
      (cols.length
        ? cols.map((c) => `<th scope="col">${this._esc(c.label)}</th>`).join("")
        : `<th scope="col">${this._th("col_level")}</th>`);
    const body = m.slots
      .map((s, i) => {
        const extra = cols.length
          ? cols.map((c) => `<td>${this._numText(s[c.k])}</td>`).join("")
          : `<td>${this._th("lvl_" + m.bands[i])}</td>`;
        return (
          `<tr><th scope="row">${this._esc(this._slotRange(s))}</th>` +
          `<td>${this._numText(m.prices[i])}</td>${extra}</tr>`
        );
      })
      .join("");
    return (
      `<div class="dt${this._showData && m.stacked ? "" : " sr"}" id="dtbl"><table><caption>` +
      `${this._esc(this._t("data_cap", { day: this._dayName(m.eff.day) }) + " (" + m.unit + ")")}</caption>` +
      `<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`
    );
  }

  /** Price view: three tables (off-peak 1, peak, off-peak 2); rows = clock hours, columns = quarters. */
  _tablesHtml(m) {
    // The off-peak / peak tables belong to the breakdown view of a single day.
    if (m.eff.view !== "breakdown" || m.range) return "";
    const q = m.quarters;
    const qHours = [];
    q.forEach((x, i) => {
      const g = qHours[qHours.length - 1];
      if (g && kairosSameHour(q[g[g.length - 1]], x)) g.push(i);
      else qHours.push([i]);
    });
    const qRows = Math.max(1, Math.min(4, ...qHours.map((g) => g.length)));
    const qp = q.map((x) => x.price);
    const qLo = Math.min(...qp);
    const qHi = Math.max(...qp);
    let nowQ = -1;
    if (m.eff.day === "today") {
      const t = Date.now();
      q.forEach((x, i) => {
        if (x.ms0 <= t && t < x.ms1) nowQ = i;
      });
    }
    const cellText = (v) => (m.ct && v >= 1 ? this._nf(2, 2).format(v) : this._numText(v));
    const tzn = this._tzName(new Date(q[0].start));
    const periods = [
      { id: "off1", title: this._t("off1"), from: 0, to: 8 },
      { id: "peak", title: this._t("peak"), from: 8, to: 20 },
      { id: "off2", title: this._t("off2"), from: 20, to: 24 },
    ];
    const head = Array.from({ length: qRows }, (_, k) => `<th scope="col">:${this._pad(k * 15)}</th>`).join("");
    const html = periods
      .map((pr) => {
        const groups = qHours
          .map((g, hi) => ({ g, hi }))
          .filter(({ g }) => q[g[0]].hour >= pr.from && q[g[0]].hour < pr.to);
        if (!groups.length) return "";
        const vals = groups.flatMap(({ g }) => g.map((i) => qp[i]));
        const avgV = vals.reduce((a, b) => a + b, 0) / vals.length;
        const rowsHtml = groups
          .map(({ g, hi }) => {
            const cells = Array.from({ length: qRows }, (_, k) => {
              const qi = g[k];
              if (qi === undefined) return "<td></td>";
              const v = qp[qi];
              const spread = qHi - qLo > 1e-9;
              const cls = qi === nowQ ? "now" : spread && v === qLo ? "min" : spread && v === qHi ? "max" : "";
              const name =
                this._hhmm(new Date(q[qi].start)) + ", " + this._fmt(v) + (qi === nowQ ? ", " + this._t("now") : "");
              const text = qi === nowQ ? `<b>${cellText(v)}</b>` : cellText(v);
              return (
                `<td class="${cls}" data-s="${m.hourly ? hi : qi}" tabindex="0" ` +
                `aria-label="${this._esc(name)}">${text}</td>`
              );
            }).join("");
            return (
              `<tr class="${g.includes(nowQ) ? "nowrow" : ""}"><th ` +
              `scope="row">${this._pad(q[g[0]].hour)}${this._dstMark(new Date(q[g[0]].start))}</th>${cells}</tr>`
            );
          })
          .join("");
        return (
          `<section class="tbl"><header><div><div class="tt" id="kairos-t-${pr.id}">${this._esc(pr.title)}</div>` +
          `<div class="ts">${this._pad(pr.from)}:00 \u2013 ${this._pad(pr.to % 24)}:00 ${this._esc(tzn)}</div></div>` +
          `<div class="ta">${this._th("average")} <b>${this._esc(this._fmtU(avgV))}</b></div></header>` +
          `<table aria-labelledby="kairos-t-${pr.id}"><thead><tr><th scope="col">${this._th("hour")}</th>${head}</tr>` +
          `</thead>` +
          `<tbody>${rowsHtml}</tbody></table></section>`
        );
      })
      .join("");
    return `<div class="tables">${html}</div>`;
  }

  _summaryText(m) {
    const now =
      m.cur >= 0
        ? this._t("sum_now", {
            price: this._fmt(m.prices[m.cur]),
            level: this._t("lvl_" + m.bands[m.cur]),
          })
        : "";
    return this._t("summary", {
      day: this._dayName(m.eff.day),
      vat: m.vatLabel,
      slot: m.slotWord,
      lo: this._fmt(m.pmin),
      lot: this._stampMs(new Date(m.slots[m.minI].start).getTime()),
      hi: this._fmt(m.pmax),
      hit: this._stampMs(new Date(m.slots[m.maxI].start).getTime()),
      av: this._fmt(m.av),
      avl: m.avgLabel,
      now,
    });
  }

  /** Nice-number tick algorithm in display units. */
  _niceTicks(lo, hi, maxN) {
    const rough = (hi - lo) / Math.max(1, maxN - 1);
    const mag = Math.pow(10, Math.floor(Math.log10(rough)));
    const norm = rough / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    const a = Math.floor(lo / step + 1e-9);
    const b = Math.ceil(hi / step - 1e-9);
    const ticks = [];
    for (let i = a; i <= b; i++) ticks.push(Math.round(i * step * 1e9) / 1e9);
    if (ticks.length < 2) ticks.push(ticks[0] + step);
    const s = String(Math.round(step * 1e9) / 1e9);
    return {
      ticks,
      dec: s.includes(".") ? Math.min(4, s.split(".")[1].length) : 0,
    };
  }

  /** Zoom window on the time axis: a fraction [a, b] of the full span; it resets when the view changes. */
  _chartZoomView(m) {
    const { slots, count, eff } = m;
    const tFull0 = slots[0].ms0;
    const tFull1 = slots[count - 1].ms1;
    const zsig = [eff.day, eff.view, this._rangeOffset(), eff.period, count, tFull0].join("|");
    if (!this._config.zoom_desktop && !this._config.zoom_touch) this._zoom = null;
    if (zsig !== this._zoomSig) {
      this._zoomSig = zsig;
      this._zoom = null;
    }
    const z = this._zoom;
    const vT0 = z ? tFull0 + z.a * (tFull1 - tFull0) : tFull0;
    const vT1 = z ? tFull0 + z.b * (tFull1 - tFull0) : tFull1;
    let v0 = 0;
    let v1 = count - 1;
    if (z) {
      v0 = Math.max(
        0,
        slots.findIndex((x) => x.ms1 > vT0),
      );
      for (let i = count - 1; i >= 0; i--) {
        if (slots[i].ms0 < vT1) {
          v1 = i;
          break;
        }
      }
      v1 = Math.max(v0, v1);
    }
    return { z, tFull0, tFull1, vT0, vT1, v0, v1 };
  }

  /** Everything the chart parts share: zoom, style, y scale, pixel geometry, and coordinate helpers. */
  _chartContext(m) {
    const cfg = this._config;
    const k = this._k;
    const W = this._cw;
    const mode = this._mode;
    const { slots, prices, count, eff, P, L } = m;
    const heat = eff.heat;
    const { z, tFull0, tFull1, vT0, vT1, v0, v1 } = this._chartZoomView(m);

    // Resolve the chart style; "auto" prefers bars while a bar is at least 3 px wide.
    const style = eff.style === "auto" ? ((W - 48 * k) / count >= 3 ? "bar" : "line") : eff.style;
    this._resolvedStyle = style;
    const type = m.stacked ? "stacked_" + style : style;
    const stacked = m.stacked;
    const showAvg = !stacked && cfg.show_average_line !== false;
    const showFixed = !stacked && m.hasFixed && cfg.show_fixed_line !== false;
    const ch = { compact: 200, regular: 260, large: 340, kiosk: 420 }[mode];
    const label = this._t("chart_name", {
      day: this._dayName(eff.day),
      vat: m.vatLabel,
    });

    // Y domain in display units: bars and lines share the same scale (it follows the data).
    const du = m.ct ? 100 : 1;
    const visVals = z ? (stacked ? m.cums.slice(v0, v1 + 1).flat() : prices.slice(v0, v1 + 1)) : null;
    let lo = z ? Math.min(...visVals) : stacked ? Math.min(...m.cums.flat()) : m.pmin;
    let hi = z ? Math.max(...visVals) : stacked ? Math.max(...m.cums.flat()) : m.pmax;
    if (showFixed) {
      lo = Math.min(lo, m.fixed);
      hi = Math.max(hi, m.fixed);
    }
    let a = lo * du;
    let b = hi * du;
    if (!(b - a > 1e-9)) b = a + (Math.abs(a) * 0.1 || 1);
    const nice = this._niceTicks(a, b, kairosClamp(Math.floor(ch / (44 * k)), 3, 7));
    const ylo = nice.ticks[0] / du;
    const yhi = nice.ticks[nice.ticks.length - 1] / du;
    const yspan = yhi - ylo;
    const tickLabels = nice.ticks.map((v) => this._nf(nice.dec, nice.dec).format(v));

    // Geometry: real pixels, so text keeps its size and scales with the user's text settings.
    const labW = (this._hourLabel(new Date(slots[0].ms0)).length * 6.8 + 6) * k;
    const ml = Math.ceil(Math.max(28 * k, Math.max(...tickLabels.map((s) => s.length)) * 7.2 * k + 12 * k));
    const mr = Math.ceil(Math.max(10 * k, labW / 2));
    const pw = Math.max(40, W - ml - mr);
    const mt = Math.round(30 * k);
    const base = mt + ch;
    const t0 = vT0;
    const tEnd = vT1;
    const tspan = Math.max(1, tEnd - t0);
    const X = (ms) => ml + ((ms - t0) / tspan) * pw;
    const xs = slots.map((s) => X(s.ms0));
    const xe = slots.map((s) => X(s.ms1));
    const cx = (i) => (xs[i] + xe[i]) / 2;
    const inView = (x) => x >= ml - 0.5 && x <= ml + pw + 0.5;
    const yOf = (v) => base - ((v - ylo) / yspan) * ch;
    const hasZero = ylo <= 0 && yhi >= 0;
    const yZero = hasZero ? yOf(0) : base;

    // Adaptive tick density: the smallest step in hours whose labels do not overlap.
    const pxPerHour = pw / Math.max(1, tspan / 3600000);
    // Labels every 2 hours (wider steps only when they would overlap); a small tick marks every other hour.
    const every = (z ? [1, 2, 3, 4, 6, 8, 12] : [2, 3, 4, 6, 8, 12]).find((n) => n * pxPerHour >= labW + 10 * k) || 12;
    const cur = m.cur;
    const solid = cfg.heat_gradient === "vertical";
    return {
      cfg,
      k,
      W,
      m,
      slots,
      prices,
      count,
      eff,
      P,
      L,
      heat,
      z,
      tFull0,
      tFull1,
      vT0,
      vT1,
      v0,
      v1,
      type,
      stacked,
      showAvg,
      showFixed,
      ch,
      label,
      du,
      lo,
      hi,
      nice,
      ylo,
      yhi,
      yspan,
      tickLabels,
      labW,
      ml,
      mr,
      pw,
      mt,
      base,
      tEnd,
      X,
      xs,
      xe,
      cx,
      inView,
      yOf,
      yZero,
      every,
      cur,
      showNow: cfg.show_now_marker !== false && cur >= 0,
      enter: this._animate ? ' class="enter" style="transform-origin:0 ' + yZero + 'px"' : "",
      // "vertical": bars get one solid color by price; a line blends the colors of its points from left to right.
      solid,
      slotColor: (v) => {
        const pct = m.pricePct(v);
        return m.colorAtPct(pct === null ? 0 : Math.round(pct));
      },
      vclip: z ? ' clip-path="url(#kairos-view)"' : "",
      unitW: m.unit.length * 6.6 * k,
    };
  }

  /** Gradient shared by bars and lines in the heatmap view. */
  _chartGradient(c) {
    const { m, heat, type, solid, prices, xs, xe, ml, pw, base, ch, ylo, yspan, slotColor } = c;
    if (!(heat && (type === "bar" || type === "line") && !(solid && type === "bar"))) return "";
    let stops = "";
    let dir = `x1="0" y1="${base}" x2="0" y2="${base - ch}"`;
    if (solid) {
      // Line, vertical mode: one stop per slot, at its x position.
      dir = `x1="${ml}" y1="0" x2="${ml + pw}" y2="0"`;
      prices.forEach((v, i) => {
        const f = kairosClamp(((xs[i] + xe[i]) / 2 - ml) / pw, 0, 1);
        stops += `<stop offset="${f}" stop-color="${slotColor(v)}"/>`;
      });
    } else {
      for (let n = 0; n <= 32; n++) {
        const f = n / 32;
        const pct = m.pricePct(ylo + f * yspan);
        stops += `<stop offset="${f}" stop-color="${m.colorAtPct(pct === null ? 0 : pct)}"/>`;
      }
    }
    return (
      `<defs><linearGradient id="kairos-grad" gradientUnits="userSpaceOnUse" ${dir}>` +
      `${stops}</linearGradient></defs>`
    );
  }

  /** Zoom clip path, axis unit, horizontal and hour grid, and the best window highlight behind the data. */
  _chartFrame(c) {
    const { m, k, z, slots, xs, xe, ml, pw, mt, base, ch, nice, du, tickLabels, yOf, inView, vclip, cfg } = c;
    let s = "";
    if (z) {
      s +=
        `<defs><clipPath id="kairos-view"><rect x="${ml}" y="${mt - 12 * k}" width="${pw}" ` +
        `height="${ch + 12 * k + 2}"/></clipPath></defs>`;
    }
    // Axis unit and horizontal grid with few, rounded ticks.
    s += `<text class="ax" x="0" y="${14 * k}">${this._esc(m.unit)}</text>`;
    nice.ticks.forEach((v, n) => {
      const gy = yOf(v / du);
      s +=
        `<line class="grid" x1="${ml}" x2="${ml + pw}" y1="${gy}" y2="${gy}"/>` +
        `<text class="ax" x="${ml - 6 * k}" y="${gy + 4 * k}" text-anchor="end">${tickLabels[n]}</text>`;
    });
    if (cfg.show_hour_grid && m.kind === "hours") {
      slots.forEach((p, i) => {
        if (i > 0 && p.minute === 0 && inView(xs[i]))
          s += `<line class="grid" x1="${xs[i]}" x2="${xs[i]}" y1="${mt}" y2="${base}"/>`;
      });
    }
    // Best window highlight (cheapest contiguous N hours) behind the data.
    if (m.best) {
      const bx0 = xs[m.best.a];
      const bx1 = xe[m.best.a + m.best.n - 1];
      s +=
        `<rect class="win"${vclip} x="${bx0}" y="${mt}" width="${Math.max(1, bx1 - bx0)}" height="${ch}" ` +
        `rx="${4 * k}"/>`;
    }
    return s;
  }

  /** Shared path helpers for bars and lines, bound to the pixel positions of the chart. */
  _chartPaths(c) {
    const { xs, xe, cx } = c;
    return {
      stepSeg: (ys, i, color) => {
        const step = i > 0 && xs[i] - xe[i - 1] < 1 ? `M${xs[i]},${ys[i - 1]} V${ys[i]}` : `M${xs[i]},${ys[i]}`;
        return `<path d="${step} H${xe[i]}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>`;
      },
      // Points of one run, extended flat to the run edges so areas start and end at the slot boundaries.
      edgePts: (ys, ra, rb) => {
        const out = [[xs[ra], ys[ra]]];
        for (let i = ra; i <= rb; i++) out.push([cx(i), ys[i]]);
        out.push([xe[rb], ys[rb]]);
        return out;
      },
    };
  }

  /** Bars of one price per slot. */
  _chartBars(c, p) {
    const { m, k, z, prices, count, xs, xe, pw, yOf, yZero, heat, solid, slotColor, L, P, vT0, vT1, tFull0, tFull1 } =
      c;
    const opBar = this._opacity(heat ? "heatmap_bar_opacity" : "price_bar_opacity");
    const fixedFill = m.vatOn ? L.v : L.vatOff;
    const gapPx = this._chartGap(c);
    const barFill = (i, v) =>
      m.isCheap[i] ? P.cheap : heat ? (solid ? slotColor(v) : "url(#kairos-grad)") : fixedFill;
    let data = "";
    if (opBar <= 0) {
      const tops = prices.map(yOf);
      prices.forEach((v, i) => (data += p.stepSeg(tops, i, barFill(i, v))));
    } else {
      prices.forEach((v, i) => {
        const w = Math.max(1, xe[i] - xs[i] - gapPx);
        data +=
          `<path class="bar-el" d="${kairosBarPath(xs[i] + gapPx / 2, w, yOf(v), yZero, k)}" fill="${barFill(i, v)}" ` +
          `fill-opacity="${opBar}"/>`;
      });
    }
    return data;
  }

  /** Gap between bars in pixels, from the slot pitch. */
  _chartGap(c) {
    const { z, pw, count, vT0, vT1, tFull0, tFull1 } = c;
    const pitch = pw / Math.max(1, z ? ((vT1 - vT0) / (tFull1 - tFull0)) * count : count);
    return pitch > 6 ? 1.5 : pitch > 3 ? 1 : 0.5;
  }

  /** Stacked bars: one segment per price layer. */
  _chartStackedBars(c, p) {
    const { m, xs, xe, yOf } = c;
    const opBrkBar = this._opacity("breakdown_bar_opacity");
    const gapPx = this._chartGap(c);
    let data = "";
    if (opBrkBar <= 0) {
      m.layers.forEach((l, n) => {
        const tops = m.cums.map((cum) => yOf(cum[n + 1]));
        m.cums.forEach((cum, i) => (data += p.stepSeg(tops, i, l.c)));
      });
    } else {
      m.cums.forEach((cum, i) => {
        const w = Math.max(1, xe[i] - xs[i] - gapPx);
        for (let n = 1; n < cum.length; n++) {
          const yt = yOf(Math.max(cum[n - 1], cum[n]));
          const yb = yOf(Math.min(cum[n - 1], cum[n]));
          data +=
            `<rect class="bar-el" x="${xs[i] + gapPx / 2}" y="${yt}" width="${w}" ` +
            `height="${Math.max(yb - yt, 0.5)}" fill="${m.layers[n - 1].c}" fill-opacity="${opBrkBar}"/>`;
        }
      });
    }
    return data;
  }

  /** Line with a soft area; the cheapest runs are drawn in the highlight color. */
  _chartLine(c, p) {
    const { m, k, heat, prices, count, xs, xe, yOf, yZero, mt, base, L, P } = c;
    const opLine = this._opacity(heat ? "heatmap_line_opacity" : "price_line_opacity");
    const fixedFill = m.vatOn ? L.v : L.vatOff;
    const ys = prices.map(yOf);
    const paint = heat ? "url(#kairos-grad)" : fixedFill;
    const cheapRuns = [];
    const otherRuns = [];
    let st = -1;
    let want = null;
    prices.forEach((v, i) => {
      const isCheap = m.isCheap[i];
      if (st >= 0 && (isCheap !== want || i === 0)) {
        (want ? cheapRuns : otherRuns).push([st, i - 1]);
        st = -1;
      }
      if (st < 0) {
        st = i;
        want = isCheap;
      }
    });
    if (st >= 0) (want ? cheapRuns : otherRuns).push([st, count - 1]);
    // Price view: the area fades from the line color to transparent (a soft gradient, as in Apple charts).
    const fade = !heat && opLine > 0;
    const areaFill = (color) =>
      fade
        ? `fill="url(#${color === P.cheap ? "kairos-area-c" : "kairos-area"})"`
        : `fill="${color}" fill-opacity="${opLine}"`;
    let data = "";
    if (fade) {
      const grad = (id, color) =>
        `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" ` +
        `stop-opacity="${Math.min(0.9, opLine + 0.15)}"/><stop offset="1" stop-color="${color}" ` +
        `stop-opacity="0.03"/>` +
        `</linearGradient>`;
      data += `<defs>${grad("kairos-area", paint)}${grad("kairos-area-c", P.cheap)}</defs>`;
    }
    const shape = (color, clip) => {
      const cp = clip ? ` clip-path="url(#${clip})"` : "";
      let out = "";
      m.runs.forEach(([ra, rb]) => {
        const pts = p.edgePts(ys, ra, rb);
        const area =
          `M${pts[0][0]},${yZero} L${pts[0][0]},${pts[0][1]}${kairosCurve(pts, false)} ` +
          `L${pts[pts.length - 1][0]},${yZero} Z`;
        out +=
          `<path d="${area}" ${areaFill(color)}${cp}/>` +
          `<path d="${kairosCurve(pts)}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" ` +
          `stroke-linecap="round"${cp}/>`;
      });
      return out;
    };
    const clipRects = (rs) =>
      rs
        .map(([ra, rb]) => `<rect x="${xs[ra]}" y="${mt - 10}" width="${xe[rb] - xs[ra]}" height="${base - mt + 11}"/>`)
        .join("");
    if (cheapRuns.length) {
      data +=
        `<defs><clipPath id="kairos-clip-n">${clipRects(otherRuns)}</clipPath>` +
        `<clipPath id="kairos-clip-c">${clipRects(cheapRuns)}</clipPath></defs>` +
        shape(paint, "kairos-clip-n") +
        shape(P.cheap, "kairos-clip-c");
    } else data += shape(paint, null);
    return data;
  }

  /** Stacked lines: one filled band and one outline per price layer. */
  _chartStackedLines(c, p) {
    const { m, yOf } = c;
    const opBrkLine = this._opacity("breakdown_line_opacity");
    let data = "";
    m.layers.forEach((l, n) => {
      const ysT = m.cums.map((cum) => yOf(cum[n + 1]));
      const ysB = m.cums.map((cum) => yOf(cum[n]));
      m.runs.forEach(([ra, rb]) => {
        const top = p.edgePts(ysT, ra, rb);
        const bottom = p.edgePts(ysB, ra, rb).reverse();
        data +=
          `<path d="${kairosCurve(top)} L${bottom[0][0]},${bottom[0][1]}${kairosCurve(bottom, false)} Z" ` +
          `fill="${l.c}" fill-opacity="${opBrkLine}"/>`;
      });
    });
    m.layers.forEach((l, n) => {
      const ysT = m.cums.map((cum) => yOf(cum[n + 1]));
      m.runs.forEach(([ra, rb]) => {
        data +=
          `<path d="${kairosCurve(p.edgePts(ysT, ra, rb))}" fill="none" stroke="${l.c}" stroke-width="2" ` +
          `stroke-linejoin="round" stroke-linecap="round"/>`;
      });
    });
    return data;
  }

  /** The data marks (bars or lines) of the selected chart type. */
  _chartMarks(c) {
    const p = this._chartPaths(c);
    if (c.type === "bar") return this._chartBars(c, p);
    if (c.type === "stacked_bar") return this._chartStackedBars(c, p);
    if (c.type === "line") return this._chartLine(c, p);
    if (c.type === "stacked_line") return this._chartStackedLines(c, p);
    return "";
  }

  /** Past veil, reference lines (daily average, fixed rate), zero line, and the base axis. */
  _chartRules(c) {
    const { m, cfg, ml, pw, mt, ch, base, xs, cur, yOf, yZero, ylo, L, showAvg, showFixed } = c;
    let s = "";
    // Past intervals at reduced emphasis.
    if (m.eff.day === "today" && cur > 0) {
      s +=
        `<rect class="veil" x="${ml}" y="${mt - 2}" width="${kairosClamp(xs[cur] - ml, 0, pw)}" ` +
        `height="${ch + 2}"/>`;
    }
    // Reference lines: daily average (dashed rule) and Fixed rate (dotted).
    if (showAvg) {
      const ay = yOf(m.av);
      const aw = { small: 1.25, medium: 2.5, large: 4 }[cfg.average_line_size] || 1.25;
      s += `<line class="ref" x1="${ml}" x2="${ml + pw}" y1="${ay}" y2="${ay}" style="stroke-width:${aw}"/>`;
    }
    if (showFixed) {
      const fy = yOf(m.fixed);
      const fw = { small: 2, medium: 3.5, large: 5 }[cfg.fixed_line_size] || 2;
      s +=
        `<line x1="${ml}" x2="${ml + pw}" y1="${fy}" y2="${fy}" stroke="${L.fixed}" stroke-width="${fw}" ` +
        `stroke-dasharray="0.1 ${fw * 2.5}" stroke-linecap="round"/>`;
    }
    if (ylo < 0) s += `<line class="zero" x1="${ml}" x2="${ml + pw}" y1="${yZero}" y2="${yZero}"/>`;
    s += `<line class="axis" x1="${ml}" x2="${ml + pw}" y1="${base}" y2="${base}"/>`;
    return s;
  }

  /** Time axis: hour labels at adaptive density, or day, week, and month labels for longer periods. */
  _chartTimeAxis(c) {
    const { m, k, z, slots, count, xs, xe, ml, pw, base, every, tEnd, inView, cx } = c;
    let s = "";
    const tickAt = (x, date) =>
      `<line class="axis" x1="${x}" x2="${x}" y1="${base}" y2="${base + 4 * k}"/>` +
      `<text class="ax" x="${x}" y="${base + 18 * k}" ` +
      `text-anchor="middle">${this._esc(this._hourLabel(date))}</text>`;
    if (m.kind === "hours") {
      slots.forEach((p, i) => {
        if (!inView(xs[i])) return;
        if (p.minute === 0 && p.hour % every !== 0) {
          s += `<line class="axis" x1="${xs[i]}" x2="${xs[i]}" y1="${base}" y2="${base + 3 * k}"/>`;
        }
        if (p.minute === 0 && p.hour % every === 0) s += tickAt(xs[i], new Date(p.ms0));
      });
      const endParts = this._localParts(new Date(tEnd));
      if (!z && endParts.minute === 0 && endParts.hour % every === 0) s += tickAt(xe[count - 1], new Date(tEnd));
      return s;
    }
    // Multi-day ranges: labels at the start of days (or the middle of day and month bars), at adaptive density.
    const starts = [];
    slots.forEach((p, i) => {
      if (z && !(xe[i] > ml && xs[i] < ml + pw)) return;
      if (m.kind === "months" || m.res === "day" || m.res === "week" || (p.hour === 0 && p.minute === 0)) {
        starts.push(i);
      }
    });
    const nm = m.kind === "months" ? "axm" : starts.length <= 10 ? "axw" : "axn";
    const fmtOpts =
      m.kind === "months"
        ? { month: "short" }
        : starts.length <= 10
          ? { weekday: "short", day: "numeric" }
          : { day: "numeric", month: "short" };
    const lab = (i) =>
      m.res === "week"
        ? this._t("week_s", { n: this._weekNo(slots[i].ms0) })
        : this._dtf(nm, fmtOpts).format(new Date(slots[i].ms0));
    const lw = ((starts.length ? lab(starts[0]).length : 3) * 6.8 + 6) * k;
    const px = pw / Math.max(1, starts.length);
    const steps = m.kind === "months" ? [1, 2, 3, 6] : [1, 2, 3, 4, 7, 14, 30];
    const step = steps.find((n) => n * px >= lw + 10 * k) || steps[steps.length - 1];
    const center = m.res === "day" || m.res === "week" || m.kind === "months";
    starts.forEach((i, n) => {
      const x = center ? cx(i) : xs[i];
      if (!inView(x)) return;
      const long = n % step === 0;
      s += `<line class="axis" x1="${x}" x2="${x}" y1="${base}" y2="${base + (long ? 4 : 3) * k}"/>`;
      if (long) s += `<text class="ax" x="${x}" y="${base + 18 * k}" text-anchor="middle">${this._esc(lab(i))}</text>`;
    });
    return s;
  }

  /** Cheapest and most expensive interval, labeled directly (persistent, no hover needed). */
  _chartExtremes(c) {
    const { m, cfg, k, z, stacked, prices, v0, v1, lo, hi, ml, pw, mt, cx, yOf, L } = c;
    let minI = m.minI;
    let maxI = m.maxI;
    if (z && !stacked) {
      for (let i = v0; i <= v1; i++) {
        if (prices[i] < prices[minI] || minI < v0 || minI > v1) minI = i;
        if (prices[i] > prices[maxI] || maxI < v0 || maxI > v1) maxI = i;
      }
    }
    if (!(cfg.show_extremes !== false && !stacked && (z ? hi - lo : m.pmax - m.pmin) > 1e-9)) return "";
    let s = "";
    [
      [minI, L === KAIROS_LAYERS.dark ? "#30d158" : "#1b7a34"],
      [maxI, L === KAIROS_LAYERS.dark ? "#ff6961" : "#c4161c"],
    ].forEach(([i, color]) => {
      const px = cx(i);
      const py = yOf(prices[i]);
      const txt = this._numText(prices[i]);
      const tw = txt.length * 6.8 * k + 10 * k;
      const lx = kairosClamp(px, ml + tw / 2, ml + pw - tw / 2);
      const ly = py - 9 * k < mt + 4 ? py + 22 * k : py - 9 * k;
      s +=
        `<circle cx="${px}" cy="${py}" r="${4 * k}" fill="${color}" stroke="var(--surface)" stroke-width="2"/>` +
        `<rect class="lblbg" x="${lx - tw / 2}" y="${ly - 12 * k}" width="${tw}" height="${16 * k}" ` +
        `rx="${5 * k}"/>` +
        `<text class="lbl" x="${lx}" y="${ly}" text-anchor="middle">${this._esc(txt)}</text>`;
    });
    return s;
  }

  /** Now indicator: a thin accent rule with a small pill annotation. */
  _chartNow(c) {
    const { k, ml, pw, mt, base, cur, cx, inView, unitW, showNow } = c;
    if (!(showNow && inView(cx(cur)))) return "";
    const nx = cx(cur);
    const nt = this._t("now");
    const pwid = (nt.length * 6.8 + 18) * k;
    const pxl = kairosClamp(nx - pwid / 2, Math.max(ml, unitW + 8 * k), ml + pw - pwid);
    return (
      `<line class="nowline" x1="${nx}" x2="${nx}" y1="${mt - 6 * k}" y2="${base}"/>` +
      `<rect class="nowpill" x="${pxl}" y="${mt - 26 * k}" width="${pwid}" height="${18 * k}" rx="${9 * k}"/>` +
      `<text class="nowtxt" x="${pxl + pwid / 2}" y="${mt - 13 * k}" text-anchor="middle">${this._esc(nt)}</text>`
    );
  }

  /** Zoom buttons (reset, out, in) over the chart; empty when zoom or its buttons are off. */
  _chartZoomButtons(c, showChart) {
    const { cfg, k, mr, mt } = c;
    const zb = (id, icon) =>
      `<button type="button" data-z="${id}" aria-label="${this._esc(this._t("zoom_" + id))}" ` +
      `title="${this._esc(this._t("zoom_" + id))}">${kairosIcon(icon)}</button>`;
    return showChart && this._zoomOn() && (this._coarse() ? cfg.zoom_buttons_touch : cfg.zoom_buttons_desktop) !== false
      ? `<div class="zm" role="group" aria-label="${this._esc(this._t("zoom"))}" ` +
          `style="inset-inline-end:${mr + 6 * k}px;--zy:${Math.round(mt + 6 * k)}px">` +
          `${zb("reset", "restore")}${zb("out", "minus")}${zb("in", "plus")}</div>`
      : "";
  }

  /** Builds the chart SVG (and heatmap SVG) at the pixel width of the chart cell. */
  _chart(m) {
    const c = this._chartContext(m);
    const { k, W, slots, prices, label, ml, pw, mt, ch, base, xs, xe, cx, X, yOf, stacked } = c;
    const showChart = !!c.cfg.show_chart;

    let s = this._chartGradient(c) + this._chartFrame(c);
    if (showChart) {
      s += `<g class="mk"${c.vclip}${c.enter}>${this._chartMarks(c)}</g>`;
      s += this._chartRules(c) + this._chartTimeAxis(c) + this._chartExtremes(c) + this._chartNow(c);
      // Selection overlay.
      s +=
        `<g class="cur" id="cur" aria-hidden="true"><rect class="rule mv" id="cur-rule" x="-0.75" y="${mt}" ` +
        `width="1.5" height="${ch}" rx="0.75"/><circle class="dot mv" id="cur-dot" cx="0" cy="0" r="${4.5 * k}"/></g>`;
    }
    const H1 = base + 26 * k;
    const svgC = showChart
      ? `<svg class="c" xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H1}" viewBox="0 0 ${W} ${H1}" ` +
        `role="img" aria-label="${this._esc(label)}" aria-describedby="sumdesc">${s}</svg>`
      : "";

    const meta = {
      W,
      ml,
      pw,
      mt,
      ch,
      base,
      xs,
      xe,
      cx: slots.map((_, i) => cx(i)),
      ys: prices.map(yOf),
      yStack: m.cums.map((cum) => yOf(cum[cum.length - 1])),
      hasChart: showChart,
      X,
      stacked,
    };
    return {
      html:
        `<div class="plot" tabindex="0" role="group" aria-label="${this._esc(label)}" aria-describedby="sumdesc">` +
        `${svgC}<div class="callout" id="callout"></div>${this._chartZoomButtons(c, showChart)}</div>`,
      svg: svgC,
      meta,
    };
  }

  /* ------------------------------------------------------------------ selection */

  _info(i) {
    const m = this._m;
    const s = m.slots[i];
    return {
      s,
      price: m.prices[i],
      band: m.bands[i],
      range: this._slotRange(s),
    };
  }

  _calloutHtml(i) {
    const m = this._m;
    const { s, price, band, range } = this._info(i);
    let html =
      `<div class="cl-t">${this._esc(range)}${i === m.cur ? " \u00B7 " + this._esc(this._t("now")) : ""}</div>` +
      `<div class="cl-p">${this._numText(price)} <span>${this._esc(m.unit)}</span></div>` +
      `<div class="cl-b band-${band}">` +
      kairosIcon(band === "low" ? "arrowDown" : band === "high" ? "arrowUp" : "flat") +
      `${this._th("lvl_" + band)}</div>`;
    if (m.stacked) {
      html += m.brk
        .map(
          (b) =>
            `<div class="cl-l"><i style="background:${b.c}"></i>${this._esc(b.label)}<b>${this._numText(s[b.k])}</b>` +
            `</div>`,
        )
        .join("");
    }
    return html;
  }

  /** Updates the selection overlay, callout, and live region for the selected (or current) slot. */
  _show(idx) {
    const m = this._m;
    if (!m || !m.meta) return;
    const root = this.shadowRoot;
    const meta = m.meta;
    const sel = idx !== null && idx !== undefined && idx >= 0 && idx < m.count;
    const i = sel ? idx : m.cur;

    const cur = root.getElementById("cur");
    const co = root.getElementById("callout");
    if (cur) cur.classList.toggle("on", sel && meta.hasChart);
    if (!sel) {
      if (co) co.classList.remove("on");
      return;
    }
    const px = meta.cx[i];
    const py = m.stacked ? meta.yStack[i] : meta.ys[i];
    if (px < meta.ml - 0.5 || px > meta.ml + meta.pw + 0.5) {
      if (cur) cur.classList.remove("on");
      if (co) co.classList.remove("on");
      return;
    }
    if (cur && meta.hasChart) {
      root.getElementById("cur-rule").style.transform = `translate(${px}px,0)`;
      root.getElementById("cur-dot").style.transform = `translate(${px}px,${py}px)`;
    }
    if (co) {
      co.innerHTML = this._calloutHtml(i);
      co.classList.add("on");
      const plot = co.parentElement;
      const pwid = plot.clientWidth || meta.W;
      const cw = co.offsetWidth || 120;
      const chh = co.offsetHeight || 60;
      const x = kairosClamp(px - cw / 2, 0, Math.max(0, pwid - cw));
      let y = 4;
      if (this._ptrY !== null && this._ptrY !== undefined) {
        y = kairosClamp(this._ptrY - chh - 28, 0, Math.max(0, (plot.clientHeight || meta.base) - chh));
      }
      co.style.transform = `translate(${x}px,${y}px)`;
    }
    this._announce(i);
  }

  /** Debounced live-region announcement so scrubbing does not flood screen readers. */
  _announce(i) {
    clearTimeout(this._announceT);
    this._announceT = setTimeout(() => {
      const m = this._m;
      const live = this.shadowRoot.getElementById("live");
      if (!m || !live || i < 0 || i >= m.count) return;
      live.textContent =
        this._info(i).range + ", " + this._fmt(m.prices[i]) + (i === m.cur ? ", " + this._t("now") : "");
    }, 450);
  }

  _select(i, pin) {
    this._hover = i;
    if (pin !== undefined) this._pinned = pin ? i : null;
    if (this._selRaf) return;
    this._selRaf = requestAnimationFrame(() => {
      this._selRaf = 0;
      this._show(this._hover);
    });
    this._touch();
  }

  _clearSelection() {
    this._pinned = null;
    this._hover = null;
    this._ptrY = null;
    clearTimeout(this._idle);
    this._idle = null;
    this._show(null);
  }

  /** Maps a pointer position to a slot index (chart or heatmap); null when outside and not clamping. */
  _pick(e, clamp) {
    const m = this._m;
    const meta = m && m.meta;
    if (!meta) return null;
    const plot = this._el.chart.querySelector(".plot");
    if (!plot) return null;
    const svgC = plot.querySelector("svg.c");
    if (svgC) {
      const r = svgC.getBoundingClientRect();
      if (!r.width) return null;
      let sx = ((e.clientX - r.left) * meta.W) / r.width;
      if (!clamp && (sx < meta.ml || sx > meta.ml + meta.pw)) return null;
      sx = kairosClamp(sx, meta.ml, meta.ml + meta.pw);
      let a = 0;
      let b = m.count - 1;
      while (a < b) {
        const mid = (a + b) >> 1;
        if (meta.cx[mid] < sx) a = mid + 1;
        else b = mid;
      }
      if (a > 0 && Math.abs(meta.cx[a - 1] - sx) <= Math.abs(meta.cx[a] - sx)) a -= 1;
      return a;
    }
    return null;
  }

  /* ------------------------------------------------------------------ input handling */

  _onPointerDown(e) {
    const plot = e.target.closest && e.target.closest(".plot");
    if (!plot || !this._m) return;
    if (e.target.closest(".zm")) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.pointerType !== "mouse" && this._config.zoom_touch) {
      // A second finger pans a zoomed chart; scrubbing stops.
      this._pts = this._pts || new Map();
      this._pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this._pts.size === 2 && this._m.meta && this._m.count > 1) {
        try {
          plot.setPointerCapture(e.pointerId);
        } catch (err) {
          /* ignore */
        }
        this._drag = null;
        this._clearSelection();
        const [p, q] = [...this._pts.values()];
        this._pinch = { x: (p.x + q.x) / 2, z: this._zoom };
        return;
      }
      if (this._pts.size > 2) return;
    } else if (e.pointerType === "mouse" && this._zoom && this._config.zoom_desktop) {
      this._pan = { x: e.clientX, z: this._zoom, moved: false };
    }
    const i = this._pick(e, false);
    this._drag = {
      id: e.pointerId,
      type: e.pointerType,
      x: e.clientX,
      y: e.clientY,
      moved: false,
      start: i,
    };
    if (e.pointerType === "mouse") {
      // Click pins the selection; clicking the pinned slot releases it.
      if (i === null) return;
      this._ptrY = null;
      const same = this._pinned === i;
      this._select(same ? null : i, !same);
      if (same) this._clearSelection();
      return;
    }
    // Touch and pen: press and drag to scrub. Pointer capture keeps the drag alive outside the plot.
    try {
      plot.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ignore */
    }
    this._ptrY = e.clientY - plot.getBoundingClientRect().top;
    if (i !== null) this._select(i, false);
  }

  _onPointerMove(e) {
    const plot = e.target.closest && e.target.closest(".plot");
    if (!plot || !this._m) return;
    if (e.pointerType !== "mouse" && this._pts && this._pts.has(e.pointerId)) {
      this._pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this._pinch && this._pts.size === 2) {
        const [p, q] = [...this._pts.values()];
        const z = this._pinch.z;
        if (z) {
          const meta = this._m.meta;
          const r = this._el.chart.querySelector("svg.c").getBoundingClientRect();
          const dx = (((p.x + q.x) / 2 - this._pinch.x) * meta.W) / r.width;
          const w = z.b - z.a;
          this._applyZoom(z.a - (dx / meta.pw) * w, w);
        }
        return;
      }
    }
    if (e.pointerType === "mouse" && this._pan && e.buttons & 1) {
      const meta = this._m.meta;
      const r = plot.querySelector("svg.c").getBoundingClientRect();
      const dx = ((e.clientX - this._pan.x) * meta.W) / r.width;
      if (this._pan.moved || Math.abs(dx) > 4) {
        if (!this._pan.moved) {
          this._pan.moved = true;
          this._clearSelection();
        }
        const w = this._pan.z.b - this._pan.z.a;
        this._applyZoom(this._pan.z.a - (dx / meta.pw) * w, w);
        return;
      }
    }
    if (e.pointerType === "mouse") {
      if (this._pan && this._pan.moved) return;
      if (this._pinned !== null) return;
      const i = this._pick(e, false);
      this._ptrY = null;
      if (i !== null) this._select(i);
      else if (this._hover !== null) this._clearSelection();
      return;
    }
    const d = this._drag;
    if (!d || d.id !== e.pointerId) return;
    if (Math.abs(e.clientX - d.x) > 6 || Math.abs(e.clientY - d.y) > 6) d.moved = true;
    this._ptrY = e.clientY - plot.getBoundingClientRect().top;
    const i = this._pick(e, true);
    if (i !== null) this._select(i, false);
  }

  _onPointerUp(e, cancelled) {
    if (e.pointerType === "mouse") {
      this._pan = null;
    } else if (this._pts) {
      this._pts.delete(e.pointerId);
      if (this._pinch) {
        if (this._pts.size < 2) this._pinch = null;
        this._drag = null;
        return;
      }
    }
    const d = this._drag;
    if (!d || d.id !== e.pointerId || e.pointerType === "mouse") return;
    this._drag = null;
    // Double tap: zoom in around the tapped point; double tap again to zoom out.
    if (this._config.zoom_touch && !cancelled && !d.moved && d.start !== null) {
      const now = Date.now();
      const last = this._lastTap;
      if (last && now - last.t < 350 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 32) {
        this._lastTap = null;
        this._clearSelection();
        if (this._zoom) this._applyZoom(0, 1);
        else this._zoomBy(0.25, this._plotFrac(e.clientX));
        return;
      }
      this._lastTap = { t: now, x: e.clientX, y: e.clientY };
    }
    // A drag releases back to "now"; a tap pins the slot until the idle timeout.
    if (cancelled || d.moved || d.start === null) this._clearSelection();
    else this._select(d.start, true);
  }

  _onPointerLeave(e) {
    if (e.pointerType === "mouse" && this._pinned === null && this._hover !== null) this._clearSelection();
  }

  /* ------------------------------------------------------------------ zoom (time axis) */

  /** Whether zoom is enabled for the device in use (touch screens use zoom_touch, others zoom_desktop). */
  _zoomOn() {
    const c = this._config;
    return this._coarse() ? !!c.zoom_touch : !!c.zoom_desktop;
  }

  /** Whether the primary pointer is a touch screen. */
  _coarse() {
    try {
      return !!(window.matchMedia && window.matchMedia("(pointer:coarse)").matches);
    } catch (err) {
      return false;
    }
  }

  /** Smallest visible fraction of the span: about six slots. */
  _minZoom() {
    return Math.min(1, 6 / Math.max(1, this._m ? this._m.count : 1));
  }

  /** Horizontal position of a pointer inside the plot area, as a fraction 0..1. */
  _plotFrac(clientX) {
    const m = this._m;
    const svgC = this._el.chart.querySelector("svg.c");
    if (!m || !m.meta || !svgC) return 0.5;
    const r = svgC.getBoundingClientRect();
    if (!r.width) return 0.5;
    const sx = ((clientX - r.left) * m.meta.W) / r.width;
    return kairosClamp((sx - m.meta.ml) / m.meta.pw, 0, 1);
  }

  /** Sets the zoom window from a start fraction and a width; a full window clears the zoom. */
  _applyZoom(a, w) {
    const nw = kairosClamp(w, this._minZoom(), 1);
    const na = kairosClamp(a, 0, 1 - nw);
    const next = nw >= 0.999 ? null : { a: na, b: na + nw };
    const same = (!next && !this._zoom) || (next && this._zoom && next.a === this._zoom.a && next.b === this._zoom.b);
    if (same) return;
    this._zoom = next;
    if (this._zoomRaf) return;
    this._zoomRaf = requestAnimationFrame(() => {
      this._zoomRaf = 0;
      this._redrawChart();
    });
  }

  /** Zooms by a factor (below 1 zooms in) around a fraction of the visible window. */
  _zoomBy(factor, focus = 0.5) {
    const z = this._zoom || { a: 0, b: 1 };
    const w = z.b - z.a;
    const nw = kairosClamp(w * factor, this._minZoom(), 1);
    this._applyZoom(z.a + focus * w - focus * nw, nw);
  }

  /** Brings a slot into the zoom window. */
  _reveal(i) {
    const m = this._m;
    if (!this._zoom || !m) return;
    const t0 = m.slots[0].ms0;
    const span = m.slots[m.count - 1].ms1 - t0;
    const f = (m.slots[i].ms0 + m.slots[i].ms1 - 2 * t0) / (2 * span);
    const { a, b } = this._zoom;
    if (f < a || f > b) this._applyZoom(f - (b - a) / 2, b - a);
  }

  /** Redraws the chart graphic in place (the container stays, so pointer capture survives a gesture). */
  _redrawChart() {
    const m = this._m;
    if (!m || !m.meta || !this._config.show_chart) return;
    this._animate = false;
    const chart = this._chart(m);
    m.meta = chart.meta;
    const old = this._el.chart.querySelector("svg.c");
    if (old && chart.svg) old.outerHTML = chart.svg;
    this._syncZoomUi();
    this._show(this._hover);
  }

  _syncZoomUi() {
    const q = (id) => this._el.chart.querySelector(`button[data-z="${id}"]`);
    const out = q("out");
    if (!out) return;
    const z = this._zoom;
    out.parentElement.classList.toggle("on", !!z);
    out.disabled = !z;
    q("reset").hidden = !z;
    q("in").disabled = !!z && z.b - z.a <= this._minZoom() + 1e-6;
  }

  _onWheel(e) {
    const m = this._m;
    const plot = e.target.closest && e.target.closest(".plot");
    if (!plot || !m || !m.meta || !m.meta.hasChart || m.count < 2 || e.target.closest(".zm")) return;
    if (!this._config.zoom_desktop) return;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const dx = e.deltaX * unit;
    const dy = e.deltaY * unit;
    const z = this._zoom;
    const pinch = e.ctrlKey; // a trackpad pinch arrives as a wheel event with ctrlKey
    // Sideways scrolling pans a zoomed chart.
    if (z && Math.abs(dx) > Math.abs(dy) && !pinch) {
      e.preventDefault();
      const w = z.b - z.a;
      this._applyZoom(z.a + (dx / m.meta.pw) * w, w);
      return;
    }
    const factor = Math.exp(dy * (pinch ? 0.01 : 0.0015));
    if (!z && factor > 1) return; // already fully zoomed out: let the page scroll
    e.preventDefault();
    this._zoomBy(factor, this._plotFrac(e.clientX));
  }

  /** Hovering a price in the price-view tables shows that slot in the chart (hover is optional, never required). */
  _onCellHover(e, enter) {
    if (e.pointerType !== "mouse" || this._pinned !== null) return;
    const td = e.target.closest && e.target.closest("td[data-s]");
    if (!td) return;
    if (enter) {
      this._ptrY = null;
      this._select(Number(td.dataset.s));
    } else if (!(e.relatedTarget && td.contains(e.relatedTarget))) this._clearSelection();
  }

  _onKey(e) {
    if (e.key === "Escape" && this._calOpen) {
      e.preventDefault();
      this._closeCal(true);
      return;
    }
    const td = e.target.closest && e.target.closest("td[data-s]");
    if (td && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      const i = Number(td.dataset.s);
      if (this._pinned === i) this._clearSelection();
      else this._select(i, true);
      return;
    }
    const plot = e.target.closest && e.target.closest(".plot");
    const m = this._m;
    if (!plot || !m) return;
    const last = m.count - 1;
    if (!e.ctrlKey && !e.metaKey && !e.altKey && m.meta && m.meta.hasChart && this._zoomOn()) {
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        this._zoomBy(0.5);
        return;
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        this._zoomBy(2);
        return;
      }
      if (e.key === "0") {
        e.preventDefault();
        this._applyZoom(0, 1);
        return;
      }
    }
    const from = this._hover !== null && this._hover !== undefined ? this._hover : m.cur >= 0 ? m.cur : -1;
    const page = m.hourly ? 3 : 4;
    const rtl = getComputedStyle(plot).direction === "rtl";
    let i = null;
    const fwd = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    if (e.key === fwd || e.key === "ArrowUp") i = Math.min(last, from + 1);
    else if (e.key === back || e.key === "ArrowDown") i = Math.max(0, from < 0 ? 0 : from - 1);
    else if (e.key === "PageUp") i = Math.max(0, from < 0 ? 0 : from - page);
    else if (e.key === "PageDown") i = Math.min(last, from + page);
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = last;
    else if (e.key === "Escape") {
      this._clearSelection();
      return;
    }
    if (i === null) return;
    e.preventDefault();
    this._ptrY = null;
    this._reveal(i);
    this._select(i, true);
  }

  _onClick(e) {
    if (this._calOpen && !(e.target.closest && e.target.closest(".dwrap"))) this._closeCal(false);
    const zb = e.target.closest && e.target.closest("button[data-z]");
    if (zb && !zb.disabled) {
      if (zb.dataset.z === "reset") this._applyZoom(0, 1);
      else this._zoomBy(zb.dataset.z === "in" ? 0.5 : 2);
      return;
    }
    const dd = e.target.closest && e.target.closest("button[data-d]");
    if (dd && !dd.disabled) {
      this._pickCalDay(dd.dataset.d);
      return;
    }
    const rb = e.target.closest && e.target.closest("button[data-r]");
    if (rb) {
      this._pickRange(rb.dataset.r);
      return;
    }
    const mo = e.target.closest && e.target.closest("button[data-mo]");
    if (mo && !mo.disabled) {
      this._calView = { y: this._calView.y, m: Number(mo.dataset.mo) };
      this._calMode = "days";
      this._renderCal();
      return;
    }
    const yr = e.target.closest && e.target.closest("button[data-yr]");
    if (yr && !yr.disabled) {
      this._calView = { y: Number(yr.dataset.yr), m: this._calView.m };
      this._calMode = "months";
      this._renderCal();
      return;
    }
    const up = e.target.closest && e.target.closest("button[data-up]");
    if (up) {
      this._calMode = this._calMode === "days" ? "months" : "years";
      this._renderCal();
      return;
    }
    const cm = e.target.closest && e.target.closest("button[data-cal]");
    if (cm) {
      const v = this._calView || {
        y: new Date().getFullYear(),
        m: new Date().getMonth(),
      };
      const dir = Number(cm.dataset.cal);
      if (this._calMode === "days") {
        const n = v.y * 12 + v.m + dir;
        this._calView = { y: Math.floor(n / 12), m: n % 12 };
      } else
        this._calView = {
          y: v.y + dir * (this._calMode === "years" ? 12 : 1),
          m: v.m,
        };
      this._renderCal();
      return;
    }
    const b = e.target.closest && e.target.closest("button[data-k]");
    if (b && !b.disabled && b.getAttribute("aria-disabled") !== "true") {
      clearTimeout(this._idle);
      this._idle = null;
      if (b.dataset.k === "day_step") {
        const cur = this._eff();
        if (cur.range) {
          // Range stepper: one whole period back or forward (never beyond the current period).
          const off = Math.min(0, this._rangeOffset() + Number(b.dataset.v));
          this._ui = { ...this._ui, rangeOffset: off };
        } else {
          // Day stepper: one calendar day back or forward (up to the last day that has prices).
          const n = this._addDays(this._dayParts(cur.day), Number(b.dataset.v));
          if (this._utc(n) <= this._utc(this._lastDay())) this._ui = { ...this._ui, day: this._nameOfDate(n) };
        }
      } else if (b.dataset.k === "cheapest_step") {
        // Stepper: one quarter per step, one hour per step in hour mode.
        const { val, max, hourly } = this._stepValue();
        const next = Math.max(0, Math.min(max, val + Number(b.dataset.v)));
        this._ui = { ...this._ui, cheapest: hourly ? next * 4 : next };
        // Re-render without a cross-fade and without letting the page scroll position change.
        const guard = this._scrollGuard(true);
        this._still = true;
        this._hover = null;
        this._pinned = null;
        try {
          this._update();
        } finally {
          this._still = false;
          guard();
        }
        if (!b.disabled) b.focus({ preventScroll: true });
        return;
      } else if (b.dataset.k === "period" && this._eff().range) {
        this._ui = { ...this._ui, res: b.dataset.v };
      } else {
        this._ui = { ...this._ui, [b.dataset.k]: b.dataset.v };
      }
      this._hover = null;
      this._pinned = null;
      this._update();
      return;
    }
    const a = e.target.closest && e.target.closest("[data-act]");
    if (a) {
      const act = a.dataset.act;
      if (act === "cal") {
        if (this._calOpen) this._closeCal(true);
        else this._openCal();
      } else if (act === "edit") {
        this._openEditor();
      } else if (act === "retry") {
        const id = this._entityId();
        if (this._hass && this._hass.callService) {
          Promise.resolve(
            this._hass.callService("homeassistant", "update_entity", {
              entity_id: id,
            }),
          ).catch(() => {});
        }
        this._renderKey = "";
        this._update();
      } else if (act === "today") {
        this._ui = {
          ...this._ui,
          day: "today",
          ...(this._eff().range ? { res: undefined, period: undefined } : {}),
        };
        this._update();
      } else if (act === "data") {
        // Toggle the data table in place: no re-render, so the scroll position and focus stay where they are.
        this._showData = !this._showData;
        const table = this.shadowRoot.getElementById("dtbl");
        if (table) table.classList.toggle("sr", !this._showData);
        a.setAttribute("aria-expanded", String(this._showData));
        a.innerHTML = kairosIcon("table") + this._t(this._showData ? "hide_data" : "show_data");
        // Keep the render key in sync so the next update does not rebuild the card for this change.
        this._renderKey = this._renderKey.replace(/(true|false)$/, String(this._showData));
      }
      return;
    }
    const td = e.target.closest && e.target.closest("td[data-s]");
    if (td) {
      const i = Number(td.dataset.s);
      if (this._pinned === i) this._clearSelection();
      else this._select(i, true);
    }
  }
}

/* ---------------------------------------------------------------------------------------------------------- editor */

/**
 * Text of the visual editor in English and Dutch: `label` and `hint` per option, `opt` per option value
 * (`day:<value>` for the start day), `section` per section title, and `ui` for buttons and messages.
 * A missing Dutch text falls back to English.
 */
const KAIROS_ED = {
  en: {
    label: {
      entity: "Price sensor",
      entities: "Fallback sensors",
      history_entity: "History sensor",
      history_quarter_days: "Quarter-hour history",
      show_header: "Show header",
      source: "Source",
      title: "Title",
      icon: "Icon",
      edit_button: "Edit button",
      edit_button_icon: "Edit button icon",
      edit_link: "Edit link in footer",
      update_menu: "Show update menu",
      update_resource: "Dashboard resource",
      update_resource_top: "Dashboard resource",
      day: "Start day",
      auto_advance_tomorrow: "Switch to tomorrow",
      view: "View",
      period: "Period",
      chart_style: "Chart style",
      vat: "Include VAT",
      vat_rate: "VAT rate",
      energy_tax: "Energy tax",
      surcharge: "Surcharge",
      fixed_price: "Fixed rate",
      fixed_label: "Energy company",
      unit: "Price unit",
      decimals: "Decimals",
      currency: "Currency",
      currency_display: "Currency display",
      time_format: "Time format",
      axis_am_pm: "AM/PM on the axis",
      axis_minutes: "Minutes on the axis",
      cheapest_quarters: "Cheapest slots",
      best_window_hours: "Best window",
      price_bands: "Price bands",
      show_chart: "Show chart",
      show_hour_grid: "Hour grid",
      show_now_marker: "Now marker",
      show_extremes: "Min/max labels",
      zoom_desktop: "Zoom on desktop / laptop",
      zoom_touch: "Zoom on iPhone / iPad",
      zoom_buttons_desktop: "Zoom buttons on desktop / laptop",
      zoom_buttons_touch: "Reset button on iPhone / iPad",
      show_average_line: "Average line",
      average_line_size: "Average line size",
      show_fixed_line: "Fixed rate line",
      fixed_line_size: "Fixed rate line size",
      show_stats: "Show tiles",
      show_legend: "Show legend and cheapest summary",
      show_controls: "Show controls",
      show_day_button: "Day control",
      show_period_button: "Period control",
      show_chart_type_button: "Chart type control",
      show_price_button: "Price view button",
      show_heatmap_button: "Heatmap view button",
      show_breakdown_button: "Breakdown view button",
      show_cheapest_stepper: "Cheapest slots stepper",
      price_bar_opacity: "Price · bars",
      price_line_opacity: "Price · line",
      heat_gradient: "Heatmap gradient",
      heatmap_bar_opacity: "Heatmap · bars",
      heatmap_line_opacity: "Heatmap · line",
      breakdown_bar_opacity: "Breakdown · bars",
      breakdown_line_opacity: "Breakdown · line",
      color_scheme: "Color scheme",
      display_mode_desktop: "Display mode on desktop / laptop",
      display_mode_touch: "Display mode on tablet / smartphone",
      kiosk: "Kiosk / wall display",
      display_mode_kiosk: "Display mode on kiosk",
      pixel_shift: "Pixel shift",
      editor_expand_sections: "Expand all sections",
    },
    hint: {
      heat_gradient: "Horizontal: one gradient over the chart height. Vertical: one solid color per bar.",
      zoom_desktop: "Scroll wheel over the chart, drag to pan, and the + - 0 keys.",
      zoom_touch: "Double tap to zoom in and out, two fingers to pan.",
      zoom_buttons_desktop: "Show the reset, - and + buttons in the chart.",
      zoom_buttons_touch: "Show the reset button in the chart while zoomed.",
      entity: "Sensor with the today and tomorrow attributes.",
      entities: "Comma-separated; used when the price sensor is unavailable.",
      history_entity: "Bare price in EUR/kWh. Feeds past days, ranges, and the calendar.",
      history_quarter_days: "Days back that show quarter hours; older days are hourly.",
      source: "Sets the title and logo. Custom uses the title and icon below.",
      title: "Use {day} for the selected day. Empty uses the default title.",
      icon: "An mdi icon such as mdi:flash. Empty shows the Kairos logo.",
      update_resource_top:
        "Experimental: the button checks for a newer file in /local/, updates the resource, and reloads.",
      update_resource:
        "Experimental: the button checks for a newer file in /local/, updates the resource, and reloads. " +
        "Needs an administrator.",
      update_menu: "Experimental: show the Dashboard resource button in a section at the top of this editor.",
      edit_link: "Experimental: an Edit text link next to Updated. Opens the card editor like the edit button.",
      edit_button: "Experimental: opens the card editor. Home Assistant has no official way, so it can stop working.",
      auto_advance_tomorrow: "When tomorrow’s prices are published.",
      fixed_price: "Bare price, before VAT. 0 hides the fixed rate.",
      fixed_label: "Name of your energy company, shown on the fixed rate tile. Empty uses the default name.",
      unit: "auto, ct/kWh, EUR/kWh, …",
      decimals: "Empty is automatic.",
      display_mode_desktop: "Auto is compact on a narrow card and regular otherwise.",
      display_mode_touch: "Auto is compact on a narrow card and regular otherwise.",
      kiosk: "Turn on for a wall display. The kiosk display mode is then used.",
      display_mode_kiosk: "Auto picks the mode from the width of the card.",
      currency: "Used for amounts.",
      axis_minutes: "Show 00:00 instead of 00.",
      cheapest_quarters: "Highlighted in the heatmap view.",
      best_window_hours: "Cheapest contiguous window; 0 is off.",
      price_bands: "auto, or low and high in the shown unit.",
      pixel_shift: "Moves the card slightly to prevent burn-in on wall displays.",
      editor_expand_sections: "Open every section of this editor. Off: only the first sections start open.",
    },
    opt: {
      small: "Small",
      medium: "Medium",
      large: "Large",
      horizontal: "Horizontal",
      vertical: "Vertical",
      week: "Week",
      month: "Month",
      year: "Year",
      12: "12 h",
      24: "24 h",
      "15min": "15 min",
      hour: "1 h",
      day: "Day",
      bars: "Bars",
      symbol: "Symbol",
      code: "Code",
      none: "None",
      today: "Today",
      tomorrow: "Tomorrow",
      yesterday: "Yesterday",
      price: "Price",
      heatmap: "Heatmap",
      breakdown: "Breakdown",
      auto: "Auto",
      line: "Line",
      light: "Light",
      dark: "Dark",
      compact: "Compact",
      regular: "Regular",
      kiosk: "Kiosk",
      custom: "Custom",
      nord_pool: "Nord Pool",
      entsoe: "ENTSO-E",
      sliders: "Sliders",
      gear: "Gear",
      pencil: "Pencil",
      pencil_square: "Pencil square",
      "day:week": "This week",
      "day:month": "This month",
      "day:year": "This year",
      "day:q1": "First quarter",
      "day:q2": "Second quarter",
      "day:q3": "Third quarter",
      "day:q4": "Fourth quarter",
    },
    section: {
      Update: "Update",
      Entity: "Entity",
      Header: "Header",
      "Data and view": "Data and view",
      "Prices and VAT": "Prices and VAT",
      "Units and formatting": "Units and formatting",
      Highlights: "Highlights",
      "Chart elements": "Chart elements",
      "Summary sections": "Summary sections",
      Controls: "Controls",
      Opacity: "Opacity",
      Appearance: "Appearance",
      Experimental: "Experimental",
    },
    ui: {
      check: "Check",
      update: "Update",
      reload: "Reload",
      checking: "Checking for an update...",
      saving: "Saving...",
      working: "Working...",
      not_saved: "The card was not saved, so the page was not reloaded. Save it and try again.",
      update_available: "Update available: version {version}",
      up_to_date: "Up to date: version {version}",
      resource_set: "Resource set to the new version {version}. Press Reload to load it.",
      not_connected: "Home Assistant is not connected.",
      cannot_read: "Cannot read {path} (HTTP {status}).",
      no_version: "No card version found in {path}.",
      no_resource: "No dashboard resource for {path}. Add it in Settings > Dashboards > Resources.",
      enter_bands: "Enter auto, or two numbers such as 10, 25.",
      enter_int: "Enter a whole number{range}.",
      enter_num: "Enter a number{range}.",
      range: " between {min} and {max}",
    },
  },
  nl: {
    label: {
      entity: "Prijssensor",
      entities: "Terugvalsensoren",
      history_entity: "Geschiedenissensor",
      history_quarter_days: "Kwartiergeschiedenis",
      show_header: "Kop tonen",
      source: "Bron",
      title: "Titel",
      icon: "Pictogram",
      edit_button: "Bewerkknop",
      edit_button_icon: "Pictogram bewerkknop",
      edit_link: "Bewerklink in voettekst",
      update_menu: "Updatemenu tonen",
      update_resource: "Dashboardresource",
      update_resource_top: "Dashboardresource",
      day: "Startdag",
      auto_advance_tomorrow: "Naar morgen schakelen",
      view: "Weergave",
      period: "Periode",
      chart_style: "Grafiekstijl",
      vat: "Incl. BTW",
      vat_rate: "BTW-tarief",
      energy_tax: "Energiebelasting",
      surcharge: "Opslag",
      fixed_price: "Vast tarief",
      fixed_label: "Energiebedrijf",
      unit: "Prijseenheid",
      decimals: "Decimalen",
      currency: "Valuta",
      currency_display: "Valuta-weergave",
      time_format: "Tijdnotatie",
      axis_am_pm: "AM/PM op de as",
      axis_minutes: "Minuten op de as",
      cheapest_quarters: "Goedkoopste blokken",
      best_window_hours: "Beste venster",
      price_bands: "Prijsbanden",
      show_chart: "Grafiek tonen",
      show_hour_grid: "Uurraster",
      show_now_marker: "Nu-markering",
      show_extremes: "Min/max-labels",
      zoom_desktop: "Zoomen op desktop / laptop",
      zoom_touch: "Zoomen op iPhone / iPad",
      zoom_buttons_desktop: "Zoomknoppen op desktop / laptop",
      zoom_buttons_touch: "Resetknop op iPhone / iPad",
      show_average_line: "Gemiddelde lijn",
      average_line_size: "Dikte gemiddelde lijn",
      show_fixed_line: "Lijn vast tarief",
      fixed_line_size: "Dikte lijn vast tarief",
      show_stats: "Tegels tonen",
      show_legend: "Legenda en goedkoopste samenvatting tonen",
      show_controls: "Bediening tonen",
      show_day_button: "Dagkeuze",
      show_period_button: "Periodekeuze",
      show_chart_type_button: "Grafiektypekeuze",
      show_price_button: "Knop prijsweergave",
      show_heatmap_button: "Knop heatmapweergave",
      show_breakdown_button: "Knop opbouwweergave",
      show_cheapest_stepper: "Stapper goedkoopste blokken",
      price_bar_opacity: "Prijs · balken",
      price_line_opacity: "Prijs · lijn",
      heat_gradient: "Heatmap-verloop",
      heatmap_bar_opacity: "Heatmap · balken",
      heatmap_line_opacity: "Heatmap · lijn",
      breakdown_bar_opacity: "Opbouw · balken",
      breakdown_line_opacity: "Opbouw · lijn",
      color_scheme: "Kleurenschema",
      display_mode_desktop: "Weergavemodus op desktop / laptop",
      display_mode_touch: "Weergavemodus op tablet / smartphone",
      kiosk: "Kiosk / wandscherm",
      display_mode_kiosk: "Weergavemodus op kiosk",
      pixel_shift: "Pixelverschuiving",
      editor_expand_sections: "Alle secties openklappen",
    },
    hint: {
      heat_gradient: "Horizontaal: één verloop over de hoogte van de grafiek. Verticaal: één effen kleur per balk.",
      zoom_desktop: "Scrollwiel boven de grafiek, slepen om te schuiven en de toetsen + - 0.",
      zoom_touch: "Dubbeltik om in en uit te zoomen, twee vingers om te schuiven.",
      zoom_buttons_desktop: "Toon de knoppen reset, - en + in de grafiek.",
      zoom_buttons_touch: "Toon de resetknop in de grafiek tijdens het zoomen.",
      entity: "Sensor met de attributen today en tomorrow.",
      entities: "Kommagescheiden; gebruikt als de prijssensor niet beschikbaar is.",
      history_entity: "Kale prijs in EUR/kWh. Voedt eerdere dagen, periodes en de kalender.",
      history_quarter_days: "Aantal dagen terug met kwartieren; oudere dagen zijn per uur.",
      source: "Bepaalt de titel en het logo. Aangepast gebruikt de titel en het pictogram hieronder.",
      title: "Gebruik {day} voor de gekozen dag. Leeg gebruikt de standaardtitel.",
      icon: "Een mdi-pictogram zoals mdi:flash. Leeg toont het Kairos-logo.",
      update_resource_top:
        "Experimenteel: de knop zoekt een nieuwer bestand in /local/, werkt de resource bij en laadt opnieuw.",
      update_resource:
        "Experimenteel: de knop zoekt een nieuwer bestand in /local/, werkt de resource bij en laadt opnieuw. " +
        "Heeft een beheerder nodig.",
      update_menu: "Experimenteel: toon de knop voor de dashboardresource in een sectie bovenaan deze editor.",
      edit_link: "Experimenteel: een tekstlink Bewerken naast Bijgewerkt. Opent de kaarteditor zoals de bewerkknop.",
      edit_button:
        "Experimenteel: opent de kaarteditor. Home Assistant heeft hier geen officiële manier voor, " +
        "dus het kan stoppen met werken.",
      auto_advance_tomorrow: "Wanneer de prijzen van morgen zijn gepubliceerd.",
      fixed_price: "Kale prijs, vóór BTW. 0 verbergt het vaste tarief.",
      fixed_label:
        "Naam van je energiebedrijf, getoond op de tegel van het vaste tarief. Leeg gebruikt de standaardnaam.",
      unit: "auto, ct/kWh, EUR/kWh, …",
      decimals: "Leeg is automatisch.",
      display_mode_desktop: "Auto is compact op een smalle kaart en anders normaal.",
      display_mode_touch: "Auto is compact op een smalle kaart en anders normaal.",
      kiosk: "Zet aan voor een wandscherm. De kioskmodus wordt dan gebruikt.",
      display_mode_kiosk: "Auto kiest de modus op basis van de breedte van de kaart.",
      currency: "Gebruikt voor bedragen.",
      axis_minutes: "Toon 00:00 in plaats van 00.",
      cheapest_quarters: "Gemarkeerd in de heatmapweergave.",
      best_window_hours: "Goedkoopste aaneengesloten venster; 0 is uit.",
      price_bands: "auto, of laag en hoog in de getoonde eenheid.",
      pixel_shift: "Verschuift de kaart een beetje om inbranden op wandschermen te voorkomen.",
      editor_expand_sections: "Open elke sectie van deze editor. Uit: alleen de eerste secties starten open.",
    },
    opt: {
      small: "Klein",
      medium: "Middel",
      large: "Groot",
      horizontal: "Horizontaal",
      vertical: "Verticaal",
      week: "Week",
      month: "Maand",
      year: "Jaar",
      12: "12 u",
      24: "24 u",
      "15min": "15 min",
      hour: "1 u",
      day: "Dag",
      bars: "Balken",
      symbol: "Symbool",
      code: "Code",
      none: "Geen",
      today: "Vandaag",
      tomorrow: "Morgen",
      yesterday: "Gisteren",
      price: "Prijs",
      heatmap: "Heatmap",
      breakdown: "Opbouw",
      auto: "Auto",
      line: "Lijn",
      light: "Licht",
      dark: "Donker",
      compact: "Compact",
      regular: "Normaal",
      kiosk: "Kiosk",
      custom: "Aangepast",
      nord_pool: "Nord Pool",
      entsoe: "ENTSO-E",
      sliders: "Schuifregelaars",
      gear: "Tandwiel",
      pencil: "Potlood",
      pencil_square: "Potlood met vierkant",
      "day:week": "Deze week",
      "day:month": "Deze maand",
      "day:year": "Dit jaar",
      "day:q1": "Eerste kwartaal",
      "day:q2": "Tweede kwartaal",
      "day:q3": "Derde kwartaal",
      "day:q4": "Vierde kwartaal",
    },
    section: {
      Update: "Bijwerken",
      Entity: "Entiteit",
      Header: "Kop",
      "Data and view": "Gegevens en weergave",
      "Prices and VAT": "Prijzen en BTW",
      "Units and formatting": "Eenheden en opmaak",
      Highlights: "Uitgelicht",
      "Chart elements": "Grafiekelementen",
      "Summary sections": "Samenvattingen",
      Controls: "Bediening",
      Opacity: "Dekking",
      Appearance: "Uiterlijk",
      Experimental: "Experimenteel",
    },
    ui: {
      check: "Controleren",
      update: "Bijwerken",
      reload: "Herladen",
      checking: "Zoeken naar een update...",
      saving: "Opslaan...",
      working: "Bezig...",
      not_saved: "De kaart is niet opgeslagen, dus de pagina is niet herladen. Sla de kaart op en probeer het opnieuw.",
      update_available: "Update beschikbaar: versie {version}",
      up_to_date: "Up-to-date: versie {version}",
      resource_set: "Resource ingesteld op de nieuwe versie {version}. Druk op Herladen om die te laden.",
      not_connected: "Home Assistant is niet verbonden.",
      cannot_read: "Kan {path} niet lezen (HTTP {status}).",
      no_version: "Geen kaartversie gevonden in {path}.",
      no_resource: "Geen dashboardresource voor {path}. Voeg die toe via Instellingen > Dashboards > Resources.",
      enter_bands: "Vul auto in, of twee getallen zoals 10, 25.",
      enter_int: "Vul een geheel getal in{range}.",
      enter_num: "Vul een getal in{range}.",
      range: " tussen {min} en {max}",
    },
  },
};

/** Visual editor rows, in the same logical order as the options in KAIROS_DEFAULTS. */
/**
 * Editor form. Row types: entity, list, text, num (u = unit, min, max, int), bool, select, seg, bands.
 * `dep` greys a row out while that option is off; `only: [option, value]` hides a row unless the option has that
 * value; `open` sections start expanded.
 */
const KAIROS_FORM = [
  {
    title: "Update",
    open: true,
    rows: [{ k: "update_resource_top", t: "action", act: "update_resource" }],
  },
  {
    title: "Entity",
    open: true,
    rows: [
      { k: "entity", t: "entity" },
      { k: "entities", t: "list" },
      { k: "history_entity", t: "entity" },
      {
        k: "history_quarter_days",
        t: "num",
        u: "days",
        min: 0,
        max: 10,
        int: true,
      },
    ],
  },
  {
    title: "Header",
    rows: [
      { k: "show_header", t: "bool" },
      { k: "source", t: "select", o: Object.keys(KAIROS_SOURCES), dep: "show_header" },
      { k: "title", t: "text", dep: "show_header", only: ["source", "custom"] },
      { k: "icon", t: "text", dep: "show_header", only: ["source", "custom"] },
    ],
  },
  {
    title: "Data and view",
    open: true,
    rows: [
      {
        k: "day",
        t: "select",
        o: ["today", "tomorrow", "yesterday", ...KAIROS_RANGES],
      },
      { k: "auto_advance_tomorrow", t: "bool" },
      { k: "view", t: "seg", o: ["price", "heatmap", "breakdown"] },
      { k: "period", t: "seg", o: ["15min", "hour"], d: "15min" },
      { k: "chart_style", t: "seg", o: ["auto", "bars", "line"] },
    ],
  },
  {
    title: "Prices and VAT",
    rows: [
      { k: "vat", t: "bool" },
      { k: "vat_rate", t: "num", u: "%", min: 0, max: 100 },
      { k: "energy_tax", t: "num", u: "EUR/kWh", min: 0 },
      { k: "surcharge", t: "num", u: "EUR/kWh", min: 0 },
      { k: "fixed_price", t: "num", u: "EUR/kWh", min: 0 },
      { k: "fixed_label", t: "text" },
    ],
  },
  {
    title: "Units and formatting",
    rows: [
      { k: "unit", t: "text" },
      { k: "decimals", t: "num", min: 0, max: 6, int: true, ph: "Auto" },
      { k: "currency", t: "text" },
      { k: "currency_display", t: "select", o: ["symbol", "code", "none"] },
      { k: "time_format", t: "seg", o: ["auto", "12", "24"] },
      { k: "axis_am_pm", t: "bool" },
      { k: "axis_minutes", t: "bool" },
    ],
  },
  {
    title: "Highlights",
    rows: [
      {
        k: "cheapest_quarters",
        t: "num",
        u: "slots",
        min: 0,
        max: 96,
        int: true,
      },
      { k: "best_window_hours", t: "num", u: "h", min: 0, max: 24 },
      { k: "price_bands", t: "bands" },
    ],
  },
  {
    title: "Chart elements",
    rows: [
      { k: "show_chart", t: "bool" },
      { k: "show_hour_grid", t: "bool", dep: "show_chart" },
      { k: "show_now_marker", t: "bool", dep: "show_chart" },
      { k: "show_extremes", t: "bool", dep: "show_chart" },
      { k: "zoom_desktop", t: "bool", dep: "show_chart" },
      { k: "zoom_touch", t: "bool", dep: "show_chart" },
      { k: "zoom_buttons_desktop", t: "bool", dep: "zoom_desktop" },
      { k: "zoom_buttons_touch", t: "bool", dep: "zoom_touch" },
      { k: "show_average_line", t: "bool", dep: "show_chart" },
      { k: "average_line_size", t: "seg", o: ["small", "medium", "large"], dep: "show_average_line" },
      { k: "show_fixed_line", t: "bool", dep: "show_chart" },
      { k: "fixed_line_size", t: "seg", o: ["small", "medium", "large"], dep: "show_fixed_line" },
      { k: "heat_gradient", t: "seg", o: ["horizontal", "vertical"], dep: "show_chart" },
    ],
  },
  {
    title: "Summary sections",
    rows: [
      { k: "show_stats", t: "bool" },
      { k: "show_legend", t: "bool" },
    ],
  },
  {
    title: "Controls",
    rows: [
      { k: "show_controls", t: "bool" },
      { k: "show_day_button", t: "bool", dep: "show_controls" },
      { k: "show_period_button", t: "bool", dep: "show_controls" },
      { k: "show_chart_type_button", t: "bool", dep: "show_controls" },
      { k: "show_price_button", t: "bool", dep: "show_controls" },
      { k: "show_heatmap_button", t: "bool", dep: "show_controls" },
      { k: "show_breakdown_button", t: "bool", dep: "show_controls" },
      { k: "show_cheapest_stepper", t: "bool", dep: "show_controls" },
    ],
  },
  {
    title: "Opacity",
    rows: [
      { k: "price_bar_opacity", t: "num", u: "%", min: 0, max: 100, int: true },
      {
        k: "price_line_opacity",
        t: "num",
        u: "%",
        min: 0,
        max: 100,
        int: true,
      },
      {
        k: "heatmap_bar_opacity",
        t: "num",
        u: "%",
        min: 0,
        max: 100,
        int: true,
      },
      {
        k: "heatmap_line_opacity",
        t: "num",
        u: "%",
        min: 0,
        max: 100,
        int: true,
      },
      {
        k: "breakdown_bar_opacity",
        t: "num",
        u: "%",
        min: 0,
        max: 100,
        int: true,
      },
      {
        k: "breakdown_line_opacity",
        t: "num",
        u: "%",
        min: 0,
        max: 100,
        int: true,
      },
    ],
  },
  {
    title: "Appearance",
    rows: [
      { k: "color_scheme", t: "seg", o: ["auto", "light", "dark"] },
      { k: "display_mode_desktop", t: "select", o: KAIROS_MODES_SMALL },
      { k: "display_mode_touch", t: "select", o: KAIROS_MODES_SMALL },
      { k: "kiosk", t: "bool" },
      { k: "display_mode_kiosk", t: "select", o: KAIROS_MODES, dep: "kiosk" },
      { k: "pixel_shift", t: "bool" },
      { k: "editor_expand_sections", t: "bool" },
    ],
  },
  {
    title: "Experimental",
    rows: [
      { k: "edit_button", t: "bool", dep: "show_header" },
      { k: "edit_button_icon", t: "select", o: KAIROS_EDIT_ICONS, dep: "edit_button" },
      { k: "edit_link", t: "bool" },
      { k: "update_menu", t: "bool" },
      { k: "update_resource", t: "action", act: "update_resource" },
    ],
  },
];

const KAIROS_EDITOR_CSS = `
:host{display:block}
*,*::before,*::after{box-sizing:border-box}
.ed{--ease:cubic-bezier(.22,1,.36,1);--t-foot:13px;--t-sub:15px;font-family:-apple-system,BlinkMacSystemFont,
  "SF Pro Text",
  system-ui,"Segoe UI",Roboto,sans-serif;color:var(--label);display:flex;flex-direction:column;gap:12px;
    padding:4px 0 8px;
  -webkit-text-size-adjust:100%}
.sec .sh{all:unset;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;width:100%;
  min-height:44px;
  padding:0 16px;cursor:pointer;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--label2);
  -webkit-tap-highlight-color:transparent}
.sec .sh:focus-visible{outline:2px solid var(--accent);outline-offset:-2px;border-radius:10px}
.sec .sh .chev{width:18px;height:18px;transition:transform .25s var(--ease)}
.sec[data-open="true"] .sh .chev{transform:rotate(90deg)}
.body{display:grid;grid-template-rows:0fr;transition:grid-template-rows .3s var(--ease)}
.sec[data-open="true"] .body{grid-template-rows:1fr}
.body>.list{min-height:0;overflow:hidden;visibility:hidden;transition:visibility 0s .3s}
.sec[data-open="true"] .body>.list{visibility:visible;transition-delay:0s}
.list{background:var(--group);border-radius:12px}
.er{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;padding:8px 16px;
  font-size:var(--t-sub);transition:opacity .2s}
.er+.er{border-top:.5px solid var(--sep)}
.er.stack{flex-direction:column;align-items:stretch;gap:8px;padding-block:10px}
.er.off{opacity:.4}
.lb{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.lb .t{line-height:1.25}
.lb .d{font-size:var(--t-foot);line-height:1.3;color:var(--label2)}
.er.bad .lb .d{color:var(--red)}
.er input,.er select{min-height:36px;padding:4px 12px;border:0;border-radius:10px;background:var(--fill);
  color:var(--label);
  font:inherit;font-size:var(--t-sub);outline:none;transition:box-shadow .15s}
.er .abtn{flex:none;min-height:36px;padding:0 16px;border:0;border-radius:18px;background:var(--accent);color:#fff;
  font:inherit;font-size:var(--t-foot);font-weight:600;cursor:pointer}
.er .abtn:disabled{opacity:.5;cursor:default}
.er .abtn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.er input::placeholder{color:var(--label2);opacity:.8}
.er input:focus-visible,.er select:focus-visible{box-shadow:inset 0 0 0 2px var(--accent)}
.er input[aria-invalid="true"]{box-shadow:inset 0 0 0 2px var(--red)}
.er input.wide{width:100%;text-align:start}
.nf{display:flex;align-items:center;gap:8px;flex:none}
.nf input{width:96px;text-align:end;font-variant-numeric:tabular-nums}
.nf .u{flex:none;width:58px;font-size:var(--t-foot);color:var(--label2);white-space:nowrap}
.sl{position:relative;flex:none;max-width:60%}
.sl select{appearance:none;-webkit-appearance:none;width:100%;padding-inline-end:30px;text-align:start;cursor:pointer}
.sl svg{position:absolute;inset-inline-end:10px;top:50%;width:14px;height:14px;margin-top:-7px;color:var(--label2);
  pointer-events:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.er.stack .seg{width:100%}
.er:not(.stack) .seg{flex:none;min-width:150px}
.er .sw{min-height:44px;flex:none}.er .sw .swl{display:none}
.er:has(.sw) .lb{cursor:default}
.foot{padding:4px 16px 0;text-align:center;font-size:12px;color:var(--label2)}
@media (pointer:coarse){.er input,.er select{font-size:16px;min-height:44px}}
@media (prefers-reduced-motion:reduce){.body,.sec .sh .chev,.er{transition:none}}
@media (prefers-contrast:more){.er+.er{border-top-color:var(--label2)}.list{box-shadow:inset 0 0 0 1px var(--label2)}}
${KAIROS_CSS_CTL}
`;

/** Visual editor: collapsible inset-grouped sections with iOS-style rows. */
class KairosCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._hass = null;
    this._built = false;
    // Expanded sections (by title); the first sections start open.
    this._open = new Set(KAIROS_FORM.filter((x) => x.open).map((x) => x.title));
    this.attachShadow({ mode: "open" });
  }

  setConfig(config) {
    this._config = { ...config };
    if (!this._built) this._build();
    else this._sync();
  }

  set hass(hass) {
    this._hass = hass;
    // The language is only known once Home Assistant passes `hass`: build the texts again when it differs.
    if (this._built && this._builtLang !== this._lang()) this._build();
    this.shadowRoot.querySelectorAll("[data-picker]").forEach((picker) => (picker.hass = hass));
    this._applyScheme();
    if (!this._resChecked && hass) {
      this._resChecked = true;
      this._checkResource();
    }
  }

  _applyScheme() {
    const dark = !!(this._hass && this._hass.themes && this._hass.themes.darkMode);
    const tok = this.shadowRoot.getElementById("tok");
    if (tok) tok.textContent = kairosTokens(dark ? "dark" : "light", true);
  }

  _loc() {
    const h = this._hass;
    return (
      (h && ((h.locale && h.locale.language) || h.language)) ||
      (typeof navigator !== "undefined" && navigator.language) ||
      "en"
    );
  }

  _lang() {
    return String(this._loc()).toLowerCase().split("-")[0];
  }

  /** Editor text of a group (label, hint, opt, section, ui) in the language of Home Assistant, else English. */
  _e(group, key) {
    const d = KAIROS_ED[this._lang()] || KAIROS_ED.en;
    return (d[group] && d[group][key]) || KAIROS_ED.en[group][key];
  }

  /** A button text or message of the editor; `{name}` placeholders are filled from `vars`. */
  _u(key, vars) {
    return kairosFmt(this._e("ui", key), vars);
  }

  /** Text of an error: an editor message when it has a key, else its own message. */
  _errText(err) {
    return err && err.kairosKey ? this._u(err.kairosKey, err.kairosVars) : String((err && err.message) || err);
  }

  _label(k) {
    const t = this._e("label", k);
    if (t) return t;
    const s = k.replace(/_/g, " ");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /** Label of an option value; the start day (`row` day) has its own texts such as "This week". */
  _optLabel(o, row) {
    return (row === "day" && this._e("opt", "day:" + o)) || this._e("opt", String(o)) || this._label(o);
  }

  _section(title) {
    return this._e("section", title) || title;
  }

  _val(k, row) {
    const v = this._config[k];
    // The period follows the start day: a stored value that does not apply to it shows the default of that day.
    if (k === "period") {
      const pf = kairosPeriodsFor(this._config.day ?? KAIROS_DEFAULTS.day);
      return pf.o.includes(v) ? v : pf.d;
    }
    if (v !== undefined) return v;
    return row && row.d !== undefined ? row.d : KAIROS_DEFAULTS[k];
  }

  /** Sections that are open: all of them, or only the ones marked `open` when the option is off. */
  _openSet() {
    const all = this._config.editor_expand_sections !== false;
    return new Set(KAIROS_FORM.filter((x) => all || x.open).map((x) => x.title));
  }

  /** Applies the expand option to every section, as the user flips it. */
  _applyOpen() {
    this._open = this._openSet();
    this.shadowRoot.querySelectorAll(".sec").forEach((sec) => {
      const open = this._open.has(KAIROS_FORM[Number(sec.dataset.sec)].title);
      sec.dataset.open = String(open);
      const b = sec.querySelector(".sh");
      if (b) b.setAttribute("aria-expanded", String(open));
    });
  }

  _build() {
    this._built = true;
    this._builtLang = this._lang();
    this._open = this._openSet();
    const esc = kairosEsc;
    const chevrons =
      `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9.5 5-4.5 5 4.5M7 14.5l5 4.5 5-4.5"/>` + `</svg>`;
    const rowHtml = (r) => {
      const label = esc(this._label(r.k));
      const hint = esc(this._e("hint", r.k) || "");
      const ph = KAIROS_DEFAULTS[r.k] !== undefined && KAIROS_DEFAULTS[r.k] !== null ? esc(KAIROS_DEFAULTS[r.k]) : "";
      // Wide controls sit below their label; compact ones on the right (like iOS Settings).
      const stack = ["entity", "list", "text", "bands"].includes(r.t) || (r.t === "seg" && r.o.length > 2);
      let ctl = "";
      if (r.t === "seg") {
        ctl =
          `<div class="seg" role="radiogroup" aria-label="${label}" data-g="${r.k}" style="--n:${r.o.length}">` +
          `<span class="th"></span>` +
          r.o
            .map(
              (o) =>
                `<button type="button" role="radio" aria-checked="false" data-k="${r.k}" data-v="${o}">` +
                `${esc(this._optLabel(o, r.k))}</button>`,
            )
            .join("") +
          `</div>`;
      } else if (r.t === "bool") {
        ctl =
          `<button type="button" class="sw" role="switch" aria-checked="false" data-b="${r.k}" aria-label="${label}">` +
          `<span class="swl">${label}</span><span class="track"><span class="mark"></span><span class="k"></span>` +
          `</span></button>`;
      } else if (r.t === "select") {
        ctl =
          `<div class="sl"><select data-s="${r.k}" aria-label="${label}">` +
          r.o.map((o) => `<option value="${o}">${esc(this._optLabel(o, r.k))}</option>`).join("") +
          `</select>${chevrons}</div>`;
      } else if (r.t === "num") {
        ctl =
          `<div class="nf"><input type="text" inputmode="decimal" data-n="${r.k}" aria-label="${label}" ` +
          `placeholder="${esc(r.ph || "")}" ` +
          `aria-describedby="d-${r.k}"><span class="u" aria-hidden="true">${r.u ? esc(r.u) : ""}</span></div>`;
      } else if (r.t === "action") {
        ctl =
          `<button type="button" class="abtn" data-do="${r.act || r.k}" data-step="check">` +
          `${this._u("check")}</button>`;
      } else if (r.t === "list") {
        ctl = `<input type="text" class="wide" data-l="${r.k}" aria-label="${label}" placeholder="sensor.a, sensor.b">`;
      } else if (r.t === "bands") {
        ctl = `<input type="text" class="wide" data-bd="${r.k}" aria-label="${label}" placeholder="auto">`;
      } else if (r.t === "entity") {
        ctl = customElements.get("ha-entity-picker")
          ? `<ha-entity-picker data-picker="${r.k}" allow-custom-entity></ha-entity-picker>`
          : `<input type="text" class="wide" data-t="${r.k}" aria-label="${label}" placeholder="${ph}">`;
      } else {
        ctl = `<input type="text" class="wide" data-t="${r.k}" aria-label="${label}" placeholder="${ph}">`;
      }
      const num = r.t === "num" ? ` data-min="${r.min ?? ""}" data-max="${r.max ?? ""}" data-int="${!!r.int}"` : "";
      return (
        `<div class="er${stack ? " stack" : ""}" data-row="${r.k}"${r.dep ? ` data-dep="${r.dep}"` : ""}` +
        `${r.only ? ` data-only="${r.only.join("=")}"` : ""}${num}>` +
        `<div class="lb"><span class="t">${label}</span>` +
        `<span class="d" id="d-${r.k}" ` +
        `data-hint="${hint}"${r.t === "action" ? ' aria-live="polite"' : ""}>${hint}</span></div>${ctl}</div>`
      );
    };
    const chev =
      `<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ` +
      `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9.5 5.5 6.5 6.5-6.5 6.5"/></svg>`;
    this.shadowRoot.innerHTML =
      `<style id="tok"></style><style>${KAIROS_EDITOR_CSS}</style><div class="ed">` +
      KAIROS_FORM.map((sec, i) => {
        const open = this._open.has(sec.title);
        return (
          `<div class="sec" data-sec="${i}" data-open="${open}">` +
          `<button type="button" class="sh" aria-expanded="${open}" aria-controls="sec-${i}">` +
          `<span>${esc(this._section(sec.title))}</span>${chev}</button>` +
          `<div class="body"><div class="list" id="sec-${i}" role="group" ` +
          `aria-label="${esc(this._section(sec.title))}">${sec.rows.map(rowHtml).join("")}</div></div></div>`
        );
      }).join("") +
      `<div class="foot">Kairos · v${KAIROS_VERSION}</div></div>`;
    this._applyScheme();
    const root = this.shadowRoot;
    if (!this._wired) this._wire(root);
    root.querySelectorAll("[data-picker]").forEach((picker) => {
      picker.hass = this._hass;
      picker.includeDomains = ["sensor"];
    });
    this._sync();
  }

  /** Attaches the event handlers of the editor once; they work on the rows, which are built again on a new language. */
  _wire(root) {
    this._wired = true;
    root.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.classList.contains("sh")) {
        const sec = b.closest(".sec");
        const open = sec.dataset.open !== "true";
        sec.dataset.open = String(open);
        b.setAttribute("aria-expanded", String(open));
        const title = KAIROS_FORM[Number(sec.dataset.sec)].title;
        if (open) this._open.add(title);
        else this._open.delete(title);
        return;
      }
      if (b.disabled) return;
      if (b.dataset.do) this._runAction(b);
      else if (b.dataset.k) this._set(b.dataset.k, b.dataset.v);
      else if (b.dataset.b) this._set(b.dataset.b, b.getAttribute("aria-checked") !== "true");
    });
    // Numbers are checked while typing: an out-of-range value is flagged and never reaches the card.
    root.addEventListener("input", (e) => {
      const t = e.target;
      if (t.dataset && t.dataset.n) this._checkNum(t);
    });
    root.addEventListener("change", (e) => {
      const t = e.target;
      if (t.dataset.s) this._set(t.dataset.s, t.value);
      else if (t.dataset.t) this._set(t.dataset.t, t.value.trim());
      else if (t.dataset.l) {
        const list = t.value
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
        this._set(t.dataset.l, list.length ? list : undefined);
      } else if (t.dataset.bd) {
        const v = t.value.trim().toLowerCase();
        const nums = v.split(/[\s,;]+/).map((x) => parseFloat(x.replace(",", ".")));
        const ok = v === "" || v === "auto" || (nums.length === 2 && nums.every(Number.isFinite));
        this._flag(t, !ok, this._u("enter_bands"));
        if (v === "" || v === "auto") this._set(t.dataset.bd, undefined);
        else if (ok) this._set(t.dataset.bd, nums);
      } else if (t.dataset.n) {
        const n = this._checkNum(t);
        if (n !== false) this._set(t.dataset.n, n);
      }
    });
    root.addEventListener("value-changed", (e) => {
      const p = e.target.closest && e.target.closest("[data-picker]");
      if (p) {
        e.stopPropagation();
        this._set(p.dataset.picker, e.detail && e.detail.value);
      }
    });
  }

  /** Marks a row invalid (red outline, message in place of the hint) or clears it. */
  _flag(input, bad, msg) {
    const row = input.closest(".er");
    const d = row && row.querySelector(".d");
    input.setAttribute("aria-invalid", String(bad));
    if (row) row.classList.toggle("bad", bad);
    if (d) d.textContent = bad ? msg : d.dataset.hint;
  }

  /** Parses and validates a number field: returns the number, undefined (empty), or false (invalid). */
  _checkNum(input) {
    const row = input.closest(".er");
    const raw = input.value.trim().replace(",", ".");
    const min = row.dataset.min === "" ? -Infinity : Number(row.dataset.min);
    const max = row.dataset.max === "" ? Infinity : Number(row.dataset.max);
    const int = row.dataset.int === "true";
    if (raw === "") {
      this._flag(input, false);
      return undefined;
    }
    const n = Number(raw);
    const range = Number.isFinite(min) && Number.isFinite(max) ? this._u("range", { min, max }) : "";
    const ok = Number.isFinite(n) && n >= min && n <= max && (!int || Number.isInteger(n));
    this._flag(input, !ok, this._u(int ? "enter_int" : "enter_num", { range }));
    return ok ? n : false;
  }

  _set(key, val) {
    const c = { ...this._config };
    if (val === undefined || val === null || val === "") delete c[key];
    else c[key] = val;
    // A period that does not apply to the new start day goes back to that day's default.
    if (
      key === "day" &&
      c.period !== undefined &&
      !kairosPeriodsFor(c.day ?? KAIROS_DEFAULTS.day).o.includes(c.period)
    ) {
      delete c.period;
    }
    this._config = c;
    if (key === "editor_expand_sections") this._applyOpen();
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: c },
        bubbles: true,
        composed: true,
      }),
    );
    this._sync();
  }

  /** Shows a message on every row of the update action; `bad` marks an error. */
  _resNote(text, bad) {
    this.shadowRoot.querySelectorAll('[data-do="update_resource"]').forEach((btn) => {
      const row = btn.closest(".er");
      row.classList.toggle("bad", !!bad);
      row.querySelector(".d").textContent = text;
    });
  }

  /** The card dialog of Home Assistant that holds this editor, found through the shadow roots, or null. */
  _dialog() {
    let n = this;
    for (;;) {
      const root = n.getRootNode();
      if (!root || !root.host) return null;
      if (root.host.tagName === "HUI-DIALOG-EDIT-CARD") return root.host;
      n = root.host;
    }
  }

  /**
   * Closes the card dialog: presses Save when there are changes, and Cancel when there is nothing to save (Save is
   * disabled). Waits until the dialog has closed. Returns false when it did not close.
   */
  async _saveDialog(dlg) {
    const box = dlg.shadowRoot && dlg.shadowRoot.querySelector('[slot="primaryAction"]');
    const btns = box ? [...box.querySelectorAll("ha-button, mwc-button, button")] : [];
    if (!btns.length) return true;
    const save = btns[btns.length - 1];
    const off = save.disabled || save.hasAttribute("disabled");
    (off ? btns[0] : save).click();
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 200));
      if (!dlg.isConnected || !dlg.shadowRoot || !dlg.shadowRoot.querySelector('[slot="primaryAction"]')) return true;
    }
    return false;
  }

  _href() {
    return window.location.href;
  }

  _pressDone() {
    return kairosPressDone();
  }

  /** Leaves the dashboard edit mode by removing `?edit=1` from the address. Returns the new address or null. */
  _leaveEditMode() {
    const url = new URL(this._href());
    if (!url.searchParams.has("edit")) return null;
    url.searchParams.delete("edit");
    const next = url.pathname + url.search + url.hash;
    window.history.replaceState(window.history.state, "", next);
    window.dispatchEvent(
      new CustomEvent("location-changed", { detail: { replace: true }, bubbles: true, composed: true }),
    );
    return next;
  }

  /** Loads the page again so the browser takes the resource with the new `?v=`; with an address it loads that one. */
  _reloadPage(url) {
    if (url) window.location.replace(url);
    else window.location.reload();
  }

  /** Reload: save the card, leave the dashboard edit mode, then reload the page. */
  async _reload() {
    const dlg = this._dialog();
    if (dlg) {
      this._resNote(this._u("saving"));
      if (!(await this._saveDialog(dlg))) {
        this._resNote(this._u("not_saved"), true);
        return;
      }
    }
    // Done ends the edit mode the way the user would; the address is cleaned up as well, whatever happens.
    const pressed = this._pressDone();
    await new Promise((r) => setTimeout(r, pressed ? 600 : 300));
    const url = this._leaveEditMode();
    await new Promise((r) => setTimeout(r, 300));
    // The page loads from the address without `?edit=1`, so it starts outside the edit mode; the flag lets the
    // new page press Done again if Home Assistant brings the edit mode back.
    try {
      window.sessionStorage.setItem(KAIROS_EXIT_EDIT_KEY, String(Date.now()));
    } catch (e) {
      /* storage is optional */
    }
    this._reloadPage(url);
  }

  /** Tells whether the resource is behind the file on the server; the buttons stay usable either way. */
  async _checkResource() {
    this._resNote(this._u("checking"));
    try {
      const st = await kairosCheckResource(this._hass);
      this._setStep(st.available ? "update" : "check");
      this._resNote(this._u(st.available ? "update_available" : "up_to_date", { version: st.version }));
    } catch (err) {
      this._resNote(this._errText(err), true);
    }
  }

  /** Sets the step of the smart button on every row: `check`, then `update`, then `reload` (like a revolving door). */
  _setStep(step) {
    this._resStep = step;
    this.shadowRoot.querySelectorAll('[data-do="update_resource"]').forEach((b) => {
      b.dataset.step = step;
      b.textContent = this._u(step);
    });
  }

  /** Runs an action row: the smart button does the step it shows (check, update, or reload). */
  async _runAction() {
    const all = this.shadowRoot.querySelectorAll(".abtn");
    all.forEach((b) => (b.disabled = true));
    const step = this._resStep || "check";
    try {
      if (step === "check") await this._checkResource();
      else if (step === "reload") await this._reload();
      else {
        this._resNote(this._u("working"));
        const res = await kairosUpdateResource(this._hass);
        // An update that was not needed (the resource was already current) goes back to Check.
        this._setStep(res.key === "up_to_date" ? "check" : "reload");
        this._resNote(this._u(res.key, { version: res.version }));
      }
    } catch (err) {
      this._resNote(this._errText(err), true);
    }
    all.forEach((b) => (b.disabled = false));
  }

  /** Shows only the periods that apply to the start day. */
  _syncPeriod() {
    const seg = this.shadowRoot.querySelector('.seg[data-g="period"]');
    if (!seg) return;
    const opts = kairosPeriodsFor(this._config.day ?? KAIROS_DEFAULTS.day).o;
    if (seg.dataset.o === opts.join()) return;
    seg.dataset.o = opts.join();
    seg.style.setProperty("--n", opts.length);
    seg.innerHTML =
      `<span class="th"></span>` +
      opts
        .map(
          (o) =>
            `<button type="button" role="radio" aria-checked="false" data-k="period" data-v="${o}">` +
            `${this._optLabel(o, "period")}</button>`,
        )
        .join("");
    const row = seg.closest(".er");
    if (row) row.classList.toggle("stack", opts.length > 2);
  }

  /** Updates values in place so inputs keep focus while the user types. */
  _sync() {
    const root = this.shadowRoot;
    const rows = {};
    KAIROS_FORM.forEach((s) => s.rows.forEach((r) => (rows[r.k] = r)));
    this._syncPeriod();
    root.querySelectorAll(".seg").forEach((seg) => {
      const v = String(this._val(seg.dataset.g, rows[seg.dataset.g]));
      const btns = [...seg.querySelectorAll("button")];
      const idx = btns.findIndex((b) => b.dataset.v === v);
      btns.forEach((b, i) => b.setAttribute("aria-checked", String(i === idx)));
      seg.style.setProperty("--i", Math.max(0, idx));
      seg.classList.toggle("none", idx < 0);
    });
    root.querySelectorAll("[data-b]").forEach((b) => b.setAttribute("aria-checked", String(!!this._val(b.dataset.b))));
    const active = root.activeElement;
    root.querySelectorAll("[data-s],[data-t],[data-n]").forEach((el) => {
      // A field with an invalid entry keeps what the user typed, so the message stays next to it.
      if (el === active || el.getAttribute("aria-invalid") === "true") return;
      const k = el.dataset.s || el.dataset.t || el.dataset.n;
      const v = this._config[k];
      el.value =
        v === undefined || v === null
          ? el.dataset.n
            ? String(KAIROS_DEFAULTS[k] ?? "")
            : el.dataset.s
              ? String(KAIROS_DEFAULTS[k])
              : ""
          : String(v);
      if (el.dataset.n) this._flag(el, false);
    });
    root.querySelectorAll("[data-l]").forEach((el) => {
      if (el === active) return;
      const v = this._config[el.dataset.l];
      el.value = Array.isArray(v) ? v.join(", ") : "";
    });
    root.querySelectorAll("[data-bd]").forEach((el) => {
      if (el === active || el.getAttribute("aria-invalid") === "true") return;
      const v = this._config[el.dataset.bd];
      el.value = Array.isArray(v) ? v.join(", ") : v && typeof v === "object" ? `${v.low}, ${v.high}` : "";
      this._flag(el, false);
    });
    root.querySelectorAll("[data-picker]").forEach((picker) => {
      picker.value = this._config[picker.dataset.picker] || this._val(picker.dataset.picker) || "";
    });
    // The Update section at the top of the editor follows the `update_menu` option.
    const top = root.querySelector('[data-row="update_resource_top"]');
    const topSec = top && top.closest(".sec");
    if (topSec) topSec.style.display = this._val("update_menu") ? "" : "none";
    // Rows that belong to one value of another option (title and icon: source custom) are hidden for the others.
    root.querySelectorAll(".er[data-only]").forEach((row) => {
      const [k, v] = row.dataset.only.split("=");
      row.style.display = String(this._val(k)) === v ? "" : "none";
    });
    // Rows that depend on another option are greyed out and inert while it is off.
    root.querySelectorAll(".er[data-dep]").forEach((row) => {
      const off = !this._val(row.dataset.dep);
      row.classList.toggle("off", off);
      row.querySelectorAll("input,select,button").forEach((el) => {
        el.disabled = off;
      });
    });
  }
}

KairosCard.guardEditMode = kairosGuardEditMode;
{
  let flag = 0;
  try {
    flag = Number(window.sessionStorage.getItem(KAIROS_EXIT_EDIT_KEY) || 0);
    window.sessionStorage.removeItem(KAIROS_EXIT_EDIT_KEY);
  } catch (e) {
    flag = 0;
  }
  kairosGuardEditMode(flag, () => window.location.href);
}

if (!customElements.get("kairos-card")) {
  customElements.define("kairos-card", KairosCard);
}
if (!customElements.get("kairos-card-editor")) {
  customElements.define("kairos-card-editor", KairosCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "kairos-card")) {
  window.customCards.push({
    type: "kairos-card",
    name: "Kairos",
    description: "Price, heatmap, or breakdown chart (bar, line) for day-ahead electricity prices.",
    preview: true,
  });
}

console.info(`%c KAIROS-CARD %c v${KAIROS_VERSION} `, "color:white;background:#8e44ad", "");
