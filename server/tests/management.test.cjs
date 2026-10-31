"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  { expiryFor, createManagement } = require("../cloud/management.cjs");
test("access terms use calendar months, leap years and reject expired custom dates", () => {
  const now = new Date("2028-01-31T10:00:00Z");
  assert.equal(expiryFor("monthly", null, now), "2028-02-29T10:00:00.000Z");
  assert.equal(expiryFor("bimonthly", null, now), "2028-03-31T10:00:00.000Z");
  assert.equal(expiryFor("semiannual", null, now), "2028-07-31T10:00:00.000Z");
  assert.equal(
    expiryFor("biennial", null, new Date("2028-02-29T10:00:00Z")),
    "2030-02-28T10:00:00.000Z",
  );
  assert.equal(expiryFor("quarterly", null, now), "2028-04-30T10:00:00.000Z");
  assert.equal(
    expiryFor("annual", null, new Date("2028-02-29T10:00:00Z")),
    "2029-02-28T10:00:00.000Z",
  );
  assert.equal(expiryFor("unlimited", null, now), null);
  assert.equal(expiryFor("trial7", null, now), "2028-02-07T10:00:00.000Z");
  assert.throws(() => expiryFor("custom", "2020-01-01", now));
  assert.throws(() => expiryFor("admin", null, now));
});
test("management enforces admin boundaries, protected owner, allowlists and expiry on every account lookup", async () => {
  const id = "11111111-1111-4111-8111-111111111111",
    ownerId = "22222222-2222-4222-8222-222222222222",
    calls = [],
    fail = (status, code, message) => {
      throw Object.assign(Error(message), { status, code });
    },
    active = (c) => {
      if (!c || c.user.status !== "active")
        fail(403, "not_active", "not active");
    },
    admin = (c) => {
      active(c);
      if (c.user.role !== "admin")
        fail(403, "admin_required", "admin required");
    },
    member = { user: { id, role: "member", status: "active" }, token: "own" },
    owner = { user: { id: ownerId, role: "admin", status: "active" } };
  const m = createManagement({
    fail,
    active,
    admin,
    owner: "owner@example.test",
    request: async (path, opts) => {
      calls.push({ path, ...opts });
      if (path.includes("elitex_profiles?"))
        return [{ id, role: "member", email: "member@example.test" }];
      if (path.includes("elitex_account_access?"))
        return [{ plan: "trial", expires_at: "2020-01-01T00:00:00Z" }];
      return { ok: true };
    },
  });
  await assert.rejects(() => m.list(member, new URLSearchParams()), {
    code: "admin_required",
  });
  await assert.rejects(() => m.audit(member, id), { code: "admin_required" });
  await assert.rejects(() => m.update(member, { id }), {
    code: "admin_required",
  });
  assert.equal((await m.ownAccess(member.user)).status, "expired");
  assert.equal((await m.ownAccess(owner.user)).status, "active");
  await assert.rejects(
    () =>
      m.update(owner, {
        id: ownerId,
        status: "active",
        term: "annual",
        notes: "",
        revokeSessions: false,
      }),
    { code: "owner_protected" },
  );
  await assert.rejects(
    () =>
      m.update(owner, {
        id,
        status: "active",
        term: "annual",
        notes: "",
        revokeSessions: false,
        role: "admin",
      }),
    { code: "invalid_settings" },
  );
  await assert.rejects(
    () =>
      m.update(owner, {
        id,
        status: "active",
        term: "keep",
        notes: "",
        revokeSessions: false,
      }),
    { code: "expired_access" },
  );
  await assert.rejects(
    () =>
      m.update(owner, {
        id,
        status: "active",
        term: "annual",
        plan: "admin",
        notes: "",
        revokeSessions: false,
      }),
    { code: "invalid_settings" },
  );
  await m.update(owner, {
    id,
    status: "blocked",
    term: "keep",
    notes: "trial agreed",
    revokeSessions: true,
  });
  const rpc = calls.find((c) => c.path.endsWith("elitex_admin_manage"));
  assert.equal(rpc.data.access_expiry, "2020-01-01T00:00:00Z");
  assert.equal(rpc.data.actor, ownerId);
  assert.equal(rpc.data.revoke_sessions, true);
  const updated = await m.update(owner, {
    id,
    status: "active",
    term: "bimonthly",
    plan: "annual",
    notes: "agreed",
    revokeSessions: false,
  });
  assert.equal(updated.ok, true);
  assert.equal(updated.account.plan, "annual");
  assert.equal(updated.account.status, "active");
  assert(Date.parse(updated.account.expires_at) > Date.now());
});
test("administration reads only profile/access records and has no reporting methods", async () => {
  const calls = [],
    m = createManagement({
      request: async (path) => {
        calls.push(path);
        return [];
      },
      admin: () => {},
      active: () => {},
      fail: () => {
        throw Error("unexpected");
      },
      owner: "owner@example.test",
    });
  await m.list({}, new URLSearchParams());
  assert(calls.every((p) => /elitex_profiles|elitex_account_access/.test(p)));
  assert.equal(m.sync, undefined);
  assert.equal(m.consent, undefined);
  assert(!JSON.stringify(calls).includes("workspaces"));
});
