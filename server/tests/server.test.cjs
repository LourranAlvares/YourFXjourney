"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { createApp } = require("../index.cjs");
const { validateImage } = require("../providers.cjs");
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
const plan = {
  id: "owner-plan",
  version: 3,
  name: "Teste",
  risk: { minRR: 2 },
  criteria: [
    {
      id: "structure",
      label: "Estrutura",
      definition: "Aguardar a condição definida pelo trader.",
      weight: 4,
      required: true,
      critical: true,
    },
    {
      id: "rr",
      label: "R:R",
      definition: "Pelo menos 2R.",
      weight: 2,
      required: true,
      kind: "minRR",
    },
    {
      id: "news",
      label: "Notícias",
      definition: "Sem evento na janela.",
      weight: 1,
      required: true,
      kind: "newsWindow",
    },
  ],
};
const ai = {
  summary: "A evidência de notícias não está disponível.",
  assessments: plan.criteria.map((c) => ({
    criterionId: c.id,
    status: "met",
    reason: "Condição avaliada na captura.",
    evidence: "Texto e níveis visíveis na captura.",
  })),
  levels: {
    entry: 100,
    stop: 90,
    target: 130,
    side: "long",
    plannedRR: 3,
    plannedRisk: 999,
    evidence: "Níveis anotados entrada 100, stop 90, alvo 130.",
  },
};
function mockProviders({ invalid = false } = {}) {
  let calls = { ai: 0, economic: 0, market: 0 };
  return {
    calls,
    fetch: async (url, options) => {
      const dest = String(url);
      if (dest.includes("api.openai.com")) {
        calls.ai++;
        const payload = JSON.parse(options.body);
        assert.equal(payload.store, false);
        assert.equal(payload.text.format.strict, true);
        assert.equal(options.headers.authorization, "Bearer synthetic-ai-key");
        await new Promise((r) => setTimeout(r, 20));
        return Response.json({
          status: "completed",
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify(
                    invalid
                      ? { ...ai, assessments: [] }
                      : {
                          ...ai,
                          assessments: JSON.parse(
                            payload.input[0].content[0].text,
                          ).plan.criteria.map((c) => ({
                            criterionId: c.id,
                            status: "met",
                            reason: "Condição avaliada na captura.",
                            evidence: "Texto e níveis visíveis na captura.",
                          })),
                        },
                  ),
                },
              ],
            },
          ],
        });
      }
      if (dest.includes("financialmodelingprep")) {
        calls.economic++;
        return Response.json([
          {
            date: "2026-10-27 13:30:00",
            event: "Evento de teste",
            currency: "USD",
            impact: "High",
            previous: 1,
            estimate: 2,
            actual: null,
          },
          {
            date: "2026-10-27 09:00:00",
            event: "Outro",
            currency: "JPY",
            impact: "Low",
          },
        ]);
      }
      if (dest.includes("twelvedata")) {
        calls.market++;
        return Response.json({
          values: Array.from({ length: 20 }, (_, i) => ({
            datetime: new Date(Date.UTC(2026, 9, 27, 12) - i * 3600000)
              .toISOString()
              .slice(0, 19)
              .replace("T", " "),
            high: "101",
            low: "99",
            close: "100",
          })),
        });
      }
      throw Error("Unexpected network destination " + dest);
    },
  };
}
async function instance(options = {}) {
  const app = createApp(options);
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + app.server.address().port;
  return { ...app, base, close: () => new Promise((r) => app.server.close(r)) };
}
async function login(app, password = "a synthetic long password") {
  const res = await fetch(app.base + "/api/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: app.base },
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  return { res, data, cookie: res.headers.get("set-cookie")?.split(";")[0] };
}
function config() {
  return {
    TRADE_ASSISTANT_PASSWORD: "a synthetic long password",
    TRADE_AI_KEY: "synthetic-ai-key",
    TRADE_ECONOMIC_KEY: "synthetic-economic-key",
    TRADE_MARKET_KEY: "synthetic-market-key",
  };
}
function analysisBody() {
  return {
    plan,
    image: { dataUrl: png },
    context: {
      asset: "EURUSD",
      timeframe: "5m",
      bias: "long",
      macroContext: "Contexto declarado",
      entryRegion: "100",
    },
  };
}
async function postAnalysis(app, auth, body = analysisBody()) {
  return fetch(app.base + "/api/analyse", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: auth.cookie,
      "x-csrf-token": auth.data.csrf,
      origin: app.base,
    },
    body: JSON.stringify(body),
  });
}
test("status exposes binding presence only and API data requires authentication", async () => {
  const app = await instance({ env: config() });
  try {
    const res = await fetch(app.base + "/api/status"),
      data = await res.json();
    assert.equal(data.authenticated, false);
    assert.equal(data.csrf, null);
    assert.deepEqual(data.services, {
      ai: true,
      economicCalendar: true,
      marketConditions: true,
    });
    assert.ok(!JSON.stringify(data).includes("synthetic-"));
    assert.equal(
      (await fetch(app.base + "/api/economic-calendar")).status,
      401,
    );
  } finally {
    await app.close();
  }
});
test("login creates HttpOnly SameSite session; csrf, foreign origins and logout are enforced", async () => {
  const app = await instance({ env: config() });
  try {
    assert.equal((await login(app, "wrong")).res.status, 401);
    const auth = await login(app);
    assert.equal(auth.res.status, 200);
    assert.match(auth.res.headers.get("set-cookie"), /HttpOnly/);
    assert.match(auth.res.headers.get("set-cookie"), /SameSite=Strict/);
    let res = await fetch(app.base + "/api/logout", {
      method: "POST",
      headers: { cookie: auth.cookie, origin: app.base },
    });
    assert.equal(res.status, 403);
    res = await fetch(app.base + "/api/logout", {
      method: "POST",
      headers: {
        cookie: auth.cookie,
        origin: "https://evil.example",
        "x-csrf-token": auth.data.csrf,
      },
    });
    assert.equal(res.status, 403);
    res = await fetch(app.base + "/api/status", {
      headers: { cookie: auth.cookie },
    });
    assert.equal((await res.json()).csrf, auth.data.csrf);
    res = await fetch(app.base + "/api/logout", {
      method: "POST",
      headers: {
        cookie: auth.cookie,
        origin: app.base,
        "x-csrf-token": auth.data.csrf,
      },
    });
    assert.equal(res.status, 200);
    assert.equal(
      (
        await fetch(app.base + "/api/status", {
          headers: { cookie: auth.cookie },
        }).then((r) => r.json())
      ).authenticated,
      false,
    );
  } finally {
    await app.close();
  }
});
test("missing password and missing provider keys yield explicit unavailable responses", async () => {
  let app = await instance({ env: {} });
  try {
    assert.equal((await login(app)).res.status, 503);
  } finally {
    await app.close();
  }
  app = await instance({
    env: { TRADE_ASSISTANT_PASSWORD: config().TRADE_ASSISTANT_PASSWORD },
  });
  try {
    const auth = await login(app);
    for (const url of [
      "/api/market-conditions?symbols=EUR/USD",
      "/api/economic-calendar?from=2026-10-27&to=2026-10-27",
    ]) {
      const res = await fetch(app.base + url, {
        headers: { cookie: auth.cookie },
      });
      assert.equal(res.status, 503);
      assert.equal((await res.json()).error.code, "service_unavailable");
    }
    assert.equal((await postAnalysis(app, auth)).status, 503);
  } finally {
    await app.close();
  }
});
test("AI requests are structured; numeric scoring and unknown news override AI claims; duplicates deduplicate", async () => {
  const provider = mockProviders(),
    env = config();
  delete env.TRADE_ECONOMIC_KEY;
  const app = await instance({
    env,
    fetchFn: provider.fetch,
    now: () => new Date("2026-10-27T12:00:00Z"),
  });
  try {
    const auth = await login(app);
    const results = await Promise.all([
      postAnalysis(app, auth),
      postAnalysis(app, auth),
    ]);
    assert.ok(results.every((r) => r.status === 200));
    const [a, b] = await Promise.all(results.map((r) => r.json()));
    assert.equal(provider.calls.ai, 1);
    assert.equal(a.score.score, 85.71);
    assert.equal(a.score.status, "needs_review");
    assert.equal(
      a.score.assessments.find((a) => a.criterionId === "news").status,
      "not_verifiable",
    );
    assert.deepEqual(a.scoringContext, { plannedRR: 3 });
    assert.equal(a.scoringContext.plannedRisk, undefined);
    assert.equal(a.analysis.levels.plannedRisk, 999);
    assert.ok(a.cached !== b.cached);
    const other = await login(app);
    assert.equal((await postAnalysis(app, other)).status, 200);
    assert.equal(provider.calls.ai, 2);
  } finally {
    await app.close();
  }
});
test("provider schema failure rejects score instead of trusting arbitrary output", async () => {
  const provider = mockProviders({ invalid: true }),
    app = await instance({ env: config(), fetchFn: provider.fetch });
  try {
    const auth = await login(app),
      res = await postAnalysis(app, auth);
    assert.equal(res.status, 502);
    const data = await res.json();
    assert.equal(data.error.code, "invalid_ai_response");
    assert.equal(data.score, undefined);
  } finally {
    await app.close();
  }
});
test("invalid image, plan, context and remote image URLs are rejected before AI billing", async () => {
  const provider = mockProviders(),
    app = await instance({ env: config(), fetchFn: provider.fetch });
  try {
    const auth = await login(app);
    for (const body of [
      { ...analysisBody(), image: { dataUrl: "https://evil.example/secret" } },
      { ...analysisBody(), image: { dataUrl: "data:image/png;base64,AAAA" } },
      { ...analysisBody(), plan: { criteria: [] } },
      { ...analysisBody(), context: { asset: [] } },
    ])
      assert.equal((await postAnalysis(app, auth, body)).status, 400);
    assert.equal(provider.calls.ai, 0);
  } finally {
    await app.close();
  }
});
test("calendar filters real structured events and caches provider fetches; date/timezone inputs validated", async () => {
  const provider = mockProviders(),
    app = await instance({ env: config(), fetchFn: provider.fetch });
  try {
    const auth = await login(app),
      url =
        "/api/economic-calendar?from=2026-10-27&to=2026-10-27&currencies=USD&timezone=Europe/London";
    let res = await fetch(app.base + url, { headers: { cookie: auth.cookie } }),
      data = await res.json();
    assert.equal(data.events.length, 1);
    assert.equal(data.events[0].time, "2026-10-27T13:30:00.000Z");
    assert.equal(data.events[0].impact, "high");
    assert.equal(data.events[0].forecast, 2);
    assert.equal(data.source, "Financial Modeling Prep");
    data = await fetch(app.base + url, {
      headers: { cookie: auth.cookie },
    }).then((r) => r.json());
    assert.equal(data.cached, true);
    assert.equal(provider.calls.economic, 1);
    for (const q of [
      "from=2026-99-99&to=2026-10-27",
      "from=2026-10-27&to=2026-10-27&timezone=invalid-zone",
      "from=2026-01-01&to=2026-10-27",
    ])
      assert.equal(
        (
          await fetch(app.base + "/api/economic-calendar?" + q, {
            headers: { cookie: auth.cookie },
          })
        ).status,
        400,
      );
  } finally {
    await app.close();
  }
});
test("volatility uses documented ATR calculation and never unsupported opinion", async () => {
  const provider = mockProviders(),
    app = await instance({
      env: config(),
      fetchFn: provider.fetch,
      now: () => new Date("2026-10-27T12:00:00Z"),
    });
  try {
    const auth = await login(app),
      data = await fetch(
        app.base +
          "/api/market-conditions?symbols=EUR/USD&timezone=Europe/London",
        { headers: { cookie: auth.cookie } },
      ).then((r) => r.json());
    assert.equal(data.instruments[0].atr14, 2);
    assert.equal(data.instruments[0].atrPercent, 2);
    assert.equal(data.instruments[0].volatility, "high");
    assert.equal(data.instruments[0].delayed, false);
    assert.equal(data.method.highFrom, 0.5);
    assert.equal(provider.calls.market, 1);
  } finally {
    await app.close();
  }
});
test("static server does not expose server files, tests, git metadata or credential configuration", async () => {
  const app = await instance({ env: config() });
  try {
    for (const file of [
      "/server/index.cjs",
      "/.git/config",
      "/server/SETUP.md",
      "/tests/insights.cjs",
      "/.env",
      "/public/../../server/index.cjs",
    ])
      assert.equal((await fetch(app.base + file)).status, 404, file);
    const res = await fetch(app.base + "/");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /text\/html/);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.match(
      res.headers.get("content-security-policy"),
      /frame-ancestors 'none'/,
    );
  } finally {
    await app.close();
  }
});
test("login rate limit restricts repeated guessing", async () => {
  const app = await instance({ env: config() });
  try {
    for (let i = 0; i < 8; i++)
      assert.equal((await login(app, "wrong")).res.status, 401);
    assert.equal((await login(app, "wrong")).res.status, 429);
  } finally {
    await app.close();
  }
});
test("image validation reads dimensions and rejects an oversized pixel budget", () => {
  assert.equal(validateImage(png).width, 1);
  const raw = Buffer.from(png.split(",")[1], "base64");
  raw.writeUInt32BE(12000, 16);
  raw.writeUInt32BE(12000, 20);
  assert.throws(
    () => validateImage("data:image/png;base64," + raw.toString("base64")),
    /24 megapixels/,
  );
});

