"use strict";
const { chromium } = require("playwright"),
  net = require("node:net"),
  assert = require("node:assert/strict"),
  { createApp } = require("../server/index.cjs"),
  { fixture } = require("../server/tests/helpers/cloud-fixture.cjs");
(async () => {
  const reservation = net.createServer();
  await new Promise((r) => reservation.listen(0, "127.0.0.1", r));
  const port = reservation.address().port;
  await new Promise((r) => reservation.close(r));
  const origin = "http://127.0.0.1:" + port,
    f = fixture(),
    app = createApp({ env: f.env(origin), fetchFn: f.fetchFn });
  await new Promise((r) => app.server.listen(port, "127.0.0.1", r));
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
  });
  try {
    const a = await browser.newContext(),
      p = await a.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(origin);
    await p.screenshot({ path: "/tmp/elitex-cloud-login.png", fullPage: true });
    assert(
      await p
        .getByRole("heading", { name: "Bem-vindo ao SMC Elite" })
        .isVisible(),
    );
    await p.getByRole("button", { name: "Criar conta", exact: true }).click();
    await p.getByLabel("Primeiro nome", { exact: true }).fill("Lohan");
    await p.getByLabel("Sobrenome", { exact: true }).fill("Alves");
    await p.getByLabel("E-mail", { exact: true }).fill("lohan@example.test");
    await p
      .getByLabel("Senha", { exact: true })
      .fill("Example-test-password-123");
    await p
      .getByLabel("Confirmar senha", { exact: true })
      .fill("does-not-match");
    await p.getByRole("button", { name: "Mostrar senha", exact: true }).click();
    assert.equal(
      await p.locator("#account-password").getAttribute("type"),
      "text",
    );
    await p.getByRole("button", { name: "Ocultar senha", exact: true }).click();
    assert.equal(
      await p.locator("#account-password").getAttribute("type"),
      "password",
    );
    await p
      .getByRole("button", {
        name: "Mostrar confirmação de senha",
        exact: true,
      })
      .click();
    assert.equal(
      await p.locator("#account-password-confirm").getAttribute("type"),
      "text",
    );
    for (const width of [320, 390, 760, 1536]) {
      await p.setViewportSize({ width, height: 900 });
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "signup overflow " + width,
      );
    }
    await p
      .getByRole("button", { name: "Criar minha conta", exact: true })
      .click();
    assert.match(
      await p.locator("#account-message").innerText(),
      /não coincidem/,
    );
    assert.equal(f.users.has("lohan@example.test"), false);
    await p
      .getByLabel("Confirmar senha", { exact: true })
      .fill("Example-test-password-123");
    await p
      .getByRole("button", { name: "Criar minha conta", exact: true })
      .click();
    await p.waitForFunction(() =>
      document
        .getElementById("account-message")
        .textContent.includes("Confira seu e-mail"),
    );
    assert.deepEqual(f.users.get("lohan@example.test").user_metadata, {
      name: "Lohan Alves",
      first_name: "Lohan",
      last_name: "Alves",
    });
    await p.evaluate(() =>
      localStorage.setItem(
        "yfx1",
        JSON.stringify({
          trades: [{ id: "legacy-private", pnl: 999 }],
          reviews: {},
          strats: [],
        }),
      ),
    );
    async function login(page, email) {
      await page.goto(origin + "/account");
      await page.locator("#account-email").fill(email);
      await page.locator("#account-password").fill("Example-test-password-123");
      await page.locator("#account-submit").click();
    }
    await login(p, f.a.email);
    await p.waitForSelector(".reference-home");
    await p.waitForFunction(() => eliteCloud.ready);
    assert.equal(await p.evaluate(() => S.trades.length), 0);
    assert.equal(await p.evaluate(() => K), "elitex-workspace:" + f.a.id);
    await p.evaluate(() => {
      S.trades = [
        mk({
          id: "alice-trade",
          symbol: "EURUSD",
          close: "2026-10-30T10:00",
          pnl: 123,
          risk: 50,
          notes: "private alice note",
        }),
      ];
      S.growth = {
        monitor: { enabled: false },
        checkins: [
          {
            id: "alice-emotion",
            at: "2026-10-30T10:00Z",
            emotion: "calm",
            note: "private emotional note",
          },
        ],
        reflections: {
          "week:2026-10-26": { answers: ["Personal", "Challenge", "Goal"] },
        },
      };
      save();
    });
    await p.waitForFunction(
      () => !eliteCloud.pending && eliteCloud.revision === 1,
    );
    assert.equal(
      f.workspaces.get(f.a.id).data.trades[0].notes,
      "private alice note",
    );
    assert.equal(f.workspaces.has(f.b.id), false);
    await p.reload();
    await p.waitForFunction(
      () => typeof eliteCloud !== "undefined" && eliteCloud.ready,
    );
    assert.equal(await p.evaluate(() => S.trades[0].pnl), 123);
    assert.equal(
      await p.evaluate(() => growthData().checkins[0].note),
      "private emotional note",
    );
    const alice2 = await browser.newContext(),
      p2 = await alice2.newPage();
    await login(p2, f.a.email);
    await p2.waitForFunction(
      () => typeof eliteCloud !== "undefined" && eliteCloud.ready,
    );
    assert.equal(await p2.evaluate(() => S.trades[0].id), "alice-trade");
    const bob = await browser.newContext(),
      pb = await bob.newPage();
    await login(pb, f.b.email);
    await pb.waitForFunction(
      () => typeof eliteCloud !== "undefined" && eliteCloud.ready,
    );
    assert.equal(await pb.evaluate(() => S.trades.length), 0);
    assert.equal(await pb.evaluate(() => growthData().checkins.length), 0);
    assert.equal(
      await pb.evaluate(() => Object.keys(growthData().reflections).length),
      0,
    );
    assert.equal(
      await pb.evaluate(() => tabs.some(([id]) => id === "admin")),
      false,
    );
    await pb.route("**/api/workspace", (route) =>
      route.request().method() === "PUT" ? route.abort() : route.continue(),
    );
    await pb.evaluate(() => {
      S.trades = [mk({ id: "bob-offline", close: "2026-10-30T11:00", pnl: 5 })];
      save();
    });
    await pb.waitForFunction(() => eliteCloud.state === "error");
    assert.equal(
      await pb.evaluate(() => JSON.parse(localStorage.getItem(K)).dirty),
      true,
    );
    assert.equal(f.workspaces.has(f.b.id), false);
    await pb.unroute("**/api/workspace");
    await pb.evaluate(() => eliteCloudFlush());
    await pb.waitForFunction(
      () => !eliteCloud.pending && eliteCloud.revision === 1,
    );
    assert.equal(f.workspaces.get(f.b.id).data.trades[0].id, "bob-offline");
    const pending = await browser.newContext(),
      pp = await pending.newPage();
    await login(pp, f.pending.email);
    await pp.waitForSelector("#account-access:not([hidden])");
    await pp
      .getByRole("button", { name: "Verificar acesso", exact: true })
      .click();
    assert.match(
      await pp.locator("#account-access").innerText(),
      /aguarda aprovação/,
    );
    // Two independently loaded sessions must conflict instead of overwriting.
    await p.evaluate(() => {
      S.trades[0].pnl = 150;
      save();
    });
    await p.waitForFunction(
      () => eliteCloud.revision === 2 && !eliteCloud.pending,
    );
    await p2.evaluate(() => {
      S.trades[0].pnl = 77;
      save();
    });
    await p2.waitForFunction(() => eliteCloud.conflict);
    assert.equal(f.workspaces.get(f.a.id).data.trades[0].pnl, 150);
    assert.equal(await p2.evaluate(() => S.trades[0].pnl), 77);
    await p2.evaluate(() => taGo("settings"));
    assert.match(
      await p2.locator(".cloud-account-panel").innerText(),
      /Conflito entre sessões/,
    );
    const owner = await browser.newContext(),
      po = await owner.newPage();
    await po.goto(origin);
    await po.evaluate(() =>
      localStorage.setItem(
        "yfx1",
        JSON.stringify({
          trades: [
            {
              id: "legacy-owner",
              symbol: "EURUSD",
              close: "2026-10-30T09:00",
              pnl: 12,
            },
          ],
          reviews: {},
          strats: [],
          balance: 5000,
        }),
      ),
    );
    await login(po, f.owner.email);
    await po.waitForFunction(
      () => typeof eliteCloud !== "undefined" && eliteCloud.ready,
    );
    await po
      .getByRole("button", {
        name: "Revisar e importar meu histórico",
        exact: true,
      })
      .click();
    await po.locator("#cloud-legacy-confirm").check();
    await po
      .getByRole("button", { name: "Importar para minha conta", exact: true })
      .click();
    await po.waitForFunction(
      () => eliteCloud.revision === 1 && !eliteCloud.pending,
    );
    assert.equal(
      f.workspaces.get(f.owner.id).data.trades[0].id,
      "legacy-owner",
    );
    await po.evaluate(() => taGo("admin"));
    await po.waitForSelector("[data-account-search]");
    assert.equal(await po.locator(".smc-admin-user").count(), 5);
    const row = po
      .locator(".smc-admin-user")
      .filter({ hasText: f.pending.email });
    await row
      .getByRole("button", { name: "Liberar acesso", exact: true })
      .click();
    await po
      .getByRole("button", { name: "Liberar sem vencimento", exact: true })
      .click();
    await po.waitForFunction(
      (id) => eliteCloud.adminRows.find((u) => u.id === id).status === "active",
      f.pending.id,
    );
    await pp
      .getByRole("button", { name: "Verificar acesso", exact: true })
      .click();
    await pp.waitForSelector(".reference-home");
    // Existing member loses access on the next protected request.
    await po
      .locator(".smc-admin-user")
      .filter({ hasText: f.b.email })
      .getByRole("button", { name: "Bloquear", exact: true })
      .click();
    await po.waitForFunction(
      (id) =>
        eliteCloud.adminRows.find((u) => u.id === id).status === "blocked",
      f.b.id,
    );
    await pb.evaluate(() => taApi("/api/workspace").catch(() => {}));
    await pb.waitForURL("**/account");
    assert.match(
      await pb.locator("#account-access").innerText(),
      /Acesso bloqueado/,
    );
    await p.evaluate(() => taGo("settings"));
    await p
      .getByRole("button", { name: "Sair da minha conta", exact: true })
      .click();
    await p.waitForURL("**/account");
    assert.equal(
      await p.evaluate(
        (id) => localStorage.getItem("elitex-workspace:" + id),
        f.a.id,
      ),
      null,
    );
    await login(p, f.b.email);
    await p.waitForSelector("#account-access:not([hidden])");
    assert(
      !(await p
        .locator("body")
        .innerText()
        .then((t) => t.includes("private alice note"))),
    );
    // Account page and admin screens remain usable on phones.
    for (const page of [p, po])
      for (const width of [320, 390, 760, 1536]) {
        await page.setViewportSize({ width, height: 900 });
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          "overflow " + width,
        );
      }
    assert.deepEqual(errors, []);
    console.log(
      "PASS account landing, legacy data opt-in, autosave/reload/second-device restore, separate user stores, stale-write conflict preservation, admin approval/blocking, logout cache clearing and responsive screens",
    );
  } finally {
    await browser.close();
    app.server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
