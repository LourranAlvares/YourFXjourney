"use strict";
const crypto = require("node:crypto");
const { APIError } = require("../providers.cjs");
const EMPTY = { trades: [], reviews: {}, strats: [], balance: 10000 };
function createCloud({ env, fetchFn = fetch, secure = false }) {
  const enabled = env.ELITEX_CLOUD_ENABLED === "true" || !!env.SUPABASE_URL;
  if (!enabled) return null;
  const url = String(env.SUPABASE_URL || "").replace(/\/$/, ""),
    anon = env.SUPABASE_ANON_KEY,
    service = env.SUPABASE_SERVICE_ROLE_KEY,
    secret = env.ELITEX_SESSION_SECRET,
    owner = String(env.ELITEX_ADMIN_EMAIL || "")
      .trim()
      .toLowerCase(),
    origin = env.TRADE_ALLOWED_ORIGIN;
  // Report names only: setup logs must never expose supplied secrets or values.
  const issues = [];
  if (!/^https:\/\/[a-zA-Z0-9.-]+$/.test(url))
    issues.push("SUPABASE_URL (ausente ou URL HTTPS inválida)");
  if (typeof anon !== "string" || !anon.trim())
    issues.push("SUPABASE_ANON_KEY (ausente)");
  if (typeof service !== "string" || !service.trim())
    issues.push("SUPABASE_SERVICE_ROLE_KEY (ausente)");
  if (typeof secret !== "string" || secret.length < 32)
    issues.push(
      "ELITEX_SESSION_SECRET (ausente ou com menos de 32 caracteres)",
    );
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner))
    issues.push("ELITEX_ADMIN_EMAIL (ausente ou e-mail inválido)");
  if (typeof origin !== "string" || !origin.trim())
    issues.push("TRADE_ALLOWED_ORIGIN (ausente)");
  if (issues.length)
    throw Error(
      "Configuração da nuvem incompleta ou inválida. Corrija no Render → Environment: " +
        issues.join("; ") +
        ". Nenhum valor secreto é exibido neste log.",
    );
  const key = crypto.createHash("sha256").update(secret).digest(),
    refreshing = new Map();
  const fail = (status, code, message) => {
    throw new APIError(status, code, message);
  };
  const sign = (value) =>
    crypto.createHmac("sha256", key).update(value).digest("base64url");
  function seal(value) {
    const iv = crypto.randomBytes(12),
      cipher = crypto.createCipheriv("aes-256-gcm", key, iv),
      data = Buffer.concat([
        cipher.update(JSON.stringify(value)),
        cipher.final(),
      ]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
  }
  function unseal(value) {
    try {
      const b = Buffer.from(value, "base64url"),
        cipher = crypto.createDecipheriv("aes-256-gcm", key, b.subarray(0, 12));
      cipher.setAuthTag(b.subarray(12, 28));
      return JSON.parse(
        Buffer.concat([
          cipher.update(b.subarray(28)),
          cipher.final(),
        ]).toString(),
      );
    } catch {
      return null;
    }
  }
  function read(req, name) {
    return unseal(
      (req.headers.cookie || "")
        .split(";")
        .map((v) => v.trim())
        .find((v) => v.startsWith(name + "="))
        ?.slice(name.length + 1) || "",
    );
  }
  function cookies(
    res,
    tokens,
    nonce = crypto.randomBytes(32).toString("base64url"),
    version = 0,
  ) {
    const values = tokens
      ? [
          ["elitex_access", { token: tokens.access_token }, 3600],
          [
            "elitex_refresh",
            { token: tokens.refresh_token, nonce, version },
            30 * 86400,
          ],
        ]
      : [
          ["elitex_access", null, 0],
          ["elitex_refresh", null, 0],
        ];
    res.setHeader(
      "set-cookie",
      values.map(
        ([name, value, age]) =>
          `${name}=${value ? seal(value) : ""}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${secure ? "; Secure" : ""}`,
      ),
    );
    return nonce;
  }
  async function request(
    endpoint,
    { method = "GET", data, token, admin = false } = {},
  ) {
    let response;
    try {
      response = await fetchFn(url + endpoint, {
        method,
        signal: AbortSignal.timeout(15000),
        headers: {
          apikey: admin ? service : anon,
          ...(token
            ? { authorization: "Bearer " + token }
            : admin && service.startsWith("eyJ")
              ? { authorization: "Bearer " + service }
              : {}),
          "content-type": "application/json",
        },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      });
    } catch {
      fail(
        503,
        "cloud_unavailable",
        "A nuvem não respondeu. Seus dados locais foram preservados.",
      );
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      if (response.status === 409 || payload?.code === "PT409")
        fail(
          409,
          "workspace_conflict",
          "Há uma versão mais recente salva por outra sessão. Revise antes de substituir.",
        );
      if (response.status === 401 || response.status === 403)
        fail(
          response.status,
          "cloud_auth",
          "A sessão expirou ou este acesso não é permitido.",
        );
      if (response.status === 429)
        fail(
          429,
          "cloud_rate_limit",
          "Aguarde um pouco antes de tentar novamente.",
        );
      if (endpoint.startsWith("/auth/"))
        fail(
          400,
          "auth_failed",
          "Não foi possível concluir. Confira os dados e a confirmação do e-mail. A senha deve ter pelo menos 12 caracteres.",
        );
      fail(
        503,
        "cloud_unavailable",
        "Não foi possível acessar o banco na nuvem. Tente novamente; suas alterações locais foram preservadas.",
      );
    }
    return payload;
  }
  function publicProfile(p, user) {
    return {
      id: user.id,
      email: user.email,
      name: p.name || "",
      role:
        p.role === "admin" && user.email.toLowerCase() === owner
          ? "admin"
          : "member",
      status: p.status,
    };
  }
  async function profile(user) {
    if (!user?.id || !user.email || !user.email_confirmed_at)
      fail(403, "email_unconfirmed", "Confirme seu e-mail antes de entrar.");
    let rows = await request(
      "/rest/v1/elitex_profiles?id=eq." +
        encodeURIComponent(user.id) +
        "&select=id,email,name,role,status,session_version",
      { admin: true },
    );
    let p = rows?.[0];
    if (!p)
      fail(
        503,
        "cloud_schema_missing",
        "A conta ainda não está disponível no banco. Confira a configuração da nuvem.",
      );
    if (
      user.email.toLowerCase() === owner &&
      (p.role !== "admin" || p.status !== "active")
    ) {
      await request(
        "/rest/v1/elitex_profiles?id=eq." + encodeURIComponent(user.id),
        {
          admin: true,
          method: "PATCH",
          data: {
            role: "admin",
            status: "active",
            updated_at: new Date().toISOString(),
          },
        },
      );
      p = { ...p, role: "admin", status: "active" };
    }
    return {
      ...publicProfile(p, user),
      sessionVersion: Number(p.session_version || 0),
    };
  }
  async function establish(res, tokens, nonce) {
    if (!tokens?.access_token || !tokens.refresh_token)
      fail(400, "invalid_session", "Não foi possível iniciar a sessão.");
    const user = await request("/auth/v1/user", { token: tokens.access_token }),
      p = await profile(user);
    const n = cookies(res, tokens, nonce, p.sessionVersion);
    return {
      user: p,
      csrf: sign("csrf|" + n),
      token: tokens.access_token,
      expires: Date.now() + 3600e3,
    };
  }
  async function session(req, res) {
    const refresh = read(req, "elitex_refresh"),
      access = read(req, "elitex_access");
    if (!refresh?.token || !refresh.nonce) return null;
    let user,
      token = access?.token;
    try {
      if (token) user = await request("/auth/v1/user", { token });
    } catch (e) {
      if (![401, 403].includes(e.status)) throw e;
    }
    if (!user) {
      const k = sign(refresh.token);
      let flight = refreshing.get(k);
      if (!flight) {
        flight = request("/auth/v1/token?grant_type=refresh_token", {
          method: "POST",
          data: { refresh_token: refresh.token },
        });
        refreshing.set(k, flight);
        flight
          .finally(() => {
            const timer = setTimeout(() => refreshing.delete(k), 5000);
            timer.unref?.();
          })
          .catch(() => {});
      }
      let tokens;
      try {
        tokens = await flight;
      } catch (e) {
        if ([400, 401, 403].includes(e.status)) {
          cookies(res, null);
          return null;
        }
        throw e;
      }
      token = tokens.access_token;
      cookies(res, tokens, refresh.nonce, refresh.version);
      try {
        user = await request("/auth/v1/user", { token });
      } catch (e) {
        if ([401, 403].includes(e.status)) {
          cookies(res, null);
          return null;
        }
        throw e;
      }
    }
    const p = await profile(user);
    if (refresh.version !== p.sessionVersion) {
      cookies(res, null);
      return null;
    }
    return {
      user: p,
      token,
      csrf: sign("csrf|" + refresh.nonce),
      expires: Date.now() + 3600e3,
    };
  }
  function active(current) {
    if (!current) fail(401, "authentication_required", "Entre na sua conta.");
    if (current.user.status !== "active")
      fail(
        403,
        "account_" + current.user.status,
        current.user.status === "blocked"
          ? "Seu acesso foi bloqueado. Fale com a administração."
          : "Seu cadastro aguarda aprovação da administração.",
      );
  }
  function admin(current) {
    active(current);
    if (current.user.role !== "admin")
      fail(403, "admin_required", "Esta ação exige a conta administradora.");
  }
  const validEmail = (v) =>
    typeof v === "string" &&
    v.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  async function auth(action, data, res, current) {
    if (action === "signup") {
      if (
        !validEmail(data.email) ||
        typeof data.password !== "string" ||
        data.password.length < 12 ||
        data.password.length > 256 ||
        typeof data.name !== "string" ||
        !data.name.trim() ||
        data.name.length > 100
      )
        fail(
          400,
          "invalid_registration",
          "Informe nome, e-mail válido e senha de 12 a 256 caracteres.",
        );
      await request(
        "/auth/v1/signup?redirect_to=" +
          encodeURIComponent(origin + "/account"),
        {
          method: "POST",
          data: {
            email: data.email.trim().toLowerCase(),
            password: data.password,
            data: { name: data.name.trim() },
          },
        },
      );
      return {
        message:
          "Confira seu e-mail para confirmar o cadastro. Depois, seu acesso será liberado pela administração.",
      };
    }
    if (action === "login") {
      if (
        !validEmail(data.email) ||
        typeof data.password !== "string" ||
        data.password.length > 256
      )
        fail(400, "invalid_credentials", "Confira o e-mail e a senha.");
      const tokens = await request("/auth/v1/token?grant_type=password", {
        method: "POST",
        data: {
          email: data.email.trim().toLowerCase(),
          password: data.password,
        },
      });
      const s = await establish(res, tokens);
      return { user: s.user, csrf: s.csrf };
    }
    if (action === "recover") {
      if (!validEmail(data.email))
        fail(400, "invalid_email", "Informe um e-mail válido.");
      await request(
        "/auth/v1/recover?redirect_to=" +
          encodeURIComponent(origin + "/account"),
        { method: "POST", data: { email: data.email.trim().toLowerCase() } },
      );
      return {
        message:
          "Se o e-mail estiver cadastrado, você receberá as instruções para criar uma nova senha.",
      };
    }
    if (action === "verify") {
      if (
        typeof data.token_hash !== "string" ||
        data.token_hash.length > 512 ||
        !["email", "signup", "recovery"].includes(data.type)
      )
        fail(400, "invalid_link", "Link inválido. Solicite um novo e-mail.");
      const tokens = await request("/auth/v1/verify", {
          method: "POST",
          data: { token_hash: data.token_hash, type: data.type },
        }),
        s = await establish(res, tokens);
      return { user: s.user, csrf: s.csrf, recovery: data.type === "recovery" };
    }
    if (action === "exchange") {
      if (
        typeof data.access_token !== "string" ||
        typeof data.refresh_token !== "string" ||
        data.access_token.length > 5000 ||
        data.refresh_token.length > 1000
      )
        fail(400, "invalid_link", "Link inválido.");
      const s = await establish(res, data);
      return { user: s.user, csrf: s.csrf };
    }
    if (action === "password") {
      if (!current)
        fail(
          401,
          "authentication_required",
          "Entre novamente para trocar a senha.",
        );
      if (
        typeof data.password !== "string" ||
        data.password.length < 12 ||
        data.password.length > 256
      )
        fail(400, "invalid_password", "Use uma senha de 12 a 256 caracteres.");
      await request("/auth/v1/user", {
        method: "PUT",
        token: current.token,
        data: { password: data.password },
      });
      await request(
        "/rest/v1/elitex_profiles?id=eq." + encodeURIComponent(current.user.id),
        {
          admin: true,
          method: "PATCH",
          data: { session_version: current.user.sessionVersion + 1 },
        },
      );
      cookies(res, null);
      return { message: "Senha atualizada." };
    }
    if (action === "logout") {
      try {
        if (current)
          await request(
            "/rest/v1/elitex_profiles?id=eq." +
              encodeURIComponent(current.user.id),
            {
              admin: true,
              method: "PATCH",
              data: { session_version: current.user.sessionVersion + 1 },
            },
          );
        if (current)
          await request("/auth/v1/logout?scope=global", {
            method: "POST",
            token: current.token,
          });
      } finally {
        cookies(res, null);
      }
      return { authenticated: false };
    }
    fail(404, "not_found", "Ação não encontrada.");
  }
  async function workspace(current, method, data) {
    active(current);
    const id = encodeURIComponent(current.user.id);
    if (method === "GET") {
      const rows = await request(
        "/rest/v1/elitex_workspaces?user_id=eq." +
          id +
          "&select=data,revision,updated_at",
        { token: current.token },
      );
      return rows?.[0]
        ? {
            data: rows[0].data,
            revision: Number(rows[0].revision),
            updatedAt: rows[0].updated_at,
          }
        : { data: EMPTY, revision: 0, updatedAt: null };
    }
    if (
      Object.keys(data).some(
        (k) => !["data", "revision", "mutationId"].includes(k),
      ) ||
      !Number.isSafeInteger(data.revision) ||
      data.revision < 0 ||
      !/^[-a-f0-9]{36}$/i.test(data.mutationId || "") ||
      !data.data ||
      !Array.isArray(data.data.trades) ||
      !Array.isArray(data.data.strats) ||
      !data.data.reviews ||
      Array.isArray(data.data.reviews) ||
      typeof data.data.reviews !== "object"
    )
      fail(
        400,
        "invalid_workspace",
        "O formato dos dados não é válido. Nenhuma alteração foi salva na nuvem.",
      );
    return request("/rest/v1/rpc/elitex_save_workspace", {
      method: "POST",
      token: current.token,
      data: {
        expected_revision: data.revision,
        workspace_data: data.data,
        mutation_id: data.mutationId,
      },
    });
  }
  async function listAccounts(current) {
    admin(current);
    return request(
      "/rest/v1/elitex_profiles?select=id,email,name,role,status,created_at,updated_at&order=created_at.desc&limit=500",
      { admin: true },
    );
  }
  async function setAccess(current, data) {
    admin(current);
    if (
      !/^[a-f0-9-]{36}$/i.test(data.id || "") ||
      !["active", "blocked", "pending"].includes(data.status) ||
      Object.keys(data).some((k) => !["id", "status"].includes(k))
    )
      fail(400, "invalid_account", "Conta ou status inválido.");
    if (data.id === current.user.id)
      fail(
        400,
        "owner_protected",
        "A conta administradora não pode bloquear a si própria.",
      );
    const rows = await request(
      "/rest/v1/elitex_profiles?id=eq." +
        encodeURIComponent(data.id) +
        "&select=id,role,email",
      { admin: true },
    );
    if (
      !rows?.[0] ||
      rows[0].role === "admin" ||
      rows[0].email.toLowerCase() === owner
    )
      fail(400, "owner_protected", "Não é possível alterar este acesso.");
    await request(
      "/rest/v1/elitex_profiles?id=eq." + encodeURIComponent(data.id),
      {
        admin: true,
        method: "PATCH",
        data: { status: data.status, updated_at: new Date().toISOString() },
      },
    );
    return { ok: true };
  }
  async function history(current, revision) {
    active(current);
    let query =
      "/rest/v1/elitex_workspace_history?user_id=eq." +
      encodeURIComponent(current.user.id);
    if (revision !== null) {
      if (!/^\d+$/.test(revision))
        fail(400, "invalid_revision", "Versão inválida.");
      query += "&revision=eq." + revision + "&select=data,revision,created_at";
    } else query += "&select=revision,created_at&order=revision.desc&limit=3";
    return request(query, { token: current.token });
  }
  return {
    enabled,
    session,
    auth,
    active,
    admin,
    workspace,
    listAccounts,
    setAccess,
    history,
    cookies,
  };
}
module.exports = { createCloud };
