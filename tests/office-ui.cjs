const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
  try {
    const p = await b.newPage({ viewport: { width: 1600, height: 1000 } }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("http://127.0.0.1:" + app.server.address().port);
    await p.waitForSelector(".elite-office");
    const before = await p.evaluate(() => JSON.stringify(S));
    await p.locator("#elite-question").fill("Como preparar a sessão?");
    await p
      .getByRole("button", { name: "Enviar pergunta", exact: true })
      .click();
    assert.match(
      await p.locator(".elite-history").innerText(),
      /não está conectada/,
    );
    await p.route("**/api/briefing", async (r) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const body = r.request().postDataJSON();
      assert.equal(body.question, "Revisar plano");
      await r.fulfill({
        json: {
          facts: [body.facts[0]],
          action: "Confira seus critérios antes de operar.",
        },
      });
    });
    await p.evaluate(() => {
      taConnection.authenticated = true;
      taConnection.services.ai = true;
      R();
    });
    await p.locator("#elite-question").fill("Revisar plano");
    await p
      .getByRole("button", { name: "Enviar pergunta", exact: true })
      .click();
    await p.waitForFunction(() => eliteDesk.pending);
    assert.equal(
      await p.locator(".elite-office").getAttribute("data-state"),
      "thinking",
    );
    await p.waitForFunction(() => !eliteDesk.pending);
    assert.match(
      await p.locator(".elite-history").innerText(),
      /Confira seus critérios/,
    );
    assert.equal(
      await p.locator(".elite-office").getAttribute("data-state"),
      "responding",
    );
    assert.equal(await p.evaluate(() => JSON.stringify(S)), before);
    for (const width of [320, 760, 1280, 1600, 1920]) {
      await p.setViewportSize({ width, height: 1000 });
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
    }
    await p.emulateMedia({ reducedMotion: "reduce" });
    await p.setViewportSize({ width: 1600, height: 1000 });
    await p.screenshot({ path: "/tmp/elite-office.png", fullPage: true });
    assert.deepEqual(errors, []);
    console.log(
      "PASS cinematic Home, offline honesty, actual async request, context, records preserved and responsive sizes",
    );
  } finally {
    await b.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
