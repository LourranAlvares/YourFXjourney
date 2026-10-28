const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const b = await chromium.launch({
      executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
    }),
    p = await b.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:" + app.server.address().port);
  await p.evaluate(() => taGo("dash"));
  await p.evaluate(() => {
    S = {
      trades: [
        mk({ close: "2026-10-01T10:00", pnl: 420, risk: 140 }),
        mk({ close: "2026-10-01T11:00", pnl: -60, risk: 30 }),
        mk({ close: "2026-10-02T11:00", pnl: -100, risk: 50 }),
      ],
      reviews: {},
      strats: [],
      balance: 10345,
      balanceConfirmed: true,
      currency: "GBP",
    };
    cm = new Date(2026, 9, 1);
    SC.month = "2026-10";
    save();
    R();
  });
  assert.match(await p.locator(".primary-metrics").innerText(), /260/);
  await p.getByRole("button", { name: "Ocultar valores", exact: true }).click();
  assert.match(await p.locator(".primary-metrics").innerText(), /••••/);
  assert.equal(await p.locator("#account-baseline").count(), 0);
  for (const sel of [
    ".primary-metrics",
    ".secondary-metrics",
    ".cal",
    ".chart-svg",
    "#chart-readout",
    ".terminal-context",
    ".terminal-recent",
    ".terminal-bars",
  ]) {
    const text = (await p.locator(sel).allTextContents()).join(" ");
    assert.ok(!text.includes("260,00"), sel);
    assert.ok(!text.includes("10 605"), sel);
  }
  await p.locator(".chart-point").first().focus();
  assert.match(await p.locator("#chart-readout").innerText(), /••••/);
  assert.ok(
    !(
      await p.locator(".chart-point").first().getAttribute("aria-label")
    ).includes("360,00"),
  );
  assert.equal(await p.evaluate(() => S.trades[0].pnl), 420);
  await p.reload();
  await p.evaluate(() => taGo("dash"));
  assert.equal(
    await p
      .getByRole("button", { name: "Mostrar valores", exact: true })
      .count(),
    1,
  );
  await p.getByRole("button", { name: "Mostrar valores", exact: true }).click();
  assert.match(await p.locator(".primary-metrics").innerText(), /260/);
  await p.evaluate(() => {
    tab = "share";
    R();
  });
  assert.match(
    await p.locator(".share-live-day.positive b").innerText(),
    /\+1.00R/,
  );
  assert.match(
    await p.locator(".share-live-day.negative b").innerText(),
    /-2.00R/,
  );
  assert.ok((await p.locator(".share-live-grid").boundingBox()).width > 680);
  assert.ok(
    (await p.locator(".share-live-day").first().boundingBox()).height >= 140,
  );
  await p.locator(".share-live-day.positive").click();
  assert.match(await p.locator("#sharedlg").innerText(), /\+3.00R/);
  assert.match(await p.locator("#sharedlg").innerText(), /-2.00R/);
  assert.ok(!(await p.locator("#sharedlg").innerText()).includes("420"));
  await p.getByRole("button", { name: "Fechar ×", exact: true }).click();
  await p.screenshot({ path: "/tmp/yfx-larger-calendar.png", fullPage: true });
  for (const width of [390, 320]) {
    await p.setViewportSize({ width, height: 1000 });
    await p.waitForTimeout(160);
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS money visibility, persistence, tooltips, unchanged data, larger R calendar, per-trade signed R and mobile layout",
  );
  await b.close();
  app.server.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
