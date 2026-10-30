/* SMC Elite identity and reference composition. Existing account/storage keys remain stable. */
function eliteReferenceHome() {
  return smcHomeView();
}
function smcPercent(value) {
  return value === null
    ? "—"
    : (value > 0 ? "+" : "") + value.toFixed(2).replace(".", ",") + "%";
}
function smcAssetStrip() {
  const p = taProfile(),
    instruments = taDailyRequestState("market").data?.instruments || [];
  return `<section class="smc-asset-strip reference-assets"><div><span>Seus ativos</span><button class="scene-link" onclick="taAssetOpen()">Editar ${terminalIcon("open")}</button></div><div class="reference-asset-grid">${
    p.instruments
      .slice(0, 3)
      .map((symbol) => {
        const record = instruments.find(
            (i) => i.symbol.replace(/\//g, "") === symbol.replace(/\//g, ""),
          ),
          v = record?.volatility;
        return `<article><span class="smc-asset-symbol">${eliteAssetIcon(symbol)}<b>${esc(symbol)}</b></span><span class="ta-volatility-${["low", "moderate", "high"].includes(v) ? v : "unknown"}">${{ low: "Baixa", moderate: "Moderada", high: "Alta" }[v] || "Sem dados"}</span>${record?.atrPercent != null ? `<small>ATR ${Number(record.atrPercent).toFixed(3)}%</small>` : ""}</article>`;
      })
      .join("") ||
    '<button class="b s" onclick="taAssetOpen()">Escolher ativos</button>'
  }</div>${p.instruments.length > 3 ? `<button class="scene-link" onclick="taAssetOpen()">Ver ${p.instruments.length} ativos selecionados</button>` : ""}</section>`;
}
function smcHomeView() {
  const p = taProfile(),
    h = Number(taDailyParts().hour),
    m = eliteMomentumModel(),
    insight = taDailyInsight(taDailyWeekStats()),
    valid = taBriefingHasResult(),
    ready = taConnection.authenticated && taConnection.services?.ai,
    events = taUpcomingEvents(innerWidth <= 760 ? 2 : 3),
    name = String(p.name || "trader")
      .trim()
      .split(/\s+/)[0],
    regime = m.week.n
      ? m.week.net > 0
        ? "Semana positiva"
        : m.week.net < 0
          ? "Semana em atenção"
          : "Semana equilibrada"
      : "Seu ritmo nesta semana",
    focus = valid ? taBriefing.result.action : insight.text;
  return `<section class="smc-home reference-home"><div class="smc-hero-grid"><section class="smc-desk reference-left"><div class="smc-office-scene" aria-hidden="true"><div class="scene-character-motion"></div></div><div class="scene-greeting"><h1><small>${h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"},</small><span>${esc(name)}!</span></h1><p>Pronto para o seu dia de trading?<br>Seu processo, com mais clareza.</p><blockquote><span aria-hidden="true">“</span><p>Disciplina hoje,<br>clareza na próxima decisão.</p></blockquote></div>${smcAssetStrip()}<div class="reference-workspace-actions"><div class="scene-composer">${eliteConnectionGate()}<button class="reference-command" onclick="eliteOpenTools()">${terminalIcon("tools")}<span>Escolha uma ferramenta ou análise…</span><b>${terminalIcon("arrow")}</b></button></div><div class="scene-bottom-actions elite-function-actions">${[
    ["analyst", "SMC Elite Analyst"],
    ["economic", "Eventos de hoje"],
    ["plan", "Revisar meu plano"],
    ["ins", "Raio-X do Trader"],
  ]
    .map(
      ([id, label]) =>
        `<button onclick="taGo('${id}')">${terminalIcon(id)}<span>${label}</span></button>`,
    )
    .join(
      "",
    )}</div></div></section><div class="reference-right"><section class="scene-card reference-briefing scene-focus"><div class="reference-card-heading">${terminalIcon("cal")}<h2>Briefing do Dia</h2><button class="scene-link" onclick="${ready ? "taGenerateBriefing()" : "taGo('settings')"}" ${taBriefing.pending ? "disabled" : ""}>${taBriefing.pending ? "Preparando…" : ready ? "Atualizar foco com IA" : "Conectar IA"}</button></div><div class="reference-briefing-body"><div class="reference-brief-row smc-week-row"><span class="reference-brief-icon">${terminalIcon("ana")}</span><div><h3>${regime}</h3><p>${esc(m.tip)}</p></div><div class="elite-momentum"><span>Semana <b class="${m.week.percent === null ? "" : cl(m.week.percent)}">${smcPercent(m.week.percent)}${m.week.estimated ? " *" : ""}</b></span><span>Mês <b class="${m.month.percent === null ? "" : cl(m.month.percent)}">${smcPercent(m.month.percent)}${m.month.estimated ? " *" : ""}</b></span></div></div><div class="reference-brief-row"><span class="reference-brief-icon">${terminalIcon("ins")}</span><div><h3>Foco de hoje</h3><p>${esc(focus)}</p></div><button class="smc-arrow-action" onclick="taGo('ins')" aria-label="Revisar execução">${terminalIcon("arrow")}</button></div><div class="reference-brief-row"><span class="reference-brief-icon focus">${terminalIcon("idea")}</span><div><h3>Dica do dia</h3><p>${esc(insight.action || "Antes da próxima entrada, confira seus critérios e registre a decisão no diário.")}</p></div><button class="smc-arrow-action" onclick="taGo('plan')" aria-label="Abrir meu plano">${terminalIcon("arrow")}</button></div></div>${m.month.percent === null ? '<button class="scene-link smc-percent-setup" onclick="taGo(\'dash\');diaryConfigureBalance()">Ativar percentuais ↗</button>' : ""}<details class="reference-method"><summary>Base do briefing</summary>${eliteMomentumView(m)}${valid ? taBriefing.result.facts.map((f) => `<p>${esc(f.text)}</p>`).join("") : `<p>${esc(insight.label)}. Observações apoiadas nos registros, sem inferir erros a partir de perdas.</p>`}${taBriefing.error ? `<p role="status">${esc(taBriefing.error)}</p>` : ""}</details></section><section class="scene-card reference-events"><div class="reference-card-heading">${terminalIcon("cal")}<h2>Próximos eventos</h2><button class="scene-link" onclick="taGo('economic')">Ver todos ${terminalIcon("arrow")}</button></div>${events.length ? events.map((e) => `<button class="reference-event" data-time="${esc(e.time)}" data-currency="${esc(e.currency)}" onclick="taOpenUpcomingEvent(this.dataset.time,this.dataset.currency)"><time>${esc(taDailyFormatTime(e.time))}</time><span class="reference-currency">${eliteNewsFlag(e.currency)} ${esc(e.currency)}</span><span>${SessionEngine.zonedParts(new Date(e.time), p.timezone).date !== taDailyDate() ? esc(taDailyFormatTime(e.time, { day: "2-digit", month: "2-digit" })) + " · " : ""}${esc(e.name)}</span><b class="impact-${["high", "medium", "low"].includes(e.impact) ? e.impact : "unknown"}">${{ high: "Alto", medium: "Médio", low: "Baixo" }[e.impact] || "—"}</b></button>`).join("") : "<p>Nenhum próximo evento publicado na cobertura disponível.</p><small>Consulte Notícias para verificar a fonte e o período coberto.</small>"}</section></div></div>${smcHomePerformance(m)}</section>`;
}
function smcHomePerformance(momentum) {
  const rows = insUniverse().filter(
      (t) => day(t) >= momentum.month.from && day(t) <= taDailyDate(),
    ),
    s = st(rows),
    moneyFormat = (n) => (hideDashboardMoney ? "••••" : money(n)),
    signedFormat = (n) =>
      (!hideDashboardMoney && n > 0 ? "+" : "") + moneyFormat(n),
    pnl = chartData(rows, "pnl"),
    dd = chartData(rows, "dd"),
    wins = [
      { label: "Ganhos", n: s.w, color: "var(--chart-positive)" },
      { label: "Perdas", n: s.l, color: "var(--r)" },
      { label: "Empates", n: s.n - s.w - s.l, color: "var(--mu)" },
    ],
    card = (label, value, color, note, visual = "") =>
      `<div class="k"><small>${label}</small><b class="${color}">${value}</b><small>${note}</small>${visual}</div>`;
  return `<section class="smc-home-performance" aria-label="Desempenho do mês"><div class="smc-performance-heading"><span>Seu desempenho no mês</span><button class="scene-link" onclick="taGo('dash')">Abrir painel completo ${terminalIcon("arrow")}</button></div><div class="smc-home-metrics elite-dash-metrics">${card("P&L líquido", s.n ? signedFormat(s.net) : "—", cl(s.net), "Resultado no mês", eliteDashSpark(s.cv, "var(--gold)"))}${card("Taxa de acerto", s.n ? s.wr.toFixed(1) + "%" : "—", "", "Ganhos / fechamentos", eliteDashDonut(wins, "", "", true))}${card("Profit factor", s.n && (s.w || s.l) ? (Number.isFinite(s.pf) ? s.pf.toFixed(2) : "∞") : "—", "", "Lucro bruto / perda bruta")}${card("Expectancy", s.n ? signedFormat(s.ex) : "—", cl(s.ex), "Por trade")}${card(
    "Drawdown máximo",
    s.n ? moneyFormat(-s.dd) : "—",
    s.dd ? "r" : "",
    "Queda desde o pico",
    eliteDashSpark(
      dd.map((p) => p.value),
      "var(--r)",
    ),
  )}${card("Total de operações", s.n, "", "Fechadas no mês")}</div><details class="smc-performance-charts" ${innerWidth > 760 ? "open" : ""}><summary>Ver gráficos do mês</summary><div class="smc-home-chart-grid"><section class="card terminal-performance"><div class="section-head"><h2>Evolução do resultado</h2><span class="badge">${esc(S.currency || "Moeda da conta")}</span></div>${terminalChart(pnl, { id: "smc-home-performance", height: 172, label: "P&L acumulado no mês", format: moneyFormat, netFormat: moneyFormat, color: "var(--gold)" })}</section><section class="card terminal-context"><div class="section-head"><h2>Drawdown</h2><span class="badge">No mês</span></div>${terminalChart(dd, { id: "smc-home-drawdown", height: 172, label: "Drawdown no mês", format: moneyFormat, netFormat: moneyFormat, color: "var(--r)" })}</section><section class="card"><div class="section-head"><h2>Resultado por ativo</h2><span class="badge">No mês</span></div>${eliteDashBars(
    grp(rows, (t) => t.symbol || "Não informado"),
    false,
    false,
    moneyFormat,
    signedFormat,
  )}</section></div></details></section>`;
}
// Rendering stays local; no extra model calls or changes to stored trading data.
matchMedia("(max-width:760px)").addEventListener("change", () => {
  if (["home", "dash"].includes(tab) && (!CLOUD_BOOT || eliteCloud.ready)) R();
});