test("session and economic cautions are verified on server time; cache changes when boundaries change", async () => {
  let instant = new Date("2026-10-27T13:25:00Z");
  const provider = mockProviders(),
    app = await instance({
      env: config(),
      fetchFn: provider.fetch,
      now: () => instant,
    });
  try {
    const auth = await login(app),
      body = analysisBody();
    body.plan = {
      ...plan,
      criteria: [
        ...plan.criteria,
        {
          id: "session",
          label: "Sessão",
          definition: "Operar na sessão",
          weight: 1,
          required: true,
          kind: "session",
        },
      ],
    };
    body.profile = {
      timezone: "Europe/London",
      session: {
        timezone: "Europe/London",
        start: "11:00",
        end: "14:00",
        days: [2],
        enabled: true,
      },
    };
    let res = await postAnalysis(app, auth, body),
      data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.scoringContext.withinSession, true);
    assert.equal(data.scoringContext.newsBlocked, true);
    assert.equal(data.score.status, "not_compliant");
    assert.ok(data.score.blockers.some((b) => b.criterionId === "news"));
    instant = new Date("2026-10-27T14:10:00Z");
    res = await postAnalysis(app, auth, body);
    data = await res.json();
    assert.equal(data.scoringContext.withinSession, false);
    assert.equal(data.scoringContext.newsBlocked, false);
    assert.ok(data.score.blockers.some((b) => b.criterionId === "session"));
    assert.equal(provider.calls.ai, 2);
    body.profile.session.timezone = "invalid-zone";
    assert.equal((await postAnalysis(app, auth, body)).status, 400);
  } finally {
    await app.close();
  }
});

