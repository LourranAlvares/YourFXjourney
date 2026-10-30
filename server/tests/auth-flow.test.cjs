"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  { APIError } = require("../providers.cjs"),
  {
    authError,
    createAuthFlow,
    retrySeconds,
  } = require("../cloud/auth-flow.cjs");
test("mail quota, forbidden recipient, unconfirmed email and request limits have safe distinct diagnostics", () => {
  const response = (status, retry) => ({
    status,
    headers: new Headers(retry ? { "retry-after": retry } : {}),
  });
  const rate = authError(
    "/auth/v1/signup",
    response(429, "120"),
    { code: "over_email_send_rate_limit", message: "secret-provider-token" },
    APIError,
  );
  assert.equal(rate.code, "auth_email_rate_limit");
  assert.equal(rate.retryAfterSeconds, 120);
  assert(!rate.message.includes("secret-provider-token"));
  assert.equal(
    authError(
      "/auth/v1/signup",
      response(400),
      { code: "email_address_not_authorized" },
      APIError,
    ).code,
    "auth_email_configuration",
  );
  assert.equal(
    authError(
      "/auth/v1/token",
      response(400),
      { code: "email_not_confirmed" },
      APIError,
    ).code,
    "email_unconfirmed",
  );
  assert.equal(
    authError(
      "/auth/v1/token",
      response(429),
      { code: "over_request_rate_limit" },
      APIError,
    ).code,
    "auth_request_rate_limit",
  );
  assert.equal(retrySeconds("invalid"), null);
  assert.equal(retrySeconds("2"), 2);
});
test("duplicate sends coalesce, confirmed success is cooled down without retaining signup data, login remains independent", async () => {
  let calls = 0;
  const flow = createAuthFlow(async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 5));
      return { private: "must-not-be-cached" };
    }),
    options = { data: { email: "person@example.test", password: "private" } };
  assert.deepEqual(
    await Promise.all([
      flow.request("/auth/v1/signup", options),
      flow.request("/auth/v1/signup", options),
    ]),
    [{}, {}],
  );
  assert.equal(calls, 1);
  await flow.request("/auth/v1/signup", options);
  assert.equal(calls, 1);
  await flow.request("/auth/v1/token", options);
  assert.equal(calls, 2);
  assert.equal(flow.health().state, "provider_accepted");
  assert(!JSON.stringify(flow.health()).includes("person@example.test"));
});
test("provider retry-after stops repeated mail calls and never disables successful login", async () => {
  let calls = 0;
  const flow = createAuthFlow(async (endpoint) => {
    calls++;
    if (endpoint.includes("token")) return { ok: true };
    throw Object.assign(
      new APIError(429, "auth_email_rate_limit", "mail limited"),
      { retryAfterSeconds: 120 },
    );
  });
  await assert.rejects(
    () =>
      flow.request("/auth/v1/signup", { data: { email: "a@example.test" } }),
    { code: "auth_email_rate_limit" },
  );
  await assert.rejects(
    () =>
      flow.request("/auth/v1/resend", { data: { email: "b@example.test" } }),
    { code: "auth_email_rate_limit" },
  );
  assert.equal(calls, 1);
  assert.deepEqual(await flow.request("/auth/v1/token"), { ok: true });
  assert.equal(calls, 2);
  assert.equal(flow.health().state, "auth_email_rate_limit");
  assert(!JSON.stringify(flow.health()).includes("example.test"));
});
