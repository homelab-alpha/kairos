"use strict";

/**
 * Mocked Home Assistant for browser tests.
 *
 * `installMock(page, options)` mounts the card and exposes it as `window.card`.
 * Prices are 15-minute slots for today (and optionally tomorrow); the history
 * sensor answers recorder statistics requests with a smooth synthetic curve.
 */

const CARD_FILE = require("node:path").join(__dirname, "..", "..", "kairos_card.js");

/** Launches Chromium. Set CHROMIUM_PATH to use an installed browser instead of the Playwright one. */
async function launch(viewport = { width: 1000, height: 800 }, contextOptions = {}) {
  const { chromium } = require("playwright-core");
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport, ...contextOptions });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return { browser, page, errors };
}

async function loadCard(page) {
  await page.setContent('<body style="margin:12px;background:#1c1c1e"><div id="host"></div></body>');
  await page.addScriptTag({ path: CARD_FILE });
}

/**
 * Mounts the card with a mocked `hass`. `config` is merged over a working default.
 * Options: `tomorrow` (add tomorrow's slots), `user`, `now` (ISO time; fixes the browser clock),
 * `attrs` (replaces the `today` and `tomorrow` attributes), `state` (state of the price sensor), and
 * `history: false` (the recorder history is empty), and
 * `language` (language of Home Assistant, "en" by default).
 */
async function installMock(
  page,
  config = {},
  { tomorrow = false, user, now, attrs, state = "0.3", history = true, language = "en" } = {},
) {
  if (now) await page.clock.setFixedTime(new Date(now));
  await loadCard(page);
  await page.evaluate(
    ({ config, tomorrow, user, attrs, state, history, language }) => {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      const slots = (offset) =>
        Array.from({ length: 96 }, (_, i) => {
          const s = new Date(day.getTime() + offset * 864e5 + i * 9e5);
          const price = 0.3 + 0.1 * Math.sin((i / 96) * Math.PI * 2);
          return { start: s.toISOString(), end: new Date(s.getTime() + 9e5).toISOString(), energy_price: price };
        });
      const card = document.createElement("kairos-card");
      card.setConfig({ entity: "sensor.prices", history_entity: "sensor.history", ...config });
      card.hass = {
        states: {
          "sensor.prices": {
            state,
            last_updated: new Date().toISOString(),
            attributes: attrs || { today: slots(0), tomorrow: tomorrow ? slots(1) : [] },
          },
        },
        ...(user ? { user } : {}),
        language,
        locale: { language },
        config: { time_zone: "Europe/Amsterdam" },
        callWS: async (msg) => {
          const step = { day: 864e5, week: 6048e5, month: 2678400000 }[msg.period] || 36e5;
          const out = [];
          if (!history) return { "sensor.history": out };
          const end = Math.min(Date.parse(msg.end_time), Date.now());
          for (let t = Date.parse(msg.start_time); t < end; t += step) {
            out.push({ start: t, mean: 0.3 + 0.05 * Math.sin(t / 8e7) });
          }
          return { "sensor.history": out };
        },
      };
      document.getElementById("host").appendChild(card);
      window.card = card;
    },
    { config, tomorrow, user, attrs, state, history, language },
  );
  await page.waitForTimeout(500);
}

/** Mounts the visual editor and exposes it as `window.ed`. Config changes are applied back to it. */
async function installEditor(page, config = {}, language = "en") {
  await loadCard(page);
  await page.evaluate(
    ({ config, language }) => {
      const ed = document.createElement("kairos-card-editor");
      ed.setConfig({ type: "custom:kairos-card", entity: "sensor.prices", ...config });
      ed.hass = { states: {}, language, locale: { language } };
      ed.addEventListener("config-changed", (e) => ed.setConfig(e.detail.config));
      document.getElementById("host").appendChild(ed);
      window.ed = ed;
    },
    { config, language },
  );
  await page.waitForTimeout(300);
}

/** `count` quarter-hour slots from `startIso`; `price(i)` gives the price of slot i. */
function quarterSlots(startIso, count, price = () => 0.3) {
  const t0 = Date.parse(startIso);
  return Array.from({ length: count }, (_, i) => ({
    start: new Date(t0 + i * 9e5).toISOString(),
    end: new Date(t0 + (i + 1) * 9e5).toISOString(),
    energy_price: price(i),
  }));
}

module.exports = { launch, installMock, installEditor, quarterSlots };
