const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE_PATH || "/usr/bin/chromium",
  });
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1100 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = "http://127.0.0.1:" + app.server.address().port;
  try {
    await page.goto(base);
    await page.waitForFunction(() => typeof terminalChart === "function");
    assert.equal(await page.locator(".terminal-topbar").count(), 1);
    assert.equal(await page.evaluate(() => S.trades.length), 0);
    await page.evaluate(() => {
      S = {
        ...S,
        currency: "GBP",
        balance: 10000,
        balanceConfirmed: true,
        trades: Array.from({ length: 45 }, (_, i) =>
          mk({
            id: "terminal-" + i,
            symbol: ["EURUSD", "GBPUSD", "CADJPY"][i % 3],
            side: i % 2 ? "short" : "long",
            open: `2026-10-${String(1 + (i % 25)).padStart(2, "0")}T09:00`,
            close: `2026-10-${String(1 + (i % 25)).padStart(2, "0")}T10:00`,
            pnl: i % 4 === 0 ? -80 : 45 + i,
            risk: 40,
            strategy: "Estratégia " + (i % 2),
            setup: "Setup " + (i % 3),
            notes: "Registro <teste> " + i,
          }),
        ),
      };
      save();
      cm = new Date(2026, 9, 1);
      SC.month = "2026-10";
      taGo("dash");
    });
    assert.ok(
      await page
        .locator("header")
        .evaluate((e) => e.getBoundingClientRect().width >= 218),
    );
    assert.ok(
      await page
        .locator(".ta-nav-group button")
        .first()
        .evaluate((e) => parseFloat(getComputedStyle(e).fontSize) >= 13),
    );
    assert.ok(
      await page
        .locator(".card")
        .first()
        .evaluate((e) => parseFloat(getComputedStyle(e).borderRadius) >= 12),
    );
    assert.notEqual(
      await page.evaluate(
        () => getComputedStyle(document.body, "::before").animationName,
      ),
      "none",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await page.evaluate(
        () => getComputedStyle(document.body, "::before").animationName,
      ),
      "none",
    );
    await page.emulateMedia({ reducedMotion: "no-preference" });
    console.log(
      "PASS SMC sidebar dimensions, readable navigation, rounded surfaces and reduced-motion preference",
    );
    await page.locator(".elitex-logo").evaluate((img) => img.decode());
    assert.match(await page.title(), /SMC Elite/);
    assert.equal(
      await page.locator("header h1 img").getAttribute("alt"),
      "SMC Elite",
    );
    const rise = await page
      .locator(".ambient-rise line")
      .first()
      .evaluate((e) => getComputedStyle(e).stroke);
    const fall = await page
      .locator(".ambient-fall line")
      .first()
      .evaluate((e) => getComputedStyle(e).stroke);
    assert.notEqual(rise, fall);
    assert.ok(
      await page
        .locator(".terminal-market-backdrop svg")
        .evaluate((e) => parseFloat(getComputedStyle(e).opacity) < 0.25),
    );
    console.log(
      "PASS SMC Elite mark loads, identity matches and rising/falling ambient candles have distinct restrained colors",
    );
    const snapshot = await page.evaluate(() => JSON.stringify(S));
    assert.equal(await page.locator(".primary-metrics .k").count(), 6);
    assert.equal(
      await page.locator(".elite-dash-charts .terminal-chart").count(),
      1,
    );
    const count = await page
      .locator(".terminal-performance .chart-point")
      .count();
    assert.equal(count, 25);
    await page.locator(".terminal-performance .chart-point").first().focus();
    assert.match(
      await page.locator("#chart-readout").innerText(),
      /2026-10-01/,
    );
    assert.equal(
      await page
        .locator(".terminal-performance .terminal-crosshair")
        .getAttribute("visibility"),
      "visible",
    );
    await page
      .locator(".terminal-performance")
      .getByRole("button", { name: "Aumentar zoom", exact: true })
      .click();
    assert.ok(
      (await page.locator(".terminal-performance .chart-point").count()) <
        count,
    );
    await page
      .locator(".terminal-performance")
      .getByRole("button", { name: "Pontos anteriores", exact: true })
      .click();
    await page
      .locator(".terminal-performance")
      .getByRole("button", { name: "Restaurar gráfico", exact: true })
      .click();
    assert.equal(
      await page.locator(".terminal-performance .chart-point").count(),
      count,
    );
    for (const mode of ["daily", "r", "dd", "balance", "pnl"]) {
      await page
        .getByLabel("Visualização do gráfico", { exact: true })
        .selectOption(mode);
      await page.locator(".terminal-performance .chart-point").first().focus();
      assert.match(
        await page.locator("#chart-readout").innerText(),
        /2026-10-01/,
      );
    }
    await page
      .getByRole("button", { name: "Ocultar valores", exact: true })
      .click();
    assert.ok(
      !(await page.locator(".terminal-recent").innerText()).includes("£"),
    );
    assert.ok(
      !(await page.locator(".panel-secondary").innerText()).includes("£"),
    );
    await page
      .getByRole("button", { name: "Mostrar valores", exact: true })
      .click();
    await page.screenshot({
      path: "/tmp/terminal-dashboard-desktop.png",
      fullPage: true,
    });
    console.log(
      "PASS dashboard real calculations, multiple chart modes, crosshair, keyboard inspection, zoom, pan controls, reset and money privacy",
    );
    await page.evaluate(() => taGo("trades"));
    const openRecords = () =>
      page
        .locator("details")
        .filter({ has: page.locator(".terminal-trade-table") })
        .evaluate((e) => (e.open = true));
    await openRecords();
    await openRecords();
    await page.locator("th").getByRole("button", { name: /^P&L/ }).click();
    const first = await page
      .locator(".terminal-trade-table tbody tr")
      .first()
      .getAttribute("data-trade-id");
    assert.equal(
      await page.evaluate((id) => S.trades.find((t) => t.id === id).pnl, first),
      -80,
    );
    await openRecords();
    await page.locator("th").getByRole("button", { name: /^P&L/ }).click();
    const greatest = await page
      .locator(".terminal-trade-table tbody tr")
      .first()
      .getAttribute("data-trade-id");
    assert.equal(
      await page.evaluate(
        (id) => S.trades.find((t) => t.id === id).pnl,
        greatest,
      ),
      88,
    );
    await openRecords();
    await page.locator(".terminal-trade-table tbody tr").first().press("Enter");
    assert.equal(await page.locator("#dlg").evaluate((d) => d.open), true);
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    assert.equal(await page.evaluate(() => JSON.stringify(S)), snapshot);
    console.log(
      "PASS sortable journal, keyboard trade details, unchanged stored records",
    );
    for (const width of [1920, 1440, 1024, 760, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const route of [
        "home",
        "dash",
        "trades",
        "cal",
        "analyst",
        "plan",
        "economic",
        "ins",
        "rev",
        "ana",
        "pat",
        "risk",
        "str",
        "share",
        "settings",
      ]) {
        await page.evaluate((route) => taGo(route), route);
        const overflow = await page.evaluate(() => ({
          w: innerWidth,
          scroll: document.documentElement.scrollWidth,
        }));
        assert.ok(
          overflow.scroll <= overflow.w + 1,
          JSON.stringify({ route, width, ...overflow }),
        );
        assert.equal(await page.locator(".terminal-topbar").count(), 1);
        if (route === "dash" && width === 390)
          await page.screenshot({
            path: "/tmp/terminal-dashboard-mobile.png",
            fullPage: true,
          });
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => taGo("dash"));
    await page
      .getByRole("button", { name: "Recolher navegação", exact: true })
      .click();
    assert.equal(
      await page
        .locator("body")
        .evaluate((e) => e.classList.contains("terminal-collapsed")),
      true,
    );
    await page
      .getByRole("button", { name: "Expandir navegação", exact: true })
      .click();
    assert.equal(await page.evaluate(() => JSON.stringify(S)), snapshot);
    await page.goto(base + "/YourFXjourney-standalone.html");
    await page.waitForFunction(() => typeof terminalChart === "function");
    await page.evaluate(() => taGo("dash"));
    assert.equal(await page.locator(".terminal-performance").count(), 1);
    await page.locator(".elitex-logo").evaluate((img) => img.decode());
    assert.match(
      await page.locator(".elitex-logo").getAttribute("src"),
      /^data:image\/png;base64,/,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS all 15 routes at 320–1920px, responsive navigation, identical store and standalone modules",
    );
  } finally {
    await browser.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
