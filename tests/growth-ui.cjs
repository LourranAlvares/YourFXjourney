"use strict";
const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
  });
  try {
    const p = await browser.newPage({
        viewport: { width: 390, height: 844 },
        reducedMotion: "reduce",
      }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.clock.setFixedTime(new Date("2026-10-30T09:00Z"));
    await p.route("**/api/status", (r) =>
      r.fulfill({
        json: { authenticated: false, authConfigured: false, services: {} },
      }),
    );
    const base = "http://127.0.0.1:" + app.server.address().port;
    await p.goto(base);
    await p.waitForSelector(".smc-home");
    await p.evaluate(() => {
      S.assistantProfile = {
        ...taProfile(),
        name: "Test Trader",
        session: {
          enabled: true,
          label: "Londres",
          timezone: "Europe/London",
          start: "08:00",
          end: "11:00",
          days: [1, 2, 3, 4, 5],
        },
      };
      S.growth = { monitor: { enabled: true, mode: "manual", frequency: 30 } };
      R();
      growthTick();
    });
    assert.equal(await p.locator("#growth-live-prompt").count(), 0);
    await p.evaluate(() => {
      growthStart();
      growthTick();
    });
    await p.getByRole("button", { name: "Responder", exact: true }).click();
    await p.getByRole("button", { name: "FOMO", exact: true }).click();
    assert.equal(await p.evaluate(() => growthData().checkins.length), 1);
    await p.getByRole("button", { name: "Confident", exact: true }).click();
    assert.equal(await p.evaluate(() => growthData().checkins.length), 1);
    await p.locator("#growth-checkin-details summary").click();
    await p
      .locator("#growth-checkin-form [name=note]")
      .fill("Aguardei meu contexto.");
    await p.locator("#growth-checkin-form [name=decision]").check();
    await p
      .getByRole("button", { name: "Salvar contexto", exact: true })
      .click();
    await p.getByRole("button", { name: "Fechar", exact: true }).click();
    await p.reload();
    await p.waitForSelector(".smc-home");
    assert.equal(
      await p.evaluate(() => growthData().checkins[0].note),
      "Aguardei meu contexto.",
    );
    await p.evaluate(() => taGo("trades"));
    await p.locator(".growth-insights-host>summary").click();
    assert.match(await p.locator("#growth-insights").innerText(), /Confident/);
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS optional/manual prompt, one-click persistent check-in, deduplication, context, diary insights and reload",
    );
  } finally {
    await browser.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
