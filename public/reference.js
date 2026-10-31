/* Reference composition; real application actions and recorded facts only. */
let eliteContrast = false;
try {
  eliteContrast = localStorage.getItem("elitex-contrast") === "high";
} catch {}
function eliteToggleContrast() {
  eliteContrast = !eliteContrast;
  try {
    localStorage.setItem("elitex-contrast", eliteContrast ? "high" : "normal");
  } catch {}
  R();
}
function eliteUpdateProfile() {
  if (typeof eliteCloudAfterRender === "function")
    queueMicrotask(eliteCloudAfterRender);
  if (typeof eliteMobileAfterRender === "function") eliteMobileAfterRender();
  document.body.classList.toggle("elite-high-contrast", eliteContrast);
  let button = document.querySelector(".elite-profile");
  if (!button) {
    button = document.createElement("button");
    button.className = "elite-profile";
    button.onclick = () => taGo("settings");
    document.querySelector("header").append(button);
  }
  const tagline = document.querySelector(".elitex-brand-tagline");
  if (tagline)
    tagline.textContent = "Domine seu processo. Eleve sua performance.";
  const name = taProfile().name || "Meu perfil";
  button.innerHTML = `<span class="elite-profile-avatar">${esc(name[0].toUpperCase())}</span><span><b>${esc(name)}</b><small>Perfil e preferências</small></span><span>›</span>`;
  button.setAttribute("aria-label", "Abrir perfil e preferências");
}
function eliteClockText() {
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: taProfile().timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}
function eliteConnectionLabel() {
  if (typeof navigator !== "undefined" && !navigator.onLine)
    return "Sem conexão";
  if (
    typeof CLOUD_BOOT !== "undefined" &&
    CLOUD_BOOT &&
    typeof eliteCloud !== "undefined" &&
    eliteCloud.ready
  )
    return ["error", "conflict"].includes(eliteCloud.state)
      ? "Atenção"
      : "Conectado";
  if (taConnection.connecting) return "Conectando…";
  return taConnection.authenticated ? "Conectado" : "Desconectado";
}
function eliteAttentionModel() {
  const rows = insUniverse()
      .filter((t) => day(t) <= taDailyDate())
      .sort((a, b) => b.close.localeCompare(a.close))
      .slice(0, 25),
    alerts = [];
  const errors = rows.filter((t) => Array.isArray(t.behavior?.errors)),
    counts = insErrorCounts(errors);
  if (errors.length >= 5 && errors.length / Math.max(1, rows.length) >= 0.6) {
    for (const [id, title, action] of INS_ERRORS) {
      const count = counts[id] || 0;
      if (count >= 2)
        alerts.push({
          id: "error:" + id,
          title,
          text: `${title} foi registrado em ${count} de ${errors.length} operações com erros avaliados, entre os últimos ${rows.length} trades.`,
          action,
          key: JSON.stringify(
            errors.map((t) => [t.id, t.close, t.behavior.errors]),
          ),
          target: "ins",
        });
    }
  }
  const checked = insProcess(rows).checked,
    risk = checked.filter((x) => x.c.risk !== null || x.c.limits !== null),
    breaches = risk.filter((x) => x.c.risk === false || x.c.limits === false);
  if (
    risk.length >= 5 &&
    risk.length / Math.max(1, rows.length) >= 0.6 &&
    breaches.length >= 2
  )
    alerts.push({
      id: "risk",
      title: "Rever os limites do plano",
      text: `${breaches.length} de ${risk.length} operações avaliadas registram desvio de risco ou de limite operacional.`,
      action: "Confira seu risco e os limites antes da próxima entrada.",
      key: JSON.stringify(risk.map((x) => [x.t.id, x.c.risk, x.c.limits])),
      target: "risk",
    });
  const plan = checked.filter((x) => x.c.plan !== null),
    off = plan.filter((x) => x.c.plan === false);
  if (
    plan.length >= 5 &&
    plan.length / Math.max(1, rows.length) >= 0.6 &&
    off.length >= 2 &&
    !alerts.some((a) => a.id === "error:offplan")
  )
    alerts.push({
      id: "plan",
      title: "Atenção aos critérios de entrada",
      text: `${off.length} de ${plan.length} operações avaliadas foram registradas fora do plano.`,
      action: "Aguarde contexto claro e confira o checklist do seu sistema.",
      key: JSON.stringify(plan.map((x) => [x.t.id, x.c.plan])),
      target: "plan",
    });
  return alerts.map((a) => ({
    ...a,
    unread: S.attentionSeen?.[a.id] !== a.key,
  }));
}
function terminalTopbar() {
  const navExpanded =
    innerWidth <= 760
      ? document.body.classList.contains("elite-mobile-nav-open")
      : !terminalCollapsed;
  const unread = eliteAttentionModel().filter((a) => a.unread).length;
  const date = new Intl.DateTimeFormat("pt-PT", {
    timeZone: taProfile().timezone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());
  return `<div class="terminal-topbar reference-topbar"><button class="terminal-icon-button" onclick="terminalToggleNav()" aria-label="${navExpanded ? "Recolher" : "Expandir"} navegação" aria-expanded="${navExpanded}">${terminalIcon("menu")}</button><button class="reference-search" onclick="eliteOpenTradeSearch()" aria-label="Buscar trades realizados">${terminalIcon("search")}<span>Busque trades por data ou ativo…</span><kbd>Ctrl + K</kbd></button><div class="reference-top-actions"><button class="reference-icon reference-alert ${unread ? "has-alerts" : ""}" onclick="eliteOpenAlerts()" aria-label="Ver pontos de atenção" title="${unread ? unread + " novo(s) alerta(s)" : "Nenhum novo alerta"}">${terminalIcon("alert")}${unread ? `<span class="elite-alert-count" aria-hidden="true">${unread}</span><span class="sr-only" role="status">${unread} novos pontos de atenção nos registros.</span>` : ""}</button><div class="reference-clock"><span id="elite-live-date">${esc(date)}</span><b id="elite-live-clock" title="${esc(taProfile().timezone)}">${eliteClockText()}</b></div>${accountCurrencyControl()}<button class="reference-icon" onclick="eliteToggleContrast()" aria-label="Alternar contraste" aria-pressed="${eliteContrast}">${terminalIcon(eliteContrast ? "sun" : "moon")}</button><button class="reference-connection" onclick="taGo('settings')" aria-label="Ver conexão"><i class="${taConnection.authenticated ? "connected" : ""}"></i><span class="terminal-connection-label">${esc(eliteConnectionLabel())}</span></button></div></div>`;
}
setInterval(() => {
  const node = document.getElementById("elite-live-clock");
  if (node && document.visibilityState !== "hidden") {
    const text = eliteClockText();
    if (node.textContent !== text) node.textContent = text;
    const date = document.getElementById("elite-live-date");
    if (date) {
      const text = new Intl.DateTimeFormat("pt-PT", {
        timeZone: taProfile().timezone,
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date());
      if (date.textContent !== text) date.textContent = text;
    }
  }
}, 1000);
function eliteToolRows(query = "") {
  const normalized = (s) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase(),
    q = normalized(query);
  return (
    tabs
      .filter(([id, label]) =>
        normalized(
          label +
            " " +
            ({
              analyst: "analisar gráfico trade print sistema",
              ins: "padrões erros desempenho",
              economic: "notícias eventos",
              trades: "journal histórico",
            }[id] || ""),
        ).includes(q),
      )
      .map(
        ([id, label]) =>
          `<button class="elite-tool-result" onclick="document.getElementById('elite-tools-dialog').close();taGo('${id}')">${terminalIcon(id)}<span>${esc(label)}</span><span>${terminalIcon("open")}</span></button>`,
      )
      .join("") || "<p>Nenhuma ferramenta encontrada.</p>"
  );
}
function eliteOpenTools() {
  let d = document.getElementById("elite-tools-dialog");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "elite-tools-dialog";
    document.body.append(d);
  }
  d.innerHTML = `<div class="section-head"><h2>O que precisa fazer?</h2><button class="b s" onclick="document.getElementById('elite-tools-dialog').close()">Fechar</button></div><label>Buscar ferramentas<input id="elite-tools-query" placeholder="Analyst, calendário, diário…" oninput="document.getElementById('elite-tools-results').innerHTML=eliteToolRows(this.value)"></label><div id="elite-tools-results">${eliteToolRows()}</div><small>Acesse rapidamente as ferramentas do seu espaço.</small>`;
  d.showModal();
  d.querySelector("input").focus();
}
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    if (!document.querySelector("dialog[open]")) eliteOpenTradeSearch();
  }
});
function eliteOpenAlerts() {
  let d = document.getElementById("elite-alerts-dialog");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "elite-alerts-dialog";
    d.setAttribute("aria-label", "Pontos de atenção");
    document.body.append(d);
  }
  const alerts = eliteAttentionModel();
  d.innerHTML = `<div class="section-head"><h2>Pontos de atenção</h2><button class="b s" onclick="document.getElementById('elite-alerts-dialog').close()">Fechar</button></div>${alerts.length ? alerts.map((a) => `<article class="elite-attention-item"><span class="badge">${a.unread ? "Novo" : "Visto"}</span><h3>${esc(a.title)}</h3><p>${esc(a.text)}</p><p>${esc(a.action)}</p><button class="b s" data-target="${a.target}" onclick="document.getElementById('elite-alerts-dialog').close();taGo(this.dataset.target)">Revisar ${terminalIcon("arrow")}</button></article>`).join("") : '<p>Nenhum padrão de atenção identificado com os dados avaliados disponíveis.</p><p class="muted-note">Dados insuficientes não comprovam ausência de dificuldades. Registre a execução e confira seu plano.</p>'}<p class="muted-note">Leitura por regras dos últimos registros avaliados. Uma sequência de perdas, por si só, não indica indisciplina ou um problema emocional.</p>${alerts.some((a) => a.unread) ? '<button class="b s" onclick="eliteMarkAttentionSeen()">Marcar como lido</button>' : ""}<p id="elite-attention-message" role="status"></p>`;
  if (!d.open) d.showModal();
}
function eliteMarkAttentionSeen() {
  const old = S.attentionSeen;
  try {
    S.attentionSeen = {
      ...(old && typeof old === "object" ? old : {}),
      ...Object.fromEntries(eliteAttentionModel().map((a) => [a.id, a.key])),
    };
    persistState(S);
    R();
    eliteOpenAlerts();
  } catch (e) {
    S.attentionSeen = old;
    document.getElementById("elite-attention-message").textContent = e.message;
  }
}
function eliteReferenceHome() {
  const p = taProfile(),
    h = Number(taDailyParts().hour),
    m = eliteMomentumModel(),
    insight = taDailyInsight(taDailyWeekStats()),
    plan = taCurrentPlan(),
    valid = taBriefingHasResult(),
    ready = taConnection.authenticated && taConnection.services?.ai,
    events = taUpcomingEvents(2),
    instruments = taDailyRequestState("market").data?.instruments || [],
    assets = p.instruments.slice(0, 3),
    fmt = (n) =>
      n === null
        ? "—"
        : (n > 0 ? "+" : "") + n.toFixed(2).replace(".", ",") + "%",
    regime = m.week.n
      ? m.week.net > 0
        ? "Semana positiva"
        : m.week.net < 0
          ? "Semana em atenção"
          : "Semana equilibrada"
      : "Seu ritmo nesta semana";
  return `<section class="elite-scene reference-home" data-state="${eliteDesk.state}"><div class="scene-character-motion" aria-hidden="true"></div><div class="reference-left"><div class="scene-greeting"><h1>${h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"},<br><span>${esc(
    String(p.name || "trader")
      .trim()
      .split(/\s+/)[0],
  )}!</span></h1><p>Pronto para o seu dia de trading?<br>Seu processo, com mais clareza.</p></div><div class="reference-workspace-actions"><div class="elite-office scene-composer">${eliteConnectionGate()}<button class="reference-command" onclick="eliteOpenTools()">${terminalIcon("tools")}<span>Escolha uma ferramenta ou análise…</span><b>${terminalIcon("arrow")}</b></button></div><div class="scene-bottom-actions elite-function-actions">${[
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
    )}</div></div></div><div class="reference-right"><section class="scene-card reference-briefing scene-focus"><div class="reference-card-heading">${terminalIcon("rev")}<h2>Briefing do Dia</h2><button class="scene-link" onclick="${ready ? "taGenerateBriefing()" : "taGo('settings')"}" ${taBriefing.pending ? "disabled" : ""}>${taBriefing.pending ? "Preparando…" : ready ? "Atualizar foco com IA" : "Conectar IA"}</button></div><div class="reference-briefing-body"><div class="reference-brief-row"><span class="reference-brief-icon">${terminalIcon("dash")}</span><div><h3>${regime}</h3><div class="elite-momentum"><span>Semana <b class="${m.week.percent === null ? "" : cl(m.week.percent)}">${fmt(m.week.percent)}${m.week.estimated ? " *" : ""}</b></span><span>Mês <b class="${m.month.percent === null ? "" : cl(m.month.percent)}">${fmt(m.month.percent)}${m.month.estimated ? " *" : ""}</b></span></div><p>${esc(m.tip)}</p>${m.month.percent === null ? '<button class="scene-link" onclick="taGo(\'dash\');diaryConfigureBalance()">Ativar percentuais ↗</button>' : ""}</div></div><div class="reference-brief-row"><span class="reference-brief-icon focus">${terminalIcon("idea")}</span><div><h3>Foco de hoje</h3><p>${esc(valid ? taBriefing.result.action : insight.text)}</p><button class="scene-link" onclick="taGo('${plan ? "analyst" : "plan"}')">${plan ? "Validar próxima operação" : "Definir meu sistema"} ↗</button></div></div></div><details class="reference-method"><summary>Base do briefing</summary>${eliteMomentumView(m)}${valid ? taBriefing.result.facts.map((f) => `<p>${esc(f.text)}</p>`).join("") : `<p>${esc(insight.label)}. Sem inferir erros a partir de perdas ou prometer lucro.</p>`}${taBriefing.error ? `<p role="status">${esc(taBriefing.error)}</p>` : ""}</details></section><section class="scene-card reference-events"><div class="reference-card-heading">${terminalIcon("cal")}<h2>Próximos eventos</h2><button class="scene-link" onclick="taGo('economic')">Ver todos →</button></div>${events.length ? events.map((e) => `<button class="reference-event" data-time="${esc(e.time)}" data-currency="${esc(e.currency)}" onclick="taOpenUpcomingEvent(this.dataset.time,this.dataset.currency)"><time>${esc(taDailyFormatTime(e.time))}</time><span class="reference-currency">${eliteNewsFlag(e.currency)} ${esc(e.currency)}</span><span>${SessionEngine.zonedParts(new Date(e.time), taProfile().timezone).date !== taDailyDate() ? esc(taDailyFormatTime(e.time, { day: "2-digit", month: "2-digit" })) + " · " : ""}${esc(e.name)}</span><b class="impact-${["high", "medium", "low"].includes(e.impact) ? e.impact : "unknown"}">${{ high: "Alto", medium: "Médio", low: "Baixo" }[e.impact] || "—"}</b></button>`).join("") : "<p>Nenhum próximo evento publicado na cobertura disponível.</p><small>Consulte Notícias para verificar a fonte e o período coberto.</small>"}</section><section class="scene-card reference-assets"><div class="reference-card-heading">${terminalIcon("assets")}<h2>Seus ativos em foco</h2><button class="scene-link" onclick="taAssetOpen()">Editar →</button></div><div class="reference-asset-grid">${
    assets.length
      ? assets
          .map((symbol) => {
            const i = instruments.find(
                (i) =>
                  i.symbol.replace(/\//g, "") === symbol.replace(/\//g, ""),
              ),
              v = i?.volatility;
            return `<article><span class="reference-asset-icon">${eliteAssetIcon(symbol)}</span><b>${esc(symbol)}</b><span class="ta-volatility-${v || "unknown"}">${{ low: "Baixa", moderate: "Moderada", high: "Alta" }[v] || "Aguardando dados"}</span><small>${i?.atrPercent != null ? "ATR " + Number(i.atrPercent).toFixed(3) + "%" : "Volatilidade indisponível"}</small></article>`;
          })
          .join("")
      : '<button class="b s" onclick="taAssetOpen()">Escolher ativos</button>'
  }</div>${p.instruments.length > 3 ? `<button class="scene-link" onclick="taAssetOpen()">Ver ${p.instruments.length} ativos selecionados →</button>` : ""}</section></div></section>`;
}
function eliteAssetIcon(symbol) {
  const normalized = String(symbol)
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase(),
    currencies = [
      "USD",
      "EUR",
      "GBP",
      "JPY",
      "CHF",
      "CAD",
      "AUD",
      "NZD",
      "BRL",
      "CNY",
      "CNH",
      "HKD",
      "SGD",
      "ZAR",
      "MXN",
      "NOK",
      "SEK",
      "TRY",
      "PLN",
    ];
  if (normalized.startsWith("XAU"))
    return `<span class="asset-gold" title="Ouro">${terminalIcon("gold")}</span>`;
  if (normalized.startsWith("XAG"))
    return `<span class="asset-silver" title="Prata">${terminalIcon("gold")}</span>`;
  if (normalized.startsWith("BTC"))
    return `<span class="asset-crypto" title="Bitcoin">${terminalIcon("bitcoin")}</span>`;
  if (/^(BTC|ETH|SOL|XRP|ADA|DOGE)/.test(normalized))
    return `<span class="asset-crypto" title="Criptoativo">${terminalIcon("crypto")}</span>`;
  if (/^(WTI|BRENT|USOIL|UKOIL|XTI|XBR)/.test(normalized))
    return `<span class="asset-currency" title="Petróleo">${terminalIcon("oil")}</span>`;
  if (
    currencies.includes(normalized.slice(0, 3)) &&
    currencies.includes(normalized.slice(3, 6)) &&
    normalized.length === 6
  )
    return `<span class="asset-fx" title="Par de moedas">FX</span>`;
  if (currencies.includes(normalized))
    return `<span class="asset-currency" title="Moeda">${terminalIcon("coin")}</span>`;
  if (
    /^(SPX|SP500|US500|NAS|US100|NDX|DJI|US30|DAX|DE40|GER|UK100|FTSE|JP225|NIK|IBOV)/.test(
      normalized,
    )
  )
    return `<span class="asset-currency" title="Índice">${terminalIcon("index")}</span>`;
  return `<span class="asset-currency" title="Ativo">${terminalIcon("stock")}</span>`;
}
let eliteTradeSearchRows = [];
function eliteTradeSearchResults() {
  const date = document.getElementById("elite-trade-date").value,
    raw = document.getElementById("elite-trade-query").value.trim(),
    normalize = (s) =>
      String(s || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase(),
    terms = normalize(raw).split(/\s+/).filter(Boolean);
  eliteTradeSearchRows = S.trades
    .filter((t) => {
      if (!t.close || (date && t.close.slice(0, 10) !== date)) return false;
      const iso = t.close.slice(0, 10),
        parts = iso.split("-"),
        text = normalize(
          [
            t.symbol,
            t.strategy,
            t.notes,
            t.side,
            iso,
            parts.reverse().join("/"),
          ].join(" "),
        );
      return terms.every((term) => text.includes(term));
    })
    .sort((a, b) => String(b.close).localeCompare(String(a.close)));
  const shown = eliteTradeSearchRows.slice(0, 50);
  document.getElementById("elite-trade-results").innerHTML =
    `<p role="status">${eliteTradeSearchRows.length} trade(s) encontrado(s)${eliteTradeSearchRows.length > 50 ? " · mostrando os 50 mais recentes; refine a busca" : ""}.</p>` +
    shown
      .map(
        (t, i) =>
          `<button class="elite-trade-result" onclick="eliteOpenSearchTrade(${i})"><span>${eliteAssetIcon(t.symbol || "")}</span><span><b>${esc(t.symbol || "Sem ativo")}</b><small>${esc(t.close.replace("T", " "))}${t.strategy ? " · " + esc(t.strategy) : ""}</small></span><span class="${rNumber(t.pnl) === null ? "mu" : cl(Number(t.pnl))}">${hideDashboardMoney ? "••••" : rNumber(t.pnl) === null ? "—" : money(Number(t.pnl))}</span><span>${terminalIcon("open")}</span></button>`,
      )
      .join("");
}
function eliteOpenSearchTrade(index) {
  const t = eliteTradeSearchRows[index];
  if (!t) return;
  document.getElementById("elite-trade-search-dialog").close();
  edit(t.id);
}
function eliteOpenTradeSearch() {
  let d = document.getElementById("elite-trade-search-dialog");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "elite-trade-search-dialog";
    document.body.append(d);
  }
  d.innerHTML = `<div class="section-head"><h2>Buscar trades realizados</h2><button class="b s" onclick="document.getElementById('elite-trade-search-dialog').close()">Fechar</button></div><p>Consulte todo o histórico registrado, sem alterar os filtros do painel.</p><div class="elite-trade-search-fields"><label>Ativo, data ou estratégia<input id="elite-trade-query" placeholder="EURUSD, 28/10/2026…" oninput="eliteTradeSearchResults()"></label><label>Dia do fechamento<input id="elite-trade-date" type="date" onchange="eliteTradeSearchResults()"></label></div><div id="elite-trade-results"></div>`;
  eliteTradeSearchResults();
  d.showModal();
  d.querySelector("input").focus();
}

