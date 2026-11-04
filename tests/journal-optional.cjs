"use strict";
const assert = require("node:assert/strict"),
  { chromium } = require("playwright"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: { SMC_WORLD_ENABLED: "true" } });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
  });
  try {
    const p = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: "reduce",
      }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    const base = "http://127.0.0.1:" + app.server.address().port;
    await p.goto(base);
    await p.waitForSelector("#smc-world-enter");
    await p.evaluate(() => {
      S.balance = 100;
      S.balanceConfirmed = true;
      S.currency = "USD";
      persistState(S);
      taGo("trades");
    });
    await p
      .getByRole("button", { name: "Editar capital inicial", exact: true })
      .first()
      .click();
    assert.equal(await p.locator("#account-edit-baseline").inputValue(), "100");
    await p.locator("#account-edit-baseline").fill("130.47");
    await p
      .getByRole("button", { name: "Salvar capital inicial", exact: true })
      .click();
    assert.equal(await p.evaluate(() => S.balance), 130.47);
    assert.equal(await p.evaluate(() => S.trades.length), 0);
    await p.evaluate(() => edit(null));
    await p
      .locator("#dlg")
      .getByRole("button", { name: "Salvar", exact: true })
      .click();
    await p.waitForFunction(() => S.tradeDrafts?.length === 1);
    assert.equal(await p.evaluate(() => S.trades.length), 0);
    assert(await p.locator("#journal-record-notice").isVisible());
    await p.evaluate(() => edit(null));
    await p.locator("#f_notes").fill("Só uma nota, sem campos obrigatórios");
    await p
      .locator("#dlg")
      .getByRole("button", { name: "Salvar", exact: true })
      .click();
    await p.waitForFunction(() => S.tradeDrafts.length === 2);
    await p.evaluate(() => edit(null));
    await p
      .locator("#dlg input[type=file][multiple]")
      .setInputFiles("public/smc-logo.png");
    await p
      .locator("#dlg")
      .getByRole("button", { name: "Salvar", exact: true })
      .click();
    await p.waitForFunction(() => S.tradeDrafts.length === 3);
    assert.equal(await p.evaluate(() => S.tradeDrafts.at(-1).img.length), 1);
    await p.route("**/vendor/ocr/**", (r) => r.abort());
    await p.evaluate(() => edit(null));
    await p.locator("#shot-file").setInputFiles("public/smc-logo.png");
    await p
      .locator("#dlg")
      .getByRole("button", { name: "Salvar", exact: true })
      .click();
    await p.waitForFunction(() => S.tradeDrafts.length === 4);
    assert.equal(await p.evaluate(() => S.tradeDrafts.at(-1).img.length), 1);
    assert.equal(await p.evaluate(() => S.trades.length), 0);
    await p.reload();
    await p.waitForSelector("#smc-world-enter");
    assert.equal(await p.evaluate(() => S.balance), 130.47);
    await p.evaluate(() => taGo("trades"));
    assert.equal(await p.locator(".diary-partial-card").count(), 4);
    assert.match(await p.locator(".diary-partials").innerText(), /Só uma nota/);
    const id = await p.evaluate(() => S.tradeDrafts[2].id);
    await p.evaluate((id) => editShotDraft(id), id);
    await p.locator("#f_close").fill("2026-11-04T10:00");
    await p.locator("#f_pnl").fill("0");
    await p
      .locator("#dlg")
      .getByRole("button", { name: "Salvar", exact: true })
      .click();
    await p.waitForFunction(() => S.trades.length === 1);
    assert.equal(await p.evaluate(() => S.trades[0].id), id);
    assert.equal(await p.evaluate(() => S.trades[0].symbol), "");
    assert.equal(await p.evaluate(() => S.trades[0].img.length), 1);
    assert.equal(await p.evaluate(() => S.tradeDrafts.length), 3);
    await p.evaluate((id) => edit(id), id);
    await p.locator("#f_pnl").fill("");
    await p
      .locator("#dlg")
      .getByRole("button", { name: "Salvar", exact: true })
      .click();
    await p.waitForFunction(() => S.trades.length === 0);
    assert.equal(await p.evaluate(() => S.tradeDrafts.length), 4);
    const before = await p.evaluate(() => JSON.stringify(S));
    await p.evaluate((id) => editShotDraft(id), id);
    await p.locator("#f_notes").fill("Ainda não salvo");
    await p.evaluate(() => {
      window.realJournalPersist = persistState;
      persistState = () => {
        throw Error("Quota de teste");
      };
    });
    await p
      .locator("#dlg")
      .getByRole("button", { name: "Salvar", exact: true })
      .click();
    await p.waitForSelector("#diary-save-status[data-state=error]");
    assert(await p.locator("#dlg").evaluate((d) => d.open));
    assert.equal(await p.evaluate(() => JSON.stringify(S)), before);
    assert.equal(await p.locator("#f_notes").inputValue(), "Ainda não salvo");
    await p.evaluate(() => {
      persistState = realJournalPersist;
      document.querySelector("#dlg").close();
    });
    // Optional fields also apply to the World station; the record appears in both modes.
    await p.evaluate(() => taGo("home"));
    await p.locator("#smc-world-enter").click();
    await p.waitForSelector(".smc-cinema-lobby");
    await p.locator("[data-world-room=trades]").click();
    assert.equal(await p.locator("#world-journal-form [required]").count(), 0);
    await p.locator("#world-j-notes").fill("Nota salva no World");
    await p.locator(".world-journal-entry button[type=submit]").click();
    await p.waitForFunction(() => S.tradeDrafts.length === 5);
    assert.match(
      await p.locator(".world-journal-records").innerText(),
      /Nota salva no World/,
    );
    await p.locator("[data-world-action=classic]").click();
    await p.evaluate(() => taGo("trades"));
    assert.match(
      await p.locator(".diary-partials").innerText(),
      /Nota salva no World/,
    );
    const report =
      "Initial Deposit:;140.55;USD\nTime;Position;Symbol;Type;Volume;Price;S/L;T/P;Time;Price;Commission;Swap;Profit\n2026.10.01 10:00:00;123;EURUSD;buy;0.10;1.1000;1.0900;1.1300;2026.10.01 12:00:00;1.1300;-2;-1;300";
    const parsed = await p.evaluate((text) => parseMT5(text), report);
    assert.equal(parsed.initialCapital.amount, 140.55);
    assert.equal(parsed.initialCapital.currency, "USD");
    await p.evaluate((parsed) => importMT5(parsed), parsed);
    assert.equal(
      await p.evaluate(() => S.balance),
      130.47,
      "confirmed manual capital never overwritten",
    );
    await p.evaluate(() => {
      S.balanceConfirmed = false;
      S.trades = [];
    });
    await p.evaluate((parsed) => importMT5(parsed), parsed);
    assert.equal(
      await p.evaluate(() => S.balance),
      140.55,
      "explicit report evidence initializes an unconfirmed account",
    );
    assert.equal(
      await p.evaluate(
        (text) => mt5InitialCapital(text + "\nInitial balance:;999;USD"),
        report,
      ),
      null,
      "conflicting evidence is never guessed",
    );
    assert.equal(
      await p.evaluate(() => mt5InitialCapital("Current Balance:;999;USD")),
      null,
    );
    // Editing a selected account updates only that account's base, not other accounts or trades.
    await p.evaluate(() => {
      S.tradingAccounts = [
        {
          id: "A",
          name: "Conta A",
          initialBalance: 100,
          balanceConfirmed: true,
          currency: "USD",
        },
        {
          id: "B",
          name: "Conta B",
          initialBalance: 999,
          balanceConfirmed: true,
          currency: "USD",
        },
      ];
      panelUI.account = "A";
      R();
      accountOpenEditor();
    });
    await p.locator("#account-edit-baseline").fill("131.25");
    await p
      .getByRole("button", { name: "Salvar capital inicial", exact: true })
      .click();
    assert.equal(
      await p.evaluate(() => S.tradingAccounts[0].initialBalance),
      131.25,
    );
    assert.equal(
      await p.evaluate(() => S.tradingAccounts[1].initialBalance),
      999,
    );
    assert.equal(await p.evaluate(() => S.balance), 140.55);
    assert.deepEqual(errors, []);
    console.log(
      "PASS optional diary: empty/note/print/OCR-unreviewed saves, reload, partial promotion/demotion with same ID, storage failure preserves editor, World/classic parity, editable scoped capital and explicit-only MT5 capital inference",
    );
  } finally {
    await browser.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
