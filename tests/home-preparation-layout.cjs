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
        viewport: { width: 1920, height: 1080 },
        reducedMotion: "reduce",
      }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.clock.setFixedTime(new Date("2026-10-30T09:00Z"));
    await p.route("**/api/status", (r) =>
      r.fulfill({
        json: { authenticated: false, authConfigured: false, services: {} },
      }),
    );
    await p.goto("http://127.0.0.1:" + app.server.address().port);
    await p.waitForSelector(".smc-home");
    await p.evaluate(() => {
      S.trades = [
        mk({ id: "keep", close: "2026-10-29T10:00", pnl: 100, risk: 10 }),
      ];
      S.assistantProfile = {
        ...taProfile(),
        name: "Alexandre Sobrenome",
        instruments: ["EURUSD", "XAUUSD", "BTCUSD"],
        session: {
          enabled: true,
          label: "Londres",
          timezone: "Europe/London",
          start: "08:00",
          end: "11:00",
          days: [1, 2, 3, 4, 5],
        },
      };
      eliteMoreNavOpen = true;
      R();
    });
    const snapshot = await p.evaluate(() => JSON.stringify(S));
    for (const width of [320, 390, 760, 1024, 1280, 1536, 1920, 3840]) {
      await p.setViewportSize({ width, height: 1080 });
      await p.evaluate(() => {
        eliteMoreNavOpen = true;
        taGo("home");
      });
      assert.equal(
        await p
          .locator(
            ".smc-home-performance,.smc-home-metrics,.smc-home-chart-grid,.smc-home .elite-momentum",
          )
          .count(),
        0,
      );
      assert.match(await p.locator(".smc-session-row").innerText(), /Londres/);
      await p.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      const typeSizes = await p
        .locator(".smc-asset-symbol b")
        .evaluateAll((ns) =>
          ns.map((n) => parseFloat(getComputedStyle(n).fontSize)),
        );
      assert(
        typeSizes.length === 3 && typeSizes.every((size) => size >= 13),
        "asset type size " + width + " " + typeSizes.join(","),
      );
      const blocks = [
        ".scene-greeting",
        ".smc-assets-card",
        ".reference-workspace-actions",
      ];
      const rects = await p.evaluate(
        (selectors) =>
          selectors.map((s) => {
            const r = document.querySelector(s).getBoundingClientRect();
            return {
              left: r.left,
              right: r.right,
              top: r.top,
              bottom: r.bottom,
            };
          }),
        blocks,
      );
      for (let i = 0; i < rects.length; i++)
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i],
            c = rects[j];
          assert(
            a.right <= c.left + 1 ||
              c.right <= a.left + 1 ||
              a.bottom <= c.top + 1 ||
              c.bottom <= a.top + 1,
            "hero overlap " + width,
          );
        }
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "page overflow " + width,
      );
      if (width <= 760) await p.evaluate(() => eliteMobileToggle());
      const nav = await p.locator("#nav button").evaluateAll((ns) =>
        ns
          .filter((n) => n.getClientRects().length)
          .map((n) => {
            const a = n.getBoundingClientRect(),
              l = n.querySelector(".elite-nav-label").getBoundingClientRect();
            return {
              top: a.top,
              bottom: a.bottom,
              labelTop: l.top,
              labelBottom: l.bottom,
            };
          }),
      );
      for (let i = 0; i < nav.length; i++) {
        assert(
          nav[i].labelTop >= nav[i].top - 1 &&
            nav[i].labelBottom <= nav[i].bottom + 1,
          "label leaves button " + width,
        );
        if (i)
          assert(nav[i].top >= nav[i - 1].bottom - 1, "nav overlap " + width);
      }
      if (width <= 760) await p.evaluate(() => eliteMobileClose());
      if (width === 1920 || width === 390)
        await p.screenshot({
          path: "/tmp/smc-preparation-" + width + ".png",
          fullPage: true,
        });
    }
    assert.equal(await p.evaluate(() => JSON.stringify(S)), snapshot);
    await p.evaluate(() => taGo("dash"));
    assert((await p.locator(".primary-metrics .k").count()) > 0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS preparation-only home, operational session, readable assets, non-overlapping hero/menu at 320–3840px, unchanged data and preserved dashboard metrics",
    );
  } finally {
    await b.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
