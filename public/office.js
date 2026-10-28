/* Reference-led photographic office. No simulated market data or character articulation. */
const eliteDesk = { state: "working", messages: [], pending: false, timer: 0 };
function eliteState(state) {
  eliteDesk.state = state;
  document.querySelector(".elite-office")?.setAttribute("data-state", state);
  const label = document.querySelector("#elite-state");
  if (label)
    label.textContent = {
      working: "Seu espaço de preparação",
      attention: "Estou ouvindo",
      thinking: "Consultando a IA…",
      responding: "Orientação disponível",
    }[state];
  clearTimeout(eliteDesk.timer);
  if (state === "attention" || state === "responding")
    eliteDesk.timer = setTimeout(() => eliteState("working"), 9000);
}
async function eliteSend() {
  if (eliteDesk.pending) return;
  const input = document.querySelector("#elite-question"),
    question = input?.value.trim();
  if (!question) return;
  if (!taConnection.authenticated || !taConnection.services?.ai) {
    eliteDesk.messages.push({
      role: "error",
      text: "A IA não está conectada. Entre em Configurações para validar a conexão. Os atalhos continuam disponíveis.",
    });
    R();
    eliteState("attention");
    return;
  }
  eliteDesk.messages.push({ role: "user", text: question });
  eliteDesk.pending = true;
  eliteState("thinking");
  R();
  try {
    const snapshot = taBriefingInput(),
      result = await taApi("/api/briefing", {
        method: "POST",
        body: JSON.stringify({ ...snapshot, question }),
      });
    const byId = new Map(snapshot.facts.map((f) => [f.id, f.text]));
    eliteDesk.messages.push({
      role: "assistant",
      text: [
        ...result.facts.map((f) => byId.get(f.id)).filter(Boolean),
        result.action,
      ].join("\n\n"),
    });
  } catch (e) {
    eliteDesk.messages.push({ role: "error", text: e.message });
  } finally {
    eliteDesk.pending = false;
    eliteDesk.messages = eliteDesk.messages.slice(-20);
    if (tab === "home") {
      R();
      eliteState("responding");
    } else eliteDesk.state = "responding";
  }
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
  return `<section class="elite-scene" aria-label="Escritório EliteX"><div class="scene-greeting"><div class="scene-brand">ELITE<span>X</span></div><h1>${greeting},<br><span>${esc(profile.name || "trader")}!</span></h1><p>Pronto para o seu dia de trading?<br>Seu processo, com mais clareza.</p></div><aside class="scene-prompt"><p>✦ Seu <strong>Assistente Forex</strong></p><h2>Como posso ajudar hoje?</h2>${[
    ["analyst", "Analisar um gráfico"],
    ["economic", "Resumo de notícias"],
    ["plan", "Revisar meu plano"],
  ]
    .map(
      ([id, label]) =>
        `<button onclick="taGo('${id}')">${terminalIcon(id)}<span>${label}</span><span>↗</span></button>`,
    )
    .join(
      "",
    )}</aside><div class="scene-cards"><section class="scene-card"><div class="section-head"><h2>Seus ativos</h2><button class="scene-link" onclick="taAssetOpen()">Editar ↗</button></div>${
    instruments.length
      ? instruments
          .slice(0, 3)
          .map(
            (i) =>
              `<div class="scene-market-row"><b>${esc(i.symbol)}</b><span class="ta-volatility-${["low", "moderate", "high"].includes(i.volatility) ? i.volatility : "unknown"}">${{ low: "Baixa", moderate: "Moderada", high: "Alta" }[i.volatility] || "Indisponível"}</span></div>`,
          )
          .join("")
      : `<p>${profile.instruments.length ? profile.instruments.map(esc).join(" · ") : "Selecione os ativos que acompanha."}</p><small>${taConnection.authenticated ? "Volatilidade aguardando consulta." : "Conecte os serviços para consultar a volatilidade."}</small>`
  }<small>Volatilidade observada · sem indicação de direção</small></section><section class="scene-card"><div class="section-head"><h2>Próximo evento</h2><button class="scene-link" onclick="taGo('economic')">Ver todos ↗</button></div>${event ? `<div class="scene-event"><b>${esc(taDailyFormatTime(event.time))}</b><span>${esc(event.currency)}</span></div><p>${esc(event.name)}</p>` : "<p>Confira a agenda econômica.</p><small>Sem próximo evento verificado disponível nesta consulta.</small>"}</section><section class="scene-card"><div class="section-head"><h2>Visão do dia</h2><button class="scene-link" onclick="taGo('dash')">↗</button></div><dl><div><dt>Sessão</dt><dd>${session.configured ? esc(profile.session.start + "–" + profile.session.end) : '<button class="scene-link" onclick="taGo(\'settings\')">Configurar</button>'}</dd></div><div><dt>Trading Plan</dt><dd>${plan ? "Ativo · v" + esc(plan.version) : '<button class="scene-link" onclick="taGo(\'plan\')">Criar plano</button>'}</dd></div><div><dt>Limite diário</dt><dd>${plan?.risk?.maxDaily ? money(plan.risk.maxDaily) : "Não definido"}</dd></div></dl></section></div><div class="elite-office scene-composer" data-state="${eliteDesk.state}"><form onsubmit="event.preventDefault();eliteSend()"><button type="button" class="scene-attach" aria-label="Anexar gráfico no Trade Analyst" onclick="taGo('analyst')">${terminalIcon("analyst")}</button><label class="sr-only" for="elite-question">Pergunte ao assistente</label><textarea id="elite-question" rows="1" maxlength="1500" placeholder="Pergunte algo ou peça uma análise…" oninput="if(!eliteDesk.pending)eliteState('attention')" ${eliteDesk.pending ? "disabled" : ""}></textarea><button class="scene-send" type="submit" aria-label="Enviar pergunta" ${eliteDesk.pending ? "disabled" : ""}>${eliteDesk.pending ? "…" : "➤"}</button></form><div class="scene-bottom-actions">${[
    ["analyst", "Analisar gráfico"],
    ["economic", "Eventos de hoje"],
    ["plan", "Revisar meu plano"],
    ["trades", "Meu diário"],
  ]
    .map(
      ([id, label]) =>
        `<button onclick="taGo('${id}')">${terminalIcon(id)}<span>${label}</span></button>`,
    )
    .join(
      "",
    )}</div><div class="scene-chat-status"><span id="elite-state">${eliteDesk.pending ? "Consultando a IA…" : ready ? "IA disponível" : "IA não conectada"}</span><button class="scene-link" onclick="taGo('settings')">${ready ? "Conexão" : "Conectar"}</button><details><summary>Privacidade</summary><p>A pergunta, o plano e fatos agregados são enviados à IA. Imagens são analisadas no Trade Analyst.</p></details></div>${eliteDesk.messages.length ? `<details class="elite-history" open><summary>Conversa desta visita (${eliteDesk.messages.length})</summary><div role="log" aria-live="polite">${eliteDesk.messages.map((m) => `<article class="elite-message ${m.role}"><small>${m.role === "user" ? "Você" : m.role === "error" ? "Conexão" : "EliteX · IA"}</small><p>${esc(m.text)}</p></article>`).join("")}</div></details>` : ""}</div></section>`;
}
