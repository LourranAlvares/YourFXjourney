const assert = require("node:assert/strict");
const E = require("../public/plan-engine.js");
let passed = 0;
const test = (name, run) => {
  run();
  passed++;
  console.log("PASS", name);
};
const criterion = (id, extra = {}) => ({
  id,
  label: id,
  definition: "Critério explícito " + id,
  weight: 1,
  required: true,
  critical: false,
  kind: "evidence",
  role: "confirmation",
  ...extra,
});
const plan = (criteria) => ({
  id: "plan-a",
  version: 1,
  name: "Plano pessoal",
  criteria,
});
const assessment = (criterionId, status = "met", extra = {}) => ({
  criterionId,
  status,
  evidence:
    status === "not_verifiable" ? "" : "Observação registrada no gráfico",
  reason: "Avaliação fundamentada",
  source: "ai",
  ...extra,
});
test("plan normalizer preserves machine-readable definitions and does not fabricate risk", () => {
  const p = E.validatePlan({
    ...plan([criterion("entry")]),
    instruments: ["EURUSD", "EURUSD"],
    notes: "Meu conceito próprio de BOS",
    risk: { minRR: 2 },
    news: { beforeMinutes: 20, afterMinutes: 10 },
  });
  assert.equal(p.risk.perTrade, null);
  assert.equal(p.risk.minRR, 2);
  assert.equal(p.notes, "Meu conceito próprio de BOS");
  assert.deepEqual(p.instruments, ["EURUSD"]);
  assert.equal(p.news.beforeMinutes, 20);
});
test("strict plans reject duplicate IDs, invalid weights, nonnumeric risk and absent criteria", () => {
  for (const raw of [
    plan([]),
    plan([criterion("a"), criterion("a")]),
    plan([criterion("a", { weight: 0 })]),
    { ...plan([criterion("a")]), risk: { perTrade: "1%" } },
    { ...plan([criterion("a")]), risk: false },
    { ...plan([criterion("a")]), version: 1.5 },
    plan([criterion("a", { kind: "probability" })]),
  ])
    assert.throws(() => E.validatePlan(raw), E.ValidationError);
});
test("weighted score and evidence coverage are transparent and deterministic", () => {
  const p = plan([
      criterion("a", { weight: 3 }),
      criterion("b", { weight: 1, required: false }),
    ]),
    s = E.scorePlan(p, [assessment("a"), assessment("b", "not_verifiable")]);
  assert.equal(s.score, 75);
  assert.equal(s.coverage, 75);
  assert.equal(s.status, "compliant");
  assert.equal(s.requiredMet, 1);
  assert.equal(s.totalWeight, 4);
});
test("failed critical requirement blocks compliance even at high score", () => {
  const p = plan([
      criterion("a", { weight: 99 }),
      criterion("b", { weight: 1, critical: true }),
    ]),
    s = E.scorePlan(p, [assessment("a"), assessment("b", "failed")]);
  assert.equal(s.score, 99);
  assert.equal(s.status, "not_compliant");
  assert.equal(s.blockers[0].criterionId, "b");
});
test("missing critical evidence cannot become a successful criterion", () => {
  const p = plan([criterion("a"), criterion("b", { critical: true })]),
    s = E.scorePlan(p, [assessment("a")]);
  assert.equal(s.score, 50);
  assert.equal(s.coverage, 50);
  assert.equal(s.status, "needs_review");
  assert.equal(s.assessments[1].status, "not_verifiable");
});
test("active invalidations block regardless of score; absence earns satisfied weight", () => {
  const p = plan([
    criterion("entry", { weight: 99 }),
    criterion("invalid", { role: "invalidation", required: false }),
  ]);
  const blocked = E.scorePlan(p, [assessment("entry"), assessment("invalid")]);
  assert.equal(blocked.score, 99);
  assert.equal(blocked.status, "not_compliant");
  const absent = E.scorePlan(p, [
    assessment("entry"),
    assessment("invalid", "failed"),
  ]);
  assert.equal(absent.score, 100);
  assert.equal(absent.status, "compliant");
  const unknown = E.scorePlan(p, [assessment("entry")]);
  assert.equal(unknown.status, "needs_review");
});
test("unknown/duplicate criterion IDs and unsupported assertions are rejected", () => {
  const p = plan([criterion("a")]);
  for (const rows of [
    [assessment("unknown")],
    [assessment("a"), assessment("a")],
    [assessment("a", "met", { evidence: "" })],
    [assessment("a", "maybe")],
    [assessment("a", "met", { source: "invented" })],
  ])
    assert.throws(() => E.validateAssessments(p, rows), E.ValidationError);
});
test("zero verified evidence never labels an optional-only plan compliant", () => {
  const s = E.scorePlan(plan([criterion("optional", { required: false })]), []);
  assert.equal(s.score, 0);
  assert.equal(s.coverage, 0);
  assert.equal(s.status, "needs_review");
});
test("numerical rules are calculated independently from model claims", () => {
  const p = {
    ...plan([
      criterion("rr", { kind: "minRR" }),
      criterion("risk", { kind: "maxRisk" }),
    ]),
    risk: { minRR: 2, perTrade: 1 },
  };
  const s = E.scorePlan(p, [assessment("rr"), assessment("risk")], {
    plannedRR: 1.5,
    plannedRisk: 2,
  });
  assert.equal(s.score, 0);
  assert.equal(s.status, "not_compliant");
  assert.ok(s.assessments.every((a) => a.source === "calculation"));
  assert.ok(s.assessments.every((a) => a.status === "failed"));
});
test("unknown numerical values and limits remain not verifiable, including zero risk threshold", () => {
  const p = plan([criterion("rr", { kind: "minRR" })]);
  assert.equal(E.scorePlan(p, [assessment("rr")], {}).status, "needs_review");
  assert.equal(
    E.assessContext({ ...p, risk: { minRR: 2 } }, { plannedRR: "3" })[0].status,
    "not_verifiable",
  );
});
test("risk invalidation applies inverse condition and respects a configured maximum", () => {
  const p = {
    ...plan([criterion("risk", { kind: "maxRisk", role: "invalidation" })]),
    risk: { perTrade: 1 },
  };
  assert.equal(E.scorePlan(p, [], { plannedRisk: 2 }).status, "not_compliant");
  assert.equal(E.scorePlan(p, [], { plannedRisk: 0.5 }).status, "compliant");
});
test("news and session rules require actual structured context, not missing/default truth", () => {
  const p = plan([
    criterion("news", { kind: "newsWindow" }),
    criterion("session", { kind: "session" }),
  ]);
  assert.ok(E.assessContext(p, {}).every((a) => a.status === "not_verifiable"));
  assert.equal(
    E.scorePlan(p, [], { newsBlocked: false, withinSession: true }).score,
    100,
  );
  assert.equal(
    E.scorePlan(p, [], { newsBlocked: true, withinSession: false }).status,
    "not_compliant",
  );
});
test("user corrections preserve original AI assessment, evidence and timestamp without mutation", () => {
  const p = plan([criterion("a")]),
    rows = [assessment("a", "failed")],
    before = JSON.stringify(rows);
  const r = E.applyCorrections(
    p,
    rows,
    [assessment("a", "met", { evidence: "Confirmei o candle de confirmação" })],
    undefined,
    "2026-10-27T10:00:00Z",
  );
  assert.equal(JSON.stringify(rows), before);
  assert.equal(r.original[0].status, "failed");
  assert.equal(r.assessments[0].source, "trader");
  assert.equal(r.corrections[0].previousStatus, "failed");
  assert.equal(r.corrections[0].correctedAt, "2026-10-27T10:00:00.000Z");
  assert.equal(r.score.score, 100);
});
test("corrections cannot override known numerical constraints unless context itself changes", () => {
  const p = {
      ...plan([criterion("rr", { kind: "minRR" })]),
      risk: { minRR: 2 },
    },
    r = E.applyCorrections(
      p,
      [assessment("rr", "failed")],
      [assessment("rr")],
      { plannedRR: 1 },
    );
  assert.equal(r.score.status, "not_compliant");
  assert.equal(r.score.assessments[0].source, "calculation");
});
console.log(`${passed} plan-engine tests passed`);
