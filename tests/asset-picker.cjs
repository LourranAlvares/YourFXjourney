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
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 2,
      }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    const base = "http://127.0.0.1:" + app.server.address().port;
    await p.goto(base);
    await p.waitForSelector(".ta-ready-card");
    assert.equal(await p.locator(".ta-ready-step").count(), 3);
    assert.match(
      await p.locator(".ta-ready-card").innerText(),
      /Restaurar backup/,
    );
    await p.evaluate(() => {
      S.assistantProfile = {
        ...taProfile(),
        name: "Teste",
        instruments: ["EUR/USD", "GBPUSD"],
        session: { ...taProfile().session, enabled: true },
      };
      S.trades = [
        mk({
          id: "old",
          symbol: "EURUSD",
          close: "2026-01-01T12:00",
          pnl: 20,
          risk: 10,
          notes: "Manter histórico",
        }),
      ];
      save();
      R();
    });
    const snapshot = await p.evaluate(() => JSON.stringify(S.trades));
    await p.getByRole("button", { name: "Editar ativos", exact: true }).click();
    const dialog = p.locator("#ta-assets-dialog");
    assert.equal(
      await dialog
        .getByRole("button", { name: "Remover EURUSD", exact: true })
        .count(),
      2,
    );
    await dialog
      .getByRole("button", { name: "Selecionar XAUUSD", exact: true })
      .click();
    await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
    assert.deepEqual(await p.evaluate(() => taProfile().instruments), [
      "EUR/USD",
      "GBPUSD",
    ]);
    await p.getByRole("button", { name: "Editar ativos", exact: true }).click();
    await dialog.locator("[data-asset-search]").fill("ouro");
    assert.equal(await dialog.locator(".ta-asset-option").count(), 1);
    await dialog
      .getByRole("button", { name: "Selecionar XAUUSD", exact: true })
      .click();
    await dialog.locator("[data-asset-search]").fill("");
    await dialog
      .getByRole("button", { name: "Selecionar CADJPY", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Selecionar BTCUSD", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Selecionar USDJPY", exact: true })
      .click();
    assert.match(
      await dialog.locator(".ta-asset-feedback").innerText(),
      /já selecionou 5/,
    );
    assert.equal(await dialog.locator("[data-asset-count]").innerText(), "5/5");
    await dialog
      .getByRole("button", { name: "Salvar ativos", exact: true })
      .click();
    assert.deepEqual(await p.evaluate(() => taProfile().instruments), [
      "EURUSD",
      "GBPUSD",
      "XAUUSD",
      "CADJPY",
      "BTCUSD",
    ]);
    assert.equal(await p.evaluate(() => JSON.stringify(S.trades)), snapshot);
    await p.reload();
    assert.deepEqual(await p.evaluate(() => taProfile().instruments), [
      "EURUSD",
      "GBPUSD",
      "XAUUSD",
      "CADJPY",
      "BTCUSD",
    ]);
    await p.evaluate(() => taGo("settings"));
    assert.equal(await p.locator(".ta-asset-picker").count(), 1);
    await p
      .locator(".ta-asset-selected")
      .getByRole("button", { name: "Remover BTCUSD", exact: true })
      .click();
    await p.getByRole("button", { name: "Cripto", exact: true }).click();
    assert.equal(await p.locator(".ta-asset-option").count(), 3);
    await p
      .getByRole("button", { name: "Selecionar ETHUSD", exact: true })
      .press("Enter");
    await p.getByRole("button", { name: "Salvar rotina", exact: true }).click();
    assert.ok(
      (await p.evaluate(() => taProfile().instruments)).includes("ETHUSD"),
    );
    await p.getByRole("button", { name: "Editar ativos", exact: true }).click();
    await dialog
      .locator(".ta-asset-selected")
      .getByRole("button", { name: "Remover ETHUSD", exact: true })
      .click();
    await dialog.locator("summary").click();
    await dialog
      .getByRole("textbox", { name: "Símbolo personalizado", exact: true })
      .fill("us500");
    await dialog
      .getByRole("button", { name: "Adicionar", exact: true })
      .click();
    assert.match(
      await dialog.locator(".ta-asset-selected").innerText(),
      /US500/,
    );
    await dialog
      .getByRole("button", { name: "Salvar ativos", exact: true })
      .click();
    assert.ok(
      (await p.evaluate(() => taProfile().instruments)).includes("US500"),
    );
    await p.evaluate(() => window.scrollTo(0, 0));
    const image = await p.screenshot({
      path: "/tmp/elitex-home-4k.png",
      fullPage: false,
    });
    assert.equal(image.readUInt32BE(16), 3840);
    assert.equal(image.readUInt32BE(20), 2160);
    for (const width of [1920, 1440, 1024, 760, 390, 320]) {
      await p.setViewportSize({ width, height: 1000 });
      await p.evaluate(() => taGo("home"));
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "home overflow " + width,
      );
      await p
        .getByRole("button", { name: "Editar ativos", exact: true })
        .click();
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "dialog overflow " + width,
      );
      await p.keyboard.press("Escape");
      await p.evaluate(() => taGo("settings"));
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "settings overflow " + width,
      );
    }
    assert.equal(await p.evaluate(() => JSON.stringify(S.trades)), snapshot);
    assert.deepEqual(errors, []);
    console.log(
      "PASS searchable catalog, canonical symbols, preserved legacy selection, cancel, 5-asset cap, keyboard selection, settings and Home save, persistence, custom symbols, unchanged history, readiness controls, 4K rendering and responsive 320–1920px",
    );
  } finally {
    await browser.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
