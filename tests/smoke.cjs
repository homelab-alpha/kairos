"use strict";

/**
 * Browser smoke test: the card renders, the views switch, and the editor lays out and behaves.
 * Run with `npm run test:smoke` (needs Chromium: `npx playwright install chromium`).
 */

const { launch, installMock, installEditor, quarterSlots } = require("./helpers/mock_hass.cjs");

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  ${detail}`}`);
  if (!ok) failed += 1;
}

async function testCard() {
  const { browser, page, errors } = await launch();
  await installMock(page);
  const info = await page.evaluate(() => {
    const root = window.card.shadowRoot;
    return {
      bars: root.querySelectorAll(".bar-el").length,
      version: window.card.constructor.name,
      views: [...root.querySelectorAll('[data-g="view"] button')].map((b) => b.dataset.v),
    };
  });
  check("card renders price bars", info.bars > 0, JSON.stringify(info));
  for (const view of info.views) {
    await page.evaluate((v) => window.card.shadowRoot.querySelector(`[data-g="view"] [data-v="${v}"]`).click(), view);
    await page.waitForTimeout(300);
  }
  check("every view switches without errors", errors.length === 0, errors.join(" | "));
  await browser.close();
}

async function testDisplayMode() {
  const cases = [
    ["desktop auto at 600 px is compact", 600, false, {}, "compact"],
    ["desktop auto at 900 px is regular", 900, false, {}, "regular"],
    ["desktop auto at 1800 px is regular", 1800, false, {}, "regular"],
    ["desktop option applies with a mouse", 1200, false, { display_mode_desktop: "compact" }, "compact"],
    ["touch option is ignored with a mouse", 1200, false, { display_mode_touch: "compact" }, "regular"],
    ["touch option applies on a touch screen", 1200, true, { display_mode_touch: "compact" }, "compact"],
    ["desktop option is ignored on a touch screen", 1200, true, { display_mode_desktop: "compact" }, "regular"],
    ["kiosk auto at 600 px is compact", 600, false, { kiosk: true }, "compact"],
    ["kiosk auto at 900 px is regular", 900, false, { kiosk: true }, "regular"],
    ["kiosk auto at 1200 px is large", 1200, false, { kiosk: true }, "large"],
    ["kiosk auto at 1800 px is kiosk", 1800, false, { kiosk: true }, "kiosk"],
    ["kiosk option applies", 600, false, { kiosk: true, display_mode_kiosk: "large" }, "large"],
    ["kiosk wins over the desktop option", 1200, false, { kiosk: true, display_mode_desktop: "compact" }, "large"],
    ["kiosk wins on a touch screen", 1200, true, { kiosk: true, display_mode_touch: "compact" }, "large"],
    ["kiosk option is ignored without the kiosk switch", 1200, false, { display_mode_kiosk: "kiosk" }, "regular"],
  ];
  for (const [name, width, touch, config, want] of cases) {
    const { browser, page, errors } = await launch({ width, height: 800 }, touch ? { hasTouch: true } : {});
    await installMock(page, config);
    const got = await page.evaluate(() => window.card.shadowRoot.querySelector(".kairos").getAttribute("data-mode"));
    check(name, got === want && errors.length === 0, `got ${got} ${errors.join(" | ")}`);
    await browser.close();
  }
  const { browser, page } = await launch();
  await installMock(page);
  const rejected = await page.evaluate(() => {
    const out = {};
    for (const key of ["display_mode_desktop", "display_mode_touch"]) {
      try {
        window.card.setConfig({ entity: "sensor.prices", [key]: "large" });
        out[key] = false;
      } catch (err) {
        out[key] = true;
      }
    }
    try {
      window.card.setConfig({ entity: "sensor.prices", display_mode_kiosk: "large" });
      out.kiosk = true;
    } catch (err) {
      out.kiosk = false;
    }
    return out;
  });
  check(
    "large is rejected for desktop and touch, accepted for kiosk",
    rejected.display_mode_desktop && rejected.display_mode_touch && rejected.kiosk,
    JSON.stringify(rejected),
  );
  await browser.close();
}

