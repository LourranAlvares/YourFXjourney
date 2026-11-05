const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { chromium } = require("playwright"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
  try {
    const p = await b.newPage(),
      worldRequests = [],
      errors = [];
    p.on("request", (r) => {
      if (r.url().includes("/world/")) worldRequests.push(r.url());
    });
    p.on("pageerror", (e) => errors.push(e.message));
    const base = "http://127.0.0.1:" + app.server.address().port;
    await p.goto(base);
    await p.waitForSelector(".smc-home");
    assert.equal(await p.locator("#smc-world-enter").count(), 0);
    assert.equal(await p.evaluate(() => typeof SMCWorld), "undefined");
    assert.equal(
      await p.locator("meta[name=smc-world-enabled]").getAttribute("content"),
      "false",
    );
    await p.evaluate(() => {
      S.trades = [
        mk({
          id: "preserved",
          symbol: "EURUSD",
          close: "2026-11-05T10:00",
          pnl: 10,
        }),
      ];
      persistState(S);
      taGo("trades");
    });
    assert.equal(await p.evaluate(() => S.trades[0].id), "preserved");
    await p.reload();
    await p.waitForSelector(".smc-home");
    assert.equal(await p.evaluate(() => S.trades[0].id), "preserved");
    await p.evaluate(() => taGo("settings"));
    await p
      .getByRole("button", { name: "Rever tutorial", exact: true })
      .click();
    for (let i = 0; i < 5; i++)
      await p
        .locator("#first-use-tour")
        .getByRole("button", { name: "Próximo", exact: true })
        .click();
    assert.match(await p.locator("#first-use-tour h2").innerText(), /evolução/);
    await p
      .getByRole("button", { name: "Conhecer o Painel", exact: true })
      .click();
    assert.equal(await p.evaluate(() => tab), "dash");
    assert.deepEqual(worldRequests, []);
    assert.deepEqual(errors, []);
    const offline = fs.readFileSync("YourFXjourney-standalone.html", "utf8");
    assert(!offline.includes("SMC_WORLD_EMBEDDED"));
    assert(!offline.includes("world-bootstrap.js"));
    assert(!offline.includes("class SMCWorldController"));
    console.log(
      "PASS World paused: no entry, scripts/styles/assets or embedded bundle, real dashboard tour and preserved journal data",
    );
  } finally {
    await b.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
