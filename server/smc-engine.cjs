"use strict";
const { APIError, validateImage } = require("./providers.cjs");
function createSMCEngine({ env = process.env, fetchFn = global.fetch } = {}) {
  const tenant = env.SMC_TENANT_ID || "loupply";
  let configured = !!(env.SMC_ENGINE_URL && env.SMC_SERVICE_TOKEN),
    base = null,
    configurationError = "";
  try {
    if (configured) {
      base = new URL(env.SMC_ENGINE_URL);
      if (
        !["http:", "https:"].includes(base.protocol) ||
        base.username ||
        base.password ||
        base.search ||
        base.hash
      )
        throw Error("SMC_ENGINE_URL inválida");
      if (
        !/^[A-Za-z0-9_-]{1,40}$/.test(tenant) ||
        env.SMC_SERVICE_TOKEN.length < 32
      )
        throw Error("Configuração privada SMC inválida");
    }
  } catch {
    configured = false;
    configurationError =
      "Configuração privada SMC inválida. Confira URL interna, token e tenant no servidor; o restante do site continua disponível.";
  }
  const owner = (user) =>
    tenant + ":" + (user?.id ? "user:" + user.id : "personal-owner");
  async function request(
    user,
    path,
    method = "GET",
    body = null,
    binary = false,
  ) {
    if (!configured)
      throw new APIError(
        503,
        "smc_unconfigured",
        configurationError ||
          "Motor SMC Python ainda não configurado neste servidor. Seus dados e a revisão manual permanecem disponíveis.",
      );
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 20000);
    try {
      const url = new URL(base);
      const [route, query] = path.split("?");
      url.pathname = base.pathname.replace(/\/$/, "") + route;
      url.search = query || "";
      const response = await fetchFn(url.href, {
        method,
        redirect: "error",
        signal: controller.signal,
        headers: {
          authorization: "Bearer " + env.SMC_SERVICE_TOKEN,
          "x-smc-owner": owner(user),
          ...(body ? { "content-type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > (binary ? 20 : 4) * 1024 * 1024)
        throw new APIError(
          502,
          "smc_invalid_response",
          "Resposta do motor grande demais.",
        );
      if (binary && response.ok) {
        const type = response.headers.get("content-type");
        if (!["image/png", "image/jpeg", "image/webp"].includes(type))
          throw new APIError(
            502,
            "smc_invalid_response",
            "Formato de imagem inválido na resposta do motor.",
          );
        return { bytes, type };
      }
      let result;
      try {
        result = JSON.parse(bytes.toString("utf8"));
      } catch {
        throw new APIError(
          502,
          "smc_invalid_response",
          "O serviço Python não retornou uma resposta válida.",
        );
      }
      if (!response.ok)
        throw new APIError(
          [400, 404, 409, 413, 429, 503].includes(response.status)
            ? response.status
            : 502,
          result.error?.code || "smc_error",
          String(result.error?.message || "Motor SMC indisponível.").slice(
            0,
            500,
          ),
        );
      return result;
    } catch (e) {
      if (e instanceof APIError) throw e;
      throw new APIError(
        503,
        "smc_unavailable",
        "O motor Python não respondeu. Confira o histórico antes de reenviar; não houve fallback para outro classificador.",
      );
    } finally {
      clearTimeout(timer);
    }
  }
  function id(value) {
    if (!/^[a-f0-9-]{36}$/.test(value))
      throw new APIError(400, "invalid_id", "Identificador inválido.");
    return value;
  }
  return {
    configured,
    status: (user) => request(user, "/health"),
    upload(user, body) {
      if (!body || Object.keys(body).some((k) => k !== "dataUrl"))
        throw new APIError(400, "invalid_image", "Envie apenas a imagem.");
      validateImage(body.dataUrl);
      return request(user, "/evidence", "POST", { dataUrl: body.dataUrl });
    },
    analyse(user, body) {
      if (
        !body ||
        body.engine !== "smc-elite-v1" ||
        Object.keys(body).some(
          (k) => !["engine", "requestId", "context", "images"].includes(k),
        )
      )
        throw new APIError(400, "invalid_request", "Solicitação SMC inválida.");
      return request(user, "/analyses", "POST", {
        requestId: body.requestId,
        context: body.context,
        images: body.images,
      });
    },
    history: (user, before) =>
      request(
        user,
        "/analyses" + (before ? "?before=" + encodeURIComponent(before) : ""),
      ),
    derived: (user, value, index) =>
      request(
        user,
        "/analyses/" + id(value) + "/images/" + index,
        "GET",
        null,
        true,
      ),
    get: (user, value) => request(user, "/analyses/" + id(value)),
    review: (user, value, body) =>
      request(user, "/analyses/" + id(value) + "/review", "POST", body),
    cancel: (user, value) =>
      request(user, "/analyses/" + id(value) + "/cancel", "POST", {}),
    image: (user, value) =>
      request(user, "/evidence/" + id(value), "GET", null, true),
  };
}
module.exports = { createSMCEngine };
