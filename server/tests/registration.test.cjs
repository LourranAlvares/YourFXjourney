"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  http = require("node:http"),
  { createApp } = require("../index.cjs"),
  { fixture } = require("./helpers/cloud-fixture.cjs");
async function start(t, quota = false) {
  const f = fixture();
  let mailCalls = 0;
  const app = createApp({
    env: f.env("https://cloud.example"),
    fetchFn: async (raw, opts) => {
      const path = new URL(raw).pathname;
      if (
        ["/auth/v1/signup", "/auth/v1/resend", "/auth/v1/recover"].includes(
          path,
        )
      ) {
        mailCalls++;
        if (quota)
          return new Response(
            JSON.stringify({
              code: "over_email_send_rate_limit",
              message: "private-upstream-marker",
            }),
            {
              status: 429,
              headers: {
                "content-type": "application/json",
                "retry-after": "120",
              },
            },
          );
        if (path === "/auth/v1/resend")
          return new Response("{}", {
            headers: { "content-type": "application/json" },
          });
      }
      return f.fetchFn(raw, opts);
    },
  });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => app.server.close(r)));
  const call = (path, data, cookie = "") =>
    new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: app.server.address().port,
          path,
          method: data ? "POST" : "GET",
          headers: {
            host: "cloud.example",
            origin: "https://cloud.example",
            "content-type": "application/json",
            ...(cookie ? { cookie } : {}),
          },
        },
        (res) => {
          let text = "";
          res.on("data", (c) => (text += c));
          res.on("end", () =>
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: JSON.parse(text),
            }),
          );
        },
      );
      req.on("error", reject);
      req.end(data ? JSON.stringify(data) : undefined);
    });
  const login = async (email) => {
    const result = await call("/api/auth/login", {
      email,
      password: "Example-test-password-123",
    });
    assert.equal(result.status, 200);
    return (result.headers["set-cookie"] || [])
      .map((c) => c.split(";")[0])
      .join("; ");
  };
  return { ...f, call, login, mailCalls: () => mailCalls };
}
const signup = (email) => ({
  email,
  firstName: "Novo",
  lastName: "Usuário",
  password: "Example-test-password-123",
  passwordConfirmation: "Example-test-password-123",
});
test("signup exposes safe email-specific quota and retry-after, coalesces mail backoff, preserves login and admin-only diagnosis", async (t) => {
  const f = await start(t, true),
    result = await f.call("/api/auth/signup", signup("person@example.test"));
  assert.equal(result.status, 429);
  assert.equal(result.data.error.code, "auth_email_rate_limit");
  assert.equal(result.data.error.retryAfterSeconds, 120);
  assert.equal(result.headers["retry-after"], "120");
  assert(!JSON.stringify(result.data).includes("private-upstream-marker"));
  assert.equal(
    (await f.call("/api/auth/resend", { email: "another@example.test" }))
      .status,
    429,
  );
  assert.equal(f.mailCalls(), 1);
  const owner = await f.login(f.owner.email);
  const health = await f.call("/api/admin/registration-health", null, owner);
  assert.equal(health.data.state, "auth_email_rate_limit");
  assert(!JSON.stringify(health.data).includes("example.test"));
  const member = await f.login(f.a.email);
  assert.equal(
    (await f.call("/api/admin/registration-health", null, member)).status,
    403,
  );
});
test("successful signup deduplicates repeated sends and resend works without exposing registration existence", async (t) => {
  const f = await start(t);
  assert.equal(
    (await f.call("/api/auth/signup", signup("new@example.test"))).status,
    200,
  );
  assert.equal(
    (await f.call("/api/auth/signup", signup("NEW@example.test"))).status,
    200,
  );
  assert.equal(f.mailCalls(), 1);
  const sent = await f.call("/api/auth/resend", { email: "new@example.test" });
  assert.equal(sent.status, 200);
  assert.match(sent.data.message, /Se houver uma conta/);
  assert.equal(f.mailCalls(), 2);
  await f.call("/api/auth/resend", { email: "new@example.test" });
  assert.equal(f.mailCalls(), 2);
});
test("users behind one proxy do not share the former 40-attempt account limit", async (t) => {
  const f = await start(t);
  for (let i = 0; i < 45; i++) {
    const result = await f.call("/api/auth/login", {
      email: "unregistered-" + i + "@example.test",
      password: "Example-test-password-123",
    });
    assert.equal(
      result.status,
      400,
      "unrelated account was rate-limited at " + i,
    );
  }
  for (let i = 0; i < 30; i++)
    await f.call("/api/auth/login", {
      email: "same@example.test",
      password: "Example-test-password-123",
    });
  const limited = await f.call("/api/auth/login", {
    email: "same@example.test",
    password: "Example-test-password-123",
  });
  assert.equal(limited.status, 429);
  assert(limited.data.error.retryAfterSeconds > 0);
  assert.equal(
    (
      await f.call("/api/auth/login", {
        email: "different@example.test",
        password: "Example-test-password-123",
      })
    ).status,
    400,
  );
});