test("explicit trader RR is preserved when visual AI levels suggest a different RR", async () => {
  const provider = mockProviders(),
    env = config();
  delete env.TRADE_ECONOMIC_KEY;
  const app = await instance({ env, fetchFn: provider.fetch });
  try {
    const auth = await login(app),
      body = analysisBody();
    body.context.plannedRR = 1;
    const res = await postAnalysis(app, auth, body),
      data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.analysis.levels.plannedRR, 3);
    assert.equal(data.scoringContext.plannedRR, 1);
    assert.equal(
      data.score.assessments.find((a) => a.criterionId === "rr").status,
      "failed",
    );
    assert.equal(data.score.status, "not_compliant");
  } finally {
    await app.close();
  }
});

test("public deployment requires HTTPS and automatically uses Secure cookies", async () => {
  assert.throws(
    () =>
      createApp({
        env: { ...config(), TRADE_ALLOWED_ORIGIN: "http://app.example" },
      }),
    /HTTPS/,
  );
  const app = await instance({
    env: {
      ...config(),
      TRADE_ALLOWED_ORIGIN: "https://app.example",
      TRADE_COOKIE_SECURE: "false",
    },
  });
  try {
    const res = await new Promise((resolve, reject) => {
      const req = require("node:http").request(
        {
          hostname: "127.0.0.1",
          port: new URL(app.base).port,
          path: "/api/login",
          method: "POST",
          headers: {
            "content-type": "application/json",
            host: "app.example",
            origin: "https://app.example",
          },
        },
        (res) => {
          res.resume();
          res.on("end", () =>
            resolve({ status: res.statusCode, headers: res.headers }),
          );
        },
      );
      req.on("error", reject);
      req.end(JSON.stringify({ password: config().TRADE_ASSISTANT_PASSWORD }));
    });
    assert.equal(res.status, 200);
    assert.match(res.headers["set-cookie"][0], /; Secure/);
  } finally {
    await app.close();
  }
});
test("malformed economic events never produce a false news clearance", async () => {
  const provider = mockProviders(),
    fetchFn = async (url, options) =>
      String(url).includes("financialmodelingprep")
        ? Response.json([
            {
              event: "Hidden event",
              date: "not-a-date",
              currency: "USD",
              impact: "high",
            },
          ])
        : provider.fetch(url, options),
    app = await instance({ env: config(), fetchFn });
  try {
    const auth = await login(app);
    let res = await fetch(
      app.base + "/api/economic-calendar?from=2026-10-27&to=2026-10-27",
      { headers: { cookie: auth.cookie } },
    );
    assert.equal(res.status, 502);
    res = await postAnalysis(app, auth);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.scoringContext.newsBlocked, undefined);
    assert.equal(
      data.score.assessments.find((a) => a.criterionId === "news").status,
      "not_verifiable",
    );
  } finally {
    await app.close();
  }
});

