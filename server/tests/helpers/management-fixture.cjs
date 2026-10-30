"use strict";
const { fixture } = require("./cloud-fixture.cjs");
function managementFixture() {
  const f = fixture(),
    permissions = new Map(),
    audit = [];
  const response = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "content-type": "application/json" },
    });
  async function fetchFn(raw, options = {}) {
    const u = new URL(raw),
      p = u.pathname,
      data = options.body ? JSON.parse(options.body) : {},
      service = options.headers?.apikey === "service-test-key",
      user = f.access.get(
        (options.headers?.authorization || "").replace("Bearer ", ""),
      ),
      id = u.searchParams.get("user_id")?.slice(3),
      isList = u.searchParams.get("user_id")?.startsWith("in.");
    if (p === "/rest/v1/elitex_account_access")
      return response(
        service
          ? [...permissions.values()].filter((a) => isList || a.user_id === id)
          : [],
      );
    if (p === "/rest/v1/elitex_admin_audit")
      return service
        ? response(audit.filter((a) => a.user_id === id).toReversed())
        : response({}, 403);
    if (p === "/rest/v1/rpc/elitex_admin_manage") {
      if (
        !service ||
        f.profiles.get(data.actor)?.role !== "admin" ||
        f.profiles.get(data.account)?.role === "admin"
      )
        return response({}, 403);
      const profile = f.profiles.get(data.account);
      profile.status = data.new_status;
      if (data.revoke_sessions)
        profile.session_version = (profile.session_version || 0) + 1;
      permissions.set(data.account, {
        user_id: data.account,
        plan: data.access_plan,
        expires_at: data.access_expiry,
        notes: data.admin_notes,
      });
      audit.push({
        id: audit.length + 1,
        user_id: data.account,
        action: "access_updated",
        created_at: new Date().toISOString(),
        details: {
          status: data.new_status,
          plan: data.access_plan,
          expires_at: data.access_expiry,
          sessions_revoked: data.revoke_sessions,
        },
      });
      return response({ ok: true });
    }
    return f.fetchFn(raw, options);
  }
  return { ...f, fetchFn, permissions, audit };
}
module.exports = { managementFixture };
