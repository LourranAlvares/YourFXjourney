const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  path = require("node:path");
(async () => {
  const b = await chromium.launch({
      executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
    }),
    p = await b.newPage({ viewport: { width: 1440, height: 1100 } }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.clock.setFixedTime(new Date("2026-10-27T08:30:00Z"));
  await p.goto("file://" + path.resolve(__dirname, "../YourFXjourney.html"));
  assert.equal(await p.evaluate(() => tab), "home");
  assert.match(await p.locator("main").innerText(), /Bom dia/);
  assert.match(await p.locator("main").innerText(), /não foi configurada/);
  assert.equal(await p.evaluate(() => S.trades.length), 0);
  console.log(
    "PASS new home opens by default without invented user, session or trades",
  );
  await p.evaluate(() => {
    S.trades = [
      mk({
        id: "old",
        symbol: "EURUSD",
        close: "2026-10-26T10:00",
        pnl: 50,
        risk: 25,
        notes: "Histórico original",
      }),
    ];
    S.reviews = { week: "Lição histórica" };
    S.strats = [{ name: "Estratégia antiga" }];
    save();
    taGo("settings");
  });
  await p.locator("#ta-name").fill("Lohan");
  await p.locator("#ta-zone").fill("Europe/London");
  await p
    .getByRole("button", { name: "Selecionar EURUSD", exact: true })
    .click();
  await p
    .getByRole("button", { name: "Selecionar GBPUSD", exact: true })
    .click();
  await p.locator("#ta-session-enabled").check();
  await p.getByRole("button", { name: "Salvar rotina", exact: true }).click();
  assert.match(
    await p.locator(".ta-home-heading").innerText(),
    /Bom dia, Lohan/,
  );
  assert.match(await p.locator(".ta-session-card").innerText(), /Ativa/);
  assert.equal(await p.evaluate(() => S.trades[0].notes), "Histórico original");
  console.log(
    "PASS profile/session preferences personalize briefing and preserve legacy records",
  );
  await p.evaluate(() => taGo("plan"));
  await p.locator("#tp-name").fill("Plano institucional");
  await p.locator("#tp-instruments").fill("EURUSD");
  await p.locator("#tp-timeframes").fill("5m, 1h");
  await p
    .locator("#tp-structure")
    .fill("BOS exige fechamento além do swing documentado.");
  await p.locator("#tp-risk-minRR").fill("2");
  await p.locator('[data-cfield="label"]').fill("Confirmação BOS");
  await p
    .locator('[data-cfield="definition"]')
    .fill("Fechamento acima do swing marcado na imagem.");
  await p.locator('[data-cfield="weight"]').fill("3");
  await p.getByRole("button", { name: "+ Critério", exact: true }).click();
  const row = p.locator(".ta-criterion").nth(1);
  await row.locator('[data-cfield="label"]').fill("R:R mínimo");
  await row
    .locator('[data-cfield="definition"]')
    .fill("Alvo de pelo menos duas vezes a distância até o stop.");
  await row.locator('[data-cfield="kind"]').selectOption("minRR");
  await p.getByRole("button", { name: "Salvar nova versão do plano" }).click();
  assert.equal(await p.evaluate(() => S.tradingPlans.length), 1);
  assert.equal(await p.evaluate(() => taCurrentPlan().version), 1);
  console.log(
    "PASS structured plan with custom definitions and weighted criteria saves a version",
  );
  await p.evaluate(() => taGo("analyst"));
  await p.locator("#ta-a-asset").fill("EURUSD");
  await p.locator("#ta-a-timeframe").fill("5m");
  await p.locator("#ta-a-rr").fill("3");
  await p
    .getByRole("button", { name: "Revisar manualmente", exact: true })
    .click();
  assert.match(await p.locator(".ta-analysis-result").innerText(), /25%/);
  assert.match(
    await p.locator(".ta-analysis-result").innerText(),
    /Precisa de verificação/,
  );
  assert.equal(await p.locator(".ta-assessment details").count(), 1);
  await p.locator(".ta-assessment details summary").click();
  await p.locator(".ta-assessment details select").selectOption("met");
  await p
    .locator(".ta-assessment details textarea")
    .fill("Trader confirmou fechamento acima do swing conforme anotação.");
  await p.getByRole("button", { name: "Salvar correção", exact: true }).click();
  assert.match(await p.locator(".ta-analysis-result").innerText(), /100%/);
  assert.equal(
    await p.evaluate(() => S.setupAnalyses[0].analysis.assessments[0].status),
    "not_verifiable",
  );
  assert.equal(
    await p.evaluate(() => S.setupAnalyses[0].corrections.length),
    1,
  );
  console.log(
    "PASS manual review is explicitly non-AI; weighted corrections preserve original evidence",
  );
  await p.evaluate(() => taGo("plan"));
  await p
    .locator("#tp-structure")
    .fill("Nova definição de BOS, somente na próxima versão.");
  await p.getByRole("button", { name: "Salvar nova versão do plano" }).click();
  assert.equal(await p.evaluate(() => S.tradingPlans.length), 2);
  assert.equal(
    await p.evaluate(() => S.setupAnalyses[0].planSnapshot.version),
    1,
  );
  assert.notEqual(
    await p.evaluate(() => S.tradingPlans[1].structure),
    await p.evaluate(() => S.setupAnalyses[0].planSnapshot.structure),
  );
  console.log("PASS plan changes do not rewrite historical setup analysis");
  // Exercise a delayed API response while the user changes current plan/context.
  await p.evaluate(() => {
    taGo("analyst");
    taAnalyst.image = "data:image/png;base64,aGVsbG8=";
    taAnalyst.context = {
      asset: "EURUSD",
      timeframe: "5m",
      bias: "long",
      macroContext: "",
      entryRegion: "",
      plannedRR: 3,
      plannedRisk: null,
    };
    R();
    globalThis.originalApi = taApi;
    globalThis.apiResolve = null;
    taApi = () => new Promise((resolve) => (apiResolve = resolve));
    globalThis.pendingAnalysis = taRunAnalysis();
  });
  await p.evaluate(() => {
    const plan = JSON.parse(JSON.stringify(taCurrentPlan()));
    plan.version = 3;
    plan.name = "Plano novo durante requisição";
    S.tradingPlans.push(plan);
    taAnalyst.context.asset = "GBPUSD";
    apiResolve({
      provider: "openai",
      model: "mock-vision",
      asOf: "2026-10-27T08:30:00Z",
      scoringContext: { plannedRR: 3 },
      analysis: {
        summary: "Fixture de integração, não chamada real.",
        assessments: taAnalyst.result.planSnapshot.criteria.map((c) => ({
          criterionId: c.id,
          status: "met",
          evidence: "Evidência de teste",
          reason: "teste",
          source: "ai",
        })),
      },
    });
  });
  await p.evaluate(() => pendingAnalysis);
  assert.equal(
    await p.evaluate(() => S.setupAnalyses.at(-1).planSnapshot.version),
    2,
  );
  assert.equal(
    await p.evaluate(() => S.setupAnalyses.at(-1).context.asset),
    "EURUSD",
  );
  await p.evaluate(() => (taApi = originalApi));
  console.log(
    "PASS async analysis keeps exact requested plan/context rather than later edits",
  );
  await p.evaluate(() => {
    taAnalyst.image = 'x\" onerror=\"window.__badBackup=1';
    taAnalyst.result = JSON.parse(JSON.stringify(S.setupAnalyses[0]));
    taAnalyst.result.planSnapshot.version =
      "<img src=x onerror=window.__badBackup=2>";
    taAnalyst.result.currentScore.status =
      "<img src=x onerror=window.__badBackup=3>";
    taAnalyst.result.planSnapshot.criteria[0].weight =
      "<img src=x onerror=window.__badBackup=4>";
    taGo("analyst");
  });
  await p.waitForTimeout(50);
  assert.equal(await p.evaluate(() => window.__badBackup), undefined);
  assert.equal(await p.locator(".ta-image-upload img").count(), 0);
  console.log(
    "PASS restored analyst image and metadata cannot inject HTML or event handlers",
  );
  await p.reload();
  assert.equal(await p.evaluate(() => S.trades[0].pnl), 50);
  assert.equal(await p.evaluate(() => S.tradingPlans.length), 3);
  assert.equal(await p.evaluate(() => S.setupAnalyses.length), 2);
  for (const route of [
    "home",
    "analyst",
    "plan",
    "settings",
    "economic",
    "dash",
    "cal",
    "trades",
    "ana",
    "pat",
    "risk",
    "rev",
    "str",
    "ins",
    "share",
  ]) {
    await p.evaluate((tab) => taGo(tab), route);
    assert.ok((await p.locator("main").innerText()).length > 60);
    for (const width of [1440, 768, 390, 320]) {
      await p.setViewportSize({ width, height: 1100 });
      await p.waitForTimeout(160);
      const sizes = await p.evaluate(() => [
        document.documentElement.scrollWidth,
        innerWidth,
      ]);
      assert.ok(
        sizes[0] <= sizes[1],
        `${route} overflow at ${width}: ${sizes}`,
      );
    }
  }
  await p.setViewportSize({ width: 1440, height: 1100 });
  await p.evaluate(() => {
    taGo("home");
    scrollTo(0, 0);
  });
  await p.waitForTimeout(180);
  await p.screenshot({
    path: "/tmp/trade-assistant-home-desktop.png",
    fullPage: true,
  });
  await p.setViewportSize({ width: 390, height: 1000 });
  await p.waitForTimeout(180);
  await p.screenshot({
    path: "/tmp/trade-assistant-home-mobile.png",
    fullPage: true,
  });
  console.log(
    "PASS all 15 routes render at 320–1440px with no page overflow and legacy data intact",
  );
  assert.deepEqual(errors, []);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
