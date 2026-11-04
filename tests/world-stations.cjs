"use strict";
const assert = require("node:assert/strict"),
  { chromium } = require("playwright"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: { SMC_WORLD_ENABLED: "true" } });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
  });
  try {
    const p = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: "no-preference",
      }),
      errors = [],
      requests = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("request", (r) => requests.push(r.url()));
    await p.route("**/api/**", (r) =>
      r.fulfill({
        status: 503,
        json: {
          error: {
            code: "unavailable",
            message: "Serviço indisponível no teste",
          },
        },
      }),
    );
    await p.route("**/api/status", (r) =>
      r.fulfill({
        json: { authenticated: false, authConfigured: false, services: {} },
      }),
    );
    await p.goto("http://127.0.0.1:" + app.server.address().port);
    await p.waitForSelector("#smc-world-enter");
    assert(
      !requests.some(
        (u) => u.includes("world-stations.js") || u.includes("avatar-walk"),
      ),
    );
    await p.evaluate(() => {
      S.currency = "USD";
      S.balance = 1000;
      S.balanceConfirmed = true;
      S.tradingPlans = [
        TradePlanEngine.validatePlan({
          id: "station-plan",
          name: "Plano de teste das estações",
          version: 1,
          criteria: [
            {
              id: "structure",
              label: "Estrutura",
              definition:
                "Exigir evidência observável do rompimento do pivô no timeframe informado.",
              weight: 1,
              required: true,
              critical: true,
            },
          ],
        }),
      ];
      S.trades = [
        mk({
          id: "station-trade-1",
          symbol: "EURUSD",
          pnl: 100,
          risk: 50,
          close: "2026-10-29T10:00",
          notes: "Registro de teste",
        }),
        mk({
          id: "station-trade-2",
          symbol: "EURUSD",
          pnl: -40,
          risk: 50,
          close: "2026-10-30T10:00",
        }),
      ];
      persistState(S);
      R();
    });
    const saved = await p.evaluate(() => JSON.stringify(S));
    await p.locator("#smc-world-enter").click();
    await p.waitForSelector(".smc-cinema-avatar");
    await p.locator("[data-world-action=dismiss-help]").click();
    await p.evaluate(() => {
      const original = R;
      window.stationRenderCount = 0;
      R = function () {
        window.stationRenderCount++;
        return original();
      };
    });
    const before = await p.locator(".smc-cinema-avatar").boundingBox();
    await p.locator("[data-world-walk=dash]").click();
    await p.waitForSelector(".smc-cinema-avatar.is-walking");
    await p.waitForTimeout(180);
    const during = await p.locator(".smc-cinema-avatar").boundingBox();
    assert(
      Math.hypot(during.x - before.x, during.y - before.y) > 5,
      "actual character position changes",
    );
    assert.equal(
      await p.evaluate(() => stationRenderCount),
      0,
      "walking never rerenders workspace",
    );
    await p.screenshot({
      path: "/tmp/world-stations-walking.png",
      fullPage: true,
    });
    await p.waitForSelector("[data-world-stations=dashboard]");
    assert(
      await p
        .locator(".world-equity [data-terminal-chart=world-equity]")
        .isVisible(),
    );
    assert(
      await p.evaluate(
        () =>
          JSON.stringify(terminalCharts.get("world-equity").data) ===
          JSON.stringify(panelChartData(panelModel(), chartMode)),
      ),
    );
    assert.equal(await p.evaluate(() => JSON.stringify(S)), saved);
    const plot = await p.locator(".world-equity svg").boundingBox();
    const plotCard = await p.locator(".world-equity").boundingBox();
    assert(
      plot.y >= plotCard.y &&
        plot.y + plot.height <= plotCard.y + plotCard.height + 2,
      "equity plot is visible inside its station",
    );
    await p.screenshot({
      path: "/tmp/world-stations-dash.png",
      fullPage: true,
    });
    await p.locator("[data-world-action=lobby]").click();
    await p.emulateMedia({ reducedMotion: "reduce" });
    for (const room of [
      "trades",
      "plan",
      "analyst",
      "risk",
      "economic",
      "tools",
      "achievements",
    ]) {
      await p.locator("[data-world-room=" + room + "]").click();
      await p.waitForSelector("[data-world-stations]");
      await p.locator(".smc-cinema-image").evaluate((i) => i.decode());
      await p.screenshot({
        path: "/tmp/world-stations-" + room + ".png",
        fullPage: true,
      });
      for (const width of [320, 390, 768, 1280, 1440, 1920]) {
        await p.setViewportSize({ width, height: 1000 });
        await p.waitForTimeout(140);
        assert(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          room + " fits " + width,
        );
      }
      await p.setViewportSize({ width: 1440, height: 1000 });
      await p.waitForTimeout(140);
      await p.locator("[data-world-action=lobby]").click();
    }
    // Real plan form, versioning and anonymous criterion fields survive recomposition.
    await p.locator("[data-world-room=plan]").click();
    await p.locator("[data-plan-section=identity]").click();
    await p.locator("#tp-name").fill("Plano editado na sala");
    await p.locator("[data-plan-section=criteria]").click();
    await p.locator(".plan-rule-disclosure summary").first().click();
    await p
      .locator(".ta-criterion [data-cfield=definition]")
      .fill(
        "Fechamento obrigatório além do pivô visível, sem inferir evidência ausente.",
      );
    await p.locator("[data-world-action=lobby]").click();
    await p.locator("[data-world-room=analyst]").click();
    await p.locator("[data-world-action=lobby]").click();
    await p.locator("[data-world-room=plan]").click();
    assert.equal(
      await p.locator("#tp-name").inputValue(),
      "Plano editado na sala",
    );
    assert.match(
      await p.locator(".ta-criterion [data-cfield=definition]").inputValue(),
      /Fechamento obrigatório/,
    );
    await p.locator("#ta-plan-form button[type=submit]").click();
    assert.equal(
      await p.evaluate(() => taCurrentPlan().name),
      "Plano editado na sala",
    );
    // World journal stages data, then delegates validation/save to the existing editor.
    await p.locator("[data-world-action=lobby]").click();
    await p.locator("[data-world-room=trades]").click();
    await p.locator("#world-j-symbol").fill("USDJPY");
    await p.locator("#world-j-close").fill("2026-11-01T10:00");
    await p.locator("#world-j-pnl").fill("25");
    await p
      .locator("#world-j-notes")
      .fill("Registro criado na estação do World");
    await p.locator("#world-j-files").setInputFiles("public/smc-logo.png");
    await p.locator(".world-journal-entry button[type=submit]").click();
    await p.waitForFunction(() => S.trades.length === 3);
    assert.equal(await p.evaluate(() => S.trades.length), 3);
    assert.equal(
      await p.evaluate(
        () => S.trades.filter((t) => t.symbol === "USDJPY").length,
      ),
      1,
    );
    const created = await p.evaluate(() =>
      S.trades.find((t) => t.symbol === "USDJPY"),
    );
    assert.equal(created.notes, "Registro criado na estação do World");
    assert.equal(created.img.length, 1);
    // Card actions open the real tools; no placeholder destinations.
    await p.locator("[data-world-action=lobby]").click();
    await p.locator("[data-world-room=tools]").click();
    assert.equal(await p.locator("[data-world-tool]").count(), 5);
    await p.locator("[data-world-tool=risk]").click();
    assert(await p.locator("#risk-reference").isVisible());
    await p.locator("[data-station-action=tools-home]").click();
    assert(await p.locator("[data-world-tool=ocr]").isVisible());
    await p.locator("[data-world-tool=import]").click();
    assert(
      (await p
        .locator("#main details")
        .filter({
          has: p.locator("summary").filter({ hasText: "Importar histórico" }),
        })
        .first()
        .getAttribute("open")) !== null,
    );
    await p.locator("[data-station-action=tools-home]").click();
    await p.locator("[data-world-tool=ocr]").click();
    await p.waitForSelector("#dlg[open]");
    await p
      .locator("#dlg")
      .getByRole("button", { name: "Cancelar", exact: true })
      .click();
    await p.locator("[data-world-action=lobby]").click();
    await p.locator("[data-world-room=analyst]").click();
    await p.locator("#ta-a-asset").fill("EURUSD");
    await p.locator("#ta-a-timeframe").fill("M15");
    await p.evaluate(() => taRunManual());
    assert(
      await p.locator(".world-analysis-report .ta-analysis-result").isVisible(),
    );
    assert.equal(await p.evaluate(() => S.setupAnalyses[0].score.coverage), 0);
    assert(!requests.some((u) => u.includes("/api/analyse")));
    const completed = await p.evaluate(() => JSON.stringify(S));
    await p.locator("[data-world-action=classic]").click();
    assert.equal(await p.locator("[data-world-stations]").count(), 0);
    assert(
      !(await p
        .locator("#main")
        .evaluate((n) => n.classList.contains("world-station-main"))),
    );
    assert.equal(await p.evaluate(() => JSON.stringify(S)), completed);
    await p.evaluate(() => {
      taGo("trades");
      diaryLatest();
    });
    assert(
      await p
        .locator(".diary-gallery")
        .innerText()
        .then((s) => s.includes("USDJPY")),
    );
    // Returning to the same classic route must also discard the World presentation.
    await p.evaluate(() => {
      taGo("dash");
      SMCWorld.enter();
    });
    await p.waitForSelector(".smc-cinema-lobby");
    await p.locator("[data-world-room=dash]").click();
    await p.locator("[data-world-action=classic]").click();
    assert.equal(await p.evaluate(() => tab), "dash");
    assert.equal(await p.locator("[data-world-stations]").count(), 0);
    await p.evaluate(() => SMCWorld.enter());
    await p.waitForSelector(".smc-cinema-lobby");
    await p.emulateMedia({ reducedMotion: "no-preference" });
    await p.locator("[data-world-walk=risk]").click();
    await p.waitForSelector(".smc-cinema-avatar.is-walking");
    await p.locator("[data-world-action=classic]").click();
    await p.waitForTimeout(2300);
    assert.equal(await p.evaluate(() => SMCWorld.controller.active), false);
    assert.equal(await p.evaluate(() => tab), "dash");
    assert.equal(await p.evaluate(() => JSON.stringify(S)), completed);
    assert.deepEqual(errors, []);
    console.log(
      "PASS World stations: eight distinct operational layouts, real avatar walking without app renders, responsive 320–1920, shared charts/plan versioning/journal save/manual score/tools, preserved IDs/drafts and clean classic return",
    );
  } finally {
    await browser.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
