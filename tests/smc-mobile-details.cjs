"use strict";
const { chromium, devices } = require("playwright"),
  assert = require("node:assert/strict"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
  });
  try {
    const context = await browser.newContext({
        ...devices["iPhone 13"],
        locale: "pt-BR",
        reducedMotion: "reduce",
      }),
      p = await context.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.clock.setFixedTime(new Date("2026-10-30T09:00:00Z"));
    await p.route("**/api/status", (r) =>
      r.fulfill({
        json: {
          authenticated: true,
          authConfigured: true,
          services: {
            economicCalendar: true,
            ai: false,
            marketConditions: false,
          },
        },
      }),
    );
    await p.route("**/api/economic-calendar?*", (r) =>
      r.fulfill({
        json: {
          events: [
            {
              id: "e1",
              currency: "EUR",
              name: "Gross Domestic Product s.a. YoY",
              time: "2026-10-30T10:00:00Z",
              impact: "high",
              previous: "1.2%",
              forecast: "1.1%",
              actual: "1.3%",
            },
            {
              id: "e2",
              currency: "USD",
              name: "Personal Consumption Expenditures – Price Index (Year-over-Year)",
              time: "2026-10-30T13:00:00Z",
              impact: "high",
              previous: "3.0%",
              forecast: "3.1%",
              actual: "",
            },
            {
              id: "e3",
              currency: "CAD",
              name: "Gross Domestic Product s.a. QoQ",
              time: "2026-10-30T14:00:00Z",
              impact: "medium",
              previous: "0.6%",
              forecast: "0.2%",
              actual: "0.4%",
            },
          ],
        },
      }),
    );
    await p.route("**/api/market-conditions?*", (r) =>
      r.fulfill({ json: { instruments: [] } }),
    );
    const base = "http://127.0.0.1:" + app.server.address().port;
    await p.goto(base);
    await p.waitForSelector(".smc-home");
    await p.evaluate(() => {
      S.currency = "USD";
      S.assistantProfile = {
        ...taProfile(),
        name: "Lourran",
        timezone: "Europe/London",
        instruments: ["EURUSD", "USDCAD"],
        session: {
          name: "Londres",
          timezone: "Europe/London",
          start: "08:00",
          end: "17:00",
          days: [1, 2, 3, 4, 5],
        },
      };
      S.trades = [
        mk({
          id: "mobile-details",
          symbol: "EURUSD",
          open: "2026-10-30T08:00",
          close: "2026-10-30T08:30",
          pnl: 123456.78,
          risk: 100,
        }),
      ];
      R();
    });
    const snapshot = await p.evaluate(() => JSON.stringify(S));
    for (const width of [320, 375, 390, 393, 430, 600, 760]) {
      await p.setViewportSize({ width, height: 700 });
      for (const route of ["dash", "trades", "ana", "economic", "settings"]) {
        await p.evaluate((route) => taGo(route), route);
        assert(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          route + " page overflow " + width,
        );
        assert(
          await p.locator(".filters label").evaluateAll((labels) =>
            labels.every((label) => {
              const e = label.querySelector("input,select");
              if (!e) return true;
              const a = e.getBoundingClientRect(),
                b = label.getBoundingClientRect();
              return a.left >= b.left - 1 && a.right <= b.right + 1;
            }),
          ),
          route + " filter escapes label " + width,
        );
      }
      await p.evaluate(() => {
        taDailyState.relevantOnly = false;
        taGo("economic");
      });
      await p
        .waitForSelector(".ta-event", { timeout: 3000 })
        .catch(async (e) => {
          console.log(await p.locator("main").innerText());
          throw e;
        });
      assert.equal(await p.locator(".ta-event").count(), 3);
      assert.equal(await p.locator(".ta-event-currency svg").count(), 3);
      assert(
        await p.locator(".ta-event").evaluateAll((rows) =>
          rows.every((row) => {
            const info = row
                .querySelector(".ta-event-info")
                .getBoundingClientRect(),
              time = row
                .querySelector(".ta-event-time")
                .getBoundingClientRect();
            return (
              info.left >= time.right &&
              row.scrollWidth <= row.clientWidth + 1 &&
              row.getBoundingClientRect().height < 240
            );
          }),
        ),
        "news width or excessive height " + width,
      );
      await p.evaluate(() => eliteOpenTools());
      const d = p.locator("#elite-tools-dialog");
      assert(await d.isVisible());
      assert(
        await p
          .locator(".elite-tool-result svg")
          .evaluateAll((icons) =>
            icons.every(
              (icon) => getComputedStyle(icon).color === "rgb(215, 185, 130)",
            ),
          ),
        "old green tools",
      );
      assert(
        await d.evaluate((d) => {
          const list = d
              .querySelector("#elite-tools-results")
              .getBoundingClientRect(),
            footer = d.querySelector(":scope > small").getBoundingClientRect();
          return (
            list.bottom <= footer.top + 1 &&
            d.scrollHeight <= d.clientHeight + 1
          );
        }),
        "tool footer overlaps scroll area " + width,
      );
      await p.locator("#elite-tools-query").fill("noticias");
      assert.equal(await p.locator(".elite-tool-result").count(), 1);
      await p
        .getByRole("button", { name: "Notícias", exact: false })
        .last()
        .click();
      assert.equal(await p.evaluate(() => tab), "economic");
      await p.evaluate(() => eliteOpenTradeSearch());
      await p.locator("#elite-trade-query").fill("EURUSD");
      assert.equal(await p.locator(".elite-trade-result").count(), 1);
      assert(
        await p
          .locator("#elite-trade-date")
          .evaluate(
            (e) =>
              e.getBoundingClientRect().right <=
              e.parentElement.getBoundingClientRect().right + 1,
          ),
      );
      await p.keyboard.press("Escape");
    }
    await p.setViewportSize({ width: 390, height: 700 });
    await p.evaluate(() => taGo("economic"));
    await p.screenshot({
      path: "/tmp/smc-news-mobile-refined.png",
      fullPage: true,
    });
    await p.evaluate(() => eliteOpenTools());
    await p.screenshot({ path: "/tmp/smc-tools-mobile-refined.png" });
    await p.keyboard.press("Escape");
    await p.evaluate(() => taGo("trades"));
    await p.screenshot({
      path: "/tmp/smc-diary-mobile-refined.png",
      fullPage: true,
    });
    assert.equal(
      await p.evaluate(() => JSON.stringify(S)),
      snapshot,
      "visual changes mutated records",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS mobile 320–760: filters stay within labels, compact news and flags, gold search states, scrolling dialogs/footer, trade search and unchanged records",
    );
  } finally {
    await browser.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
