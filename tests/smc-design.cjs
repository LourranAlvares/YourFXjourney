"use strict";
const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
  try {
    const p = await b.newPage({
        viewport: { width: 1536, height: 1024 },
        reducedMotion: "reduce",
      }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.clock.setFixedTime(new Date("2026-10-30T09:12:34Z"));
    await p.route("**/api/status", (r) =>
      r.fulfill({
        json: {
          authenticated: true,
          authConfigured: true,
          services: {
            ai: false,
            economicCalendar: true,
            marketConditions: true,
          },
        },
      }),
    );
    await p.route("**/api/economic-calendar?*", (r) =>
      r.fulfill({
        json: {
          events: [
            {
              id: "1",
              currency: "USD",
              name: "Divulgação econômica dos EUA",
              time: "2026-10-30T13:30:00Z",
              impact: "high",
            },
            {
              id: "2",
              currency: "CAD",
              name: "Indicador econômico do Canadá",
              time: "2026-10-31T10:00:00Z",
              impact: "medium",
            },
            {
              id: "3",
              currency: "GBP",
              name: "Próximo evento da libra",
              time: "2026-11-02T09:00:00Z",
              impact: "high",
            },
          ],
        },
      }),
    );
    await p.route("**/api/market-conditions?*", (r) =>
      r.fulfill({
        json: {
          instruments: [
            { symbol: "GBP/USD", volatility: "low", atrPercent: 0.07 },
            { symbol: "EUR/USD", volatility: "moderate", atrPercent: 0.14 },
            { symbol: "XAU/USD", volatility: "high", atrPercent: 0.24 },
          ],
        },
      }),
    );
    const base = "http://127.0.0.1:" + app.server.address().port;
    await p.goto(base);
    await p.waitForSelector(".smc-home");
    await p.evaluate(() => {
      S.currency = "GBP";
      S.balance = 10000;
      S.balanceConfirmed = true;
      S.assistantProfile = {
        ...taProfile(),
        name: "Lourran Alvares",
        instruments: ["GBPUSD", "EURUSD", "XAUUSD"],
      };
      S.trades = Array.from({ length: 48 }, (_, i) =>
        mk({
          id: "s" + i,
          symbol: ["EURUSD", "GBPUSD", "XAUUSD"][i % 3],
          side: i % 2 ? "long" : "short",
          open: `2026-10-${String(1 + Math.floor(i / 2)).padStart(2, "0")}T09:00`,
          close: `2026-10-${String(1 + Math.floor(i / 2)).padStart(2, "0")}T10:00`,
          pnl: i % 3 === 0 ? -70 : 40 + i,
          risk: 50,
        }),
      );
      R();
    });
    await p.waitForSelector(".reference-event");
    await p.evaluate(() => document.fonts.ready);
    const snapshot = await p.evaluate(() => JSON.stringify(S));
    assert.equal(
      await p.locator(".scene-greeting h1 span").innerText(),
      "Lourran!",
    );
    assert.equal(await p.locator(".reference-event").count(), 3);
    assert.equal(await p.locator(".smc-home-metrics .k").count(), 0);
    assert.equal(await p.locator(".smc-home-chart-grid .card").count(), 0);
    assert.equal(await p.locator("#elite-question").count(), 0);
    assert(await p.evaluate(() => document.fonts.check('16px "SMC Inter"')));
    await p.screenshot({ path: "/tmp/smc-home-desktop.png", fullPage: true });
    await p.evaluate(() => taGo("dash"));
    await p.screenshot({
      path: "/tmp/smc-dashboard-desktop.png",
      fullPage: true,
    });
    for (const width of [1024, 1280, 1536, 1920, 2560, 3840]) {
      await p.setViewportSize({ width, height: 1100 });
      for (const route of [
        "home",
        "dash",
        "trades",
        "plan",
        "analyst",
        "ana",
        "risk",
        "settings",
        "economic",
      ]) {
        await p.evaluate((route) => taGo(route), route);
        assert(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          route + " overflow " + width,
        );
        assert(
          !(await p
            .locator("body")
            .innerText()
            .then((t) => /EliteX|ELITEX/.test(t))),
          route + " old brand",
        );
      }
    }
    await p.setViewportSize({ width: 1280, height: 1000 });
    await p.evaluate(() => {
      S.trades[0].pnl = 123456789.12;
      taGo("dash");
    });
    assert(
      await p.locator(".primary-metrics .k").evaluateAll((cards) =>
        cards.every((card) => {
          const value = card.querySelector("b"),
            diagram = card.querySelector(".elite-dash-spark,.elite-dash-donut");
          if (!value || !diagram) return true;
          const a = value.getBoundingClientRect(),
            b = diagram.getBoundingClientRect();
          return (
            a.right <= b.left + 1 ||
            b.right <= a.left + 1 ||
            a.bottom <= b.top + 1 ||
            b.bottom <= a.top + 1
          );
        }),
      ),
      "metric diagram overlaps number",
    );

    await p.evaluate((v) => {
      Object.assign(S, JSON.parse(v));
      R();
    }, snapshot);
    for (const width of [320, 360, 390, 430, 600, 760]) {
      await p.setViewportSize({ width, height: 844 });
      for (const route of [
        "home",
        "dash",
        "trades",
        "plan",
        "analyst",
        "ana",
        "risk",
        "settings",
        "economic",
        "cal",
        "pat",
        "rev",
        "str",
        "ins",
        "share",
      ]) {
        await p.evaluate((route) => taGo(route), route);
        assert(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          route + " phone overflow " + width,
        );
      }
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await p.evaluate(() => taGo("home"));
    await p.screenshot({ path: "/tmp/smc-home-phone.png", fullPage: true });
    assert.equal(await p.locator(".reference-event").count(), 2);
    await p.locator(".reference-topbar > .terminal-icon-button").click();
    assert(await p.evaluate(() => document.getElementById("main").inert));
    await p.locator(".scene-more-nav summary").click();
    await p.keyboard.press("Escape");
    assert(!(await p.evaluate(() => document.getElementById("main").inert)));
    await p.evaluate(() => taGo("dash"));
    await p.screenshot({
      path: "/tmp/smc-dashboard-phone.png",
      fullPage: true,
    });
    await p.evaluate(() => panelSwitch("performance"));
    assert.equal(await p.locator(".panel-block[open]").count(), 1);
    await p.locator(".panel-block>summary").nth(1).click();
    assert(
      await p
        .getByRole("heading", { name: "Por ativo", exact: true })
        .isVisible(),
    );
    await p.setViewportSize({ width: 1536, height: 1024 });
    assert.equal(await p.locator(".panel-block[open]").count(), 2);
    assert.equal(
      await p.evaluate(() => JSON.stringify(S)),
      snapshot,
      "navigation changes stored records",
    );
    await p.goto(base + "/account");
    await p.getByRole("button", { name: "Criar conta", exact: true }).click();
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: "/tmp/smc-signup-desktop.png", fullPage: true });
    assert.match(await p.title(), /SMC Elite/);
    assert(await p.getByAltText("SMC Elite", { exact: true }).isVisible());
    await p.setViewportSize({ width: 390, height: 844 });
    await p.screenshot({ path: "/tmp/smc-signup-phone.png", fullPage: true });
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "signup phone overflow",
    );
    await p.goto(base + "/YourFXjourney-standalone.html");
    await p.waitForSelector(".smc-home");
    await p.evaluate(() => document.fonts.ready);
    assert(await p.evaluate(() => document.fonts.check('16px "SMC Inter"')));
    assert.equal(await p.locator('script[src^="public/"]').count(), 0);
    assert.match(
      await p.locator(".smc-logo").getAttribute("src"),
      /^data:image/,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS SMC brand, preparation-only home, upcoming news/flags, local typography, desktop 1024–3840, all key views, long-number chart separation and registration identity",
    );
  } finally {
    await b.close();
    app.server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
