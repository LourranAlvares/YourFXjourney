const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path");
const root = path.resolve(__dirname, ".."),
  SessionEngine = require("../public/session-engine.js"),
  code = fs.readFileSync(path.join(root, "public/daily-workspace.js"), "utf8"),
  html = fs.readFileSync(path.join(root, "YourFXjourney.html"), "utf8");
const originalDate = Date;
class FixedDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : ["2026-10-27T09:00:00Z"]));
  }
  static now() {
    return new originalDate("2026-10-27T09:00:00Z").getTime();
  }
}
let apiCalls = 0,
  renders = 0;
const profile = {
    name: "<Lohan>",
    timezone: "Europe/London",
    session: {
      enabled: true,
      label: "Londres",
      timezone: "Europe/London",
      start: "08:00",
      end: "11:00",
      days: [1, 2, 3, 4, 5],
    },
    instruments: ["GBPUSD"],
    newsBeforeMinutes: 15,
    newsAfterMinutes: 15,
  },
  ctx = {
    Date: FixedDate,
    Intl,
    URLSearchParams,
    Promise,
    Set,
    Map,
    SessionEngine,
    console,
    setTimeout,
    S: { trades: [], balance: 1000 },
    tab: "home",
    taConnection: { available: true, authenticated: true },
    taProfile: () => profile,
    taCurrentPlan: () => null,
    esc: (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;"),
    ymd: (d) =>
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0"),
    pad: (n) => String(n).padStart(2, "0"),
    day: (t) => t.close.slice(0, 10),
    money: (n) => String(n),
    metric: (l, v, c, n) => `<div>${l}: ${v} ${n || ""}</div>`,
    insProcess: () => ({ plan: { value: null, n: 0 } }),
    insErrorCounts: () => ({}),
    INS_ERRORS: [],
    R: () => renders++,
    taApi: async (url) => {
      apiCalls++;
      await new Promise((r) => setTimeout(r, 2));
      return url.startsWith("/api/economic-calendar")
        ? {
            events: [
              {
                id: "test",
                name: "Test fixture release",
                currency: "GBP",
                time: "2026-10-27T09:05:00Z",
                impact: "high",
                previous: null,
                forecast: 1,
                actual: null,
              },
            ],
            source: "Test fixture",
            asOf: "2026-10-27T09:00:00Z",
            cached: false,
          }
        : {
            instruments: [
              {
                symbol: "GBP/USD",
                volatility: "moderate",
                atrPercent: 0.2,
                asOf: "2026-10-27T08:00:00Z",
                delayed: false,
              },
            ],
            source: "Test fixture",
            asOf: "2026-10-27T09:00:00Z",
            method: { name: "ATR(14)", lowBelow: 0.15, highFrom: 0.5 },
          };
    },
  };
vm.createContext(ctx);
vm.runInContext(
  html.slice(html.indexOf("function st(ts)"), html.indexOf("function grp(")),
  ctx,
);
vm.runInContext(
  html.slice(
    html.indexOf("function rNumber("),
    html.indexOf("function saveSharedTradeR("),
  ),
  ctx,
);
vm.runInContext(code, ctx);
const run = (s) => vm.runInContext(s, ctx);
(async () => {
  assert.equal(run("taDailyDate()"), "2026-10-27");
  assert.deepEqual(Array.from(run("taDailyCurrencies()")), ["GBP", "USD"]);
  assert.equal(run("taDailySession().status"), "active");
  const event = { time: "2026-10-27T09:05:00Z", impact: "high" };
  ctx.event = event;
  assert.equal(run("taDailyEventWindow(event).withinSession"), true);
  assert.equal(run("taDailyEventWindow(event).caution"), true);
  assert.equal(run("taDailyEventTime({time:'2026-10-27 09:05:00'})"), null);
  console.log(
    "PASS local greeting date, currencies, active session and explicit timezone event cautions",
  );
  await Promise.all([run("taEnsureDailyData()"), run("taEnsureDailyData()")]);
  assert.equal(apiCalls, 2);
  assert.ok(renders >= 1);
  const home = run("vHome()");
  assert.match(home, /&lt;Lohan&gt;/);
  assert.match(home, /Test fixture release/);
  assert.match(home, /0 trades/);
  assert.match(home, /Preparação inicial/);
  assert.ok(!home.includes("85%"));
  console.log(
    "PASS authenticated provider calls deduplicate and home uses real response fields, escaping names and no invented insight",
  );
  await run("taEnsureDailyData()");
  assert.equal(apiCalls, 2);
  ctx.taConnection.available = false;
  assert.match(run("vHome()"), /indisponíveis no arquivo local/);
  assert.match(run("vEconomicCalendar()"), /indisponíveis no arquivo local/);
  console.log("PASS cached repeated rendering and offline availability states");
  ctx.taConnection.available = true;
  ctx.S.trades = [
    { close: "2026-10-26T10:00", pnl: 50, risk: 25 },
    { close: "2026-10-27T08:00", pnl: -20, risk: 20 },
    { close: "2026-10-28T08:00", pnl: 999, risk: 1 },
    { close: "2026-10-19T08:00", pnl: 100, risk: 50 },
  ];
  let week = run("taDailyWeekStats()");
  assert.equal(week.current.length, 2);
  assert.equal(week.previous.length, 1);
  assert.equal(week.r.total, 1);
  assert.equal(week.r.complete, true);
  assert.match(run("vHome()"), /Histórico insuficiente/);
  console.log(
    "PASS weekly snapshot preserves recorded trade dates and compares only equivalent elapsed weekdays",
  );
  ctx.S.trades[1].risk = null;
  week = run("taDailyWeekStats()");
  assert.equal(week.r.complete, false);
  assert.equal(week.r.n, 1);
  assert.match(run("vHome()"), /R líquido parcial/);
  console.log(
    "PASS missing risk is labelled partial rather than fabricated complete net R",
  );
  const calendar = run("vEconomicCalendar()");
  assert.match(calendar, /Anterior/);
  assert.match(calendar, /Previsão/);
  assert.match(calendar, /Atual/);
  assert.match(calendar, /Atenção na sessão/);
  console.log("PASS calendar event details and session warning");
  const callBefore = apiCalls;
  run("taEconomicDate('2026-10-28')");
  await run("taEnsureDailyData()");
  assert.equal(apiCalls, callBefore);
  ctx.tab = "economic";
  await run("taEnsureDailyData()");
  assert.equal(apiCalls, callBefore + 1);
  console.log(
    "PASS calendar selected date loads only when economic route is selected",
  );
  profile.timezone = "America/New_York";
  ctx.tab = "economic";
  run(
    `taDailyState.requests.set(taDailyKey('events','2026-10-27'),{status:'success',data:{events:[{time:'2026-10-28T02:00:00Z',currency:'USD',name:'Late local fixture'},{time:'2026-10-27T02:00:00Z',currency:'USD',name:'Previous local day'}]}})`,
  );
  assert.equal(run("taDailyEvents('2026-10-27').length"), 1);
  assert.equal(
    run("taDailyEvents('2026-10-27')[0].name"),
    "Late local fixture",
  );
  console.log(
    "PASS economic selected-day filtering includes next-UTC-day releases in the user timezone",
  );
  console.log("8 daily workspace checks passed");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