async function testEditButton() {
  const has = (page) => page.evaluate(() => !!window.card.shadowRoot.querySelector('[data-act="edit"]'));
  let ctx = await launch();
  await installMock(ctx.page);
  check("no edit button by default", !(await has(ctx.page)));
  await ctx.browser.close();

  ctx = await launch();
  await installMock(ctx.page, { edit_button: true }, { user: { is_admin: false } });
  check("no edit button for non-admins", !(await has(ctx.page)));
  await ctx.browser.close();

  ctx = await launch();
  await installMock(ctx.page, { edit_button: true }, { user: { is_admin: true } });
  check("edit button shows when enabled", await has(ctx.page));
  const first = await ctx.page.evaluate(() => {
    window.__pushed = null;
    window.history.pushState = (s, t, u) => (window.__pushed = u);
    window.__events = [];
    document.addEventListener("ll-edit-card", (e) => window.__events.push(e.detail.path));
    window.card.shadowRoot.querySelector('[data-act="edit"]').click();
    return { pushed: window.__pushed, events: window.__events.length };
  });
  check(
    "the first press turns the dashboard edit mode on and fires nothing yet",
    /[?&]edit=1/.test(first.pushed || "") && first.events === 0,
    JSON.stringify(first),
  );
  await ctx.page.waitForTimeout(500);
  await ctx.page.evaluate(() => {
    document.getElementById("host").path = [0, 1, 2];
  });
  await ctx.page.waitForTimeout(600);
  const fired = await ctx.page.evaluate(() => window.__events);
  check(
    "ll-edit-card is fired once the card path shows up",
    JSON.stringify(fired) === "[[0,1,2]]",
    JSON.stringify(fired),
  );
  await ctx.page.waitForTimeout(600);
  const again = await ctx.page.evaluate(() => window.__events.length);
  check("the event is fired only once", again === 1, String(again));
  const direct = await ctx.page.evaluate(() => {
    window.__pushed = null;
    window.card.shadowRoot.querySelector('[data-act="edit"]').click();
    return window.__pushed;
  });
  await ctx.page.waitForTimeout(400);
  const total = await ctx.page.evaluate(() => window.__events.length);
  check(
    "with a known card path the button fires at once and leaves the URL alone",
    direct === null && total === 2,
    JSON.stringify({ direct, total }),
  );
  const moved = await ctx.page.evaluate(async () => {
    // The card is created again after the edit mode starts: the new instance must finish the job.
    document.getElementById("host").path = undefined;
    window.__events.length = 0;
    window.card.shadowRoot.querySelector('[data-act="edit"]').click();
    const old = window.card;
    const fresh = old.cloneNode(false);
    fresh.setConfig(old._config);
    fresh.hass = old._hass;
    old.remove();
    document.getElementById("host").appendChild(fresh);
    await new Promise((r) => setTimeout(r, 300));
    document.getElementById("host").path = [0, 3];
    await new Promise((r) => setTimeout(r, 600));
    return window.__events.slice();
  });
  check(
    "a card created again after the press fires the event",
    JSON.stringify(moved) === "[[0,3]]",
    JSON.stringify(moved),
  );
  const iconOf = async (config) => {
    const c = await launch();
    await installMock(c.page, { edit_button: true, ...config });
    const d = await c.page.evaluate(() => {
      const svg = window.card.shadowRoot.querySelector('[data-act="edit"] svg');
      return { gear: !!svg.querySelector("path[d*='A7.3']"), circles: svg.querySelectorAll("circle").length };
    });
    await c.browser.close();
    return d;
  };
  const sliders = await iconOf({});
  const gear = await iconOf({ edit_button_icon: "gear" });
  check(
    "the edit button shows the sliders icon by default",
    !sliders.gear && sliders.circles === 2,
    JSON.stringify(sliders),
  );
  check("edit_button_icon gear shows the gear icon", gear.gear && gear.circles === 0, JSON.stringify(gear));
  const shapes = new Set();
  for (const icon of ["sliders", "gear", "pencil", "pencil_square"]) {
    const c = await launch();
    await installMock(c.page, { edit_button: true, edit_button_icon: icon });
    shapes.add(await c.page.evaluate(() => window.card.shadowRoot.querySelector('[data-act="edit"] svg').innerHTML));
    await c.browser.close();
  }
  check("every edit button icon draws its own shape", shapes.size === 4, String(shapes.size));
  const bad = await ctx.page.evaluate(() => {
    try {
      window.card.setConfig({ entity: "sensor.prices", edit_button_icon: "wrench" });
      return false;
    } catch (err) {
      return true;
    }
  });
  check("an unknown edit button icon is rejected", bad);
  const linkOf = async (config, mock) => {
    const c = await launch();
    await installMock(c.page, config, mock);
    const d = await c.page.evaluate(() => {
      const r = window.card.shadowRoot;
      const link = r.querySelector('.foot [data-act="edit"]');
      const foot = r.querySelector(".foot");
      if (!link) return { link: false, header: !!r.querySelector('.head [data-act="edit"]') };
      const lb = link.getBoundingClientRect();
      const fb = foot.getBoundingClientRect();
      window.__pushed = null;
      window.history.pushState = (s, t, u) => (window.__pushed = u);
      link.click();
      return {
        link: true,
        text: link.textContent.trim(),
        gap: Math.round(fb.right - lb.right),
        accent: (() => {
          const probe = document.createElement("span");
          probe.style.color = "var(--accent)";
          foot.appendChild(probe);
          const col = getComputedStyle(probe).color;
          probe.remove();
          return getComputedStyle(link).color === col;
        })(),
        underlined: getComputedStyle(link).textDecorationLine.includes("underline"),
        header: !!r.querySelector('.head [data-act="edit"]'),
        pushed: window.__pushed,
      };
    });
    await c.browser.close();
    return d;
  };
  const noLink = await linkOf({});
  check("no edit link by default", noLink.link === false, JSON.stringify(noLink));
  const link = await linkOf({ edit_link: true }, { user: { is_admin: true } });
  check(
    "the edit link sits at the right of the footer and says Edit",
    link.link && link.text === "Edit" && link.gap <= 1 && !link.header,
    JSON.stringify(link),
  );
  check(
    "the edit link has the link color of Show data, without underline",
    link.accent && !link.underlined,
    JSON.stringify(link),
  );
  check("the edit link starts the editor like the button", /[?&]edit=1/.test(link.pushed || ""), JSON.stringify(link));
  const hidden = await linkOf({ edit_link: true }, { user: { is_admin: false } });
  check("no edit link for non-admins", hidden.link === false, JSON.stringify(hidden));
  check("edit button has no page errors", ctx.errors.length === 0, ctx.errors.join(" | "));
  await ctx.browser.close();
}

async function testSummary() {
  for (const [label, tomorrow, day] of [
    ["today", false, "today"],
    ["tomorrow", true, "tomorrow"],
  ]) {
    const { browser, page, errors } = await launch({ width: 1300, height: 900 });
    await installMock(page, { view: "heatmap", cheapest_quarters: 20, day }, { tomorrow });
    const info = await page.evaluate(() => {
      const root = window.card.shadowRoot;
      const q = (s) => root.querySelector(s);
      return {
        summary: !!q(".csum"),
        total: q(".cs-dur") ? q(".cs-dur").textContent : "",
        windowCard: !!q(".cs-next"),
        readout: !!root.getElementById("readout"),
      };
    });
    check(
      `cheapest summary renders (${label})`,
      info.summary && info.windowCard && info.total === "5 h",
      JSON.stringify(info),
    );
    check(`no selection readout (${label})`, !info.readout);
    check(`cheapest summary has no page errors (${label})`, errors.length === 0, errors.join(" | "));
    await browser.close();
  }
}

