/* Real browser -> authenticated Node -> Python HTTP -> existing engine -> mocked SDK.
   No external model call. Requires sibling SMC_ELITEBOT and its dev/openai environment. */
const assert = require("node:assert/strict"),
  path = require("node:path"),
  fs = require("node:fs"),
  os = require("node:os"),
  { spawn } = require("node:child_process"),
  { once } = require("node:events");
const { chromium } = require("playwright"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const root = path.resolve(
      process.env.SMC_REPO || path.join(__dirname, "../../SMC_ELITEBOT"),
    ),
    state = fs.mkdtempSync(path.join(os.tmpdir(), "smc-browser-"));
  const py = spawn(
    process.env.SMC_PYTHON || "python3",
    [path.join(root, "tests/http_fixture.py"), state],
    { cwd: root, env: { ...process.env, PYTHONPATH: path.join(root, "src") } },
  );
  let stderr = "";
  py.stderr.on("data", (b) => (stderr += b.toString()));
  const ready = await new Promise((resolve, reject) => {
    let text = "";
    py.stdout.on("data", (b) => {
      text += b.toString();
      if (text.includes("\n")) {
        try {
          resolve(JSON.parse(text.split("\n")[0]));
        } catch (e) {
          reject(e);
        }
      }
    });
    py.on("exit", () => reject(Error("Python fixture: " + stderr)));
    setTimeout(
      () => reject(Error("Python fixture timeout " + stderr)),
      15000,
    ).unref();
  });
  const token = "SOFTWARE_TEST_ONLY_" + "x".repeat(32),
    app = createApp({
      env: {
        TRADE_ASSISTANT_PASSWORD: "SOFTWARE_TEST_ONLY_PASSWORD",
        SMC_ENGINE_URL: "http://127.0.0.1:" + ready.port,
        SMC_SERVICE_TOKEN: token,
        SMC_TENANT_ID: "test",
      },
      fetchFn: async () => {
        throw Error("No generic classifier permitted");
      },
    });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + app.server.address().port,
    browser = await chromium.launch({ executablePath: "/usr/bin/chromium" });
  try {
    const context = await browser.newContext(),
      p = await context.newPage({ viewport: { width: 1440, height: 1100 } }),
      errors = [],
      analyses = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("request", (r) => {
      if (new URL(r.url()).pathname === "/api/analyse")
        analyses.push(r.postDataJSON());
    });
    const login = await context.request.post(base + "/api/login", {
      headers: { origin: base },
      data: { password: "SOFTWARE_TEST_ONLY_PASSWORD" },
    });
    assert.equal(login.status(), 200);
    await p.goto(base);
    await p.waitForSelector(".smc-home");
    await p
      .getByRole("button", { name: "Pular e descobrir sozinho", exact: true })
      .click();
    await p.evaluate(() => taGo("analyst"));
    await p.waitForSelector("#ta-a-asset");
    await p.waitForFunction(() => taConnection.authenticated);
    await p.locator("#ta-a-asset").fill("EURNZD");
    await p.locator("#smc-execution-tf").selectOption("M2");
    await p.locator("#smc-macro-tf").selectOption("H1");
    await p.locator("#smc-decision").fill("2026-01-01T10:00");
    await p.locator("#smc-timezone").fill("UTC");
    const source = path.join(
      root,
      "data/original/prints_originais/SETUP-001_original.png",
    );
    for (const role of ["macro", "micro"]) {
      await p
        .locator(`input[onchange^="smcLoadImage('${role}'"]`)
        .setInputFiles(source);
      await p.waitForSelector("#smc-canvas-" + role);
      await p
        .locator("#smc-tf-" + role)
        .selectOption(role === "macro" ? "H1" : "M1");
    }
    // A pending review survives reload and a crop/mask edit in natural image coordinates.
    await p
      .getByRole("button", { name: "Salvar revisão pendente", exact: true })
      .click();
    await p.reload();
    await p.waitForSelector(".smc-home");
    await p.evaluate(() => taGo("analyst"));
    await p.waitForSelector("#smc-canvas-micro");
    assert.equal(await p.locator("#ta-a-asset").inputValue(), "EURNZD");
    assert.equal(await p.locator("#smc-tf-micro").inputValue(), "M1");
    const card = p.locator(".smc-evidence-card").first();
    await card
      .getByRole("button", { name: "Marcar máscara", exact: true })
      .click();
    const box = await p.locator("#smc-canvas-macro").boundingBox();
    await p.mouse.move(box.x + 10, box.y + 10);
    await p.mouse.down();
    await p.mouse.move(box.x + 40, box.y + 30);
    await p.mouse.up();
    await p.waitForTimeout(100);
    const microBox = await p.locator("#smc-canvas-micro").boundingBox();
    await p.mouse.move(microBox.x + 5, microBox.y + 5);
    await p.mouse.down();
    await p.mouse.move(
      microBox.x + microBox.width - 5,
      microBox.y + microBox.height - 5,
    );
    await p.mouse.up();
    for (const input of await p.locator("[data-smc-check]").all())
      await input.check();
    await p.locator("#ta-a-asset").fill("EURUSD");
    assert.equal(await p.locator("[data-smc-check]:checked").count(), 0);
    await p.locator("#ta-a-asset").fill("EURNZD");
    for (const input of await p.locator("[data-smc-check]").all())
      await input.check();

    await p
      .getByRole("button", {
        name: "Analisar um Setup com SMC IA",
        exact: true,
      })
      .click();
    await p.waitForSelector(".smc-analysis-result h2");
    await p.waitForFunction(
      () =>
        document.querySelector(".smc-analysis-result h2")?.textContent ===
        "Setup válido",
    );
    assert.equal(analyses.length, 1);
    assert.equal(analyses[0].images.length, 2);
    assert.equal(
      analyses[0].images[0].review.decision_at,
      "2026-01-01T10:00:00.000Z",
    );
    assert.equal(analyses[0].images[0].review.masks.length, 1);
    assert.equal(await p.evaluate(() => S.setupAnalyses?.length || 0), 0);
    await p
      .getByText("Imagens originais e rastreabilidade", { exact: true })
      .click();
    await p.waitForFunction(() =>
      [...document.querySelectorAll(".smc-history-image")].every(
        (i) => i.complete && i.naturalWidth > 0,
      ),
    );
    await p
      .getByText("Confirmar ou corrigir interpretação", { exact: true })
      .click();
    await p.locator("#smc-correction [name=kind]").selectOption("correction");
    await p
      .locator("#smc-correction [name=classification]")
      .selectOption("invalid");
    await p
      .locator("#smc-correction [name=reason]")
      .fill("SOFTWARE TEST ONLY: preservar original");
    await p
      .getByRole("button", { name: "Salvar revisão humana", exact: true })
      .click();
    await p.waitForFunction(() =>
      document
        .querySelector(".smc-analysis-result")
        ?.textContent.includes("1 revisão(ões)"),
    );
    assert.equal(
      await p.locator(".smc-analysis-result h2").innerText(),
      "Setup válido",
    );
    await p.reload();
    await p.waitForSelector(".smc-home");
    await p.evaluate(() => taGo("analyst"));
    await p.waitForSelector(".smc-analysis-result h2");
    assert.equal(
      await p.locator(".smc-analysis-result h2").innerText(),
      "Setup válido",
    );
    assert.equal(analyses.length, 1);
    for (const width of [320, 390, 768, 1440, 1920]) {
      await p.setViewportSize({ width, height: 1100 });
      await p.waitForFunction(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      );
    }
    fs.mkdirSync("/tmp/smc-integration-artifacts", { recursive: true });
    await p.setViewportSize({ width: 1440, height: 1100 });
    await p.screenshot({
      path: "/tmp/smc-integration-artifacts/analysis-desktop.png",
      fullPage: true,
    });
    await p.getByRole("button", { name: "Nova análise", exact: true }).click();
    await p.locator("#smc-decision").fill("2026-01-01T10:00");
    await p
      .locator(`input[onchange^="smcLoadImage('micro'"]`)
      .setInputFiles(source);
    await p.waitForSelector("#smc-canvas-micro");
    for (const input of await p.locator("[data-smc-check]").all())
      await input.check();
    await p
      .getByRole("button", {
        name: "Analisar um Setup com SMC IA",
        exact: true,
      })
      .click();
    await p.waitForFunction(
      () =>
        document.querySelector(".smc-analysis-result h2")?.textContent ===
        "Evidência insuficiente",
    );
    assert.equal(analyses.length, 2);
    assert.deepEqual(errors, []);
    console.log(
      "SMC browser integration passed: visual review, durable draft/history, actual Python filters, private images, append-only correction, responsive layout. SDK mocked; zero paid calls.",
    );
  } finally {
    await browser.close();
    app.server.closeAllConnections();
    await new Promise((r) => app.server.close(r));
    py.kill("SIGTERM");
    await once(py, "exit");
    fs.rmSync(state, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
