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
  const months = {
    monthly: 1,
    bimonthly: 2,
    quarterly: 3,
    semiannual: 6,
    annual: 12,
    biennial: 24,
  }[term];
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
      );
      return {
        ready: true,
        accounts: accounts.map((u) => ({
          ...u,
          access: access.find((a) => a.user_id === u.id) || null,
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
            "plan",
            "expiresAt",
            "notes",
            "revokeSessions",
          ].includes(k),
      ) ||
      !["active", "pending", "blocked"].includes(data.status) ||
      (data.plan !== undefined &&
        ![
          "standard",
          "trial",
          "monthly",
          "quarterly",
          "annual",
          "custom",
        ].includes(data.plan)) ||
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
          {
            trial7: "trial",
            trial14: "trial",
            unlimited: "standard",
            bimonthly: "custom",
            semiannual: "custom",
            biennial: "custom",
          }[data.term] || data.term;
      }
    } catch (e) {
      if (e.code) throw e;
      fail(
        400,
        "invalid_expiry",
        "Escolha um prazo válido ou uma data futura.",
      );
    }
    if (data.plan !== undefined) plan = data.plan;
    if (data.status === "active" && expiry && Date.parse(expiry) <= Date.now())
      fail(
        400,
        "expired_access",
        "O prazo atual já encerrou. Escolha um novo prazo para liberar o acesso.",
      );
    const result = await request("/rest/v1/rpc/elitex_admin_manage", {
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
    if (result?.ok !== true)
      fail(
        502,
        "unconfirmed_access",
        "O banco não confirmou a alteração. Atualize a lista antes de tentar novamente.",
      );
    return {
      ok: true,
      account: { id: data.id, status: data.status, plan, expires_at: expiry },
    };
  }
  async function audit(current, id) {
    admin(current);
    if (!uuid(id)) fail(400, "invalid_account", "Conta inválida.");
    return request(
      "/rest/v1/elitex_admin_audit?user_id=eq." +
        id +
        "&action=eq.access_updated&select=id,action,details,created_at&order=created_at.desc,id.desc&limit=50",
      { admin: true },
    );
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

  return { ownAccess, list, update, audit, legacyAccess };
}
module.exports = { createManagement, expiryFor };
