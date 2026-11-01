"use strict";
const assert = require("node:assert/strict"),
  { chromium } = require("playwright"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: { SMC_WORLD_ENABLED: "true" } });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
  try {
    const p = await b.newPage({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: "reduce",
      }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    // Keep original map/collision regression deterministic; WebGL has a dedicated suite.
    await p.route("**/public/world/world-3d.js", (r) => r.abort());
    await p.clock.setFixedTime(new Date("2026-10-30T10:00Z"));
    await p.route("**/api/status", (r) =>
      r.fulfill({
        json: { authenticated: false, authConfigured: false, services: {} },
      }),
    );
    await p.route("**/public/world/world-scenes.js", (r) => r.abort());
    await p.goto("http://127.0.0.1:" + app.server.address().port);
    await p.waitForSelector("#smc-world-enter");
    await p.evaluate(() => {
      S.currency = "USD";
      S.balance = 1000;
      S.balanceConfirmed = true;
      S.tradingPlans = [
        TradePlanEngine.validatePlan({
          id: "world-plan",
          version: 1,
          name: "Plano preservado",
          risk: { minRR: 2, perTrade: 50 },
          criteria: [
            {
              id: "structure",
              label: "Estrutura",
              definition:
                "Exigir fechamento além do pivô identificado no timeframe declarado.",
              weight: 1,
              required: true,
              critical: true,
            },
          ],
        }),
      ];
      S.trades = [
        mk({
          id: "same-id",
          symbol: "EURUSD",
          pnl: 100,
          risk: 50,
          close: "2026-10-29T10:00",
          notes: "Original",
          img: [
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
          ],
        }),
      ];
      persistState(S);
      R();
    });
    const original = await p.evaluate(() => JSON.stringify(S));
    await p.locator("#smc-world-enter").click();
    for (let i = 0; i < 4; i++) {
      await p.locator("[data-world-room=dash]").click();
      assert.equal(await p.evaluate(() => panelModel().s.net), 100);
      assert.equal(await p.evaluate(() => panelModel().r), 2);
      await p.locator("[data-world-action=lobby]").click();
      await p.locator("[data-world-action=classic]").click();
      assert.equal(await p.evaluate(() => JSON.stringify(S)), original);
      await p.locator("#smc-world-enter").click();
    }
    await p.locator("[data-world-room=analyst]").click();
    await p.locator("#ta-a-asset").fill("EURUSD");
    await p.locator("#ta-a-timeframe").fill("5m");
    await p.evaluate(() => taRunManual());
    assert.equal(await p.evaluate(() => S.setupAnalyses.length), 1);
    assert.equal(await p.evaluate(() => S.setupAnalyses[0].provider), "manual");
    assert.match(
      await p.locator(".ta-analysis-result").innerText(),
      /Nenhuma interpretação visual por IA/,
    );
    assert(
      await p.evaluate(() => {
        const r = S.setupAnalyses[0],
          score = TradePlanEngine.scorePlan(
            r.planSnapshot,
            r.analysis.assessments,
            r.scoringContext,
          );
        return JSON.stringify(score) === JSON.stringify(r.score);
      }),
    );
    await p.locator("[data-world-action=lobby]").click();
    await p.locator("[data-world-room=trades]").click();
    await p.evaluate(() => edit(null, "2026-10-30"));
    await p.locator("#f_symbol").fill("USDJPY");
    await p.locator("#f_close").fill("2026-10-30T11:00");
    await p.locator("#f_pnl").fill("-5");
    await p.locator("#f_notes").fill("New World trade");
    await p
      .locator("#dlg")
      .getByRole("button", { name: "Salvar", exact: true })
      .click();
    assert.equal(await p.evaluate(() => S.trades.length), 2);
    assert.equal(
      await p.evaluate(() => new Set(S.trades.map((t) => t.id)).size),
      2,
    );
    await p.evaluate(() => growthCheckin("same-id"));
    await p.getByRole("button", { name: "FOMO", exact: true }).click();
    await p
      .locator("#growth-dialog")
      .getByRole("button", { name: "Fechar", exact: true })
      .click();
    assert.equal(await p.evaluate(() => growthData().checkins.length), 1);
    await p.evaluate(async () => {
      await growthOpenReview("week");
      growthStartReflection(false);
    });
    for (let i = 0; i < 3; i++) {
      await p
        .locator("#growth-reflection-answer")
        .fill(
          [
            "Mantive meu processo",
            "Esperar o fechamento",
            "Revisar critérios antes da entrada",
          ][i],
        );
      await p.locator("#growth-reflection-form button[type=submit]").click();
    }
    await p
      .locator("#growth-dialog")
      .getByRole("button", { name: "Fechar", exact: true })
      .click();
    await p.locator("#growth-review-dialog").evaluate((d) => d.close());
    const growth = await p.evaluate(() => JSON.stringify(growthData()));
    const eligible = await p.evaluate(() =>
      JSON.stringify(
        growthAchievements().map((a) => [a.id, a.earned, a.progress]),
      ),
    );
    await p.locator("[data-world-action=lobby]").click();
    await p.locator("[data-world-room=achievements]").click();
    await p.locator("[data-world-action=classic]").click();
    assert.equal(await p.evaluate(() => JSON.stringify(growthData())), growth);
    assert.equal(
      await p.evaluate(() =>
        JSON.stringify(
          growthAchievements().map((a) => [a.id, a.earned, a.progress]),
        ),
      ),
      eligible,
    );
    await p.reload();
    await p.waitForSelector("#smc-world-enter");
    assert.equal(await p.evaluate(() => growthData().checkins.length), 1);
    assert.equal(
      await p.evaluate(
        () => Object.values(growthData().reflections)[0].answers.length,
      ),
      3,
    );
    assert.equal(await p.evaluate(() => S.trades[0].img.length), 1);
    assert.equal(
      await p.evaluate(() => S.setupAnalyses[0].planSnapshot.version),
      1,
    );
    await p.locator("#smc-world-enter").click();
    await p.waitForSelector(".smc-world-room-list");
    await p.emulateMedia({ reducedMotion: "no-preference" });
    const perf = await p.evaluate(async () => {
      const m = SMCWorld.controller.map;
      let paints = 0,
        renders = 0;
      const paint = m.paint.bind(m),
        render = R;
      m.paint = () => {
        paints++;
        paint();
      };
      R = function () {
        renders++;
        return render();
      };
      m.go({ x: 560, y: 336 });
      await new Promise((r) => setTimeout(r, 1300));
      const result = { paints, renders, frame: m.frame, x: m.position.x };
      R = render;
      m.paint = paint;
      return result;
    });
    assert(perf.paints > 15);
    assert.equal(perf.renders, 0);
    assert.equal(perf.frame, 0);
    assert.equal(perf.x, 560);
    await p.evaluate(() => {
      SMCWorld.controller.map.go({ x: 112, y: 192 });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await p.locator("[data-world-action=classic]").click();
    assert.equal(await p.evaluate(() => SMCWorld.controller.map), null);
    assert.deepEqual(errors, []);
    console.log(
      "PASS World integrations: unchanged metrics and IDs; same manual score; check-in, reflection, images and plan survive modes/reload; animation " +
        perf.paints +
        " frames, zero app renders during motion, loop stopped at rest/exit",
    );
  } finally {
    await b.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
