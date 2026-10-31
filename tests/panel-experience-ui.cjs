"use strict";
const assert = require("node:assert/strict"),
  { chromium } = require("playwright"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
  try {
    const p = await b.newPage({
        viewport: { width: 1536, height: 1000 },
        reducedMotion: "reduce",
      }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.clock.setFixedTime(new Date("2026-10-31T12:00Z"));
    await p.route("**/api/status", (r) =>
      r.fulfill({
        json: { authenticated: false, authConfigured: false, services: {} },
      }),
    );
    const base = "http://127.0.0.1:" + app.server.address().port;
    await p.goto(base);
    await p.waitForSelector(".smc-home");
    await p.evaluate(() => {
      S.currency = "USD";
      S.balance = 1000;
      S.balanceConfirmed = true;
      S.trades = Array.from({ length: 24 }, (_, i) =>
        mk({
          id: "p" + i,
          symbol: i % 2 ? "EURUSD" : "XAUUSD",
          side: i % 2 ? "long" : "short",
          open: "2026-10-" + String(i + 1).padStart(2, "0") + "T08:00",
          close: "2026-10-" + String(i + 1).padStart(2, "0") + "T10:00",
          pnl: i % 3 ? 20 : -10,
          risk: i % 4 ? 10 : null,
          notes: "Critério e contexto efetivamente registrados",
          feelings: "Calmo",
          plannedRR: 2,
          behavior: { plan: true, risk: true, limits: true },
        }),
      );
      S.assistantProfile = {
        ...taProfile(),
        name: "Trader",
        instruments: ["EURUSD", "XAUUSD", "BTCUSD", "USOUSD"],
      };
      persistState(S);
      R();
    });
    assert.equal(
      await p.locator(".reference-left .reference-assets").count(),
      0,
    );
    assert.equal(
      await p
        .locator(".reference-right>.scene-card")
        .evaluateAll((ns) =>
          ns.map((n) =>
            n.classList.contains("reference-briefing")
              ? "briefing"
              : n.classList.contains("reference-assets")
                ? "assets"
                : "events",
          ),
        )
        .then(JSON.stringify),
      JSON.stringify(["briefing", "assets", "events"]),
    );
    assert.match(
      await p.locator(".smc-assets-card").innerText(),
      /Indisponível/,
    );
    assert.equal(await p.locator(".experience-speech").count(), 1);
    assert.equal(await p.locator(".home-summary-grid button").count(), 4);
    assert.equal(await p.locator(".home-tool-grid button").count(), 4);
    await p.evaluate(() => {
      const request = taDailyRequestState("market");
      request.data = {
        instruments: [
          {
            symbol: "EUR/USD",
            dayChangePercent: 1.25,
            dayChangeDate: "2026-10-30",
            dayChangeAsOf: "2026-10-30T20:00:00Z",
            dayChangeMethod: "Fechamento horário UTC",
            volatility: "moderate",
          },
        ],
      };
      taDailyState.requests.set(taDailyKey("market", taDailyDate()), request);
      R();
    });
    assert.match(await p.locator(".smc-assets-card").innerText(), /\+1,25%/);
    assert.match(
      await p.locator(".smc-assets-card").innerText(),
      /Último dia · 30\/10/,
    );
    assert.match(await p.locator(".smc-assets-card").innerText(), /20:00 UTC/);

    const aligned=await p.locator('.smc-assets-card article').evaluateAll(ns=>ns.map(n=>({symbol:n.querySelector('.smc-asset-symbol').getBoundingClientRect().left,quote:n.querySelector('.smc-asset-daily').getBoundingClientRect().right,badge:n.lastElementChild.getBoundingClientRect().left})));
    for(const key of ['symbol','quote','badge'])assert(Math.max(...aligned.map(r=>r[key]))-Math.min(...aligned.map(r=>r[key]))<1,'asset column '+key);
    const columns=await p.evaluate(()=>{const a=document.querySelector('.smc-home-left').getBoundingClientRect(),b=document.querySelector('.smc-home .reference-right').getBoundingClientRect();return {a:a.bottom,b:b.bottom,height:innerHeight}});
    assert(Math.abs(columns.a-columns.b)<2,'equal home column bottoms');
    assert(columns.a>=columns.height-40,'use desktop viewport height');
    await p.screenshot({ path: "/tmp/smc-new-home.png", fullPage: true });
    const before = await p.evaluate(() => JSON.stringify(S));
    await p.evaluate(() => taGo("dash"));
    assert.equal(await p.locator("[role=tab]").count(), 4);
    for (const mode of ["pnl", "balance", "daily", "dd", "r"]) {
      await p.evaluate((mode) => {
        chartMode = mode;
        R();
      }, mode);
      assert.equal(
        await p.locator("[data-terminal-chart=performance] svg").count(),
        1,
      );
    }
    let geometry = await p.evaluate(() => {
      const m = terminalCharts.get("performance");
      return { width: m.plotWidth, height: m.height };
    });
    assert(Math.abs(geometry.width / geometry.height - 1.8) < 0.02);
    await p.locator(".panel-info").first().click();
    assert.match(await p.locator("#growth-dialog").innerText(), /líquido/);
    await p.locator("#growth-dialog").evaluate((d) => d.close());
    await p.locator("#panel-tab-overview").focus();
    await p.keyboard.press("ArrowRight");
    assert.equal(
      await p.locator("#panel-tab-performance").getAttribute("aria-selected"),
      "true",
    );
    await p.evaluate(() => panelSwitch("capital"));
    assert.match(
      await p.locator("#panel-content").innerText(),
      /Saldo realizado/,
    );
    await p
      .locator("details")
      .filter({
        has: p.locator("summary", { hasText: "Depósitos e retiradas" }),
      })
      .locator("summary")
      .click();
    await p.locator("input[name=at]").fill("2026-10-15T12:00");
    await p.locator("input[name=amount]").fill("500");
    await p
      .getByRole("button", { name: "Registrar movimento", exact: true })
      .click();
    assert.equal(await p.evaluate(() => S.capitalMovements.length), 1);
    assert.equal(await p.evaluate(() => panelModel().s.net), 240);
    assert.equal(await p.evaluate(() => panelModel().cap.balance), 1740);
    await p.reload();
    await p.waitForSelector(".smc-home");
    assert.equal(await p.evaluate(() => S.capitalMovements.length), 1);
    for (const width of [320, 390, 760, 1280, 1536, 1920]) {
      await p.setViewportSize({ width, height: 1000 });
      for (const target of ["home", "dash", "trades"]) {
        await p.evaluate((target) => taGo(target), target);
        assert(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          target + " overflow " + width,
        );
      }
      assert.equal(await p.locator(".diary-calendar").count(), 0);
      assert.equal(await p.locator(".diary-entry").count(), 12);
      const heights = await p
        .locator(".diary-entry")
        .evaluateAll((ns) => ns.map((n) => n.getBoundingClientRect().height));
      assert(
        Math.max(...heights) - Math.min(...heights) < 2,
        "equal journal card heights " + width,
      );
      const rects = await p.locator(".diary-entry-actions").evaluateAll((ns) =>
        ns.map((n) =>
          Array.from(n.querySelectorAll("button")).map((b) => {
            const r = b.getBoundingClientRect();
            return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
          }),
        ),
      );
      for (const [a, c] of rects) {
        assert(
          a.right <= c.x + 1 ||
            c.right <= a.x + 1 ||
            a.bottom <= c.y + 1 ||
            c.bottom <= a.y + 1,
          "actions overlap " + width,
        );
      }
      if (width === 1536)
        await p.screenshot({ path: "/tmp/smc-new-diary.png", fullPage: true });
    }
    await p.getByRole("button", { name: "Próximos", exact: true }).click();
    assert.equal(await p.locator(".diary-entry").count(), 12);
    assert.match(await p.locator(".diary-pagination").innerText(), /13–24/);
    await p
      .locator(".diary-entry-actions button")
      .filter({ hasText: "Destacar na revisão" })
      .first()
      .click();
    assert.equal(
      await p.evaluate(() => S.trades.filter((t) => t.growthFeatured).length),
      1,
    );
    await p.evaluate(() => taGo("dash"));
    await p.setViewportSize({ width: 1536, height: 1000 });
    await p.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
    const borders = [];
    for (const selector of [
      ".panel-primary .k",
      ".terminal-performance",
      ".panel-overview-bottom .card",
    ]) {
      const loc = p.locator(selector).first();
      await loc.hover();
      const border = await p.waitForFunction((selector) => {
        const n = document.querySelector(selector);
        return (
          n &&
          n.matches(":hover") &&
          getComputedStyle(n).borderColor.includes("210") && getComputedStyle(n).borderColor
        );
      }, selector);
      borders.push(await border.jsonValue());
    }
    assert.equal(
      new Set(borders).size,
      1,
      "consistent hover: " + borders.join(","),
    );
    await p.evaluate(() => taGo("home"));
    await p.getByRole("button", { name: /Origem da observação/ }).click();
    assert.match(
      await p.locator("#growth-dialog").innerText(),
      /Regras determinísticas|Regras determinísticas/i,
    );
    await p.locator("#growth-dialog").evaluate((d) => d.close());
    await p
      .getByRole("button", { name: "Preferências de personalização" })
      .click();
    await p.locator("input[name=history]").uncheck();
    await p.getByRole("button", { name: "Salvar preferências" }).click();
    assert.equal(
      await p.evaluate(() => S.assistantExperience.preferences.history),
      false,
    );
    await p.evaluate(() => taGo("home"));
    assert(
      !["breach", "loss", "win", "improving"].includes(
        await p.locator(".experience-speech").getAttribute("data-message"),
      ),
    );
    await p.goto(base + "/account");
    assert.match(
      await p.locator("h1").innerText(),
      /O mercado revela oportunidades/,
    );
    assert(await p.locator("#account-form").isVisible());
    assert.deepEqual(errors, []);
    console.log(
      "PASS integrated panel/home/diary: four tabs, chart modes/ratio, capital persistence, 320–1920px, pagination, non-overlapping actions, uniform hover, evidence/preferences, login preserved",
    );
  } finally {
    await b.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
