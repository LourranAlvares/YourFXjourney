"use strict";
const http = require("node:http"),
  crypto = require("node:crypto"),
  fs = require("node:fs/promises"),
  path = require("node:path");
const { createProviders, APIError } = require("./providers.cjs");
const ROOT = path.resolve(__dirname, "..");
function createApp(options = {}) {
  const env = options.env || process.env,
    engine = options.engine || require("../public/plan-engine.js"),
    providers = createProviders({
      env,
      engine,
      fetchFn: options.fetchFn || global.fetch,
      now: options.now || (() => new Date()),
    }),
    sessions = new Map(),
    attempts = new Map(),
    requests = new Map(),
    password = env.TRADE_ASSISTANT_PASSWORD || "",
    configured = password.length >= 12,
    salt = crypto.randomBytes(32),
    passwordHash = configured ? crypto.scryptSync(password, salt, 64) : null,
    allowedOrigin = env.TRADE_ALLOWED_ORIGIN || null;
  let secure = env.TRADE_COOKIE_SECURE === "true";
  if (allowedOrigin) {
    const u = new URL(allowedOrigin);
    if (!["https:", "http:"].includes(u.protocol) || u.origin !== allowedOrigin)
      throw new Error(
        "TRADE_ALLOWED_ORIGIN deve ser uma origem HTTP/HTTPS, sem caminho.",
      );
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname) &&
      u.protocol !== "https:"
    )
      throw new Error("Origens públicas exigem HTTPS.");
    if (u.protocol === "https:") secure = true;
  }
  const timingEqual = (a, b) =>
      a.length === b.length && crypto.timingSafeEqual(a, b),
    json = (res, status, data) => {
      res.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      });
      res.end(JSON.stringify(data));
    },
    cookie = (value, maxAge) =>
      `trade_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
  function session(req) {
    const match = (req.headers.cookie || "").match(
        /(?:^|;\s*)trade_session=([A-Za-z0-9_-]{43})(?:;|$)/,
      ),
      token = match?.[1],
      s = token ? sessions.get(token) : null;
    if (s && s.expires > Date.now()) return s;
    if (token) sessions.delete(token);
    return null;
  }
  function trustOrigin(req) {
    let host;
    try {
      host = new URL("http://" + req.headers.host);
    } catch {
      return false;
    }
    if (allowedOrigin) {
      const target = new URL(allowedOrigin);
      if (host.host !== target.host) return false;
      if (req.headers.origin && req.headers.origin !== allowedOrigin)
        return false;
    } else {
      if (!["localhost", "127.0.0.1", "[::1]"].includes(host.hostname))
        return false;
      if (
        req.headers.origin &&
        req.headers.origin !==
          (req.socket.encrypted ? "https:" : "http:") + "//" + host.host
      )
        return false;
    }
    return req.headers["sec-fetch-site"] !== "cross-site";
  }
  function rate(map, key, limit, window) {
    const now = Date.now();
    let entry = map.get(key);
    if (!entry || entry.until < now) {
      entry = { n: 0, until: now + window };
      map.set(key, entry);
    }
    entry.n++;
    if (map.size > 2000)
      for (const [k, v] of map) if (v.until < now) map.delete(k);
    if (entry.n > limit)
      throw new APIError(
        429,
        "rate_limited",
        "Muitas tentativas. Aguarde antes de tentar novamente.",
      );
  }
  async function body(req) {
    if (req.headers["content-type"]?.split(";")[0] !== "application/json")
      throw new APIError(415, "invalid_content_type", "Use JSON.");
    if (Number(req.headers["content-length"]) > 9 * 1024 * 1024)
      throw new APIError(
        413,
        "body_too_large",
        "Arquivo excedeu o limite de upload.",
      );
    let size = 0,
      chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 9 * 1024 * 1024)
        throw new APIError(
          413,
          "body_too_large",
          "Arquivo excedeu o limite de upload.",
        );
      chunks.push(chunk);
    }
    let result;
    try {
      result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new APIError(400, "invalid_json", "JSON inválido.");
    }
    if (!result || typeof result !== "object" || Array.isArray(result))
      throw new APIError(400, "invalid_json", "Objeto JSON obrigatório.");
    return result;
  }
  const handler = async (req, res) => {
    res.setHeader("x-content-type-options", "nosniff");
    res.setHeader("referrer-policy", "no-referrer");
    res.setHeader("x-frame-options", "DENY");
    res.setHeader(
      "permissions-policy",
      "camera=(), microphone=(), geolocation=()",
    );
    let url;
    try {
      url = new URL(req.url, "http://localhost");
    } catch {
      json(res, 400, {
        error: { code: "invalid_url", message: "URL inválida." },
      });
      return;
    }
    try {
      if (!trustOrigin(req))
        throw new APIError(403, "invalid_origin", "Origem não autorizada.");
      if (url.pathname.startsWith("/api/")) {
        const current = session(req);
        if (req.method === "GET" && url.pathname === "/api/status") {
          json(res, 200, {
            authenticated: !!current,
            csrf: current?.csrf || null,
            authConfigured: configured,
            services: {
              ai: !!env.TRADE_AI_KEY,
              economicCalendar: !!env.TRADE_ECONOMIC_KEY,
              marketConditions: !!env.TRADE_MARKET_KEY,
            },
            mode: "single-owner-local",
            serverTime: new Date().toISOString(),
          });
          return;
        }
        if (req.method === "POST" && url.pathname === "/api/login") {
          if (!configured)
            throw new APIError(
              503,
              "auth_unconfigured",
              "Configure TRADE_ASSISTANT_PASSWORD com pelo menos 12 caracteres no servidor.",
            );
          const ip = req.socket.remoteAddress || "unknown";
          rate(attempts, ip, 8, 15 * 60e3);
          const data = await body(req);
          if (
            typeof data.password !== "string" ||
            data.password.length > 1024 ||
            !timingEqual(
              crypto.scryptSync(data.password, salt, 64),
              passwordHash,
            )
          )
            throw new APIError(401, "invalid_credentials", "Senha inválida.");
          attempts.delete(ip);
          if (current) sessions.delete(current.token);
          if (sessions.size >= 20)
            sessions.delete(sessions.keys().next().value);
          const token = crypto.randomBytes(32).toString("base64url"),
            s = {
              token,
              csrf: crypto.randomBytes(32).toString("base64url"),
              expires: Date.now() + 8 * 3600e3,
            };
          sessions.set(token, s);
          res.setHeader("set-cookie", cookie(token, 8 * 3600));
          json(res, 200, { authenticated: true, csrf: s.csrf });
          return;
        }
        if (!current)
          throw new APIError(
            401,
            "authentication_required",
            "Entre no assistente para acessar serviços online.",
          );
        if (
          req.method !== "GET" &&
          !timingEqual(
            Buffer.from(req.headers["x-csrf-token"] || ""),
            Buffer.from(current.csrf),
          )
        )
          throw new APIError(
            403,
            "invalid_csrf",
            "Sessão de segurança inválida. Atualize o login.",
          );
        if (req.method === "POST" && url.pathname === "/api/logout") {
          sessions.delete(current.token);
          res.setHeader("set-cookie", cookie("", 0));
          json(res, 200, { authenticated: false });
          return;
        }
        const aiRoute = ["/api/analyse", "/api/briefing"].includes(
          url.pathname,
        );
        rate(
          requests,
          aiRoute ? "owner:ai" : current.token + ":" + url.pathname,
          aiRoute ? 20 : 120,
          60 * 60e3,
        );
        if (req.method === "POST" && url.pathname === "/api/briefing") {
          json(
            res,
            200,
            await providers.briefing(await body(req), current.token),
          );
          return;
        }
        if (req.method === "POST" && url.pathname === "/api/analyse") {
          const result = await providers.analyse(
            await body(req),
            current.token,
          );
          json(res, 200, result);
          return;
        }
        if (req.method === "GET" && url.pathname === "/api/economic-calendar") {
          json(res, 200, await providers.economic(url.searchParams));
          return;
        }
        if (req.method === "GET" && url.pathname === "/api/market-conditions") {
          json(res, 200, await providers.market(url.searchParams));
          return;
        }
        throw new APIError(404, "not_found", "Endpoint não encontrado.");
      }
      if (!["GET", "HEAD"].includes(req.method))
        throw new APIError(405, "method_not_allowed", "Método não permitido.");
      let pathname;
      try {
        pathname = decodeURIComponent(url.pathname);
      } catch {
        throw new APIError(400, "invalid_path", "Caminho inválido.");
      }
      const publicPath = pathname === "/" ? "/YourFXjourney.html" : pathname;
      const allowed =
        ["/YourFXjourney.html", "/YourFXjourney-standalone.html"].includes(
          publicPath,
        ) ||
        /^\/public\/[A-Za-z0-9_./-]+\.(?:js|css|svg|png|ico)$/.test(
          publicPath,
        ) ||
        /^\/vendor\/ocr\/[A-Za-z0-9_./-]+\.(?:js|gz|wasm)$/.test(publicPath);
      if (
        !allowed ||
        publicPath.split("/").some((p) => p === ".." || p.startsWith("."))
      )
        throw new APIError(404, "not_found", "Arquivo não encontrado.");
      const file = path.resolve(ROOT, "." + publicPath);
      if (!file.startsWith(ROOT + path.sep))
        throw new APIError(404, "not_found", "Arquivo não encontrado.");
      const real = await fs.realpath(file).catch(() => null);
      if (!real || real !== file || !real.startsWith(ROOT + path.sep))
        throw new APIError(404, "not_found", "Arquivo não encontrado.");
      const stat = await fs.stat(real);
      if (!stat.isFile())
        throw new APIError(404, "not_found", "Arquivo não encontrado.");
      const types = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".wasm": "application/wasm",
        ".gz": "application/octet-stream",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".ico": "image/x-icon",
      };
      res.setHeader(
        "content-type",
        types[path.extname(real)] || "application/octet-stream",
      );
      res.setHeader("content-length", stat.size);
      res.setHeader(
        "cache-control",
        publicPath.startsWith("/vendor/") ? "public,max-age=86400" : "no-cache",
      );
      res.setHeader(
        "content-security-policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; worker-src 'self' blob:; connect-src 'self' blob:; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
      );
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      res.end(await fs.readFile(real));
    } catch (e) {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      const status =
          e instanceof APIError
            ? e.status
            : e?.name === "TimeoutError" || e?.name === "AbortError"
              ? 504
              : 500,
        code =
          e instanceof APIError
            ? e.code
            : status === 504
              ? "provider_timeout"
              : "internal_error",
        message =
          e instanceof APIError
            ? e.message
            : status === 504
              ? "O serviço demorou para responder. Tente novamente."
              : "Não foi possível concluir a solicitação.";
      json(res, status, { error: { code, message } });
    }
  };
  const server = http.createServer(handler);
  server.requestTimeout = 90000;
  server.headersTimeout = 15000;
  server.keepAliveTimeout = 5000;
  return { server, handler };
}
if (require.main === module) {
  const host = process.env.HOST || "127.0.0.1",
    port = Number(process.env.PORT || 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT inválida.");
  if (
    !["127.0.0.1", "localhost", "::1"].includes(host) &&
    (!process.env.TRADE_ALLOWED_ORIGIN ||
      !process.env.TRADE_ALLOWED_ORIGIN.startsWith("https://"))
  )
    throw new Error(
      "Para expor o servidor, configure TRADE_ALLOWED_ORIGIN com HTTPS.",
    );
  const { server } = createApp();
  server.listen(port, host, () => {
    console.log(`Trade Assistant ativo na porta ${port}.`);
    if (
      !process.env.TRADE_ASSISTANT_PASSWORD ||
      process.env.TRADE_ASSISTANT_PASSWORD.length < 12
    )
      console.log(
        "Serviços online bloqueados: configure TRADE_ASSISTANT_PASSWORD com pelo menos 12 caracteres.",
      );
    console.log(
      "Credenciais ficam somente no servidor. Consulte server/SETUP.md.",
    );
  });
}
module.exports = { createApp };