// Compact performance analysis: one comparison at a time, with details on demand.
let eliteAnalysisDimension = "asset";
const eliteAnalysisDimensions = [
  ["asset", "Ativo", "assets"],
  ["weekday", "Dia da semana", "cal"],
  ["session", "Sessão", "clock"],
  ["hour", "Horário", "clock"],
  ["strategy", "Estratégia", "str"],
  ["setup", "Setup", "analyst"],
];
function eliteAnalysisGroups(ts) {
  const entry = (t) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t.open || ""),
    key =
      {
        asset: (t) => t.symbol || "Não informado",
        weekday: (t) => (entry(t) ? WD[dow(t)] : "Entrada não informada"),
        session: (t) => (entry(t) ? sess(t) : "Entrada não informada"),
        hour: (t) => (entry(t) ? hh(t) + ":00" : "Entrada não informada"),
        strategy: (t) => t.strategy || "Não informada",
        setup: (t) => t.setup || "Não informado",
      }[eliteAnalysisDimension] || ((t) => t.symbol || "Não informado");
  return Object.entries(grp(ts, key))
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.net - a.net || a.name.localeCompare(b.name));
}
function eliteAnalysisRows(rows) {
  return `<div class="table-wrap"><table class="elite-analysis-table"><thead><tr><th>Grupo</th><th>Trades</th><th>Resultado</th><th>Acerto</th></tr></thead><tbody>${rows.map((g) => `<tr><td>${esc(g.name)}</td><td>${g.n}${g.n < 10 ? '<sup title="Amostra pequena">*</sup>' : ""}</td><td class="${cl(g.net)}">${signed(g.net)}</td><td>${g.wr.toFixed(1)}%</td></tr>`).join("")}</tbody></table></div>`;
}
function eliteAnalysisView(input) {
  const ts = input.filter((t) => t.close && rNumber(t.pnl) !== null);
  if (!ts.length)
    return `<section class="card"><h2>Sem operações neste período</h2><p>Altere os filtros ou registre suas operações no diário para comparar os resultados.</p><button class="b" onclick="taGo('trades')">Abrir diário</button></section>`;
  const s = st(ts),
    rows = eliteAnalysisGroups(ts),
    best = rows[0],
    worst = rows.at(-1),
    label = eliteAnalysisDimensions.find(
      ([id]) => id === eliteAnalysisDimension,
    )[1],
    observation = (g, title) =>
      `<div class="elite-analysis-observation"><small>${title}</small><h3>${esc(g.name)}</h3><b class="${cl(g.net)}">${signed(g.net)}</b><p>${g.n} trade(s) · ${g.wr.toFixed(1)}% de acerto</p>${g.n < 10 ? "<small>Amostra pequena: não conclua um padrão.</small>" : "<small>Resultado histórico, sem previsão de retorno.</small>"}</div>`;
  return `<section class="elite-analysis-page"><div class="elite-analysis-summary" aria-label="Resumo do período">${[
    ["Resultado líquido", signed(s.net), cl(s.net)],
    ["Trades fechados", String(s.n), ""],
    ["Taxa de acerto", s.wr.toFixed(1) + "%", ""],
    ["Profit factor", Number.isFinite(s.pf) ? s.pf.toFixed(2) : "∞", ""],
  ]
    .map(
      ([title, value, color]) =>
        `<div><small>${title}</small><b class="${color}">${value}</b></div>`,
    )
    .join(
      "",
    )}</div><div class="elite-analysis-grid"><div class="elite-analysis-main"><section class="card elite-analysis-comparison"><div class="section-head"><div><div class="eyebrow">Onde estão os resultados</div><h2>Comparar por ${label.toLowerCase()}</h2></div><span class="badge">${rows.length} grupo(s)</span></div><div class="elite-analysis-switch" aria-label="Comparar resultados por">${eliteAnalysisDimensions.map(([id, title, icon]) => `<button class="b s" aria-pressed="${id === eliteAnalysisDimension}" onclick="eliteAnalysisDimension='${id}';R()">${terminalIcon(icon)}${title}</button>`).join("")}</div>${eliteAnalysisRows(rows.slice(0, 6))}${rows.length > 6 ? `<details class="elite-analysis-more"><summary>Ver os outros ${rows.length - 6} grupos</summary>${eliteAnalysisRows(rows.slice(6))}</details>` : ""}<small class="muted-note">Ordenado pelo resultado líquido. * Menos de 10 trades: amostra pequena.</small></section>${eliteAnalysisSummary(ts)}</div><aside class="card elite-analysis-highlights"><div class="section-head"><h2>Leitura rápida</h2>${terminalIcon("ana")}</div>${observation(best, "Maior resultado do período")}${rows.length > 1 ? observation(worst, "Menor resultado do período") : "<p>Há apenas um grupo para comparar.</p>"}<button class="b s" onclick="taGo('ins')">Revisar minha execução ${terminalIcon("arrow")}</button></aside></div><details class="card elite-analysis-method"><summary>Como interpretar estes dados</summary><p>Esta análise usa os trades fechados nos filtros acima. Resultado líquido é a soma do P&L registrado${ts.some((t) => t.est) ? "; há valores estimados no período" : ""}. Acerto é a proporção de trades com P&L positivo, incluindo os empates no total. Profit factor divide lucro bruto por perda bruta.</p><p>Dias, horários e sessões usam somente a entrada registrada, no fuso do arquivo. Se ela não foi informada, o grupo aparece como “Entrada não informada”. Os grupos de sessão são faixas horárias fixas, sem ajuste de horário de verão. Grupos pequenos não comprovam padrões nem justificam mudar seu risco.</p><p>Para investigar erros e cumprimento do sistema, use o Raio-X do Trader.</p></details></section>`;
}

