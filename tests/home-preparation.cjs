const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE_PATH || "/usr/bin/chromium",
  });
  try {
    const p = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.clock.setFixedTime(new Date("2026-10-28T09:00:00Z"));
    await p.route("**/api/status", (r) =>
      r.fulfill({
        json: {
          authConfigured: true,
          authenticated: true,
          services: {
            ai: false,
            economicCalendar: true,
            marketConditions: true,
          },
        },
      }),
    );
    await p.route("**/api/market-conditions?*", (r) =>
      r.fulfill({
        json: {
          source: "Fixture",
          asOf: "2026-10-28T09:00:00Z",
          instruments: [
            { symbol: "EUR/USD", volatility: "low", atrPercent: 0.05 },
            { symbol: "GBP/USD", volatility: "moderate", atrPercent: 0.2 },
            { symbol: "CAD/JPY", volatility: "high", atrPercent: 0.4 },
            { symbol: "USD/JPY", volatility: "unknown", atrPercent: null },
          ],
        },
      }),
    );
    await p.route("**/api/economic-calendar?*", (r) =>
      r.fulfill({
        json: {
          source: "Fixture",
          events: [
            {
              name: "Evento de teste",
              currency: "USD",
              time: "2026-10-28T10:00:00Z",
              impact: "high",
            },
          ],
        },
      }),
    );
    await p.goto("http://127.0.0.1:" + app.server.address().port);
    await p.waitForFunction(() => taConnection.authenticated);
    assert.match(
      await p.locator(".ta-preparation").innerText(),
      /Nome não informado/,
    );
    assert.match(
      await p.locator(".ta-preparation-plan").innerText(),
      /Salve suas regras/,
    );
    await p.evaluate(() => {
      S.assistantProfile = {
        name: "Lourran <teste>",
        timezone: "Europe/London",
        instruments: ["EURUSD", "GBPUSD", "CADJPY", "USDJPY"],
        session: {
          enabled: true,
          label: "Londres",
          timezone: "Europe/London",
          start: "09:00",
          end: "14:30",
          days: [1, 2, 3, 4, 5],
        },
      };
      S.tradingPlans = [
        TradePlanEngine.validatePlan({
          id: "fixture",
          version: 2,
          name: "Plano de teste",
          risk: { minRR: 2 },
          criteria: [
            {
              id: "confirm",
              label: "Confirmação <teste>",
              definition: "Esperar fechamento documentado.",
              required: true,
              critical: false,
              kind: "evidence",
              role: "confirmation",
              weight: 1,
            },
          ],
        }),
      ];
      S.trades = [
        mk({
          id: "today",
          symbol: "EURUSD",
          close: "2026-10-28T08:00",
          pnl: -20,
          risk: 10,
          behavior: { plan: true },
        }),
        mk({
          id: "yesterday",
          symbol: "EURUSD",
          close: "2026-10-27T08:00",
          pnl: 200,
          risk: 10,
        }),
        mk({
          id: "future",
          symbol: "EURUSD",
          close: "2026-10-29T08:00",
          pnl: 400,
          risk: 10,
        }),
      ];
      save();
      taDailyReset();
      R();
    });
    await p.waitForSelector(".ta-volatility-high");
    assert.equal(await p.locator(".ta-volatility-low").count(), 1);
    assert.equal(await p.locator(".ta-volatility-moderate").count(), 1);
    assert.equal(await p.locator(".ta-volatility-unknown").count(), 1);
    const colors = await p
      .locator(".ta-volatility")
      .evaluateAll((es) => es.map((e) => getComputedStyle(e).color));
    assert.equal(new Set(colors).size, 4);
    assert.match(
      await p.locator(".ta-personal-profile").innerText(),
      /Lourran <teste>/,
    );
    assert.equal(await p.locator(".ta-personal-profile script").count(), 0);
    assert.match(
      await p.locator(".ta-preparation-plan").innerText(),
      /Plano de teste/,
    );
    assert.match(await p.locator(".ta-preparation-plan").innerText(), /2.00/);
    assert.match(
      await p.locator(".ta-preparation-plan").innerText(),
      /Confirmação <teste>/,
    );
    assert.match(await p.locator(".ta-preparation-stats").innerText(), /1\/1/);
    assert.match(await p.locator(".ta-preparation-stats").innerText(), /20/);
    assert.ok(
      !(await p.locator(".ta-preparation-stats").innerText()).includes("400"),
    );
    assert.match(
      await p.locator(".ta-preparation-events").innerText(),
      /Evento de teste/,
    );
    const snapshot = await p.evaluate(() => JSON.stringify(S));
    assert.equal(await p.locator(".terminal-market-backdrop").count(), 1);
    assert.equal(await p.locator(".ambient-candle").count(), 96);
    assert.equal(
      await p.locator(".terminal-market-backdrop").getAttribute("aria-hidden"),
      "true",
    );
    await p.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await p
        .locator(".ambient-market-track")
        .evaluate((e) => getComputedStyle(e).animationName),
      "none",
    );
    await p.emulateMedia({ reducedMotion: "no-preference" });
    await p.screenshot({
      path: "/tmp/home-preparation-desktop.png",
      fullPage: true,
    });
    for (const width of [1920, 1440, 1024, 760, 390, 320]) {
      await p.setViewportSize({ width, height: 1000 });
      await p.evaluate(() => R());
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "overflow " + width,
      );
      assert.equal(await p.locator(".terminal-market-backdrop").count(), 1);
      assert.ok(
        await p.evaluate(() => {
          const overview = document
              .querySelector(".ta-home-overview")
              .getBoundingClientRect(),
            radar = document
              .querySelector(".elite-operational>.ta-ready-card")
              .getBoundingClientRect(),
            events = document
              .querySelector(".ta-home-events")
              .getBoundingClientRect();
          const cards = [
            ...document.querySelectorAll(
              ".ta-session-card,.ta-market-card,.ta-assistant-insight,.elite-operational>.ta-ready-card,.ta-home-events",
            ),
          ].map((e) => e.getBoundingClientRect());
          return (
            radar.top >= overview.bottom - 1 &&
            events.top >= radar.bottom - 1 &&
            cards.every((a, i) =>
              cards
                .slice(i + 1)
                .every(
                  (b) =>
                    Math.min(a.right, b.right) - Math.max(a.left, b.left) <=
                      1 ||
                    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) <= 1,
                ),
            )
          );
        }),
        "home cards overlap at " + width,
      );
    }
    await p
      .locator(".ta-personal-profile")
      .getByRole("button", { name: "Perfil", exact: true })
      .click();
    assert.equal(await p.evaluate(() => tab), "settings");
    await p.evaluate(() => taGo("home"));
    await p
      .locator(".ta-preparation-events")
      .getByRole("button", { name: "Conferir calendário" })
      .click();
    assert.equal(await p.evaluate(() => tab), "economic");
    assert.equal(await p.evaluate(() => JSON.stringify(S)), snapshot);
    await p.evaluate(() => {
      taConnection.authenticated = false;
      taGo("home");
    });
    assert.match(
      await p.locator(".ta-preparation-events").innerText(),
      /ainda não confirmado/,
    );
    assert.match(
      await p.locator(".ta-personal-profile").innerText(),
      /não autenticada/,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS personal preparation uses only recorded today trades and plan, escapes text, distinguishes login and missing data, colors volatility, preserves records, links work, animated backdrop stays decorative and honors reduced motion, responsive 320–1920px",
    );
  } finally {
    await browser.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
