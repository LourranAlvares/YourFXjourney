"use strict";
const assert = require("node:assert/strict"),
  net = require("node:net"),
  { chromium } = require("playwright"),
  { createApp } = require("../server/index.cjs"),
  { fixture } = require("../server/tests/helpers/cloud-fixture.cjs");
(async () => {
  const reserve = net.createServer();
  await new Promise((r) => reserve.listen(0, "127.0.0.1", r));
  const port = reserve.address().port;
  await new Promise((r) => reserve.close(r));
  const origin = "http://127.0.0.1:" + port,
    f = fixture(),
    app = createApp({
      env: { ...f.env(origin), SMC_WORLD_ENABLED: "true" },
      fetchFn: f.fetchFn,
    });
  await new Promise((r) => app.server.listen(port, "127.0.0.1", r));
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
  try {
    const login = async (email) => {
      const ctx = await b.newContext({ reducedMotion: "reduce" }),
        p = await ctx.newPage();
      await p.goto(origin);
      assert.equal(await p.locator("#smc-world-enter").count(), 0);
      await p.getByLabel("E-mail", { exact: true }).fill(email);
      await p
        .getByLabel("Senha", { exact: true })
        .fill("Example-test-password-123");
      await p.locator("#account-submit").click();
      await p.waitForSelector("#smc-world-enter");
      return p;
    };
    const alice = await login("alice@example.test");
    await alice.evaluate(async () => {
      S.trades = [
        mk({
          id: "alice-private-trade",
          symbol: "EURUSD",
          pnl: 42,
          risk: 10,
          close: "2026-10-28T10:00",
          notes: "ALICE_PRIVATE_JOURNAL",
        }),
      ];
      persistState(S);
      await eliteCloudFlush();
    });
    await alice.locator("#smc-world-enter").click();
    await alice.locator("[data-world-room=trades]").click();
    assert.match(
      await alice.locator("#main").innerText(),
      /ALICE_PRIVATE_JOURNAL/,
    );
    assert.equal(
      await alice.evaluate(() => SMCWorld.controller.navigate("admin")),
      false,
    );
    assert.equal(
      await alice.evaluate(() => SMCWorld.controller.isAdmin()),
      false,
    );
    await alice.locator("[data-world-action=classic]").click();
    const bob = await login("bob@example.test");
    await bob.locator("#smc-world-enter").click();
    await bob.locator("[data-world-room=trades]").click();
    assert.equal(await bob.evaluate(() => S.trades.length), 0);
    assert(
      !(await bob.locator("#smc-world").innerText()).includes(
        "ALICE_PRIVATE_JOURNAL",
      ),
    );
    assert.equal(
      await bob.evaluate(() => SMCWorld.controller.navigate("admin")),
      false,
    );
    const own = await login("owner@example.test");
    await own.locator("#smc-world-enter").click();
    await own.locator("[data-world-room=settings]").click();
    assert.equal(await own.locator("[data-world-route=admin]").count(), 1);
    assert(await own.evaluate(() => SMCWorld.controller.isAdmin()));
    assert(await own.evaluate(() => SMCWorld.controller.navigate("admin")));
    assert.equal(await own.evaluate(() => tab), "admin");
    assert.equal(await own.evaluate(() => S.trades.length), 0);
    await alice.locator("#smc-world-enter").click();
    const scope = await alice.evaluate(() => SMCWorld.controller.key);
    assert(scope.endsWith(await alice.evaluate(() => K)));
    assert(
      !JSON.stringify(
        await alice.evaluate(() =>
          JSON.parse(localStorage.getItem(SMCWorld.controller.key)),
        ),
      ).includes("ALICE_PRIVATE"),
    );
    await alice.evaluate(() => {
      K = "elitex-workspace:changed-identity";
      R();
    });
    assert.equal(await alice.evaluate(() => SMCWorld.controller), null);
    assert.equal(await alice.locator("#smc-world").count(), 0);
    await bob.reload();
    await bob.waitForSelector(".smc-home");
    assert.equal(await bob.evaluate(() => S.trades.length), 0);
    console.log(
      "PASS World cloud: login unchanged, private workspace A/B, scoped UI-only preferences, no admin escalation, actual owner admin and identity cleanup",
    );
  } finally {
    await b.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