let eliteAnalysisCoach = { pending: false, key: null, result: null, error: "" };
function eliteAnalysisCoachModel(rows) {
  const s = st(rows),
    plan = taCurrentPlan(),
    process = insProcess(rows),
    reviewed = insErrorRows(rows).length,
    errors = Object.entries(insErrorCounts(rows)).sort((a, b) => b[1] - a[1]),
    error = errors.length
      ? INS_ERRORS.find((e) => e[0] === errors[0][0])
      : null,
    assets = Object.entries(grp(rows, (t) => t.symbol || "Não informado"))
      .map(([name, g]) => ({ name, ...g }))
      .sort((a, b) => b.net - a.net),
    best = assets[0],
    worst = assets.at(-1),
    chronological = [...rows].sort((a, b) =>
      String(b.close).localeCompare(String(a.close)),
    ),
    streak = chronological.findIndex((t) => t.pnl >= 0),
    losses = streak < 0 ? chronological.length : streak,
    describe = (g) =>
      `${g.name}: ${g.net.toFixed(2)} ${S.currency || "(moeda não definida)"}, ${g.n} trade(s). ${g.n < 10 ? "Amostra pequena; não conclua um padrão." : "Comparação descritiva, sem previsão de retorno."}`,
    positive =
      best?.net > 0
        ? `Maior contribuição por ativo: ${describe(best)}`
        : "Nenhum ativo teve resultado positivo neste recorte. Isso não comprova falha no seu sistema.",
    attention = error
      ? `${error[1]} foi explicitamente registrado em ${errors[0][1]} de ${reviewed} operações com erros revisados.`
      : worst?.net < 0
        ? `Maior perda por ativo: ${describe(worst)} Uma perda isolada não comprova erro de execução.`
        : "O resultado não comprova disciplina. Confira as avaliações de execução no diário.",
    action = error
      ? error[2]
      : losses >= 2
        ? `Há ${losses} perdas consecutivas nos últimos fechamentos deste recorte. Antes da próxima entrada, confira os critérios do plano e seus limites; não aumente o risco para recuperar. Essa sequência não comprova overtrading.`
        : plan
          ? "Antes do próximo trade, use o SMC Elite Analyst para conferir as evidências de entrada contra seu plano. Registre o motivo da entrada e revise a saída no diário."
          : "Defina um Trading Plan com critérios de entrada, saída e limites de risco para comparar intenção e execução nas próximas operações.",
    facts = [
      {
        id: "scope",
        text: `Resumo do período filtrado: ${rows.length} fechamentos entre ${chronological.at(-1)?.close || "—"} e ${chronological[0]?.close || "—"}. Filtros: ${JSON.stringify(F)}. ${rows.some((t) => t.est) ? "Contém P&L estimado." : "P&L conforme os registros."}`,
      },
      {
        id: "performance",
        text: `P&L ${s.net.toFixed(2)} ${S.currency || "(moeda não definida)"}; ${s.w} ganhos, ${s.l} perdas e ${s.n - s.w - s.l} empates. Taxa de acerto ${s.wr.toFixed(1)}%. Profit factor ${Number.isFinite(s.pf) ? s.pf.toFixed(2) : "sem perdas registradas"}. Lucro não comprova aderência ao plano.`,
      },
      { id: "positive", text: positive },
      { id: "attention", text: attention },
      { id: "action", text: action },
      {
        id: "coverage",
        text: `Plano avaliável em ${process.plan.n}/${rows.length} trades; erros revisados em ${reviewed}/${rows.length}. Ausência de revisão não equivale à ausência de erros. ${process.plan.value === null ? "Cobertura insuficiente para percentual do plano." : `Aderência ao plano ${process.plan.value.toFixed(1)}% entre os avaliados.`}`,
      },
    ];
  if (plan)
    facts.push({
      id: "system",
      text: `Sistema atual ${plan.name}, versão ${plan.version}. Critério para próximas entradas: ${(plan.criteria.find((c) => c.required) || plan.criteria[0])?.definition || "Não informado"}. Não aplicar regras atuais retroativamente.`.slice(
        0,
        1000,
      ),
    });
  const input = {
    plan,
    profile: { timezone: taProfile().timezone, session: taProfile().session },
    facts,
    question:
      "Resuma o foco deste trader com tom acolhedor, bondoso, sereno e respeitoso. Reconheça o que os fatos sustentam e indique um próximo passo claro. Não presuma emoções ou disciplina, não minimize perdas, não prometa resultados. Use somente os fatos e o plano fornecidos.",
  };
  return { positive, attention, action, input, key: JSON.stringify(input) };
}
function eliteAnalysisSummary(rows) {
  const m = eliteAnalysisCoachModel(rows),
    valid = eliteAnalysisCoach.key === m.key && eliteAnalysisCoach.result,
    ready = taConnection.authenticated && taConnection.services?.ai;
  return `<section class="card elite-analysis-coach" aria-labelledby="elite-analysis-summary-title"><div class="section-head"><div><div class="eyebrow">Seu assistente SMC Elite</div><h2 id="elite-analysis-summary-title">Resumo</h2></div>${ready ? `<button class="b s" onclick="eliteGenerateAnalysisSummary()" ${eliteAnalysisCoach.pending ? "disabled" : ""}>${eliteAnalysisCoach.pending ? "Preparando…" : "Atualizar resumo"}</button>` : '<button class="b s" onclick="taGo(\'settings\')">Conectar IA</button>'}</div><p class="elite-coach-welcome">Vamos olhar para este período com calma. Seu resultado ajuda a entender o caminho; o próximo passo é cuidar da qualidade das suas decisões.</p>${valid ? `<div class="elite-analysis-ai" role="status"><p>${esc(eliteAnalysisCoach.result.action)}</p></div>` : `<p class="muted-note" role="status">${eliteAnalysisCoach.pending ? "A IA está preparando uma orientação a partir dos seus registros…" : ready ? "O resumo com IA será preparado automaticamente para este período." : "Conecte a IA para receber sua síntese personalizada. A leitura dos registros continua disponível abaixo."}</p>`}<div class="elite-analysis-coach-grid">${[
    ["dash", "O que está funcionando", m.positive],
    ["alert", "O que merece atenção", m.attention],
    ["idea", "Seu próximo foco", m.action],
  ]
    .map(
      ([icon, title, text]) =>
        `<section><h3>${terminalIcon(icon)}${title}</h3><p>${esc(text)}</p></section>`,
    )
    .join(
      "",
    )}</div>${eliteAnalysisCoach.key === m.key && eliteAnalysisCoach.error ? `<p class="r" role="status">${esc(eliteAnalysisCoach.error)}</p>` : ""}<details class="elite-coach-source"><summary>Base deste resumo e privacidade</summary><p>Leitura local calculada sobre os filtros selecionados. A IA recebe apenas o plano e fatos agregados; não recebe prints nem os textos completos do diário.</p>${valid ? eliteAnalysisCoach.result.facts.map((f) => `<p>${esc(f.text)}</p>`).join("") : ""}</details></section>`;
}
async function eliteGenerateAnalysisSummary() {
  if (eliteAnalysisCoach.pending) return;
  const rows = ft().filter((t) => t.close && rNumber(t.pnl) !== null);
  if (!rows.length) return;
  const m = eliteAnalysisCoachModel(rows);
  eliteAnalysisAutoAttempted.add(m.key);
  eliteAnalysisCoach = { pending: true, key: m.key, result: null, error: "" };
  R();
  try {
    const result = await taApi("/api/briefing", {
        method: "POST",
        body: JSON.stringify(m.input),
      }),
      byId = new Map(m.input.facts.map((f) => [f.id, f]));
    if (
      !Array.isArray(result.facts) ||
      !result.facts.length ||
      typeof result.action !== "string" ||
      result.facts.some((f) => !byId.has(f.id))
    )
      throw Error("O resumo retornado não corresponde aos fatos enviados.");
    if (
      m.key ===
      eliteAnalysisCoachModel(
        ft().filter((t) => t.close && rNumber(t.pnl) !== null),
      ).key
    )
      eliteAnalysisCoach.result = {
        ...result,
        facts: result.facts.map((f) => byId.get(f.id)),
      };
    if (eliteAnalysisCoach.result)
      eliteAnalysisCache.set(m.key, eliteAnalysisCoach.result);
    if (eliteAnalysisCache.size > 8)
      eliteAnalysisCache.delete(eliteAnalysisCache.keys().next().value);
  } catch (e) {
    eliteAnalysisCoach.error =
      e.message + " O resumo local continua disponível.";
  } finally {
    eliteAnalysisCoach.pending = false;
    if (tab === "ana") R();
  }
}

