/* Reference-led photographic office. No simulated market data or character articulation. */
const eliteDesk = { state: "working", timer: 0 };
function eliteState(state) {
  eliteDesk.state = state;
  document.querySelector(".elite-scene")?.setAttribute("data-state", state);
  document.querySelector(".elite-office")?.setAttribute("data-state", state);
  const label = document.querySelector("#elite-state");
  if (label)
    label.textContent = {
      working: "Seu processo em foco",
      attention: "Pronto para revisar",
      thinking: "Consultando a IA…",
      responding: "Orientação disponível",
    }[state];
  clearTimeout(eliteDesk.timer);
  if (state === "attention" || state === "responding")
    eliteDesk.timer = setTimeout(() => eliteState("working"), 9000);
}
function eliteDaySummary() {
  const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: taProfile().timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date()),
    get = (k) => parts.find((p) => p.type === k).value,
    date = get("year") + "-" + get("month") + "-" + get("day"),
    rows = S.trades.filter((t) => t.close?.slice(0, 10) === date),
    rs = rows.map(realizedTradeR).filter((r) => r.value !== null),
    plan = taCurrentPlan();
  return `<section class="elite-day-summary grid" aria-label="Resumo operacional de hoje">${kp("Operações hoje", rows.length)}${kp(rs.length === rows.length ? "R conhecido hoje" : "R conhecido · parcial", rs.length ? shareR(rs.reduce((v, r) => v + r.value, 0)) : "—", "", rs.length + "/" + rows.length + " operações com R")}${kp("Limite diário do plano", plan?.risk?.maxDaily ? money(plan.risk.maxDaily) : "Não definido", "", "Limite documentado, sem bloqueio de ordens")}</section>`;
}

/* Reference-led Home. All detailed tools remain available through navigation. */
function vHome() {
  const profile = taDailyProfile(),
    hour = Number(taDailyParts().hour),
    greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite",
    session = taDailySession(),
    plan = taCurrentPlan(),
    event = taDailyEvents().find((e) => taDailyEventTime(e) >= Date.now()),
    market = taDailyRequestState("market"),
    instruments = market.data?.instruments || [],
    ready = taConnection.authenticated && taConnection.services?.ai;
  return `<section class="elite-scene" data-state="${eliteDesk.state}" aria-label="Escritório EliteX"><div class="scene-character-motion" aria-hidden="true"></div><div class="scene-greeting"><div class="scene-brand">ELITE<span>X</span></div><h1>${greeting},<br><span>${esc(profile.name || "trader")}!</span></h1><p>Pronto para o seu dia de trading?<br>Seu processo, com mais clareza.</p></div>${eliteFocusPanel()}<div class="scene-cards"><section class="scene-card"><div class="section-head"><h2>Seus ativos</h2><button class="scene-link" onclick="taAssetOpen()">Editar ↗</button></div>${
    instruments.length
      ? instruments
          .slice(0, 3)
          .map(
            (i) =>
              `<div class="scene-market-row"><b>${esc(i.symbol)}</b><span class="ta-volatility-${["low", "moderate", "high"].includes(i.volatility) ? i.volatility : "unknown"}">${{ low: "Baixa", moderate: "Moderada", high: "Alta" }[i.volatility] || "Indisponível"}</span></div>`,
          )
          .join("")
      : `<p>${profile.instruments.length ? profile.instruments.map(esc).join(" · ") : "Selecione os ativos que acompanha."}</p><small>${taConnection.authenticated ? "Volatilidade aguardando consulta." : "Conecte os serviços para consultar a volatilidade."}</small>`
  }<small>Volatilidade observada · sem indicação de direção</small></section><section class="scene-card"><div class="section-head"><h2>Próximo evento</h2><button class="scene-link" onclick="taGo('economic')">Ver todos ↗</button></div>${event ? `<div class="scene-event"><b>${esc(taDailyFormatTime(event.time))}</b><span>${esc(event.currency)}</span></div><p>${esc(event.name)}</p>` : "<p>Confira a agenda econômica.</p><small>Sem próximo evento verificado disponível nesta consulta.</small>"}</section><section class="scene-card"><div class="section-head"><h2>Visão do dia</h2><button class="scene-link" onclick="taGo('dash')">↗</button></div><dl><div><dt>Sessão</dt><dd>${session.configured ? esc(profile.session.start + "–" + profile.session.end) : '<button class="scene-link" onclick="taGo(\'settings\')">Configurar</button>'}</dd></div><div><dt>Trading Plan</dt><dd>${plan ? "Ativo · v" + esc(plan.version) : '<button class="scene-link" onclick="taGo(\'plan\')">Criar plano</button>'}</dd></div><div><dt>Limite diário</dt><dd>${plan?.risk?.maxDaily ? money(plan.risk.maxDaily) : "Não definido"}</dd></div></dl></section></div><div class="elite-office scene-composer" data-state="${eliteDesk.state}">${eliteConnectionGate()}<div class="elite-function-heading"><div><h2>Seu assistente de trading</h2><p>Escolha o que precisa revisar.</p></div><span id="elite-state">${ready ? "IA configurada" : "Ferramentas disponíveis"}</span></div><div class="scene-bottom-actions elite-function-actions">${[
    ["analyst", "EliteX Analyst", "Meu trade segue meu sistema?"],
    ["ins", "Raio-X do Trader", "Meus padrões e pontos de atenção"],
    ["economic", "Calendário", "Eventos e cautelas do dia"],
    ["plan", "Meu sistema", "Regras que orientam as análises"],
  ]
    .map(
      ([id, label, note]) =>
        `<button onclick="eliteState('attention');taGo('${id}')">${terminalIcon(id)}<span><b>${label}</b><small>${note}</small></span></button>`,
    )
    .join("")}</div></div></section>`;
}

