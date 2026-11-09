const assert = require("node:assert/strict"),
  { chromium } = require("playwright"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
  try {
    const p = await b.newPage(),
      errors = [],
      external = [];
    p.on("pageerror", (e) => errors.push(e.message));
    const base = "http://127.0.0.1:" + app.server.address().port;
    p.on("request", (r) => {
      if (/^https?:/.test(r.url()) && !r.url().startsWith(base + "/"))
        external.push(r.url());
    });
    await p.goto(base);
    await p.waitForSelector(".smc-home");
    const parsed = await p.evaluate(() =>
      parseTradingShot(
        "eur / usd\nEntry price 1.1000\nStop loss 1.1100\nTake profit 1.0800\nRisk amount 25",
      ),
    );
    assert.equal(parsed.fields.symbol, "EURUSD");
    assert.equal(parsed.fields.side, "short");
    assert.equal(parsed.fields.risk, 25);
    assert.equal(parsed.fields.plannedRR, 2);
    const inline = await p.evaluate(() =>
      parseTradingShot(
        "Gold Spot / U.S. Dollar\nEntry price: 2735.50 Stop loss: 2725.50 Target price: 2755.50",
      ),
    );
    assert.equal(inline.fields.symbol, "XAUUSD");
    assert.equal(inline.fields.entry, 2735.5);
    assert.equal(inline.fields.target, 2755.5);
    assert.equal(
      (
        await p.evaluate(() =>
          parseTradingShot(
            "EURUSD\nStop: 0.00400 (1%) Amount: 900\nTarget: 0.00300 (2%) Amount: 1000\nOpen P&L: 90",
          ),
        )
      ).fields.pnl,
      undefined,
    );
    for (const dark of [true, false]) {
      const image = await p.evaluate((dark) => {
        const c = document.createElement("canvas");
        c.width = 1500;
        c.height = 900;
        const x = c.getContext("2d");
        x.fillStyle = dark ? "#141820" : "#ececec";
        x.fillRect(0, 0, 1500, 900);
        x.fillStyle = dark ? "#eee" : "#111";
        x.font = "20px Arial";
        x.fillText("Canadian Dollar / Japanese Yen", 28, 40);
        x.font = "14px Arial";
        x.fillText("TradingView", 28, 65);
        x.fillStyle = dark ? "#653c42" : "#b99a9a";
        x.fillRect(820, 168, 90, 82);
        x.fillStyle = dark ? "#315a50" : "#9accc1";
        x.fillRect(820, 250, 90, 240);
        x.fillStyle = "#202631";
        x.fillRect(1300, 0, 200, 900);
        const tag = (y, color, text) => {
          x.fillStyle = color;
          x.fillRect(1180, y, 92, 26);
          x.fillStyle = "#fff";
          x.font = "bold 18px Arial";
          x.fillText(text, 1184, y + 20);
        };
        tag(155, "#ff3451", "112.424");
        tag(242, "#808080", "112.315");
        tag(477, "#009e83", "111.978");
        tag(210, "#101010", "112.338");
        return c.toDataURL("image/png").split(",")[1];
      }, dark);
      await p.evaluate(() => edit(null));
      await p
        .locator("#shot-file")
        .setInputFiles({
          name: "chart-inset.png",
          mimeType: "image/png",
          buffer: Buffer.from(image, "base64"),
        });
      await p.waitForFunction(
        () =>
          document
            .querySelector("#shot-status")
            .textContent.startsWith("Leitura concluída"),
        null,
        { timeout: 120000 },
      );
      const fields = await p.evaluate(() =>
        Object.fromEntries(
          ["symbol", "entry", "stop", "target", "side", "pnl", "risk"].map(
            (k) => [k, document.getElementById("f_" + k).value],
          ),
        ),
      );
      console.log(dark ? "dark" : "light", fields);
      assert.equal(fields.symbol, "CADJPY");
      assert.equal(+fields.stop, 112.424);
      assert.equal(+fields.entry, 112.315);
      assert.equal(+fields.target, 111.978);
      assert.equal(fields.side, "short");
      assert.equal(fields.pnl, "");
      assert.equal(fields.risk, "");
      assert(
        (await p.locator("#trade-technical").getAttribute("open")) !== null,
      );
      await p.evaluate(() => saveT());
      assert.equal(await p.evaluate(() => S.tradeDrafts.at(-1).img.length), 1);
    }
    // A genuinely unrecognizable capture must explain the failure rather than claim success.
    await p.evaluate(() => {
      edit(null);
      window.Tesseract = {
        createWorker: async () => ({
          recognize: async () => ({ data: { text: "", confidence: 0 } }),
        }),
      };
      shotWorker = null;
    });
    await p.locator("#shot-file").setInputFiles("public/smc-logo.png");
    await p.waitForFunction(
      () =>
        document
          .querySelector("#shot-status")
          .textContent.startsWith("Não consegui identificar"),
      null,
      { timeout: 10000 },
    );
    await p.evaluate(() => saveT());
    assert.equal(await p.evaluate(() => S.tradeDrafts.length), 3);
    assert.equal(await p.evaluate(() => S.trades.length), 0);
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log(
      "PASS flexible labels, real local OCR on dark/light charts with inset scale, quote ignored, prices shown, optional print saving and honest zero-field feedback",
    );
  } finally {
    await b.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
