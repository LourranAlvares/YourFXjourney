"use strict";
const crypto = require("node:crypto");
const MAIL = /^\/auth\/v1\/(signup|recover|resend)(?:\?|$)/;
function retrySeconds(value, now = Date.now()) {
  if (!value) return null;
  const n = /^\d+$/.test(String(value))
    ? Number(value)
    : Math.ceil((Date.parse(value) - now) / 1000);
  return Number.isFinite(n) && n > 0 ? Math.min(86400, Math.ceil(n)) : null;
}
function authError(endpoint, response, payload, APIError) {
  if (!endpoint.startsWith("/auth/")) return null;
  const code = payload?.code || payload?.error_code,
    mail = MAIL.test(endpoint),
    retry = retrySeconds(response.headers?.get("retry-after"));
  let name, message, status;
  if (
    code === "over_email_send_rate_limit" ||
    (mail &&
      response.status === 429 &&
      /email/i.test(String(payload?.msg || payload?.message || "")))
  ) {
    name = "auth_email_rate_limit";
    message =
      "O envio do e-mail de confirmação está temporariamente limitado. Se você já recebeu o e-mail, confirme por ele. Caso contrário, avise o suporte da plataforma.";
    status = 429;
  } else if (response.status === 429) {
    name = "auth_request_rate_limit";
    message =
      "Muitas tentativas no serviço de acesso. Aguarde antes de tentar novamente.";
    status = 429;
  } else if (
    mail &&
    [
      "email_address_not_authorized",
      "email_provider_disabled",
      "smtp_admin_unconfigured",
    ].includes(code)
  ) {
    name = "auth_email_configuration";
    message =
      "O envio de e-mails da plataforma precisa ser configurado. Avise o suporte; seus dados preenchidos foram mantidos.";
    status = 503;
  } else if (
    mail &&
    /error sending (confirmation|recovery|magic link) email/i.test(
      String(payload?.msg || payload?.message || ""),
    )
  ) {
    name = "auth_email_delivery";
    message =
      "Não foi possível enviar o e-mail de confirmação. Avise o suporte da plataforma e tente mais tarde.";
    status = 503;
  } else if (code === "email_not_confirmed") {
    name = "email_unconfirmed";
    message =
      "Confirme seu e-mail antes de entrar. Se não recebeu a mensagem, use “Reenviar confirmação”.";
    status = 403;
  }
  if (!name) return null;
  const error = new APIError(status, name, message);
  if (retry) error.retryAfterSeconds = retry;
  return error;
}
function createAuthFlow(rawRequest) {
  const sent = new Map(),
    flights = new Map();
  let lastError = null,
    lastAcceptedAt = null,
    pausedUntil = 0,
    pausedError = null;
  function record(error) {
    if (
      [
        "auth_email_rate_limit",
        "auth_email_configuration",
        "auth_email_delivery",
        "auth_request_rate_limit",
      ].includes(error.code)
    )
      lastError = { code: error.code, at: new Date().toISOString() };
  }
  async function send(endpoint, options = {}) {
    if (!MAIL.test(endpoint)) return rawRequest(endpoint, options);
    const now = Date.now(),
      key = crypto
        .createHash("sha256")
        .update(
          endpoint.split("?")[0] +
            "|" +
            String(options.data?.email || "")
              .trim()
              .toLowerCase(),
        )
        .digest("hex");
    for (const [k, until] of sent) if (until <= now) sent.delete(k);
    if (pausedUntil > now && pausedError) {
      const error = Object.assign(
        Object.create(Object.getPrototypeOf(pausedError)),
        pausedError,
      );
      error.message = pausedError.message;
      error.retryAfterSeconds = Math.ceil((pausedUntil - now) / 1000);
      throw error;
    }
    if (sent.get(key) > now) return {};
    if (flights.has(key)) return flights.get(key);
    const task = (async () => {
      try {
        await rawRequest(endpoint, options);
        sent.set(key, Date.now() + 60000);
        lastAcceptedAt = new Date().toISOString();
        return {};
      } catch (error) {
        record(error);
        if (error.status === 429) {
          pausedUntil = Date.now() + (error.retryAfterSeconds || 60) * 1000;
          pausedError = error;
        }
        throw error;
      } finally {
        flights.delete(key);
      }
    })();
    flights.set(key, task);
    return task;
  }
  return {
    request: send,
    health: () => ({
      state:
        lastError && (!lastAcceptedAt || lastError.at > lastAcceptedAt)
          ? lastError.code
          : lastAcceptedAt
            ? "provider_accepted"
            : "not_verified",
      lastErrorAt: lastError?.at || null,
      lastAcceptedAt,
      retryAfterSeconds:
        pausedUntil > Date.now()
          ? Math.ceil((pausedUntil - Date.now()) / 1000)
          : null,
      scope: "registration-email",
      smtpVerified: false,
    }),
  };
}
module.exports = { authError, createAuthFlow, retrySeconds };
