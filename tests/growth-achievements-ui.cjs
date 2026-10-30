"use strict";
const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
  try {
    const p = await b.newPage({
        viewport: { width: 1280, height: 1000 },
        reducedMotion: "reduce",
        acceptDownloads: true,
      }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.clock.setFixedTime(new Date("2026-10-30T09:00Z"));
    await p.route("**/api/status", (r) =>
      r.fulfill({
        json: { authenticated: false, authConfigured: false, services: {} },
      }),
    );
    await p.goto("http://127.0.0.1:" + app.server.address().port);
    await p.waitForSelector(".smc-home");
    const results = await p.evaluate(() => {
      const results = [],
        ok = (value, label) => {
          if (!value) throw Error(label);
          results.push(label);
        },
        E = GrowthEngine,
        A = growthAdapter();
      const trade = (date, pnl = 10, extra = {}) =>
        mk({
          id: crypto.randomUUID(),
          symbol: "EURUSD",
          open: date + "T08:00",
          close: date + "T10:00",
          pnl,
          risk: 10,
          plannedRR: 2,
          behavior: { plan: true, risk: true, limits: true },
          notes: "Contexto",
          feelings: "Calmo",
          lesson: "Esperar",
          ...extra,
        });
      S.growth = {};
      S.trades = [];
      ok(
        E.allAchievements(S, A).every((a) => !a.earned),
        "empty state awards nothing",
      );
      const m = E.model(S, E.bounds("week", "2026-10-30"), A);
      ok(
        m.r === null && m.percent === null,
        "missing R and balance stay unknown",
      );
      S.trades = [trade("2026-10-26", -10)];
      let single = E.model(S, E.bounds("week", "2026-10-30"), A);
      ok(
        single.stats.n === 1 && single.stats.net === -10 && single.r === -1,
        "single negative trade actual review",
      );
      S.trades.push(trade("2026-10-27", 30));
      let mixed = E.model(S, E.bounds("week", "2026-10-30"), A),
        baseline = st(insUniverse());
      ok(
        mixed.stats.net === baseline.net &&
          mixed.stats.wr === baseline.wr &&
          mixed.stats.dd === baseline.dd &&
          mixed.stats.pf === baseline.pf,
        "review reuses all dashboard metrics",
      );
      S.trades = [trade("2026-08-01"), trade("2026-09-01")];
      ok(E.assess(S, "consistent", A).earned, "two closed profitable months");
      ok(!E.assess(S, "quarterly", A).earned, "quarter needs three months");
      S.trades.push(trade("2026-07-01"));
      ok(
        E.assess(S, "quarterly", A).earned,
        "three consecutive profitable months",
      );
      S.trades = S.trades.filter((t) => !t.close.startsWith("2026-08"));
      ok(!E.assess(S, "consistent", A).earned, "empty month breaks sequence");
      S.trades = [trade("2026-09-01"), trade("2026-10-01")];
      ok(!E.assess(S, "consistent", A).earned, "unfinished month excluded");
      S.trades = [trade("2026-08-01"), trade("2026-09-01", 10, { est: true })];
      ok(
        !E.assess(S, "consistent", A).earned,
        "estimated finance does not qualify",
      );
      S.growth = {
        rules: {
          planDays: 2,
          riskDays: 2,
          journalDays: 2,
          rrTarget: 2,
          minRR: 2,
        },
      };
      S.trades = [trade("2026-10-01"), trade("2026-10-02")];
      for (const id of ["plan", "risk", "journal", "rr"])
        ok(E.assess(S, id, A).earned, id + " requires explicit evidence");
      S.trades[1].behavior = {};
      for (const id of ["plan", "risk", "rr"])
        ok(!E.assess(S, id, A).earned, id + " unknown is not compliance");
      S.trades = [
        trade("2026-10-01"),
        trade("2026-10-02", 10, {
          behavior: { plan: false, risk: false, limits: false },
          notes: "",
        }),
        trade("2026-10-03"),
      ];
      for (const id of ["plan", "risk", "journal"])
        ok(!E.assess(S, id, A).earned, id + " violation resets run");
      S.growth = {};
      S.trades = [];
      for (const month of ["07", "08", "09"])
        for (let i = 1; i <= 5; i++)
          S.trades.push(trade(`2026-${month}-0${i}`));
      ok(
        E.assess(S, "discipline", A).earned,
        "discipline full coverage and sample",
      );
      S.trades[0].behavior.plan = null;
      ok(
        !E.assess(S, "discipline", A).earned,
        "discipline missing coverage blocks",
      );
      const log = (date, i = 0, extra = {}) => ({
        id: crypto.randomUUID(),
        at: date + "T09:00:00Z",
        date,
        timezone: "Europe/London",
        sessionKey: "session-" + date,
        emotion: "fomo",
        ...extra,
      });
      S.trades = [];
      S.growth = {
        rules: {
          emotionalSessions: 3,
          selfControlSessions: 3,
          selectiveDays: 2,
        },
        checkins: [log("2026-10-20"), log("2026-10-20"), log("2026-10-20")],
      };
      ok(!E.assess(S, "awareness", A).earned, "checkin spam not rewarded");
      S.growth.checkins = [
        log("2026-10-20", 0, { decision: "respected_plan" }),
        log("2026-10-21", 0, { decision: "respected_plan" }),
        log("2026-10-22", 0, { decision: "respected_plan" }),
      ];
      ok(E.assess(S, "awareness", A).earned, "distinct sessions awareness");
      ok(E.assess(S, "control", A).earned, "explicit self control decisions");
      delete S.growth.checkins[0].decision;
      ok(!E.assess(S, "control", A).earned, "emotion alone not self control");
      ok(
        !E.assess(S, "selective", A).earned,
        "silence is not selective trading",
      );
      S.growth.decisions = ["20", "21"].map((d) => ({
        date: "2026-10-" + d,
        at: "2026-10-" + d + "T09:00Z",
        kind: "outside_plan",
        planId: "real-plan",
        note: "Faltou contexto",
      }));
      ok(E.assess(S, "selective", A).earned, "documented skipped trades");
      S.growth = { reflections: {} };
      for (const date of [
        "2026-09-28",
        "2026-10-05",
        "2026-10-12",
        "2026-10-19",
      ])
        S.growth.reflections["week:" + date] = {
          answers: ["Calmo", "Esperar", "Validar"],
        };
      ok(E.assess(S, "reflect", A).earned, "four complete reflections");
      S.growth.reflections["week:2026-10-12"].answers[2] = "";
      ok(!E.assess(S, "reflect", A).earned, "skipped reflection breaks streak");
      S.growth = { checkins: [] };
      S.trades = [];
      for (const [week, base] of [
        [0, 12],
        [1, 19],
      ])
        for (let i = 0; i < 5; i++) {
          const date = "2026-10-" + (base + i);
          S.trades.push(
            trade(date, 10, { behavior: { plan: week === 1 || i < 3 } }),
          );
          if (i < 3) S.growth.checkins.push(log(date));
        }
      ok(
        E.assess(S, "mindset", A).earned,
        "measurable adherence improvement with samples",
      );
      S.growth.checkins = [];
      ok(
        !E.assess(S, "mindset", A).earned,
        "mindset insufficient emotional sample",
      );
      S.trades = [trade("2026-08-01"), trade("2026-09-01")];
      S.growth = {};
      const award = E.assess(S, "consistent", A);
      S.growth.certificates = [
        {
          id: "kept",
          ruleVersion: 1,
          achievementId: "consistent",
          range: award.range,
          config: award.config,
          status: "valid",
        },
      ];
      S.trades[0].pnl = -20;
      let rec = E.reconcile(S, A);
      ok(
        rec.certificates[0].status === "invalidated" &&
          rec.certificates[0].id === "kept",
        "correction invalidates but preserves certificate",
      );
      S.growth.certificates = rec.certificates;
      S.trades[0].pnl = 20;
      ok(
        E.reconcile(S, A).certificates[0].status === "valid",
        "restoring evidence restores same certificate",
      );
      S.trades.splice(0, 1);
      ok(
        E.reconcile(S, A).certificates[0].status === "invalidated",
        "deleted evidence invalidates",
      );
      S.growth = {};
      S.trades = [trade("2026-08-01"), trade("2026-09-01")];
      S.balance = 1000;
      S.balanceConfirmed = true;
      taGo("achievements");
      return results;
    });
    console.log("PASS " + results.join("; "));
    await p.getByRole("button", { name: "Financeiras", exact: true }).click();
    await p.locator("#growth-certificate-name").fill("PRIVATE FULL NAME");
    await p.locator("button[data-id=consistent]").click();
    await p.waitForSelector("#growth-certificate-canvas");
    assert.equal(await p.evaluate(() => growthData().certificates.length), 1);
    await p.evaluate(() => growthIssueCertificate("consistent"));
    assert.equal(await p.evaluate(() => growthData().certificates.length), 1);
    for (const format of ["PNG", "PDF"]) {
      const wait = p.waitForEvent("download");
      await p
        .getByRole("button", { name: "Exportar " + format, exact: true })
        .click();
      const file = await wait,
        path = "/tmp/smc-certificate-test." + format.toLowerCase();
      await file.saveAs(path);
      const bytes = await fs.readFile(path);
      if (format === "PNG") {
        assert.equal(bytes.readUInt32BE(16), 2400);
        assert.equal(bytes.readUInt32BE(20), 1697);
      } else {
        assert.equal(bytes.subarray(0, 8).toString(), "%PDF-1.4");
        assert(bytes.includes(Buffer.from("startxref")));
      }
    }
    for (const width of [320, 390, 760, 1280]) {
      await p.setViewportSize({ width, height: 844 });
      assert(
        await p
          .locator("#growth-dialog")
          .evaluate((d) => d.scrollWidth <= d.clientWidth + 1),
        "certificate dialog overflow " + width,
      );
    }
    await p.getByRole("button", { name: "Fechar", exact: true }).click();
    for (const width of [320, 390, 760, 1280]) {
      await p.setViewportSize({ width, height: 844 });
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "achievement overflow " + width,
      );
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await p.screenshot({
      path: "/tmp/smc-achievements-mobile.png",
      fullPage: true,
    });
    await p.evaluate(() => {
      S.trades[0].pnl = -30;
      save();
      R();
    });
    assert.equal(
      await p.evaluate(() => growthData().certificates[0].status),
      "invalidated",
    );
    await p.reload();
    await p.waitForSelector(".smc-home");
    assert.equal(
      await p.evaluate(() => growthData().certificates[0].status),
      "invalidated",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS certificate issuance/deduplication, PNG/PDF files, invalidation history, responsive gallery and persistence",
    );
  } finally {
    await b.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
