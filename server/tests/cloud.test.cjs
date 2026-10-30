"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto"),
  { createApp } = require("../index.cjs"),
  { fixture } = require("./helpers/cloud-fixture.cjs");
async function start(t) {
  const f = fixture(),
    app = createApp({
      env: f.env("https://cloud.example"),
      fetchFn: f.fetchFn,
    });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => app.server.close(r)));
  const base = "http://127.0.0.1:" + app.server.address().port;
  async function call(
    path,
    { method = "GET", data, cookie = "", csrf, headers = {} } = {},
  ) {
    return new Promise((resolve, reject) => {
      const req = require("node:http").request(
        base + path,
        {
          method,
          headers: {
            host: "cloud.example",
            origin: "https://cloud.example",
            ...(data ? { "content-type": "application/json" } : {}),
            ...(cookie ? { cookie } : {}),
            ...(csrf ? { "x-csrf-token": csrf } : {}),
            ...headers,
          },
        },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString();
            resolve({
              r: {
                status: res.statusCode,
                headers: {
                  get: (k) => res.headers[k],
                  getSetCookie: () => res.headers["set-cookie"] || [],
                },
              },
              data: res.headers["content-type"]?.includes("json")
                ? JSON.parse(text)
                : text,
            });
          });
        },
      );
      req.on("error", reject);
      req.end(data ? JSON.stringify(data) : undefined);
    });
  }
  async function login(email) {
    const result = await call("/api/auth/login", {
      method: "POST",
      data: { email, password: "Example-test-password-123" },
    });
    assert.equal(result.r.status, 200);
    return {
      cookie: result.r.headers
        .getSetCookie()
        .map((s) => s.split(";")[0])
        .join("; "),
      csrf: result.data.csrf,
      user: result.data.user,
      result,
    };
  }
  return { ...f, app, call, login };
}
test("cloud registration/confirmation, pending approval, verified owner bootstrap, role protection and active data access", async (t) => {
  const f = await start(t);
  const signup = await f.call("/api/auth/signup", {
    method: "POST",
    data: {
      email: "new@example.test",
      name: "New",
      password: "Example-test-password-123",
      role: "admin",
    },
  });
  assert.equal(signup.r.status, 200);
  assert.equal(
    f.profiles.get(f.users.get("new@example.test").id).role,
    "member",
  );
  assert.equal((await f.login(f.pending.email)).user.status, "pending");
  const waiting = await f.login(f.pending.email);
  assert.equal((await f.call("/api/workspace", waiting)).r.status, 403);
  const owner = await f.login(f.owner.email);
  assert.equal(owner.user.role, "admin");
  assert.equal(owner.user.status, "active");
  const member = await f.login(f.a.email);
  assert.equal((await f.call("/api/admin/accounts", member)).r.status, 403);
  assert.equal(
    (
      await f.call("/api/admin/accounts", {
        ...member,
        method: "PATCH",
        data: { id: f.pending.id, status: "active" },
      })
    ).r.status,
    403,
  );
  assert.equal(
    (
      await f.call("/api/admin/accounts", {
        ...owner,
        method: "PATCH",
        data: { id: f.pending.id, status: "active" },
      })
    ).r.status,
    200,
  );
  assert.equal((await f.call("/api/workspace", waiting)).r.status, 200);
  assert.equal(
    (
      await f.call("/api/admin/accounts", {
        ...owner,
        method: "PATCH",
        data: { id: f.owner.id, status: "blocked" },
      })
    ).r.status,
    400,
  );
  assert.equal(
    (
      await f.call("/api/admin/accounts", {
        ...owner,
        method: "PATCH",
        data: { id: f.a.id, status: "active", role: "admin" },
      })
    ).r.status,
    400,
  );
  assert(
    !JSON.stringify((await f.call("/api/status", owner)).data).includes(
      "service-test-key",
    ),
  );
  for (const c of owner.result.r.headers.getSetCookie()) {
    assert.match(c, /HttpOnly; SameSite=Strict/);
    assert.match(c, /Secure/);
    assert(
      !c.includes(
        f.calls.find((x) => x.path === "/auth/v1/token")?.data.password ||
          "impossible",
      ),
    );
  }
});
test("workspaces derive ownership from session, enforce CSRF/origin and revisions, preserve snapshots and block immediately", async (t) => {
  const f = await start(t),
    a = await f.login(f.a.email),
    b = await f.login(f.b.email),
    owner = await f.login(f.owner.email),
    data = {
      trades: [{ id: "alice-private", pnl: 10 }],
      reviews: {},
      strats: [],
      balance: 1000,
    },
    mutationId = crypto.randomUUID();
  assert.equal((await f.call("/api/workspace")).r.status, 401);
  assert.equal(
    (
      await f.call("/api/workspace", {
        ...a,
        method: "PUT",
        csrf: "wrong",
        data: { data, revision: 0, mutationId },
      })
    ).r.status,
    403,
  );
  assert.equal(
    (
      await f.call("/api/workspace", {
        ...a,
        headers: { origin: "https://other.example" },
      })
    ).r.status,
    403,
  );
  const save = await f.call("/api/workspace", {
    ...a,
    method: "PUT",
    data: { data, revision: 0, mutationId },
  });
  assert.equal(save.data.revision, 1);
  assert.equal(
    (
      await f.call("/api/workspace", {
        ...a,
        method: "PUT",
        data: { data, revision: 0, mutationId },
      })
    ).data.revision,
    1,
  );
  assert.equal(
    (
      await f.call("/api/workspace", {
        ...b,
        method: "GET",
        headers: { "x-user-id": f.a.id },
      })
    ).data.data.trades.length,
    0,
  );
  assert.equal(
    (
      await f.call("/api/workspace", {
        ...a,
        method: "PUT",
        data: {
          userId: f.b.id,
          data,
          revision: 1,
          mutationId: crypto.randomUUID(),
        },
      })
    ).r.status,
    400,
  );
  assert.equal(
    (
      await f.call("/api/workspace", {
        ...a,
        method: "PUT",
        data: {
          data: { ...data, balance: 999 },
          revision: 0,
          mutationId: crypto.randomUUID(),
        },
      })
    ).r.status,
    409,
  );
  await f.call("/api/workspace", {
    ...a,
    method: "PUT",
    data: {
      data: { ...data, balance: 1010 },
      revision: 1,
      mutationId: crypto.randomUUID(),
    },
  });
  assert.equal(
    (await f.call("/api/workspace/history", a)).data.versions.length,
    1,
  );
  assert.equal(
    (await f.call("/api/workspace/history", b)).data.versions.length,
    0,
  );
  assert(
    f.calls
      .filter(
        (c) =>
          c.path.includes("elitex_workspaces") ||
          c.path.includes("elitex_save_workspace"),
      )
      .every((c) => !c.service),
  );
  await f.call("/api/admin/accounts", {
    ...owner,
    method: "PATCH",
    data: { id: f.a.id, status: "blocked" },
  });
  assert.equal((await f.call("/api/workspace", a)).r.status, 403);
  assert.equal((await f.call("/api/status", a)).data.authenticated, false);
});
test("landing routes, encrypted cookie rotation/restart, recovery and logout revoke sessions", async (t) => {
  const f = await start(t);
  assert.match((await f.call("/")).data, /Bem-vindo ao EliteX/);
  assert.match(
    (await f.call("/YourFXjourney.html")).data,
    /Bem-vindo ao EliteX/,
  );
  assert.equal(
    (
      await f.call("/account", {
        headers: {
          origin: "https://mail.example",
          "sec-fetch-site": "cross-site",
          "sec-fetch-mode": "navigate",
        },
      })
    ).r.status,
    200,
  );
  assert.equal(
    (
      await f.call("/api/account", {
        headers: {
          origin: "https://mail.example",
          "sec-fetch-site": "cross-site",
          "sec-fetch-mode": "navigate",
        },
      })
    ).r.status,
    403,
  );
  const a = await f.login(f.a.email);
  assert.match((await f.call("/", a)).data, /meta name="elitex-cloud"/);
  assert.match(
    (await f.call("/YourFXjourney-standalone.html", a)).data,
    /meta name="elitex-cloud"/,
  );
  for (const [token, user] of f.access)
    if (user.id === f.a.id) f.access.delete(token);
  const refreshed = await f.call("/api/status", a);
  assert.equal(refreshed.data.authenticated, true);
  assert.equal(refreshed.data.csrf, a.csrf);
  assert.equal(refreshed.r.headers.getSetCookie().length, 2);
  const recovery = await f.call("/api/auth/recover", {
    method: "POST",
    data: { email: f.a.email },
  });
  assert.equal(recovery.r.status, 200);
  const verified = await f.call("/api/auth/verify", {
    method: "POST",
    data: { token_hash: f.a.email, type: "recovery" },
  });
  assert.equal(verified.data.recovery, true);
  const logout = await f.call("/api/auth/logout", {
    ...a,
    method: "POST",
    data: {},
  });
  assert.equal(logout.r.status, 200);
  assert(logout.r.headers.getSetCookie().every((c) => c.includes("Max-Age=0")));
  assert.equal((await f.call("/api/status", a)).data.authenticated, false);
});

