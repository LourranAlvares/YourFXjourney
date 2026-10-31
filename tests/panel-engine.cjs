"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  P = require("../public/panel-engine.js");
const html = fs.readFileSync("YourFXjourney.html", "utf8"),
  ctx = {
    S: { balance: 1000 },
    INS_DEFAULTS: { breakeven: 0 },
    insRules: () => ({ breakeven: 0 }),
  };
vm.createContext(ctx);
vm.runInContext(
  html.slice(html.indexOf("function st(ts)"), html.indexOf("function grp(")),
  ctx,
);
const trade = (id, pnl, date = "2026-10-10", risk = 100) => ({
    id,
    pnl,
    close: date + "T12:00",
    open: date + "T10:00",
    risk,
    symbol: "EURUSD",
    side: "long",
  }),
  rows = [
    trade("w", 200),
    trade("l", -100, "2026-10-11"),
    trade("b", 0, "2026-10-12", null),
  ];
const state = {
    trades: rows,
    balance: 1000,
    balanceConfirmed: true,
    currency: "USD",
  },
  adapter = {
    stats: ctx.st,
    realizedR: (t) => ({
      value: t.risk ? t.pnl / t.risk : null,
      source: "money",
    }),
    universe: () => state.trades,
    session: () => "London",
    process: (ts) => ({
      checked: ts.map((t) => ({
        t,
        c: { plan: null, risk: null, limits: null },
      })),
      plan: { n: 0, value: null },
    }),
  },
  query = { today: "2026-10-31", from: "2026-10-01", to: "2026-10-31" };
let m = P.model(state, query, adapter);
assert.equal(m.s.net, 100);
assert(Math.abs(m.s.wr - 100 / 3) < 1e-10);
assert.equal(m.s.pf, 2);
assert.equal(m.s.dd, 100);
assert.equal(m.r, 1);
assert.equal(m.known, 2);
assert.equal(m.actualRisk, null);
assert.equal(m.returns.percent, 10);
assert.equal(m.cap.balance, 1100);
assert.equal(m.cap.maxDD, 100);
assert(Math.abs(m.breakEvenRate - 100 / 3) < 1e-10);
assert.equal(P.select(rows, { symbol: "XXX" }, adapter).length, 0);
assert.equal(P.select(rows, { side: "short" }, adapter).length, 0);
assert.equal(
  P.periodReturn(
    { ...state, balanceConfirmed: false },
    rows,
    query.from,
    query.to,
    rows,
  ).percent,
  null,
);
const flows = [
  {
    id: "d",
    type: "deposit",
    amount: 1000,
    at: "2026-10-16T12:00",
    currency: "USD",
  },
  {
    id: "s",
    type: "withdrawal",
    amount: 200,
    at: "2026-10-20T12:00",
    currency: "USD",
  },
];
state.capitalMovements = flows;
let cap = P.capital(state, rows, "", query.to);
assert.equal(cap.net, 100);
assert.equal(cap.balance, 1900);
assert.equal(cap.maxDD, 100);
assert.equal(cap.currentDD, 100);
let ret = P.periodReturn(state, rows, query.from, query.to, rows);
assert.match(ret.method, /Dietz/);
assert(ret.percent > 6 && ret.percent < 8);
assert.equal(
  P.movements({ ...state, capitalMovements: [...flows, flows[0]] }).length,
  2,
);
assert.equal(
  P.periodReturn(
    { ...state, balance: 0, capitalMovements: [] },
    rows,
    query.from,
    query.to,
    rows,
  ).percent,
  null,
);
assert(
  P.periodReturn({ ...state, balance: 0 }, rows, query.from, query.to, rows)
    .percent > 0,
);
assert.equal(
  P.periodReturn({ ...state, balance: -1 }, rows, query.from, query.to, rows)
    .percent,
  null,
);
state.trades = [...rows, trade("eur", 100)];
state.trades.at(-1).currency = "EUR";
m = P.model(state, query, adapter);
assert(m.mixed);
assert.equal(m.returns.percent, null);
assert.equal(m.payoff, null);
assert(!m.cap.available);
state.trades = rows.map((t, i) => ({ ...t, accountId: i % 2 ? "b" : "a" }));
m = P.model(state, query, adapter);
assert.equal(m.pairs.length, 0);
assert.equal(m.afterLossN, 0);
assert(!m.cap.available);
assert.deepEqual(P.bounds("week", "2026-10-31"), {
  from: "2026-10-26",
  to: "2026-10-31",
});
assert.equal(P.bounds("quarter", "2026-01-15").from, "2025-11-01");
assert.equal(P.validDate("2026-02-30"), false);
assert.equal(
  P.rDistribution([-3, -2, -1, 0, 0.5, 1, 2]).reduce((v, b) => v + b.n, 0),
  7,
);
state.trades = [];
state.growth = { checkins: [null], decisions: [null] };
m = P.model(state, query, adapter);
assert.equal(m.s.n, 0);
assert.equal(m.r, null);
assert.equal(m.returns.percent, null);
console.log(
  "PASS panel: authoritative stats, BE, missing R, account filters, cash-flow/DD separation, Dietz, unavailable capital/currency, multi-account sequences, malformed/empty records",
);
