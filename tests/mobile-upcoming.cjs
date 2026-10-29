const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
  try {
    const p = await b.newPage({
        viewport: { width: 390, height: 844 },
        reducedMotion: "reduce",
      }),
      errors = [],
      queries = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.clock.setFixedTime(new Date("2026-10-28T21:00:00Z"));
    await p.route("**/api/status", (r) =>
      r.fulfill({
        json: {
          authenticated: true,
          authConfigured: true,
          services: { ai: false },
        },
      }),
    );
    const events = [
      {
        id: "past",
        name: "Evento passado",
        currency: "USD",
        impact: "high",
        time: "2026-10-28T20:00:00Z",
      },
      {
        id: "tomorrow",
        name: "Notícia de amanhã",
        currency: "CHF",
        impact: "high",
        time: "2026-10-29T13:00:00Z",
      },
      {
        id: "nextweek",
        name: "Notícia da próxima semana",
        currency: "EUR",
        impact: "medium",
        time: "2026-11-04T13:00:00Z",
      },
      {
        id: "third",
        name: "Notícia mais distante",
        currency: "USD",
        impact: "high",
        time: "2026-11-15T13:00:00Z",
      },
    ];
    await p.route("**/api/economic-calendar?*", (r) => {
      queries.push(new URL(r.request().url()));
      return r.fulfill({
        json: {
          events: [...events, events[1]],
          source: "Fixture",
          coverageStart: "2026-10-28T00:00:00Z",
          coverageEnd: "2026-11-27T23:59:59Z",
        },
      });
    });
    await p.route("**/api/market-conditions?*", (r) =>
      r.fulfill({ json: { instruments: [] } }),
    );
    await p.goto("http://127.0.0.1:" + app.server.address().port);
    await p.waitForSelector(".reference-event");
    await p.evaluate(() => {
      S.assistantProfile = { ...taProfile(), instruments: ["EURUSD"] };
      R();
    });
    assert.equal(await p.locator(".reference-event").count(), 2);
    assert.match(
      await p.locator(".reference-events").innerText(),
      /29\/10.*Notícia de amanhã/s,
    );
    assert.match(
      await p.locator(".reference-events").innerText(),
      /Notícia da próxima semana/,
    );
    assert(
      !(await p
        .locator(".reference-events")
        .innerText()
        .then((s) => s.includes("Evento passado"))),
    );
    assert.equal(queries[0].searchParams.get("to"), "2026-11-27");
    assert.equal(queries[0].searchParams.has("currencies"), false);
    await p.screenshot({ path: "/tmp/elitex-mobile-home.png", fullPage: true });
    await p.locator(".reference-event").first().click();
    assert.equal(
      await p.evaluate(() => taDailyState.calendarDate),
      "2026-10-29",
    );
    assert.equal(await p.evaluate(() => taDailyState.relevantOnly), false);
    await p.evaluate(() => taGo("home"));
    const menu = p.locator(".reference-topbar > .terminal-icon-button");
    assert.equal(await menu.getAttribute("aria-expanded"), "false");
    await menu.click();
    assert(
      await p
        .locator("body")
        .evaluate((e) => e.classList.contains("elite-mobile-nav-open")),
    );
    assert.equal(await p.locator("#main").evaluate((e) => e.inert), true);
    await p.locator(".scene-more-nav summary").click();
    await p
      .locator("#nav")
      .getByRole("button", { name: "EliteX Analyst", exact: true })
      .click();
    assert.equal(await p.evaluate(() => tab), "analyst");
    assert.equal(await p.locator("#main").evaluate((e) => e.inert), false);
    await menu.click();
    await p.keyboard.press("Escape");
    assert.equal(await menu.getAttribute("aria-expanded"), "false");
    await p.evaluate(() => {
      S.currency = "GBP";
      S.balance = 10000;
      S.balanceConfirmed = true;
      S.trades = Array.from({ length: 12 }, (_, i) =>
        mk({
          id: "m" + i,
          symbol: "EURUSD",
          open: "2026-10-26T09:00",
          close: "2026-10-26T10:00",
          pnl: i % 2 ? 30 : -10,
          risk: 10,
        }),
      );
      taGo("dash");
    });
    const snapshot = await p.evaluate(() => JSON.stringify(S));
    await p.screenshot({
      path: "/tmp/elitex-mobile-dashboard.png",
      fullPage: true,
    });
    for (const width of [320, 360, 375, 390, 414, 430, 600, 760]) {
      await p.setViewportSize({ width, height: 844 });
      for (const route of [
        "home",
        "dash",
        "trades",
        "analyst",
        "plan",
        "economic",
        "settings",
        "ana",
        "pat",
        "risk",
        "rev",
        "str",
        "ins",
        "share",
        "cal",
      ]) {
        await p.evaluate((route) => taGo(route), route);
        assert(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          route + " overflow " + width,
        );
      }
    }
    assert.equal(await p.evaluate(() => JSON.stringify(S)), snapshot);
    await p.setViewportSize({ width: 1536, height: 1024 });
    await p.evaluate(() => taGo("dash"));
    await p.waitForTimeout(50);
    const before = await p.screenshot({
      path: "/tmp/desktop-before-mobilecss.png",
      animations: "disabled",
    });
    await p.evaluate(
      () =>
        (document.querySelector('link[href="public/mobile.css"]').disabled =
          true),
    );
    const after = await p.screenshot({
      path: "/tmp/desktop-after-mobilecss.png",
      animations: "disabled",
    });
    assert(before.equals(after), "mobile stylesheet changed desktop pixels");
    await p.evaluate(
      () =>
        (document.querySelector('link[href="public/mobile.css"]').disabled =
          false),
    );
    await p.clock.setFixedTime(new Date("2026-11-05T09:00:00Z"));
    await p.evaluate(() => taGo("home"));
    await p.waitForSelector(".reference-event");
    assert.equal(await p.locator(".reference-event").count(), 1);
    assert.match(
      await p.locator(".reference-events").innerText(),
      /Notícia mais distante/,
    );
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(
      "http://127.0.0.1:" +
        app.server.address().port +
        "/YourFXjourney-standalone.html",
    );
    await p.waitForSelector(".reference-home");
    await p.locator(".reference-topbar > .terminal-icon-button").click();
    assert(
      await p
        .locator("body")
        .evaluate((e) => e.classList.contains("elite-mobile-nav-open")),
    );
    await p.keyboard.press("Escape");
    assert.equal(await p.locator('script[src^="public/"]').count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS upcoming multi-day news, chronological deduplication, mobile menu/focus/escape, all 15 routes at 320–760px, records preserved and desktop pixel comparison unchanged",
    );
  } finally {
    await b.close();
    app.server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
