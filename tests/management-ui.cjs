"use strict";
const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  net = require("node:net"),
  { createApp } = require("../server/index.cjs"),
  {
    managementFixture,
  } = require("../server/tests/helpers/management-fixture.cjs");
(async () => {
  const reservation = net.createServer();
  await new Promise((r) => reservation.listen(0, "127.0.0.1", r));
  const port = reservation.address().port;
  await new Promise((r) => reservation.close(r));
  const base = "http://127.0.0.1:" + port,
    f = managementFixture(),
    app = createApp({ env: f.env(base), fetchFn: f.fetchFn });
  await new Promise((r) => app.server.listen(port, "127.0.0.1", r));
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
  });
  try {
    const ownerContext = await browser.newContext(),
      memberContext = await browser.newContext(),
      po = await ownerContext.newPage(),
      pm = await memberContext.newPage(),
      errors = [];
    for (const p of [po, pm]) p.on("pageerror", (e) => errors.push(e.message));
    async function login(p, email) {
      await p.goto(base + "/account");
      await p.locator("#account-email").fill(email);
      await p.locator("#account-password").fill("Example-test-password-123");
      await p.locator("#account-form button[type=submit]").click();
      await p.waitForSelector(".smc-home");
    }
    f.workspaces.set(f.a.id, {
      revision: 1,
      data: {
        currency: "USD",
        trades: [
          {
            id: "t",
            symbol: "EURUSD",
            close: "2026-10-29T09:00",
            pnl: 50,
            notes: "Private diary must not be shared",
          },
        ],
        reviews: {},
        strats: [],
        balance: 1000,
        balanceConfirmed: true,
      },
    });
    await login(po, f.owner.email);
    await login(pm, f.a.email);
    await po
      .getByRole("button", { name: "Administração", exact: true })
      .click();
    await po.waitForSelector(".smc-admin-user");
    assert.equal(await po.locator(".smc-admin-user").count(), 4);
    const member = po.locator(".smc-admin-user").filter({ hasText: f.a.email });
    assert.equal(
      await po
        .getByRole("button", { name: "Ver desempenho", exact: true })
        .count(),
      0,
    );
    assert(
      !(await po
        .locator("main")
        .innerText()
        .then((t) => t.includes("Private diary"))),
    );
    await member
      .getByRole("button", { name: "Configurar acesso", exact: true })
      .click();
    const form = po.locator("#smc-access-form");
    await form.locator("[name=term]").selectOption("trial7");
    await form.locator("[name=notes]").fill("Trial combinado de 7 dias");
    await form
      .getByRole("button", { name: "Salvar acesso", exact: true })
      .click();
    await po.waitForFunction(
      () => !document.getElementById("smc-management-dialog").open,
    );
    assert.equal(f.permissions.get(f.a.id).plan, "trial");
    assert.match(
      await po.locator("#smc-admin-notice").innerText(),
      /Acesso liberado.*Trial.*Válido até/,
    );
    const pending = po
      .locator(".smc-admin-user")
      .filter({ hasText: f.pending.email });
    await pending
      .getByRole("button", { name: "Liberar acesso", exact: true })
      .click();
    assert.equal(f.profiles.get(f.pending.id).status, "pending");
    assert.equal(
      await po.locator("#smc-access-form [name=status]").inputValue(),
      "active",
    );
    assert.equal(
      await po.locator("#smc-access-form [name=term]").inputValue(),
      "",
    );
    await po.locator("#smc-access-form [name=term]").selectOption("bimonthly");
    await po.locator("#smc-access-form [name=plan]").selectOption("monthly");
    await po.locator("#smc-access-form [type=submit]").click();
    await po.waitForFunction(
      () => !document.getElementById("smc-management-dialog").open,
    );
    assert.equal(f.profiles.get(f.pending.id).status, "active");
    assert.equal(f.permissions.get(f.pending.id).plan, "monthly");
    assert.match(
      await po.locator("#smc-admin-notice").innerText(),
      /Acesso liberado.*Mensal.*Válido até/,
    );
    let expires = f.permissions.get(f.pending.id).expires_at;
    assert(
      Date.parse(expires) > Date.now() + 55 * 86400000 &&
        Date.parse(expires) < Date.now() + 63 * 86400000,
    );
    await pending
      .getByRole("button", { name: "Configurar acesso", exact: true })
      .click();
    await po.locator("#smc-access-form [name=term]").selectOption("biennial");
    await po.locator("#smc-access-form [name=plan]").selectOption("annual");
    await po.locator("#smc-access-form [type=submit]").click();
    await po.waitForFunction(
      () => !document.getElementById("smc-management-dialog").open,
    );
    expires = f.permissions.get(f.pending.id).expires_at;
    assert(Date.parse(expires) > Date.now() + 729 * 86400000);
    await pending
      .getByRole("button", { name: "Configurar acesso", exact: true })
      .click();
    await po.locator("#smc-access-form [name=plan]").selectOption("quarterly");
    await po.locator("#smc-access-form [type=submit]").click();
    await po.waitForFunction(
      () => !document.getElementById("smc-management-dialog").open,
    );
    assert.equal(f.permissions.get(f.pending.id).expires_at, expires);
    assert.equal(f.permissions.get(f.pending.id).plan, "quarterly");
    await pending
      .getByRole("button", { name: "Configurar acesso", exact: true })
      .click();
    await po.route("**/api/admin/management", (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({
            status: 503,
            json: {
              error: {
                code: "test_failure",
                message: "Não foi possível salvar o acesso.",
              },
            },
          })
        : route.continue(),
    );
    await po.locator("#smc-access-form [name=status]").selectOption("blocked");
    await po.locator("#smc-access-form [type=submit]").click();
    await po.waitForFunction(() =>
      document
        .getElementById("smc-access-message")
        .textContent.includes("Não foi possível"),
    );
    assert.equal(await po.locator("#smc-admin-notice").count(), 0);
    assert.equal(f.profiles.get(f.pending.id).status, "active");
    assert(await po.locator("#smc-access-form [type=submit]").isEnabled());
    await po.unroute("**/api/admin/management");
    await po.getByRole("button", { name: "Fechar", exact: true }).click();
    await pm.evaluate(() => taGo("settings"));
    assert.equal(
      await pm
        .getByRole("button", {
          name: /Autorizar resumo|Revogar compartilhamento/,
        })
        .count(),
      0,
    );
    assert.equal(
      (
        await memberContext.request.get(base + "/api/account/coaching")
      ).status(),
      404,
    );
    await member
      .getByRole("button", { name: "Auditoria", exact: true })
      .click();
    await po.getByText("Acesso atualizado", { exact: true }).waitFor();
    await po.getByRole("button", { name: "Fechar", exact: true }).click();
    for (const width of [320, 390, 760, 1280, 1920]) {
      await po.setViewportSize({ width, height: 900 });
      await po.evaluate(() => taGo("admin"));
      assert(
        await po.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "admin overflow " + width,
      );
      await member
        .getByRole("button", { name: "Configurar acesso", exact: true })
        .click();
      assert(
        await po
          .locator("#smc-management-dialog")
          .evaluate((d) => d.scrollWidth <= d.clientWidth + 1),
        "dialog overflow " + width,
      );
      await po.getByRole("button", { name: "Fechar", exact: true }).click();
    }
    assert.equal(
      (
        await memberContext.request.get(base + "/api/admin/management")
      ).status(),
      403,
    );
    assert.equal(
      (
        await memberContext.request.get(base + "/api/admin/registration-health")
      ).status(),
      403,
    );
    assert.equal(
      (
        await ownerContext.request.patch(base + "/api/admin/management", {
          headers: { origin: base },
          data: {
            id: f.b.id,
            status: "blocked",
            term: "unlimited",
            notes: "",
            revokeSessions: false,
          },
        })
      ).status(),
      403,
    );
    await member
      .getByRole("button", { name: "Configurar acesso", exact: true })
      .click();
    await po.locator("#smc-access-form [name=status]").selectOption("blocked");
    await po
      .locator("#smc-access-form")
      .getByRole("button", { name: "Salvar acesso", exact: true })
      .click();
    await po.waitForFunction(
      () => !document.getElementById("smc-management-dialog").open,
    );
    await pm.reload();
    await pm
      .getByRole("heading", { name: "Acesso bloqueado", exact: true })
      .waitFor();
    await po.setViewportSize({ width: 1536, height: 1024 });
    await po.screenshot({
      path: "/tmp/smc-admin-access-only.png",
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    console.log(
      "PASS admin access/trial/audit and SMTP guidance; no performance/consent UI or API; private diary preserved; role/CSRF checks and responsive screens",
    );
  } finally {
    await browser.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
