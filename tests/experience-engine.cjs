"use strict";
const assert = require("node:assert/strict"),
  E = require("../public/experience-engine.js");
const ctx = () => ({
    today: "2026-10-31",
    now: "2026-10-31T12:00Z",
    rows: [],
    hasAnyHistory: false,
    hasPlan: false,
    checks: [],
    presented: [],
    weekKey: "w",
  }),
  t = (id, pnl) => ({ id, pnl, symbol: "EURUSD", close: "2026-10-30T10:00" }),
  base = ctx();
assert.equal(E.select({}, base).type, "first");
let c = {
  ...ctx(),
  rows: [t("a", -1), t("b", -1), t("c", -1)],
  hasAnyHistory: true,
};
assert.equal(E.select({}, c).type, "loss");
assert(!/indisciplina/.test(E.select({}, c).message));
c.checks = [{ t: c.rows.at(-1), c: { plan: false } }];
assert.equal(E.select({}, c).type, "breach");
c.checks = [];
const state = {
  growth: {
    checkins: [null, { id: "f", emotion: "fomo", at: "2026-10-30T10:00Z" }],
  },
};
assert.equal(E.select(state, c).type, "fomo");
assert.equal(
  E.select(
    { ...state, assistantExperience: { preferences: { emotions: false } } },
    c,
  ).type,
  "loss",
);
state.growth.checkins[1].at = "2026-11-01T10:00Z";
assert.equal(E.select(state, c).type, "loss");
c.week = {
  rows: Array.from({ length: 5 }, (_, i) => t(i, -1)),
  s: { net: -5 },
  process: { plan: { n: 5, value: 100 } },
};
assert.equal(E.select({}, c).type, "disciplinedLoss");
c.week.process.plan.n = 4;
assert.equal(E.select({}, c).type, "loss");
c.week.process.plan.n = 5;
c.week.s.net = 10;
c.week.process.plan.value = 100;
c.previous = {
  rows: c.week.rows,
  s: { net: 0 },
  process: { plan: { n: 5, value: 60 } },
};
assert.equal(E.select({}, c).type, "improving");
c.week = null;
c.previous = null;
c.achievement = {
  id: "a",
  name: "Plan Commitment",
  range: { from: "2026-10-01", to: "2026-10-31" },
  note: "Critério documentado",
};
assert.equal(E.select({}, c).type, "achievement");
const off = {
  assistantExperience: {
    preferences: { history: false, emotions: false, goals: false },
  },
};
assert.equal(E.select(off, c).type, "returning");
const model = E.select({}, c);
c.presented = [{ key: model.key, at: c.now }];
assert.notEqual(E.select({}, c).type, "achievement");
c.currentKey = model.key;
assert.equal(E.select({}, c).key, model.key);
assert(!model.key.includes("Plan Commitment"));
assert(model.evidence.length);
assert.match(model.method, /determinísticas/);
console.log(
  "PASS assistant: evidence, loss vs discipline, FOMO explicit/future, full coverage, improvement, achievements, preferences and message continuity",
);
