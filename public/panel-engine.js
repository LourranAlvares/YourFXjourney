/* Pure dashboard projections. Existing journal functions remain the financial/R authority. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PanelEngine = api;
})(typeof globalThis === "undefined" ? this : globalThis, function () {
  "use strict";
  const number = (v) =>
      typeof v === "number" && Number.isFinite(v) ? v : null,
    sum = (a) => a.reduce((s, n) => s + n, 0),
    mean = (a) => (a.length ? sum(a) / a.length : null);
  const date = (t) => String(t.close || t.open || "").slice(0, 10),
    account = (t) => String(t.accountId || t.account || ""),
    validDate = (s) =>
      /^\d{4}-\d{2}-\d{2}$/.test(s || "") &&
      Number.isFinite(Date.parse(s + "T12:00Z")) &&
      new Date(s + "T12:00Z").toISOString().slice(0, 10) === s;
  function stamp(v) {
    if (typeof v !== "string") return null;
    const s = /^\d{4}-\d{2}-\d{2}$/.test(v)
      ? v + "T00:00:00Z"
      : /[zZ]|[+-]\d\d:\d\d$/.test(v)
        ? v
        : v + "Z";
    const n = Date.parse(s);
    return Number.isFinite(n) ? n : null;
  }
  function shift(d, n) {
    const t = new Date(d + "T12:00Z");
    t.setUTCDate(t.getUTCDate() + n);
    return t.toISOString().slice(0, 10);
  }
  function bounds(preset, today, custom = {}) {
    if (!validDate(today)) throw Error("Data operacional inválida.");
    let from = "",
      to = today;
    const y = +today.slice(0, 4),
      m = +today.slice(5, 7),
      d = new Date(today + "T12:00Z");
    if (preset === "today") from = today;
    else if (preset === "week") from = shift(today, -(d.getUTCDay() + 6) % 7);
    else if (preset === "month") from = today.slice(0, 7) + "-01";
    else if (preset === "quarter" || preset === "half") {
      const start = new Date(
        Date.UTC(y, m - (preset === "quarter" ? 3 : 6), 1),
      );
      from = start.toISOString().slice(0, 10);
    } else if (preset === "year") from = y + "-01-01";
    else if (preset === "custom") {
      from = custom.from || "";
      to = custom.to || today;
    } else if (["30", "90"].includes(preset))
      from = shift(today, -Number(preset) + 1);
    else if (preset === "lastmonth") {
      from = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
      to = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
    } else to = "";
    return { from, to };
  }
  function previous(range, rows, today) {
    if (!range.from) return null;
    const to = range.to || today,
      days = Math.round((stamp(to) - stamp(range.from)) / 86400000) + 1;
    return { from: shift(range.from, -days), to: shift(range.from, -1) };
  }
  function baseline(state, accountId = "") {
    const accounts = Array.isArray(state.tradingAccounts)
        ? state.tradingAccounts
        : [],
      entry = accounts.find((a) => String(a.id) === accountId);
    if (accountId && !entry && String(state.accountId || "") !== accountId)
      return { initial: null, currency: null };
    return {
      initial: entry
        ? entry.balanceConfirmed === true
          ? number(entry.initialBalance)
          : null
        : state.balanceConfirmed === true
          ? number(state.balance)
          : null,
      currency: entry?.currency || state.currency || null,
    };
  }
  function movements(state, accountId = "", to = "9999-12-31") {
    const raw = Array.isArray(state.capitalMovements)
        ? state.capitalMovements
        : [],
      seen = new Set();
    return raw
      .filter(
        (m) =>
          m &&
          typeof m.id === "string" &&
          !seen.has(m.id) &&
          ["deposit", "withdrawal"].includes(m.type) &&
          number(m.amount) > 0 &&
          stamp(m.at) !== null &&
          validDate(String(m.at).slice(0, 10)) &&
          String(m.at).slice(0, 10) <= to &&
          account(m) === accountId &&
          (seen.add(m.id) || true),
      )
      .map((m) => ({
        ...m,
        signed: m.type === "deposit" ? m.amount : -m.amount,
      }))
      .sort((a, b) => stamp(a.at) - stamp(b.at) || a.id.localeCompare(b.id));
  }
  function periodReturn(state, universe, from, to, selected, accountId = null) {
    const ids = [...new Set(selected.map(account))];
    if (accountId === null) accountId = ids.length === 1 ? ids[0] : "";
    if (ids.length > 1 || (!accountId && universe.some((t) => account(t))))
      return {
        percent: null,
        opening: null,
        denominator: null,
        method: "Conta não identificada",
      };
    const b = baseline(state, accountId),
      rows = universe.filter((t) => account(t) === accountId),
      flows = movements(state, accountId, to);
    if (b.initial === null)
      return {
        percent: null,
        opening: null,
        denominator: null,
        method: "Capital inicial não confirmado",
      };
    if (
      flows.some(
        (f) => f.currency && b.currency && f.currency !== b.currency,
      ) ||
      rows.some((t) => t.currency && b.currency && t.currency !== b.currency)
    )
      return {
        percent: null,
        opening: null,
        denominator: null,
        method: "Moedas incompatíveis; sem câmbio",
      };
    const start =
        from ||
        [
          ...rows.map(date),
          ...flows.map((f) => f.at.slice(0, 10)),
          to,
        ].sort()[0],
      opening =
        b.initial +
        sum(rows.filter((t) => date(t) < start).map((t) => t.pnl)) +
        sum(
          flows.filter((f) => f.at.slice(0, 10) < start).map((f) => f.signed),
        ),
      inside = flows.filter((f) => f.at.slice(0, 10) >= start),
      end = stamp(to + "T23:59:59.999"),
      begin = stamp(start),
      duration = end - begin;
    const denominator =
      opening +
      sum(
        inside.map(
          (f) =>
            f.signed *
            Math.max(
              0,
              Math.min(1, (end - stamp(f.at)) / Math.max(1, duration)),
            ),
        ),
      );
    return {
      percent:
        selected.length &&
        (opening > 0 || (opening === 0 && inside.length > 0)) &&
        denominator > 0
          ? (sum(selected.map((t) => t.pnl)) / denominator) * 100
          : null,
      opening,
      denominator,
      method: inside.length
        ? "Modified Dietz · fluxos ponderados no período"
        : "P&L ÷ capital no início do período",
      flowCount: inside.length,
    };
  }
  function capital(state, universe, accountId, to) {
    const b = baseline(state, accountId),
      rows = universe.filter((t) => account(t) === accountId && date(t) <= to),
      flows = movements(state, accountId, to);
    const mixed =
      rows.some((t) => t.currency && b.currency && t.currency !== b.currency) ||
      flows.some((f) => f.currency && b.currency && f.currency !== b.currency);
    if (b.initial === null || mixed)
      return {
        available: false,
        reason: mixed
          ? "Moedas incompatíveis; não há conversão de câmbio."
          : "Confirme o capital inicial desta conta.",
        flows,
        curve: [],
        ddCurve: [],
        initial: null,
        balance: null,
        currentDD: null,
        maxDD: null,
        maxPercent: null,
        recoveryDays: null,
        underwaterDays: null,
      };
    const events = [
      ...rows.map((t) => ({ at: t.close, id: t.id, net: t.pnl, flow: 0 })),
      ...flows.map((f) => ({ at: f.at, id: f.id, net: 0, flow: f.signed })),
    ]
      .filter((e) => stamp(e.at) !== null)
      .sort(
        (a, b) =>
          stamp(a.at) - stamp(b.at) || String(a.id).localeCompare(String(b.id)),
      );
    let value = b.initial,
      peak = value,
      maxDD = 0,
      maxPercent = 0,
      peakAt = events[0]?.at || to,
      start = null,
      recoveryDays = null;
    const curve = [],
      ddCurve = [];
    const firstDate = (events[0]?.at || to).slice(0, 10);
    curve.push({
      date: firstDate + " · Inicial",
      value: b.initial,
      net: 0,
      n: 0,
    });
    ddCurve.push({ date: firstDate + " · Inicial", value: 0, net: 0, n: 0 });
    for (const e of events) {
      value += e.net + e.flow;
      peak += e.flow;
      const deficit = Math.max(0, peak - value);
      if (deficit > 0 && !start) start = peakAt;
      if (deficit === 0) {
        if (start) {
          const days = (stamp(e.at) - stamp(start)) / 86400000;
          recoveryDays = Math.max(recoveryDays ?? 0, days);
          start = null;
        }
        peak = value;
        peakAt = e.at;
      }
      maxDD = Math.max(maxDD, deficit);
      if (peak > 0) maxPercent = Math.max(maxPercent, (deficit / peak) * 100);
      const d = e.at.slice(0, 10);
      curve.push({
        date: d,
        value,
        net: e.net,
        flow: e.flow,
        n: e.flow ? 0 : 1,
      });
      ddCurve.push({ date: d, value: -deficit, net: e.net, n: e.flow ? 0 : 1 });
    }
    return {
      available: true,
      initial: b.initial,
      balance: value,
      currentDD: Math.max(0, peak - value),
      currentPercent:
        peak > 0 ? (Math.max(0, peak - value) / peak) * 100 : null,
      maxDD,
      maxPercent: peak > 0 || maxPercent > 0 ? maxPercent : null,
      recoveryDays,
      underwaterDays: start
        ? Math.max(0, (stamp(to + "T23:59:59Z") - stamp(start)) / 86400000)
        : null,
      flows,
      curve,
      ddCurve,
      net: sum(rows.map((t) => t.pnl)),
      deposits: sum(
        flows.filter((f) => f.type === "deposit").map((f) => f.amount),
      ),
      withdrawals: sum(
        flows.filter((f) => f.type === "withdrawal").map((f) => f.amount),
      ),
    };
  }
  function groups(rows, key, adapter) {
    const map = new Map();
    for (const t of rows) {
      const k = key(t) || "Não informado";
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(t);
    }
    return [...map]
      .map(([name, trades]) => {
        const rs = trades
          .map(adapter.realizedR)
          .filter((r) => r.value !== null);
        return {
          name,
          rows: trades,
          ...adapter.stats(trades),
          r: rs.length ? sum(rs.map((r) => r.value)) : null,
          rn: rs.length,
        };
      })
      .sort((a, b) => b.net - a.net);
  }
  function select(trades, q, adapter, ignoreDates = false) {
    return trades.filter((t) => {
      if (!t || (!t.close && !t.open)) return false;
      const closed =
          typeof t.close === "string" &&
          validDate(date(t)) &&
          number(t.pnl) !== null &&
          t.status !== "open",
        status = closed ? "closed" : "open";
      return (
        (q.status === "all" || status === (q.status || "closed")) &&
        (ignoreDates ||
          ((!q.from || date(t) >= q.from) && (!q.to || date(t) <= q.to))) &&
        (!q.symbol || t.symbol === q.symbol) &&
        (!q.strategy || t.strategy === q.strategy) &&
        (!q.side || t.side === q.side) &&
        (!q.setup || t.setup === q.setup) &&
        (!q.session || adapter.session(t) === q.session) &&
        (q.account === undefined ||
          q.account === null ||
          account(t) === q.account)
      );
    });
  }
  function model(state, query, adapter) {
    const q = {
        ...query,
        to: query.to && query.to < query.today ? query.to : query.today,
      },
      candidates = select(state.trades, q, adapter),
      rows = candidates
        .filter((t) => t.close && number(t.pnl) !== null && t.status !== "open")
        .sort(
          (a, b) =>
            String(a.close).localeCompare(String(b.close)) ||
            String(a.id).localeCompare(String(b.id)),
        ),
      s = adapter.stats(rows),
      priorRange = previous(q, rows, q.today),
      prior = priorRange
        ? select(state.trades, { ...q, ...priorRange }, adapter).filter(
            (t) => t.close && number(t.pnl) !== null && t.status !== "open",
          )
        : [],
      old = adapter.stats(prior),
      process = adapter.process(rows),
      rs = rows.map(adapter.realizedR),
      valid = rs.filter((r) => r.value !== null),
      planned = rows
        .map((t) => number(t.plannedRR))
        .filter((n) => n !== null && n > 0),
      payoff = s.w && s.l ? s.aw / s.al : null,
      daily = groups(rows, (t) => date(t), adapter),
      weekly = groups(rows, (t) => bounds("week", date(t)).from, adapter),
      monthly = groups(rows, (t) => date(t).slice(0, 7), adapter),
      ids = [...new Set(rows.map(account))],
      accountId =
        q.account ??
        (ids.length === 1
          ? ids[0]
          : [...new Set(adapter.universe().map(account))].length === 1
            ? account(adapter.universe()[0])
            : "");
    const context = adapter.universe(),
      capitalRows = context.filter((t) => account(t) === accountId),
      cap =
        q.account == null && new Set(context.map(account)).size > 1
          ? {
              available: false,
              reason: "Selecione uma conta para analisar capital.",
              curve: [],
              ddCurve: [],
              flows: [],
            }
          : capital(state, capitalRows, accountId, q.to),
      returns = periodReturn(
        state,
        context,
        q.from,
        q.to,
        rows,
        ids.length > 1 ? null : accountId,
      ),
      durations = rows
        .map((t) => {
          const a = stamp(t.open),
            b = stamp(t.close);
          return a !== null && b !== null && b >= a ? (b - a) / 60000 : null;
        })
        .filter((n) => n !== null),
      initialRisk = rows.map((t) => number(t.risk)).filter((n) => n > 0),
      actualRisk = rows
        .map((t) => number(t.actualRisk ?? t.realizedRisk))
        .filter((n) => n > 0),
      riskGroups = groups(
        rows
          .filter((t) => number(t.risk) > 0)
          .map((t) => ({ ...t, pnl: t.risk })),
        (t) => t.symbol,
        adapter,
      ),
      knownRisk = process.checked.filter(
        (x) => x.c.risk !== null || x.c.limits !== null,
      ),
      violations = knownRisk.filter(
        (x) => x.c.risk === false || x.c.limits === false,
      ),
      riskR = valid.length
        ? adapter.stats(
            rows
              .map((t, i) => ({ ...t, pnl: rs[i].value }))
              .filter((t) => t.pnl !== null),
          ).dd
        : null;
    let currentStreak = { kind: "break", n: 0 };
    for (const t of rows) {
      const kind = t.pnl > 0 ? "win" : t.pnl < 0 ? "loss" : "break";
      currentStreak =
        kind === "break"
          ? { kind, n: 0 }
          : { kind, n: currentStreak.kind === kind ? currentStreak.n + 1 : 1 };
    }
    const pairs = [];
    for (const d of ids.length <= 1 ? daily : []) {
      const sorted = [...d.rows].sort((a, b) =>
        String(a.open || a.close).localeCompare(String(b.open || b.close)),
      );
      if (sorted.length >= 2)
        pairs.push({ date: d.name, first: sorted[0], second: sorted[1] });
    }
    const afterLoss =
        ids.length <= 1
          ? rows.filter((t, i) => i > 0 && rows[i - 1].pnl < 0)
          : [],
      within = process.checked.filter((x) => x.c.plan === true).map((x) => x.t),
      outside = process.checked
        .filter((x) => x.c.plan === false)
        .map((x) => x.t),
      eligibleDecisionScope =
        !q.symbol &&
        !q.side &&
        !q.setup &&
        !q.session &&
        !q.strategy &&
        q.account == null,
      decisions = eligibleDecisionScope
        ? (Array.isArray(state.growth?.decisions)
            ? state.growth.decisions
            : []
          ).filter(
            (d) =>
              d &&
              validDate(d.date) &&
              (!q.from || d.date >= q.from) &&
              d.date <= q.to &&
              d.kind === "outside_plan" &&
              d.planId &&
              d.note?.trim(),
          )
        : null,
      missed = (
        Array.isArray(state.missedSetups) ? state.missedSetups : []
      ).filter(
        (d) =>
          d &&
          d &&
          validDate(d.date) &&
          (!q.from || d.date >= q.from) &&
          d.date <= q.to &&
          (!q.symbol || d.symbol === q.symbol) &&
          (q.account == null || account(d) === q.account),
      );
    const outcomes = rows.map((t) => ({
      ...t,
      emotion:
        t.emotion ||
        {
          calm: "Calm / Focused",
          confident: "Confident",
          fear: "Fear",
          fomo: "FOMO",
          frustrated: "Frustrated",
          anxious: "Anxious",
          revenge: "Revenge Trading",
          tired: "Tired / Distracted",
        }[
          (Array.isArray(state.growth?.checkins) ? state.growth.checkins : [])
            .filter((l) => l && l.tradeId === t.id)
            .sort((a, b) => String(a.at).localeCompare(String(b.at)))[0]
            ?.emotion
        ] ||
        "Não registrado",
    }));
    const mixed = rows.some((t) => {
        const currency =
          t.currency ||
          (Array.isArray(state.tradingAccounts)
            ? state.tradingAccounts
            : []
          ).find((a) => String(a.id) === account(t))?.currency;
        return currency && state.currency && currency !== state.currency;
      }),
      costRows = rows.filter(
        (t) =>
          t.costBreakdown &&
          Object.values(t.costBreakdown).some((v) => number(v) !== null),
      ),
      costs = costRows.length
        ? sum(
            costRows.flatMap((t) =>
              Object.values(t.costBreakdown).filter((v) => number(v) !== null),
            ),
          )
        : null;
    return {
      query: q,
      rows,
      candidates,
      open: candidates.filter((t) => !t.close || t.status === "open"),
      s,
      old,
      priorRange,
      process,
      mixed,
      known: valid.length,
      complete: rows.length > 0 && valid.length === rows.length,
      r: valid.length ? sum(valid.map((r) => r.value)) : null,
      expectancyR: mean(valid.map((r) => r.value)),
      priceR: valid.filter((r) => r.source === "price").length,
      plannedRR: mean(planned),
      plannedN: planned.length,
      payoff: mixed ? null : payoff,
      breakEvenRate: !mixed && payoff !== null ? 100 / (1 + payoff) : null,
      daily,
      weekly,
      monthly,
      cap,
      returns: mixed
        ? {
            ...returns,
            percent: null,
            method: "Moedas incompatíveis; sem câmbio",
          }
        : returns,
      duration: mean(durations),
      durationN: durations.length,
      initialRisk: mean(initialRisk),
      riskN: initialRisk.length,
      actualRisk: mean(actualRisk),
      actualRiskN: actualRisk.length,
      riskGroups,
      violations,
      knownRisk: knownRisk.length,
      riskR,
      currentStreak,
      pairs,
      priorRows: prior,
      afterLoss: adapter.stats(afterLoss),
      afterLossN: afterLoss.length,
      within: adapter.stats(within),
      outside: adapter.stats(outside),
      withinRows: within,
      outsideRows: outside,
      decisions,
      missed: q.side || q.setup || q.session || q.strategy ? null : missed,
      emotions: groups(outcomes, (t) => t.emotion, adapter),
      rBins: rDistribution(valid.map((r) => r.value)),
      costs,
      costN: costRows.length,
      groups: {
        asset: groups(rows, (t) => t.symbol, adapter),
        session: groups(rows, adapter.session, adapter),
        hour: groups(
          rows,
          (t) => (t.open ? t.open.slice(11, 13) + ":00" : "Não informado"),
          adapter,
        ),
        weekday: groups(
          rows,
          (t) =>
            t.open
              ? ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][
                  new Date(t.open.slice(0, 10) + "T12:00Z").getUTCDay()
                ]
              : "Não informado",
          adapter,
        ),
        direction: groups(
          rows,
          (t) =>
            t.side === "long"
              ? "Compra"
              : t.side === "short"
                ? "Venda"
                : "Não informado",
          adapter,
        ),
        setup: groups(rows, (t) => t.setup || "Não informado", adapter),
      },
    };
  }
  function rDistribution(values) {
    const bins = [
      { name: "< −2R", test: (n) => n < -2 },
      { name: "−2 a <−1R", test: (n) => n >= -2 && n < -1 },
      { name: "−1 a <0R", test: (n) => n >= -1 && n < 0 },
      { name: "0R", test: (n) => n === 0 },
      { name: ">0 a <1R", test: (n) => n > 0 && n < 1 },
      { name: "1 a <2R", test: (n) => n >= 1 && n < 2 },
      { name: "≥ 2R", test: (n) => n >= 2 },
    ];
    return bins.map((b) => ({ name: b.name, n: values.filter(b.test).length }));
  }
  return {
    number,
    validDate,
    stamp,
    shift,
    bounds,
    previous,
    baseline,
    movements,
    periodReturn,
    capital,
    groups,
    select,
    model,
    rDistribution,
    account,
  };
});