// Debounce automatic summaries, reuse this session's results and never retry errors in a loop.
let eliteAnalysisAutoTimer;
const eliteAnalysisAutoAttempted = new Set(),
  eliteAnalysisCache = new Map();
function eliteEnsureAnalysisSummary() {
  clearTimeout(eliteAnalysisAutoTimer);
  if (
    tab !== "ana" ||
    eliteAnalysisCoach.pending ||
    !taConnection.authenticated ||
    !taConnection.services?.ai
  )
    return;
  const rows = ft().filter((t) => t.close && rNumber(t.pnl) !== null);
  if (!rows.length) return;
  const key = eliteAnalysisCoachModel(rows).key;
  if (eliteAnalysisCache.has(key)) {
    if (eliteAnalysisCoach.key !== key || !eliteAnalysisCoach.result) {
      eliteAnalysisCoach = {
        pending: false,
        key,
        result: eliteAnalysisCache.get(key),
        error: "",
      };
      eliteAnalysisAutoTimer = setTimeout(() => {
        if (tab === "ana") R();
      }, 0);
    }
    return;
  }
  if (eliteAnalysisAutoAttempted.has(key)) return;
  eliteAnalysisAutoTimer = setTimeout(() => {
    if (
      tab === "ana" &&
      taConnection.authenticated &&
      taConnection.services?.ai &&
      !eliteAnalysisCoach.pending
    )
      eliteGenerateAnalysisSummary();
  }, 800);
}