async function testGradient() {
  for (const [type, style] of [
    ["horizontal", "bars"],
    ["vertical", "bars"],
    ["vertical", "line"],
  ]) {
    const { browser, page, errors } = await launch({ width: 1300, height: 900 });
    await installMock(page, { view: "heatmap", heat_gradient: type, chart_style: style });
    const info = await page.evaluate(() => {
      const root = window.card.shadowRoot;
      const bars = [...root.querySelectorAll(".bar-el")];
      return {
        grad: !!root.getElementById("kairos-grad"),
        fills: new Set(bars.map((b) => b.getAttribute("fill"))).size,
        urlFill: bars.some((b) => (b.getAttribute("fill") || "").startsWith("url(")),
      };
    });
    const ok =
      style === "line"
        ? info.grad
        : type === "horizontal"
          ? info.grad && info.urlFill
          : !info.grad && !info.urlFill && info.fills > 1;
    check(`heatmap gradient ${type} (${style})`, ok && errors.length === 0, JSON.stringify(info) + errors.join(" | "));
    await browser.close();
  }
}

async function testAverageLine() {
  for (const [size, want] of [
    ["small", "1.25"],
    ["large", "4"],
  ]) {
    const { browser, page, errors } = await launch({ width: 1300, height: 900 });
    await installMock(page, { view: "heatmap", show_average_line: true, average_line_size: size });
    const got = await page.evaluate(() => {
      const l = window.card.shadowRoot.querySelector("line.ref");
      return l ? l.style.strokeWidth : null;
    });
    check(`average line size ${size}`, got === want && errors.length === 0, `got ${got} ${errors.join(" | ")}`);
    await browser.close();
  }
}

async function testFixedLine() {
  for (const [size, want] of [
    ["small", "2"],
    ["large", "5"],
  ]) {
    const { browser, page, errors } = await launch({ width: 1300, height: 900 });
    await installMock(page, { view: "heatmap", show_fixed_line: true, fixed_line_size: size, fixed_price: 0.15936 });
    const got = await page.evaluate(() => {
      const l = window.card.shadowRoot.querySelector('line[stroke-dasharray^="0.1"]');
      return l ? l.getAttribute("stroke-width") : null;
    });
    check(`fixed line size ${size}`, got === want && errors.length === 0, `got ${got} ${errors.join(" | ")}`);
    await browser.close();
  }
  const { browser, page, errors } = await launch({ width: 1300, height: 900 });
  await installMock(page, { view: "heatmap", show_fixed_line: true });
  const none = await page.evaluate(() => ({
    line: !!window.card.shadowRoot.querySelector('line[stroke-dasharray^="0.1"]'),
    tax: window.card._config.energy_tax,
    price: window.card._config.fixed_price,
  }));
  check(
    "no fixed line and no energy tax by default",
    !none.line && none.tax === 0 && none.price === 0 && errors.length === 0,
    JSON.stringify(none),
  );
  await browser.close();
}

async function testScrollStays() {
  const { browser, page, errors } = await launch({ width: 1300, height: 700 });
  await installMock(page, { view: "heatmap" });
  await page.evaluate(() => {
    const host = document.getElementById("host");
    const sc = document.createElement("div");
    sc.id = "sc";
    sc.style.cssText = "height:500px;overflow:auto";
    const tail = document.createElement("div");
    tail.style.height = "1500px";
    host.parentNode.insertBefore(sc, host);
    sc.append(host, tail);
  });
  await page.evaluate(() => window.card.shadowRoot.querySelector('[data-act="cal"]').click());
  await page.waitForTimeout(400);
  await page.evaluate(() => (document.getElementById("sc").scrollTop = 420));
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    const days = [...window.card.shadowRoot.querySelectorAll("#pop button")].filter((b) =>
      /^\d+$/.test(b.textContent.trim()),
    );
    (days.find((b) => !b.disabled) || days[0]).click();
  });
  await page.waitForTimeout(600);
  const top = await page.evaluate(() => document.getElementById("sc").scrollTop);
  check("closing the calendar keeps the scroll position", top === 420 && errors.length === 0, `scrollTop ${top}`);

  // A data refresh (new sensor state) must neither replay the chart animation nor move the page.
  await page.evaluate(() => {
    document.getElementById("sc").scrollTop = 300;
    const h = window.card._hass;
    const st = h.states["sensor.prices"];
    const next = { ...st, last_updated: new Date(Date.now() + 5000).toISOString() };
    window.card.hass = { ...h, states: { "sensor.prices": next } };
  });
  await page.waitForTimeout(300);
  const refresh = await page.evaluate(() => ({
    top: document.getElementById("sc").scrollTop,
    entering: window.card.shadowRoot.querySelectorAll(".enter").length,
  }));
  check(
    "a data refresh keeps scroll and skips the animation",
    refresh.top === 300 && refresh.entering === 0,
    JSON.stringify(refresh),
  );
  await browser.close();
}

async function testStepperDays() {
  for (const [day, want] of [
    ["today", true],
    ["tomorrow", true],
    ["yesterday", false],
    ["week", false],
  ]) {
    const { browser, page, errors } = await launch({ width: 1300, height: 900 });
    await installMock(page, { view: "heatmap", show_cheapest_stepper: true, day }, { tomorrow: true });
    const has = await page.evaluate(() => !!window.card.shadowRoot.getElementById("stp"));
    check(`stepper ${want ? "shown" : "hidden"} on ${day}`, has === want && errors.length === 0, errors.join(" | "));
    await browser.close();
  }
}

