const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
  });
  try {
    const p = await browser.newPage({
        viewport: { width: 1440, height: 1100 },
      }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("http://127.0.0.1:" + app.server.address().port);
    await p.waitForSelector(".reference-home");
    await p.evaluate(() => {
      S.balance = 10000;
      S.balanceConfirmed = true;
      S.currency = "GBP";
      S.trades = [
        mk({
          id: "a",
          symbol: "EURUSD",
          close: "2026-10-01T12:00",
          pnl: 300,
          risk: 100,
          emotion: "Calmo",
          notes: "Entrada confirmada",
          feelings: "Seguro",
        }),
        mk({
          id: "b",
          symbol: "EURUSD",
          close: "2026-10-02T12:00",
          pnl: -100,
          risk: 100,
        }),
        mk({
          id: "c",
          symbol: "EURUSD",
          side: "long",
          close: "2026-10-03T12:00",
          entry: 100,
          target: 130,
          exit: 120,
          plannedRR: 3,
          pnl: 200,
        }),
      ];
      diaryMonth = "2026-10";
      taGo("trades");
    });
    assert.equal(await p.locator(".diary-entry").count(), 3);
    await p.getByLabel("Mês", { exact: true }).fill("2026-09");
    assert.equal(await p.evaluate(() => diaryMonth), "2026-09");
    await p.getByLabel("Mês", { exact: true }).fill("2026-10");
    await p.screenshot({ path: "/tmp/elitex-diary.png", fullPage: true });
    assert.match(await p.locator(".diary-gallery").innerText(), /Seguro/);
    await p.locator(".diary-day").nth(0).click();
    assert.equal(await p.locator(".diary-entry").count(), 1);
    await p.getByRole("button", { name: "+ Registrar no diário" }).click();
    assert(await p.locator("#f_symbol").isVisible());
    assert(await p.locator("#f_notes").isVisible());
    assert.equal(
      await p.locator("#trade-technical").getAttribute("open"),
      null,
    );
    await p.locator("#f_symbol").fill("GBPUSD");
    await p.locator("#f_close").fill("2026-10-01T14:00");
    await p.locator("#f_pnl").fill("50");
    await p.locator("#f_feelings").fill("Concentrado");
    await p
      .locator("#dlg")
      .getByRole("button", { name: "Salvar", exact: true })
      .click();
    assert.equal(
      await p.evaluate(() => S.trades.at(-1).feelings),
      "Concentrado",
    );
    assert.equal(
      await p.evaluate(
        () => realizedTradeR(S.trades.find((t) => t.id === "c")).value,
      ),
      2,
    );
    assert.equal(
      await p.evaluate(() => realizedTradeR({ pnl: 100, plannedRR: 3 }).value),
      null,
    );
    assert.equal(await p.evaluate(() => shareRiskSuggestion()), 100);
    await p.evaluate(() => {
      F.from = "2026-10-03";
      F.sym = "OTHER";
      chartMode = "balance";
      taGo("dash");
    });
    assert(await p.locator('[data-terminal-chart="performance"] svg').count());
    assert.deepEqual(
      await p.evaluate(() =>
        accountHistoryCurve()
          .map((x) => x.value)
          .slice(0, 4),
      ),
      [10000, 10350, 10250, 10450],
    );
    assert.equal(await p.evaluate(() => chartMode), "balance");
    for (const mode of ["pnl", "daily", "dd"]) {
      await p.evaluate((mode) => {
        F = { from: "", to: "", sym: "", strat: "" };
        chartMode = mode;
        R();
      }, mode);
      assert.equal(
        await p.locator('[data-terminal-chart="performance"] svg').count(),
        1,
      );
    }
    await p.evaluate(() => taGo("home"));
    assert.equal(
      await p.locator("#main .card:not(.premium-lit-card)").count(),
      0,
    );
    for (const width of [320, 760, 1440, 1920]) {
      await p.setViewportSize({ width, height: 1100 });
      await p.evaluate(() => taGo("trades"));
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS diary calendar/gallery, quick editor persistence, evidence-based reconstructed R, risk suggestion, full balance baseline independent of filters, all chart modes, consistent card effect and 320–1920px",
    );
  } finally {
    await browser.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
