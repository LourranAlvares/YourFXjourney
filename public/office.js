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
function vHome(){return eliteReferenceHome()}

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
