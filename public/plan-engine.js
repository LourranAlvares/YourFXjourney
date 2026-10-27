/* Trade Assistant: deterministic, shared plan validation and scoring. No network or storage. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TradePlanEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  class ValidationError extends Error {
    constructor(issues) {
      super(issues.join("; "));
      this.name = "ValidationError";
      this.issues = issues;
    }
  }
  const statuses = ["met", "failed", "not_verifiable"],
    sources = ["ai", "trader", "calculation"];
  const kinds = ["evidence", "minRR", "maxRisk", "newsWindow", "session"];
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k),
    object = (o) => o !== null && typeof o === "object" && !Array.isArray(o),
    clone = (o) => JSON.parse(JSON.stringify(o));
  function validatePlan(raw) {
    const issues = [];
    if (!object(raw))
      throw new ValidationError(["O plano deve ser um objeto."]);
    const str = (value, path, max = 6000, required = false) => {
      if (value == null && !required) return "";
      if (
        typeof value !== "string" ||
        value.length > max ||
        (required && !value.trim())
      ) {
        issues.push(
          path +
            ": texto " +
            (required ? "obrigatório" : "inválido") +
            " (máximo " +
            max +
            ").",
        );
        return "";
      }
      return value.trim();
    };
    const number = (value, path, min, max) => {
      if (value == null || value === "") return null;
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < min ||
        value > max
      ) {
        issues.push(
          path + ": número fora do intervalo " + min + "–" + max + ".",
        );
        return null;
      }
      return value;
    };
    const bool = (value, path, defaultValue = false) => {
      if (value === undefined) return defaultValue;
      if (typeof value !== "boolean") {
        issues.push(path + ": use verdadeiro/falso.");
        return defaultValue;
      }
      return value;
    };
    const list = (value, path) => {
      if (value == null) return [];
      if (!Array.isArray(value) || value.length > 50) {
        issues.push(path + ": lista de até 50 itens.");
        return [];
      }
      return [
        ...new Set(
          value
            .map((x, i) => str(x, path + "[" + i + "]", 80, true))
            .filter(Boolean),
        ),
      ];
    };
    let risk = raw.risk == null ? {} : raw.risk,
      news = raw.news == null ? {} : raw.news;
    if (!object(risk)) {
      issues.push("risk deve ser objeto.");
      risk = {};
    }
    if (!object(news)) {
      issues.push("news deve ser objeto.");
      news = {};
    }
    const result = {
      id: raw.id == null ? "plan" : str(raw.id, "id", 100, true),
      version:
        raw.version == null ? 1 : number(raw.version, "version", 1, 1000000),
      name:
        raw.name == null
          ? "Meu Trading Plan"
          : str(raw.name, "name", 160, true),
      instruments: list(raw.instruments, "instruments"),
      timeframes: list(raw.timeframes, "timeframes"),
    };
    if (!Number.isInteger(result.version))
      issues.push("version deve ser um inteiro positivo.");
    if (raw.createdAt != null) {
      const createdAt = str(raw.createdAt, "createdAt", 50, true);
      if (Number.isNaN(Date.parse(createdAt)))
        issues.push("createdAt deve ser uma data válida.");
      result.createdAt = createdAt;
    }
    for (const k of [
      "biasRequirements",
      "structure",
      "entryConditions",
      "liquidityRules",
      "orderBlockRules",
      "invalidations",
      "management",
      "notes",
    ])
      result[k] = str(raw[k], k);
    result.risk = {
      perTrade: number(risk.perTrade, "risk.perTrade", Number.MIN_VALUE, 1e12),
      maxDaily: number(risk.maxDaily, "risk.maxDaily", Number.MIN_VALUE, 1e12),
      maxWeekly: number(
        risk.maxWeekly,
        "risk.maxWeekly",
        Number.MIN_VALUE,
        1e12,
      ),
      minRR: number(risk.minRR, "risk.minRR", Number.MIN_VALUE, 10000),
    };
    result.news = {
      beforeMinutes:
        news.beforeMinutes == null
          ? 15
          : number(news.beforeMinutes, "news.beforeMinutes", 0, 1440),
      afterMinutes:
        news.afterMinutes == null
          ? 15
          : number(news.afterMinutes, "news.afterMinutes", 0, 1440),
      avoidHighImpact: bool(news.avoidHighImpact, "news.avoidHighImpact", true),
    };
    for (const k of ["beforeMinutes", "afterMinutes"])
      if (!Number.isInteger(result.news[k]))
        issues.push("news." + k + " deve ser inteiro.");
    if (
      !Array.isArray(raw.criteria) ||
      raw.criteria.length < 1 ||
      raw.criteria.length > 40
    ) {
      issues.push("criteria deve conter de 1 a 40 critérios.");
      result.criteria = [];
    } else {
      const seen = new Set();
      result.criteria = raw.criteria.map((c, i) => {
        const path = "criteria[" + i + "]";
        if (!object(c)) {
          issues.push(path + " deve ser objeto.");
          return {};
        }
        const id = str(c.id, path + ".id", 80, true);
        if (!/^[A-Za-z0-9_-]+$/.test(id))
          issues.push(path + ".id: use letras, números, _ ou -.");
        if (seen.has(id)) issues.push("ID de critério duplicado: " + id);
        seen.add(id);
        const kind = c.kind || "evidence",
          role = c.role || "confirmation";
        if (!kinds.includes(kind)) issues.push(path + ".kind desconhecido.");
        if (!["confirmation", "invalidation"].includes(role))
          issues.push(path + ".role desconhecido.");
        const critical = bool(c.critical, path + ".critical"),
          required = bool(c.required, path + ".required");
        return {
          id,
          label: str(c.label, path + ".label", 180, true),
          definition: str(c.definition, path + ".definition", 4000, true),
          required: required || critical,
          critical,
          weight:
            c.weight == null
              ? 1
              : number(c.weight, path + ".weight", Number.MIN_VALUE, 1000),
          kind,
          role,
          threshold: number(c.threshold, path + ".threshold", 0, 1e12),
        };
      });
    }
    if (issues.length) throw new ValidationError(issues);
    return result;
  }
  function validateAssessments(rawPlan, raw) {
    const plan = validatePlan(rawPlan);
    if (!Array.isArray(raw))
      throw new ValidationError(["assessments deve ser uma lista."]);
    if (raw.length > plan.criteria.length)
      throw new ValidationError(["Há mais avaliações do que critérios."]);
    const byId = new Map(plan.criteria.map((c) => [c.id, c])),
      seen = new Set(),
      issues = [],
      out = [];
    for (const [i, a] of raw.entries()) {
      const path = "assessments[" + i + "]";
      if (!object(a)) {
        issues.push(path + " deve ser objeto.");
        continue;
      }
      const id = a.criterionId;
      if (typeof id !== "string" || !byId.has(id)) {
        issues.push(path + ": criterionId desconhecido.");
        continue;
      }
      if (seen.has(id)) {
        issues.push("Avaliação duplicada: " + id);
        continue;
      }
      seen.add(id);
      if (!statuses.includes(a.status)) {
        issues.push(path + ": status desconhecido.");
        continue;
      }
      const evidence = typeof a.evidence === "string" ? a.evidence.trim() : "";
      if (
        evidence.length > 6000 ||
        (a.status !== "not_verifiable" && !evidence)
      ) {
        issues.push(
          path +
            ": a conclusão precisa de evidência textual (até 6000 caracteres).",
        );
        continue;
      }
      const reason = a.reason == null ? "" : a.reason;
      if (typeof reason !== "string" || reason.length > 4000) {
        issues.push(path + ": reason inválido.");
        continue;
      }
      const source = a.source == null ? "ai" : a.source;
      if (!sources.includes(source)) {
        issues.push(path + ": source desconhecido.");
        continue;
      }
      out.push({
        criterionId: id,
        status: a.status,
        evidence,
        reason: reason.trim(),
        source,
      });
    }
    if (issues.length) throw new ValidationError(issues);
    const map = new Map(out.map((a) => [a.criterionId, a]));
    return plan.criteria.map(
      (c) =>
        map.get(c.id) || {
          criterionId: c.id,
          status: "not_verifiable",
          evidence: "",
          reason: "Não há evidência registrada para este critério.",
          source: "calculation",
        },
    );
  }
  function assessContext(rawPlan, context = {}) {
    const plan = validatePlan(rawPlan),
      out = [];
    for (const c of plan.criteria) {
      if (c.kind === "evidence") continue;
      let status = "not_verifiable",
        evidence = "",
        reason = "Informação necessária não fornecida.";
      if (c.kind === "minRR" || c.kind === "maxRisk") {
        const value =
            c.kind === "minRR" ? context.plannedRR : context.plannedRisk,
          threshold =
            c.threshold !== null
              ? c.threshold
              : c.kind === "minRR"
                ? plan.risk.minRR
                : plan.risk.perTrade;
        if (
          typeof value === "number" &&
          Number.isFinite(value) &&
          value >= 0 &&
          typeof threshold === "number" &&
          Number.isFinite(threshold) &&
          threshold > 0
        ) {
          const passes =
            c.kind === "minRR" ? value >= threshold : value <= threshold;
          status = passes ? "met" : "failed";
          evidence =
            c.kind === "minRR"
              ? `R:R planejado informado: ${value}; mínimo exigido: ${threshold}.`
              : `Risco planejado informado: ${value}; máximo exigido na mesma unidade: ${threshold}.`;
          reason = "Comparação numérica determinística.";
        } else
          reason =
            "Falta o valor planejado ou o limite definido no plano; não foi presumido.";
      }
      if (c.kind === "newsWindow" && typeof context.newsBlocked === "boolean") {
        status = context.newsBlocked ? "failed" : "met";
        evidence = context.newsBlocked
          ? "Existe evento dentro da janela de cautela configurada."
          : "Nenhum evento relevante dentro da janela de cautela verificada.";
        reason =
          "Verificação por eventos estruturados e configuração do plano.";
      }
      if (c.kind === "session" && typeof context.withinSession === "boolean") {
        status = context.withinSession ? "met" : "failed";
        evidence = context.withinSession
          ? "Horário dentro da sessão configurada."
          : "Horário fora da sessão configurada.";
        reason = "Verificação temporal determinística.";
      }
      if (c.role === "invalidation" && status !== "not_verifiable")
        status = status === "met" ? "failed" : "met";
      out.push({
        criterionId: c.id,
        status,
        evidence,
        reason,
        source: "calculation",
      });
    }
    return out;
  }
  function scorePlan(rawPlan, rawAssessments, context) {
    const plan = validatePlan(rawPlan);
    let assessments = validateAssessments(plan, rawAssessments);
    if (context !== undefined) {
      const deterministic = new Map(
        assessContext(plan, context).map((a) => [a.criterionId, a]),
      );
      assessments = assessments.map(
        (a) => deterministic.get(a.criterionId) || a,
      );
    }
    const map = new Map(assessments.map((a) => [a.criterionId, a]));
    let earnedWeight = 0,
      totalWeight = 0,
      verifiedWeight = 0,
      requiredMet = 0,
      requiredTotal = 0;
    const blockers = [];
    for (const c of plan.criteria) {
      const a = map.get(c.id),
        known = a.status !== "not_verifiable",
        satisfied =
          c.role === "invalidation"
            ? a.status === "failed"
            : a.status === "met";
      totalWeight += c.weight;
      if (known) verifiedWeight += c.weight;
      if (satisfied) earnedWeight += c.weight;
      if (c.required) {
        requiredTotal++;
        if (satisfied) requiredMet++;
      }
      const failed =
          c.role === "invalidation"
            ? a.status === "met"
            : (c.required || c.critical) && a.status === "failed",
        unknown =
          a.status === "not_verifiable" &&
          (c.required || c.critical || c.role === "invalidation");
      if (failed || unknown)
        blockers.push({
          criterionId: c.id,
          label: c.label,
          status: failed ? "failed" : "not_verifiable",
          reason: a.reason || a.evidence || "Evidência indisponível.",
          critical: c.critical,
          role: c.role,
        });
    }
    const status = blockers.some((b) => b.status === "failed")
      ? "not_compliant"
      : blockers.length || verifiedWeight === 0
        ? "needs_review"
        : "compliant";
    return {
      score: Math.round((earnedWeight / totalWeight) * 10000) / 100,
      coverage: Math.round((verifiedWeight / totalWeight) * 10000) / 100,
      status,
      earnedWeight,
      totalWeight,
      verifiedWeight,
      requiredMet,
      requiredTotal,
      blockers,
      assessments,
      formula:
        "100 × peso dos critérios satisfeitos ÷ peso total. Não verificáveis não ganham pontos. Invalidações ausentes contam como satisfeitas; invalidações presentes bloqueiam conformidade.",
    };
  }
  function applyCorrections(
    rawPlan,
    rawAssessments,
    rawCorrections,
    context,
    now = new Date(),
  ) {
    const plan = validatePlan(rawPlan),
      original = validateAssessments(plan, rawAssessments);
    if (!Array.isArray(rawCorrections))
      throw new ValidationError(["corrections deve ser uma lista."]);
    const unique = new Set();
    const checked = rawCorrections.map((c, i) => {
      if (!object(c) || typeof c.criterionId !== "string")
        throw new ValidationError(["Correção " + i + " inválida."]);
      if (unique.has(c.criterionId))
        throw new ValidationError(["Correção duplicada: " + c.criterionId]);
      unique.add(c.criterionId);
      return { ...c, source: "trader" };
    });
    const partial = validateAssessments(plan, checked),
      byId = new Map(
        partial
          .filter((a) => unique.has(a.criterionId))
          .map((a) => [a.criterionId, a]),
      );
    const assessments = original.map(
      (a) => byId.get(a.criterionId) || clone(a),
    );
    const corrections = checked.map((c) => {
      const a = byId.get(c.criterionId),
        before = original.find((o) => o.criterionId === c.criterionId);
      return {
        ...a,
        previousStatus: before.status,
        correctedAt: new Date(now).toISOString(),
      };
    });
    return {
      original: clone(original),
      assessments,
      corrections,
      score: scorePlan(plan, assessments, context),
    };
  }
  return Object.freeze({
    ValidationError,
    validatePlan,
    validateAssessments,
    assessContext,
    scorePlan,
    applyCorrections,
    statuses: Object.freeze(statuses),
    kinds: Object.freeze(kinds),
  });
});
