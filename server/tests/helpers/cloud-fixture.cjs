"use strict";
const crypto = require("node:crypto");
function fixture() {
  const users = new Map(),
    profiles = new Map(),
    access = new Map(),
    refresh = new Map(),
    workspaces = new Map(),
    versions = new Map(),
    calls = [];
  const response = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  function add(email, status = "active", verified = true) {
    const user = {
      id: crypto.randomUUID(),
      email,
      email_confirmed_at: verified ? "2026-10-30T10:00:00Z" : null,
      password: "Example-test-password-123",
      user_metadata: { name: email.split("@")[0] },
    };
    users.set(email, user);
    profiles.set(user.id, {
      id: user.id,
      email,
      name: user.user_metadata.name,
      role: "member",
      session_version: 0,
      status,
      created_at: "2026-10-30T10:00:00Z",
    });
    return user;
  }
  const owner = add("owner@example.test", "pending"),
    a = add("alice@example.test"),
    b = add("bob@example.test"),
    pending = add("pending@example.test", "pending");
  function tokens(user) {
    const t = {
      access_token: crypto.randomUUID(),
      refresh_token: crypto.randomUUID(),
      expires_in: 3600,
    };
    access.set(t.access_token, user);
    refresh.set(t.refresh_token, user);
    return t;
  }
  const authorize = (options) =>
    access.get((options.headers?.authorization || "").replace("Bearer ", ""));
  async function fetchFn(raw, options = {}) {
    const url = new URL(raw),
      p = url.pathname,
      data = options.body ? JSON.parse(options.body) : {},
      isService = options.headers?.apikey === "service-test-key",
      user = authorize(options);
    calls.push({
      path: p,
      method: options.method || "GET",
      data,
      service: isService,
      user: user?.id,
    });
    if (p === "/auth/v1/token") {
      let u;
      if (url.searchParams.get("grant_type") === "refresh_token")
        u = refresh.get(data.refresh_token);
      else {
        u = users.get(data.email);
        if (!u || u.password !== data.password || !u.email_confirmed_at)
          return response({ error: "invalid" }, 400);
      }
      return u ? response(tokens(u)) : response({ error: "invalid" }, 400);
    }
    if (p === "/auth/v1/signup") {
      if (!users.has(data.email)) add(data.email, "pending", false);
      return response({ user: {} });
    }
    if (p === "/auth/v1/recover") return response({});
    if (p === "/auth/v1/verify") {
      const u = users.get(data.token_hash);
      if (!u) return response({}, 400);
      u.email_confirmed_at = "2026-10-30T10:00:00Z";
      return response(tokens(u));
    }
    if (p === "/auth/v1/user") {
      if (!user) return response({}, 401);
      if (options.method === "PUT") user.password = data.password;
      return response({ ...user, password: undefined });
    }
    if (p === "/auth/v1/logout") {
      if (user) {
        // Supabase access JWTs may remain cryptographically valid after signout.
        // The application session_version must invalidate them independently.
        for (const [k, u] of refresh) if (u.id === user.id) refresh.delete(k);
      }
      return response({});
    }
    if (p === "/rest/v1/elitex_profiles") {
      if (!isService) return response({}, 403);
      const id = url.searchParams.get("id")?.slice(3);
      if (options.method === "PATCH") {
        Object.assign(profiles.get(id), data);
        return response({});
      }
      return response(
        id ? [profiles.get(id)].filter(Boolean) : [...profiles.values()],
      );
    }
    if (!user || profiles.get(user.id)?.status !== "active")
      return response({}, 403);
    if (p === "/rest/v1/elitex_workspaces")
      return response(workspaces.has(user.id) ? [workspaces.get(user.id)] : []);
    if (p === "/rest/v1/rpc/elitex_save_workspace") {
      const current = workspaces.get(user.id) || {
        revision: 0,
        data: { trades: [], reviews: {}, strats: [], balance: 10000 },
      };
      if (
        current.mutation_id === data.mutation_id &&
        JSON.stringify(current.data) === JSON.stringify(data.workspace_data)
      )
        return response({ revision: current.revision });
      if (current.revision !== data.expected_revision)
        return response({ code: "PT409" }, 409);
      const history = versions.get(user.id) || [];
      if (current.revision)
        history.unshift({
          data: structuredClone(current.data),
          revision: current.revision,
          created_at: "2026-10-30T10:00:00Z",
        });
      versions.set(user.id, history.slice(0, 3));
      const next = {
        data: structuredClone(data.workspace_data),
        revision: current.revision + 1,
        mutation_id: data.mutation_id,
        updated_at: "2026-10-30T10:00:00Z",
      };
      workspaces.set(user.id, next);
      return response({ revision: next.revision, updatedAt: next.updated_at });
    }
    if (p === "/rest/v1/elitex_workspace_history") {
      const rev = url.searchParams.get("revision")?.slice(3);
      return response(
        (versions.get(user.id) || [])
          .filter((v) => !rev || String(v.revision) === rev)
          .map((v) =>
            rev ? v : { revision: v.revision, created_at: v.created_at },
          ),
      );
    }
    throw Error("Unexpected fixture request " + raw);
  }
  const env = (origin) => ({
    ELITEX_CLOUD_ENABLED: "true",
    SUPABASE_URL: "https://fixture.supabase.co",
    SUPABASE_ANON_KEY: "public-test-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-test-key",
    ELITEX_SESSION_SECRET: "test-only-session-key-abcdefghijklmnopqrstuvwxyz",
    ELITEX_ADMIN_EMAIL: owner.email,
    TRADE_ALLOWED_ORIGIN: origin,
  });
  return {
    users,
    profiles,
    access,
    refresh,
    workspaces,
    versions,
    calls,
    owner,
    a,
    b,
    pending,
    fetchFn,
    env,
    tokens,
  };
}
module.exports = { fixture };
