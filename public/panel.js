/* Four internal dashboard sections; account data and the main navigation remain shared. */
const panelUI = {
  view: "overview",
  account: null,
  side: "",
  setup: "",
  status: "closed",
  capitalMode: "dd",
  initialized: false,
  expanded: new Map(),
};
const PANEL_TABS = [
  ["overview", "Visão Geral"],
  ["performance", "Performance"],
  ["capital", "Risco & Capital"],
  ["insights", "Insights"],
];
const PANEL_HELP = {
  net: "Soma do P&L líquido registrado. Imports com resultado líquido não têm comissões descontadas novamente. Confira valores estimados ou sem identificação da moeda.",
  return:
    "P&L do período dividido pelo capital de abertura. Com depósitos ou saques, usa Modified Dietz (fluxos ponderados pelo tempo). Requer capital inicial confirmado e denominador positivo. Filtros de ativo/setup não transformam retorno de uma parcela no retorno integral da conta.",
  wr: "Trades com P&L positivo ÷ todos os trades fechados com P&L válido. Breakevens entram no denominador. Trades abertos não entram.",
  pf: "Lucro bruto dos trades positivos ÷ valor absoluto da perda bruta dos negativos. Só breakevens: indisponível. Ganhos sem perdas: infinito.",
  dd: "Maior queda da curva de P&L filtrada, desde um pico anterior, incluindo o ponto inicial zero. Em Risco & Capital, o drawdown histórico usa a conta inteira e ajusta o pico por fluxos de capital.",
  n: "Operações fechadas com resultado válido nos filtros. Não inclui posições abertas ou resultados ausentes.",
  r: "O motor existente prioriza P&L líquido ÷ risco monetário inicial, depois R explícito e depois níveis de preço válidos. R derivado de preço não desconta custos. A cobertura fica sempre visível.",
  capital:
    "Saldo realizado = capital inicial confirmado + P&L fechado + depósitos − retiradas registrados. Não é equity de posições abertas. Os movimentos não são lucro e não contam como trades.",
};
function panelQuery() {
  return {
    from: F.from,
    to: F.to,
    symbol: F.sym,
    strategy: F.strat,
    session: eliteDashSession,
    account: panelUI.account,
    side: panelUI.side,
    setup: panelUI.setup,
    status: panelUI.status,
    today: taDailyDate(),
  };
}
function panelAdapter() {
  return {
    universe: () => insUniverse(),
    stats: st,
    realizedR: realizedTradeR,
    session: eliteDashSessionName,
    process: panelProcess,
  };
}
function panelModel() {
  return PanelEngine.model(S, panelQuery(), panelAdapter());
}
function panelSwitch(view, focus = false) {
  if (!PANEL_TABS.some((t) => t[0] === view)) return;
  panelUI.view = view;
  R();
  if (focus) document.getElementById("panel-tab-" + view)?.focus();
}
function panelTabKey(event, index) {
  let next = index;
  if (event.key === "ArrowRight") next = (index + 1) % 4;
  else if (event.key === "ArrowLeft") next = (index + 3) % 4;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = 3;
  else return;
  event.preventDefault();
  panelSwitch(PANEL_TABS[next][0], true);
}
function panelExplain(key) {
  growthDialog(
    "Como interpretar a métrica",
    `<p>${esc(PANEL_HELP[key] || "Calculado sobre os registros válidos dos filtros selecionados.")}</p>`,
  );
}
function panelMoney(value, m = null) {
  return value === null || value === undefined || m?.mixed
    ? "Dados insuficientes"
    : money(value);
}
function panelR(value) {
  return value === null || value === undefined
    ? "Dados insuficientes"
    : dashboardMoneyHidden()
      ? "••••"
      : (value > 0 ? "+" : "") + growthNum(value) + " R";
}
function panelPct(value) {
  return value === null || value === undefined
    ? "Dados insuficientes"
    : (value > 0 ? "+" : "") + growthNum(value) + "%";
}
function panelNum(value, digits = 2) {
  return value === null || value === undefined
    ? "Dados insuficientes"
    : value === Infinity
      ? "∞"
      : growthNum(value, digits);
}
function panelMetric(label, value, note = "", color = "", help = "") {
  return `<div class="k"><small>${esc(label)}${help ? `<button class="panel-info" data-help="${help}" onclick="event.stopPropagation();panelExplain(this.dataset.help)" aria-label="Como interpretar ${esc(label)}">i</button>` : ""}</small><b class="${color}">${esc(value)}</b><small>${esc(note)}</small></div>`;
}
function panelOptions(values, selected, empty) {
  return (
    `<option value="">${esc(empty)}</option>` +
    [...new Set(values)]
      .filter((v) => v !== null && v !== undefined && v !== "")
      .sort()
      .map(
        (v) =>
          `<option value="${esc(v)}" ${selected === v ? "selected" : ""}>${esc(v)}</option>`,
      )
      .join("")
  );
}
function panelSetRange(p) {
  rangePreset = p;
  const r = PanelEngine.bounds(p, taDailyDate(), F);
  F.from = r.from;
  F.to = r.to;
  if (F.from) cm = new Date(F.from + "T12:00");
  selDay = null;
  R();
}
function panelResetFilters() {
  panelUI.account = null;
  panelUI.side = "";
  panelUI.setup = "";
  panelUI.status = "closed";
  eliteDashSession = "";
  F = { from: "", to: "", sym: "", strat: "" };
  panelSetRange("all");
}
function panelFilterFields() {
  return `<div class="filters panel-filter-fields" aria-label="Filtros de performance"><label>Período<select aria-label="Período" onchange="panelSetRange(this.value)">${[
    ["today", "Hoje"],
    ["week", "Semana"],
    ["month", "Mês"],
    ["quarter", "3 meses"],
    ["half", "6 meses"],
    ["year", "Ano"],
    ["all", "Todo histórico"],
    ["custom", "Personalizado"],
  ]
    .map(
      ([id, label]) =>
        `<option value="${id}" ${rangePreset === id ? "selected" : ""}>${label}</option>`,
    )
    .join(
      "",
    )}${["30", "90", "lastmonth"].includes(rangePreset) ? `<option value="${rangePreset}" selected>Período selecionado</option>` : ""}</select></label><label>De<input aria-label="Data inicial" type="date" value="${F.from}" onchange="customRange('from',this.value)"></label><label>Até<input aria-label="Data final" type="date" value="${F.to}" onchange="customRange('to',this.value)"></label><label>Ativo<select aria-label="Ativo" onchange="F.sym=this.value;R()">${panelOptions(
    S.trades.map((t) => t.symbol),
    F.sym,
    "Todos os ativos",
  )}</select></label><label>Estratégia<select aria-label="Estratégia" onchange="F.strat=this.value;R()">${panelOptions(
    S.trades.map((t) => t.strategy),
    F.strat,
    "Todas as estratégias",
  )}</select></label><button class="b s" onclick="panelResetFilters()">Limpar</button></div>`;
}
const panelOriginalFilterFields = filterFields;
filterFields = function () {
  return tab === "dash" ? panelFilterFields() : panelOriginalFilterFields();
};
function smcDashboardFilterControls(ts) {
  const accounts = [...new Set(S.trades.map(PanelEngine.account))].filter(
      Boolean,
    ),
    known = ts.map(realizedTradeR).filter((r) => r.value !== null).length;
  return `<div class="panel-extra-filters"><label>Conta de trading<select aria-label="Conta de trading" onchange="panelUI.account=this.value===''?null:this.value==='__unassigned'?'':this.value;R()" ${accounts.length ? "" : "disabled"}><option value="">${accounts.length ? "Todas as contas" : "Conta atual"}</option>${accounts.length && S.trades.some((t) => !PanelEngine.account(t)) ? `<option value="__unassigned" ${panelUI.account === "" ? "selected" : ""}>Conta atual · sem identificador</option>` : ""}${accounts.map((id) => `<option value="${esc(id)}" ${panelUI.account === id ? "selected" : ""}>${esc((S.tradingAccounts || []).find((a) => String(a.id) === id)?.name || id)}</option>`).join("")}</select></label><label>Sessão<select aria-label="Sessão do painel" onchange="eliteDashSession=this.value;R()">${panelOptions(S.trades.map(eliteDashSessionName), eliteDashSession, "Todas as sessões")}</select></label><label>Direção<select aria-label="Tipo de operação" onchange="panelUI.side=this.value;R()">${[
    ["", "Todas"],
    ["long", "Compra"],
    ["short", "Venda"],
  ]
    .map(
      ([k, v]) =>
        `<option value="${k}" ${panelUI.side === k ? "selected" : ""}>${v}</option>`,
    )
    .join(
      "",
    )}</select></label><label>Setup<select aria-label="Setup" onchange="panelUI.setup=this.value;R()">${panelOptions(
    S.trades.map((t) => t.setup),
    panelUI.setup,
    "Todos os setups",
  )}</select></label><label>Status<select aria-label="Status da operação" onchange="panelUI.status=this.value;R()">${[
    ["closed", "Fechadas"],
    ["open", "Abertas registradas"],
    ["all", "Todas registradas"],
  ]
    .map(
      ([k, v]) =>
        `<option value="${k}" ${panelUI.status === k ? "selected" : ""}>${v}</option>`,
    )
    .join(
      "",
    )}</select></label><label>Unidade dos gráficos<select aria-label="Unidade do painel" onchange="eliteDashChangeUnit(this.value)"><option value="money" ${eliteDashUnit === "money" ? "selected" : ""}>${esc(S.currency || "Moeda da conta")}</option><option value="r" ${eliteDashUnit === "r" ? "selected" : ""}>R realizado · cobertura informada</option></select></label></div><p class="muted-note">Sessões classificam o horário de entrada registrado, sem inferir fuso da corretora. Não há conversão cambial. As revisões semanais/mensais mantêm períodos próprios.</p>`;
}
function panelFacts(items) {
  return `<dl class="panel-facts">${items.map(([label, value, note]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd>${note ? `<small>${esc(note)}</small>` : ""}</div>`).join("")}</dl>`;
}
function panelGroups(groups, m, limit = null) {
  const rows = limit ? groups.slice(0, limit) : groups;
  return rows.length
    ? `<div class="table-wrap"><table class="panel-group-table"><thead><tr><th>Grupo</th><th>Trades</th><th>Resultado</th><th>Win rate</th></tr></thead><tbody>${rows.map((g) => `<tr><th scope="row">${esc(g.name)}</th><td>${g.n}</td><td class="${cl(eliteDashUnit === "r" ? g.r : g.net)}">${esc(eliteDashUnit === "r" ? panelR(g.r) : panelMoney(g.net, m))}${eliteDashUnit === "r" && g.rn !== g.n ? `<small>${g.rn}/${g.n} com R</small>` : ""}</td><td>${growthNum(g.wr, 1)}%</td></tr>`).join("")}</tbody></table></div>`
    : '<p class="muted-note">Dados insuficientes neste período.</p>';
}
function panelChartData(m, mode) {
  if (mode === "balance")
    return m.cap.available
      ? m.cap.curve.filter(
          (p) =>
            (!m.query.from || p.date.slice(0, 10) >= m.query.from) &&
            p.date.slice(0, 10) <= m.query.to,
        )
      : [];
  const useR = mode === "r" || eliteDashUnit === "r",
    rows = useR
      ? m.rows
          .map((t) => ({ ...t, pnl: realizedTradeR(t).value }))
          .filter((t) => t.pnl !== null)
      : m.rows;
  if (m.mixed && !useR) return [];
  let total = 0,
    peak = 0;
  return Object.entries(grp(rows, day))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, s]) => {
      total += s.net;
      peak = Math.max(peak, total);
      return {
        date,
        value: mode === "daily" ? s.net : mode === "dd" ? total - peak : total,
        net: s.net,
        n: s.n,
      };
    });
}
function panelMainChart(m) {
  const data = panelChartData(m, chartMode),
    isR =
      chartMode === "r" || (eliteDashUnit === "r" && chartMode !== "balance"),
    format = isR ? (n) => panelR(n) : money;
  return `<div class="elite-dash-charts"><section class="card terminal-performance"><div class="section-head"><h2>Evolução do resultado</h2><label><span class="sr-only">Visualização do gráfico</span><select aria-label="Visualização do gráfico" onchange="chartMode=this.value;R()">${Object.entries(
    chartNames,
  )
    .map(
      ([key, label]) =>
        `<option value="${key}" ${chartMode === key ? "selected" : ""}>${esc(label)}</option>`,
    )
    .join(
      "",
    )}</select></label></div>${data.length ? terminalChart(data, { id: "performance", height: 240, label: chartNames[chartMode] + (isR ? " · R" : ""), format, netFormat: format, daily: chartMode === "daily", includeZero: chartMode !== "balance", readout: true }) : `<div class="panel-empty">${chartMode === "balance" && !m.cap.available ? "Confirme o capital inicial da conta para visualizar o saldo." : "Dados insuficientes para este gráfico."}</div>`}<p class="muted-note">${chartMode === "balance" ? "Saldo realizado da conta completa até a data final; inclui movimentos registrados, sem equity de posições abertas." : "P&L fechado nos filtros. " + (isR ? `${m.known} de ${m.rows.length} operações com R válido${m.priceR ? "; há R por preço, sem ajuste de custos" : ""}.` : "Comissões já incluídas no P&L não são descontadas novamente.")}</p><button class="scene-link" onclick="chartMode='balance';R()">Saldo desde o início</button></section></div>`;
}
function panelOverview(m) {
  const s = m.s,
    n = s.n;
  return `<div class="primary-metrics elite-dash-metrics panel-primary">${panelMetric("P&L líquido", n ? panelMoney(s.net, m) : "Dados insuficientes", "Resultado fechado no período", cl(s.net), "net")}${panelMetric("Retorno do período", panelPct(m.returns.percent), m.returns.method, m.returns.percent === null ? "" : cl(m.returns.percent), "return")}${panelMetric("Win Rate", n ? growthNum(s.wr, 1) + "%" : "Dados insuficientes", `${s.w} ganhos / ${n} fechamentos`, "", "wr")}${panelMetric("Profit Factor", n && !m.mixed && (s.w || s.l) ? panelNum(m.mixed ? null : s.pf) : "Dados insuficientes", "Lucro bruto ÷ perda bruta", "", "pf")}${panelMetric("Drawdown máximo", n ? panelMoney(-s.dd, m) : "Dados insuficientes", "Queda da curva filtrada", s.dd ? "r" : "", "dd")}${panelMetric("Total de operações", String(n), "Fechadas com P&L válido", "", "n")}</div><section class="panel-secondary" aria-label="Resumo complementar"><span>Acumulado <b>${esc(panelR(m.r))}</b></span><span>Expectancy <b>${esc(panelMoney(n ? s.ex : null, m))} · ${esc(panelR(m.expectancyR))}</b></span><span><b>${s.w}</b> wins · <b>${s.l}</b> losses · <b>${n - s.w - s.l}</b> breakevens</span><span>Anterior <b>${m.priorRange && m.old.n ? panelMoney(s.net - m.old.net, m) : "Sem base comparável"}</b>${m.priorRange && m.old.n ? " · variação de P&L" : ""}</span></section><div class="panel-overview-focus">${panelMainChart(m)}<aside class="panel-overview-bottom"><section class="card"><h2>Ativos em resumo</h2>${panelGroups(m.groups.asset, m, 3)}<button class="scene-link" onclick="panelSwitch('performance')">Comparar todos os grupos ${terminalIcon("arrow")}</button></section><section class="card"><h2>Sessões em resumo</h2>${panelGroups(m.groups.session, m, 3)}</section><section class="card"><h2>Consistência do período</h2><p>${m.daily.length ? `${m.daily.filter((d) => d.net > 0).length} dias positivos, ${m.daily.filter((d) => d.net < 0).length} negativos e ${m.daily.filter((d) => d.net === 0).length} em equilíbrio.` : "Sem dias operados nos filtros."}</p><p>${m.weekly.length ? `${m.weekly.filter((w) => w.net > 0).length} de ${m.weekly.length} semanas com resultado positivo nos registros.` : "Sem semanas comparáveis."}</p><small>Lucro não comprova aderência. Confira os registros de execução em Insights.</small></section></aside></div><details class="card panel-calendar"><summary>Calendário de trading</summary><div class="elite-dash-calendar">${vCal(m.rows)}</div></details><details class="card"><summary>Operações recentes</summary><div class="terminal-recent">${m.rows.length ? terminalRecentTrades(m.rows) : "<p>Sem operações.</p>"}</div></details>`;
}
function panelEfficiency(m) {
  const s = m.s;
  return `<details class="card panel-block" open><summary>Eficiência operacional</summary>${panelFacts(
    [
      [
        "Win Rate",
        s.n ? growthNum(s.wr, 1) + "%" : "Dados insuficientes",
        "Inclui breakevens no denominador",
      ],
      [
        "Profit Factor",
        s.n && !m.mixed && (s.w || s.l)
          ? panelNum(m.mixed ? null : s.pf)
          : "Dados insuficientes",
        "Ganhos sem perdas: ∞",
      ],
      [
        "Expectancy por trade",
        panelMoney(s.n ? s.ex : null, m),
        "Moeda da conta",
      ],
      [
        "Expectancy em R",
        panelR(m.expectancyR),
        `${m.known}/${s.n} com R válido`,
      ],
      ["Payoff Ratio", panelNum(m.payoff), "Ganho médio ÷ perda média"],
      [
        "Acerto de equilíbrio",
        m.breakEvenRate === null
          ? "Dados insuficientes"
          : growthNum(m.breakEvenRate) + "%",
        "1 ÷ (1 + payoff)",
      ],
      ["Ganho médio", panelMoney(s.w ? s.aw : null, m)],
      ["Perda média", panelMoney(s.l ? -s.al : null, m)],
      [
        "Maior ganho",
        panelMoney(
          s.w
            ? Math.max(...m.rows.filter((t) => t.pnl > 0).map((t) => t.pnl))
            : null,
          m,
        ),
      ],
      [
        "Maior perda",
        panelMoney(
          s.l
            ? Math.min(...m.rows.filter((t) => t.pnl < 0).map((t) => t.pnl))
            : null,
          m,
        ),
      ],
      [
        "Sequência atual",
        m.currentStreak.n
          ? `${m.currentStreak.n} ${m.currentStreak.kind === "win" ? "ganhos" : "perdas"}`
          : "Sem sequência ativa",
        "Breakeven interrompe a sequência",
      ],
      ["Maior sequência", `${s.mcw} ganhos · ${s.mcl} perdas`],
    ],
  )}</details><details class="card panel-block"><summary>Ativos e sessões</summary><div class="panel-two-col"><section><h3>Por ativo</h3>${panelGroups(m.groups.asset, m)}</section><section><h3>Por sessão</h3>${panelGroups(m.groups.session, m)}</section><section><h3>Por horário de entrada</h3>${panelGroups(m.groups.hour, m)}</section><section><h3>Por dia da semana</h3>${panelGroups(m.groups.weekday, m)}</section></div></details><details class="card panel-block"><summary>Execução e setups</summary>${panelFacts(
    [
      [
        "R realizado médio",
        panelR(m.expectancyR),
        "Resultado ÷ risco inicial válido; não é payoff",
      ],
      [
        "R:R médio planejado",
        m.plannedRR === null
          ? "Dados insuficientes"
          : growthNum(m.plannedRR) + "R",
        `${m.plannedN}/${s.n} com planejamento registrado`,
      ],
      [
        "Duração média",
        m.duration === null
          ? "Dados insuficientes"
          : growthNum(m.duration, 1) + " min",
        `${m.durationN}/${s.n} com abertura e fechamento válidos`,
      ],
    ],
  )}<div class="panel-two-col"><section><h3>Por direção</h3>${panelGroups(m.groups.direction, m)}</section><section><h3>Por setup</h3>${panelGroups(m.groups.setup, m)}</section></div></details><details class="card panel-block"><summary>Distribuição estatística</summary>${panelOutcomeDistributions(m)}${m.known ? `<div class="panel-distribution">${m.rBins.map((b) => `<div><span>${esc(b.name)}</span><meter min="0" max="${m.known}" value="${b.n}">${b.n}</meter><b>${b.n}</b></div>`).join("")}</div>` : "<p>Dados insuficientes: informe o risco inicial ou R realizado nas operações.</p>"}<p>${m.known}/${s.n} operações com R válido; ausentes não são contabilizadas como zero.</p></details>`;
}
function panelCapital(m) {
  const c = m.cap,
    s = m.s,
    series = c.available
      ? (panelUI.capitalMode === "balance" ? c.curve : c.ddCurve).filter(
          (p) =>
            (!m.query.from || p.date.slice(0, 10) >= m.query.from) &&
            p.date.slice(0, 10) <= m.query.to,
        )
      : [];
  return `<section class="card"><div class="section-head"><h2>Capital e proteção da conta</h2><button class="panel-info" onclick="panelExplain('capital')" aria-label="Como interpretar capital">i</button></div><p class="muted-note">Capital considera a conta inteira até ${esc(m.query.to)}, sem tratar filtros de ativo ou setup como uma conta separada. As análises de operações abaixo respeitam os filtros.</p>${panelFacts(
    [
      [
        "Capital inicial",
        panelMoney(c.available ? c.initial : null, m),
        "Confirmação manual necessária",
      ],
      [
        "Saldo realizado",
        panelMoney(c.available ? c.balance : null, m),
        "Não representa equity ao vivo",
      ],
      [
        "Drawdown atual",
        panelMoney(c.available ? -c.currentDD : null, m),
        "Pico ajustado por movimentos",
      ],
      [
        "Drawdown máximo histórico",
        panelMoney(c.available ? -c.maxDD : null, m),
      ],
      [
        "Drawdown histórico %",
        c.available ? panelPct(c.maxPercent) : "Dados insuficientes",
        "Requer pico de capital positivo",
      ],
      [
        "Drawdown filtrado em R",
        panelR(m.riskR),
        `${m.known}/${s.n} com R válido`,
      ],
      [
        "Depósitos registrados",
        panelMoney(c.available ? c.deposits : null, m),
        "Nunca entram no P&L",
      ],
      [
        "Retiradas registradas",
        panelMoney(c.available ? -c.withdrawals : null, m),
        "Nunca entram no P&L",
      ],
    ],
  )}${!c.available ? `<p>${esc(c.reason)}</p>${dashboardMoneyHidden() ? "" : accountConfig()}` : ""}</section><section class="card"><div class="section-head"><h2>Curva de capital / drawdown</h2><select aria-label="Curva de capital" onchange="panelUI.capitalMode=this.value;R()"><option value="dd" ${panelUI.capitalMode === "dd" ? "selected" : ""}>Drawdown da conta</option><option value="balance" ${panelUI.capitalMode === "balance" ? "selected" : ""}>Saldo realizado</option></select></div>${series.length ? terminalChart(series, { id: "panel-capital", height: 240, label: panelUI.capitalMode === "dd" ? "Drawdown da conta" : "Saldo realizado", format: money, netFormat: money, color: panelUI.capitalMode === "dd" ? "var(--r)" : null, includeZero: panelUI.capitalMode === "dd" }) : '<div class="panel-empty">Dados insuficientes para esta curva.</div>'}</section><details class="card panel-block"><summary>Gestão de risco e recuperação</summary>${panelFacts(
    [
      [
        "Risco inicial médio",
        panelMoney(m.initialRisk, m),
        `${m.riskN}/${s.n} operações`,
      ],
      [
        "Risco efetivo médio registrado",
        panelMoney(m.actualRisk, m),
        `${m.actualRiskN}/${s.n}; não inferido da perda`,
      ],
      [
        "Maior perda diária",
        panelMoney(
          m.daily.some((d) => d.net < 0)
            ? Math.min(...m.daily.map((d) => d.net))
            : null,
          m,
        ),
      ],
      [
        "Maior perda semanal",
        panelMoney(
          m.weekly.some((d) => d.net < 0)
            ? Math.min(...m.weekly.map((d) => d.net))
            : null,
          m,
        ),
      ],
      [
        "Dias positivos / negativos",
        `${m.daily.filter((d) => d.net > 0).length} / ${m.daily.filter((d) => d.net < 0).length}`,
      ],
      [
        "Recovery Factor",
        s.dd > 0 ? panelNum(s.net / s.dd) : "Dados insuficientes",
        "P&L filtrado ÷ drawdown máximo filtrado",
      ],
      [
        "Maior recuperação concluída",
        c.recoveryDays == null
          ? "Sem recuperação concluída registrada"
          : growthNum(c.recoveryDays, 1) + " dias",
        "Do pico registrado até sua recuperação",
      ],
      [
        "Tempo ainda abaixo do pico",
        c.underwaterDays == null
          ? "Sem queda aberta registrada"
          : growthNum(c.underwaterDays, 1) + " dias",
      ],
      [
        "Violações de risco / limite",
        m.knownRisk
          ? `${m.violations.length} / ${m.knownRisk} avaliadas`
          : "Dados insuficientes",
        "Regras configuradas e avaliações registradas",
      ],
    ],
  )}<h3>Concentração do risco inicial por ativo</h3><p class="muted-note">Soma do risco informado em trades fechados; não representa exposição simultânea.</p>${panelRiskShares(m)}</details><details class="card panel-block"><summary>Posições abertas e exposição</summary>${m.open.length ? `<p>${m.open.length} posições abertas registradas. Sem atualização de corretora ou equity ao vivo.</p><div class="table-wrap"><table><thead><tr><th>Ativo</th><th>Abertura</th><th>Risco registrado</th></tr></thead><tbody>${m.open.map((t) => `<tr><td>${esc(t.symbol || "Não informado")}</td><td>${esc(t.open || "Não informado")}</td><td>${esc(panelMoney(numberRisk(t.risk), m))}</td></tr>`).join("")}</tbody></table></div>` : "<p>Dados insuficientes. O histórico atual prioriza posições fechadas; não há conexão de posições abertas ao vivo.</p>"}</details>${panelMovementView(m)}`;
}
function numberRisk(v) {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}
function panelMovementView(m) {
  return `<details class="card panel-block"><summary>Depósitos e retiradas · registros de capital</summary><p>Registre movimentos posteriores ao capital inicial confirmado. Não repita depósitos já incluídos nessa base. A data/hora deve usar a mesma referência do histórico da conta.</p>${dashboardMoneyHidden() ? "<p>Mostre os valores para editar movimentos.</p>" : `<form onsubmit="panelSaveMovement(event)"><div class="panel-extra-filters"><label>Tipo<select name="type"><option value="deposit">Depósito</option><option value="withdrawal">Retirada</option></select></label><label>Data/hora<input name="at" type="datetime-local" required></label><label>Valor positivo (${esc(S.currency || "defina a moeda")})<input name="amount" type="number" min="0.01" step="0.01" required></label><label>Observação<input name="note" maxlength="200"></label></div><button class="b s" type="submit">Registrar movimento</button><p id="panel-movement-message" role="status"></p></form>`}<div class="table-wrap"><table><thead><tr><th>Data</th><th>Tipo</th><th>Valor</th><th></th></tr></thead><tbody>${(m.cap.flows || []).map((f) => `<tr><td>${esc(f.at.replace("T", " "))}</td><td>${f.type === "deposit" ? "Depósito" : "Retirada"}</td><td>${esc(panelMoney(f.signed, m))}</td><td><button class="b s" data-id="${esc(f.id)}" onclick="panelDeleteMovement(this.dataset.id)">Excluir</button></td></tr>`).join("") || '<tr><td colspan="4">Nenhum movimento registrado para esta conta.</td></tr>'}</tbody></table></div></details>`;
}
function panelSaveMovement(event) {
  event.preventDefault();
  const f = new FormData(event.target),
    amount = Number(f.get("amount")),
    at = String(f.get("at")),
    old = S.capitalMovements;
  if (
    !S.currency ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !PanelEngine.validDate(at.slice(0, 10)) ||
    PanelEngine.stamp(at) === null ||
    at.slice(0, 10) > taDailyDate()
  ) {
    document.getElementById("panel-movement-message").textContent =
      "Defina a moeda da conta e informe data válida (até hoje) e valor positivo.";
    return;
  }
  try {
    const selected = panelUI.account;
    const accounts = [...new Set(insUniverse().map(PanelEngine.account))];
    if (selected === null && accounts.some(Boolean))
      throw Error("Selecione uma conta antes de registrar o movimento.");
    const accountId = selected || "";
    if (PanelEngine.baseline(S, accountId).currency !== S.currency)
      throw Error(
        "Selecione a mesma moeda registrada para esta conta antes de adicionar movimentos.",
      );
    const movement = {
      id: crypto.randomUUID(),
      type: f.get("type"),
      at,
      amount,
      currency: S.currency,
      accountId,
      note: String(f.get("note")).trim(),
    };
    S.capitalMovements = [...(Array.isArray(old) ? old : []), movement];
    persistState(S);
    R();
  } catch (e) {
    S.capitalMovements = old;
    document.getElementById("panel-movement-message").textContent = e.message;
  }
}
function panelDeleteMovement(id) {
  if (
    !confirm(
      "Excluir este movimento de capital? O saldo e os percentuais serão recalculados.",
    )
  )
    return;
  const old = S.capitalMovements;
  try {
    S.capitalMovements = (old || []).filter((f) => f.id !== id);
    persistState(S);
    R();
  } catch (e) {
    S.capitalMovements = old;
    alert(e.message);
  }
}
function panelInsightCandidates(m) {
  const candidates = [],
    n = m.s.n,
    checked = m.process.checked,
    errors = m.rows.filter((t) => Array.isArray(t.behavior?.errors));
  if (errors.length >= 5 && errors.length / Math.max(1, n) >= 0.6) {
    const counts = insErrorCounts(errors);
    for (const [id, label, action] of INS_ERRORS) {
      if ((counts[id] || 0) >= 2)
        candidates.push({
          priority: 100,
          title: label,
          evidence: `${counts[id]} de ${errors.length} operações com erros avaliados (${n} no período).`,
          implication:
            "Há recorrência declarada que merece revisão; o resultado financeiro não comprova sua causa.",
          action,
        });
    }
  }
  if (m.process.plan.n >= 5 && m.process.plan.value !== null) {
    const outside = checked.filter((x) => x.c.plan === false).length;
    candidates.push({
      priority: outside ? 90 : 50,
      title: outside
        ? "Reveja os critérios de entrada"
        : "Plano respeitado nos registros",
      evidence: `${growthNum(m.process.plan.value, 0)}% de aderência entre ${m.process.plan.n}/${n} operações avaliadas.`,
      implication: outside
        ? "Entradas declaradas fora do sistema dificultam avaliar sua execução."
        : "Há evidência registrada de respeito ao processo, sem garantia de resultado futuro.",
      action: outside
        ? "Confira o checklist antes da próxima entrada."
        : "Mantenha o mesmo critério de seleção, sem aumentar a frequência.",
    });
  }
  if (m.pairs.length >= 5) {
    const first = st(m.pairs.map((p) => p.first)),
      second = st(m.pairs.map((p) => p.second));
    candidates.push({
      priority: 60,
      title: "Primeira e segunda operação do dia",
      evidence: `${m.pairs.length} dias comparáveis: ${growthNum(first.wr, 1)}% e ${growthNum(second.wr, 1)}% de acerto, respectivamente.`,
      implication:
        "É uma diferença descritiva; horário e número da operação não demonstram causa.",
      action:
        "Compare o contexto registrado das duas entradas antes de alterar seu plano.",
    });
  }
  return candidates.sort((a, b) => b.priority - a.priority).slice(0, 3);
}
function panelInsights(m) {
  const insights = panelInsightCandidates(m);
  return `<section class="card"><div class="section-head"><h2>Prioridades do período</h2><span class="badge">Regras transparentes · até 3 observações</span></div>${insights.length ? `<div class="panel-insight-grid">${insights.map((i) => `<article><h3>${esc(i.title)}</h3><dl><dt>Evidência</dt><dd>${esc(i.evidence)}</dd><dt>Possível implicação</dt><dd>${esc(i.implication)}</dd><dt>Próximo passo</dt><dd>${esc(i.action)}</dd></dl></article>`).join("")}</div>` : "<p>Dados insuficientes para apontar prioridades comportamentais neste período. Registre avaliações do plano e erros quando ocorrerem.</p>"}</section><details class="card panel-block" open><summary>Consistência semanal e mensal</summary><div class="panel-two-col"><section><h3>Semanas</h3>${panelGroups(m.weekly, m)}</section><section><h3>Meses</h3>${panelGroups(m.monthly, m)}</section></div><p>Os grupos usam somente a parcela incluída nos filtros; semanas ou meses incompletos não são períodos fechados de certificação.</p></details><details class="card panel-block"><summary>Plano, disciplina e execução</summary>${panelFacts(
    [
      [
        "Aderência ao plano",
        m.process.plan.value === null
          ? "Dados insuficientes"
          : growthNum(m.process.plan.value, 1) + "%",
        `${m.process.plan.n}/${m.s.n} avaliadas`,
      ],
      [
        "Dentro / fora do plano",
        `${m.within.n} / ${m.outside.n}`,
        "Registros desconhecidos não equivalem a dentro",
      ],
      [
        "Resultado dentro do plano",
        panelMoney(m.within.n ? m.within.net : null, m),
      ],
      [
        "Resultado fora do plano",
        panelMoney(m.outside.n ? m.outside.net : null, m),
      ],
      [
        "Resultado após perda",
        m.afterLossN >= 5
          ? panelMoney(m.afterLoss.net, m)
          : "Dados insuficientes",
        `${m.afterLossN} operações subsequentes nos filtros; associação, não causa`,
      ],
      [
        "Invisible Wins registrados",
        m.decisions === null
          ? "Sem associação aos filtros atuais"
          : String(m.decisions.length),
        "Decisões explícitas de não entrar fora do plano",
      ],
      [
        "Missed Setups registrados",
        m.missed === null
          ? "Sem associação aos filtros atuais"
          : Array.isArray(S.missedSetups)
            ? String(m.missed.length)
            : "Ainda não registrados",
        "Não inferidos de candles ou ausência de trades",
      ],
    ],
  )}<button class="b s" onclick="growthDecision()">Registrar decisão de não operar</button><button class="b s" onclick="panelRecordMissed()">Registrar setup perdido</button>${panelMissedHistory(m)}</details><details class="card panel-block"><summary>Estados emocionais registrados</summary>${panelGroups(m.emotions, m)}<p class="muted-note">Usa emoção informada no trade ou check-in vinculado explicitamente. FOMO e revenge trading só aparecem se registrados. Grupos com menos de 5 operações não sustentam conclusões; associação não prova causa.</p></details>`;
}
function panelRecordMissed() {
  const d = growthDialog(
    "Registrar setup perdido",
    `<p>Uma oportunidade não executada não gera lucro ou perda na plataforma.</p><form id="panel-missed-form"><div class="growth-form-grid"><label>Data<input name="date" type="date" value="${taDailyDate()}" required></label><label>Ativo<input name="symbol" maxlength="25" required></label><label class="growth-wide">Contexto ou aprendizado<textarea name="reason" maxlength="500" required></textarea></label></div><button class="b" type="submit">Salvar registro</button></form>`,
  );
  d.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target),
      date = String(f.get("date")),
      symbol = String(f.get("symbol")).trim().toUpperCase(),
      reason = String(f.get("reason")).trim(),
      old = S.missedSetups;
    try {
      if (
        !PanelEngine.validDate(date) ||
        date > taDailyDate() ||
        !symbol ||
        !reason
      )
        throw Error("Preencha uma data válida, ativo e contexto.");
      if (
        panelUI.account === null &&
        insUniverse().some((t) => PanelEngine.account(t))
      )
        throw Error(
          "Selecione uma conta nos filtros antes de registrar o setup perdido.",
        );
      S.missedSetups = [
        ...(Array.isArray(old) ? old : []),
        {
          id: crypto.randomUUID(),
          date,
          symbol,
          reason,
          accountId: panelUI.account || "",
        },
      ];
      persistState(S);
      d.close();
      R();
    } catch (error) {
      S.missedSetups = old;
      growthError(error);
    }
  };
}
function eliteDashboardView() {
  const m = panelModel(),
    view = PANEL_TABS.some((t) => t[0] === panelUI.view)
      ? panelUI.view
      : "overview";
  return `<section class="elite-dashboard panel-workspace"><div class="panel-tabs" role="tablist" aria-label="Seções do Painel">${PANEL_TABS.map(([id, label], i) => `<button id="panel-tab-${id}" role="tab" aria-selected="${view === id}" aria-controls="panel-content" tabindex="${view === id ? "0" : "-1"}" onclick="panelSwitch('${id}')" onkeydown="panelTabKey(event,${i})">${label}</button>`).join("")}</div><div class="panel-coverage"><span>${m.known} de ${m.s.n} operações com R válido${m.priceR ? " · inclui R por preço sem custos" : ""}</span><span>${m.open.length ? m.open.length + " posições abertas registradas · não entram no P&L" : "Resultados fechados"}${m.rows.some((t) => t.est) ? " · inclui P&L estimado" : ""}</span></div>${m.mixed ? '<p class="panel-data-warning">Há moedas incompatíveis com a seleção. Totais monetários e razões de lucro/perda não são apresentados como conversões.</p>' : ""}<div id="panel-content" role="tabpanel" aria-labelledby="panel-tab-${view}">${view === "overview" ? panelOverview(m) : view === "performance" ? panelEfficiency(m) : view === "capital" ? panelCapital(m) : panelInsights(m)}</div><details class="card panel-method"><summary>Dados, fórmulas e limites de interpretação</summary><p>P&L é o resultado líquido registrado. Taxas já incluídas nos imports não são descontadas de novo. A moeda selecionada não executa câmbio. ${m.costN ? `${m.costN}/${m.s.n} operações têm componentes de custos separados; fluxo assinado registrado: ${panelMoney(m.costs, m)}.` : "Comissões e taxas não estão separadas nos registros legados; não são presumidas como zero."}</p><p>Win rate inclui breakevens no total. Profit factor divide ganhos pela perda bruta; expectancy é P&L líquido por operação. ${m.known}/${m.s.n} têm R válido; operações sem R não entram nos cálculos em R.</p><p>Retorno: ${esc(m.returns.method)}. Base de abertura ${esc(panelMoney(m.returns.opening, m))}. ${F.sym || F.strat || eliteDashSession || panelUI.side || panelUI.setup ? "O retorno filtrado representa uma parcela da conta, não o retorno integral." : ""}</p><p>Datas operacionais seguem os registros originais. Duração usa diferença entre horários registrados; fuso de corretora não é inferido. Contas, equity ao vivo, risco efetivo e oportunidades perdidas precisam de dados explícitos para aparecer.</p></details></section>`;
}

let panelChartObserver = null;
function panelFitChart() {
  const root = document.querySelector(
    '.panel-workspace [data-terminal-chart="performance"],.panel-workspace [data-terminal-chart="panel-capital"]',
  );
  if (!root) return;
  const model = terminalCharts.get(root.dataset.terminalChart);
  if (!model) return;
  const width = Math.max(260, Math.round(root.clientWidth)),
    height = Math.max(270, Math.round(width / 1.8));
  if (model.plotWidth === width && model.height === height) return;
  model.plotWidth = width;
  model.height = height;
  root.innerHTML = terminalDrawChart(model);
}
const panelPreviousAfterRender = terminalAfterRender;
terminalAfterRender = function () {
  panelPreviousAfterRender();
  panelChartObserver?.disconnect();
  if (tab === "dash") {
    panelRestoreDisclosures();
    panelFitChart();
    const root = document.querySelector(".panel-workspace .terminal-chart");
    if (root && window.ResizeObserver) {
      panelChartObserver = new ResizeObserver(panelFitChart);
      panelChartObserver.observe(root);
    }
  }
};

function panelRiskShares(m) {
  const total = m.riskGroups.reduce((v, g) => v + g.net, 0);
  return m.riskGroups.length
    ? `<div class="table-wrap"><table><thead><tr><th>Ativo</th><th>Risco inicial registrado</th><th>Participação</th></tr></thead><tbody>${m.riskGroups.map((g) => `<tr><td>${esc(g.name)}</td><td>${esc(panelMoney(g.net, m))}</td><td>${total && !m.mixed ? growthNum((g.net / total) * 100, 1) + "%" : "Dados insuficientes"}</td></tr>`).join("")}</tbody></table></div>`
    : "<p>Risco inicial não registrado.</p>";
}

function panelProcess(rows) {
  const universe = insUniverse(),
    rules = insRules(),
    ids = [...new Set(rows.map(PanelEngine.account))];
  if (ids.length <= 1)
    return insProcess(
      rows,
      universe.filter((t) => ids.includes(PanelEngine.account(t))),
      rules,
    );
  const checked = ids.flatMap(
      (id) =>
        insProcess(
          rows.filter((t) => PanelEngine.account(t) === id),
          universe.filter((t) => PanelEngine.account(t) === id),
          rules,
        ).checked,
    ),
    keys = rules.enabled,
    complete = keys.length
      ? checked.filter((x) => keys.every((k) => x.c[k] !== null))
      : [],
    coverage = rows.length ? complete.length / rows.length : 0;
  const rate = (fields) => {
    const evaluated = checked.filter((x) =>
        fields.every((k) => x.c[k] !== null),
      ),
      coverage = rows.length ? evaluated.length / rows.length : 0;
    return {
      n: evaluated.length,
      coverage,
      value:
        evaluated.length && coverage >= 0.6
          ? (evaluated.reduce(
              (v, x) => v + fields.filter((k) => x.c[k]).length,
              0,
            ) /
              (evaluated.length * fields.length)) *
            100
          : null,
    };
  };
  return {
    checked,
    complete: complete.length,
    coverage,
    score:
      complete.length && coverage >= 0.6
        ? (complete.reduce((v, x) => v + keys.filter((k) => x.c[k]).length, 0) /
            (complete.length * keys.length)) *
          100
        : null,
    plan: rate(["plan"]),
    execution: rate(["entry", "risk", "exit"]),
  };
}

function panelMissedHistory(m) {
  if (!m.missed?.length) return "";
  return `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Ativo</th><th>Contexto</th><th></th></tr></thead><tbody>${m.missed.map((v) => `<tr><td>${esc(v.date)}</td><td>${esc(v.symbol)}</td><td>${esc(v.reason)}</td><td><button class="b s" data-id="${esc(v.id)}" onclick="panelDeleteMissed(this.dataset.id)">Excluir registro</button></td></tr>`).join("")}</tbody></table></div>`;
}
function panelDeleteMissed(id) {
  const old = S.missedSetups;
  try {
    S.missedSetups = (Array.isArray(old) ? old : []).filter((v) => v.id !== id);
    persistState(S);
    R();
  } catch (e) {
    S.missedSetups = old;
    growthError(e);
  }
}

function panelOutcomeDistributions(m) {
  const s = m.s,
    wins = [
      { label: "Vitórias", n: s.w, color: "var(--gold)" },
      { label: "Derrotas", n: s.l, color: "#ff476b" },
      { label: "Empates", n: s.n - s.w - s.l, color: "#718c9b" },
    ],
    direction = [
      {
        label: "Compra",
        n: m.rows.filter((t) => t.side === "long").length,
        color: "var(--gold)",
      },
      {
        label: "Venda",
        n: m.rows.filter((t) => t.side === "short").length,
        color: "#ff476b",
      },
      {
        label: "Não informado",
        n: m.rows.filter((t) => !["long", "short"].includes(t.side)).length,
        color: "#718c9b",
      },
    ];
  return `<div class="panel-two-col"><section><h2>Distribuição de resultados</h2>${eliteDashDistribution(wins, s.n, "operações")}</section><section><h2>Tipo de operação</h2>${eliteDashDistribution(direction, s.n, "operações")}</section></div>`;
}

function panelRestoreDisclosures() {
  document.querySelectorAll(".panel-workspace details").forEach((d) => {
    const key =
      panelUI.view + "|" + d.querySelector(":scope>summary")?.textContent;
    if (panelUI.expanded.has(key)) d.open = panelUI.expanded.get(key);
    d.ontoggle = () => {
      if (d.isConnected) panelUI.expanded.set(key, d.open);
    };
  });
}
