"use strict";
const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
  try {
    const p = await b.newPage({
        viewport: { width: 1536, height: 900 },
        reducedMotion: "reduce",
      }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.clock.setFixedTime(new Date("2026-10-30T09:00Z"));
    await p.route("**/api/**", (r) =>
      r.fulfill({
        status: 503,
        json: {
          error: {
            code: "service_unavailable",
            message: "Serviço não configurado no teste.",
          },
        },
      }),
    );
    await p.route("**/api/status", (r) =>
      r.fulfill({
        json: { authenticated: true, authConfigured: true, services: {} },
      }),
    );
    const base = "http://127.0.0.1:" + app.server.address().port;
    await p.goto(base);
    await p.waitForSelector(".smc-home");
    await p.waitForFunction(() => taConnection.authenticated);
    assert.equal(
      await p.locator(".terminal-connection-label").innerText(),
      "Conectado",
    );
    const icon = await p
      .getByRole("button", { name: "Alternar contraste", exact: true })
      .locator("svg path")
      .getAttribute("d");
    await p
      .getByRole("button", { name: "Alternar contraste", exact: true })
      .click();
    assert.notEqual(
      await p
        .getByRole("button", { name: "Alternar contraste", exact: true })
        .locator("svg path")
        .getAttribute("d"),
      icon,
    );
    await p
      .getByRole("button", { name: "Alternar contraste", exact: true })
      .click();
    await p.evaluate(() => {
      S.trades = Array.from({ length: 6 }, (_, i) =>
        mk({
          id: "density" + i,
          symbol: "EURUSD",
          close: "2026-10-" + (20 + i) + "T10:00",
          pnl: -10,
          risk: 10,
          notes: "Contexto registrado. ".repeat(15),
          feelings: "Calmo",
          lesson: "Esperar o setup",
        }),
      );
      R();
    });
    assert.equal(
      await p.locator(".elite-alert-count").count(),
      0,
      "losses alone must not create a behavioral alert",
    );
    await p.evaluate(() => {
      S.trades.forEach(
        (t) =>
          (t.behavior = {
            plan: true,
            risk: true,
            limits: true,
            errors: ["overtrade"],
          }),
      );
      R();
    });
    assert.equal(await p.locator(".elite-alert-count").innerText(), "1");
    await p
      .getByRole("button", { name: "Ver pontos de atenção", exact: true })
      .click();
    assert.match(
      await p.locator("#elite-alerts-dialog").innerText(),
      /Excesso de operações.*6 de 6/s,
    );
    await p
      .getByRole("button", { name: "Marcar como lido", exact: true })
      .click();
    assert.equal(await p.locator(".elite-alert-count").count(), 0);
    await p.getByRole("button", { name: "Fechar", exact: true }).click();
    await p.reload();
    await p.waitForSelector(".smc-home");
    assert.equal(await p.locator(".elite-alert-count").count(), 0);
    await p.evaluate(() => {
      S.trades.push(mk({ ...S.trades[0], id: "new-evidence" }));
      R();
    });
    assert.equal(await p.locator(".elite-alert-count").innerText(), "1");
    for (const [width, height] of [
      [1280, 800],
      [1536, 900],
      [1920, 1080],
      [390, 844],
    ]) {
      await p.setViewportSize({ width, height });
      await p.evaluate(() => {
        diaryMonth = "2026-10";
        taGo("trades");
      });
      await p.evaluate(
        () =>
          new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          ),
      );
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "diary width " + width,
      );
      const sizes = await p.evaluate(() => ({
        header: document.querySelector(".diary-heading").getBoundingClientRect()
          .height,
        calendar: document
          .querySelector(".diary-records-panel")
          .getBoundingClientRect().top,
        gallery: document
          .querySelector(".diary-records-panel")
          .getBoundingClientRect().top,
      }));
      if (width >= 1100) {
        assert(
          sizes.header <= 240,
          "oversized diary intro " + width + " " + sizes.header,
        );
        assert(
          Math.abs(sizes.calendar - sizes.gallery) < 2,
          "calendar/gallery not aligned",
        );
        assert(
          sizes.calendar < height * 0.62,
          "content too far below fold " + width,
        );
      }
      if (width === 1536)
        await p.screenshot({
          path: "/tmp/smc-diary-compact.png",
          fullPage: false,
        });
      await p.evaluate(() => taGo("home"));
      if (width >= 761) {
        const bottom = await p
          .locator(".reference-workspace-actions")
          .evaluate((n) => n.getBoundingClientRect().bottom);
        assert(
          bottom > 350 && bottom < height + 150,
          "home does not fill viewport " + width + " " + bottom,
        );
      }
      if (width === 1920)
        await p.screenshot({
          path: "/tmp/smc-home-balanced.png",
          fullPage: true,
        });
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS compact diary/calendar/gallery above fold, balanced home height, simple connection label, brightness icons, evidence-based alerts and read-state persistence",
    );
  } finally {
    await b.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
