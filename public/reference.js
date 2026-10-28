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
function terminalTopbar() {
  const date = new Intl.DateTimeFormat("pt-PT", {
    timeZone: taProfile().timezone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());
  return `<div class="terminal-topbar reference-topbar"><button class="terminal-icon-button" onclick="terminalToggleNav()" aria-label="${terminalCollapsed ? "Expandir" : "Recolher"} navegação" aria-expanded="${!terminalCollapsed}">☰</button><button class="reference-search" onclick="eliteOpenTools()" aria-label="Buscar ferramentas">${terminalIcon("analyst")}<span>Busque uma ferramenta ou análise…</span><kbd>Ctrl + K</kbd></button><div class="reference-top-actions"><button class="reference-icon" onclick="eliteOpenAlerts()" aria-label="Ver pontos de atenção"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 16h14l-2-3V9a5 5 0 0 0-10 0v4z M10 20h4"/></svg></button><div class="reference-clock"><span id="elite-live-date">${esc(date)}</span><b id="elite-live-clock" title="${esc(taProfile().timezone)}">${eliteClockText()}</b></div>${accountCurrencyControl()}<button class="reference-icon" onclick="eliteToggleContrast()" aria-label="Alternar contraste" aria-pressed="${eliteContrast}">☼</button><button class="reference-connection" onclick="taGo('settings')" aria-label="Ver conexão"><i class="${taConnection.authenticated ? "connected" : ""}"></i><span class="terminal-connection-label">${esc(taApiState())}</span></button></div></div>`;
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
          `<button class="elite-tool-result" onclick="document.getElementById('elite-tools-dialog').close();taGo('${id}')">${terminalIcon(id)}<span>${esc(label)}</span><span>↗</span></button>`,
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
  d.innerHTML = `<div class="section-head"><h2>O que precisa fazer?</h2><button class="b s" onclick="document.getElementById('elite-tools-dialog').close()">Fechar</button></div><label>Buscar ferramentas<input id="elite-tools-query" placeholder="Analyst, calendário, diário…" oninput="document.getElementById('elite-tools-results').innerHTML=eliteToolRows(this.value)"></label><div id="elite-tools-results">${eliteToolRows()}</div><small>Busca de funções do EliteX. Não é uma conversa com IA.</small>`;
  d.showModal();
  d.querySelector("input").focus();
}
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    if (!document.querySelector("dialog[open]")) eliteOpenTools();
  }
});
function eliteOpenAlerts() {
  let d = document.getElementById("elite-alerts-dialog");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "elite-alerts-dialog";
    document.body.append(d);
  }
  const m = eliteMomentumModel(),
    insight = taDailyInsight(taDailyWeekStats());
  d.innerHTML = `<div class="section-head"><h2>Pontos de atenção</h2><button class="b s" onclick="document.getElementById('elite-alerts-dialog').close()">Fechar</button></div><p>${esc(m.tip)}</p><p>${esc(insight.text)}</p><button class="b" onclick="document.getElementById('elite-alerts-dialog').close();taGo('ins')">Revisar execução</button>`;
  d.showModal();
}
function eliteReferenceHome() {
  const p = taProfile(),
    h = Number(taDailyParts().hour),
    m = eliteMomentumModel(),
    insight = taDailyInsight(taDailyWeekStats()),
    plan = taCurrentPlan(),
    valid = taBriefingHasResult(),
    ready = taConnection.authenticated && taConnection.services?.ai,
    events = taDailyEvents()
      .filter((e) => taDailyEventTime(e) >= Date.now())
      .slice(0, 2),
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
  return `<section class="elite-scene reference-home" data-state="${eliteDesk.state}"><div class="scene-character-motion" aria-hidden="true"></div><div class="reference-left"><div class="scene-greeting"><h1>${h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"},<br><span>${esc(p.name || "trader")}!</span></h1><p>Pronto para o seu dia de trading?<br>Seu processo, com mais clareza.</p></div><div class="reference-workspace-actions"><div class="elite-office scene-composer">${eliteConnectionGate()}<button class="reference-command" onclick="eliteOpenTools()">${terminalIcon("analyst")}<span>Escolha uma ferramenta ou análise…</span><b>➤</b></button></div><div class="scene-bottom-actions elite-function-actions">${[
    ["analyst", "EliteX Analyst"],
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
    )}</div></div></div><div class="reference-right"><section class="scene-card reference-briefing scene-focus"><div class="reference-card-heading">${terminalIcon("ins")}<h2>Briefing do Dia</h2><button class="scene-link" onclick="${ready ? "taGenerateBriefing()" : "taGo('settings')"}" ${taBriefing.pending ? "disabled" : ""}>${taBriefing.pending ? "Preparando…" : ready ? "Atualizar foco com IA" : "Conectar IA"}</button></div><div class="reference-briefing-body"><div class="reference-brief-row"><span class="reference-brief-icon">▥</span><div><h3>${regime}</h3><div class="elite-momentum"><span>Semana <b class="${m.week.percent === null ? "" : cl(m.week.percent)}">${fmt(m.week.percent)}${m.week.estimated ? " *" : ""}</b></span><span>Mês <b class="${m.month.percent === null ? "" : cl(m.month.percent)}">${fmt(m.month.percent)}${m.month.estimated ? " *" : ""}</b></span></div><p>${esc(m.tip)}</p>${m.month.percent === null ? '<button class="scene-link" onclick="taGo(\'dash\');diaryConfigureBalance()">Ativar percentuais ↗</button>' : ""}</div></div><div class="reference-brief-row"><span class="reference-brief-icon focus">✧</span><div><h3>Foco de hoje</h3><p>${esc(valid ? taBriefing.result.action : insight.text)}</p><button class="scene-link" onclick="taGo('${plan ? "analyst" : "plan"}')">${plan ? "Validar próxima operação" : "Definir meu sistema"} ↗</button></div></div></div><details class="reference-method"><summary>Base do briefing</summary>${eliteMomentumView(m)}${valid ? taBriefing.result.facts.map((f) => `<p>${esc(f.text)}</p>`).join("") : `<p>${esc(insight.label)}. Sem inferir erros a partir de perdas ou prometer lucro.</p>`}${taBriefing.error ? `<p role="status">${esc(taBriefing.error)}</p>` : ""}</details></section><section class="scene-card reference-events"><div class="reference-card-heading">${terminalIcon("economic")}<h2>Próximos eventos</h2><button class="scene-link" onclick="taGo('economic')">Ver todos →</button></div>${events.length ? events.map((e) => `<button class="reference-event" onclick="taGo('economic')"><time>${esc(taDailyFormatTime(e.time))}</time><span class="reference-currency">${eliteAssetIcon(e.currency)} ${esc(e.currency)}</span><span>${esc(e.name)}</span><b class="impact-${["high", "medium", "low"].includes(e.impact) ? e.impact : "unknown"}">${{ high: "Alto", medium: "Médio", low: "Baixo" }[e.impact] || "—"}</b></button>`).join("") : "<p>Sem próximo evento verificado disponível.</p><small>Consulte o calendário para conferir a cobertura da fonte.</small>"}</section><section class="scene-card reference-assets"><div class="reference-card-heading">${terminalIcon("ana")}<h2>Seus ativos em foco</h2><button class="scene-link" onclick="taAssetOpen()">Editar →</button></div><div class="reference-asset-grid">${
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
  return symbol.startsWith("XAU")
    ? "◈"
    : symbol.startsWith("XAG")
      ? "◇"
      : {
          USD: "🇺🇸",
          GBP: "🇬🇧",
          EUR: "🇪🇺",
          CAD: "🇨🇦",
          AUD: "🇦🇺",
          NZD: "🇳🇿",
          JPY: "🇯🇵",
          CHF: "🇨🇭",
        }[symbol.slice(0, 3)] || "◎";
}
