const assert = require("node:assert/strict"),
  { chromium } = require("playwright"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
  try {
    const p = await b.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("http://127.0.0.1:" + app.server.address().port);
    await p.waitForSelector(".smc-home");
    await p.evaluate(() => {
      taGo("trades");
      edit(null);
    });
    await p
      .locator("#shot-file")
      .setInputFiles({
        name: "broken.png",
        mimeType: "image/png",
        buffer: Buffer.from("invalid image"),
      });
    await p.waitForFunction(() =>
      document
        .querySelector("#shot-status")
        .textContent.includes("Nenhum print foi anexado"),
    );
    assert.equal(await p.evaluate(() => cur.img.length), 0);
    await p.evaluate(() => {
      window.Tesseract = {
        createWorker: async () => {
          throw Error("OCR indisponível");
        },
      };
    });
    await p.locator("#shot-file").setInputFiles("public/smc-logo.png");
    await p.waitForFunction(() =>
      document
        .querySelector("#shot-status")
        .textContent.includes("permanece anexado"),
    );
    await p.evaluate(() => saveT());
    assert.equal(await p.evaluate(() => S.tradeDrafts.at(-1).img.length), 1);
    assert.equal(await p.evaluate(() => S.trades.length), 0);
    await p.evaluate(() => {
      edit(null);
      window.Tesseract = {
        createWorker: async () => ({
          recognize: async () => ({ data: { text: "EURUSD", confidence: 95 } }),
        }),
      };
    });
    await p.locator("#shot-file").setInputFiles("public/smc-logo.png");
    await p.waitForFunction(() =>
      document
        .querySelector("#shot-status")
        .textContent.match(/^Leitura (concluída|parcial)/),
    );
    await p.evaluate(() => saveT());
    assert.equal(await p.evaluate(() => S.tradeDrafts.length), 2);
    await p.evaluate(() => {
      edit(null);
      window.__finishOCR = null;
      shotWorker = Promise.resolve({
        recognize: () => new Promise((r) => (window.__finishOCR = r)),
      });
    });
    await p.locator("#shot-file").setInputFiles("public/smc-logo.png");
    await p.waitForFunction(() => typeof window.__finishOCR === "function");
    await p.evaluate(() => saveT());
    await p.evaluate(() => {
      edit(null);
      document.getElementById("f_symbol").value = "GBPUSD";
      window.__finishOCR({ data: { text: "EURUSD", confidence: 99 } });
    });
    assert.equal(await p.locator("#f_symbol").inputValue(), "GBPUSD");
    assert.equal(await p.evaluate(() => cur.img.length), 0);
    assert.equal(await p.evaluate(() => S.tradeDrafts.length), 3);
    await p.evaluate(() => {
      document.getElementById("dlg").close();
      edit(null);
      shotWorker = Promise.resolve({
        recognize: () => new Promise(() => {}),
        terminate: async () => {},
      });
    });
    await p.clock.install();
    await p.locator("#shot-file").setInputFiles("public/smc-logo.png");
    await p.waitForFunction(() =>
      document
        .getElementById("shot-results")
        .textContent.includes("Print aberto"),
    );
    await p.clock.fastForward(61000);
    await p.waitForFunction(() =>
      document
        .querySelector("#shot-status")
        .textContent.includes("demorou demais"),
    );
    await p.evaluate(() => saveT());
    assert.equal(await p.evaluate(() => S.tradeDrafts.at(-1).img.length), 1);
    assert.deepEqual(errors, []);
    console.log(
      "PASS invalid image, failed OCR with saved print, retry after failure, immediate save and late OCR cannot change a different record, timed-out OCR keeps a saveable print",
    );
  } finally {
    await b.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
