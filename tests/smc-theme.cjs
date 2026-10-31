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
        viewport: { width: 1536, height: 1100 },
        reducedMotion: "reduce",
      }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.route("**/api/status", (r) =>
      r.fulfill({
        json: { authenticated: false, authConfigured: false, services: {} },
      }),
    );
    await p.goto("http://127.0.0.1:" + app.server.address().port);
    await p.waitForSelector(".smc-home");
    await p.evaluate(() => {
      S.trades = Array.from({ length: 21 }, (_, i) =>
        mk({
          id: "theme-" + i,
          symbol: "EURUSD",
          side: i < 4 ? "long" : "short",
          close: "2026-10-29T10:00",
          pnl: 10,
          risk: 5,
          behavior: { plan: true, risk: true, limits: true },
        }),
      );
      R();
    });
    const state = await p.evaluate(() => JSON.stringify(S));
    async function check(root = "#main") {
      const rows = await p.locator(root + " *").evaluateAll((ns) =>
        ns
          .filter(
            (n) =>
              n.getClientRects().length &&
              !n.matches(
                ".cd.gb2,.share-live-day.positive,.ta-volatility-high",
              ),
          )
          .flatMap((n) => {
            const s = getComputedStyle(n);
            return ["Left", "Right", "Top", "Bottom"]
              .filter((side) => {
                const rgb = s["border" + side + "Color"]
                  .match(/[\d.]+/g)
                  ?.map(Number);
                return (
                  parseFloat(s["border" + side + "Width"]) > 0 &&
                  rgb &&
                  rgb[1] > rgb[0] * 1.12 &&
                  rgb[1] > rgb[2] * 1.07 &&
                  rgb[1] - rgb[0] > 20 &&
                  (rgb.length < 4 || rgb[3] > 0.08)
                );
              })
              .map((side) => n.tagName + "." + n.className + ":" + side);
          }),
      );
      assert.deepEqual(rows, [], "legacy green decoration in " + root);
    }
    for (const tab of [
      "home",
      "dash",
      "trades",
      "analyst",
      "plan",
      "ana",
      "economic",
      "risk",
      "ins",
      "rev",
      "str",
      "pat",
      "cal",
      "share",
      "settings",
      "achievements",
    ]) {
      await p.evaluate((t) => taGo(t), tab);
      await check();
      const card = p.locator("#main .card").first();
      if (await card.count()) {
        await card.hover();
        await p.waitForTimeout(160);
        await check();
      }
      if (tab === "dash") {
        assert.match(
          await p
            .locator(".primary-metrics .g")
            .first()
            .evaluate((n) => getComputedStyle(n).color),
          /54, 207, 167/,
        );
        await p.evaluate(() =>
          document.body.classList.add("elite-high-contrast"),
        );
        await check();
        await p.evaluate(() =>
          document.body.classList.remove("elite-high-contrast"),
        );
      }
    }
    for (const width of [320, 390, 760, 1024, 1280, 1536, 1920, 3840]) {
      await p.setViewportSize({ width, height: 1000 });
      await p.evaluate(() => {
        taGo("dash");
        panelSwitch("performance");
        document
          .querySelectorAll(".panel-block")
          .forEach((d) => (d.open = true));
      });
      await p.waitForFunction(() => {
        const nodes = Array.from(
          document.querySelectorAll(".elite-dash-donut:not(.mini)"),
        );
        return (
          nodes.length === 2 &&
          nodes.every((node) => {
            const graphic = node.querySelector("svg").getBoundingClientRect(),
              caption = node
                .querySelector(".elite-dash-donut-label")
                .getBoundingClientRect(),
              value = node.querySelector("b").getBoundingClientRect();
            return (
              graphic.width > 0 &&
              caption.top >= graphic.bottom + 5 &&
              Math.hypot(value.width / 2, value.height / 2) <
                graphic.width * 0.35
            );
          })
        );
      });
      assert(
        await p.locator(".elite-dash-distribution").evaluateAll((nodes) =>
          nodes.every((node) => {
            const ring = node
                .querySelector(".elite-dash-donut")
                .getBoundingClientRect(),
              legend = node.querySelector("ul").getBoundingClientRect();
            return (
              legend.left >= ring.right + 5 || legend.top >= ring.bottom + 5
            );
          }),
        ),
        "donut legend collision " + width,
      );
      assert(
        await p.locator(".primary-metrics .k").evaluateAll((nodes) =>
          nodes
            .filter((n) => n.getClientRects().length)
            .every((node) => {
              const visual = node.querySelector(".elite-dash-donut.mini"),
                value = node.querySelector("b");
              if (!visual || !value) return true;
              const a = visual.getBoundingClientRect(),
                b = value.getBoundingClientRect();
              return (
                a.left >= b.right ||
                b.left >= a.right ||
                a.top >= b.bottom ||
                b.top >= a.bottom
              );
            }),
        ),
        "metric visual/value collision " + width,
      );
      if (width === 1920)
        await p.screenshot({
          path: "/tmp/smc-operation-type-fixed.png",
          fullPage: true,
        });
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "dashboard overflow " + width,
      );
    }
    await p.evaluate(() => taGo("settings"));
    const input = p
      .locator("#main input:not([type=checkbox]):not([type=radio])")
      .first();
    await input.focus();
    await check();
    await p.evaluate(() => taAssetOpen());
    await p.waitForSelector("#ta-assets-dialog[open]");
    await check("#ta-assets-dialog");
    assert.equal(await p.evaluate(() => JSON.stringify(S)), state);
    assert.deepEqual(errors, []);
    console.log(
      "PASS SMC graphite/gold borders across 16 views, hover/focus, contrast mode and asset picker; financial green and stored data preserved",
    );
  } finally {
    await b.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
