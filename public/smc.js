/* SMC Elite identity and reference composition. Existing account/storage keys remain stable. */
function eliteReferenceHome() {
  return smcHomeView();
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
    session = taDailySession(),
    insight = taDailyInsight(taDailyWeekStats()),
    valid = taBriefingHasResult(),
    ready = taConnection.authenticated && taConnection.services?.ai,
    events = taUpcomingEvents(innerWidth <= 760 ? 2 : 3),
    name = String(p.name || "trader")
      .trim()
      .split(/\s+/)[0],
    sessionTitle = session.configured
      ? session.label || p.session.label
      : "Prepare sua sessão",
    sessionText = session.configured
      ? `${p.session.start}–${p.session.end} · ${p.session.timezone}. ${taDailySessionCountdown(session)}.`
      : "Defina seu horário e seu fuso para preparar o dia com clareza.",
    tip =
      insight.label === "Preparação inicial"
        ? "Antes de executar, confira o contexto, os critérios de entrada e o risco previsto no seu plano."
        : insight.label === "Registro observado"
          ? "Aguarde um setup claro. Não há obrigação de operar; respeite os limites e os horários do seu plano."
          : insight.action,
    focus = valid
      ? taBriefing.result.action
      : insight.label === "Registro observado"
        ? insight.action
        : insight.text;
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
    )}</div></div></section><div class="reference-right"><section class="scene-card reference-briefing scene-focus"><div class="reference-card-heading">${terminalIcon("cal")}<h2>Briefing do Dia</h2><button class="scene-link" onclick="${ready ? "taGenerateBriefing()" : "taGo('settings')"}" ${taBriefing.pending ? "disabled" : ""}>${taBriefing.pending ? "Preparando…" : ready ? "Atualizar foco com IA" : "Conectar IA"}</button></div><div class="reference-briefing-body"><div class="reference-brief-row smc-session-row"><span class="reference-brief-icon">${terminalIcon("clock")}</span><div><h3>${esc(sessionTitle)}</h3><p>${esc(sessionText)}</p></div><button class="smc-arrow-action" onclick="taGo('settings')" aria-label="Ajustar minha sessão">${terminalIcon("arrow")}</button></div><div class="reference-brief-row"><span class="reference-brief-icon">${terminalIcon("ins")}</span><div><h3>Foco de hoje</h3><p>${esc(focus)}</p></div><button class="smc-arrow-action" onclick="taGo('ins')" aria-label="Revisar execução">${terminalIcon("arrow")}</button></div><div class="reference-brief-row"><span class="reference-brief-icon focus">${terminalIcon("idea")}</span><div><h3>Dica do dia</h3><p>${esc(tip || "Antes da próxima entrada, confira seus critérios e registre a decisão no diário.")}</p></div><button class="smc-arrow-action" onclick="taGo('plan')" aria-label="Abrir meu plano">${terminalIcon("arrow")}</button></div></div><details class="reference-method"><summary>Base do briefing</summary><p>${valid ? "Orientação da integração de IA, apoiada no plano e nos registros disponíveis." : esc(insight.label) + ". Prepare sua execução com os critérios do seu plano."}</p>${taBriefing.error ? `<p role="status">${esc(taBriefing.error)}</p>` : ""}</details></section><section class="scene-card reference-events"><div class="reference-card-heading">${terminalIcon("cal")}<h2>Próximos eventos</h2><button class="scene-link" onclick="taGo('economic')">Ver todos ${terminalIcon("arrow")}</button></div>${events.length ? events.map((e) => `<button class="reference-event" data-time="${esc(e.time)}" data-currency="${esc(e.currency)}" onclick="taOpenUpcomingEvent(this.dataset.time,this.dataset.currency)"><time>${esc(taDailyFormatTime(e.time))}</time><span class="reference-currency">${eliteNewsFlag(e.currency)} ${esc(e.currency)}</span><span>${SessionEngine.zonedParts(new Date(e.time), p.timezone).date !== taDailyDate() ? esc(taDailyFormatTime(e.time, { day: "2-digit", month: "2-digit" })) + " · " : ""}${esc(e.name)}</span><b class="impact-${["high", "medium", "low"].includes(e.impact) ? e.impact : "unknown"}">${{ high: "Alto", medium: "Médio", low: "Baixo" }[e.impact] || "—"}</b></button>`).join("") : "<p>Nenhum próximo evento publicado na cobertura disponível.</p><small>Consulte Notícias para verificar a fonte e o período coberto.</small>"}</section></div></div></section>`;
}
// Rendering stays local; no extra model calls or changes to stored trading data.
matchMedia("(max-width:760px)").addEventListener("change", () => {
  if (["home", "dash"].includes(tab) && (!CLOUD_BOOT || eliteCloud.ready)) R();
});

// Disclosure state belongs to the view; opening or closing never changes filters.
const smcFilterDisclosure = new Map();
function smcRememberFilters(node) {
  if (node.isConnected) smcFilterDisclosure.set(node.dataset.view, node.open);
}
function filt() {
  const names = {
      all: "Todo o histórico",
      week: "Esta semana",
      month: "Este mês",
      lastmonth: "Mês passado",
      30: "Últimos 30 dias",
      90: "Últimos 90 dias",
      year: "Este ano",
      custom: "Período personalizado",
    },
    date = (value) => (value ? value.split("-").reverse().join("/") : ""),
    range =
      rangePreset === "custom"
        ? [date(F.from) || "Início", date(F.to) || "Hoje"].join(" – ")
        : names[rangePreset] || "Todo o histórico",
    active = [
      range,
      F.sym,
      F.strat,
      tab === "dash" ? eliteDashSession : "",
      tab === "dash" && eliteDashUnit === "r" ? "R realizado" : "",
    ].filter(Boolean),
    changed = !!(
      F.from ||
      F.to ||
      F.sym ||
      F.strat ||
      (tab === "dash" && eliteDashSession)
    );
  return `<details class="smc-filters-disclosure" data-view="${esc(tab)}" ${smcFilterDisclosure.get(tab) ? "open" : ""} ontoggle="smcRememberFilters(this)"><summary><span class="smc-filter-label">${terminalIcon("filter")}<b>Filtros</b>${changed ? '<i aria-label="Filtros ativos"></i>' : ""}</span><span class="smc-filter-summary">${active.map(esc).join(" · ")}</span><span class="smc-filter-chevron" aria-hidden="true">⌄</span></summary><div class="smc-filter-fields">${filterFields()}${tab === "dash" ? smcDashboardFilterControls(ft()) : ""}</div></details>`;
}
