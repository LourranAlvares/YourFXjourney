const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  { createApp } = require("../index.cjs");
async function instance(password) {
  const app = createApp({ env: { TRADE_ASSISTANT_PASSWORD: password } });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  return {
    ...app,
    base: "http://127.0.0.1:" + app.server.address().port,
    close: () => new Promise((r) => app.server.close(r)),
  };
}
test("remembered cookie survives server restart, validates password and signature, enforces CSRF and logout", async () => {
  const password = "synthetic persistent password";
  let app = await instance(password);
  let cookie, csrf;
  try {
    let response = await fetch(app.base + "/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    assert.equal(response.status, 200);
    cookie = response.headers.get("set-cookie").split(";")[0];
    csrf = (await response.json()).csrf;
    assert.match(response.headers.get("set-cookie"), /Max-Age=2592000/);
    assert.match(
      response.headers.get("set-cookie"),
      /HttpOnly; SameSite=Strict/,
    );
  } finally {
    await app.close();
  }
  app = await instance(password);
  try {
    let response = await fetch(app.base + "/api/status", {
        headers: { cookie },
      }),
      status = await response.json();
    assert.equal(status.authenticated, true);
    assert.equal(status.csrf, csrf);
    let bad = cookie.slice(0, -1) + (cookie.endsWith("A") ? "B" : "A");
    assert.equal(
      (
        await (
          await fetch(app.base + "/api/status", { headers: { cookie: bad } })
        ).json()
      ).authenticated,
      false,
    );
    response = await fetch(app.base + "/api/logout", {
      method: "POST",
      headers: { cookie },
    });
    assert.equal(response.status, 403);
    response = await fetch(app.base + "/api/logout", {
      method: "POST",
      headers: { cookie, "x-csrf-token": csrf },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("set-cookie"), /Max-Age=0/);
    assert.equal(
      (
        await (
          await fetch(app.base + "/api/status", { headers: { cookie } })
        ).json()
      ).authenticated,
      false,
    );
  } finally {
    await app.close();
  }
  app = await instance("a different synthetic password");
  try {
    assert.equal(
      (
        await (
          await fetch(app.base + "/api/status", { headers: { cookie } })
        ).json()
      ).authenticated,
      false,
    );
  } finally {
    await app.close();
  }
});
