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
    await p.evaluate(() => {
      S.currency = "USD";
      S.balance = 1000;
      S.balanceConfirmed = true;
      S.assistantProfile = { ...taProfile(), name: "PRIVATE NAME" };
      taGo("dash");
    });
    await p.getByRole("button", { name: "Weekly Review", exact: true }).click();
    await p.waitForFunction(() => growthUI.review?.playing);
    await p.evaluate(() => growthReviewPlay());
    assert.equal(
      await p.locator("#growth-story").getAttribute("width"),
      "1080",
    );
    assert.equal(await p.evaluate(() => growthUI.review.m.stats.n), 0);
    await p.getByRole("button", { name: "Fechar", exact: true }).click();
    await p.evaluate(() => {
      S.trades = [
        mk({
          id: "r1",
          symbol: "EURUSD",
          close: "2026-10-26T10:00",
          pnl: 100,
          risk: 50,
          behavior: { plan: true, risk: true },
        }),
        mk({
          id: "r2",
          symbol: "GBPUSD",
          close: "2026-10-27T10:00",
          pnl: -50,
          realizedR: -1,
        }),
        mk({ id: "r3", symbol: "XAUUSD", close: "2026-10-28T10:00", pnl: 20 }),
      ];
      R();
    });
    await p.getByRole("button", { name: "Weekly Review", exact: true }).click();
    await p.waitForFunction(() => growthUI.review?.playing);
    await p.evaluate(() => growthReviewPlay());
    assert.equal(await p.evaluate(() => growthUI.review.m.stats.net), 70);
    assert.equal(await p.evaluate(() => growthUI.review.m.r), 1);
    assert.equal(await p.evaluate(() => growthUI.review.m.rComplete), false);
    assert(
      !(await p.evaluate(() =>
        growthSceneContent(growthUI.review.m, 4, growthUI.review)
          .lines.join(" ")
          .includes("$"),
      )),
    );
    assert(
      !(await p.evaluate(() =>
        growthSceneContent(growthUI.review.m, 0, growthUI.review)
          .lines.join(" ")
          .includes("PRIVATE"),
      )),
    );
    await p.locator(".growth-review-controls details summary").click();
    let wait = p.waitForEvent("download");
    await p
      .getByRole("button", { name: "PNG da tela final", exact: true })
      .click();
    let download = await wait;
    await download.saveAs("/tmp/smc-review-final-test.png");
    const png = await fs.readFile("/tmp/smc-review-final-test.png");
    assert.equal(png.readUInt32BE(16), 1080);
    assert.equal(png.readUInt32BE(20), 1920);
    await p
      .getByRole("button", {
        name: "Refletir · análise por regras",
        exact: true,
      })
      .click();
    for (const answer of [
      "Oscilei",
      "Esperar meu contexto",
      "Conferir os critérios",
    ]) {
      await p.locator("#growth-reflection-answer").fill(answer);
      await p.locator("#growth-reflection-form button[type=submit]").click();
    }
    assert.match(
      await p.locator("#growth-dialog").innerText(),
      /Sua prioridade: Conferir os critérios/,
    );
    await p.getByRole("button", { name: "Fechar", exact: true }).last().click();
    assert.equal(
      await p.evaluate(
        () => growthData().reflections["week:2026-10-26"].answers.length,
      ),
      3,
    );
    if (await p.evaluate(() => !!growthVideoMime())) {
      await p.evaluate(() => {
        growthUI.review.duration = 0.16;
      });
      wait = p.waitForEvent("download", { timeout: 30000 });
      await p.locator("#growth-video").click();
      download = await wait;
      const videoPath =
        "/tmp/smc-review-test." +
        (download.suggestedFilename().endsWith(".mp4") ? "mp4" : "webm");
      await download.saveAs(videoPath);
      assert((await fs.stat(videoPath)).size > 5000);
      await p.route("**/public/growth-video-test", async (route) =>
        route.fulfill({
          body: await fs.readFile(videoPath),
          contentType: videoPath.endsWith(".mp4") ? "video/mp4" : "video/webm",
        }),
      );
      const dimensions = await p.evaluate(async () => {
        const video = document.createElement("video");
        video.muted = true;
        video.src = "/public/growth-video-test";
        await new Promise((resolve, reject) => {
          video.onloadedmetadata = resolve;
          video.onerror = () => reject(Error("video decode failed"));
        });
        return [video.videoWidth, video.videoHeight];
      });
      assert.deepEqual(dimensions, [1080, 1920]);
      await p.evaluate(() => {
        growthUI.review.duration = 5;
        growthExportReviewVideo();
      });
      await p.waitForFunction(() => growthUI.review?.busy);
      await p.locator("#growth-video-cancel").click();
      await p.waitForFunction(() => !growthUI.review?.busy);
    }
    for (const width of [320, 390, 760, 1280]) {
      await p.setViewportSize({ width, height: 844 });
      assert(
        await p
          .locator("#growth-review-dialog")
          .evaluate((d) => d.scrollWidth <= d.clientWidth + 1),
        "review overflow " + width,
      );
    }
    await p.getByRole("button", { name: "Fechar", exact: true }).click();
    await p.evaluate(async () => {
      window.MediaRecorder = undefined;
      await growthOpenReview("month");
    });
    assert.equal(await p.locator("#growth-video").count(), 0);
    await p.locator(".growth-review-controls details summary").click();
    assert.match(
      await p.locator("#growth-review-dialog").innerText(),
      /PNG está disponível/,
    );
    await p.evaluate(() => growthStartReflection(false));
    await p
      .getByRole("button", { name: "Skip for now", exact: true })
      .last()
      .click();
    assert.equal(
      await p.evaluate(() => Object.keys(growthData().reflections).length),
      1,
    );
    await p.getByRole("button", { name: "Fechar", exact: true }).click();
    await p.reload();
    await p.waitForSelector(".smc-home");
    assert.equal(
      await p.evaluate(
        () => growthData().reflections["week:2026-10-26"].answers[2],
      ),
      "Conferir os critérios",
    );
    await p.goto(
      "http://127.0.0.1:" +
        app.server.address().port +
        "/YourFXjourney-standalone.html",
    );
    await p.waitForSelector(".smc-home");
    await p.evaluate(() => taGo("dash"));
    await p.getByRole("button", { name: "Weekly Review", exact: true }).click();
    assert.equal(
      await p.locator("#growth-story").getAttribute("height"),
      "1920",
    );
    assert.equal(
      await p.evaluate(() => typeof GrowthEngine.assess),
      "function",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS real review metrics/R coverage, empty period, privacy, PNG dimensions, playable video/cancel, reflections and persistence at mobile/desktop widths",
    );
  } finally {
    await b.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
