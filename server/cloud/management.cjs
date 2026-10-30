"use strict";
const uuid = (v) =>
  typeof v === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
function expiryFor(term, custom, now = new Date()) {
  if (term === "unlimited") return null;
  if (["trial7", "trial14"].includes(term))
    return new Date(
      +now + (term === "trial7" ? 7 : 14) * 86400000,
    ).toISOString();
  const months = { monthly: 1, quarterly: 3, annual: 12 }[term];
  if (months) {
    const d = new Date(now),
      day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + months);
    const last = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
    d.setUTCDate(Math.min(day, last));
    return d.toISOString();
  }
  if (
    term === "custom" &&
    typeof custom === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(custom) &&
    Number.isFinite(Date.parse(custom)) &&
    new Date(custom).toISOString().slice(0, 10) === custom.slice(0, 10) &&
    Date.parse(custom) > +now
  )
    return new Date(custom).toISOString();
  throw Error("invalid term");
}
function summaryFor(data, now = new Date()) {
  const rows = (Array.isArray(data?.trades) ? data.trades : []).filter(
      (t) =>
        typeof t.close === "string" &&
        /^\d{4}-\d{2}-\d{2}/.test(t.close) &&
        typeof t.pnl === "number" &&
        Number.isFinite(t.pnl),
    ),
    today = now.toISOString().slice(0, 10),
    start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const summarize = (xs) => {
    const wins = xs.filter((t) => t.pnl > 0),
      losses = xs.filter((t) => t.pnl < 0),
      net = xs.reduce((s, t) => s + t.pnl, 0),
      gain = wins.reduce((s, t) => s + t.pnl, 0),
      loss = -losses.reduce((s, t) => s + t.pnl, 0);
    return {
      trades: xs.length,
      net,
      winRate: xs.length ? (wins.length / xs.length) * 100 : null,
      profitFactor: loss ? gain / loss : null,
    };
  };
  const closed = rows.filter((t) => t.close.slice(0, 10) <= today),
    s = summarize(closed),
    week = summarize(
      closed.filter(
        (t) => t.close.slice(0, 10) >= start.toISOString().slice(0, 10),
      ),
    ),
    month = summarize(
      closed.filter((t) => t.close.slice(0, 7) === today.slice(0, 7)),
    );
  let total = 0,
    peak = 0,
    dd = 0,
    streak = 0;
  for (const t of [...closed].sort((a, b) => a.close.localeCompare(b.close))) {
    total += t.pnl;
    peak = Math.max(peak, total);
    dd = Math.max(dd, peak - total);
    streak = t.pnl < 0 ? streak + 1 : 0;
  }
  const baseline =
    data.balanceConfirmed &&
    typeof data.balance === "number" &&
    Number.isFinite(data.balance) &&
    data.balance > 0
      ? data.balance
      : null;
  return {
    ...s,
    week,
    month,
    drawdown: dd,
    lossStreak: streak,
    returnPercent: baseline ? (s.net / baseline) * 100 : null,
    currency: ["GBP", "USD", "EUR", "BRL"].includes(data.currency)
      ? data.currency
      : null,
    asOf: now.toISOString(),
    dateBasis: "recorded-close-date",
  };
}
function createManagement({ request, active, admin, fail, owner }) {
  const missing = (e) => e.code === "cloud_management_missing";
  async function ownAccess(user) {
    if (user.role === "admin") return user;
    try {
      const r = await request(
        "/rest/v1/elitex_account_access?user_id=eq." +
          encodeURIComponent(user.id) +
          "&select=plan,expires_at",
        { admin: true },
      );
      const a = r?.[0];
      return {
        ...user,
        plan: a?.plan || "standard",
        accessExpiresAt: a?.expires_at || null,
        status:
          user.status === "active" &&
          a?.expires_at &&
          Date.parse(a.expires_at) <= Date.now()
            ? "expired"
            : user.status,
      };
    } catch (e) {
      if (missing(e)) return user;
      throw e;
    }
  }
  async function list(current, params) {
    admin(current);
    const offset = Number(params.get("offset") || 0),
      q = String(params.get("q") || "")
        .trim()
        .slice(0, 100)
        .replace(/[^\p{L}\p{N}@._+ -]/gu, "");
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000)
      fail(400, "invalid_page", "Página inválida.");
    const rows = await request(
        "/rest/v1/elitex_profiles?select=id,email,name,role,status,created_at,updated_at&order=created_at.desc,id.desc&limit=101&offset=" +
          offset +
          (q
            ? "&or=" +
              encodeURIComponent(
                "(name.ilike.*" + q + "*,email.ilike.*" + q + "*)",
              )
            : ""),
        { admin: true },
      ),
      accounts = rows.slice(0, 100),
      ids =
        accounts
          .map((u) => u.id)
          .filter(uuid)
          .join(",") || "00000000-0000-0000-0000-000000000000";
    try {
      const access = await request(
          "/rest/v1/elitex_account_access?select=*&user_id=in.(" + ids + ")",
          { admin: true },
        ),
        shares = await request(
          "/rest/v1/elitex_coaching_shares?select=user_id,enabled,summary,updated_at&user_id=in.(" +
            ids +
            ")&enabled=eq.true",
          { admin: true },
        );
      return {
        ready: true,
        accounts: accounts.map((u) => ({
          ...u,
          access: access.find((a) => a.user_id === u.id) || null,
          coaching: shares.find((a) => a.user_id === u.id) || null,
        })),
        hasMore: rows.length > 100,
        offset,
      };
    } catch (e) {
      if (!missing(e)) throw e;
      return { ready: false, accounts, hasMore: rows.length > 100, offset };
    }
  }
  async function update(current, data) {
    admin(current);
    if (
      !uuid(data.id) ||
      Object.keys(data).some(
        (k) =>
          ![
            "id",
            "status",
            "term",
            "expiresAt",
            "notes",
            "revokeSessions",
          ].includes(k),
      ) ||
      !["active", "pending", "blocked"].includes(data.status) ||
      typeof data.notes !== "string" ||
      data.notes.length > 2000 ||
      typeof data.revokeSessions !== "boolean"
    )
      fail(400, "invalid_settings", "Confira o status, prazo e observações.");
    if (data.id === current.user.id)
      fail(400, "owner_protected", "A conta administradora é protegida.");
    const targets = await request(
        "/rest/v1/elitex_profiles?id=eq." + data.id + "&select=id,role,email",
        { admin: true },
      ),
      t = targets?.[0];
    if (!t || t.role === "admin" || t.email.toLowerCase() === owner)
      fail(400, "owner_protected", "Não é possível alterar esta conta.");
    let expiry, plan;
    try {
      if (data.term === "keep") {
        const rows = await request(
          "/rest/v1/elitex_account_access?user_id=eq." +
            data.id +
            "&select=plan,expires_at",
          { admin: true },
        );
        expiry = rows?.[0]?.expires_at || null;
        plan = rows?.[0]?.plan || "standard";
      } else {
        expiry = expiryFor(data.term, data.expiresAt);
        plan =
          { trial7: "trial", trial14: "trial", unlimited: "standard" }[
            data.term
          ] || data.term;
      }
    } catch (e) {
      if (e.code) throw e;
      fail(
        400,
        "invalid_expiry",
        "Escolha um prazo válido ou uma data futura.",
      );
    }
    return request("/rest/v1/rpc/elitex_admin_manage", {
      admin: true,
      method: "POST",
      data: {
        actor: current.user.id,
        account: data.id,
        new_status: data.status,
        access_plan: plan,
        access_expiry: expiry,
        admin_notes: data.notes.trim(),
        revoke_sessions: data.revokeSessions,
      },
    });
  }
  async function audit(current, id) {
    admin(current);
    if (!uuid(id)) fail(400, "invalid_account", "Conta inválida.");
    return request(
      "/rest/v1/elitex_admin_audit?user_id=eq." +
        id +
        "&select=id,action,details,created_at&order=created_at.desc,id.desc&limit=50",
      { admin: true },
    );
  }
  async function consent(current, enabled) {
    if (!current) fail(401, "authentication_required", "Entre na sua conta.");
    if (enabled === true) active(current);
    if (enabled !== undefined) {
      if (typeof enabled !== "boolean")
        fail(400, "invalid_consent", "Escolha uma opção válida.");
      await request("/rest/v1/rpc/elitex_set_coaching_share", {
        method: "POST",
        token: current.token,
        data: { allow_sharing: enabled },
      });
      if (enabled) {
        const rows = await request(
          "/rest/v1/elitex_workspaces?user_id=eq." +
            current.user.id +
            "&select=data,revision",
          { token: current.token },
        );
        await sync(
          current,
          rows?.[0]?.data || {},
          Number(rows?.[0]?.revision || 0),
        );
      }
    }
    try {
      const rows = await request(
        "/rest/v1/elitex_coaching_shares?user_id=eq." +
          current.user.id +
          "&select=enabled,consent_at,updated_at",
        { token: current.token },
      );
      return {
        ready: true,
        enabled: rows?.[0]?.enabled === true,
        consentAt: rows?.[0]?.consent_at || null,
        updatedAt: rows?.[0]?.updated_at || null,
      };
    } catch (e) {
      if (missing(e) && enabled === undefined)
        return { ready: false, enabled: false };
      throw e;
    }
  }
  async function sync(current, data, revision = 0) {
    const rows = await request(
      "/rest/v1/elitex_coaching_shares?user_id=eq." +
        current.user.id +
        "&select=enabled",
      { token: current.token },
    );
    if (rows?.[0]?.enabled)
      await request("/rest/v1/rpc/elitex_refresh_coaching_summary", {
        admin: true,
        method: "POST",
        data: {
          account: current.user.id,
          summary_data: { ...summaryFor(data), workspaceRevision: revision },
        },
      });
  }
  async function legacyAccess(current, data) {
    let rows;
    try {
      rows = await request(
        "/rest/v1/elitex_account_access?user_id=eq." +
          data.id +
          "&select=notes",
        { admin: true },
      );
    } catch (e) {
      if (missing(e)) return null;
      throw e;
    }
    // Once the access table exists, a missing RPC must fail closed, never bypass audit.
    return update(current, {
      ...data,
      term: "keep",
      notes: rows?.[0]?.notes || "",
      revokeSessions: false,
    });
  }

  return { ownAccess, list, update, audit, consent, sync, legacyAccess };
}
module.exports = { createManagement, expiryFor, summaryFor };