// Inline vectors render country flags consistently on Windows, Android and iOS.
function eliteNewsFlag(currency) {
  const code = String(currency || "").toUpperCase(),
    rect = (x, y, w, h, color) =>
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"/>`,
    star = (x, y, size, color) =>
      `<path d="M0-1 .224-.309 .951-.309 .363.118 .588.809 0 .382-.588.809-.363.118-.951-.309-.224-.309Z" transform="translate(${x} ${y}) scale(${size})" fill="${color}"/>`,
    union =
      rect(0, 0, 30, 20, "#012169") +
      '<path d="m0 0 30 20m0-20L0 20" stroke="white" stroke-width="4"/><path d="m0 0 30 20m0-20L0 20" stroke="#c8102e" stroke-width="1.5"/><path d="M15 0v20M0 10h30" stroke="white" stroke-width="7"/><path d="M15 0v20M0 10h30" stroke="#c8102e" stroke-width="4"/>',
    stripes = (colors) =>
      colors
        .map((c, i) =>
          rect(0, (i * 20) / colors.length, 30, 20 / colors.length + 0.1, c),
        )
        .join(""),
    designs = {
      USD: [
        "Estados Unidos",
        stripes(
          Array.from({ length: 13 }, (_, i) => (i % 2 ? "white" : "#b22234")),
        ) +
          rect(0, 0, 13, 10.8, "#3c3b6e") +
          Array.from({ length: 9 }, (_, row) =>
            Array.from({ length: row % 2 ? 5 : 6 }, (_, col) =>
              star(
                1.1 + col * 2.16 + (row % 2 ? 1.08 : 0),
                0.8 + row * 1.14,
                0.65,
                "white",
              ),
            ).join(""),
          ).join(""),
      ],
      CAD: [
        "Canadá",
        rect(0, 0, 30, 20, "white") +
          rect(0, 0, 7.5, 20, "#d80621") +
          rect(22.5, 0, 7.5, 20, "#d80621") +
          '<path fill="#d80621" d="m15 3-1.4 3-.9-.6.3 3.5-2.5-1.7-.4 1.2-2-.4.8 2.6-.7.4 4.1 3.3-.5 1.5 2.7-.4-.2 3h1l-.2-3 2.7.4-.5-1.5 4.1-3.3-.7-.4.8-2.6-2 .4-.4-1.2-2.5 1.7.3-3.5-.9.6z"/>',
      ],
      EUR: [
        "União Europeia",
        rect(0, 0, 30, 20, "#003399") +
          Array.from({ length: 12 }, (_, i) =>
            star(
              15 + 6 * Math.sin((i * Math.PI) / 6),
              10 - 6 * Math.cos((i * Math.PI) / 6),
              1,
              "#ffcc00",
            ),
          ).join(""),
      ],
      GBP: ["Reino Unido", union],
      JPY: [
        "Japão",
        rect(0, 0, 30, 20, "white") +
          '<circle cx="15" cy="10" r="5.5" fill="#bc002d"/>',
      ],
      CHF: [
        "Suíça",
        rect(0, 0, 30, 20, "#d52b1e") +
          rect(12, 3, 6, 14, "white") +
          rect(8, 7, 14, 6, "white"),
      ],
      AUD: [
        "Austrália",
        rect(0, 0, 30, 20, "#012169") +
          `<g transform="scale(.5)">${union}</g>` +
          star(7.5, 15, 2, "white") +
          [
            [23, 4],
            [20, 10],
            [26, 9],
            [23, 16],
          ]
            .map(([x, y]) => star(x, y, 1.5, "white"))
            .join("") +
          star(25, 12, 1, "white"),
      ],
      NZD: [
        "Nova Zelândia",
        rect(0, 0, 30, 20, "#012169") +
          `<g transform="scale(.5)">${union}</g>` +
          [
            [23, 4],
            [20, 10],
            [26, 9],
            [23, 16],
          ]
            .map(
              ([x, y]) => star(x, y, 1.9, "white") + star(x, y, 1.3, "#cc142b"),
            )
            .join(""),
      ],
      BRL: [
        "Brasil",
        rect(0, 0, 30, 20, "#009739") +
          '<path d="m15 2 13 8-13 8L2 10z" fill="#ffdf00"/><circle cx="15" cy="10" r="5" fill="#002776"/><path d="M10.2 8.5q5-.4 9.5 3" stroke="white" fill="none" stroke-width="1"/>',
      ],
      CNY: [
        "China",
        rect(0, 0, 30, 20, "#de2910") +
          star(6, 6, 3, "#ffde00") +
          [
            [11, 3],
            [13, 6],
            [13, 9],
            [10, 11],
          ]
            .map(([x, y]) => star(x, y, 1, "#ffde00"))
            .join(""),
      ],
      SGD: [
        "Singapura",
        stripes(["#ef3340", "white"]) +
          '<circle cx="6" cy="5" r="3.4" fill="white"/><circle cx="7.3" cy="4.6" r="2.9" fill="#ef3340"/>' +
          [
            [11, 2.5],
            [13, 4],
            [12.3, 6.5],
            [9.7, 6.5],
            [9, 4],
          ]
            .map(([x, y]) => star(x, y, 0.7, "white"))
            .join(""),
      ],
      SEK: [
        "Suécia",
        rect(0, 0, 30, 20, "#006aa7") +
          rect(9, 0, 4, 20, "#fecc00") +
          rect(0, 8, 30, 4, "#fecc00"),
      ],
      NOK: [
        "Noruega",
        rect(0, 0, 30, 20, "#ba0c2f") +
          rect(8, 0, 6, 20, "white") +
          rect(0, 7, 30, 6, "white") +
          rect(9.5, 0, 3, 20, "#00205b") +
          rect(0, 8.5, 30, 3, "#00205b"),
      ],
      PLN: ["Polônia", stripes(["white", "#dc143c"])],
      TRY: [
        "Turquia",
        rect(0, 0, 30, 20, "#e30a17") +
          '<circle cx="12" cy="10" r="5" fill="white"/><circle cx="13.4" cy="10" r="4" fill="#e30a17"/>' +
          star(19, 10, 2.5, "white"),
      ],
      INR: [
        "Índia",
        stripes(["#ff9933", "white", "#138808"]) +
          '<circle cx="15" cy="10" r="2.7" fill="none" stroke="#000080" stroke-width=".6"/>' +
          Array.from(
            { length: 24 },
            (_, i) =>
              `<path d="M15 10v-2.7" transform="rotate(${i * 15} 15 10)" stroke="#000080" stroke-width=".18"/>`,
          ).join(""),
      ],
    };
  designs.HKD = [
    "Hong Kong",
    rect(0, 0, 30, 20, "#de2910") +
      Array.from(
        { length: 5 },
        (_, i) =>
          `<path d="M15 10c-7-7 1-11 1-5-3-1-2 3-1 5" fill="white" transform="rotate(${i * 72} 15 10)"/>`,
      ).join(""),
  ];
  designs.MXN = [
    "México",
    rect(0, 0, 10, 20, "#006847") +
      rect(10, 0, 10, 20, "white") +
      rect(20, 0, 10, 20, "#ce1126") +
      '<path d="M12 11q0 6 6 0" fill="none" stroke="#006847" stroke-width=".8"/><path d="m12 8 4-2 2 2-3 1 2 3-3-1-2 1 1-3z" fill="#88613b"/>',
  ];
  designs.ZAR = [
    "África do Sul",
    stripes(["#de3831", "#002395"]) +
      '<path d="M0 0 13 8h17v4H13L0 20z" fill="white"/><path d="m0 2 12 8L0 18" fill="black" stroke="#ffb612" stroke-width="2"/><path d="m0 0 13 8h17v4H13L0 20v-4l9-6L0 4z" fill="#007a4d"/>',
  ];
  if (code === "CNH") return eliteNewsFlag("CNY");
  const flag = designs[code];
  return flag
    ? `<svg class="elite-news-flag" viewBox="0 0 30 20" width="20" height="14" role="img" aria-label="${flag[0]}" style="width:20px;height:14px;border-radius:2px;vertical-align:middle"><title>${flag[0]}</title>${flag[1]}</svg>`
    : terminalIcon("coin");
}
