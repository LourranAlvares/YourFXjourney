/* Shared projections: journal adapters supply the platform's existing financial rules. */
(function (root, factory) {
  const api = factory(
    typeof module === "object" && module.exports
      ? require("./session-engine.js")
      : root.SessionEngine,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GrowthEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Session) {
  "use strict";
  const logDate = (l, zone) => {
    if (validDate(l.date)) return l.date;
    try {
      return Session.zonedParts(l.at, l.timezone || zone).date;
    } catch {
      return "";
    }
  };
  const day = (t) => t.close.slice(0, 10),
    validDate = (s) =>
      /^\d{4}-\d{2}-\d{2}$/.test(s || "") &&
      Number.isFinite(Date.parse(s + "T12:00Z")) &&
      new Date(s + "T12:00Z").toISOString().slice(0, 10) === s;
  const emotions = {
    calm: ["Calm / Focused", "Mantenha o foco nos critérios do seu plano."],
    confident: [
      "Confident",
      "Confiança e critérios devem caminhar juntos; mantenha seu risco definido.",
    ],
    fear: ["Fear", "Confira o setup com seus critérios antes de decidir."],
    fomo: [
      "FOMO",
      "Perder uma oportunidade não cria a obrigação de procurar outra.",
    ],
    frustrated: ["Frustrated", "Frustração pede uma revisão, não uma entrada."],
    anxious: [
      "Anxious",
      "Faça uma pausa breve e confira o contexto com calma.",
    ],
    revenge: [
      "Recover Losses",
      "Seu plano importa mais do que recuperar uma perda.",
    ],
    tired: [
      "Tired / Distracted",
      "Considere pausar quando a atenção estiver comprometida.",
    ],
  };
  const risky = ["fear", "fomo", "frustrated", "anxious", "revenge", "tired"];
  const defaults = {
    rrTarget: 20,
    minRR: null,
    planDays: 30,
    disciplineThreshold: 90,
    minMonthlyTrades: 5,
    riskDays: 20,
    journalDays: 10,
    emotionalSessions: 10,
    selectiveDays: 5,
    selfControlSessions: 3,
    reflectWeeks: 4,
    mindsetMinTrades: 5,
    mindsetImprovement: 10,
  };
  const definitions = [
    [
      "consistent",
      "Consistent Performer",
      "Dois meses completos e consecutivos com resultado líquido positivo.",
      "Histórico financeiro",
    ],
    [
      "quarterly",
      "Quarterly Profitability",
      "Três meses completos e consecutivos com resultado líquido positivo.",
      "Histórico financeiro",
    ],
    [
      "rr",
      "Risk-Reward Excellence",
      "R:R planejado compatível com a meta, com risco e plano declarados respeitados.",
      "R:R registrado + autodeclaração",
    ],
    [
      "plan",
      "Plan Commitment",
      "Dias operados com todas as operações declaradas dentro do plano.",
      "Autodeclaração de execução",
    ],
    [
      "discipline",
      "Discipline Master",
      "Três meses completos consecutivos acima do limiar de aderência, com cobertura integral.",
      "Autodeclaração de execução",
    ],
    [
      "risk",
      "Risk Guardian",
      "Dias operados com risco e limites explicitamente avaliados e respeitados.",
      "Autodeclaração de risco",
    ],
    [
      "selective",
      "Selective Trader",
      "Dias com decisão documentada de descartar oportunidade fora do plano salvo.",
      "Decisões registradas",
    ],
    [
      "journal",
      "Journal Consistency",
      "Dias operados com motivo, estado emocional e aprendizado registrados em todos os trades.",
      "Diário preenchido",
    ],
    [
      "awareness",
      "Emotional Awareness",
      "Check-ins em sessões distintas, sem premiar uma emoção específica.",
      "Check-ins autodeclarados",
    ],
    [
      "mindset",
      "Mindset Progress",
      "Melhora mensurável da aderência entre duas semanas completas com amostra e cobertura suficientes.",
      "Execução e check-ins declarados",
    ],
    [
      "control",
      "Self-Control Recognition",
      "Sessões com emoção de atenção e decisão explícita de respeitar o plano.",
      "Decisões autodeclaradas",
    ],
    [
      "reflect",
      "Reflective Trader",
      "Reflexões semanais consecutivas concluídas, com aprendizado e prioridade.",
      "Reflexões registradas",
    ],
  ];
  const shift = (d, n) => Session.shiftDate(d, n),
    unique = (a) => [...new Set(a)],
    sum = (a) => a.reduce((s, n) => s + n, 0);
  function bounds(mode, anchor) {
    if (!validDate(anchor)) throw Error("Data inválida.");
    if (mode === "week") {
      const weekday = Session.zonedParts(
          new Date(anchor + "T12:00Z"),
          "UTC",
        ).weekday,
        from = shift(anchor, 1 - weekday);
      return { mode, from, to: shift(from, 6), key: "week:" + from };
    }
    const [y, m] = anchor.split("-").map(Number),
      from = anchor.slice(0, 7) + "-01",
      to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    return { mode: "month", from, to, key: "month:" + anchor.slice(0, 7) };
  }
  function previous(range) {
    return bounds(range.mode, shift(range.from, -1));
  }
  function normalise(raw = {}) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) raw = {};
    const rules = { ...defaults, ...(raw.rules || {}) };
    for (const key of Object.keys(defaults)) {
      if (key === "minRR") {
        rules[key] =
          typeof rules[key] === "number" &&
          rules[key] > 0 &&
          rules[key] <= 10000
            ? rules[key]
            : null;
        continue;
      }
      const min = ["minMonthlyTrades", "mindsetMinTrades"].includes(key)
        ? 5
        : 1;
      rules[key] =
        Number.isInteger(rules[key]) && rules[key] >= min && rules[key] <= 1000
          ? rules[key]
          : defaults[key];
    }
    rules.disciplineThreshold = Math.min(100, rules.disciplineThreshold);
    rules.mindsetImprovement = Math.min(100, rules.mindsetImprovement);
    const monitor = raw.monitor || {};
    return {
      ...raw,
      version: 1,
      monitor: {
        enabled: false,
        mode: "manual",
        frequency: 30,
        messages: {},
        ...monitor,
        enabled: monitor.enabled === true,
        mode: monitor.mode === "auto" ? "auto" : "manual",
        frequency:
          Number.isInteger(monitor.frequency) &&
          monitor.frequency >= 5 &&
          monitor.frequency <= 180
            ? monitor.frequency
            : 30,
        messages:
          monitor.messages && typeof monitor.messages === "object"
            ? monitor.messages
            : {},
      },
      checkins: Array.isArray(raw.checkins)
        ? raw.checkins.filter(
            (x) => x && typeof x === "object" && typeof x.at === "string",
          )
        : [],
      decisions: Array.isArray(raw.decisions)
        ? raw.decisions.filter((x) => x && typeof x === "object")
        : [],
      reflections: Object.fromEntries(
        Object.entries(
          raw.reflections && typeof raw.reflections === "object"
            ? raw.reflections
            : {},
        )
          .filter(([key, v]) => v && typeof v === "object")
          .map(([key, v]) => [
            key,
            {
              ...v,
              answers: [0, 1, 2].map((i) =>
                typeof v.answers?.[i] === "string" ? v.answers[i] : "",
              ),
            },
          ]),
      ),
      certificates: Array.isArray(raw.certificates)
        ? raw.certificates.filter((x) => x && typeof x === "object")
        : [],
      prompts:
        raw.prompts && typeof raw.prompts === "object" ? raw.prompts : {},
      rules,
      announced:
        raw.announced && typeof raw.announced === "object" ? raw.announced : {},
    };
  }
  function instant(value, zone) {
    try {
      if (/[zZ]|[+-]\d\d:\d\d$/.test(value))
        return new Date(value).toISOString();
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value))
        return Session.zonedDateTimeToUtc(
          value.slice(0, 10),
          value.slice(11, 16),
          zone,
        );
    } catch {}
    return null;
  }
  function context(profile, now = new Date()) {
    if (!profile.session?.enabled)
      return { configured: false, status: "unconfigured", key: null };
    const s = Session.sessionOverview(profile.session, now);
    return { ...s, key: s.configured ? s.timezone + "|" + s.startAt : null };
  }
  function due(store, profile, now = new Date()) {
    const g = normalise(store),
      s = context(profile, now);
    if (!g.monitor.enabled || !s.configured || s.status !== "active")
      return false;
    if (g.monitor.mode !== "auto" && g.activeRun?.sessionKey !== s.key)
      return false;
    const p = g.prompts[s.key] || {};
    if (p.ignored || p.snoozedUntil > Date.parse(now)) return false;
    return (
      !p.lastAt ||
      Date.parse(now) - p.lastAt >= Math.max(5, g.monitor.frequency) * 60000
    );
  }
  function records(state, adapter, range = null) {
    return adapter
      .universe()
      .filter((t) => !range || (day(t) >= range.from && day(t) <= range.to));
  }
  function emotional(g, rows, range, zone, adapter) {
    const logs = g.checkins
        .filter(
          (l) =>
            emotions[l.emotion] &&
            Number.isFinite(Date.parse(l.at)) &&
            Date.parse(l.at) <= Date.parse(adapter.now()),
        )
        .filter((l) => {
          const d = logDate(l, zone);
          return d >= range.from && d <= range.to;
        }),
      freq = {};
    logs.forEach((l) => (freq[l.emotion] = (freq[l.emotion] || 0) + 1));
    const linked = logs
        .map((l) => ({ log: l, trade: rows.find((t) => t.id === l.tradeId) }))
        .filter((x) => x.trade),
      before = linked.filter((x) => {
        const open = instant(x.trade.open, zone);
        return open && Date.parse(x.log.at) <= Date.parse(open);
      }),
      afterLoss = logs.filter(
        (l) =>
          l.emotion === "frustrated" &&
          rows.some((t) => {
            const close = instant(t.close, zone);
            return (
              close &&
              t.pnl < 0 &&
              Date.parse(l.at) >= Date.parse(close) &&
              Date.parse(l.at) - Date.parse(close) <= 30 * 60000
            );
          }),
      );
    const byState = Object.keys(freq).map((key) => {
      const ids = unique(
          linked.filter((x) => x.log.emotion === key).map((x) => x.trade.id),
        ),
        ts = rows.filter((t) => ids.includes(t.id)),
        p = adapter.process(ts);
      return {
        key,
        n: freq[key],
        trades: ts.length,
        known: p.plan.n,
        adherence: p.plan.value,
      };
    });
    return {
      logs,
      freq,
      before: before.length,
      afterLoss: afterLoss.length,
      fomoSessions: unique(
        logs.filter((l) => l.emotion === "fomo").map((l) => l.sessionKey),
      ).length,
      byState,
      top: Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0] || null,
    };
  }
  function model(state, range, adapter) {
    const g = normalise(state.growth),
      today = adapter.today(),
      rows = records(state, adapter, {
        ...range,
        to: range.to < today ? range.to : today,
      }),
      stats = adapter.stats(rows),
      rs = rows.map(adapter.realizedR),
      known = rs.filter((r) => r.value !== null),
      process = adapter.process(rows),
      zone = adapter.timezone(),
      earlier = adapter.process(records(state, adapter, previous(range))),
      evolution =
        process.plan.n >= 5 &&
        earlier.plan.n >= 5 &&
        process.plan.value !== null &&
        earlier.plan.value !== null
          ? {
              delta: process.plan.value - earlier.plan.value,
              current: process.plan.n,
              previous: earlier.plan.n,
            }
          : null,
      emotionalData = emotional(
        g,
        rows,
        { ...range, to: range.to < today ? range.to : today },
        zone,
        adapter,
      ),
      eligibleHighlights = [];
    const add = (label, t) => {
      if (t && !eligibleHighlights.some((h) => h.trade.id === t.id))
        eligibleHighlights.push({ label, trade: t, r: adapter.realizedR(t) });
    };
    add(
      "Melhor resultado registrado",
      [...rows].sort((a, b) => b.pnl - a.pnl)[0],
    );
    add(
      "Maior R realizado",
      [...rows]
        .filter((t) => adapter.realizedR(t).value !== null)
        .sort(
          (a, b) => adapter.realizedR(b).value - adapter.realizedR(a).value,
        )[0],
    );
    add(
      "Plano respeitado · declarado",
      rows.find((t) => t.behavior?.plan === true),
    );
    add(
      "Escolha do trader",
      rows.find((t) => t.growthFeatured),
    );
    const has = rows.length > 0,
      adherence = process.plan.value,
      development = has
        ? adherence !== null
          ? `${adherence.toFixed(0)}% de aderência entre ${process.plan.n}/${rows.length} operações avaliadas. ${adherence >= 80 ? "Mantenha a verificação dos seus critérios." : "Revise os desvios declarados, sem aumentar o risco."}`
          : "O resultado está registrado; a execução ainda precisa de avaliações do plano para uma revisão mais completa."
        : "Sem operações neste período. Uma pausa não precisa ser preenchida com entradas.",
      priority = process.checked.some((x) => x.c.plan === false)
        ? "Confira os critérios antes da próxima entrada."
        : emotionalData.freq.revenge
          ? "Respeite seus limites; recuperar uma perda não é um critério de entrada."
          : emotionalData.freq.fomo
            ? "Espere por contexto claro; não há obrigação de entrar."
            : "Registre seu contexto e siga o ritmo previsto no plano.";
    return {
      range,
      partial: range.to > today,
      rows,
      stats,
      days: unique(rows.map(day)).length,
      symbols: unique(rows.map((t) => t.symbol).filter(Boolean)),
      sessions: unique(rows.filter((t) => t.open).map(adapter.session)),
      r: known.length ? sum(known.map((r) => r.value)) : null,
      rKnown: known.length,
      rComplete: has && known.length === rows.length,
      rPrice: known.some((r) => r.source === "price"),
      percent: adapter.percent(
        range.from,
        rows,
        range.to < today ? range.to : today,
      ),
      process,
      evolution,
      emotional: emotionalData,
      highlights: eligibleHighlights,
      development,
      priority,
      estimated: rows.some((t) => t.est),
      reflection:
        g.reflections[range.key]?.answers?.length === 3
          ? g.reflections[range.key]
          : null,
    };
  }
  function assess(state, id, adapter, config = null, fixedRange = null) {
    const g = normalise(state.growth),
      r = { ...g.rules, ...config },
      all = records(state, adapter).filter((t) => day(t) <= adapter.today()),
      today = adapter.today(),
      def = definitions.find((d) => d[0] === id),
      dates = [
        ...all.map(day),
        ...g.checkins
          .filter((l) => Number.isFinite(Date.parse(l.at)))
          .map((l) => logDate(l, adapter.timezone())),
        ...g.decisions.map((d) => d.date),
        ...Object.keys(g.reflections).map((k) =>
          k.startsWith("week:")
            ? k.slice(5)
            : k.startsWith("month:")
              ? k.slice(6) + "-01"
              : null,
        ),
      ]
        .filter((d) => validDate(d) && d <= today)
        .sort(),
      range = fixedRange || { from: dates[0] || today, to: today },
      rows = all.filter((t) => day(t) >= range.from && day(t) <= range.to),
      checks = adapter.process(rows).checked;
    let value = 0,
      target = 1,
      earned = false,
      usedRange = range,
      note = "Dados insuficientes.",
      source = def[3];
    const dateOfLog = (l) => logDate(l, adapter.timezone());
    function selectWindow(dates) {
      const chosen = unique(dates).sort();
      value = chosen.length;
      earned = value >= target;
      if (earned) usedRange = { from: chosen[0], to: chosen[target - 1] };
    }
    function dayRun(predicate) {
      let streak = [];
      for (const date of Object.keys(dayGroups).sort()) {
        if (dayGroups[date].every(predicate)) streak.push(date);
        else streak = [];
        value = Math.max(value, streak.length);
        if (!earned && streak.length >= target) {
          earned = true;
          usedRange = { from: streak[0], to: streak[target - 1] };
        }
      }
    }
    const dayGroups = Object.groupBy
        ? Object.groupBy(rows, day)
        : rows.reduce((m, t) => {
            (m[day(t)] ??= []).push(t);
            return m;
          }, {}),
      check = (t) => checks.find((x) => x.t.id === t.id)?.c || {},
      checkinDates = g.checkins
        .filter(
          (l) =>
            emotions[l.emotion] &&
            Number.isFinite(Date.parse(l.at)) &&
            Date.parse(l.at) <= Date.parse(adapter.now()),
        )
        .filter((l) => {
          const d = logDate(l, adapter.timezone());
          return d >= range.from && d <= range.to;
        }),
      monthKeys = unique(rows.map((t) => day(t).slice(0, 7))).sort();
    if (["consistent", "quarterly", "discipline"].includes(id)) {
      target = id === "consistent" ? 2 : 3;
      let streak = [];
      const eligible = [];
      for (const key of monthKeys) {
        const b = bounds("month", key + "-01");
        if (b.to >= today) continue;
        const ts = rows.filter((t) => day(t).slice(0, 7) === key),
          p = adapter.process(ts),
          ok =
            id === "discipline"
              ? ts.length >= r.minMonthlyTrades &&
                p.plan.n === ts.length &&
                p.plan.value !== null &&
                p.plan.value >= r.disciplineThreshold
              : adapter.stats(ts).net > 0 && !ts.some((t) => t.est);
        if (!ok) {
          streak = [];
          continue;
        }
        if (
          streak.length &&
          bounds("month", shift(b.from, -1)).from !== streak.at(-1).from
        )
          streak = [];
        streak.push(b);
        value = Math.max(value, streak.length);
        if (streak.length >= target) eligible.push(streak.slice(-target));
      }
      if (eligible.length) {
        const chosen = eligible[0];
        earned = true;
        usedRange = { from: chosen[0].from, to: chosen.at(-1).to };
        value = target;
      }
      note =
        id === "discipline"
          ? `Limiar ${r.disciplineThreshold}%; mínimo ${r.minMonthlyTrades} operações por mês e 100% de cobertura do plano.`
          : "Apenas meses encerrados, com operações válidas e sem P&L estimado. Meses vazios interrompem a sequência.";
    }
    if (id === "rr") {
      target = r.rrTarget;
      const min = r.minRR ?? adapter.minRR();
      const rrRows =
        min > 0
          ? rows
              .filter(
                (t) =>
                  Number.isFinite(t.plannedRR) &&
                  t.plannedRR >= min &&
                  check(t).plan === true &&
                  check(t).risk === true,
              )
              .sort((a, b) => a.close.localeCompare(b.close))
          : [];
      value = rrRows.length;
      if (value >= target)
        usedRange = { from: day(rrRows[0]), to: day(rrRows[target - 1]) };
      note =
        min > 0
          ? `R:R planejado ≥ ${min}; meta atual explicitada. Exige plano e risco declarados respeitados; não depende de ganhar o trade.`
          : "Defina o R:R mínimo no plano ou nas regras da conquista.";
      earned = value >= target;
    }
    if (id === "plan") {
      target = r.planDays;
      dayRun((t) => check(t).plan === true);
      note =
        "Dias operados com cobertura integral: cada operação precisa de plano explicitamente respeitado.";
    }
    if (id === "risk") {
      target = r.riskDays;
      dayRun(
        (t) =>
          check(t).risk === true &&
          check(t).limits === true &&
          !t.behavior?.errors?.includes("risk"),
      );
      note =
        "Dias operados consecutivos: risco e limites devem estar avaliados e respeitados em todas as operações do dia.";
    }
    if (id === "journal") {
      target = r.journalDays;
      dayRun((t) =>
        Boolean(
          t.notes?.trim() &&
            t.lesson?.trim() &&
            (t.feelings?.trim() ||
              t.emotion ||
              checkinDates.some((l) => l.tradeId === t.id)),
        ),
      );
      note =
        "Dias operados consecutivos: motivo, estado emocional e aprendizado; print é opcional. Todas as operações do dia devem estar completas.";
    }
    if (id === "selective") {
      target = r.selectiveDays;
      selectWindow(
        g.decisions
          .filter(
            (d) =>
              Date.parse(d.at) <= Date.parse(adapter.now()) &&
              d.kind === "outside_plan" &&
              d.planId &&
              d.note?.trim() &&
              validDate(d.date) &&
              d.date >= range.from &&
              d.date <= range.to,
          )
          .map((d) => d.date),
      );
      note =
        "Somente decisões explícitas de não operar fora do plano salvo, com motivo. Ausência de trades não comprova seletividade.";
    }
    if (id === "awareness") {
      target = r.emotionalSessions;
      const sessions = [
        ...new Map(
          [...checkinDates]
            .sort((a, b) => b.at.localeCompare(a.at))
            .filter((l) => typeof l.sessionKey === "string" && l.sessionKey)
            .map((l) => [l.sessionKey, l]),
        ).values(),
      ].sort((a, b) => a.at.localeCompare(b.at));
      value = sessions.length;
      earned = value >= target;
      if (earned)
        usedRange = {
          from: dateOfLog(sessions[0]),
          to: dateOfLog(sessions[target - 1]),
        };
      note =
        "Uma sessão conta uma vez, independentemente da emoção ou da quantidade de check-ins.";
    }
    if (id === "control") {
      target = r.selfControlSessions;
      const sessions = [
        ...new Map(
          [...checkinDates]
            .sort((a, b) => b.at.localeCompare(a.at))
            .filter(
              (l) =>
                l.sessionKey &&
                risky.includes(l.emotion) &&
                l.decision === "respected_plan",
            )
            .map((l) => [l.sessionKey, l]),
        ).values(),
      ].sort((a, b) => a.at.localeCompare(b.at));
      value = sessions.length;
      earned = value >= target;
      if (earned)
        usedRange = {
          from: dateOfLog(sessions[0]),
          to: dateOfLog(sessions[target - 1]),
        };
      note =
        "Declaração consciente de respeito ao plano após emoção de atenção. Não certifica domínio psicológico.";
    }
    if (id === "reflect") {
      target = r.reflectWeeks;
      const refs = Object.entries(g.reflections)
        .filter(
          ([k, v]) =>
            k.startsWith("week:") &&
            v?.answers?.length === 3 &&
            v.answers.every((a) => typeof a === "string" && a.trim()) &&
            validDate(k.slice(5)),
        )
        .map(([k]) => bounds("week", k.slice(5)))
        .filter((b) => b.from >= range.from && b.to <= range.to && b.to < today)
        .sort((a, b) => a.from.localeCompare(b.from));
      let streak = [];
      for (const b of refs) {
        if (streak.length && shift(streak.at(-1).from, 7) !== b.from)
          streak = [];
        streak.push(b);
        value = Math.max(value, streak.length);
        if (!earned && streak.length >= target) {
          earned = true;
          usedRange = { from: streak.at(-target).from, to: b.to };
        }
      }
      note =
        "Três respostas preenchidas em semanas encerradas consecutivas; reflexão ignorada não conta.";
    }
    if (id === "mindset") {
      target = r.mindsetImprovement;
      const weeks = unique(rows.map((t) => bounds("week", day(t)).from)).sort();
      for (const from of weeks) {
        const b = bounds("week", from),
          a = previous(b);
        if (b.to >= today || a.from < range.from) continue;
        const old = model(state, a, adapter),
          cur = model(state, b, adapter);
        if (
          old.rows.length >= r.mindsetMinTrades &&
          cur.rows.length >= r.mindsetMinTrades &&
          old.process.plan.n === old.rows.length &&
          cur.process.plan.n === cur.rows.length &&
          old.process.plan.value !== null &&
          cur.process.plan.value !== null &&
          unique(old.emotional.logs.map((l) => l.sessionKey)).length >= 3 &&
          unique(cur.emotional.logs.map((l) => l.sessionKey)).length >= 3
        ) {
          const delta = cur.process.plan.value - old.process.plan.value;
          value = Math.max(value, delta);
          if (!earned && delta >= target) {
            earned = true;
            usedRange = { from: a.from, to: b.to };
          }
        }
      }
      note = `Melhora ≥ ${target} pontos percentuais na aderência; mínimo ${r.mindsetMinTrades} operações avaliadas e 3 sessões com check-in em cada semana. Indicador de registros, não de saúde mental.`;
    }
    return {
      id,
      name: def[1],
      description: def[2],
      source,
      note,
      value,
      target,
      progress: Math.min(100, Math.max(0, (value / target) * 100)),
      status: earned ? "earned" : "pending",
      earned,
      range: usedRange,
      config: { ...r, minRR: r.minRR ?? adapter.minRR() },
      ruleVersion: 1,
    };
  }
  function allAchievements(state, adapter) {
    return definitions.map((d) => assess(state, d[0], adapter));
  }
  function reconcile(state, adapter, now = new Date()) {
    let changed = false;
    const certificates = normalise(state.growth).certificates.map((c) => {
      let valid = false;
      try {
        if (
          !validDate(c.range?.from) ||
          !validDate(c.range?.to) ||
          c.range.from > c.range.to ||
          c.ruleVersion !== 1
        )
          throw Error("Registro de emissão inválido");
        valid = assess(
          state,
          c.achievementId,
          adapter.forCertificate ? adapter.forCertificate(c) : adapter,
          c.config,
          c.range,
        ).earned;
      } catch {}
      const status = valid ? "valid" : "invalidated";
      if (c.status === status) return c;
      changed = true;
      return {
        ...c,
        status,
        statusChangedAt: now.toISOString(),
        reason: valid
          ? "Critérios atendidos pelos registros atuais."
          : "O histórico corrigido não atende aos critérios registrados na emissão.",
      };
    });
    return { changed, certificates };
  }
  return {
    emotions,
    risky,
    defaults,
    definitions,
    normalise,
    bounds,
    previous,
    instant,
    context,
    due,
    model,
    assess,
    allAchievements,
    reconcile,
    validDate,
  };
});
