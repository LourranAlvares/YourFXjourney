const assert = require("node:assert/strict"),
  { chromium } = require("playwright"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
  try {
    const p = await b.newPage({ viewport: { width: 1280, height: 1000 } }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    const base = "http://127.0.0.1:" + app.server.address().port;
    await p.goto(base);
    await p.waitForSelector(".smc-home");
    await p.evaluate(() => {
      S.currency = "USD";
      S.strats = [{ name: "Meu sistema" }];
      S.tradeDrafts = [
        {
          id: "seed",
          symbol: "EURNZD",
          strategy: "Meu sistema",
          setup: "Reteste",
          img: [],
        },
      ];
      taGo("trades");
      edit(null);
    });
    assert.deepEqual(
      await p.evaluate(() =>
        [
          "-5,20$",
          "-$5.20",
          "-5.20 USD",
          "(5,20)",
          "1.234,56",
          "1,234.56",
          "abc",
          "",
        ].map(diaryNumericValue),
      ),
      [-5.2, -5.2, -5.2, -5.2, 1234.56, 1234.56, null, null],
    );
    assert.deepEqual(
      await p.evaluate(() => [
        diaryFieldNumber("plannedRR", "3x"),
        diaryFieldNumber("size", "0,10 lotes"),
        diaryFieldNumber("leverage", "100x"),
        diaryFieldNumber("pnl", "-1R"),
      ]),
      [3, 0.1, 100, null],
    );
    await p.getByRole("button", { name: "EURNZD", exact: true }).click();
    await p.getByRole("button", { name: "Compra", exact: true }).click();
    await p.getByRole("button", { name: "Meu sistema", exact: true }).click();
    await p.getByRole("button", { name: "Reteste", exact: true }).click();
    await p.getByRole("button", { name: "Perda", exact: true }).click();
    await p.locator("#f_pnl").fill("5,20$");
    assert.equal(await p.locator("#f_pnl").inputValue(), "-5,20$");
    assert.match(
      await p.locator("#journal-result-hint").innerText(),
      /fechamento/,
    );
    await p
      .locator("#dlg")
      .getByRole("button", { name: "Salvar", exact: true })
      .click();
    assert.equal(await p.evaluate(() => S.tradeDrafts.at(-1).pnl), -5.2);
    assert.match(await p.locator(".diary-partials").innerText(), /[−-]5/);
    const id = await p.evaluate(() => S.tradeDrafts.at(-1).id);
    await p.evaluate((id) => diaryEditPartial(id), id);
    assert.equal(await p.locator("#f_pnl").inputValue(), "-5.2");
    await p
      .getByRole("button", { name: "Encerrada agora", exact: true })
      .click();
    await p
      .locator("#dlg")
      .getByRole("button", { name: "Salvar", exact: true })
      .click();
    assert.equal(await p.evaluate(() => S.trades.at(-1).pnl), -5.2);
    assert.equal(await p.evaluate(() => S.trades.at(-1).id), id);
    await p.reload();
    await p.waitForSelector(".smc-home");
    assert.equal(await p.evaluate(() => S.trades.at(-1).pnl), -5.2);
    await p.evaluate(() => {
      taGo("trades");
      edit(null);
    });
    await p.locator("#f_pnl").fill("valor inválido");
    await p
      .locator("#dlg")
      .getByRole("button", { name: "Salvar", exact: true })
      .click();
    assert(await p.locator("#dlg").isVisible());
    assert.match(
      await p.locator("#diary-save-status").innerText(),
      /Confira o valor/,
    );
    await p.evaluate(() => {
      document.getElementById("dlg").close();
      edit(null);
      taConnection.authenticated = true;
      taConnection.services.ai = true;
      const c = document.createElement("canvas");
      c.width = 200;
      c.height = 100;
      cur.img = [c.toDataURL()];
      journalQuickRefresh();
    });
    let calls = 0;
    await p.route("**/api/extract-trade", (r) => {
      calls++;
      return r.fulfill({
        json: {
          fields: {
            symbol: "EURNZD",
            entry: 1.99551,
            stop: 1.9945,
            target: 1.99855,
            side: "long",
            plannedRR: 3.0099,
            size: 0.1,
          },
          evidence: "Etiquetas da posição",
          issues: [],
        },
      });
    });
    assert.equal(calls, 0);
    await p.locator("#f_pnl").fill("-5,20");
    await p
      .getByRole("button", { name: "Preencher com IA", exact: true })
      .click();
    await p.waitForFunction(
      () => document.getElementById("f_entry").value === "1.99551",
    );
    assert.equal(await p.locator("#f_pnl").inputValue(), "-5,20");
    assert.equal(await p.evaluate(() => cur.img.length), 1);
    assert.equal(await p.locator("#f_side").inputValue(), "long");
    assert.equal(calls, 1);
    await p.screenshot({ path: "/tmp/journal-practical.png", fullPage: true });
    for (const width of [320, 390, 768, 1440]) {
      await p.setViewportSize({ width, height: 1000 });
      await p.waitForFunction(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      );
      assert(await p.locator("#f_pnl").isVisible());
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS locale/currency negative result, visible pending P&L, same-ID completion/reload, invalid-number preservation, personal quick choices, explicit AI call preserving manual data and responsive editor",
    );
  } finally {
    await b.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
