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
    for (const [short, scale, encoding] of [
      [false, 1, "image/png"],
      [true, 1, "image/png"],
      [false, 0.8, "image/jpeg"],
    ]) {
      const image = await p.evaluate(
        ({ short, scale, encoding }) => {
          const c = document.createElement("canvas");
          c.width = 1595;
          c.height = 951;
          const x = c.getContext("2d");
          x.fillStyle = "#111";
          x.fillRect(0, 0, 1595, 951);
          x.fillStyle = "#e7e5e5";
          x.fillRect(10, 28, 1575, 863);
          x.font = "12px Arial";
          x.fillStyle = "#bbb";
          x.fillText(
            "Fixture created with TradingView.com, Nov 09, 2026 10:45 UTC",
            10,
            18,
          );
          x.fillStyle = "#111";
          x.fillText(
            "Euro / New Zealand Dollar · 2 · Tickmill  O1.99507 H1.99508 L1.99482 C1.99485",
            18,
            46,
          );
          x.fillStyle = "#fff";
          x.font = "80px Arial";
          x.fillText("EURNZD, 2", 575, 472);
          for (let i = 0; i < 120; i++) {
            const xx = 15 + i * 10,
              yy = 460 + Math.sin(i * 0.18) * 90;
            x.strokeStyle = "#111";
            x.beginPath();
            x.moveTo(xx, yy - 16);
            x.lineTo(xx, yy + 18);
            x.stroke();
            x.fillStyle = "#111";
            x.fillRect(xx - 1, yy, 3, 10);
          }
          x.fillStyle = short ? "#efbdbe" : "#c7d9c7";
          x.fillRect(1156, 358, 308, 238);
          x.fillStyle = short ? "#c7d9c7" : "#efbdbe";
          x.fillRect(1156, 596, 308, 79);
          x.strokeStyle = "#111";
          x.beginPath();
          x.moveTo(900, 596);
          x.lineTo(1464, 596);
          x.stroke();
          const tag = (y, color, text, timer) => {
            x.fillStyle = color;
            x.fillRect(1524, y - 8, 55, timer ? 34 : 17);
            x.fillStyle = "#fff";
            x.font = "bold 12px Arial";
            x.fillText(text, 1527, y + 4);
            if (timer) x.fillText("00:44", 1527, y + 18);
          };
          tag(358, short ? "#ff3451" : "#4caf50", "1.99855");
          tag(596, "#080808", "1.99551");
          tag(647, "#282828", "1.99485", true);
          tag(678, short ? "#4caf50" : "#ff3451", "1.99450");
          let out = c;
          if (scale !== 1) {
            out = document.createElement("canvas");
            out.width = Math.round(c.width * scale);
            out.height = Math.round(c.height * scale);
            out.getContext("2d").drawImage(c, 0, 0, out.width, out.height);
          }
          return out.toDataURL(encoding, 0.94).split(",")[1];
        },
        { short, scale, encoding },
      );
      await p.evaluate(() => edit(null));
      assert.match(await p.locator("#shot-reader-version").innerText(), /TV-3/);
      await p
        .locator("#shot-file")
        .setInputFiles({
          name:
            encoding === "image/jpeg"
              ? "eurnzd-black-entry.jpg"
              : "eurnzd-black-entry.png",
          mimeType: encoding,
          buffer: Buffer.from(image, "base64"),
        });
      await p.waitForFunction(
        () =>
          document
            .getElementById("shot-status")
            .textContent.startsWith("Leitura concluída"),
        null,
        { timeout: 120000 },
      );
      const values = await p.evaluate(() =>
        Object.fromEntries(
          [
            "symbol",
            "entry",
            "stop",
            "target",
            "side",
            "plannedRR",
            "pnl",
            "close",
            "open",
          ].map((k) => [k, document.getElementById("f_" + k).value]),
        ),
      );
      console.log(short ? "short" : "long", values);
      assert.equal(values.symbol, "EURNZD");
      assert.equal(+values.entry, 1.99551);
      assert.equal(+values.stop, short ? 1.99855 : 1.9945);
      assert.equal(+values.target, short ? 1.9945 : 1.99855);
      assert.equal(values.side, short ? "short" : "long");
      assert(
        Math.abs(+values.plannedRR - (short ? 1.01 / 3.04 : 3.04 / 1.01)) <
          1e-7,
      );
      assert.equal(values.pnl, "");
      assert.equal(values.open, "");
      assert.equal(values.close, "");
      await p.evaluate(() => saveT());
      assert.equal(await p.evaluate(() => S.tradeDrafts.at(-1).img.length), 1);
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS TV-2 format: black entry and live quote/countdown separated by geometry, EURNZD long/short, exact prices/RR and no invented realized data",
    );
  } finally {
    await b.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