test("upstream AI concurrency is bounded while duplicate deduplication remains separate", async () => {
  const provider = mockProviders(),
    env = config();
  delete env.TRADE_ECONOMIC_KEY;
  const fetchFn = async (url, options) => {
      if (String(url).includes("api.openai.com"))
        await new Promise((r) => setTimeout(r, 100));
      return provider.fetch(url, options);
    },
    app = await instance({ env, fetchFn });
  try {
    const auth = await login(app),
      requests = ["a", "b", "c"].map((macroContext) =>
        postAnalysis(app, auth, {
          ...analysisBody(),
          context: { ...analysisBody().context, macroContext },
        }),
      ),
      responses = await Promise.all(requests);
    assert.equal(responses.filter((r) => r.status === 200).length, 2);
    assert.equal(responses.filter((r) => r.status === 429).length, 1);
    assert.equal(provider.calls.ai, 2);
  } finally {
    await app.close();
  }
});

test("personal briefing selects only supplied facts, never rewrites statistics, deduplicates and validates output", async () => {
  let calls = 0;
  const env = config(),
    fetchFn = async (url, options) => {
      assert.equal(String(url), "https://api.openai.com/v1/responses");
      calls++;
      const request = JSON.parse(options.body),
        input = JSON.parse(request.input[0].content[0].text);
      assert.equal(request.store, false);
      assert.equal(request.text.format.name, "personal_trading_briefing");
      await new Promise((r) => setTimeout(r, 20));
      const id = input.facts[0].id;
      const data =
        id === "unknown"
          ? { selectedFactIds: ["invented"], action: "Siga seu plano." }
          : id === "numeric"
            ? { selectedFactIds: [id], action: "Faça 3 operações." }
            : id === "unicode"
              ? { selectedFactIds: [id], action: "Faça ٣ operações." }
              : {
                  selectedFactIds: [id],
                  action: "Confira a confirmação do plano antes de decidir.",
                };
      return Response.json({
        status: "completed",
        output_text: JSON.stringify(data),
      });
    },
    app = await instance({ env, fetchFn });
  try {
    const auth = await login(app),
      send = (body) =>
        fetch(app.base + "/api/briefing", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: auth.cookie,
            origin: app.base,
            "x-csrf-token": auth.data.csrf,
          },
          body: JSON.stringify(body),
        }),
      good = {
        plan: null,
        profile: { timezone: "Europe/London" },
        facts: [
          { id: "good", text: "Existem 7 operações; 3 com risco informado." },
        ],
      };
    let responses = await Promise.all([send(good), send(good)]);
    assert.ok(responses.every((r) => r.status === 200));
    const data = await responses[0].json();
    assert.deepEqual(data.facts, good.facts);
    assert.equal(
      data.action,
      "Confira a confirmação do plano antes de decidir.",
    );
    assert.equal(calls, 1);
    for (const id of ["unknown", "numeric", "unicode"]) {
      const res = await send({
        ...good,
        facts: [{ id, text: "Fato documentado." }],
      });
      assert.equal(res.status, 502);
      assert.equal((await res.json()).error.code, "invalid_ai_response");
    }
    for (const body of [
      {
        ...good,
        facts: [
          { id: "same", text: "a" },
          { id: "same", text: "b" },
        ],
      },
      { ...good, facts: [] },
      { ...good, facts: [{ id: "a", text: "x".repeat(1001) }] },
      { ...good, image: { dataUrl: png } },
    ])
      assert.equal((await send(body)).status, 400);
    assert.equal(calls, 4);
  } finally {
    await app.close();
  }
});
test("personal briefing uses the same authentication, csrf and unavailable-key controls", async () => {
  const app = await instance({
    env: { TRADE_ASSISTANT_PASSWORD: config().TRADE_ASSISTANT_PASSWORD },
  });
  try {
    let res = await fetch(app.base + "/api/briefing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(res.status, 401);
    const auth = await login(app),
      body = JSON.stringify({
        plan: null,
        facts: [{ id: "plan", text: "Plano ainda não configurado." }],
      });
    res = await fetch(app.base + "/api/briefing", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: auth.cookie },
      body,
    });
    assert.equal(res.status, 403);
    res = await fetch(app.base + "/api/briefing", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: auth.cookie,
        "x-csrf-token": auth.data.csrf,
      },
      body,
    });
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error.code, "service_unavailable");
  } finally {
    await app.close();
  }
});
