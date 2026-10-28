const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
  try {
    const p = await b.newPage({ viewport: { width: 1536, height: 1000 } }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.route("**/api/status", (r) =>
      r.fulfill({
        json: {
          authenticated: true,
          authConfigured: true,
          csrf: "fixture",
          services: { ai: true },
        },
      }),
    );
    await p.route("**/api/market-conditions?*", (r) =>
      r.fulfill({ json: { instruments: [] } }),
    );
    await p.route("**/api/economic-calendar?*", (r) =>
      r.fulfill({ json: { events: [] } }),
    );
    let sent,
      invalid = false;
    await p.route("**/api/briefing", (r) => {
      sent = r.request().postDataJSON();
      r.fulfill({
        json: {
          action: "Confira os critérios antes da próxima entrada.",
          facts: [
            {
              id: invalid ? "invented" : "action",
              text: "ignored provider rewrite",
            },
          ],
          asOf: "2026-10-28T12:00:00Z",
        },
      });
    });
    await p.goto("http://127.0.0.1:" + app.server.address().port);
    await p.waitForSelector(".reference-home");
    await p.evaluate(() => {
      S.currency = "USD";
      S.trades = Array.from({ length: 16 }, (_, i) =>
        mk({
          id: "a" + i,
          symbol: "ASSET" + (i % 8),
          strategy: i % 2 ? "Pullback" : "Breakout",
          setup: i % 2 ? "A" : "B",
          open: i === 0 ? "" : "2026-10-26T09:00",
          close: "2026-10-26T10:00",
          pnl: i % 2 ? -10 : 20,
          risk: 10,
        }),
      );
      taGo("ana");
    });
    const snapshot = await p.evaluate(() => JSON.stringify(S));
    const advice = await p.evaluate(() => {
      const base = mk({ id: "loss", close: "2026-10-26T10:00", pnl: -10 });
      return {
        losses: eliteAnalysisCoachModel([
          base,
          { ...base, id: "loss2", close: "2026-10-26T11:00" },
        ]),
        explicit: eliteAnalysisCoachModel([
          { ...base, behavior: { errors: ["early"] } },
        ]),
      };
    });
    assert.match(advice.losses.action, /2 perdas consecutivas/);
    assert.match(advice.losses.attention, /não comprova erro/);
    assert.match(advice.explicit.attention, /Entrada antecipada/);
    assert.match(advice.explicit.action, /critérios de confirmação/);

    assert.equal(await p.locator(".elite-analysis-summary > div").count(), 4);
    assert.equal(await p.locator(".elite-analysis-comparison").count(), 1);
    assert.equal(
      await p
        .locator(".elite-analysis-comparison > .table-wrap tbody tr")
        .count(),
      6,
    );
    assert.equal(
      await p.locator(".elite-analysis-more").evaluate((e) => e.open),
      false,
    );
    assert.equal(
      await p.locator(".elite-analysis-method").evaluate((e) => e.open),
      false,
    );
    assert.match(await p.locator(".elite-analysis-summary").innerText(), /80/);
    assert.match(
      await p.locator(".elite-analysis-summary").innerText(),
      /50.0%/,
    );
    const summary = await p.locator(".elite-analysis-summary").innerText();
    await p.screenshot({
      path: "/tmp/elitex-compact-analysis.png",
      fullPage: true,
    });
    await p.locator(".elite-analysis-more summary").click();
    assert.equal(
      await p.locator(".elite-analysis-comparison tbody tr").count(),
      8,
    );
    await p.getByRole("button", { name: "Horário", exact: true }).click();
    assert.match(
      await p.locator(".elite-analysis-table").innerText(),
      /Entrada não informada/,
    );
    for (const label of [
      "Sessão",
      "Dia da semana",
      "Estratégia",
      "Setup",
      "Ativo",
    ]) {
      await p.getByRole("button", { name: label, exact: true }).click();
      assert.equal(
        await p.locator(".elite-analysis-summary").innerText(),
        summary,
      );
    }
    assert.equal(
      await p.locator(".elite-analysis-coach-grid > section").count(),
      3,
    );
    assert.match(
      await p.locator(".elite-analysis-coach").innerText(),
      /Resumo local calculado/,
    );
    await p
      .getByRole("button", { name: "Resumir com IA", exact: true })
      .click();
    await p.waitForSelector(".elite-analysis-ai");
    assert.equal(
      sent.facts.find((f) => f.id === "performance").text.includes("80.00"),
      true,
    );
    assert.equal(Object.hasOwn(sent, "trades"), false);
    assert.match(
      await p.locator(".elite-analysis-ai").innerText(),
      /Confira os critérios/,
    );
    await p.evaluate(() => {
      F.sym = "ASSET1";
      R();
    });
    assert.equal(await p.locator(".elite-analysis-ai").count(), 0);
    assert.match(
      await p.locator(".elite-analysis-coach").innerText(),
      /Nenhum ativo teve resultado positivo/,
    );
    invalid = true;
    await p
      .getByRole("button", { name: "Resumir com IA", exact: true })
      .click();
    await p.waitForFunction(() => !eliteAnalysisCoach.pending);
    assert.equal(await p.locator(".elite-analysis-ai").count(), 0);
    assert.match(
      await p.locator(".elite-analysis-coach").innerText(),
      /não corresponde aos fatos/,
    );
    await p.evaluate(() => {
      F.sym = "";
      R();
    });
    assert.equal(await p.evaluate(() => JSON.stringify(S)), snapshot);
    for (const width of [320, 390, 760, 1024, 1536, 1920]) {
      await p.setViewportSize({ width, height: 1000 });
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "overflow " + width,
      );
    }
    await p.evaluate(() => {
      F.sym = "MISSING";
      R();
    });
    assert.match(
      await p.locator("#main").innerText(),
      /Sem operações neste período/,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS compact analysis: accurate totals, all six comparisons, missing entry explicit, progressive details, filter empty state, unchanged history, 320–1920px",
    );
  } finally {
    await b.close();
    app.server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
