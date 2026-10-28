const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({
    env: { TRADE_ASSISTANT_PASSWORD: "synthetic connection password" },
  });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
  try {
    const p = await b.newPage();
    let calls = 0;
    await p.route("**/api/status", async (r) => {
      if (++calls === 1)
        return r.fulfill({
          status: 503,
          json: { error: { message: "Waking up" } },
        });
      await r.continue();
    });
    await p.goto("http://127.0.0.1:" + app.server.address().port);
    await p.waitForSelector(".scene-login", { timeout: 15000 });
    assert(calls >= 2);
    await p.locator("#ta-password").fill("synthetic connection password");
    await p
      .locator(".scene-login")
      .getByRole("button", { name: "Conectar", exact: true })
      .click();
    await p.waitForFunction(() => taConnection.authenticated);
    assert.equal(await p.locator(".scene-login").count(), 0);
    const cookie = (await p.context().cookies()).find(
      (c) => c.name === "trade_session",
    );
    assert(cookie.httpOnly);
    await p.reload();
    await p.waitForFunction(() => taConnection.authenticated);
    assert.equal(await p.locator(".scene-login").count(), 0);
    await p.evaluate(() => {
      taConnection.available = false;
      taLastStatusAt = 0;
      window.dispatchEvent(new Event("online"));
    });
    await p.waitForFunction(
      () => taConnection.available && taConnection.authenticated,
    );
    const before = calls;
    await p.evaluate(() =>
      Promise.all([
        taCheckConnection(true),
        taCheckConnection(true),
        taCheckConnection(true),
      ]),
    );
    assert.equal(calls, before + 1);
    console.log(
      "PASS automatic retry after cold start, inline first login, persistent reload, online reconnect and deduplicated status calls",
    );
  } finally {
    await b.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
