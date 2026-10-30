const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
  try {
    const p = await b.newPage({ viewport: { width: 1536, height: 1100 } }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.clock.setFixedTime(new Date("2026-10-28T12:00:00Z"));
    await p.goto("http://127.0.0.1:" + app.server.address().port);
    await p.waitForSelector(".reference-home");
    await p.evaluate(() => {
      S.currency = "GBP";
      S.balance = 10000;
      S.balanceConfirmed = true;
      S.trades = Array.from({ length: 48 }, (_, i) =>
        mk({
          id: "d" + i,
          symbol: ["EURUSD", "GBPUSD", "XAUUSD", "US30"][i % 4],
          side: i % 3 ? "long" : "short",
          open: `2026-10-${String(1 + Math.floor(i / 2)).padStart(2, "0")}T${i % 2 ? "14" : "09"}:00`,
          close: `2026-10-${String(1 + Math.floor(i / 2)).padStart(2, "0")}T${i % 2 ? "15" : "10"}:00`,
          pnl: i % 4 === 0 ? -70 : i % 7 === 0 ? 0 : 40 + i,
          risk: 50,
        }),
      );
      cm = new Date(2026, 9, 1);
      taGo("dash");
    });
    const snapshot = await p.evaluate(() => JSON.stringify(S)),
      net = await p.evaluate(() => st(ft()).net);
    assert.equal(await p.locator(".primary-metrics .k").count(), 6);
    assert.equal(await p.locator(".elite-dash-charts > .card").count(), 2);
    assert.equal(await p.locator(".elite-dash-support > .card").count(), 4);
    assert.equal(
      await p.locator(".elite-dash-calendar .cd:not(.e)").count(),
      31,
    );
    assert.equal(
      await p
        .locator('[data-terminal-chart="performance"] .chart-point')
        .count(),
      24,
    );
    assert.equal(
      await p.locator(".elite-dash-extra").evaluate((e) => e.open),
      false,
    );
    assert.match(await p.locator(".primary-metrics").innerText(), /48/);
    await p.screenshot({
      path: "/tmp/elitex-dashboard-reference.png",
      fullPage: true,
    });
    assert.equal(
      await p.locator(".smc-filters-disclosure").evaluate((e) => e.open),
      false,
    );
    assert(!(await p.getByLabel("Data inicial", { exact: true }).isVisible()));
    await p.locator(".smc-filters-disclosure > summary").click();
    await p.getByLabel("Unidade do painel", { exact: true }).selectOption("r");
    const rTotal = await p.evaluate(() => eliteDashModel(ft()).stats.net);
    assert(Math.abs(rTotal - net / 50) < 1e-8);
    assert.match(await p.locator(".primary-metrics").innerText(), /R/);
    await p
      .getByLabel("Unidade do painel", { exact: true })
      .selectOption("money");
    await p
      .getByLabel("Agrupar desempenho", { exact: true })
      .selectOption("month");
    assert.match(await p.locator(".elite-dash-footer").innerText(), /2026-10/);
    await p
      .getByRole("button", { name: "Ocultar valores", exact: true })
      .click();
    assert.match(await p.locator(".primary-metrics").innerText(), /••••/);
    assert.equal(await p.locator("#account-baseline").count(), 0);
    assert(
      !(await p
        .locator(".elite-dashboard")
        .innerText()
        .then((t) => t.includes("£"))),
    );
    await p
      .getByRole("button", { name: "Mostrar valores", exact: true })
      .click();
    await p.getByLabel("Data inicial", { exact: true }).fill("2026-10-10");
    await p.getByLabel("Data final", { exact: true }).fill("2026-10-12");
    assert.equal(
      await p
        .locator('[data-terminal-chart="performance"] .chart-point')
        .count(),
      3,
    );
    await p
      .getByLabel("Sessão do painel", { exact: true })
      .selectOption("Londres (07–12)");
    assert.equal(await p.evaluate(() => eliteDashModel(ft()).stats.n), 3);
    await p.getByLabel("Sessão do painel", { exact: true }).selectOption("");
    const filteredStats = await p.evaluate(() =>
      JSON.stringify(eliteDashModel(ft()).stats),
    );
    await p.locator(".smc-filters-disclosure > summary").click();
    assert.match(
      await p.locator(".smc-filter-summary").innerText(),
      /10\/10\/2026/,
    );
    assert.equal(
      await p.evaluate(() => JSON.stringify(eliteDashModel(ft()).stats)),
      filteredStats,
    );
    assert(
      (await p.locator(".smc-filters-disclosure").boundingBox()).height < 64,
    );

    await p
      .locator(".elite-dash-calendar .cd")
      .filter({ has: p.locator("b", { hasText: /^10$/ }) })
      .click();
    assert.equal(await p.locator("#daydlg .day-trade").count(), 2);
    await p.evaluate(() => document.getElementById("daydlg").close());
    assert.equal(await p.evaluate(() => JSON.stringify(S)), snapshot);
    for (const width of [320, 390, 760, 1024, 1280, 1536, 1920]) {
      await p.setViewportSize({ width, height: 1000 });
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "overflow " + width,
      );
    }
    await p.evaluate(() => {
      F = { from: "", to: "", sym: "", strat: "" };
      S.trades[0].risk = null;
      eliteDashUnit = "r";
      R();
    });
    assert.equal(await p.evaluate(() => eliteDashUnit), "money");
    assert.equal(
      await p
        .locator('[aria-label="Unidade do painel"] option[value="r"]')
        .evaluate((e) => e.disabled),
      true,
    );
    await p.evaluate(() => {
      F.sym = "NONE";
      R();
    });
    assert.match(
      await p.locator(".elite-dashboard").innerText(),
      /Aguardando operações/,
    );
    await p.goto(
      "http://127.0.0.1:" +
        app.server.address().port +
        "/YourFXjourney-standalone.html",
    );
    await p.waitForSelector(".reference-home");
    await p.evaluate(() => taGo("dash"));
    assert.equal(await p.locator(".primary-metrics .k").count(), 6);
    assert.equal(await p.locator('script[src^="public/"]').count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS reference dashboard: six metrics, real charts/donuts/groups, R coverage, monetary privacy, calendar drilldown, date filters, empty state, unchanged history and 320–1920px",
    );
  } finally {
    await b.close();
    app.server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
