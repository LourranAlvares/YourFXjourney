/* Context selection is deterministic. Every personal observation carries explicit evidence. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ExperienceEngine = api;
})(typeof globalThis === "undefined" ? this : globalThis, function () {
  "use strict";
  const hash = (s) => {
    let n = 2166136261;
    for (const c of String(s)) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
    return (n >>> 0).toString(16);
  };
  const library = {
    first:
      "Ainda não conheço sua trajetória. Cada operação, decisão e reflexão vai nos ajudar a entender como você evolui.",
    before:
      "O mercado vai oferecer possibilidades. Nosso trabalho é identificar quais realmente pertencem ao seu plano.",
    loss: "Os últimos resultados não foram favoráveis. Antes da próxima entrada, vale conferir se suas decisões continuam alinhadas ao seu processo.",
    win: "Os resultados recentes foram positivos. Vamos entender quais decisões você registrou junto deles.",
    breach:
      "Há uma diferença registrada entre o plano e a execução. Vamos revisar o contexto antes da próxima decisão.",
    fewer:
      "Você registrou menos operações neste período. Isso não significa necessariamente menos progresso. Vamos observar a qualidade das decisões.",
    improving:
      "Há uma evolução nos seus registros: a aderência declarada ao plano aumentou em relação ao período anterior.",
    fomo: "Você registrou FOMO recentemente. Perder uma oportunidade não significa precisar encontrar outra imediatamente.",
    disciplinedLoss:
      "O resultado da semana foi negativo, mas as avaliações registradas indicam respeito ao plano. Essas duas informações merecem ser vistas separadamente.",
    achievement:
      "Você alcançou um objetivo nos seus registros. Vale reconhecer o processo documentado, além do resultado.",
    returning:
      "Vamos retomar seu processo com clareza. Seu plano, seus registros e sua preparação continuam sendo a referência.",
  };
  const principles = {
    discipline:
      "O mercado não exige sua participação. Seu plano exige sua disciplina.",
    patience: "Nem toda oportunidade merece seu capital.",
    awareness:
      "Suas decisões registradas ajudam a contextualizar os resultados.",
    consistency:
      "Consistência é manter um processo confiável ao longo do tempo.",
    emotion: "A emoção pode aparecer. Ela não precisa decidir por você.",
    loss: "Um loss não exige recuperação imediata. A próxima decisão precisa continuar apoiada no plano.",
    progress: "Nem toda evolução aparece no saldo.",
    execution: "Uma decisão alinhada ao plano pode terminar em loss.",
    responsibility: "O mercado é incerto. Confira suas regras antes de agir.",
  };
  function prefs(state) {
    const p = state.assistantExperience?.preferences || {};
    return {
      history: p.history !== false,
      emotions: p.emotions !== false,
      goals: p.goals !== false,
    };
  }
  function select(state, ctx) {
    const p = prefs(state),
      rows = p.history ? ctx.rows : [],
      week = p.history ? ctx.week : null,
      previous = p.history ? ctx.previous : null,
      latest = rows.at(-1),
      candidates = [],
      add = (type, priority, evidence, key, focus, target = "ins") =>
        candidates.push({
          type,
          priority,
          message: library[type],
          evidence,
          key: type + "|" + hash(key),
          focus,
          target,
        });
    const baseFocus =
      ctx.planFocus ||
      "Antes de analisar sua evolução, vamos definir os critérios e os limites do seu plano.";
    if (p.history && rows.length) {
      const breach = ctx.checks.find(
        (c) =>
          c.t.id === latest.id &&
          (c.c.plan === false || c.c.risk === false || c.c.limits === false),
      );
      if (breach)
        add(
          "breach",
          110,
          [
            {
              source: "Diário / avaliação de execução",
              text:
                "A operação " +
                latest.symbol +
                " em " +
                latest.close +
                " tem desvio explicitamente avaliado de plano, risco ou limites.",
              tradeId: latest.id,
            },
          ],
          JSON.stringify([latest.id, breach.c]),
          "Confira seus critérios e limites antes de uma nova entrada.",
        );
      if (
        week?.rows.length >= 5 &&
        week.process.plan.n === week.rows.length &&
        week.process.plan.value >= 90 &&
        week.s.net < 0
      )
        add(
          "disciplinedLoss",
          100,
          [
            {
              source: "Semana atual · registros fechados",
              text: `Resultado líquido negativo; ${week.process.plan.n}/${week.rows.length} avaliadas, ${week.process.plan.value.toFixed(0)}% de aderência declarada.`,
            },
          ],
          ctx.weekKey +
            "|" +
            JSON.stringify(
              week.rows.map((t) => [t.id, t.pnl, t.behavior?.plan]),
            ),
          principles.execution,
        );
      if (
        week?.rows.length >= 5 &&
        previous?.rows.length >= 5 &&
        week.process.plan.n >= 5 &&
        previous.process.plan.n >= 5 &&
        week.process.plan.value !== null &&
        previous.process.plan.value !== null &&
        week.process.plan.value - previous.process.plan.value >= 10
      )
        add(
          "improving",
          90,
          [
            {
              source: "Execução em períodos equivalentes",
              text: `Aderência declarada: ${previous.process.plan.value.toFixed(0)}% (${previous.process.plan.n} avaliadas) e ${week.process.plan.value.toFixed(0)}% (${week.process.plan.n} avaliadas).`,
            },
          ],
          ctx.weekKey +
            "|" +
            week.process.plan.value +
            "|" +
            previous.process.plan.value,
          principles.consistency,
        );
      let streak = 0,
        sign = latest.pnl > 0 ? 1 : latest.pnl < 0 ? -1 : 0;
      for (
        let i = rows.length - 1;
        i >= 0 && sign && Math.sign(rows[i].pnl) === sign;
        i--
      )
        streak++;
      if (streak >= 3)
        add(
          sign < 0 ? "loss" : "win",
          sign < 0 ? 80 : 70,
          [
            {
              source: "Últimos fechamentos registrados",
              text: `${streak} resultados ${sign < 0 ? "negativos" : "positivos"} consecutivos. Isso não demonstra disciplina, emoção ou causa.`,
            },
          ],
          rows
            .slice(-streak)
            .map((t) => t.id + "|" + t.pnl)
            .join(","),
          sign < 0
            ? principles.loss
            : "Mantenha os critérios e o risco previstos no plano.",
        );
      if (
        week?.rows.length &&
        previous?.rows.length >= 5 &&
        week.process.plan.n >= 5 &&
        previous.process.plan.n >= 5 &&
        week.rows.length < previous.rows.length
      )
        add(
          "fewer",
          60,
          [
            {
              source: "Dias equivalentes entre semanas",
              text: `${week.rows.length} registros no período atual e ${previous.rows.length} nos dias equivalentes da semana anterior. Quantidade não comprova qualidade.`,
            },
          ],
          ctx.weekKey + "|" + week.rows.length + "|" + previous.rows.length,
          principles.patience,
        );
    }
    if (p.emotions) {
      const logs = (
        Array.isArray(state.growth?.checkins) ? state.growth.checkins : []
      )
        .filter(
          (l) =>
            l &&
            l.emotion === "fomo" &&
            Date.parse(l.at) <= Date.parse(ctx.now) &&
            Date.parse(l.at) >= Date.parse(ctx.now) - 7 * 86400000,
        )
        .sort((a, b) => String(a.at).localeCompare(String(b.at)));
      if (logs.length) {
        const log = logs.at(-1);
        add(
          "fomo",
          105,
          [
            {
              source: "Check-in informado pelo usuário",
              text:
                "FOMO registrado em " +
                log.at +
                ". Nenhuma emoção foi inferida a partir de P&L.",
            },
          ],
          log.id + "|" + log.at,
          principles.emotion,
          "trades",
        );
      }
    }
    if (p.goals && ctx.achievement) {
      const a = ctx.achievement;
      add(
        "achievement",
        95,
        [
          {
            source: "Critérios de conquistas recalculados",
            text:
              a.name +
              " · " +
              a.range.from +
              " — " +
              a.range.to +
              ". " +
              a.note,
          },
        ],
        a.id + "|" + a.range.from + "|" + a.range.to,
        principles.progress,
        "achievements",
      );
    }
    if (!rows.length && !ctx.hasAnyHistory)
      add(
        "first",
        40,
        [
          {
            source: "Histórico da conta",
            text: "Não há operações fechadas válidas registradas.",
          },
        ],
        "empty",
        baseFocus,
        ctx.hasPlan ? "trades" : "plan",
      );
    if (ctx.session?.configured && ctx.session.status === "upcoming")
      add(
        "before",
        30,
        [
          {
            source: "Sessão configurada",
            text:
              ctx.session.label +
              " · " +
              ctx.session.start +
              "–" +
              ctx.session.end +
              " · " +
              ctx.session.timezone,
          },
        ],
        ctx.today + "|" + ctx.session.startAt,
        baseFocus,
        ctx.hasPlan ? "analyst" : "plan",
      );
    add(
      "returning",
      0,
      [
        {
          source: "Plano e rotina",
          text: ctx.hasPlan
            ? "Orientação do plano ativo, sem afirmar um padrão pessoal."
            : "Ainda é necessário configurar seu processo.",
        },
      ],
      ctx.today + "|" + (ctx.planId || "no-plan"),
      baseFocus,
      ctx.hasPlan ? "analyst" : "plan",
    );
    const ordered = candidates.sort((a, b) => b.priority - a.priority),
      unseen = ordered.filter(
        (c) =>
          !ctx.presented?.some(
            (v) =>
              v.key === c.key &&
              Date.parse(ctx.now) - Date.parse(v.at) < 7 * 86400000,
          ),
      ),
      current = ctx.currentKey && ordered.find((c) => c.key === ctx.currentKey);
    return {
      ...((current && current.priority >= ordered[0].priority
        ? current
        : null) ||
        unseen[0] ||
        ordered.at(-1)),
      preferences: p,
      method:
        "Regras determinísticas; não é diagnóstico ou recomendação de entrada.",
    };
  }
  return { library, principles, prefs, select };
});
