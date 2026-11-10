"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { createSMCEngine } = require("../smc-engine.cjs"),
  { createApp } = require("../index.cjs");
const token = "SOFTWARE_TEST_ONLY_" + "x".repeat(32),
  id = "10000000-0000-4000-8000-000000000001";
test("SMC gateway trusts authenticated identity only and forwards the unchanged result", async () => {
  const calls = [],
    result = {
      id,
      status: "completed",
      result: {
        assessment: { classification: "invalid" },
        model_assessment: { classification: "valid" },
      },
    };
  const service = createSMCEngine({
    env: {
      SMC_ENGINE_URL: "http://private.test:8001",
      SMC_SERVICE_TOKEN: token,
      SMC_TENANT_ID: "test",
    },
    fetchFn: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify(result));
    },
  });
  assert.deepEqual(
    await service.analyse(
      { id: "alpha" },
      {
        engine: "smc-elite-v1",
        requestId: id,
        context: { symbol: "EURUSD" },
        images: [],
      },
    ),
    result,
  );
  assert.equal(calls[0].url, "http://private.test:8001/analyses");
  assert.equal(calls[0].options.headers["x-smc-owner"], "test:user:alpha");
  assert.equal(calls[0].options.headers.authorization, "Bearer " + token);
  assert.equal(JSON.parse(calls[0].options.body).engine, undefined);
  assert.throws(
    () =>
      service.analyse(
        { id: "alpha" },
        { engine: "smc-elite-v1", owner: "beta" },
      ),
    /inválida/,
  );
  await service.history({ id: "beta" }, "19");
  assert.equal(calls[1].url, "http://private.test:8001/analyses?before=19");
  assert.equal(calls[1].options.headers["x-smc-owner"], "test:user:beta");
});
test("SMC failures/unconfigured never fall back to generic classification", async () => {
  await assert.rejects(createSMCEngine({ env: {} }).status(), {
    status: 503,
    code: "smc_unconfigured",
  });
  const service = createSMCEngine({
    env: { SMC_ENGINE_URL: "http://private.test", SMC_SERVICE_TOKEN: token },
    fetchFn: async () => {
      throw Error("PRIVATE_SECRET");
    },
  });
  await assert.rejects(
    service.status(),
    (e) => e.status === 503 && !e.message.includes("PRIVATE_SECRET"),
  );
});
test("existing API requires session and CSRF before accessing private engine", async () => {
  let calls = 0,
    genericCalls = 0;
  const app = createApp({
    env: {
      TRADE_ASSISTANT_PASSWORD: "SOFTWARE_TEST_ONLY_PASSWORD",
      SMC_ENGINE_URL: "http://private.test",
      SMC_SERVICE_TOKEN: token,
    },
    smcFetchFn: async () => {
      calls++;
      return new Response(
        JSON.stringify({ engine: "smc-elite-v1", configured: true }),
      );
    },
    fetchFn: async () => {
      genericCalls++;
      throw Error("generic classifier must not run");
    },
  });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + app.server.address().port;
  try {
    assert.equal((await fetch(base + "/api/smc/status")).status, 401);
    assert.equal(calls, 0);
    const login = await fetch(base + "/api/login", {
        method: "POST",
        headers: { origin: base, "content-type": "application/json" },
        body: JSON.stringify({ password: "SOFTWARE_TEST_ONLY_PASSWORD" }),
      }),
      session = await login.json(),
      cookie = login.headers.get("set-cookie").split(";")[0];
    const payload = {
      engine: "smc-elite-v1",
      requestId: id,
      context: {},
      images: [],
    };
    assert.equal(
      (
        await fetch(base + "/api/analyse", {
          method: "POST",
          headers: { cookie, origin: base, "content-type": "application/json" },
          body: JSON.stringify(payload),
        })
      ).status,
      403,
    );
    assert.equal(calls, 0);
    const response = await fetch(base + "/api/analyse", {
      method: "POST",
      headers: {
        cookie,
        origin: base,
        "content-type": "application/json",
        "x-csrf-token": session.csrf,
      },
      body: JSON.stringify(payload),
    });
    assert.equal(response.status, 202);
    assert.equal(calls, 1);
    assert.equal(genericCalls, 0);
    assert.ok(!JSON.stringify(await response.json()).includes(token));
  } finally {
    app.server.closeAllConnections();
    await new Promise((r) => app.server.close(r));
  }
});

test("invalid optional Python configuration preserves the main application", async () => {
  const service = createSMCEngine({
    env: { SMC_ENGINE_URL: "not-a-url", SMC_SERVICE_TOKEN: token },
  });
  assert.equal(service.configured, false);
  await assert.rejects(
    service.status(),
    (e) => e.status === 503 && !e.message.includes(token),
  );
  const app = createApp({
    env: { SMC_ENGINE_URL: "not-a-url", SMC_SERVICE_TOKEN: token },
  });
  assert.ok(app.server);
  app.server.close();
});
