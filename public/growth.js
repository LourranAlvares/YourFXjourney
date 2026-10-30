/* Personal growth modules. All records use the existing account-scoped workspace. */
const growthUI = {
  month: false,
  logLimit: 12,
  checkin: null,
  review: null,
  cert: null,
  toast: null,
};
function growthData() {
  return GrowthEngine.normalise(S.growth);
}
function growthAdapter(rules = insRules(), zone = taProfile().timezone) {
  return {
    universe: () => insUniverse(),
    stats: st,
    realizedR: realizedTradeR,
    process: (rows) => insProcess(rows, insUniverse(), rules),
    percent: insPercent,
    today: () => SessionEngine.zonedParts(new Date(), zone).date,
    timezone: () => zone,
    forCertificate: (c) =>
      growthAdapter(c.config?.insightRules || insRules(), c.timezone || zone),
    now: () => new Date(),
    session: (t) => sess(t),
    minRR: () => taCurrentPlan()?.risk.minRR || null,
  };
}
function growthCommit(change, render = true) {
  const previous = S.growth,
    next = JSON.parse(JSON.stringify(growthData()));
  change(next);
  S.growth = next;
  try {
    persistState(S);
  } catch (e) {
    S.growth = previous;
    throw e;
  }
  if (render) R();
  return next;
}
function growthError(e) {
  const node = document.querySelector("#growth-dialog [role=status]");
  if (node) node.textContent = e.message;
  else alert(e.message);
}
function growthDialog(title, body) {
  let d = document.getElementById("growth-dialog");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "growth-dialog";
    d.addEventListener("close", () => {
      growthUI.checkin = null;
    });
    document.body.append(d);
  }
  d.setAttribute("aria-label", title);
  d.classList.remove("growth-certificate-dialog");
  d.innerHTML = `<div class="section-head"><h2>${esc(title)}</h2><button class="b s" onclick="document.getElementById('growth-dialog').close()">Fechar</button></div>${body}<p role="status" aria-live="polite"></p>`;
  if (!d.open) d.showModal();
  return d;
}
function growthSession() {
  return GrowthEngine.context(taProfile(), new Date());
}
function growthStart() {
  const s = growthSession();
  if (!s.configured || s.status !== "active")
    return alert(
      "Confirme sua sessão nas configurações. O início de atividade fica disponível dentro do horário escolhido.",
    );
  try {
    growthCommit((g) => {
      g.activeRun = {
        id: crypto.randomUUID(),
        sessionKey: s.key,
        startedAt: new Date().toISOString(),
      };
      g.prompts[s.key] = {
        ...(g.prompts[s.key] || {}),
        ignored: false,
        lastAt: Date.now() - g.monitor.frequency * 60000,
      };
    });
  } catch (e) {
    growthError(e);
  }
}
function growthStop() {
  try {
    growthCommit((g) => {
      g.activeRun = null;
      const s = growthSession();
      if (s.key)
        g.prompts[s.key] = { ...(g.prompts[s.key] || {}), ignored: true };
    });
  } catch (e) {
    growthError(e);
  }
}
function growthPrompt(action) {
  const s = growthSession();
  try {
    growthCommit((g) => {
      if (action === "disable") g.monitor.enabled = false;
      else if (s.key) {
        g.prompts[s.key] = {
          ...(g.prompts[s.key] || {}),
          lastAt: action === "snooze" ? 0 : Date.now(),
          ...(action === "snooze"
            ? { snoozedUntil: Date.now() + 10 * 60000 }
            : { ignored: true }),
        };
      }
    });
    try {
      localStorage.removeItem(K + ":growth-prompt");
    } catch {}
    document.getElementById("growth-live-prompt")?.remove();
  } catch (e) {
    growthError(e);
  }
}
function growthCheckin(tradeId = "") {
  const s = growthSession(),
    g = growthData(),
    at = new Date().toISOString(),
    zone = taProfile().timezone,
    key =
      s.configured && s.status === "active"
        ? s.key
        : "manual|" + SessionEngine.zonedParts(at, zone).date;
  growthUI.checkin = {
    id: null,
    at,
    date: SessionEngine.zonedParts(at, zone).date,
    sessionKey: key,
    sessionLabel:
      s.configured && s.status === "active" ? s.label : "Registro manual",
    sessionStart: s.status === "active" ? s.startAt : null,
    sessionEnd: s.status === "active" ? s.endAt : null,
    timezone: zone,
    tradeId: tradeId || null,
  };
  growthDialog(
    "How are you feeling right now?",
    `<p class="muted-note">${esc(growthUI.checkin.sessionLabel)} · ${esc(SessionEngine.formatInZone(at, zone))}. Resposta pessoal, sem diagnóstico.</p><div class="growth-emotions">${Object.entries(
      GrowthEngine.emotions,
    )
      .map(
        ([key, [label]]) =>
          `<button class="b s" data-emotion="${key}" onclick="growthRecordEmotion(this.dataset.emotion)">${terminalIcon(["calm", "confident"].includes(key) ? "plan" : key === "tired" ? "clock" : "idea")}<span>${label}</span></button>`,
      )
      .join(
        "",
      )}</div><p id="growth-guidance" class="growth-guidance" aria-live="polite">Selecione uma opção para salvar. Intensidade e observação são opcionais.</p><div id="growth-checkin-details"></div>`,
  );
}
function growthRecordEmotion(emotion) {
  if (!GrowthEngine.emotions[emotion] || !growthUI.checkin) return;
  try {
    const log = {
      ...growthUI.checkin,
      id: growthUI.checkin.id || crypto.randomUUID(),
      emotion,
      intensity: null,
      note: "",
      decision: null,
    };
    growthCommit((g) => {
      const i = g.checkins.findIndex((l) => l.id === log.id);
      if (i < 0) g.checkins.push(log);
      else g.checkins[i] = { ...g.checkins[i], emotion };
      g.prompts[log.sessionKey] = {
        ...(g.prompts[log.sessionKey] || {}),
        lastAt: Date.now(),
      };
    }, false);
    growthUI.checkin = log;
    document.getElementById("growth-guidance").textContent =
      growthData().monitor.messages?.[emotion] ||
      GrowthEngine.emotions[emotion][1];
    growthCheckinDetails();
    growthRefreshPanels();
  } catch (e) {
    growthError(e);
  }
}
function growthCheckinDetails() {
  const log = growthData().checkins.find((l) => l.id === growthUI.checkin?.id);
  if (!log) return;
  const candidates = insUniverse()
    .filter((t) => {
      const time = GrowthEngine.instant(t.open || t.close, log.timezone);
      return (
        t.id === log.tradeId ||
        (time && Math.abs(Date.parse(time) - Date.parse(log.at)) <= 2 * 3600000)
      );
    })
    .slice(-40);
  document.getElementById("growth-checkin-details").innerHTML =
    `<p class="badge">Check-in salvo</p><details><summary>Adicionar contexto ou associar a uma operação</summary><form id="growth-checkin-form"><div class="growth-form-grid"><label>Intensidade percebida<select name="intensity"><option value="">Não informada</option>${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${log.intensity === n ? "selected" : ""}>${n}</option>`).join("")}</select></label><label>Operação relacionada<select name="trade"><option value="">Não associar</option>${candidates.map((t) => `<option value="${esc(t.id)}" ${log.tradeId === t.id ? "selected" : ""}>${esc(t.symbol)} · ${esc(t.open || t.close)}</option>`).join("")}</select></label><label class="growth-wide">Observação opcional<textarea name="note" maxlength="1000">${esc(log.note || "")}</textarea></label></div><label class="growth-checkbox"><input name="decision" type="checkbox" ${log.decision === "respected_plan" ? "checked" : ""}> Registrei que respeitei meu plano, mesmo com essa emoção.</label><button class="b s" type="submit">Salvar contexto</button></form><p class="muted-note">Vínculos são escolhidos por você. Proximidade de horário não demonstra causa.</p></details>`;
  document.getElementById("growth-checkin-form").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      growthCommit((g) => {
        const l = g.checkins.find((l) => l.id === log.id);
        l.intensity = f.get("intensity") ? Number(f.get("intensity")) : null;
        l.note = String(f.get("note")).trim();
        l.tradeId = candidates.some((t) => t.id === f.get("trade"))
          ? f.get("trade")
          : null;
        l.decision = f.get("decision") === "on" ? "respected_plan" : null;
      }, false);
      document.querySelector("#growth-dialog [role=status]").textContent =
        "Contexto salvo.";
      growthRefreshPanels();
    } catch (error) {
      growthError(error);
    }
  };
}
function growthDeleteCheckin(id) {
  if (!confirm("Excluir este check-in? As conquistas serão recalculadas."))
    return;
  try {
    growthCommit((g) => {
      g.checkins = g.checkins.filter((l) => l.id !== id);
    });
  } catch (e) {
    growthError(e);
  }
}
function growthDecision() {
  const plan = taCurrentPlan();
  const d = growthDialog(
    "Decisão de não operar",
    `<p>Não operar também pode ser uma decisão consciente. Registre somente o que aconteceu.</p><form id="growth-decision-form"><label>Motivo<select name="kind"><option value="outside_plan">Oportunidade fora do plano</option><option value="unclear">Contexto sem clareza</option><option value="limit">Limite de risco atingido</option><option value="personal">Decisão pessoal</option></select></label><label>Registro breve<textarea name="note" required minlength="5" maxlength="1000" placeholder="Qual critério ou contexto motivou sua decisão?"></textarea></label><p class="muted-note">${plan ? "Plano de referência: " + esc(plan.name) + " · v" + esc(plan.version) : "Sem plano salvo. O registro será mantido, sem comprovar seletividade em relação a regras."}</p><button class="b" type="submit">Registrar decisão</button></form>`,
  );
  d.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target),
      note = String(f.get("note")).trim();
    if (note.length < 5) return;
    try {
      const at = new Date().toISOString(),
        s = growthSession();
      growthCommit((g) =>
        g.decisions.push({
          id: crypto.randomUUID(),
          at,
          date: taDailyDate(),
          timezone: taProfile().timezone,
          sessionKey: s.key || "manual|" + taDailyDate(),
          kind: f.get("kind"),
          note,
          planId: plan?.id || null,
          planVersion: plan?.version || null,
        }),
      );
      d.close();
    } catch (error) {
      growthError(error);
    }
  };
}
function growthSettings() {
  const g = growthData(),
    p = taProfile(),
    s = p.session;
  return `<section class="card" id="growth-settings"><div class="eyebrow">Rotina pessoal</div><h2>Live Emotional Monitor</h2><p>Check-ins discretos nesta página aberta. O horário não comprova atividade; por padrão você confirma o início da sessão.</p><form id="growth-monitor-config" onsubmit="growthSaveSettings(event)"><div class="growth-form-grid"><label class="growth-checkbox"><input name="enabled" type="checkbox" ${g.monitor.enabled ? "checked" : ""}> Ativar monitoramento</label><label>Início dos check-ins<select name="mode"><option value="manual" ${g.monitor.mode === "manual" ? "selected" : ""}>Após eu confirmar a atividade</option><option value="auto" ${g.monitor.mode === "auto" ? "selected" : ""}>Automaticamente no meu horário</option></select></label><label>Intervalo (minutos)<input name="frequency" type="number" min="5" max="180" value="${g.monitor.frequency}"></label><label>Sessão<select name="preset" onchange="growthSessionPreset(this.value)"><option value="custom">Minha configuração</option><option value="london">Londres</option><option value="newyork">Nova York</option></select></label><label>Nome<input name="label" value="${esc(s.label)}" maxlength="60"></label><label>Fuso IANA<input name="timezone" value="${esc(s.timezone || p.timezone)}" placeholder="Europe/London" required></label><label>Início<input name="start" type="time" value="${esc(s.start)}" required></label><label>Fim<input name="end" type="time" value="${esc(s.end)}" required></label><fieldset class="growth-weekdays"><legend>Dias da semana</legend>${["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((label, i) => `<label><input name="days" type="checkbox" value="${i + 1}" ${s.days.includes(i + 1) ? "checked" : ""}>${label}</label>`).join("")}</fieldset><label class="growth-checkbox"><input name="sessionEnabled" type="checkbox" ${s.enabled ? "checked" : ""}> Usar esta sessão também na preparação diária</label></div><details><summary>Personalizar orientações</summary>${Object.entries(
    GrowthEngine.emotions,
  )
    .map(
      ([key, [label, text]]) =>
        `<label>${label}<input name="message-${key}" maxlength="240" value="${esc(g.monitor.messages?.[key] || text)}"></label>`,
    )
    .join(
      "",
    )}</details><p id="growth-settings-message" role="status"></p><button class="b s" type="submit">Salvar rotina</button></form><p class="muted-note">Usa o motor de sessões existente, com horário de verão. Não envia notificações quando o site está fechado, não lê outras abas e não compartilha registros com a administração.</p></section>`;
}
function growthSessionPreset(preset) {
  const f = document.getElementById("growth-monitor-config");
  if (preset === "custom") return;
  f.elements.label.value = preset === "london" ? "Londres" : "Nova York";
  f.elements.timezone.value =
    preset === "london"
      ? "Europe/London"
      : "America/New_York"; /* Hours remain the user's choice. */
}
function growthSaveSettings(event) {
  event.preventDefault();
  const f = new FormData(event.target),
    frequency = Number(f.get("frequency")),
    session = {
      enabled: f.get("sessionEnabled") === "on",
      label: String(f.get("label")).trim(),
      timezone: String(f.get("timezone")).trim(),
      start: f.get("start"),
      end: f.get("end"),
      days: f.getAll("days").map(Number),
    };
  try {
    SessionEngine.checkZone(session.timezone);
    if (!session.days.length) throw Error("Escolha ao menos um dia.");
    SessionEngine.validateSession({ ...session, enabled: true });
    if (!Number.isInteger(frequency) || frequency < 5 || frequency > 180)
      throw Error("Use um intervalo de 5 a 180 minutos.");
    if (f.get("enabled") === "on" && !session.enabled)
      throw Error(
        "Ative a sessão para programar check-ins ou deixe o monitor desativado.",
      );
    const oldProfile = S.assistantProfile;
    S.assistantProfile = { ...(oldProfile || {}), session };
    try {
      growthCommit((g) => {
        g.monitor = {
          ...g.monitor,
          enabled: f.get("enabled") === "on",
          mode: f.get("mode"),
          frequency,
          messages: Object.fromEntries(
            Object.keys(GrowthEngine.emotions).map((key) => [
              key,
              String(f.get("message-" + key) || "")
                .trim()
                .slice(0, 240),
            ]),
          ),
        };
        g.activeRun = null;
        g.prompts = {};
      });
    } catch (e) {
      S.assistantProfile = oldProfile;
      throw e;
    }
    document.getElementById("growth-settings-message").textContent =
      "Rotina salva.";
  } catch (e) {
    document.getElementById("growth-settings-message").textContent = e.message;
  }
}
function growthInsights() {
  const range = GrowthEngine.bounds(
      growthUI.month ? "month" : "week",
      taDailyDate(),
    ),
    m = GrowthEngine.model(S, range, growthAdapter()),
    prior = GrowthEngine.model(
      S,
      GrowthEngine.previous(range),
      growthAdapter(),
    ),
    g = growthData(),
    s = growthSession(),
    running = g.activeRun?.sessionKey === s.key && s.status === "active",
    logs = [...m.emotional.logs].sort((a, b) => b.at.localeCompare(a.at));
  return `<section class="card growth-insights" id="growth-insights"><div class="section-head"><div><div class="eyebrow">Registros pessoais</div><h2>Emotional Insights</h2></div><div class="row"><button class="b s" onclick="growthUI.month=!growthUI.month;R()">${growthUI.month ? "Este mês" : "Esta semana"}</button><button class="b s" onclick="growthCheckin()">Check-in agora</button></div></div><p class="muted-note">${esc(range.from)} — ${esc(range.to)} · ${m.emotional.logs.length} check-ins. Horários em ${esc(taProfile().timezone)}.</p><div class="growth-session-controls"><span>${g.monitor.enabled ? "Monitor ativado" : "Monitor desativado"} · ${s.configured ? esc(s.label + " " + s.start + "–" + s.end) : "Sessão não configurada"}</span>${s.status === "active" ? `<button class="b s" onclick="${running ? "growthStop()" : "growthStart()"}">${running ? "Encerrar atividade" : "Iniciei minha atividade"}</button>` : ""}<button class="b s" onclick="growthDecision()">Registrar decisão de não operar</button></div>${
    logs.length
      ? `<div class="growth-emotion-bars">${Object.entries(m.emotional.freq)
          .sort((a, b) => b[1] - a[1])
          .map(
            ([key, n]) =>
              `<div><span>${esc(GrowthEngine.emotions[key][0])}</span><meter min="0" max="${logs.length}" value="${n}">${n}</meter><b>${n}</b></div>`,
          )
          .join(
            "",
          )}</div><p>FOMO declarado em ${m.emotional.fomoSessions} sessões. Frustração até 30 min após uma perda: ${m.emotional.afterLoss} registros. Check-ins associados anteriores à entrada: ${m.emotional.before}.</p><details><summary>Associações com o plano e histórico</summary><p class="muted-note">Associações temporais não demonstram causa. Uma emoção não comprova erro, transtorno ou resultado futuro.</p>${m.emotional.byState.map((x) => `<p>${esc(GrowthEngine.emotions[x.key][0])}: ${x.n} registros; ${x.known}/${x.trades} trades associados com plano avaliado${x.known >= 5 && x.adherence !== null ? "; " + x.adherence.toFixed(0) + "% de aderência entre os avaliados" : ". Amostra insuficiente para comparar aderência"}.</p>`).join("")}${logs
          .slice(0, growthUI.logLimit)
          .map(
            (l) =>
              `<article class="growth-log"><b>${esc(GrowthEngine.emotions[l.emotion][0])}</b><small>${esc(SessionEngine.formatInZone(l.at, l.timezone))} · ${esc(l.sessionLabel)}${l.intensity ? " · intensidade " + l.intensity : ""}</small>${l.note ? `<p>${esc(l.note)}</p>` : ""}<span>${l.tradeId ? "Vínculo: " + esc(S.trades.find((t) => t.id === l.tradeId)?.symbol || "operação removida") : "Sem vínculo com operação"}</span>${l.decision === "respected_plan" ? "<p>Respeito ao plano declarado.</p>" : ""}<button class="b s" data-id="${esc(l.id)}" onclick="growthDeleteCheckin(this.dataset.id)">Excluir</button></article>`,
          )
          .join(
            "",
          )}${logs.length > growthUI.logLimit ? '<button class="b s" onclick="growthUI.logLimit+=20;R()">Mostrar mais</button>' : ""}</details>`
      : "<p>Sem check-ins neste período. Registre somente quando fizer sentido para sua rotina.</p>"
  }<p class="muted-note">Período anterior: ${prior.emotional.logs.length} check-ins, FOMO em ${prior.emotional.fomoSessions} sessões; período atual: ${logs.length} check-ins, FOMO em ${m.emotional.fomoSessions} sessões. Frequências dependem da cobertura dos registros.</p><details><summary>Decisões de não operar (${g.decisions.length})</summary>${
    [...g.decisions]
      .reverse()
      .slice(0, 30)
      .map(
        (d) =>
          `<article class="growth-log"><small>${esc(d.date)}</small><p>${esc(d.note)}</p><button class="b s" data-id="${esc(d.id)}" onclick="growthDeleteDecision(this.dataset.id)">Excluir decisão</button></article>`,
      )
      .join("") || "<p>Nenhuma decisão registrada.</p>"
  }</details></section>`;
}
function growthDeleteDecision(id) {
  if (!confirm("Excluir este registro?")) return;
  try {
    growthCommit((g) => {
      g.decisions = g.decisions.filter((d) => d.id !== id);
    });
  } catch (e) {
    growthError(e);
  }
}
function growthRefreshPanels() {
  const node = document.getElementById("growth-insights");
  if (node) node.outerHTML = growthInsights();
  if (typeof growthReconcile === "function") growthReconcile();
}
function growthTick() {
  if (
    document.hidden ||
    (CLOUD_BOOT && !eliteCloud.ready) ||
    document.querySelector("dialog[open]") ||
    document.getElementById("growth-live-prompt")
  )
    return;
  if (!GrowthEngine.due(S.growth, taProfile())) return;
  const s = growthSession(),
    key = K + ":growth-prompt";
  try {
    const lock = JSON.parse(localStorage.getItem(key) || "null");
    if (lock?.sessionKey === s.key && lock.until > Date.now()) return;
    localStorage.setItem(
      key,
      JSON.stringify({
        sessionKey: s.key,
        until: Date.now() + growthData().monitor.frequency * 60000,
      }),
    );
    growthCommit((g) => {
      g.prompts[s.key] = { ...(g.prompts[s.key] || {}), lastAt: Date.now() };
      const entries = Object.entries(g.prompts);
      if (entries.length > 90)
        g.prompts = Object.fromEntries(entries.slice(-90));
    }, false);
    const banner = document.createElement("section");
    banner.id = "growth-live-prompt";
    banner.className = "growth-prompt";
    banner.innerHTML =
      '<span>How are you feeling right now?</span><button class="b s" onclick="this.closest(\'section\').remove();growthCheckin()">Responder</button><button class="b s" onclick="growthPrompt(\'snooze\')">Adiar 10 min</button><button class="b s" onclick="growthPrompt(\'ignore\')">Ignorar sessão</button><button class="b s" onclick="growthPrompt(\'disable\')">Desativar</button>';
    document.querySelector(".reference-topbar")?.after(banner);
  } catch {
    /* A full/unavailable browser cache must not create repeated prompts. */
  }
}
setInterval(growthTick, 30000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) growthTick();
});

function growthAfterRender() {
  if (CLOUD_BOOT && !eliteCloud.ready) return;
  if (tab === "settings" && !document.getElementById("growth-settings")) {
    const host = document.createElement("details");
    host.className = "card growth-settings-host";
    host.innerHTML =
      "<summary>Rotina e Live Emotional Monitor</summary>" + growthSettings();
    document.getElementById("main").append(host);
  }
  if (tab === "trades" && !document.getElementById("growth-insights")) {
    const host = document.createElement("details");
    host.className = "card growth-insights-host";
    host.open = !!growthUI.insightsOpen;
    host.ontoggle = () => {
      if (host.isConnected) growthUI.insightsOpen = host.open;
    };
    host.innerHTML =
      "<summary>Emotional Insights · check-ins e decisões</summary>" +
      growthInsights();
    document.querySelector(".diary-heading")?.after(host);
  }
  if (typeof growthReviewToolbar === "function") growthReviewToolbar();
  if (typeof growthReconcile === "function") growthReconcile();
}
const growthPreviousAfterRender = terminalAfterRender;
terminalAfterRender = function () {
  growthPreviousAfterRender();
  growthAfterRender();
};

function growthReviewToolbar() {
  if (
    !["dash", "trades"].includes(tab) ||
    document.getElementById("growth-review-toolbar")
  )
    return;
  const toolbar = document.createElement("div");
  toolbar.id = "growth-review-toolbar";
  toolbar.className = "growth-toolbar";
  toolbar.innerHTML =
    '<button class="b s" onclick="growthOpenReview(\'week\')">Weekly Review</button><button class="b s" onclick="growthOpenReview(\'month\')">Monthly Review</button><button class="b s" onclick="taGo(\'achievements\')">Achievements</button><small>Retrospectiva do período completo, independente dos filtros da página.</small>';
  document.querySelector(".page-top")?.after(toolbar);
  document.querySelectorAll(".diary-entry").forEach((card) => {
    const button = card.querySelector("button[data-id]"),
      id = button?.dataset.id,
      t = S.trades.find((t) => t.id === id);
    if (!t) return;
    const star = document.createElement("button");
    star.className = "b s";
    star.textContent = t.growthFeatured
      ? "Retirar destaque"
      : "Destacar na revisão";
    star.dataset.id = id;
    star.onclick = () => growthToggleHighlight(id);
    card.append(star);
  });
}
function growthToggleHighlight(id) {
  const old = S.trades;
  try {
    S.trades = S.trades.map((t) =>
      t.id === id ? { ...t, growthFeatured: !t.growthFeatured } : t,
    );
    persistState(S);
    R();
  } catch (e) {
    S.trades = old;
    growthError(e);
  }
}
async function growthOpenReview(mode = "week", anchor = null) {
  growthCloseReview();
  const range = GrowthEngine.bounds(
      mode,
      anchor ||
        (mode === "month" && tab === "trades"
          ? diaryMonth + "-01"
          : taDailyDate()),
    ),
    m = GrowthEngine.model(S, range, growthAdapter());
  growthUI.review = {
    m,
    index: 0,
    playing: false,
    elapsed: 0,
    last: 0,
    duration: 5,
    raf: 0,
    hideMoney: true,
    hideName: true,
    screenshots: false,
    narration: false,
    images: [],
    busy: false,
    disposed: false,
  };
  let d = document.getElementById("growth-review-dialog");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "growth-review-dialog";
    d.setAttribute("aria-label", "Smart Review");
    d.addEventListener("close", growthCloseReview);
    document.body.append(d);
  }
  d.innerHTML = `<div class="section-head"><h2>Smart Review</h2><button class="b s" onclick="document.getElementById('growth-review-dialog').close()">Fechar</button></div><div class="growth-review-layout"><div class="growth-screen"><canvas width="1080" height="1920" id="growth-story" aria-hidden="true"></canvas><div class="sr-only" id="growth-story-text" role="status" aria-live="polite"></div></div><div class="growth-review-controls"><p class="muted-note">${esc(range.from)} — ${esc(m.partial ? taDailyDate() : range.to)}${m.partial ? " · parcial" : ""}</p><div class="row"><button class="b s" onclick="growthReviewMove(-1)" aria-label="Cena anterior">‹</button><button class="b" id="growth-play" onclick="growthReviewPlay()">Reproduzir</button><button class="b s" onclick="growthReviewMove(1)" aria-label="Próxima cena">›</button><button class="b s" onclick="growthReviewReplay()">Replay</button></div><progress id="growth-review-progress" max="7" value="0" aria-label="Progresso da retrospectiva"></progress><label>Período<input type="date" id="growth-review-anchor" value="${range.from}" onchange="growthOpenReview('${mode}',this.value)"></label><label class="growth-checkbox"><input id="growth-private-money" type="checkbox" checked onchange="growthReviewPrivacy()"> Ocultar valores monetários</label><label class="growth-checkbox"><input id="growth-private-name" type="checkbox" checked onchange="growthReviewPrivacy()"> Ocultar nome</label><label class="growth-checkbox"><input id="growth-private-screenshots" type="checkbox" disabled onchange="growthReviewPrivacy()"> Incluir prints do diário</label><small class="muted-note">Prints ficam omitidos quando nome ou valores estão ocultos. Eles não são redigidos automaticamente.</small>${growthHasLocalVoice() ? '<button class="b s" id="growth-audio" onclick="growthReviewAudio()">Ativar narração do dispositivo</button>' : "<small>Narração indisponível neste navegador.</small>"}<details><summary>Exportar e compartilhar</summary><p class="muted-note">As opções de privacidade acima se aplicam aos arquivos. Vídeo é exportado sem a narração do dispositivo.</p><button class="b s" onclick="growthExportReviewPNG(false)">PNG desta cena</button><button class="b s" onclick="growthExportReviewPNG(true)">PNG da tela final</button>${navigator.share ? '<button class="b s" onclick="growthShareReview()">Compartilhar tela final</button>' : ""}${growthVideoMime() ? `<button class="b s" id="growth-video" onclick="growthExportReviewVideo()">Exportar vídeo ${growthVideoMime().startsWith("video/mp4") ? "MP4" : "WebM"}</button><button class="b s" id="growth-video-cancel" onclick="growthCancelVideo()" hidden>Cancelar exportação</button>` : "<p>Vídeo indisponível neste navegador. A exportação PNG está disponível.</p>"}</details><div class="growth-reflect-invite"><p>Would you like to reflect on your trading ${mode === "week" ? "week" : "month"}?</p>${m.reflection?.answers?.every((a) => a.trim()) ? '<button class="b s" onclick="growthViewReflection()">Ver reflexão salva</button>' : ""}<button class="b s" onclick="growthStartReflection(${!!(taConnection.authenticated && taConnection.services?.ai)})">${taConnection.authenticated && taConnection.services?.ai ? "Reflect with AI" : "Refletir · análise por regras"}</button><button class="b s" onclick="this.closest('div').hidden=true">Skip for now</button></div><p id="growth-review-message" role="status"></p></div></div>`;
  if (!d.open) d.showModal();
  const current = growthUI.review;
  await growthPrepareImages();
  if (growthUI.review === current && !current.disposed) {
    await growthReviewPaint();
    if (growthUI.review === current && !current.disposed) growthReviewPlay();
  }
}
async function growthPrepareImages() {
  const r = growthUI.review;
  if (!r || !r.screenshots || r.hideMoney || r.hideName) return;
  r.images = await Promise.all(
    r.m.highlights.map((h) => {
      const src = (h.trade.img || []).find((s) =>
        /^data:image\/(png|jpeg|webp|gif);base64,/.test(s),
      );
      return src ? growthLoadImage(src) : null;
    }),
  );
}
async function growthReviewPaint() {
  const r = growthUI.review;
  if (!r || r.disposed) return;
  const canvas = document.getElementById("growth-story");
  if (!canvas) return;
  const content = await growthPaintReview(
    canvas,
    r.m,
    r.index,
    r,
    r.elapsed / r.duration,
    r.images,
  );
  if (growthUI.review !== r) return;
  const narration =
    content.title + ". " + content.lines.join(". ") + ". " + content.footer;
  const text = document.getElementById("growth-story-text");
  if (text.textContent !== narration) text.textContent = narration;
  document.getElementById("growth-review-progress").value =
    r.index + r.elapsed / r.duration;
  document.getElementById("growth-play").textContent = r.playing
    ? "Pausar"
    : "Continuar";
}
function growthReviewFrame(time) {
  const r = growthUI.review;
  if (!r || !r.playing || r.disposed) return;
  if (r.last) r.elapsed += Math.min(0.2, (time - r.last) / 1000);
  r.last = time;
  if (
    r.narration &&
    window.speechSynthesis?.speaking &&
    r.elapsed >= r.duration
  )
    r.elapsed = r.duration - 0.01;
  if (r.elapsed >= r.duration) {
    if (r.index === 6) {
      r.elapsed = r.duration;
      r.playing = false;
      growthReviewPaint();
      return;
    }
    r.index++;
    r.elapsed = 0;
    growthSpeakScene();
  }
  growthReviewPaint();
  r.raf = requestAnimationFrame(growthReviewFrame);
}
function growthReviewPlay() {
  const r = growthUI.review;
  if (!r || r.busy) return;
  r.playing = !r.playing;
  r.last = 0;
  if (r.playing) {
    if (r.index === 6 && r.elapsed >= r.duration) {
      r.index = 0;
      r.elapsed = 0;
    }
    r.raf = requestAnimationFrame(growthReviewFrame);
    growthSpeakScene();
  } else {
    cancelAnimationFrame(r.raf);
    window.speechSynthesis?.cancel();
  }
  growthReviewPaint();
}
function growthReviewMove(delta) {
  const r = growthUI.review;
  if (!r || r.busy) return;
  r.index = Math.max(0, Math.min(6, r.index + delta));
  r.elapsed = 0;
  r.last = 0;
  growthSpeakScene();
  growthReviewPaint();
}
function growthReviewReplay() {
  const r = growthUI.review;
  if (!r || r.busy) return;
  r.index = 0;
  r.elapsed = 0;
  if (!r.playing) growthReviewPlay();
  else {
    r.last = 0;
    growthSpeakScene();
    growthReviewPaint();
  }
}
function growthCloseReview() {
  const r = growthUI.review;
  if (!r) return;
  r.disposed = true;
  r.playing = false;
  cancelAnimationFrame(r.raf);
  growthCancelVideo();
  window.speechSynthesis?.cancel();
  growthUI.review = null;
}
function growthReviewPrivacy() {
  const r = growthUI.review;
  if (!r || r.busy) return;
  r.hideMoney = document.getElementById("growth-private-money").checked;
  r.hideName = document.getElementById("growth-private-name").checked;
  const shots = document.getElementById("growth-private-screenshots");
  shots.disabled = r.hideMoney || r.hideName;
  if (shots.disabled) shots.checked = false;
  r.screenshots = shots.checked;
  if (r.screenshots && !r.images.length)
    growthPrepareImages().then(growthReviewPaint);
  if (!r.screenshots) r.images = [];
  window.speechSynthesis?.cancel();
  growthReviewPaint();
  growthSpeakScene();
}
function growthReviewAudio() {
  const r = growthUI.review;
  if (!r) return;
  r.narration = !r.narration;
  document.getElementById("growth-audio").textContent = r.narration
    ? "Silenciar narração"
    : "Ativar narração do dispositivo";
  if (r.narration) growthSpeakScene();
  else window.speechSynthesis?.cancel();
}
function growthSpeakScene() {
  const r = growthUI.review;
  if (!r?.narration || !r.playing || !growthHasLocalVoice()) return;
  window.speechSynthesis.cancel();
  const scene = growthSceneContent(r.m, r.index, r),
    utterance = new SpeechSynthesisUtterance(
      scene.title + ". " + scene.lines.join(". "),
    );
  utterance.voice =
    speechSynthesis
      .getVoices()
      .find((v) => v.localService && v.lang.startsWith("pt")) ||
    speechSynthesis.getVoices().find((v) => v.localService);
  utterance.lang = utterance.voice?.lang || "pt-BR";
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}
async function growthReviewExportCanvas(final = false) {
  const r = growthUI.review;
  if (!r) throw Error("Abra uma retrospectiva.");
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  await growthPaintReview(canvas, r.m, final ? 6 : r.index, r, 1, r.images);
  return canvas;
}
async function growthExportReviewPNG(final = false) {
  try {
    const r = growthUI.review,
      canvas = await growthReviewExportCanvas(final);
    growthDownload(
      await growthPNG(canvas),
      "SMC-Elite-" +
        r.m.range.key.replace(":", "-") +
        (final ? "-final" : "-scene-" + (r.index + 1)) +
        ".png",
    );
    document.getElementById("growth-review-message").textContent =
      "PNG gerado com as opções de privacidade selecionadas.";
  } catch (e) {
    const node = document.getElementById("growth-review-message");
    if (node) node.textContent = e.message;
  }
}
async function growthShareReview() {
  try {
    const canvas = await growthReviewExportCanvas(true),
      file = new File([await growthPNG(canvas)], "SMC-Elite-review.png", {
        type: "image/png",
      });
    if (navigator.canShare?.({ files: [file] }))
      await navigator.share({
        files: [file],
        title: "SMC Elite · Smart Review",
      });
    else growthDownload(file, file.name);
  } catch (e) {
    if (e.name !== "AbortError")
      document.getElementById("growth-review-message").textContent =
        "Compartilhamento indisponível. Use PNG da tela final.";
  }
}
function growthCancelVideo() {
  const r = growthUI.review;
  if (!r) return;
  r.recordCanceled = true;
  r.recordResolve?.();
  r.recordResolve = null;
  if (r.recorder?.state === "recording") r.recorder.stop();
  r.stream?.getTracks().forEach((t) => t.stop());
  cancelAnimationFrame(r.recordRaf);
}
async function growthExportReviewVideo() {
  const r = growthUI.review;
  if (!r || r.busy) return;
  const mime = growthVideoMime();
  if (!mime) return;
  r.playing = false;
  cancelAnimationFrame(r.raf);
  window.speechSynthesis?.cancel();
  r.busy = true;
  r.recordCanceled = false;
  const inputs = document.querySelectorAll(
    "#growth-review-dialog input,#growth-play,#growth-video",
  );
  inputs.forEach((e) => (e.disabled = true));
  document.getElementById("growth-video-cancel").hidden = false;
  const message = document.getElementById("growth-review-message"),
    canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const chunks = [];
  try {
    await growthPaintReview(canvas, r.m, 0, r, 0, r.images);
    if (r.recordCanceled || r.disposed) return;
    r.stream = canvas.captureStream(24);
    r.recorder = new MediaRecorder(r.stream, {
      mimeType: mime,
      videoBitsPerSecond: 6000000,
    });
    r.recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const stopped = new Promise((resolve, reject) => {
      r.recorder.onstop = resolve;
      r.recorder.onerror = () => {
        r.recordCanceled = true;
        r.recordResolve?.();
        reject(Error("O navegador não conseguiu gravar o vídeo. Use PNG."));
      };
    });
    stopped.catch(() => {});
    await new Promise((resolve) => {
      r.recordResolve = resolve;
      r.recorder.onstart = resolve;
      r.recorder.start(500);
    });
    if (r.recordCanceled || r.disposed) return;
    r.stream.getVideoTracks()[0]?.requestFrame?.();
    const start = performance.now();
    await new Promise((resolve, reject) => {
      r.recordResolve = resolve;
      const frame = async (now) => {
        try {
          if (r.recordCanceled || r.disposed) {
            resolve();
            return;
          }
          const elapsed = (now - start) / 1000,
            index = Math.min(6, Math.floor(elapsed / r.duration));
          await growthPaintReview(
            canvas,
            r.m,
            index,
            r,
            Math.min(1, (elapsed % r.duration) / r.duration),
            r.images,
          );
          r.stream.getVideoTracks()[0]?.requestFrame?.();
          if (message)
            message.textContent =
              "Gerando vídeo " +
              Math.min(100, Math.round((elapsed / (r.duration * 7)) * 100)) +
              "% · mantenha esta aba aberta.";
          if (elapsed >= r.duration * 7) {
            r.recorder.stop();
            resolve();
          } else r.recordRaf = requestAnimationFrame(frame);
        } catch (e) {
          reject(e);
        }
      };
      r.recordRaf = requestAnimationFrame(frame);
    });
    await stopped;
    if (!r.recordCanceled && !r.disposed) {
      const blob = new Blob(chunks, { type: r.recorder.mimeType || mime });
      if (!blob.size) throw Error("Nenhum vídeo foi gerado. Use PNG.");
      growthDownload(
        blob,
        "SMC-Elite-" +
          r.m.range.key.replace(":", "-") +
          (mime.startsWith("video/mp4") ? ".mp4" : ".webm"),
      );
      message.textContent =
        "Vídeo gerado, sem narração. Privacidade preservada conforme as opções selecionadas.";
    } else if (message)
      message.textContent =
        "Exportação cancelada; nenhum arquivo foi compartilhado.";
  } catch (e) {
    if (message) message.textContent = e.message;
  } finally {
    r.stream?.getTracks().forEach((t) => t.stop());
    if (r.recorder?.state === "recording") r.recorder.stop();
    r.busy = false;
    r.recordResolve = null;
    inputs.forEach((e) => (e.disabled = false));
    const button = document.getElementById("growth-video-cancel");
    if (button) button.hidden = true;
    if (growthUI.review === r) growthReviewPrivacy();
  }
}
function growthReflectionReport(m, answers) {
  const assessed = m.process.plan;
  return {
    strength:
      assessed.value !== null
        ? `${growthNum(assessed.value, 0)}% de aderência declarada em ${assessed.n}/${m.rows.length} operações avaliadas.`
        : `${m.rows.length} operações e ${m.emotional.logs.length} check-ins disponíveis para revisão.`,
    difficulty: answers[1]?.trim()
      ? "Desafio informado: " + answers[1].trim()
      : "Registre seu maior desafio para contextualizar este período.",
    pattern: m.emotional.top
      ? `${GrowthEngine.emotions[m.emotional.top][0]} apareceu em ${m.emotional.freq[m.emotional.top]} check-ins. Isso é uma frequência registrada, sem conclusão causal.`
      : "Sem dados emocionais suficientes para identificar recorrência.",
    priority: answers[2]?.trim()
      ? "Sua prioridade: " + answers[2].trim()
      : m.priority,
  };
}
function growthStartReflection(withAI = false) {
  const r = growthUI.review;
  if (!r) return;
  r.playing = false;
  cancelAnimationFrame(r.raf);
  window.speechSynthesis?.cancel();
  growthUI.reflection = {
    range: r.m.range,
    m: r.m,
    answers: [
      ...(growthData().reflections[r.m.range.key]?.answers || ["", "", ""]),
    ],
    step: 0,
    withAI,
  };
  growthReflectionStep();
}
function growthReflectionStep() {
  const f = growthUI.reflection;
  if (!f) return;
  const questions = [
    "How did you feel about your trading this " +
      (f.range.mode === "week" ? "week" : "month") +
      "?",
    "What was your biggest challenge?",
    "What would you like to improve next " +
      (f.range.mode === "week" ? "week" : "month") +
      "?",
  ];
  growthDialog(
    "Reflect · " + (f.step + 1) + " de 3",
    `<p>${questions[f.step]}</p><form id="growth-reflection-form"><label>Resposta curta<textarea id="growth-reflection-answer" maxlength="400" required>${esc(f.answers[f.step])}</textarea></label><div class="row">${(f.step === 0 ? ["Calmo e focado", "Oscilei durante a sessão", "Prefiro descrever"] : f.step === 1 ? ["Esperar critérios", "Respeitar o risco", "Lidar com FOMO"] : ["Seguir meu plano", "Pausar antes de agir", "Registrar melhor"]).map((text) => `<button class="b s" type="button" data-text="${esc(text)}" onclick="document.getElementById('growth-reflection-answer').value=this.dataset.text">${text}</button>`).join("")}</div><p class="muted-note">${f.withAI ? "Ao concluir, suas respostas curtas, plano e fatos agregados serão enviados à integração de IA existente. Prints não serão enviados." : "Análise local por regras transparentes; não é uma resposta gerada por IA."}</p><button class="b" type="submit">${f.step < 2 ? "Próxima" : "Salvar reflexão"}</button><button class="b s" type="button" onclick="document.getElementById('growth-dialog').close()">Skip for now</button></form>`,
  );
  document.getElementById("growth-reflection-form").onsubmit = (e) => {
    e.preventDefault();
    f.answers[f.step] = document
      .getElementById("growth-reflection-answer")
      .value.trim();
    if (!f.answers[f.step]) return;
    try {
      growthCommit((g) => {
        g.reflections[f.range.key] = {
          ...(g.reflections[f.range.key] || {}),
          answers: [...f.answers],
          range: f.range,
          updatedAt: new Date().toISOString(),
          method: "rules",
        };
      }, false);
      if (f.step < 2) {
        f.step++;
        growthReflectionStep();
      } else growthFinishReflection();
    } catch (error) {
      growthError(error);
    }
  };
}
function growthReflectionInput(f) {
  const report = growthReflectionReport(f.m, f.answers);
  return {
    plan: taCurrentPlan(),
    profile: taProfile(),
    facts: [
      {
        id: "period",
        text:
          f.range.from +
          " até " +
          f.range.to +
          "; " +
          f.m.rows.length +
          " operações.",
      },
      { id: "plan", text: report.strength },
      { id: "emotion", text: report.pattern },
      { id: "priority", text: f.m.priority },
    ],
    question:
      "Reflexão pessoal, sem diagnósticos e sem atribuir perdas a emoções. Respostas do usuário: " +
      JSON.stringify(f.answers).slice(0, 1250),
  };
}
function growthFinishReflection() {
  const f = growthUI.reflection,
    report = growthReflectionReport(f.m, f.answers);
  growthDialog(
    "Sua reflexão",
    `<p class="badge">Análise por regras · salva neste período</p>${[
      ["Pontos fortes", report.strength],
      ["Dificuldade informada", report.difficulty],
      ["Padrão registrado", report.pattern],
      ["Próximo foco", report.priority],
    ]
      .map(([title, text]) => `<h3>${title}</h3><p>${esc(text)}</p>`)
      .join("")}<div id="growth-reflection-ai"></div>`,
  );
  if (f.withAI) growthReflectionAI(f);
  if (typeof growthReconcile === "function") growthReconcile();
}
async function growthReflectionAI(f) {
  const node = document.getElementById("growth-reflection-ai");
  if (!node) return;
  node.textContent = "Consultando a integração de IA…";
  const input = growthReflectionInput(f),
    key = JSON.stringify(input);
  try {
    const result = await taApi("/api/briefing", {
        method: "POST",
        body: JSON.stringify(input),
      }),
      ids = new Set(input.facts.map((x) => x.id));
    if (
      typeof result.action !== "string" ||
      !Array.isArray(result.facts) ||
      result.facts.some((x) => !ids.has(x.id))
    )
      throw Error("Resposta inválida da integração.");
    growthCommit((g) => {
      const entry = g.reflections[f.range.key];
      if (entry && JSON.stringify(entry.answers) === JSON.stringify(f.answers))
        entry.ai = {
          action: result.action,
          key,
          asOf: result.asOf || new Date().toISOString(),
        };
    }, false);
    if (node.isConnected)
      node.textContent = "Orientação da IA: " + result.action;
  } catch (e) {
    if (node.isConnected)
      node.textContent = e.message + " A reflexão por regras foi preservada.";
  }
}

function growthFingerprint(value) {
  let hash = 2166136261;
  const text = JSON.stringify(value);
  for (let i = 0; i < text.length; i++)
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
function growthAchievementKey() {
  const g = growthData();
  return growthFingerprint([
    taDailyDate(),
    taProfile().timezone,
    taCurrentPlan()?.risk.minRR,
    insRules(),
    S.trades.map((t) => [
      t.id,
      t.close,
      t.pnl,
      t.risk,
      t.plannedRR,
      t.est,
      t.importSource,
      t.behavior,
      !!t.notes?.trim(),
      !!t.feelings?.trim(),
      !!t.emotion,
      !!t.lesson?.trim(),
    ]),
    g.checkins.map((l) => [
      l.id,
      l.at,
      l.date,
      l.timezone,
      l.emotion,
      l.sessionKey,
      l.tradeId,
      l.decision,
    ]),
    g.decisions.map((d) => [
      d.id,
      d.at,
      d.date,
      d.kind,
      d.planId,
      !!d.note?.trim(),
    ]),
    g.reflections,
    g.rules,
    g.certificates.map((c) => [
      c.id,
      c.achievementId,
      c.range,
      c.config,
      c.status,
    ]),
  ]);
}
function growthAchievements() {
  const key = growthAchievementKey();
  if (growthUI.evaluationKey !== key) {
    growthUI.evaluation = GrowthEngine.allAchievements(S, growthAdapter());
    growthUI.evaluationKey = key;
  }
  return growthUI.evaluation;
}
function growthReconcile() {
  if (CLOUD_BOOT && !eliteCloud.ready) return;
  const key = growthAchievementKey();
  if (growthUI.reconciledKey === key) return;
  growthUI.reconciledKey = key;
  try {
    const reconciled = GrowthEngine.reconcile(S, growthAdapter()),
      earned = growthAchievements().filter((a) => a.earned),
      newAwards = earned.filter(
        (a) =>
          !growthData().announced[
            a.id +
              "|" +
              a.range.from +
              "|" +
              a.range.to +
              "|" +
              growthFingerprint(a.config)
          ],
      );
    if (reconciled.changed || newAwards.length)
      growthCommit((g) => {
        if (reconciled.changed) g.certificates = reconciled.certificates;
        for (const a of newAwards)
          g.announced[
            a.id +
              "|" +
              a.range.from +
              "|" +
              a.range.to +
              "|" +
              growthFingerprint(a.config)
          ] = new Date().toISOString();
      }, false);
    if (newAwards.length) {
      growthUI.toast = newAwards
        .map((a) => a.name)
        .slice(0, 2)
        .join(" · ");
      let toast = document.getElementById("growth-award-toast");
      if (!toast) {
        toast = document.createElement("div");
        toast.id = "growth-award-toast";
        toast.className = "growth-award-toast";
        toast.setAttribute("role", "status");
        document.querySelector(".reference-topbar")?.after(toast);
      }
      toast.innerHTML = `<span>Achievement Unlocked · ${esc(growthUI.toast)}</span><button class="b s" onclick="taGo('achievements')">Ver conquistas</button><button class="b s" onclick="this.closest('div').remove()" aria-label="Dispensar reconhecimento">×</button>`;
    }
  } catch (e) {
    growthUI.reconciledKey = null;
    console.warn("Não foi possível atualizar as conquistas locais.");
  }
}
function growthRuleForm() {
  const r = growthData().rules,
    fields = [
      ["rrTarget", "Registros com R:R respeitado", 1, 1000],
      ["minRR", "R:R mínimo (vazio usa o plano)", 0.1, 10000],
      ["planDays", "Plan Commitment · dias operados", 1, 365],
      ["disciplineThreshold", "Discipline Master · aderência %", 1, 100],
      ["minMonthlyTrades", "Amostra mínima por mês", 5, 1000],
      ["riskDays", "Risk Guardian · dias operados", 1, 365],
      ["journalDays", "Journal Consistency · dias completos", 1, 365],
      ["emotionalSessions", "Emotional Awareness · sessões", 1, 365],
      ["selectiveDays", "Selective Trader · dias com decisão", 1, 365],
      ["selfControlSessions", "Self-Control · sessões documentadas", 1, 365],
      ["reflectWeeks", "Reflective Trader · semanas consecutivas", 1, 52],
      ["mindsetMinTrades", "Mindset · amostra por semana", 5, 1000],
      ["mindsetImprovement", "Mindset · melhora em pontos percentuais", 1, 100],
    ];
  return `<details class="card growth-rules"><summary>Critérios e metas pessoais</summary><p>Reconhecimento é consequência dos registros, não motivo para operar mais. Alterar uma regra não reescreve os critérios de certificados já emitidos.</p><form onsubmit="growthSaveRules(event)"><div class="growth-form-grid">${fields.map(([key, label, min, max]) => `<label>${label}<input name="${key}" type="number" min="${min}" max="${max}" step="${key === "minRR" ? ".1" : "1"}" value="${r[key] ?? ""}" ${key === "minRR" ? "" : "required"}></label>`).join("")}</div><p id="growth-rules-status" role="status"></p><button class="b s" type="submit">Salvar critérios</button></form></details>`;
}
function growthSaveRules(e) {
  e.preventDefault();
  const f = new FormData(e.target),
    rules = {};
  for (const key of Object.keys(GrowthEngine.defaults)) {
    const value = f.get(key);
    rules[key] = key === "minRR" && !value ? null : Number(value);
  }
  const normalized = GrowthEngine.normalise({ rules }).rules;
  if (Object.keys(rules).some((k) => rules[k] !== normalized[k])) {
    document.getElementById("growth-rules-status").textContent =
      "Confira os limites e as amostras mínimas de cada regra.";
    return;
  }
  try {
    growthCommit((g) => {
      g.rules = normalized;
    });
    document.getElementById("growth-rules-status").textContent =
      "Critérios salvos; progresso recalculado.";
  } catch (error) {
    growthError(error);
  }
}
function vGrowthAchievements() {
  growthReconcile();
  const all = growthAchievements(),
    category = growthUI.achievementCategory || "process",
    categories = {
      finance: ["consistent", "quarterly"],
      process: ["rr", "plan", "discipline", "risk", "selective", "journal"],
      routine: ["awareness", "mindset", "control", "reflect"],
    },
    shown = all.filter((a) => categories[category].includes(a.id)),
    certs = growthData().certificates;
  return `<section class="card"><div class="eyebrow">Reconhecimento pessoal</div><h2>Achievements</h2><p>Evolução registrada, com critérios verificáveis. Sem aumentar risco ou frequência para cumprir metas.</p><div class="growth-category" role="group" aria-label="Categorias de conquistas">${[
    ["finance", "Financeiras"],
    ["process", "Execução e diário"],
    ["routine", "Consciência e reflexão"],
  ]
    .map(
      ([id, label]) =>
        `<button class="b s" aria-pressed="${category === id}" onclick="growthUI.achievementCategory='${id}';R()">${label}</button>`,
    )
    .join(
      "",
    )}</div><label>Nome no certificado (opcional)<input id="growth-certificate-name" maxlength="100" value="${esc(growthData().certificateName ?? (CLOUD_BOOT ? eliteCloud.user?.name : taProfile().name) ?? "")}" placeholder="Como deseja ser identificado"></label></section><div class="growth-achievement-grid">${shown.map((a) => `<article class="card growth-achievement ${a.earned ? "earned" : ""}"><div class="section-head"><span class="growth-medal" aria-hidden="true">${terminalIcon("award")}</span><span class="badge">${a.earned ? "Elegível · " + esc(a.range.to) : "Em desenvolvimento"}</span></div><h3>${a.name}</h3><p>${a.description}</p><progress max="100" value="${a.progress}" aria-label="Progresso de ${a.name}"></progress><small>${growthNum(a.value)} / ${growthNum(a.target)} · ${esc(a.source)}</small><details><summary>Ver critérios</summary><p>${esc(a.note)}</p><p>Período: ${esc(a.range.from)} — ${esc(a.range.to)}.</p><small>Regra v${a.ruleVersion}; dados ausentes não comprovam cumprimento.</small></details>${a.earned ? `<button class="b s" data-id="${a.id}" onclick="growthIssueCertificate(this.dataset.id)">Visualizar certificado</button>` : ""}</article>`).join("")}</div>${growthRuleForm()}<details class="card growth-cert-history"><summary>Histórico de certificados (${certs.length})</summary>${
    certs.length
      ? [...certs]
          .reverse()
          .map(
            (c) =>
              `<article class="growth-log"><b>${esc(GrowthEngine.definitions.find((d) => d[0] === c.achievementId)?.[1] || "Registro de conquista")}</b><small>${esc(c.range?.from || "")} — ${esc(c.range?.to || "")} · ${esc(c.issuedAt ? smcDate(c.issuedAt) : "")}</small><p class="${c.status === "invalidated" ? "r" : ""}">${c.status === "valid" ? "Critérios mantidos nos registros atuais" : "Invalidado após correção do histórico"}</p><button class="b s" data-id="${esc(c.id)}" onclick="growthViewCertificate(this.dataset.id)">Ver registro</button></article>`,
          )
          .join("")
      : "<p>Nenhum certificado emitido. As conquistas elegíveis aparecem na galeria.</p>"
  }</details><p class="muted-note">Certificados de realização pessoal do SMC Elite. Não são acreditações profissionais externas, auditoria de corretora ou avaliações psicológicas.</p>`;
}
function growthIssueCertificate(id) {
  try {
    const a = GrowthEngine.assess(S, id, growthAdapter());
    if (!a.earned)
      throw Error("Os critérios não estão atendidos nos registros atuais.");
    const holderName = String(
        document.getElementById("growth-certificate-name")?.value || "",
      )
        .trim()
        .slice(0, 100),
      key =
        id +
        "|" +
        a.range.from +
        "|" +
        a.range.to +
        "|" +
        growthFingerprint(a.config);
    let certificate = growthData().certificates.find((c) => c.key === key);
    if (!certificate) {
      const rows = insUniverse().filter(
          (t) => day(t) >= a.range.from && day(t) <= a.range.to,
        ),
        imported = rows.length && rows.every((t) => t.importSource && !t.est);
      certificate = {
        id: "SMC-" + crypto.randomUUID().toUpperCase(),
        key,
        achievementId: id,
        range: a.range,
        config: { ...a.config, insightRules: insRules() },
        ruleVersion: a.ruleVersion,
        description: a.description,
        criterion: a.note,
        source: ["consistent", "quarterly"].includes(id)
          ? imported
            ? "Calculado sobre histórico importado; sem auditoria externa."
            : "Calculado sobre registros do usuário; sem auditoria externa."
          : a.source + "; sem validação independente.",
        holderName,
        issuedAt: new Date().toISOString(),
        timezone: taProfile().timezone,
        status: "valid",
      };
      growthCommit((g) => {
        g.certificates.push(certificate);
        g.certificateName = holderName;
      }, false);
    }
    growthViewCertificate(certificate.id);
  } catch (e) {
    growthError(e);
  }
}
function growthViewCertificate(id) {
  growthReconcile();
  const c = growthData().certificates.find((c) => c.id === id);
  if (!c) return;
  growthUI.cert = { id, hideName: true };
  const d = growthDialog(
    "Certificate of Achievement",
    `<canvas id="growth-certificate-canvas" width="2400" height="1697" aria-label="Certificado pessoal ${esc(c.description)}"></canvas><p class="${c.status === "invalidated" ? "r" : "muted-note"}">${c.status === "invalidated" ? "Registro invalidado: " + esc(c.reason || "critérios não atendidos") : "Reconhecimento pessoal; dados importados ou declarados conforme a fonte indicada."}</p><label class="growth-checkbox"><input type="checkbox" checked id="growth-certificate-private" onchange="growthUI.cert.hideName=this.checked;growthPaintCertificatePreview()"> Ocultar nome na exportação</label><div class="row"><button class="b s" onclick="growthExportCertificate('png')">Exportar PNG</button><button class="b s" onclick="growthExportCertificate('pdf')">Exportar PDF</button>${navigator.share ? '<button class="b s" onclick="growthShareCertificate()">Compartilhar PNG</button>' : ""}</div><p class="muted-note">O certificado não inclui saldo, valores financeiros, prints ou diário. O código é apenas um identificador interno, sem validação externa.</p>`,
  );
  d.classList.add("growth-certificate-dialog");
  growthPaintCertificatePreview();
}
async function growthPaintCertificatePreview() {
  const c = growthData().certificates.find((c) => c.id === growthUI.cert?.id),
    canvas = document.getElementById("growth-certificate-canvas");
  if (c && canvas)
    await growthPaintCertificate(canvas, c, growthUI.cert.hideName);
}
async function growthCertificateExportCanvas() {
  growthReconcile();
  const c = growthData().certificates.find((c) => c.id === growthUI.cert?.id);
  if (!c) throw Error("Certificado não encontrado.");
  const canvas = document.createElement("canvas");
  canvas.width = 2400;
  canvas.height = 1697;
  await growthPaintCertificate(canvas, c, growthUI.cert.hideName);
  return { canvas, c };
}
async function growthExportCertificate(format) {
  try {
    const { canvas, c } = await growthCertificateExportCanvas();
    growthDownload(
      format === "pdf" ? growthPDF(canvas) : await growthPNG(canvas),
      c.id + "." + format,
    );
    document.querySelector("#growth-dialog [role=status]").textContent =
      "Arquivo gerado com o status e as opções atuais.";
  } catch (e) {
    growthError(e);
  }
}
async function growthShareCertificate() {
  try {
    const { canvas, c } = await growthCertificateExportCanvas(),
      file = new File([await growthPNG(canvas)], c.id + ".png", {
        type: "image/png",
      });
    if (navigator.canShare?.({ files: [file] }))
      await navigator.share({
        files: [file],
        title: "SMC Elite · Personal Trading Achievement",
      });
    else growthDownload(file, file.name);
  } catch (e) {
    if (e.name !== "AbortError") growthError(e);
  }
}

if (!tabs.some(([id]) => id === "achievements"))
  tabs.push(["achievements", "Achievements"]);

function growthHasLocalVoice() {
  return (
    !!window.speechSynthesis &&
    speechSynthesis.getVoices().some((v) => v.localService)
  );
}
document.addEventListener("visibilitychange", () => {
  const r = growthUI.review;
  if (document.hidden && r) {
    if (r.busy) growthCancelVideo();
    r.playing = false;
    cancelAnimationFrame(r.raf);
    window.speechSynthesis?.cancel();
    growthReviewPaint();
  }
});

function growthViewReflection() {
  const r = growthUI.review;
  if (!r) return;
  const saved = growthData().reflections[r.m.range.key];
  if (!saved) return;
  r.playing = false;
  cancelAnimationFrame(r.raf);
  window.speechSynthesis?.cancel();
  growthUI.reflection = {
    range: r.m.range,
    m: GrowthEngine.model(S, r.m.range, growthAdapter()),
    answers: [...saved.answers],
    step: 0,
    withAI: false,
  };
  growthFinishReflection();
  if (saved.ai) {
    const node = document.getElementById("growth-reflection-ai");
    node.textContent =
      saved.ai.key ===
      JSON.stringify(growthReflectionInput(growthUI.reflection))
        ? "Orientação da IA salva: " + saved.ai.action
        : "A orientação de IA anterior foi arquivada; os registros mudaram. A análise por regras acima está atualizada.";
  }
}