async function testEditor() {
  const { browser, page, errors } = await launch({ width: 420, height: 1400 });
  await installEditor(page);

  const periods = () =>
    page.evaluate(() =>
      [...window.ed.shadowRoot.querySelectorAll('.seg[data-g="period"] button')].map((b) => b.dataset.v).join(","),
    );
  const expected = {
    today: "15min,hour",
    week: "hour,day",
    month: "day,week",
    year: "week,month",
    q2: "day,week,month",
  };
  for (const [day, want] of Object.entries(expected)) {
    await page.evaluate((d) => window.ed._set("day", d), day);
    const got = await periods();
    check(`period options for ${day}`, got === want, `got ${got}`);
  }

  await page.evaluate(() => window.ed._set("day", "today"));
  const edges = await page.evaluate(() =>
    [...window.ed.shadowRoot.querySelectorAll(".nf input")].map((i) => Math.round(i.getBoundingClientRect().right)),
  );
  check("number fields share one right edge", new Set(edges).size === 1, JSON.stringify([...new Set(edges)]));
  check("editor has no page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
}

async function testSource() {
  const header = async (config, language = "en") => {
    const c = await launch({ width: 1300, height: 900 });
    await installMock(c.page, config, { language });
    const out = await c.page.evaluate(() => {
      const root = window.card.shadowRoot;
      const logo = root.querySelector(".logo");
      return {
        title: (root.querySelector(".tt-t") || {}).textContent || null,
        mark: !!root.querySelector(".logo .mark"),
        logo: !!logo,
        custom: !!root.querySelector(".logo.custom"),
        brand: !!root.querySelector(".logo.brand"),
        icon: ((root.querySelector(".logo ha-icon") || {}).getAttribute || (() => null)).call(
          root.querySelector(".logo ha-icon") || {},
          "icon",
        ),
      };
    });
    await c.browser.close();
    return out;
  };
  const def = await header({});
  check(
    "source custom: Kairos title and logo",
    def.title === "Kairos" && !def.custom && def.mark && !!(await header({})).brand,
    JSON.stringify(def),
  );
  check("source custom: Dutch title", (await header({}, "nl")).title === "Kairos");
  const ic = await header({ icon: "mdi:flash" });
  check("source custom: own icon replaces the logo", ic.custom && !ic.mark && !ic.brand, JSON.stringify(ic));
  check("source custom: icon false hides the logo", !(await header({ icon: false })).logo);
  const np = await header({ source: "nord_pool" });
  check(
    "source nord_pool: title and mark",
    np.title === "Nord Pool \u00B7 Day-Ahead Market" && np.mark && !np.custom,
    JSON.stringify(np),
  );
  const en = await header({ source: "entsoe" });
  check(
    "source entsoe: title and mark",
    en.title === "ENTSO-E \u00B7 Day-Ahead Market" && en.mark && !en.custom,
    JSON.stringify(en),
  );
  const own = await header({ title: "My prices", icon: false });
  check(
    "custom: own title wins and icon false hides the logo",
    own.title === "My prices" && !own.logo,
    JSON.stringify(own),
  );
  const ignored = await header({ source: "nord_pool", title: "My prices", icon: "mdi:flash" });
  check(
    "nord_pool ignores title and icon",
    ignored.title === np.title && ignored.logo === np.logo,
    JSON.stringify({ ignored, np }),
  );
  const dayTitle = await header({ title: "Prices {day}" });
  check(
    "title placeholder works with a source",
    /^Prices /.test(dayTitle.title) && !dayTitle.title.includes("{"),
    JSON.stringify(dayTitle),
  );
  const none = await header({ show_header: false });
  check("show_header false hides the header", none.title === null && !none.logo, JSON.stringify(none));
  const c = await launch();
  await installMock(c.page);
  const rejects = (config) =>
    c.page.evaluate((config) => {
      try {
        window.card.setConfig({ entity: "sensor.prices", ...config });
        return false;
      } catch (err) {
        return true;
      }
    }, config);
  check(
    "source must be a known source",
    (await rejects({ source: "other" })) && !(await rejects({ source: "entsoe" })),
  );
  await c.browser.close();
}

async function testSourceFields() {
  const { browser, page, errors } = await launch({ width: 420, height: 1400 });
  await installEditor(page, { source: "nord_pool" });
  const shown = (k) =>
    page.evaluate((k) => window.ed.shadowRoot.querySelector(`[data-row="${k}"]`).style.display !== "none", k);
  check("title and icon are hidden for nord_pool", !(await shown("title")) && !(await shown("icon")));
  await page.evaluate(() => window.ed._set("source", "entsoe"));
  check("title and icon are hidden for entsoe", !(await shown("title")) && !(await shown("icon")));
  await page.evaluate(() => window.ed._set("source", "custom"));
  check("title and icon are shown for custom", (await shown("title")) && (await shown("icon")));
  check("source is still shown", await shown("source"));
  const label = await page.evaluate(() =>
    window.ed.shadowRoot.querySelector('[data-row="source"] option[value="custom"]').textContent.trim(),
  );
  check("custom source is called Custom", label === "Custom", label);
  check("no page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
}

async function testTranslations() {
  const { browser, page, errors } = await launch({ width: 420, height: 1400 });
  await installEditor(page);
  const data = await page.evaluate(() => {
    const keys = (o) => Object.keys(o).sort().join(",");
    const rows = KAIROS_FORM.flatMap((s) => s.rows);
    const groups = Object.keys(KAIROS_ED.en);
    const out = { sameGroups: keys(KAIROS_ED.en) === keys(KAIROS_ED.nl), mismatch: [], missing: [], placeholders: [] };
    groups.forEach((g) => {
      if (keys(KAIROS_ED.en[g]) !== keys(KAIROS_ED.nl[g])) out.mismatch.push(g);
    });
    ["en", "nl"].forEach((l) => {
      const d = KAIROS_ED[l];
      rows.forEach((r) => {
        if (!d.label[r.k]) out.missing.push(`${l}:label:${r.k}`);
        (r.o || []).forEach((o) => {
          const own = (r.k === "day" && d.opt["day:" + o]) || d.opt[String(o)];
          if (!own) out.missing.push(`${l}:opt:${r.k}:${o}`);
        });
      });
      KAIROS_FORM.forEach((s) => {
        if (!d.section[s.title]) out.missing.push(`${l}:section:${s.title}`);
      });
      Object.keys(d.hint).forEach((k) => {
        if (!rows.some((r) => r.k === k)) out.missing.push(`${l}:hint without row:${k}`);
      });
    });
    const ph = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join("");
    groups.forEach((g) =>
      Object.keys(KAIROS_ED.en[g]).forEach((k) => {
        if (ph(KAIROS_ED.en[g][k]) !== ph(KAIROS_ED.nl[g][k])) out.placeholders.push(`${g}:${k}`);
      }),
    );
    out.card = keys(KAIROS_I18N.en) === keys(KAIROS_I18N.nl);
    out.cardFixed = [
      KAIROS_I18N.en.fixed,
      KAIROS_I18N.en.fixed_label,
      KAIROS_I18N.nl.fixed,
      KAIROS_I18N.nl.fixed_label,
    ];
    out.edFixed = [
      KAIROS_ED.en.label.fixed_price,
      KAIROS_ED.en.label.fixed_label,
      KAIROS_ED.nl.label.fixed_price,
      KAIROS_ED.nl.label.fixed_label,
    ];
    return out;
  });
  check(
    "editor texts: same keys in English and Dutch",
    data.sameGroups && data.mismatch.length === 0,
    JSON.stringify(data.mismatch),
  );
  check("editor texts: every row, option, and section has a text", data.missing.length === 0, data.missing.join(", "));
  check(
    "editor texts: placeholders match in both languages",
    data.placeholders.length === 0,
    data.placeholders.join(", "),
  );
  check("card texts: same keys in English and Dutch", data.card);
  check(
    "fixed rate texts in the card",
    JSON.stringify(data.cardFixed) ===
      JSON.stringify(["Fixed rate", "Energy company", "Vast tarief", "Energiebedrijf"]),
    JSON.stringify(data.cardFixed),
  );
  check(
    "fixed rate texts in the editor",
    JSON.stringify(data.edFixed) === JSON.stringify(["Fixed rate", "Energy company", "Vast tarief", "Energiebedrijf"]),
    JSON.stringify(data.edFixed),
  );

  const text = (sel) => page.evaluate((s) => window.ed.shadowRoot.querySelector(s).textContent.trim(), sel);
  check("English editor label", (await text('[data-row="fixed_label"] .t')) === "Energy company");
  check(
    "English start day option",
    (await page.evaluate(
      () => window.ed.shadowRoot.querySelector('[data-s="day"] option[value="week"]').textContent,
    )) === "This week",
  );

  // A new language arrives with hass: the texts are built again and the handlers still work once.
  await page.evaluate(() => {
    window.changes = 0;
    window.ed.addEventListener("config-changed", () => window.changes++);
    window.ed.hass = { states: {}, language: "nl", locale: { language: "nl" } };
  });
  check("Dutch label of fixed_label", (await text('[data-row="fixed_label"] .t')) === "Energiebedrijf");
  check("Dutch label of fixed_price", (await text('[data-row="fixed_price"] .t')) === "Vast tarief");
  check("Dutch hint of fixed_price", (await text('[data-row="fixed_price"] .d')).startsWith("Kale prijs"));
  check(
    "Dutch section title",
    await page.evaluate(() =>
      [...window.ed.shadowRoot.querySelectorAll(".sh span")].map((s) => s.textContent).includes("Prijzen en BTW"),
    ),
  );
  check("Dutch update button", (await text(".abtn")) === "Controleren" || (await text(".abtn")) === "Bijwerken");
  check(
    "Dutch start day option",
    (await page.evaluate(
      () => window.ed.shadowRoot.querySelector('[data-s="day"] option[value="week"]').textContent,
    )) === "Deze week",
  );
  const switches = await page.evaluate(async () => {
    window.changes = 0;
    window.ed.shadowRoot.querySelector('[data-b="show_header"]').click();
    await new Promise((r) => setTimeout(r, 50));
    return window.changes;
  });
  check("a switch fires one change after the language changed", switches === 1, `got ${switches}`);
  await page.evaluate(() => window.ed._set("day", "today"));
  check(
    "Dutch period option",
    (await page.evaluate(() => window.ed.shadowRoot.querySelector('.seg[data-g="period"] button').textContent)) ===
      "15 min",
  );

  // The card: the fixed rate tile uses the translated default name, or the name that was set.
  const tile = async (language, config) => {
    const c = await launch({ width: 1300, height: 900 });
    await installMock(c.page, config, { language });
    const label = await c.page.evaluate(() => {
      const stat = [...window.card.shadowRoot.querySelectorAll(".stat")].pop();
      return stat ? stat.querySelector(".slt").textContent + "|" + stat.querySelector(".sx").textContent : null;
    });
    await c.browser.close();
    return label;
  };
  const price = { fixed_price: 0.15936 };
  check("English tile: default name", (await tile("en", price)) === "Energy company|Fixed rate");
  check("Dutch tile: default name", (await tile("nl", price)) === "Energiebedrijf|Vast tarief");
  check("tile: own name", (await tile("nl", { ...price, fixed_label: "Essent" })) === "Essent|Vast tarief");
  check("translations have no page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
}

async function testUpdateResource() {
  const { browser, page, errors } = await launch({ width: 420, height: 1400 });
  await installEditor(page);
  // Gives the editor a fresh hass with the given resources and file version, waits for the check, and reports.
  const run = (resources, fileVersion = "9.9.9", click = false) =>
    page.evaluate(
      async ({ resources, fileVersion, click }) => {
        const calls = [];
        window.fetch = async () => ({
          ok: fileVersion !== null,
          status: fileVersion === null ? 404 : 200,
          text: async () => `const KAIROS_VERSION = "${fileVersion}";`,
        });
        window.ed._resChecked = false;
        window.ed.hass = {
          callWS: async (msg) => {
            calls.push(msg);
            if (msg.type === "lovelace/resources") return resources;
            resources[0].url = msg.url;
            return {};
          },
        };
        const wait = () => new Promise((r) => setTimeout(r, 150));
        await wait();
        const rows = () => [...window.ed.shadowRoot.querySelectorAll('[data-do="update_resource"]')];
        const state = () => ({
          steps: rows().map((b) => b.dataset.step + ":" + b.textContent),
          disabled: rows().map((b) => b.disabled),
          notes: rows().map((b) => b.closest(".er").querySelector(".d").textContent),
          bad: rows().map((b) => b.closest(".er").classList.contains("bad")),
        });
        const before = state();
        const topFirst = window.ed.shadowRoot.querySelector(".sec .er").dataset.row === "update_resource_top";
        if (click) {
          rows()[0].click();
          await wait();
        }
        return { calls, before, after: state(), topFirst, count: rows().length };
      },
      { resources, fileVersion, click },
    );
  const old = () => [{ id: "r1", type: "module", url: "/local/kairos_card.js?v0.2.4=" }];
  const avail = await run(old());
  check(
    "the smart button turns into Update when an update is available, at the top and in Experimental",
    avail.count === 2 &&
      avail.topFirst &&
      avail.before.steps.every((x) => x === "update:Update") &&
      avail.before.disabled.every((d) => !d) &&
      avail.before.notes[0] === "Update available: version 9.9.9",
    JSON.stringify(avail),
  );
  const upd = await run(old(), "9.9.9", true);
  const call = upd.calls.find((c) => c.type === "lovelace/resources/update");
  check(
    "update resource sets ?v=<version of the file>",
    call && call.resource_id === "r1" && call.res_type === "module" && call.url === "/local/kairos_card.js?v=9.9.9",
    JSON.stringify(upd),
  );
  check(
    "after the update the smart button turns into Reload",
    upd.after.steps.every((x) => x === "reload:Reload") &&
      upd.after.disabled.every((d) => !d) &&
      upd.after.notes[1] === "Resource set to the new version 9.9.9. Press Reload to load it.",
    JSON.stringify(upd.after),
  );
  const chk = await page.evaluate(async () => {
    const rows = () => [...window.ed.shadowRoot.querySelectorAll('[data-do="update_resource"]')];
    const note = () => window.ed.shadowRoot.querySelector('[data-row="update_resource"] .d').textContent;
    window.ed._setStep("check");
    window.fetch = async () => ({ ok: true, status: 200, text: async () => 'const KAIROS_VERSION = "9.9.10";' });
    window.ed._hass.callWS = async (msg) =>
      msg.type === "lovelace/resources" ? [{ id: "r1", type: "module", url: "/local/kairos_card.js?v=9.9.9" }] : {};
    rows()[1].click();
    await new Promise((r) => setTimeout(r, 150));
    return { count: rows().length, note: note(), step: rows()[1].dataset.step, off: rows().some((b) => b.disabled) };
  });
  check(
    "the Check step fetches the file version again and turns into Update",
    chk.count === 2 && /Update available: version 9\.9\.10/.test(chk.note) && chk.step === "update" && !chk.off,
    JSON.stringify(chk),
  );
  const reloadRun = (saveOff) =>
    page.evaluate(async (saveOff) => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      document.querySelectorAll("hui-root, hui-dialog-edit-card").forEach((e) => e.remove());
      const log = [];
      window.ed._reloadPage = (u) => log.push("reload:" + u);
      window.ed._href = () => "http://ha.local/dash/view?edit=1&x=1";
      window.history.replaceState = (st, ti, u) => log.push("url:" + u);
      // A stand-in for the Home Assistant card dialog: Cancel and Save in the primary action, the editor inside.
      const dlg = document.createElement("hui-dialog-edit-card");
      document.body.appendChild(dlg);
      const sr = dlg.attachShadow({ mode: "open" });
      sr.innerHTML = '<div slot="primaryAction"><button id="c">Cancel</button><button id="s">Save</button></div>';
      if (saveOff) sr.getElementById("s").disabled = true;
      sr.getElementById("c").onclick = () => {
        log.push("cancel");
        setTimeout(() => sr.querySelector('[slot="primaryAction"]').remove(), 100);
      };
      sr.getElementById("s").onclick = () => {
        log.push("save");
        setTimeout(() => sr.querySelector('[slot="primaryAction"]').remove(), 100);
      };
      sr.appendChild(window.ed);
      // A stand-in for the dashboard toolbar in the edit mode: icon buttons and a text button, Done.
      const root = document.createElement("hui-root");
      document.body.appendChild(root);
      const rs = root.attachShadow({ mode: "open" });
      rs.innerHTML =
        '<div class="edit-mode"><ha-icon-button id="u"></ha-icon-button><ha-button id="d">Done</ha-button></div>';
      rs.getElementById("u").onclick = () => log.push("undo");
      rs.getElementById("d").onclick = () => log.push("done");
      window.ed._setStep("reload");
      const b = [...window.ed.shadowRoot.querySelectorAll('[data-do="update_resource"]')];
      b[1].click();
      await wait(1800);
      return { buttons: b.length, log };
    }, saveOff);
  const rl = await reloadRun(false);
  check(
    "reload saves the card, presses Done, cleans the address, and then reloads",
    rl.buttons === 2 && rl.log.join(",") === "save,done,url:/dash/view?x=1,reload:/dash/view?x=1",
    JSON.stringify(rl),
  );
  const rc = await reloadRun(true);
  check(
    "reload cancels the dialog when there is nothing to save",
    rc.log.join(",") === "cancel,done,url:/dash/view?x=1,reload:/dash/view?x=1",
    JSON.stringify(rc),
  );
  const guard = await page.evaluate(async () => {
    document.querySelectorAll("hui-root, hui-dialog-edit-card").forEach((e) => e.remove());
    const log = [];
    const root = document.createElement("hui-root");
    document.body.appendChild(root);
    const rs = root.attachShadow({ mode: "open" });
    rs.innerHTML = '<div class="edit-mode"><ha-button id="d">Done</ha-button></div>';
    rs.getElementById("d").onclick = () => log.push("done");
    const Card = customElements.get("kairos-card");
    Card.guardEditMode(Date.now() - 60000, () => "http://ha.local/dash?edit=1");
    await new Promise((r) => setTimeout(r, 600));
    const stale = log.length;
    Card.guardEditMode(Date.now(), () => "http://ha.local/dash?edit=1");
    await new Promise((r) => setTimeout(r, 700));
    const fresh = log.length - stale;
    Card.guardEditMode(Date.now(), () => "http://ha.local/dash");
    await new Promise((r) => setTimeout(r, 600));
    return { stale, fresh, clean: log.length - stale - fresh };
  });
  check(
    "after a Reload, Done is pressed again only when the edit mode returns",
    guard.stale === 0 && guard.fresh === 1 && guard.clean === 0,
    JSON.stringify(guard),
  );
  const menu = await page.evaluate(async () => {
    const sec = () => window.ed.shadowRoot.querySelector('[data-row="update_resource_top"]').closest(".sec");
    const vis = () => sec().style.display !== "none";
    const initial = vis();
    window.ed._set("update_menu", true);
    const on = vis();
    const rows = window.ed.shadowRoot.querySelectorAll('[data-do="update_resource"]').length;
    window.ed._set("update_menu", false);
    return { initial, on, rows, back: vis() };
  });
  check(
    "update_menu is off by default; it shows and hides the Update section at the top; the Experimental row stays",
    !menu.initial && menu.on && !menu.back && menu.rows === 2,
    JSON.stringify(menu),
  );
  const same = await run([{ id: "r1", type: "module", url: "/local/kairos_card.js?v=9.9.9" }]);
  check(
    "the smart button stays on Check and says up to date when there is no update",
    same.before.steps.every((x) => x === "check:Check") &&
      same.before.disabled.every((d) => !d) &&
      same.before.notes[0] === "Up to date: version 9.9.9" &&
      !same.calls.some((c) => c.type === "lovelace/resources/update"),
    JSON.stringify(same),
  );
  const none = await run([{ id: "x", type: "module", url: "/local/other.js" }]);
  check(
    "update says when no resource exists",
    none.before.disabled.every((d) => !d) && none.before.bad[0] && /No dashboard resource/.test(none.before.notes[0]),
    JSON.stringify(none),
  );
  const missing = await run(old(), null);
  check(
    "update reports an unreadable file",
    missing.before.bad[0] && /HTTP 404/.test(missing.before.notes[0]),
    JSON.stringify(missing),
  );
  check("update resource has no page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
}

async function testDst() {
  // Europe/Amsterdam: the clock goes forward on 2026-03-29 (23 hours) and back on 2026-10-25 (25 hours).
  const cases = [
    ["spring forward", "2026-03-29T10:00:00Z", "2026-03-28T23:00:00Z", 92, 0],
    ["fall back", "2026-10-25T10:00:00Z", "2026-10-24T22:00:00Z", 100, 2],
  ];
  for (const [label, now, start, count, twice] of cases) {
    const { browser, page, errors } = await launch({ width: 1300, height: 900 });
    const price = (i) => 0.2 + ((i * 7) % 13) / 100;
    await installMock(
      page,
      { view: "heatmap", cheapest_quarters: 20 },
      { now, attrs: { today: quarterSlots(start, count, price), tomorrow: [] } },
    );
    const info = await page.evaluate(() => {
      const times = [...window.card.shadowRoot.querySelectorAll("#dtbl tbody tr")].map((tr) =>
        tr.cells[0].textContent.trim(),
      );
      return {
        bars: window.card.shadowRoot.querySelectorAll(".bar-el").length,
        axis: [...window.card.shadowRoot.querySelectorAll("text.ax")].map((x) => x.textContent),
        times,
        dur: (window.card.shadowRoot.querySelector(".cs-dur") || {}).textContent,
      };
    });
    check(`${label}: one bar per slot (${count})`, info.bars === count, JSON.stringify(info.bars));
    check(`${label}: one table row per slot`, info.times.length === count, String(info.times.length));
    const starts02 = info.times.filter((t) => t.startsWith("02:00")).length;
    check(
      `${label}: 02:00 appears ${twice} time(s)`,
      starts02 === twice,
      JSON.stringify(info.times.filter((t) => /^0[1-3]:/.test(t))),
    );
    check(`${label}: 20 cheapest quarters add up to 5 h`, info.dur === "5 h", String(info.dur));
    const marked = info.times.filter((x) => /[AB]\b/.test(x));
    if (twice) {
      check(
        `${label}: the repeated hour is marked A and B`,
        info.times.includes("02:00A \u2013 02:15A") &&
          info.times.includes("02:45A \u2013 02:00B") &&
          info.times.includes("02:00B \u2013 02:15B") &&
          info.axis.includes("02A") &&
          info.axis.includes("02B") &&
          !info.axis.includes("02"),
        JSON.stringify({ rows: info.times.filter((x) => /^0[12]:/.test(x)), axis: info.axis }),
      );
    } else {
      check(
        `${label}: no A or B marks`,
        marked.length === 0 && !info.axis.some((x) => /[AB]$/.test(x)),
        JSON.stringify(marked),
      );
    }
    check(`${label}: no page errors`, errors.length === 0, errors.join(" | "));
    await browser.close();
  }
}

async function testDstTables() {
  // The breakdown tables list clock hours: the repeated hour of a 25-hour day shows as 02A and 02B.
  const run = async (now, start, count) => {
    const { browser, page, errors } = await launch({ width: 1300, height: 900 });
    await installMock(page, { view: "breakdown" }, { now, attrs: { today: quarterSlots(start, count), tomorrow: [] } });
    const heads = await page.evaluate(() =>
      [...window.card.shadowRoot.querySelectorAll('table th[scope="row"]')].map((x) => x.textContent.trim()),
    );
    await browser.close();
    return { heads, errors };
  };
  const fall = await run("2026-10-25T10:00:00Z", "2026-10-24T22:00:00Z", 100);
  check(
    "fall back: hour rows 02A and 02B",
    fall.heads.includes("02A") && fall.heads.includes("02B") && !fall.heads.includes("02"),
    JSON.stringify(fall.heads.filter((x) => /^0[1-3]/.test(x))),
  );
  const normal = await run("2026-10-20T10:00:00Z", "2026-10-19T22:00:00Z", 96);
  check(
    "normal day: no marks on hour rows",
    !normal.heads.some((x) => /[AB]$/.test(x)),
    JSON.stringify(normal.heads.slice(0, 5)),
  );
  check("dst tables have no page errors", fall.errors.length === 0 && normal.errors.length === 0);
}

async function testBadStates() {
  const now = "2026-10-25T10:00:00Z";
  const good = quarterSlots("2026-10-24T22:00:00Z", 100);
  const cases = [
    [
      "unavailable",
      { state: "unavailable", attrs: { today: [], tomorrow: [] } },
      {},
      (i) => /unavailable/i.test(i.status),
    ],
    ["unknown", { state: "unknown", attrs: { today: [], tomorrow: [] } }, {}, (i) => i.bars === 0 && i.busy],
    [
      "malformed rows",
      {
        attrs: {
          today: [
            null,
            { start: "bad", energy_price: 1 },
            { start: good[0].start, energy_price: null },
            ...good.slice(1, 11),
          ],
          tomorrow: [],
        },
      },
      {},
      (i) => i.bars === 10,
    ],
    [
      "no tomorrow data yet",
      { attrs: { today: good, tomorrow: [] } },
      { day: "tomorrow" },
      (i) => i.bars === 0 && /no price data/i.test(i.status),
    ],
    [
      "yesterday attribute is ignored",
      {
        history: false,
        attrs: { today: good, tomorrow: [], yesterday: quarterSlots("2026-10-23T22:00:00Z", 96) },
      },
      { day: "yesterday" },
      (i) => i.bars === 0,
    ],
    [
      "data attribute is ignored",
      { attrs: { data: quarterSlots("2026-10-24T22:00:00Z", 96) } },
      {},
      (i) => i.bars === 0,
    ],
  ];
  for (const [label, opts, config, ok] of cases) {
    const { browser, page, errors } = await launch({ width: 1300, height: 900 });
    await installMock(page, config, { now, ...opts });
    const info = await page.evaluate(() => {
      const root = window.card.shadowRoot;
      return {
        bars: root.querySelectorAll(".bar-el").length,
        status: [...root.querySelectorAll(".status")].map((e) => e.textContent.trim()).join(" "),
        busy: !!root.querySelector('[aria-busy="true"]'),
      };
    });
    check(`${label}: shows the right state`, ok(info), JSON.stringify(info));
    check(`${label}: no page errors`, errors.length === 0, errors.join(" | "));
    await browser.close();
  }
}

async function testLegacyOptionsGone() {
  const { browser, page, errors } = await launch();
  await installMock(page);
  const rejects = (config) =>
    page.evaluate((config) => {
      try {
        window.card.setConfig({ entity: "sensor.prices", ...config });
        return false;
      } catch (err) {
        return true;
      }
    }, config);
  check("chart_style stacked_bar is rejected", await rejects({ chart_style: "stacked_bar" }));
  check("chart_type is ignored", !(await rejects({ chart_type: "stacked_bar" })));
  check("chart_style bar is rejected", await rejects({ chart_style: "bar" }));
  check("chart_style bars is accepted", !(await rejects({ chart_style: "bars" })));
  const view = (config) =>
    page.evaluate((config) => {
      window.card.setConfig({ entity: "sensor.prices", ...config });
      return window.card._config.view;
    }, config);
  const plain = await view({});
  check("heatmap: false no longer selects the price view", (await view({ heatmap: false })) === plain);
  check("bar_colors: false no longer selects the price view", (await view({ bar_colors: false })) === plain);
  const period = (config) =>
    page.evaluate((config) => {
      window.card.setConfig({ entity: "sensor.prices", ...config });
      return window.card._config.period;
    }, config);
  check("resolution no longer sets the period", (await period({ resolution: "hour" })) === (await period({})));
  check("legacy options cause no page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
}

async function testEntityConfig() {
  const { browser, page, errors } = await launch();
  await installMock(page);
  const rejects = (config) =>
    page.evaluate((config) => {
      try {
        window.card.setConfig({ entity: "sensor.prices", ...config });
        return false;
      } catch (err) {
        return true;
      }
    }, config);
  check("entity must be an entity id", await rejects({ entity: "Sensor Prices" }));
  check("entity cannot be a number", await rejects({ entity: 42 }));
  check("entity cannot hold markup", await rejects({ entity: '<img src=x onerror="alert(1)">' }));
  check("history_entity must be an entity id", await rejects({ history_entity: "no dot" }));
  check("entities must hold entity ids", await rejects({ entities: ["sensor.a", 7] }));
  check("entities must be a list", await rejects({ entities: "sensor.a" }));
  check("title must be text", await rejects({ title: 5 }));
  check("icon must be text or false", await rejects({ icon: 5 }));
  check("fixed_label must be text", await rejects({ fixed_label: 5 }));
  check("unit must be text", await rejects({ unit: { a: 1 } }));
  check("currency must be text", await rejects({ currency: ["EUR"] }));
  check("text options accept text", !(await rejects({ fixed_label: "Energy", unit: "ct/kWh", currency: "EUR" })));
  check("valid entity ids are accepted", !(await rejects({ entities: ["sensor.a", "sensor.b_2"], icon: false })));
  check("an empty entity is accepted (default applies)", !(await rejects({ entity: "" })));
  const esc = await page.evaluate(() => window.card._esc(`<a href="x" title='y'>&</a>`));
  check(
    "one escape helper covers & < > and both quotes",
    esc === "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;",
    esc,
  );
  const th = await page.evaluate(() => window.card._th("average") === window.card._esc(window.card._t("average")));
  check("_th is the escaped translation", th);
  const inj = await page.evaluate(() => {
    window.card._t = (key) => `<img src=x onerror="window.__pwn=1">${key}`;
    window.card._m = null;
    const html = window.card._th("retry");
    return html.includes("<img") || html.includes('"');
  });
  check("_th escapes markup from a translation", inj === false);
  check("entity validation has no page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
}

(async () => {
  await testCard();
  await testDisplayMode();
  await testDst();
  await testDstTables();
  await testBadStates();
  await testLegacyOptionsGone();
  await testEntityConfig();
  await testEditButton();
  await testSummary();
  await testGradient();
  await testAverageLine();
  await testFixedLine();
  await testScrollStays();
  await testStepperDays();
  await testEditor();
  await testSource();
  await testSourceFields();
  await testTranslations();
  await testUpdateResource();
  if (failed) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll checks passed");
})();
