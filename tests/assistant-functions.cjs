const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
  try {
    const p = await b.newPage({ viewport: { width: 1440, height: 1000 } }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("http://127.0.0.1:" + app.server.address().port);
    await p.waitForSelector(".elite-function-actions");
    assert.equal(await p.locator("#elite-question").count(), 0);
    await p.getByRole("button", { name: /EliteX Alinha Meu trade/ }).click();
    assert.equal(await p.evaluate(() => tab), "analyst");
    assert.match(await p.locator("#main").innerText(), /Defina as regras/);
    await p.evaluate(() => {
      S.tradingPlans = [
        TradePlanEngine.validatePlan({
          id: "system",
          version: 3,
          name: "Meu sistema de confirmação",
          risk: { minRR: 3 },
          criteria: [
            {
              id: "confirmation",
              label: "Fechamento confirmado",
              definition: "Esperar confirmação documentada no gráfico",
              weight: 1,
              required: true,
              critical: true,
            },
          ],
        }),
      ];
      S.trades = Array.from({ length: 8 }, (_, i) =>
        mk({
          id: "t" + i,
          symbol: "EURUSD",
          close: "2026-10-01T12:00",
          pnl: i % 2 ? 30 : -10,
          risk: 10,
          notes: "PRESERVAR",
          behavior: {
            plan: i % 2 === 0,
            errors: i % 2 ? ["early", "risk"] : [],
          },
        }),
      );
      R();
    });
    assert.match(
      await p.locator(".elite-analysis-guide").innerText(),
      /Meu sistema de confirmação · versão 3/,
    );
    await p.evaluate(() => taGo("ins"));
    let m = await p.evaluate(() => {
      const m = eliteReviewModel();
      return {
        n: m.rows.length,
        net: m.stats.net,
        reviewed: m.reviewed,
        errors: m.errorRows.map((e) => [e.id, e.n]),
        facts: m.input.facts,
      };
    });
    assert.equal(m.n, 8);
    assert.equal(m.net, 80);
    assert.equal(m.reviewed, 8);
    assert.deepEqual(m.errors, [
      ["early", 4],
      ["risk", 4],
    ]);
    assert(m.facts.length <= 12);
    const snapshot = await p.evaluate(() => JSON.stringify(S));
    let calls = 0;
    await p.route("**/api/briefing", async (r) => {
      calls++;
      const body = r.request().postDataJSON();
      assert.equal(body.question, undefined);
      assert.equal(body.plan.version, 3);
      assert(
        body.facts.some(
          (f) => f.id === "scope" && f.text.includes("8 operações"),
        ),
      );
      await r.fulfill({
        json: {
          action: "Confira os critérios e o risco antes da entrada.",
          facts: [body.facts.find((f) => f.id === "error-early")],
          asOf: "2026-10-28T12:00:00Z",
        },
      });
    });
    await p.evaluate(() => {
      taConnection.authenticated = true;
      taConnection.services.ai = true;
      R();
    });
    await p
      .getByRole("button", { name: "Gerar Raio-X com IA", exact: true })
      .click();
    await p.waitForFunction(() => eliteReview.result && !eliteReview.pending);
    assert.match(
      await p.locator(".elite-review").innerText(),
      /Confira os critérios e o risco/,
    );
    assert.equal(calls, 1);
    await p.getByLabel("Período do Raio-X").selectOption("30");
    assert.equal(
      await p.evaluate(
        () => eliteReview.result && eliteReview.key === eliteReviewModel().key,
      ),
      false,
    );
    assert.equal(await p.evaluate(() => JSON.stringify(S)), snapshot);
    for (const width of [320, 760, 1440, 1920]) {
      await p.setViewportSize({ width, height: 1000 });
      for (const route of ["home", "analyst", "ins", "economic"]) {
        await p.evaluate((route) => taGo(route), route);
        assert(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          route + " " + width,
        );
      }
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS no generic chat, action routes, named system/version, all-history performance and declared errors, grounded AI review, stale result invalidation, unchanged records and responsive layouts",
    );
  } finally {
    await b.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
