/* Articulated SVG character, no external assets, no simulated market activity. */
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
function eliteAvatar() {
  return `<svg class="elite-avatar" viewBox="0 0 500 470" role="img" aria-label="Assistente EliteX ilustrado trabalhando em um notebook, com cabeça e mãos articuladas"><defs><linearGradient id="eliteSuit" x2="1" y2="1"><stop stop-color="#244844"/><stop offset=".5" stop-color="#102024"/><stop offset="1" stop-color="#050b10"/></linearGradient><linearGradient id="eliteSkin"><stop stop-color="#d5aa8e"/><stop offset="1" stop-color="#846556"/></linearGradient><linearGradient id="eliteMetal" x2="1" y2="1"><stop stop-color="#8aafad"/><stop offset=".3" stop-color="#233e43"/><stop offset="1" stop-color="#061316"/></linearGradient></defs><ellipse cx="248" cy="445" rx="210" ry="15" fill="#00e6b5" opacity=".06"/><g class="elite-torso"><path d="M121 384L129 261Q142 216 208 211L280 211Q350 218 370 263L396 391Z" fill="url(#eliteSuit)" stroke="#45615d"/><path d="M213 209L246 274L282 211L270 198L225 198Z" fill="#071015"/><path d="M211 214L192 243L222 252L209 275L241 353L245 270Z M282 211L304 243L273 253L285 279L249 353L247 270Z" fill="#29413f" stroke="#4b6761"/><path d="M246 272V365" stroke="#00e6b5" opacity=".6"/><text x="307" y="286" font-size="15" fill="#00e6b5" font-family="system-ui" font-weight="700">EX</text></g><g class="elite-head"><path d="M219 179L218 216Q248 239 278 211L272 172" fill="url(#eliteSkin)"/><ellipse cx="247" cy="126" rx="63" ry="78" fill="url(#eliteSkin)"/><path d="M185 133Q164 48 223 32Q292 13 312 67L308 125L294 97L282 69Q239 100 194 84Z" fill="#101c22" stroke="#47615e"/><path d="M196 65Q247 24 289 56M206 51Q251 21 276 35" fill="none" stroke="#5d7772" stroke-width="3"/><path d="M283 92L305 110L296 166L277 185L267 172L280 145Z" fill="url(#eliteMetal)" stroke="#6b9290"/><path d="M287 105L296 117L289 147L278 159" fill="none" stroke="#00e6b5" stroke-width="2"/><path d="M201 116Q217 108 231 115M252 115Q266 105 279 113" stroke="#3a302d" stroke-width="4" fill="none"/><g class="elite-eyes"><ellipse cx="218" cy="126" rx="11" ry="5" fill="#e7e6da"/><circle cx="219" cy="126" r="4" fill="#254b48"/><ellipse cx="265" cy="124" rx="10" ry="5" fill="#d3f5e9"/><circle cx="265" cy="124" r="4" fill="#00e6b5"/></g><path d="M242 128L236 151L247 153M225 171Q245 181 266 166" fill="none" stroke="#775347" stroke-width="3" stroke-linecap="round"/><path d="M185 119Q176 119 181 146L192 154" fill="#a98772"/><path d="M178 104Q172 59 209 39" fill="none" stroke="#00e6b5" stroke-width="3"/><rect x="174" y="112" width="16" height="40" rx="7" fill="url(#eliteMetal)" stroke="#00a98b"/></g><g class="elite-arm left"><path d="M151 251Q122 253 108 312L153 379L222 390L228 370L175 350L161 297" fill="url(#eliteSuit)" stroke="#50736a"/><path class="elite-hand" d="M207 366Q224 355 244 367L271 388L220 395L204 385Z" fill="url(#eliteSkin)" stroke="#977a69"/></g><g class="elite-arm right"><path d="M337 249Q364 247 377 307L350 369L291 395L278 375L321 344L326 295" fill="url(#eliteSuit)" stroke="#50736a"/><path class="elite-hand" d="M294 371Q275 360 262 370L237 393L289 397L302 387Z" fill="url(#eliteSkin)" stroke="#977a69"/></g><path d="M93 323L353 323L390 426L133 426Z" fill="url(#eliteMetal)" stroke="#668d87" stroke-width="2"/><path d="M133 426H390L422 438H103Z" fill="#29423f" stroke="#63827a"/><path d="M106 332L345 332L374 413L143 413Z" fill="#09171c"/><text x="205" y="385" fill="#00e6b5" font-size="32" font-family="system-ui" font-weight="700" letter-spacing="5">ELITEX</text><path d="M153 405H363" stroke="#00e6b5" opacity=".5"/></svg>`;
}
function eliteOffice() {
  const ready = taConnection.authenticated && taConnection.services?.ai;
  return `<section class="elite-office" data-state="${eliteDesk.state}" aria-label="Seu assistente EliteX"><div class="eyebrow">Seu escritório digital</div><div class="section-head"><h2>Seu parceiro de processo<span class="g">.</span></h2><span class="badge">${ready ? "IA disponível" : "IA não conectada"}</span></div><p>Organize o dia. Confira suas regras. Trabalhe com evidências.</p><button class="elite-avatar-button" onclick="eliteState('attention');document.querySelector('#elite-question').focus()" aria-label="Chamar o assistente EliteX">${eliteAvatar()}</button><div class="elite-presence"><i></i><span id="elite-state">${{ thinking: "Consultando a IA…", responding: "Orientação disponível", attention: "Estou ouvindo", working: "Seu espaço de preparação" }[eliteDesk.state]}</span><small>Personagem 2D articulado</small></div><form onsubmit="event.preventDefault();eliteSend()"><label for="elite-question">Como posso ajudar?</label><textarea id="elite-question" maxlength="1500" rows="2" placeholder="Como preparar minha próxima sessão?" onfocus="if(!eliteDesk.pending)eliteState('attention')" oninput="if(!eliteDesk.pending)eliteState('attention')" ${eliteDesk.pending ? "disabled" : ""}></textarea><button class="b" type="submit" ${eliteDesk.pending ? "disabled" : ""}>${eliteDesk.pending ? "Consultando…" : "Perguntar ao assistente ↗"}</button></form><p class="muted-note">Ao enviar, a pergunta, seu plano e um resumo agregado dos registros são enviados à IA. Prints são analisados no Trade Analyst.</p><div class="elite-shortcuts">${[
    ["analyst", "Analisar gráfico"],
    ["economic", "Eventos de hoje"],
    ["plan", "Revisar meu plano"],
    ["trades", "Rever meu diário"],
  ]
    .map(
      ([id, label]) =>
        `<button class="b s" onclick="eliteState('attention');taGo('${id}')">${label} ↗</button>`,
    )
    .join(
      "",
    )}</div><details class="elite-history" ${eliteDesk.messages.length ? "open" : ""}><summary>Conversa desta visita (${eliteDesk.messages.length})</summary><div role="log" aria-live="polite">${eliteDesk.messages.map((m) => `<article class="elite-message ${m.role}"><small>${m.role === "user" ? "Você" : m.role === "error" ? "Conexão" : "EliteX · IA"}</small><p>${esc(m.text)}</p></article>`).join("")}</div></details></section>`;
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
