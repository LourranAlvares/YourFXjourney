"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  {
    expiryFor,
    summaryFor,
    createManagement,
  } = require("../cloud/management.cjs");
test("access terms use calendar months, leap years and reject expired custom dates", () => {
  const now = new Date("2028-01-31T10:00:00Z");
  assert.equal(expiryFor("monthly", null, now), "2028-02-29T10:00:00.000Z");
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
test("coaching is an aggregate of closed records without diary, prints, plan, or invented balances", () => {
  const s = summaryFor(
    {
      currency: "USD",
      balance: 1000,
      balanceConfirmed: true,
      trades: [
        { close: "2026-10-26T09:00", pnl: 100, notes: "private" },
        { close: "2026-10-27T09:00", pnl: -50, img: ["private"] },
        { pnl: 900 },
        { close: "2026-10-31T09:00", pnl: 999 },
      ],
      tradingPlans: ["private"],
    },
    new Date("2026-10-30T10:00Z"),
  );
  assert.equal(s.trades, 2);
  assert.equal(s.net, 50);
  assert.equal(s.week.net, 50);
  assert.equal(s.month.net, 50);
  assert.equal(s.drawdown, 50);
  assert.equal(s.lossStreak, 1);
  assert.equal(s.returnPercent, 5);
  assert.equal(s.profitFactor, 2);
  assert(!JSON.stringify(s).includes("private"));
  assert.equal(summaryFor({ trades: [] }).returnPercent, null);
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
  await m.update(owner, {
    id,
    status: "active",
    term: "keep",
    notes: "trial agreed",
    revokeSessions: true,
  });
  const rpc = calls.find((c) => c.path.endsWith("elitex_admin_manage"));
  assert.equal(rpc.data.access_expiry, "2020-01-01T00:00:00Z");
  assert.equal(rpc.data.actor, ownerId);
  assert.equal(rpc.data.revoke_sessions, true);
});
test("sharing requires self consent, defaults off on missing migration and never reads another workspace", async () => {
  let enabled = false;
  const calls = [],
    id = "11111111-1111-4111-8111-111111111111",
    c = { user: { id, status: "active", role: "member" }, token: "own-token" },
    fail = (s, code) => {
      throw Object.assign(Error(code), { code });
    };
  const m = createManagement({
    fail,
    owner: "owner@example.test",
    active: () => {},
    admin: () => {},
    request: async (path, opts = {}) => {
      calls.push({ path, ...opts });
      if (path.includes("elitex_set_coaching_share"))
        enabled = opts.data.allow_sharing;
      if (path.includes("elitex_coaching_shares?")) return [{ enabled }];
      if (path.includes("elitex_workspaces?"))
        return [
          {
            data: {
              trades: [{ close: "2026-01-01", pnl: 10, notes: "private" }],
            },
          },
        ];
      return { ok: true };
    },
  });
  await m.sync(c, { trades: [] });
  assert(!calls.some((c) => c.path.includes("refresh_coaching")));
  await m.consent(c, true);
  const shared = calls.find((c) => c.path.includes("refresh_coaching"));
  assert.equal(shared.data.account, id);
  assert(!JSON.stringify(shared.data.summary_data).includes("private"));
  await m.consent(c, false);
  const count = calls.length;
  await m.sync(c, { trades: [] });
  assert(!calls.slice(count).some((c) => c.path.includes("refresh_coaching")));
  await assert.rejects(() => m.consent(c, "true"), { code: "invalid_consent" });
});
