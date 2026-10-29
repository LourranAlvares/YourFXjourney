const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
  try {
    const p = await b.newPage({ viewport: { width: 1536, height: 1024 } }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.clock.setFixedTime(new Date("2026-10-28T09:12:34Z"));
    await p.route("**/api/status", (r) =>
      r.fulfill({
        json: {
          authenticated: true,
          authConfigured: true,
          services: {
            ai: true,
            marketConditions: true,
            economicCalendar: true,
          },
        },
      }),
    );
    await p.route("**/api/market-conditions?*", (r) =>
      r.fulfill({
        json: {
          source: "Fixture",
          instruments: [
            { symbol: "GBP/USD", volatility: "low", atrPercent: 0.08 },
            { symbol: "EUR/USD", volatility: "low", atrPercent: 0.07 },
            { symbol: "XAU/USD", volatility: "moderate", atrPercent: 0.25 },
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
              time: "2026-10-28T11:00:00Z",
              impact: "high",
            },
            {
              name: "Outro evento de teste",
              currency: "GBP",
              time: "2026-10-28T14:30:00Z",
              impact: "medium",
            },
          ],
        },
      }),
    );
    await p.goto("http://127.0.0.1:" + app.server.address().port);
    await p.waitForSelector(".reference-home");
    await p.evaluate(() => {
      S.assistantProfile = {
        ...taProfile(),
        name: "Lourran",
        timezone: "Europe/London",
        instruments: ["GBPUSD", "EURUSD", "XAUUSD"],
      };
      S.balance = 10000;
      S.balanceConfirmed = true;
      S.trades = [
        mk({
          id: "t1",
          symbol: "EURUSD",
          close: "2026-10-27T12:00",
          pnl: 100,
          risk: 50,
        }),
      ];
      taDailyReset();
      R();
    });
    await p.waitForSelector(".reference-asset-grid article");
    await p.waitForFunction(() => document.querySelector(".reference-event"));
    assert.equal(await p.locator("#elite-question").count(), 0);
    assert.match(
      await p.locator(".reference-briefing").innerText(),
      /Semana positiva/,
    );
    assert.equal(await p.locator(".reference-event").count(), 2);
    assert.equal(
      await p.locator(".reference-currency .elite-news-flag").count(),
      2,
    );
    assert.equal(
      await p.getByRole("img", { name: "Estados Unidos", exact: true }).count(),
      1,
    );
    const flags = await p.evaluate(() =>
      [
        "USD",
        "CAD",
        "GBP",
        "EUR",
        "JPY",
        "CHF",
        "AUD",
        "NZD",
        "BRL",
        "CNY",
        "CNH",
        "HKD",
        "SGD",
        "SEK",
        "NOK",
        "MXN",
        "ZAR",
      ].map((c) => eliteNewsFlag(c)),
    );
    assert(
      flags.every(
        (f) => f.includes('class="elite-news-flag"') && !f.includes("http"),
      ),
    );
    assert.match(await p.evaluate(() => eliteNewsFlag("CAD")), /Canadá/);

    assert.equal(await p.locator(".reference-asset-grid article").count(), 3);
    const icons = await p.evaluate(() => ({
      missing: tabs.filter(([id]) => !terminalIcon(id)).map(([id]) => id),
      gold: eliteAssetIcon("XAU/USD"),
      forex: eliteAssetIcon("EURUSD"),
      stock: eliteAssetIcon("AAPL"),
      oil: eliteAssetIcon("USOIL"),
      crypto: eliteAssetIcon("BTCUSD"),
      index: eliteAssetIcon("US500"),
      unknown: terminalIcon("nonexistent"),
    }));
    assert.deepEqual(icons.missing, []);
    assert.match(icons.gold, /data-icon="gold"/);
    assert.match(icons.forex, /asset-fx/);
    assert.match(icons.stock, /data-icon="stock"/);
    assert.match(icons.oil, /data-icon="oil"/);
    assert.match(icons.crypto, /data-icon="bitcoin"/);
    assert.match(icons.index, /data-icon="index"/);
    assert.equal(icons.unknown, "");
    const snapshot = await p.evaluate(() => JSON.stringify(S));
    await p.screenshot({
      path: "/tmp/elitex-reference-v2.png",
      fullPage: true,
    });
    assert.equal(
      await p
        .locator("#nav")
        .getByRole("button", { name: "Notícias", exact: true })
        .count(),
      1,
    );
    assert.equal(await p.locator(".asset-gold svg").count(), 1);
    assert.equal(await p.locator(".reference-brief-icon.focus svg").count(), 1);
    await p
      .getByRole("button", { name: "Buscar trades realizados", exact: true })
      .click();
    await p.locator("#elite-trade-query").fill("EURUSD 27/10/2026");
    assert.equal(await p.locator(".elite-trade-result").count(), 1);
    await p.locator("#elite-trade-date").fill("2026-10-28");
    assert.equal(await p.locator(".elite-trade-result").count(), 0);
    await p.locator("#elite-trade-date").fill("2026-10-27");
    await p.locator(".elite-trade-result").click();
    assert.equal(await p.evaluate(() => cur.id), "t1");
    await p.evaluate(() => document.getElementById("dlg").close());
    await p.keyboard.press("Control+k");
    assert(
      await p.locator("#elite-trade-search-dialog").evaluate((e) => e.open),
    );
    await p.setViewportSize({ width: 320, height: 850 });
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await p.getByRole("button", { name: "Fechar", exact: true }).click();
    await p.setViewportSize({ width: 1536, height: 1024 });
    await p.locator(".reference-command").click();
    await p.locator("#elite-tools-query").fill("analyst");
    await p.locator(".elite-tool-result").click();
    assert.equal(await p.evaluate(() => tab), "analyst");
    await p.evaluate(() => taGo("dash"));
    assert(
      await p
        .locator(".primary-metrics .k")
        .evaluateAll((rows) =>
          rows.every(
            (e) => getComputedStyle(e).backgroundColor === "rgba(0, 0, 0, 0)",
          ),
        ),
    );
    await p.screenshot({
      path: "/tmp/elitex-dashboard-unified.png",
      fullPage: true,
    });
    await p.evaluate(() => toggleDashboardMoney());
    await p
      .getByRole("button", { name: "Buscar trades realizados", exact: true })
      .click();
    assert.match(await p.locator(".elite-trade-result").innerText(), /••••/);
    await p.getByRole("button", { name: "Fechar", exact: true }).click();
    await p.evaluate(() => toggleDashboardMoney());
    await p.evaluate(() => taGo("home"));
    await p.getByRole("button", { name: "Ver pontos de atenção" }).click();
    assert.match(
      await p.locator("#elite-alerts-dialog").innerText(),
      /semana está positiva/,
    );
    await p.getByRole("button", { name: "Fechar", exact: true }).click();
    await p.getByRole("button", { name: "Alternar contraste" }).click();
    assert(
      await p
        .locator("body")
        .evaluate((e) => e.classList.contains("elite-high-contrast")),
    );
    assert.equal(await p.evaluate(() => JSON.stringify(S)), snapshot);
    for (const width of [320, 390, 760, 1024, 1280, 1536, 1920]) {
      await p.setViewportSize({ width, height: 1024 });
      for (const route of [
        "home",
        "dash",
        "trades",
        "analyst",
        "ins",
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
        if (width > 760) {
          const h = await p.locator("header").boundingBox(),
            m = await p.locator("#main").boundingBox();
          assert(m.x >= h.width - 1, "sidebar cover " + route);
        }
      }
    }
    await p.goto(
      "http://127.0.0.1:" +
        app.server.address().port +
        "/YourFXjourney-standalone.html",
    );
    await p.waitForSelector(".reference-home");
    assert(
      await p
        .locator(".reference-home")
        .evaluate((e) =>
          getComputedStyle(e).backgroundImage.includes(
            "data:image/png;base64,",
          ),
        ),
    );
    assert.equal(await p.locator('script[src^="public/"]').count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS reference composition, actual data, tool search/CtrlK, alerts, contrast, unchanged records and all key routes at 320–1920px",
    );
  } finally {
    await b.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
