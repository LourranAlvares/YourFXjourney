const assert = require("node:assert/strict"),
  { chromium } = require("playwright"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
  try {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    const base = "http://127.0.0.1:" + app.server.address().port;
    await p.goto(base);
    await p.waitForSelector("#first-use-tour");
    assert.equal(await p.evaluate(() => S.onboarding), undefined);
    await p
      .getByRole("button", { name: "Começar passo a passo", exact: true })
      .click();
    assert.equal(await p.evaluate(() => S.onboarding.step), 0);
    await p
      .getByRole("button", { name: "Abrir meu perfil", exact: true })
      .click();
    assert.equal(await p.evaluate(() => tab), "settings");
    await p
      .getByRole("button", {
        name: "Continuar tutorial · passo 1",
        exact: true,
      })
      .click();
    await p
      .locator("#first-use-tour")
      .getByRole("button", { name: "Próximo", exact: true })
      .click();
    assert.equal(await p.evaluate(() => S.onboarding.step), 1);
    await p.reload();
    await p.waitForSelector("#first-use-tour");
    assert.match(
      await p.locator("#first-use-tour h2").innerText(),
      /capital inicial/,
    );
    await p
      .locator("#first-use-tour")
      .getByRole("button", { name: "Configurar capital", exact: true })
      .click();
    assert(await p.locator("#account-initial-form").isVisible());
    await p
      .locator("#growth-dialog")
      .getByRole("button", { name: "Fechar", exact: true })
      .click();
    await p
      .getByRole("button", {
        name: "Continuar tutorial · passo 2",
        exact: true,
      })
      .click();
    await p
      .locator("#first-use-tour")
      .getByRole("button", { name: "Voltar", exact: true })
      .click();
    assert.equal(await p.evaluate(() => S.onboarding.step), 0);
    for (const width of [320, 390, 768, 1440]) {
      await p.setViewportSize({ width, height: 900 });
      await p.waitForFunction(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
        null,
        { timeout: 3000 },
      );
      const box = await p.locator("#first-use-tour").boundingBox();
      assert(box.x >= 0 && box.x + box.width <= width + 1);
    }
    await p
      .getByRole("button", { name: "Pular e descobrir sozinho", exact: true })
      .click();
    assert.equal(await p.locator("#first-use-tour").count(), 0);
    await p.reload();
    await p.waitForSelector(".smc-home");
    assert.equal(await p.locator("#first-use-tour").count(), 0);
    await p.evaluate(() => taGo("settings"));
    await p
      .getByRole("button", { name: "Rever tutorial", exact: true })
      .click();
    assert(await p.locator("#first-use-tour").isVisible());
    for (let i = 0; i < 6; i++)
      await p
        .locator("#first-use-tour")
        .getByRole("button", { name: "Próximo", exact: true })
        .click();
    await p
      .getByRole("button", { name: "Concluir tutorial", exact: true })
      .click();
    assert.equal(await p.evaluate(() => S.onboarding.status), "completed");
    assert.equal(await p.evaluate(() => S.trades.length), 0);
    await p.evaluate(() => {
      window.savedOwner = K;
      window.savedState = S;
      K = "onboarding-other-user";
      S = { trades: [], strats: [], reviews: {} };
      R();
    });
    assert(await p.locator("#first-use-tour").isVisible());
    await p
      .getByRole("button", { name: "Pular e descobrir sozinho", exact: true })
      .click();
    await p.evaluate(() => {
      K = window.savedOwner;
      S = window.savedState;
      R();
    });
    assert.equal(await p.locator("#first-use-tour").count(), 0);
    assert.equal(await p.evaluate(() => S.onboarding.status), "completed");
    await p.evaluate(() => {
      delete S.onboarding;
      S.assistantProfile = { name: "Teste", timezone: "UTC" };
      S.currency = "USD";
      S.balanceConfirmed = true;
      R();
    });
    assert.equal(await p.locator("#first-use-tour").count(), 0);
    await p.evaluate(() => {
      S.assistantProfile = {};
      S.balanceConfirmed = false;
      R();
      window.originalPersist = persistState;
      persistState = () => {
        throw Error("quota");
      };
    });
    await p
      .getByRole("button", { name: "Pular e descobrir sozinho", exact: true })
      .click();
    assert.equal(await p.evaluate(() => S.onboarding), undefined);
    assert.match(
      await p.locator(".tour-error").innerText(),
      /Não foi possível salvar/,
    );
    await p.evaluate(() => (persistState = window.originalPersist));
    assert.deepEqual(errors, []);
    console.log(
      "PASS first use, real configuration actions, progress/reload, skip/completion/replay, scoped users, existing account, quota failure and 320–1440 widths",
    );
  } finally {
    await b.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
