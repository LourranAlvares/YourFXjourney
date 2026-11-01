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
      reducedMotion: "reduce",
    });
    const errors = [],
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
    const base = "http://127.0.0.1:" + app.server.address().port;
    await p.goto(base);
    await p.waitForSelector("#smc-world-enter");
    await p.evaluate(() => {
      S.tradingPlans = [
        TradePlanEngine.validatePlan({
          id: "scene-test-plan",
          version: 1,
          name: "Plano de teste visual",
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
      persistState(S);
      R();
    });
    const original = await p.evaluate(() => JSON.stringify(S));
    const initialAchievements = await p.evaluate(() =>
      JSON.stringify(
        growthAchievements().map((a) => [a.id, a.earned, a.progress]),
      ),
    );
    await p.locator("#smc-world-enter").click();
    await p.waitForSelector(".smc-cinema-lobby");
    assert(
      !requests.some((u) =>
        /\/(analyst|risk|news|tools|achievements|community)\.webp$/.test(u),
      ),
      "no interiors prefetched",
    );
    await p.locator("[data-world-action=dismiss-help]").click();
    const routes = {
      analyst: "analyst",
      risk: "risk",
      economic: "economic",
      tools: "share",
      achievements: "achievements",
    };
    for (const [room, route] of Object.entries(routes)) {
      await p.locator(`[data-world-walk=${room}]`).click();
      await p.waitForSelector(
        `.smc-cinema-room[data-world-room-id=${room}] #main`,
      );
      await p.locator(".smc-cinema-image").evaluate((i) => i.decode());
      assert.equal(await p.evaluate(() => tab), route);
      assert.equal(await p.locator("#main").count(), 1);
      assert.equal(
        await p.evaluate(() => JSON.stringify(S)),
        original,
        "scene does not mutate " + room,
      );
      await p.screenshot({
        path: `/tmp/world-batch2-${room}.png`,
        fullPage: true,
      });
      for (const width of [320, 390, 768, 1280, 1440, 1920]) {
        await p.setViewportSize({ width, height: 1000 });
        assert(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          room + " fits " + width,
        );
      }
      if (room === "analyst") {
        await p.setViewportSize({ width: 390, height: 844 });
        await p.screenshot({
          path: "/tmp/world-batch2-analyst-mobile.png",
          fullPage: true,
        });
        await p.locator("#ta-a-asset").fill("EURUSD");
        await p.locator("#ta-a-timeframe").fill("M15");
        assert.match(
          await p.locator("#ta-analyst-form").innerText(),
          /IA conectada/,
        );
      }
      await p.setViewportSize({ width: 1440, height: 1000 });
      await p.locator("[data-world-action=lobby]").click();
    }
    assert.equal(
      await p.evaluate(() =>
        JSON.stringify(
          growthAchievements().map((a) => [a.id, a.earned, a.progress]),
        ),
      ),
      initialAchievements,
      "certificates use original eligibility",
    );
    // The future community is a clearly labelled visual preview, never a new data route.
    assert(await p.locator("[data-world-walk=community]").isDisabled());
    await p.locator("[data-world-room=plan]").click();
    await p.locator("#tp-name").fill("Rascunho antes da prévia");
    await p.locator("[data-world-action=lobby]").click();
    const tabBefore = await p.evaluate(() => tab);
    await p.locator("[data-world-action=community-preview]").click();
    await p.waitForSelector(".smc-cinema-future");
    await p.locator(".smc-cinema-image").evaluate((i) => i.decode());
    assert.match(
      await p.locator(".smc-cinema-future-note").innerText(),
      /Em desenvolvimento/,
    );
    assert.equal(await p.locator("#smc-world-workspace").count(), 0);
    assert.equal(
      await p.evaluate(() => tab),
      tabBefore,
      "preview does not invent a functional community route",
    );
    await p.screenshot({
      path: "/tmp/world-batch2-community.png",
      fullPage: true,
    });
    await p.setViewportSize({ width: 320, height: 844 });
    await p.waitForTimeout(180);
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    assert(await p.locator(".smc-cinema-future-note").isVisible());
    await p.keyboard.press("Escape");
    await p.waitForSelector(".smc-cinema-lobby");
    await p.locator("[data-world-room=plan]").click();
    assert.equal(
      await p.locator("#tp-name").inputValue(),
      "Rascunho antes da prévia",
    );
    await p.locator("[data-world-action=lobby]").click();
    // Existing settings/admin allowlist still applies through the new presentation.
    assert.equal(
      await p.evaluate(() => SMCWorld.controller.navigate("admin")),
      false,
    );
    await p.locator("[data-world-room=risk]").click();
    await p.locator("#risk-reference").fill("10000");
    await p.locator("#risk-percent").fill("0.5");
    assert.equal(
      await p.evaluate(() =>
        riskCalculationValue(riskCalculator.base, riskCalculator.percent),
      ),
      50,
    );
    await p.locator("[data-world-action=lobby]").click();
    await p.locator("[data-world-room=tools]").click();
    for (const route of ["trades", "risk", "cal", "pat", "str", "share"]) {
      await p.locator(`[data-world-route=${route}]`).click();
      assert.equal(await p.evaluate(() => tab), route);
      assert.equal(await p.evaluate(() => SMCWorld.controller.room), "tools");
    }
    await p.locator("[data-world-action=lobby]").click();
    await p.locator("[data-world-room=analyst]").click();
    assert.equal(await p.locator("#ta-a-asset").inputValue(), "EURUSD");
    await p.evaluate(() => taRunManual());
    assert.equal(await p.evaluate(() => S.setupAnalyses[0].provider), "manual");
    assert(
      await p.evaluate(() => {
        const r = S.setupAnalyses[0];
        return (
          JSON.stringify(r.score) ===
          JSON.stringify(
            TradePlanEngine.scorePlan(
              r.planSnapshot,
              r.analysis.assessments,
              r.scoringContext,
            ),
          )
        );
      }),
    );
    assert.equal(await p.evaluate(() => S.setupAnalyses[0].score.coverage), 0);
    const afterManual = await p.evaluate(() => JSON.stringify(S));
    await p.locator("[data-world-action=classic]").click();
    assert.equal(await p.evaluate(() => JSON.stringify(S)), afterManual);
    assert(
      !requests.some((u) => u.includes("/api/analyse")),
      "opening scenes never sends data to AI",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS remaining World scenes: five real views, lazy art, offline/manual analysis with original score, risk calculator, tools routing, certificate eligibility, future-only community preview, admin guard, data preserved and responsive 320–1920",
    );
  } finally {
    await browser.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
