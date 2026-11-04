const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
  try {
    const p = await b.newPage({ reducedMotion: "reduce" }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.clock.install({ time: new Date("2026-11-04T08:59:00Z") });
    await p.goto("http://127.0.0.1:" + app.server.address().port);
    await p.waitForSelector(".smc-home");
    await p.evaluate(() => {
      S.assistantProfile = {
        ...taProfile(),
        timezone: "UTC",
        session: {
          enabled: true,
          label: "Teste",
          timezone: "UTC",
          start: "09:00",
          end: "11:00",
          days: [1, 2, 3, 4, 5],
        },
      };
      S.growth = { monitor: { enabled: false, mode: "manual", frequency: 5 } };
      R();
      growthTick();
    });
    assert.equal(await p.locator("#growth-live-prompt").count(), 0);
    await p
      .getByRole("button", {
        name: "Ativar automaticamente no meu horário",
        exact: true,
      })
      .click();
    assert.equal(await p.evaluate(() => growthData().monitor.mode), "auto");
    assert.equal(await p.evaluate(() => growthData().monitor.enabled), true);
    await p.clock.fastForward(61000);
    await p.evaluate(() => growthTick());
    assert(await p.locator("#growth-live-prompt").isVisible());
    await p.evaluate(() => taGo("trades"));
    assert(await p.locator("#growth-live-prompt").isVisible());
    await p.evaluate(() => taGo("home"));
    await p.locator("#smc-world-enter").click();
    await p.waitForSelector(".smc-cinema-avatar");
    await p.evaluate(() => {
      document.getElementById("growth-live-prompt").remove();
      S.growth.prompts = {};
      localStorage.removeItem(K + ":growth-prompt");
      growthTick();
    });
    assert(await p.locator("body > #growth-live-prompt").isVisible());
    await p.getByRole("button", { name: "Adiar 10 min", exact: true }).click();
    await p.clock.fastForward(9 * 60000);
    await p.evaluate(() => growthTick());
    assert.equal(await p.locator("#growth-live-prompt").count(), 0);
    await p.clock.fastForward(61000);
    await p.evaluate(() => growthTick());
    assert(await p.locator("#growth-live-prompt").isVisible());
    await p.getByRole("button", { name: "Responder", exact: true }).click();
    await p.getByRole("button", { name: "FOMO", exact: true }).click();
    assert.equal(await p.evaluate(() => growthData().checkins.length), 1);
    await p
      .locator("#growth-dialog")
      .getByRole("button", { name: "Fechar", exact: true })
      .click();
    await p.evaluate(() => growthTick());
    assert.equal(await p.locator("#growth-live-prompt").count(), 0);
    await p.clock.fastForward(5 * 60000 + 1000);
    await p.evaluate(() => growthTick());
    assert(await p.locator("#growth-live-prompt").isVisible());
    await p.evaluate(() => {
      K += ":other";
      growthSyncPrompt();
    });
    assert.equal(await p.locator("#growth-live-prompt").count(), 0);
    await p.clock.fastForward(3 * 3600000);
    await p.evaluate(() => growthTick());
    assert.equal(await p.locator("#growth-live-prompt").count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS session boundary, recurring and snoozed prompts, route/World visibility, response persistence, identity cleanup and no outside-session prompt",
    );
  } finally {
    await b.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
