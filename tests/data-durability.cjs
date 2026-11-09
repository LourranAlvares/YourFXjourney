const assert = require("node:assert/strict"),
  net = require("node:net"),
  { chromium } = require("playwright"),
  { createApp } = require("../server/index.cjs"),
  { fixture } = require("../server/tests/helpers/cloud-fixture.cjs");
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium" }),
    local = createApp({ env: {} });
  await new Promise((r) => local.server.listen(0, "127.0.0.1", r));
  let cloud;
  try {
    const p = await b.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    const localURL = "http://127.0.0.1:" + local.server.address().port;
    await p.goto(localURL);
    await p.waitForSelector(".smc-home");
    await p.evaluate(() => taGo("plan"));
    await p.locator("#tp-name").fill("Meu plano persistente");
    await p.locator("#tp-management").fill("Gerenciamento que não pode sumir");
    await p.getByRole("button", { name: "Salvar plano", exact: true }).click();
    assert.match(
      await p.locator("#plan-save-notice").innerText(),
      /Rascunho salvo/,
    );
    assert.equal(await p.evaluate(() => taPlans().length), 0);
    await p.reload();
    await p.waitForSelector(".smc-home");
    await p.evaluate(() => taGo("plan"));
    assert.equal(
      await p.locator("#tp-management").inputValue(),
      "Gerenciamento que não pode sumir",
    );
    await p.locator("[data-cfield=label]").fill("Confirmação");
    await p.locator("[data-cfield=definition]").fill("Exigir fechamento");
    await p.getByRole("button", { name: "Salvar plano", exact: true }).click();
    assert.equal(await p.evaluate(() => taPlans().length), 1);
    assert.equal(await p.evaluate(() => S.tradingPlanDraft), null);
    await p.locator("#tp-notes").fill("Edição ainda não ativada");
    await p.evaluate(() => R());
    assert.equal(
      await p.locator("#tp-notes").inputValue(),
      "Edição ainda não ativada",
    );
    await p.reload();
    await p.waitForSelector(".smc-home");
    await p.evaluate(() => taGo("plan"));
    assert.equal(
      await p.locator("#tp-notes").inputValue(),
      "Edição ainda não ativada",
    );
    assert.equal(await p.evaluate(() => taCurrentPlan().notes), "");
    await p.evaluate(() => {
      taGo("trades");
      F.sym = "OTHER";
      diaryMonth = "2020-01";
      edit(null);
    });
    await p.locator("#f_symbol").fill("EURUSD");
    await p.locator("#f_close").fill("2026-10-01T10:00");
    await p.locator("#f_pnl").fill("12");
    await p
      .locator("#dlg")
      .getByRole("button", { name: "Salvar", exact: true })
      .click();
    assert.equal(await p.evaluate(() => diaryMonth), "2026-10");
    assert.equal(await p.evaluate(() => F.sym), "");
    const tradeId = await p.evaluate(() => S.trades[0].id);
    await p.reload();
    await p.waitForSelector(".smc-home");
    assert.equal(await p.evaluate(() => S.trades[0].id), tradeId);
    const reserve = net.createServer();
    await new Promise((r) => reserve.listen(0, "127.0.0.1", r));
    const port = reserve.address().port;
    await new Promise((r) => reserve.close(r));
    const origin = "http://127.0.0.1:" + port,
      f = fixture();
    cloud = createApp({ env: f.env(origin), fetchFn: f.fetchFn });
    await new Promise((r) => cloud.server.listen(port, "127.0.0.1", r));
    const context = await b.newContext(),
      a = await context.newPage();
    a.on("pageerror", (e) => errors.push(e.message));
    await a.goto(origin + "/account");
    await a.locator("#account-email").fill(f.a.email);
    await a.locator("#account-password").fill("Example-test-password-123");
    await a.locator("#account-submit").click();
    await a.waitForFunction(
      () => typeof eliteCloud !== "undefined" && eliteCloud.ready,
    );
    await a.route("**/api/workspace", (r) =>
      r.request().method() === "PUT" ? r.abort() : r.continue(),
    );
    await a.evaluate(() => {
      taGo("trades");
      edit(null);
    });
    await a.locator("#f_notes").fill("Registro manual offline");
    await a
      .locator("#dlg")
      .getByRole("button", { name: "Salvar", exact: true })
      .click();
    assert.equal(await a.evaluate(() => S.tradeDrafts.length), 1);
    await a.reload();
    await a.waitForFunction(
      () => typeof eliteCloud !== "undefined" && eliteCloud.ready,
    );
    assert.equal(
      await a.evaluate(() => S.tradeDrafts[0].notes),
      "Registro manual offline",
    );
    await a.unroute("**/api/workspace");
    await a.evaluate(() => eliteCloudFlush());
    await a.waitForFunction(() => !eliteCloud.pending);
    assert.equal(
      f.workspaces.get(f.a.id).data.tradeDrafts[0].notes,
      "Registro manual offline",
    );
    await a.evaluate(() => {
      taGo("trades");
      edit(null);
      window.originalSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function () {
        throw Error("quota");
      };
    });
    await a.locator("#f_notes").fill("Não pode confirmar se não salvou");
    await a
      .locator("#dlg")
      .getByRole("button", { name: "Salvar", exact: true })
      .click();
    assert(await a.locator("#dlg").isVisible());
    assert.equal(await a.evaluate(() => S.tradeDrafts.length), 1);
    assert.match(
      await a.locator("#diary-save-status").innerText(),
      /Não foi possível salvar/,
    );
    await a.evaluate(() => {
      Storage.prototype.setItem = window.originalSet;
      document.getElementById("dlg").close();
    });
    let releaseAck = null,
      held = false;
    await a.route("**/api/workspace", async (r) => {
      if (r.request().method() !== "PUT" || held) return r.continue();
      held = true;
      const response = await r.fetch();
      await new Promise((resolve) => {
        releaseAck = resolve;
        setTimeout(resolve, 5000);
      });
      await r.fulfill({ response });
    });
    await a.evaluate(() => {
      taPersist({ durabilityProbe: "first" });
      window.heldFlight = eliteCloudFlush();
    });
    for (let i = 0; i < 100 && !releaseAck; i++)
      await new Promise((r) => setTimeout(r, 50));
    assert(releaseAck);
    await a.evaluate(() => taPersist({ durabilityProbe: "second" }));
    releaseAck();
    await a.evaluate(() => window.heldFlight);
    assert.equal(
      await a.evaluate(
        () => JSON.parse(localStorage.getItem(K)).data.durabilityProbe,
      ),
      "second",
    );
    assert.equal(await a.evaluate(() => !!eliteCloud.pending), true);
    await a.unroute("**/api/workspace");
    await a.evaluate(() => eliteCloudFlush());
    await a.waitForFunction(() => !eliteCloud.pending);
    assert.equal(f.workspaces.get(f.a.id).data.durabilityProbe, "second");
    const second = await context.newPage();
    await second.goto(origin);
    await second.waitForFunction(
      () => typeof eliteCloud !== "undefined" && eliteCloud.ready,
    );
    await a.route("**/api/workspace", (r) =>
      r.request().method() === "PUT" ? r.abort() : r.continue(),
    );
    await a.evaluate(() => {
      persistState({
        ...S,
        tradeDrafts: [
          ...S.tradeDrafts,
          { id: "pending-tab-a", notes: "Não sobrescrever" },
        ],
      });
      S = JSON.parse(localStorage.getItem(K)).data;
    });
    const cached = await a.evaluate(() => localStorage.getItem(K));
    const blocked = await second.evaluate(() => {
      try {
        persistState({ ...S, trades: [{ id: "stale-tab-b" }] });
        return false;
      } catch (e) {
        return true;
      }
    });
    assert(blocked);
    assert.equal(await a.evaluate(() => localStorage.getItem(K)), cached);
    assert.deepEqual(errors, []);
    console.log(
      "PASS durable plan drafts/activation/re-render/reload, manual trades visible after save, offline cloud reload/retry, quota keeps editor and cross-tab cache cannot overwrite pending records",
    );
  } finally {
    await b.close();
    await new Promise((r) => local.server.close(r));
    if (cloud) await new Promise((r) => cloud.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
