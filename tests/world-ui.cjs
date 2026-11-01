"use strict";
const assert = require("node:assert/strict"),
  { chromium } = require("playwright"),
  { createApp } = require("../server/index.cjs"),
  fs = require("node:fs");
(async () => {
  const app = createApp({ env: { SMC_WORLD_ENABLED: "true" } });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
  });
  try {
    const p = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: "reduce",
      }),
      errors = [],
      base = "http://127.0.0.1:" + app.server.address().port;
    p.on("pageerror", (e) => errors.push(e.message));
    // Keep original map/collision regression deterministic; WebGL has a dedicated suite.
    await p.route("**/public/world/world-3d.js", (r) => r.abort());
    await p.route("**/api/status", (r) =>
      r.fulfill({
        json: { authenticated: false, authConfigured: false, services: {} },
      }),
    );
    await p.goto(base);
    await p.waitForSelector(".smc-home");
    await p.evaluate(() => {
      S.balance = 1000;
      S.balanceConfirmed = true;
      S.currency = "USD";
      S.trades = [
        mk({
          id: "preserved-trade",
          symbol: "EURUSD",
          pnl: 100,
          risk: 50,
          close: "2026-10-28T10:00",
          notes: "Preserve my original journal",
          img: [],
        }),
      ];
      persistState(S);
      R();
    });
    assert.equal(await p.locator("#smc-world-enter").count(), 1);
    assert.equal(
      await p.locator('script[src="public/world/world-map.js"]').count(),
      0,
    );
    const original = await p.evaluate(() => JSON.stringify(S));
    await p.screenshot({
      path: "/tmp/world-classic-before.png",
      fullPage: true,
    });
    await p.locator("#smc-world-enter").click();
    await p.waitForSelector(".smc-world-room-list");
    assert.equal(await p.locator(".smc-world-avatar").count(), 1);
    await p.locator("[data-world-action=help]").click();
    await p.locator("#smc-world-motion").check();
    assert.equal(
      await p.evaluate(() => SMCWorld.controller.reduceMotion),
      true,
    );
    await p.locator("#smc-world-motion").uncheck();
    await p
      .locator("#growth-dialog")
      .getByRole("button", { name: "Fechar", exact: true })
      .click();

    assert.equal(
      await p.locator(".smc-world-room-list button:disabled").count(),
      1,
    );
    assert(
      await p
        .getByRole("button", { name: "Voltar ao modo clássico", exact: true })
        .isVisible(),
    );
    await p.screenshot({
      path: "/tmp/world-lobby-desktop.png",
      fullPage: true,
    });
    assert.equal(await p.evaluate(() => JSON.stringify(S)), original);
    for (const id of [
      "dash",
      "trades",
      "plan",
      "analyst",
      "risk",
      "economic",
      "tools",
      "achievements",
      "settings",
    ]) {
      await p
        .locator('.smc-world-room-list [data-world-room="' + id + '"]')
        .click();
      await p.waitForSelector("#smc-world-workspace #main");
      assert.equal(await p.evaluate(() => SMCWorld.controller.room), id);
      assert.equal(await p.locator(".smc-world-room-heading h1").count(), 1);
      assert.equal(
        await p.evaluate(() => JSON.stringify(S)),
        original,
        "unchanged data in " + id,
      );
      await p.screenshot({
        path: "/tmp/world-room-" + id + ".png",
        fullPage: true,
      });
      await p.locator("[data-world-action=lobby]").click();
      assert(await p.locator(".smc-world-room-list").isVisible());
    }
    await p.evaluate(() => {
      F.sym = "EURUSD";
      SMCWorld.controller.navigate("dash");
    });
    assert.equal(
      await p.getByLabel("Ativo", { exact: true }).inputValue(),
      "EURUSD",
    );
    await p.locator("[data-world-action=lobby]").click();
    await p.locator("[data-world-room=plan]").click();
    await p.locator("#tp-name").fill("Unsaved World draft");
    await p.getByRole("button", { name: "+ Critério", exact: true }).click();
    await p
      .locator(".ta-criterion")
      .nth(1)
      .locator("[data-cfield=label]")
      .fill("Unsaved new criterion");
    await p.locator("[data-world-action=lobby]").click();
    await p.locator("[data-world-room=trades]").click();
    await p.locator("[data-world-action=lobby]").click();
    await p.locator("[data-world-room=plan]").click();
    assert.equal(
      await p.locator("#tp-name").inputValue(),
      "Unsaved World draft",
    );
    assert.equal(await p.locator(".ta-criterion").count(), 2);
    assert.equal(
      await p
        .locator(".ta-criterion")
        .nth(1)
        .locator("[data-cfield=label]")
        .inputValue(),
      "Unsaved new criterion",
    );
    await p.locator("[data-world-action=classic]").click();
    await p.evaluate(() => taGo("plan"));
    assert.equal(
      await p.locator("#tp-name").inputValue(),
      "Unsaved World draft",
    );
    assert.equal(await p.evaluate(() => JSON.stringify(S)), original);
    await p.evaluate(() => taGo("home"));
    await p.locator("#smc-world-enter").click();
    await p.locator("[data-world-room=trades]").click();
    await p
      .getByRole("button", { name: "Abrir / completar diário", exact: true })
      .first()
      .click();
    await p.locator("#f_notes").fill("Edited once through the World");
    await p.keyboard.press("Escape");
    assert(await p.locator("#dlg").evaluate((d) => !d.open));
    assert.equal(await p.evaluate(() => SMCWorld.controller.room), "trades");
    await p
      .getByRole("button", { name: "Abrir / completar diário", exact: true })
      .first()
      .click();
    await p.locator("#f_notes").fill("Edited once through the World");
    await p
      .locator("#dlg")
      .getByRole("button", { name: "Salvar", exact: true })
      .click();
    assert.equal(await p.evaluate(() => S.trades.length), 1);
    assert.equal(
      await p.evaluate(() => S.trades[0].notes),
      "Edited once through the World",
    );
    await p.locator("[data-world-action=classic]").click();
    assert.equal(await p.evaluate(() => S.trades[0].id), "preserved-trade");
    await p.locator("#smc-world-enter").click();
    assert.equal(
      await p.evaluate(() => SMCWorld.controller.navigate("admin")),
      false,
    );
    assert.equal(
      await p.evaluate(() => SMCWorld.controller.navigate("not-a-route")),
      false,
    );
    for (const width of [320, 390, 768, 1280, 1440, 1920]) {
      await p.setViewportSize({ width, height: 1000 });
      await p.locator("[data-world-room=dash]").click();
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "room overflow " + width,
      );
      await p.locator("[data-world-action=lobby]").click();
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "lobby overflow " + width,
      );
      assert(await p.locator("[data-world-action=classic]").isVisible());
      if (width === 390)
        await p.screenshot({
          path: "/tmp/world-lobby-mobile.png",
          fullPage: true,
        });
    }
    await p.locator("[data-world-walk=dash]").click();
    assert.equal(await p.evaluate(() => SMCWorld.controller.room), "dash");
    await p.keyboard.press("Escape");
    assert.equal(await p.evaluate(() => SMCWorld.controller.room), null);
    const pos = await p.evaluate(() => ({
      ...SMCWorld.controller.map.position,
    }));
    await p.locator(".smc-world-intro h1").click();
    await p.keyboard.press("s");
    const moved = await p.evaluate(() => ({
      ...SMCWorld.controller.map.position,
    }));
    assert.notDeepEqual(moved, pos);
    await p.evaluate(() => SMCWorld.controller.fail(Error("test failure")));
    assert(await p.locator("[data-world-action=classic]").isVisible());
    await p.locator("[data-world-action=classic]").click();
    assert(await p.locator(".smc-home").isVisible());
    await p.setViewportSize({ width: 1440, height: 1000 });
    await p.screenshot({
      path: "/tmp/world-classic-after.png",
      fullPage: true,
    });
    await p.reload();
    await p.waitForSelector(".smc-home");
    assert.equal(await p.locator("#smc-world").count(), 0);
    assert.equal(
      await p.evaluate(() => S.trades[0].notes),
      "Edited once through the World",
    );
    const touchContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const touch = await touchContext.newPage();
    await touch.goto(base);
    await touch.locator("#smc-world-enter").tap();
    await touch.waitForSelector(".smc-world-room-list");
    await touch.locator("[data-world-room=plan]").tap();
    assert(await touch.locator("#ta-plan-form").isVisible());
    await touch.locator("[data-world-action=classic]").tap();
    assert(await touch.locator(".smc-home").isVisible());
    await touchContext.close();
    const retryPage = await browser.newPage({ reducedMotion: "reduce" });
    await retryPage.goto(base);
    await retryPage.route("**/public/world/world-map.js", (r) => r.abort());
    await retryPage.locator("#smc-world-enter").click();
    await retryPage.waitForFunction(
      () =>
        document.getElementById("smc-world-enter")?.textContent ===
        "Tentar abrir SMC Elite World",
    );
    assert(await retryPage.locator(".smc-home").isVisible());
    await retryPage.unroute("**/public/world/world-map.js");
    await retryPage.locator("#smc-world-enter").click();
    await retryPage.waitForSelector(".smc-world-room-list");
    assert.equal(
      await retryPage.locator('link[href="public/world/world.css"]').count(),
      1,
    );
    await retryPage.locator("[data-world-action=classic]").click();
    await retryPage.close();
    assert.deepEqual(errors, []);
    console.log(
      "PASS World UI: lazy entry, all rooms, same data, draft round trips, trade edit, restricted routes, keyboard, mobile, error recovery and reload",
    );
  } finally {
    await browser.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