function eliteConnectionGate() {
  if (
    taConnection.authenticated ||
    !taConnection.available ||
    !taConnection.authConfigured
  )
    return "";
  return `<form class="ta-login scene-login" onsubmit="event.preventDefault();taLogin()"><div><b>Conecte este navegador uma vez</b><small>Nas próximas visitas, sua conexão será restaurada automaticamente.</small></div><label class="sr-only" for="ta-password">Senha do servidor pessoal</label><input id="ta-password" name="password" type="password" autocomplete="current-password" required placeholder="Senha do servidor"><button class="b" type="submit">Conectar</button><p id="ta-login-error" role="status"></p></form>`;
}

function eliteFocusPanel() {
  const momentum = eliteMomentumModel(),
    insight = taDailyInsight(taDailyWeekStats()),
    valid = taBriefingHasResult(),
    ready = taConnection.authenticated && taConnection.services?.ai;
  return `<aside class="scene-prompt scene-focus"><p>✦ Seu <strong>Assistente Forex</strong></p><h2>Seu ritmo, seu processo</h2>${eliteMomentumView(momentum)}${valid ? `<p class="scene-focus-text">${esc(taBriefing.result.action)}</p>` : insight.label === "Registro observado" ? `<details class="elite-observed-pattern"><summary>Ponto de atenção nos registros</summary><p>${esc(insight.text)}</p><small>${esc(insight.action)}</small></details>` : ""}<div class="scene-focus-actions"><button onclick="${ready ? "taGenerateBriefing()" : "taGo('settings')"}" ${taBriefing.pending ? "disabled" : ""}>${taBriefing.pending ? "Preparando insight…" : ready ? "Atualizar foco com IA" : "Conectar IA"} ↗</button><button onclick="taGo('ins')">Revisar meus padrões ↗</button></div><details><summary>${valid ? "Base da orientação · IA" : "Base da orientação · registros locais"}</summary>${valid ? taBriefing.result.facts.map((f) => `<p>${esc(f.text)}</p>`).join("") : `<p>${esc(insight.label)}. Observações baseadas somente no plano e nos registros disponíveis, com limites de amostra. Ausência de registro não significa ausência de erro.</p>`}</details>${taBriefing.error ? `<small role="status">${esc(taBriefing.error)}</small>` : ""}</aside>`;
}

