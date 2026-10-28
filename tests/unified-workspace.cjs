const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
  try {
    const p = await b.newPage({ viewport: { width: 1440, height: 1000 } }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("http://127.0.0.1:" + app.server.address().port);
    await p.waitForSelector(".scene-focus");
    await p.evaluate(() => {
      S.trades = Array.from({ length: 8 }, (_, i) =>
        mk({
          id: "test" + i,
          symbol: "EURUSD",
          open: taDailyDate() + "T08:00",
          close: taDailyDate() + "T09:00",
          pnl: i % 2 ? 30 : -10,
          risk: 10,
          behavior: { errors: [INS_ERRORS[0][0]], plan: false },
        }),
      );
      R();
    });
    assert.match(await p.locator(".scene-focus").innerText(), /8 de 8/);
    await p.route("**/api/briefing", async (r) => {
      const body = r.request().postDataJSON();
      await r.fulfill({
        json: {
          action:
            "Confira seus critérios de entrada antes da próxima operação.",
          facts: [body.facts[0]],
          provider: "OpenAI",
          asOf: "2026-10-28T12:00:00Z",
        },
      });
    });
    await p.evaluate(() => {
      taConnection.authenticated = true;
      taConnection.services.ai = true;
      R();
    });
    await p
      .getByRole("button", { name: "Atualizar foco com IA", exact: false })
      .click();
    await p.waitForFunction(() => taBriefingHasResult());
    assert.match(
      await p.locator(".scene-focus").innerText(),
      /Confira seus critérios/,
    );
    const snapshot = await p.evaluate(() => JSON.stringify(S));
    await p.locator(".scene-more-nav summary").click();
    assert(await p.locator(".scene-more-nav").evaluate((e) => e.open));
    await p.getByRole("button", { name: "Trade Analyst", exact: true }).click();
    assert.equal(await p.evaluate(() => tab), "analyst");
    assert(await p.locator(".scene-more-nav").evaluate((e) => e.open));
    for (const width of [320, 760, 1024, 1440, 1920]) {
      await p.setViewportSize({ width, height: 1000 });
      for (const route of [
        "home",
        "dash",
        "trades",
        "economic",
        "plan",
        "ana",
        "risk",
        "settings",
        "analyst",
        "ins",
        "rev",
        "pat",
        "str",
        "share",
        "cal",
      ]) {
        await p.evaluate((route) => taGo(route), route);
        assert(
          await p
            .locator("body")
            .evaluate((e) => e.classList.contains("elitex-unified")),
        );
        assert(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          route + " overflow at " + width,
        );
        if (width > 760) {
          const nav = await p
            .locator("#nav button")
            .evaluateAll((es) =>
              es
                .filter((e) => e.getClientRects().length)
                .map((e) => ({
                  left: e.getBoundingClientRect().left,
                  width: e.getBoundingClientRect().width,
                })),
            );
          assert(
            nav.every(
              (v) =>
                Math.abs(v.left - nav[0].left) < 1 &&
                Math.abs(v.width - nav[0].width) < 1,
            ),
            "uneven navigation " + route,
          );
          const header = await p.locator("header").boundingBox(),
            main = await p.locator("#main").boundingBox();
          assert(
            main.x >= header.x + header.width - 1,
            "sidebar overlaps " + route,
          );
        }
      }
    }
    await p.setViewportSize({ width: 1440, height: 1000 });
    await p.evaluate(() => taGo("home"));
    assert.notEqual(
      await p
        .locator(".scene-character-motion")
        .evaluate((e) => getComputedStyle(e).animationName),
      "none",
    );
    await p.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await p
        .locator(".scene-character-motion")
        .evaluate((e) => getComputedStyle(e).animationName),
      "none",
    );
    assert.equal(await p.evaluate(() => JSON.stringify(S)), snapshot);
    await p.evaluate(() => taGo("dash"));
    await p.screenshot({
      path: "/tmp/elitex-unified-dashboard.png",
      fullPage: false,
    });
    assert.deepEqual(errors, []);
    console.log(
      "PASS all 15 routes at 320–1920, shared shell, aligned expanded nav, no sidebar coverage, real error focus, reduced motion, records unchanged",
    );
  } finally {
    await b.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
