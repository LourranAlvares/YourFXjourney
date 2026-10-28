const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const b = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE_PATH || "/usr/bin/chromium",
  });
  try {
    const p = await b.newPage({ viewport: { width: 1440, height: 1100 } }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("http://127.0.0.1:" + app.server.address().port);
    await p.evaluate(() => {
      S = {
        ...S,
        currency: "GBP",
        balance: 10000,
        balanceConfirmed: true,
        trades: Array.from({ length: 60 }, (_, i) =>
          mk({
            id: "premium-" + i,
            symbol: "EURUSD",
            open: new Date(Date.UTC(2026, 7, 1 + i, 9))
              .toISOString()
              .slice(0, 16),
            close: new Date(Date.UTC(2026, 7, 1 + i, 10))
              .toISOString()
              .slice(0, 16),
            pnl: i % 4 === 0 ? -80 : 45 + i,
            risk: 40,
          }),
        ),
      };
      save();
      cm = new Date(2026, 7, 1);
      SC.month = "2026-08";
      taGo("dash");
    });
    const snapshot = await p.evaluate(() => JSON.stringify(S)),
      stats = await p.evaluate(() => JSON.stringify(st(ft()))),
      root = p.locator('[data-terminal-chart="performance"]');
    assert.equal(await p.locator(".premium-nav-marker").count(), 1);
    const originalCount = await root.locator(".chart-point").count();
    assert.equal(originalCount, 60);
    await root.locator("svg").hover();
    await p.mouse.wheel(0, 120);
    await p.waitForTimeout(60);
    assert.equal(await root.locator(".chart-point").count(), originalCount);
    await root.locator("svg").hover();
    await p.keyboard.down("Control");
    await p.mouse.wheel(0, -120);
    await p.keyboard.up("Control");
    await p.waitForFunction(
      () =>
        terminalCharts.get("performance").state.end -
          terminalCharts.get("performance").state.start <
        60,
    );
    const before = await p.evaluate(
      () => terminalCharts.get("performance").state.start,
    );
    const box = await root.locator("svg").boundingBox();
    const y = box.y + box.height / 2,
      x = box.x + box.width * 0.65;
    await p.mouse.move(x, y);
    await p.mouse.down();
    await p.mouse.move(x - 160, y, { steps: 10 });
    await p.mouse.up();
    assert.ok(
      await p.evaluate(
        (n) => terminalCharts.get("performance").state.start > n,
        before,
      ),
    );
    await root.locator("svg").hover();
    await p.waitForTimeout(60);
    assert.equal(
      await root.locator(".premium-chart-tooltip").isVisible(),
      true,
    );
    assert.match(
      await root.locator(".premium-chart-tooltip").innerText(),
      /2026-/,
    );
    assert.match(
      await root.locator(".premium-chart-tooltip").innerText(),
      /P&L/,
    );
    const range = await p.evaluate(() => ({
      ...terminalCharts.get("performance").state,
    }));
    await root
      .getByRole("button", { name: "Ampliar gráfico", exact: true })
      .click();
    const dialog = p.locator("#premium-chart-dialog");
    assert.equal(await dialog.evaluate((d) => d.open), true);
    assert.equal(await p.locator("#chart-readout").count(), 1);
    await dialog.locator("svg").hover();
    await p.mouse.wheel(0, -120);
    await p.waitForFunction(
      () =>
        terminalCharts.get("expanded-performance").state.end -
          terminalCharts.get("expanded-performance").state.start <
        terminalCharts.get("performance").state.end -
          terminalCharts.get("performance").state.start,
    );
    assert.deepEqual(
      await p.evaluate(() => terminalCharts.get("performance").state),
      range,
    );
    await p.setViewportSize({ width: 390, height: 1000 });
    await p.waitForTimeout(180);
    assert.equal(await dialog.evaluate((d) => d.open), true);
    await dialog
      .getByRole("button", { name: "Restaurar gráfico", exact: true })
      .click();
    assert.equal(await dialog.locator(".chart-point").count(), 60);
    await p.keyboard.press("Escape");
    assert.equal(await dialog.evaluate((d) => d.open), false);
    await p.setViewportSize({ width: 1440, height: 1100 });
    await p.waitForTimeout(180);
    await p.locator(".primary-metrics .k").first().press("Enter");
    const metric = p.locator("#premium-metric-dialog");
    assert.equal(await metric.evaluate((d) => d.open), true);
    assert.equal(await metric.locator("tbody tr").count(), 60);
    await metric.getByRole("button", { name: "Fechar detalhes" }).click();
    await p
      .getByRole("button", { name: "Ocultar valores", exact: true })
      .click();
    await p.locator(".primary-metrics .k").first().press("Space");
    assert.match(await metric.innerText(), /••••/);
    assert.ok(!(await metric.innerText()).includes("£"));
    await metric.getByRole("button", { name: "Fechar detalhes" }).click();
    assert.equal(await p.evaluate(() => JSON.stringify(st(ft()))), stats);
    assert.equal(await p.evaluate(() => JSON.stringify(S)), snapshot);
    console.log(
      "PASS Ctrl-wheel zoom, normal scrolling, continuous drag, exact tooltips, expanded view, resize, Escape, metric details and monetary privacy without changing calculations or records",
    );
    await p.evaluate(() => taGo("cal"));
    await p.locator(".cd.gb2").first().hover();
    assert.equal(await p.locator("#premium-context-tooltip").isVisible(), true);
    await p.locator(".cd.gb2").first().click();
    assert.equal(await p.locator(".cd.premium-selected").count(), 1);
    await p
      .getByRole("button", { name: "Fechar detalhes do dia", exact: true })
      .click();
    await p.evaluate(() => taGo("share"));
    await p.locator(".share-live-day:not(:disabled)").first().hover();
    const text = await p.locator("#premium-context-tooltip").innerText();
    assert.ok(!text.includes("£"));
    assert.ok(!text.includes("GBP"));
    assert.match(text, /R|trade/);
    await p.emulateMedia({ reducedMotion: "reduce" });
    await p.evaluate(() => taGo("dash"));
    assert.equal(
      await p
        .locator(".premium-magnetic")
        .first()
        .evaluate((e) => getComputedStyle(e).transform),
      "none",
    );
    assert.equal(
      await p
        .locator(".premium-lit-card")
        .first()
        .evaluate((e) => getComputedStyle(e, "::before").display),
      "none",
    );
    await p
      .locator('[data-terminal-chart="performance"]')
      .getByRole("button", { name: "Restaurar gráfico", exact: true })
      .click();
    assert.equal(
      await p.locator(".terminal-performance .chart-point").count(),
      60,
    );
    await p.waitForTimeout(80);
    assert.equal(await p.evaluate(() => premiumFrame), 0);
    assert.equal(await p.evaluate(() => JSON.stringify(S)), snapshot);
    assert.deepEqual(errors, []);
    console.log(
      "PASS calendar preview/selection, share-calendar privacy, reduced-motion behavior and no continuous pointer animation loop",
    );
  } finally {
    await b.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
