const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 1000 } }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.clock.setFixedTime(new Date("2026-10-28T12:00:00Z"));
    await p.goto("http://127.0.0.1:" + app.server.address().port);
    await p.waitForSelector(".elite-momentum");
    await p.evaluate(() => {
      S.balance = 1000;
      S.balanceConfirmed = true;
      S.tradingPlans = [
        TradePlanEngine.validatePlan({
          id: "p",
          version: 1,
          name: "Meu sistema",
          criteria: [
            {
              id: "rule",
              label: "Confirmar fechamento",
              definition: "Esperar a confirmação documentada",
              weight: 1,
              required: true,
            },
          ],
        }),
      ];
      S.trades = [
        mk({ id: "a", symbol: "EURUSD", close: "2026-09-30T12:00", pnl: 100 }),
        mk({ id: "b", symbol: "EURUSD", close: "2026-10-02T12:00", pnl: 100 }),
        mk({ id: "c", symbol: "GBPUSD", close: "2026-10-26T12:00", pnl: -20 }),
        mk({ id: "d", symbol: "GBPUSD", close: "2026-10-27T12:00", pnl: -10 }),
        mk({
          id: "future",
          symbol: "EURUSD",
          close: "2026-10-29T12:00",
          pnl: 999,
        }),
      ];
      F.sym = "OTHER";
      R();
    });
    let m = await p.evaluate(() => eliteMomentumModel());
    assert.equal(m.week.opening, 1200);
    assert.equal(m.week.percent, -2.5);
    assert(Math.abs(m.month.percent - (70 / 1100) * 100) < 1e-8);
    assert.equal(m.streak, 2);
    assert.match(m.tip, /2 perdas seguidas/);
    assert.match(m.tip, /Confirmar fechamento/);
    assert.match(await p.locator(".elite-momentum").innerText(), /-2,50%/);
    assert.match(await p.locator(".elite-momentum").innerText(), /6,36%/);
    assert(!/[£$€]|R\$/.test(await p.locator(".elite-momentum").innerText()));
    const stored = await p.evaluate(() => JSON.stringify(S));
    assert.equal(await p.evaluate(() => JSON.stringify(S)), stored);
    let facts = await p.evaluate(() => taBriefingInput().facts);
    assert(facts.some((f) => f.id === "loss-streak"));
    assert(facts.length <= 12);
    await p.evaluate(() => {
      S.trades[3].pnl = 40;
      R();
    });
    m = await p.evaluate(() => eliteMomentumModel());
    assert.equal(m.week.percent, (20 / 1200) * 100);
    assert.equal(m.streak, 0);
    assert.match(m.tip, /Preserve o processo/);
    assert(!/aumente|recupere/i.test(m.tip));
    await p.evaluate(() => {
      S.balanceConfirmed = false;
      R();
    });
    assert.equal(
      await p.evaluate(() => eliteMomentumModel().month.percent),
      null,
    );
    assert.match(await p.locator(".elite-momentum").innerText(), /—/);
    await p.locator(".elite-momentum-method summary").click();
    await p
      .getByRole("button", { name: "Configurar saldo inicial", exact: false })
      .click();
    assert.equal(await p.evaluate(() => tab), "dash");
    assert(await p.locator("#account-baseline").isVisible());
    await p.evaluate(() => {
      S.balanceConfirmed = true;
      S.trades = [];
      taGo("home");
    });
    assert.equal(await p.evaluate(() => eliteMomentumModel().month.percent), 0);
    assert.match(await p.locator(".elite-momentum").innerText(), /0,00%/);
    await p.evaluate(() => {
      S.balance = 0;
      R();
    });
    assert.equal(
      await p.evaluate(() => eliteMomentumModel().month.percent),
      null,
    );
    await p.evaluate(() => {
      S.balance = 1000;
      S.trades = [
        mk({ id: "x", close: "2026-10-28T12:00", pnl: -10 }),
        mk({ id: "y", close: "2026-10-28T12:00", pnl: -10 }),
        mk({ id: "z", close: "2026-10-28T12:00", pnl: 10 }),
      ];
      R();
    });
    assert.equal(await p.evaluate(() => eliteMomentumModel().streak), 0);
    const unchanged = await p.evaluate(() => JSON.stringify(S));
    await p.evaluate(() => {
      R();
      eliteMomentumModel();
      taBriefingInput();
    });
    assert.equal(await p.evaluate(() => JSON.stringify(S)), unchanged);
    for (const width of [320, 760, 1440, 1920]) {
      await p.setViewportSize({ width, height: 1000 });
      await p.evaluate(() => R());
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
    }
    await p.setViewportSize({ width: 1600, height: 1000 });
    await p.screenshot({ path: "/tmp/elitex-momentum.png", fullPage: false });
    assert.deepEqual(errors, []);
    console.log(
      "PASS monthly/weekly opening balance, percent-only summary, loss streak and plan reminder, positive/empty/missing baseline, future/filter isolation, AI facts and responsive layout",
    );
  } finally {
    await b.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
