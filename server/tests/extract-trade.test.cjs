const test = require("node:test"),
  assert = require("node:assert/strict"),
  { createProviders } = require("../providers.cjs"),
  engine = require("../../public/plan-engine.js"),
  { createApp } = require("../index.cjs");
const image =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
test("trade extraction is independent of plan/history, scoped vision and geometric RR", async () => {
  let calls = 0;
  const providers = createProviders({
    env: { TRADE_AI_KEY: "fixture-only" },
    engine,
    fetchFn: async (url, options) => {
      calls++;
      assert.equal(url, "https://api.openai.com/v1/responses");
      const body = JSON.parse(options.body);
      assert.equal(body.store, false);
      assert.equal(body.text.format.name, "journal_trade_extraction");
      const text = JSON.parse(body.input[0].content[0].text);
      assert.deepEqual(Object.keys(text).sort(), ["currency", "task"]);
      assert.equal(body.input[0].content[1].image_url, image);
      return Response.json({
        output_text: JSON.stringify({
          symbol: "EURNZD",
          side: "long",
          entry: 1.99551,
          stop: 1.9945,
          target: 1.99855,
          plannedRR: 99,
          pnl: null,
          risk: null,
          size: null,
          exit: null,
          leverage: null,
          evidence:
            "Etiqueta preta na divisão entre verde e vermelho; preços nas extremidades.",
          issues: [],
        }),
      });
    },
  });
  const result = await providers.extractTrade(
    { image: { dataUrl: image }, currency: "USD" },
    "user-a",
  );
  assert.equal(result.fields.side, "long");
  assert(Math.abs(result.fields.plannedRR - 3.00990099) < 1e-7);
  assert.equal(result.fields.pnl, undefined);
  assert.equal(calls, 1);
  await assert.rejects(
    providers.extractTrade(
      { image: { dataUrl: "https://external.invalid/image" } },
      "user-a",
    ),
    (e) => e.status === 400,
  );
  assert.equal(calls, 1);
});
test("trade extraction rejects unavailable AI and malformed responses", async () => {
  await assert.rejects(
    createProviders({ env: {}, engine }).extractTrade(
      { image: { dataUrl: image } },
      "a",
    ),
    (e) => e.status === 503,
  );
  const p = createProviders({
    env: { TRADE_AI_KEY: "fixture" },
    engine,
    fetchFn: async () => Response.json({ output_text: "invalid" }),
  });
  await assert.rejects(
    p.extractTrade({ image: { dataUrl: image } }, "a"),
    (e) => e.status === 502,
  );
});
test("trade extraction requires authentication", async () => {
  const app = createApp({
    env: { TRADE_ASSISTANT_PASSWORD: "fixture-password-long" },
  });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  try {
    const r = await fetch(
      "http://127.0.0.1:" + app.server.address().port + "/api/extract-trade",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: { dataUrl: image } }),
      },
    );
    assert.equal(r.status, 401);
  } finally {
    await new Promise((r) => app.server.close(r));
  }
});
test("authenticated extraction enforces CSRF and preserves an explicit negative realized amount", async () => {
  let calls = 0;
  const app = createApp({
    env: {
      TRADE_ASSISTANT_PASSWORD: "fixture-password-long",
      TRADE_AI_KEY: "fixture",
    },
    fetchFn: async () => {
      calls++;
      return Response.json({
        output_text: JSON.stringify({
          symbol: "EURNZD",
          side: null,
          entry: null,
          stop: null,
          target: null,
          exit: null,
          size: 1,
          risk: 50,
          pnl: -5.2,
          plannedRR: null,
          leverage: 100,
          evidence: "Resultado realizado: -5.20 USD",
          issues: [],
        }),
      });
    },
  });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + app.server.address().port;
  try {
    const login = await fetch(base + "/api/login", {
        method: "POST",
        headers: { "content-type": "application/json", origin: base },
        body: JSON.stringify({ password: "fixture-password-long" }),
      }),
      auth = await login.json(),
      cookie = login.headers.get("set-cookie").split(";")[0];
    const options = {
      method: "POST",
      headers: { "content-type": "application/json", origin: base, cookie },
      body: JSON.stringify({ image: { dataUrl: image }, currency: "USD" }),
    };
    assert.equal(
      (await fetch(base + "/api/extract-trade", options)).status,
      403,
    );
    options.headers["x-csrf-token"] = auth.csrf;
    const response = await fetch(base + "/api/extract-trade", options);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.fields.pnl, -5.2);
    assert.equal(data.fields.leverage, undefined);
    assert.equal(data.fields.size, undefined);
    assert.equal(data.fields.risk, undefined);
    assert.equal(calls, 1);
  } finally {
    await new Promise((r) => app.server.close(r));
  }
});