test("cloud configuration names missing or invalid variables without revealing their values", () => {
  const { createCloud } = require("../cloud/accounts.cjs"),
    f = fixture();
  const env = {
    ...f.env("https://cloud.example"),
    SUPABASE_URL: "invalid-private-url-marker",
    SUPABASE_SERVICE_ROLE_KEY: "",
    ELITEX_SESSION_SECRET: "short-secret-marker",
    ELITEX_ADMIN_EMAIL: "invalid-private-email-marker",
  };
  assert.throws(
    () => createCloud({ env }),
    (e) => {
      for (const name of [
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "ELITEX_SESSION_SECRET",
        "ELITEX_ADMIN_EMAIL",
      ])
        assert(e.message.includes(name));
      for (const value of [
        "invalid-private-url-marker",
        "short-secret-marker",
        "invalid-private-email-marker",
        "public-test-key",
      ])
        assert(!e.message.includes(value));
      assert(!e.message.includes("SUPABASE_ANON_KEY"));
      return true;
    },
  );
  assert.throws(
    () => createCloud({ env: { ELITEX_CLOUD_ENABLED: "true" } }),
    /SUPABASE_ANON_KEY/,
  );
  assert.equal(createCloud({ env: {} }), null);
});

test("split names persist as full name plus metadata; confirmation mismatches are rejected before signup", async (t) => {
  const f = await start(t),
    payload = {
      firstName: "Lohan",
      lastName: "Alves",
      email: "lohan@example.test",
      password: "Example-test-password-123",
      passwordConfirmation: "different-password",
    };
  const rejected = await f.call("/api/auth/signup", {
    method: "POST",
    data: payload,
  });
  assert.equal(rejected.r.status, 400);
  assert.equal(f.users.has(payload.email), false);
  const created = await f.call("/api/auth/signup", {
    method: "POST",
    data: { ...payload, passwordConfirmation: payload.password },
  });
  assert.equal(created.r.status, 200);
  const metadata = f.users.get(payload.email).user_metadata;
  assert.deepEqual(metadata, {
    name: "Lohan Alves",
    first_name: "Lohan",
    last_name: "Alves",
  });
  const confirmed = await f.call("/api/auth/verify", {
    method: "POST",
    data: { token_hash: payload.email, type: "email" },
  });
  assert.equal(confirmed.data.user.name, "Lohan Alves");
  assert.equal(confirmed.data.user.firstName, "Lohan");
  assert.equal(confirmed.data.user.lastName, "Alves");
});