function eliteMomentumModel() {
  const today = taDailyDate(),
    weekStart = taDailyWeekStats().from,
    monthStart = today.slice(0, 7) + "-01",
    pool = insUniverse()
      .filter((t) => day(t) <= today)
      .sort(
        (a, b) =>
          a.close.localeCompare(b.close) ||
          String(a.id).localeCompare(String(b.id)),
      );
  const period = (from) => {
    const rows = pool.filter((t) => day(t) >= from),
      net = rows.reduce((sum, t) => sum + t.pnl, 0),
      opening =
        S.balanceConfirmed && Number.isFinite(S.balance)
          ? S.balance +
            pool.filter((t) => day(t) < from).reduce((sum, t) => sum + t.pnl, 0)
          : null;
    return {
      from,
      to: today,
      n: rows.length,
      net,
      opening,
      percent:
        Number.isFinite(opening) &&
        opening > 0 &&
        Number.isFinite((net / opening) * 100)
          ? (net / opening) * 100
          : null,
      estimated: rows.some((t) => t.est),
    };
  };
  const week = period(weekStart),
    month = period(monthStart);
  let streak = 0;
  for (let i = pool.length - 1; i >= 0; ) {
    let j = i;
    while (j >= 0 && pool[j].close === pool[i].close) j--;
    const group = pool.slice(j + 1, i + 1);
    if (group.some((t) => t.pnl >= 0)) break;
    streak += group.length;
    i = j;
  }
  const plan = taCurrentPlan(),
    criterion = plan?.criteria.find(
      (c) => c.required && c.role !== "invalidation",
    ),
    rule = criterion
      ? ` Confirme “${criterion.label}” antes de entrar.`
      : " Siga somente os critérios do seu sistema.";
  let tone = "neutral",
    tip =
      "Sem operações nesta semana. Não há pressa: espere um contexto claro.";
  if (streak >= 2) {
    tone = "caution";
    tip = `${streak} perdas seguidas nos últimos fechamentos. Vale desacelerar e revisar o contexto; evite entrar apenas para recuperar.`;
  } else if (week.n && week.net < 0) {
    tone = "caution";
    tip =
      "A semana está negativa. Menos operações pode ser uma boa escolha: não force entradas e espere setups claros.";
  } else if (week.n && week.net > 0) {
    tone = "steady";
    tip =
      "A semana está positiva. Preserve o processo e o risco planejado; um bom resultado não exige mais operações.";
  } else if (week.n) {
    tip =
      "A semana está equilibrada. Não há pressa para virar o resultado; priorize a clareza do setup.";
  }
  return {
    week,
    month,
    streak,
    tone,
    tip: tip + rule,
    rule: criterion?.label || null,
  };
}
function eliteMomentumView(m) {
  const pct = (n) =>
    n === null
      ? "—"
      : (Math.abs(n) < 0.005
          ? "0,00"
          : (n > 0 ? "+" : "") + n.toFixed(2).replace(".", ",")) + "%";
  return `<div class="elite-momentum" aria-label="Desempenho da semana e do mês"><div><small>Semana</small><b class="${m.week.percent === null ? "" : cl(m.week.percent)}">${pct(m.week.percent)}${m.week.estimated ? " *" : ""}</b></div><div><small>Mês</small><b class="${m.month.percent === null ? "" : cl(m.month.percent)}">${pct(m.month.percent)}${m.month.estimated ? " *" : ""}</b></div></div><p class="elite-momentum-tip" data-tone="${m.tone}">${esc(m.tip)}</p><details class="elite-momentum-method"><summary>${m.month.percent === null ? "Como ativar os percentuais" : "Sobre estes percentuais"}</summary><p>Resultado fechado do período ÷ saldo calculado na abertura. Semana desde segunda-feira; mês desde o primeiro dia. Usa o histórico completo deste navegador, sem filtros por ativo. Não inclui depósitos, saques ou posições abertas. * indica P&amp;L estimado.</p>${m.month.percent === null ? '<button class="scene-link" onclick="taGo(\'dash\');diaryConfigureBalance()">Configurar saldo inicial ↗</button>' : ""}<p>Perdas seguidas não comprovam erros ou overtrading. As orientações são lembretes de processo, não sinais de entrada.</p></details>`;
}
