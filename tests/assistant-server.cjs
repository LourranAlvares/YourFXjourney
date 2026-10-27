const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const { createApp } = require("../server/index.cjs");
(async () => {
  let calls = 0;
  const app = createApp({
    env: {
      TRADE_ASSISTANT_PASSWORD: "integration-password-only",
      TRADE_AI_KEY: "fixture-only",
    },
    fetchFn: async (url, opts) => {
      assert.ok(String(url).startsWith("https://api.openai.com/"));
      calls++;
      const payload = JSON.parse(opts.body);
      if (payload.text.format.name === "personal_trading_briefing") {
        const facts = JSON.parse(payload.input[0].content[0].text).facts;
        return Response.json({
          output_text: JSON.stringify({
            selectedFactIds: [facts[0].id],
            action:
              "Confira os critérios documentados antes de avaliar novas entradas.",
          }),
        });
      }
      const plan = JSON.parse(payload.input[0].content[0].text).plan;
      return Response.json({
        status: "completed",
        output_text: JSON.stringify({
          summary: "Avaliação de integração com provedor simulado.",
          assessments: plan.criteria.map((c) => ({
            criterionId: c.id,
            status: "met",
            reason: "Evidência da fixture",
            evidence: "Anotação sintética de teste.",
          })),
          levels: {
            entry: 100,
            stop: 90,
            target: 130,
            side: "long",
            plannedRR: 3,
            plannedRisk: null,
            evidence: "Preços da fixture.",
          },
        }),
      });
    },
    now: () => new Date("2026-10-27T09:00:00Z"),
  });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const b = await chromium.launch({
      executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
    }),
    p = await b.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  try {
    await p.goto("http://127.0.0.1:" + app.server.address().port);
    await p.waitForFunction(() => taConnection.available);
    await p.evaluate(() => taGo("settings"));
    await p.locator("#ta-password").fill("integration-password-only");
    await p
      .getByRole("button", { name: "Conectar ao servidor", exact: true })
      .click();
    await p.waitForFunction(() => taConnection.authenticated);
    assert.ok(await p.evaluate(() => !!taCsrf));
    console.log(
      "PASS actual local backend serves UI, login/session/CSRF connects",
    );
    await p.evaluate(() => {
      const plan = TradePlanEngine.validatePlan({
        id: "plan",
        version: 1,
        name: "Plano de teste",
        risk: { minRR: 2 },
        criteria: [
          {
            id: "visual",
            label: "Regra visual",
            definition: "Verificar anotação",
            weight: 3,
            required: true,
            critical: true,
          },
          {
            id: "rr",
            label: "RR",
            definition: "No mínimo 2",
            weight: 1,
            kind: "minRR",
            required: true,
          },
        ],
      });
      S.tradingPlans = [plan];
      taGo("analyst");
    });
    const image = await p.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 200;
      c.height = 100;
      const x = c.getContext("2d");
      x.fillStyle = "black";
      x.fillRect(0, 0, 200, 100);
      return c.toDataURL("image/png").split(",")[1];
    });
    await p
      .locator("#ta-analyst-image")
      .setInputFiles({
        name: "setup.png",
        mimeType: "image/png",
        buffer: Buffer.from(image, "base64"),
      });
    await p.locator("#ta-a-asset").fill("EURUSD");
    await p.locator("#ta-a-timeframe").fill("5m");
    await p.locator("#ta-a-rr").fill("1");
    await p
      .getByRole("button", { name: "Analisar com IA", exact: true })
      .click();
    await p.waitForFunction(() => taAnalyst.result?.provider === "OpenAI");
    assert.equal(
      await p.evaluate(() => taAnalyst.result.score.status),
      "not_compliant",
    );
    assert.equal(await p.evaluate(() => taAnalyst.result.score.score), 75);
    assert.equal(
      await p.evaluate(() => taAnalyst.result.scoringContext.plannedRR),
      1,
    );
    assert.equal(calls, 1);
    console.log(
      "PASS UI to authenticated analysis endpoint to mocked multimodal provider to deterministic score",
    );
    await p.evaluate(() => taGo("home"));
    await p
      .getByRole("button", { name: "Gerar insight com IA", exact: true })
      .click();
    await p.waitForFunction(() => taBriefing.result !== null);
    assert.match(
      await p.locator(".ta-generated-insight").innerText(),
      /Confira os critérios/,
    );
    assert.equal(calls, 2);
    console.log(
      "PASS personal AI briefing references original deterministic facts through authenticated endpoint",
    );
    await p.evaluate(() => taGo("settings"));
    await p
      .getByRole("button", { name: "Sair do servidor", exact: true })
      .click();
    await p.waitForFunction(() => !taConnection.authenticated);
    const status = await p.evaluate(async () => {
      try {
        await taApi("/api/economic-calendar?from=2026-10-27&to=2026-10-27");
        return 200;
      } catch (e) {
        return e.status;
      }
    });
    assert.equal(status, 401);
    assert.deepEqual(errors, []);
    console.log("PASS logout revokes data access and no browser errors");
  } finally {
    await b.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
