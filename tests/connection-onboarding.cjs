const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  path = require("node:path");
const { createApp } = require("../server/index.cjs");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
  });
  let app;
  try {
    const page = await browser.newPage({
        viewport: { width: 375, height: 900 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      "file://" + path.resolve(__dirname, "../YourFXjourney-standalone.html"),
    );
    await page.waitForFunction(() => taConnection.errorCode === "file_mode");
    await page.evaluate(() => taGo("settings"));
    assert.match(
      await page.locator("#ta-connection-help").innerText(),
      /INICIAR-TRADE-ASSISTANT.bat/,
    );
    assert.match(
      await page.locator("#ta-connection-help").innerText(),
      /CONFIGURAR-TRADE-ASSISTANT.bat/,
    );
    assert.match(await page.locator("main").innerText(), /Arquivo HTML local/);
    assert.equal(await page.locator("#ta-password").count(), 0);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    const stored = await page.evaluate(() => JSON.stringify(S));
    await page
      .getByRole("button", { name: "Verificar conexão novamente" })
      .click();
    await page.waitForFunction(() => taConnection.errorCode === "file_mode");
    assert.equal(await page.evaluate(() => JSON.stringify(S)), stored);
    console.log(
      "PASS standalone explains Windows activation, retry preserves all records and mobile fits",
    );
    app = createApp({ env: {} });
    await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
    const url = "http://127.0.0.1:" + app.server.address().port;
    await page.goto(url);
    await page.waitForFunction(
      () => taConnection.errorCode === "auth_unconfigured",
    );
    await page.evaluate(() => taGo("settings"));
    assert.equal(await page.locator("#ta-password").count(), 0);
    assert.match(
      await page.locator("main").innerText(),
      /Servidor sem configuração/,
    );
    await page.route("**/api/status", (route) =>
      route.fulfill({ json: { unrelated: true } }),
    );
    await page
      .getByRole("button", { name: "Verificar conexão novamente" })
      .click();
    await page.waitForFunction(
      () => taConnection.errorCode === "backend_unavailable",
    );
    assert.match(
      await page.locator("main").innerText(),
      /Servidor indisponível/,
    );
    await page.unroute("**/api/status");
    await page
      .getByRole("button", { name: "Verificar conexão novamente" })
      .click();
    await page.waitForFunction(
      () => taConnection.errorCode === "auth_unconfigured",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS missing password avoids login dead end; malformed status unavailable; retry recovers without browser errors",
    );
  } finally {
    await browser.close();
    if (app) await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
