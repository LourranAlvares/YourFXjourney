const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE_PATH || "/usr/bin/chromium",
  });
  try {
    const p = await browser.newPage({
        viewport: { width: 1440, height: 1100 },
      }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    const base = "http://127.0.0.1:" + app.server.address().port;
    await p.goto(base);
    await p.waitForSelector('select[aria-label="Moeda da conta"]');
    await p.evaluate(() => {
      S = {
        ...S,
        currency: "GBP",
        balance: 10000,
        balanceConfirmed: true,
        trades: [
          mk({
            id: "gain",
            symbol: "EURUSD",
            close: "2026-10-01T10:00",
            pnl: 120,
            risk: 40,
          }),
          mk({
            id: "loss",
            symbol: "GBPUSD",
            close: "2026-10-02T10:00",
            pnl: -60,
            risk: 20,
          }),
          mk({
            id: "missing",
            symbol: "EURUSD",
            close: "2026-10-03T10:00",
            pnl: -30,
            realizedR: -1,
          }),
        ],
      };
      save();
      cm = new Date(2026, 9, 1);
      SC.month = "2026-10";
      R();
    });
    const original = await p.evaluate(() =>
        JSON.stringify({
          trades: S.trades,
          balance: S.balance,
          balanceConfirmed: S.balanceConfirmed,
        }),
      ),
      stats = await p.evaluate(() => JSON.stringify(st(ft())));
    for (const [code, symbol] of [
      ["GBP", "£"],
      ["EUR", "€"],
      ["USD", "$"],
      ["BRL", "R$"],
    ]) {
      await p
        .getByRole("combobox", { name: "Moeda da conta", exact: true })
        .selectOption(code);
      for (const route of [
        "dash",
        "trades",
        "ana",
        "pat",
        "rev",
        "str",
        "risk",
      ]) {
        await p.evaluate((t) => taGo(t), route);
        if (["dash", "trades", "risk"].includes(route))
          assert.ok(
            (await p.locator("main").innerText()).includes(symbol),
            route + " " + code,
          );
        assert.equal(
          await p
            .getByRole("combobox", { name: "Moeda da conta", exact: true })
            .inputValue(),
          code,
        );
      }
      assert.equal(await p.evaluate(() => JSON.stringify(st(ft()))), stats);
      assert.equal(
        await p.evaluate(() =>
          JSON.stringify({
            trades: S.trades,
            balance: S.balance,
            balanceConfirmed: S.balanceConfirmed,
          }),
        ),
        original,
      );
    }
    await p.reload();
    assert.equal(
      await p
        .getByRole("combobox", { name: "Moeda da conta", exact: true })
        .inputValue(),
      "BRL",
    );
    await p.evaluate(() => taGo("risk"));
    assert.equal(await p.locator(".risk-recorded-metrics .k").count(), 3);
    const text = await p.locator(".risk-recorded-metrics").innerText();
    assert.match(text, /30,00/);
    assert.match(text, /40,00/);
    assert.match(text, /90,00/);
    assert.equal(await p.locator("#account-baseline").count(), 0);
    assert.equal(
      await p.locator(".risk-calculator #risk-reference").inputValue(),
      "10030",
    );
    assert.equal(await p.locator("#risk-percent").inputValue(), "");
    assert.equal(await p.locator("#risk-result").innerText(), "—");
    await p.getByRole("button", { name: "0,5%", exact: true }).click();
    assert.match(await p.locator("#risk-result").innerText(), /50,15/);
    await p
      .getByRole("combobox", { name: "Moeda da conta", exact: true })
      .selectOption("USD");
    assert.match(await p.locator("#risk-result").innerText(), /\$/);
    assert.equal(await p.locator("#risk-percent").inputValue(), "0.5");
    assert.match(await p.locator("#risk-result").innerText(), /50,15/);
    await p.locator("#risk-reference").fill("2500");
    await p.locator("#risk-percent").fill("1");
    assert.match(await p.locator("#risk-result").innerText(), /25,00/);
    await p.locator("#risk-percent").fill("101");
    assert.equal(await p.locator("#risk-result").innerText(), "—");
    await p.locator("#risk-percent").fill("0");
    assert.match(await p.locator("#risk-result").innerText(), /0,00/);
    assert.equal(
      await p.evaluate(() =>
        JSON.stringify({
          trades: S.trades,
          balance: S.balance,
          balanceConfirmed: S.balanceConfirmed,
        }),
      ),
      original,
    );
    await p
      .getByRole("button", { name: "Limpar cálculo", exact: true })
      .click();
    assert.equal(await p.locator("#risk-percent").inputValue(), "");
    assert.equal(await p.locator("#risk-reference").inputValue(), "10030");
    await p.locator(".risk-missing summary").click();
    await p
      .getByRole("button", { name: "Informar risco", exact: true })
      .click();
    assert.equal(await p.locator("#f_risk").inputValue(), "");
    assert.match(await p.locator("#f_pnl").locator("..").innerText(), /USD/);
    await p.getByRole("button", { name: "Cancelar", exact: true }).click();
    await p.evaluate(() => taGo("dash"));
    await p
      .getByRole("button", { name: "Ocultar valores", exact: true })
      .click();
    await p
      .getByRole("combobox", { name: "Moeda da conta", exact: true })
      .selectOption("EUR");
    assert.match(await p.locator(".primary-metrics").innerText(), /••••/);
    await p.evaluate(() => taGo("share"));
    assert.ok(!(await p.locator(".share-live").innerText()).includes("€"));
    assert.ok(!(await p.locator(".share-live").innerText()).includes("$"));
    assert.ok(!(await p.locator(".share-live").innerText()).includes("£"));
    // Storage failure must restore the selector and keep the previous denomination.
    await p.evaluate(() => {
      window.__set = Storage.prototype.setItem;
      Storage.prototype.setItem = function () {
        throw Error("fixture full");
      };
    });
    p.once("dialog", (d) => d.accept());
    await p
      .getByRole("combobox", { name: "Moeda da conta", exact: true })
      .selectOption("GBP");
    assert.equal(
      await p
        .getByRole("combobox", { name: "Moeda da conta", exact: true })
        .inputValue(),
      "EUR",
    );
    await p.evaluate(() => (Storage.prototype.setItem = window.__set));
    for (const width of [1920, 1440, 1024, 760, 390, 320]) {
      await p.setViewportSize({ width, height: 1000 });
      for (const route of [
        "home",
        "risk",
        "dash",
        "trades",
        "share",
        "settings",
      ]) {
        await p.evaluate((t) => taGo(t), route);
        assert.ok(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          route + " overflow " + width,
        );
        assert.equal(
          await p
            .getByRole("combobox", { name: "Moeda da conta", exact: true })
            .count(),
          1,
        );
      }
    }
    await p.evaluate(() => {
      S.balanceConfirmed = false;
      S.trades = [];
      riskCalculator = { base: "", percent: "", manualBase: false };
      taGo("risk");
    });
    assert.equal(await p.locator("#risk-reference").inputValue(), "");
    assert.equal(await p.locator("#risk-result").innerText(), "—");
    assert.match(
      await p.locator(".risk-next-focus").innerText(),
      /mesmo sem histórico/,
    );
    await p.goto(base + "/YourFXjourney-standalone.html");
    await p.evaluate(() => taGo("risk"));
    assert.equal(await p.locator(".risk-calculator").count(), 1);
    assert.deepEqual(errors, []);
    console.log(
      "PASS global GBP/EUR/USD/BRL display, persistence and storage failure, no conversion or trade mutation, risk averages/drawdown and missing risk, optional planning calculator, edit shortcut, hidden values, R-only sharing, no fabricated balance, standalone and 320–1920px",
    );
  } finally {
    await browser.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
