const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  { createApp } = require("../server/index.cjs");
const header = [
  "Time",
  "Position",
  "Symbol",
  "Type",
  "Volume",
  "Price",
  "S/L",
  "T/P",
  "Time",
  "Price",
  "Commission",
  "Swap",
  "Profit",
];
const a = [
  "2026.10.01 10:00:00",
  "123",
  "EURUSD",
  "buy",
  "0.10",
  "1.1000",
  "1.0900",
  "1.1300",
  "2026.10.01 12:00:00",
  "1.1300",
  "-2.00",
  "-1.00",
  "300.00",
];
const b = [
  "2026.10.02 10:00:00",
  "124",
  "GBPUSD",
  "sell",
  "0.20",
  "1.2000",
  "1.2100",
  "1.1700",
  "2026.10.02 12:00:00",
  "1.2100",
  "-2.00",
  "0.00",
  "-200.00",
];
const csv = [header, a, b].map((row) => row.join(";")).join("\n"),
  html =
    "<html><body><h1>MetaTrader 5</h1><table><tr><td colspan=13>Positions</td></tr>" +
    [header, a, b]
      .map(
        (row) =>
          "<tr>" + row.map((c) => "<td>" + c + "</td>").join("") + "</tr>",
      )
      .join("") +
    "<tr><td>Orders</td></tr>" +
    [header, a]
      .map(
        (row) =>
          "<tr>" + row.map((c) => "<td>" + c + "</td>").join("") + "</tr>",
      )
      .join("") +
    "</table></body></html>";
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
  });
  try {
    const p = await browser.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("http://127.0.0.1:" + app.server.address().port);
    await p.waitForSelector("#main .card");
    await p.evaluate(() => {
      S.trades = [];
      taGo("trades");
    });
    const result = await p.evaluate((text) => imp(text, ""), html);
    assert.equal(result.ok, 2);
    let trades = await p.evaluate(() => S.trades);
    assert.equal(trades[0].pnl, 297);
    assert.equal(trades[1].pnl, -202);
    assert.equal(trades[1].side, "short");
    assert.equal(trades[0].stop, 1.09);
    assert.equal(
      await p.evaluate(() => realizedTradeR(S.trades[0]).value),
      null,
    );
    assert.equal((await p.evaluate((text) => imp(text, ""), csv)).dup, 2);
    await p.evaluate(() => edit(S.trades[0].id));
    await p.locator("#trade-technical summary").click();
    await p.locator("#f_mt5_stop_confirmed").check();
    await p
      .locator("#dlg")
      .getByRole("button", { name: "Salvar", exact: true })
      .click();
    assert.equal(
      await p.evaluate(() => Math.round(realizedTradeR(S.trades[0]).value)),
      3,
    );
    const translated = csv
      .replace("Symbol", "Símbolo")
      .replace("Type", "Tipo")
      .replace("Position", "Posição")
      .replace("Commission", "Comissão")
      .replace("Profit", "Lucro")
      .replace(/Time/g, "Horário")
      .replace(/Price/g, "Preço");
    assert.equal(
      (await p.evaluate((text) => parseMT5(text), translated)).trades.length,
      2,
    );

    const netCsv = csv.replace("Profit", "Net Profit");
    assert.equal(
      (await p.evaluate((text) => parseMT5(text), netCsv)).trades[0].pnl,
      300,
    );
    assert.equal(
      (await p.evaluate((text) => parseMT5(text), "Account summary\n" + csv))
        .trades.length,
      2,
    );
    const partial = [...a];
    partial[8] = "2026.10.01 13:00:00";
    const partialCsv = [header, a, partial].map((r) => r.join(";")).join("\n");
    const parsedPartial = await p.evaluate(
      (text) => parseMT5(text),
      partialCsv,
    );
    assert.equal(parsedPartial.trades.length, 2);
    assert.notEqual(parsedPartial.trades[0].ext, parsedPartial.trades[1].ext);
    const invalid = [...a];
    invalid[8] = "";
    assert.ok(
      (
        await p.evaluate(
          (text) => parseMT5(text),
          [header, invalid].map((r) => r.join(";")).join("\n"),
        )
      ).err,
    );
    const stored = await p.evaluate(() => JSON.stringify(S));
    await p.evaluate(() => {
      window.mt5OldSet = Storage.prototype.setItem;
      Storage.prototype.setItem = () => {
        throw Error("quota");
      };
    });
    assert.match(
      (await p.evaluate((text) => imp(text, ""), partialCsv)).err,
      /Não foi possível salvar/,
    );
    assert.equal(await p.evaluate(() => JSON.stringify(S)), stored);
    await p.evaluate(() => (Storage.prototype.setItem = window.mt5OldSet));
    assert.equal(await p.evaluate(() => mt5Number("1.234,56")), 1234.56);
    assert.equal(await p.evaluate(() => mt5Number("-1 234.56")), -1234.56);
    assert.equal(
      await p.evaluate(
        () =>
          parseMT5(
            "<h1>MetaTrader 5</h1><table><tr><td>Deals</td></tr></table>",
          ).trades,
      ),
      undefined,
    );
    await p.evaluate(() => {
      S.trades[0].notes = "Preservar";
      save();
    });
    await p.reload();
    assert.equal(await p.evaluate(() => S.trades[0].notes), "Preservar");
    await p.evaluate(() => taGo("trades"));
    await p
      .locator("summary")
      .filter({ hasText: "Importar histórico" })
      .click();
    await p.locator("#fi").setInputFiles({
      name: "MT5.htm",
      mimeType: "text/html",
      buffer: Buffer.concat([
        Buffer.from([255, 254]),
        Buffer.from(html, "utf16le"),
      ]),
    });
    await p.getByRole("button", { name: "Importar", exact: true }).click();
    await p.waitForFunction(() =>
      document.querySelector("#imsg").textContent.includes("duplicados"),
    );
    assert.match(await p.locator("#imsg").innerText(), /2 duplicados/);
    assert.deepEqual(errors, []);
    console.log(
      "PASS MT5 HTML/CSV/PT headers/UTF16, signed net profit/costs, dedup and notes, verified initial stop for R, malformed report rejection",
    );
  } finally {
    await browser.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
