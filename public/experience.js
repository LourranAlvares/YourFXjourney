/* One contextual message, one operational focus. No chat or automatic AI calls. */
const experienceUI = {
  currentKey: null,
  model: null,
  cache: null,
  cacheKey: null,
  presenceTimer: null,
};
function experiencePresented() {
  const key = K + ":assistant-presented";
  if (experienceUI.cacheKey === key) return experienceUI.cache || [];
  experienceUI.cacheKey = key;
  try {
    const rows = JSON.parse(localStorage.getItem(key) || "[]");
    experienceUI.cache = Array.isArray(rows)
      ? rows
          .filter(
            (v) =>
              v &&
              typeof v.key === "string" &&
              Number.isFinite(Date.parse(v.at)),
          )
          .slice(-60)
      : [];
  } catch {
    experienceUI.cache = [];
  }
  return experienceUI.cache;
}
function experienceContext() {
  const today = taDailyDate(),
    from = PanelEngine.bounds("week", today).from,
    previousFrom = PanelEngine.shift(from, -7),
    previousTo = PanelEngine.shift(today, -7),
    prefs = ExperienceEngine.prefs(S),
    all = insUniverse()
      .filter((t) => day(t) <= today)
      .sort((a, b) => a.close.localeCompare(b.close)),
    accounts = [...new Set(all.map(PanelEngine.account))],
    rows =
      prefs.history && (accounts.length <= 1 || S.accountId)
        ? all.filter(
            (t) => !S.accountId || PanelEngine.account(t) === S.accountId,
          )
        : [],
    weekRows = rows.filter((t) => day(t) >= from),
    oldRows = rows.filter(
      (t) => day(t) >= previousFrom && day(t) <= previousTo,
    ),
    plan = taCurrentPlan(),
    required = plan?.criteria?.find(
      (c) => c.required && c.role !== "invalidation",
    ),
    process = (ts) => panelProcess(ts),
    achievements = prefs.goals
      ? growthAchievements().filter(
          (a) =>
            a.earned &&
            a.range.to <= today &&
            a.range.to >= PanelEngine.shift(today, -7),
        )
      : [];
  return {
    today,
    now: new Date().toISOString(),
    rows: rows.slice(-25),
    hasAnyHistory: all.length > 0,
    hasPlan: !!plan,
    planId: plan?.id || "",
    planFocus: required
      ? `Confira seu critério: ${required.definition || required.label}.`
      : plan
        ? "Siga os limites e as condições registrados no seu Plano de Trading."
        : "Vamos começar definindo como você opera no seu Plano de Trading.",
    session: taDailySession(),
    week: { rows: weekRows, s: st(weekRows), process: process(weekRows) },
    previous: { rows: oldRows, s: st(oldRows), process: process(oldRows) },
    checks: process(rows.slice(-25)).checked,
    weekKey: from + "|" + today,
    achievement: achievements[0] || null,
    presented: experiencePresented(),
    currentKey: experienceUI.currentKey,
  };
}
function experienceModel() {
  const model = ExperienceEngine.select(S, experienceContext());
  experienceUI.currentKey = model.key;
  experienceUI.model = model;
  return model;
}
function experienceSpeech() {
  const m = experienceModel();
  return `<div class="experience-speech" data-message="${esc(m.type)}"><small>SMC Elite Assistant</small><p>${esc(m.message)}</p><div><button class="scene-link" onclick="experienceOrigin()">Origem da observação ${terminalIcon("open")}</button><button class="scene-link" onclick="experiencePreferencesOpen()" aria-label="Preferências de personalização">${terminalIcon("settings")}</button></div></div>`;
}
function experienceOrigin() {
  const m = experienceUI.model || experienceModel();
  growthDialog(
    "Origem da observação",
    `<p>${esc(m.message)}</p>${m.evidence.map((e) => `<article class="growth-log"><b>${esc(e.source)}</b><p>${esc(e.text)}</p></article>`).join("")}<p class="muted-note">${esc(m.method)} Comparações de aderência exigem pelo menos cinco operações avaliadas em cada período. Sequências de resultado não são avaliações psicológicas.</p><button class="b s" data-target="${m.target}" onclick="document.getElementById('growth-dialog').close();taGo(this.dataset.target)">Abrir registros relacionados</button><p class="muted-note">Mensagens apresentadas são lembradas neste navegador, por conta. O histórico de trading continua no armazenamento pessoal existente.</p>`,
  );
}
function experiencePreferenceView() {
  const p = ExperienceEngine.prefs(S);
  return `<details class="card experience-preferences" id="experience-preferences"><summary>Personalização do assistente</summary><p>Controle os dados usados na mensagem pessoal da Home. Isso não remove seu diário, relatórios ou conquistas.</p><form onsubmit="experienceSavePreferences(event)"><label class="growth-checkbox"><input name="history" type="checkbox" ${p.history ? "checked" : ""}> Usar histórico e avaliações do plano</label><label class="growth-checkbox"><input name="emotions" type="checkbox" ${p.emotions ? "checked" : ""}> Usar check-ins emocionais informados</label><label class="growth-checkbox"><input name="goals" type="checkbox" ${p.goals ? "checked" : ""}> Reconhecer objetivos verificados nos registros</label><button class="b s" type="submit">Salvar preferências</button><p id="experience-preference-status" role="status"></p></form><button class="b s" onclick="experienceClearPresented()">Limpar memória de mensagens deste navegador</button><p class="muted-note">A seleção local não exige IA. A integração de IA só é consultada quando você solicita, respeitando estas escolhas. Não há consulta externa automática ao abrir a Home.</p></details>`;
}
function experienceSavePreferences(event) {
  event.preventDefault();
  const f = new FormData(event.target),
    old = S.assistantExperience;
  try {
    S.assistantExperience = {
      ...(old || {}),
      preferences: {
        history: f.get("history") === "on",
        emotions: f.get("emotions") === "on",
        goals: f.get("goals") === "on",
      },
    };
    persistState(S);
    experienceUI.currentKey = null;
    R();
    document.getElementById("experience-preferences").open = true;
    document.getElementById("experience-preference-status").textContent =
      "Preferências salvas.";
  } catch (e) {
    S.assistantExperience = old;
    document.getElementById("experience-preference-status").textContent =
      e.message;
  }
}
function experiencePreferencesOpen() {
  taGo("settings");
  const node = document.getElementById("experience-preferences");
  if (node) {
    node.open = true;
    node.scrollIntoView({ block: "center" });
  }
}
function experienceClearPresented() {
  experienceUI.cache = [];
  experienceUI.currentKey = null;
  try {
    localStorage.removeItem(K + ":assistant-presented");
  } catch {}
  const node = document.getElementById("experience-preference-status");
  if (node)
    node.textContent =
      "Memória de mensagens limpa neste navegador. Seu histórico foi preservado.";
}
function experienceAfterRender() {
  if (tab !== "home") {
    experienceUI.currentKey = null;
  } else if (experienceUI.model && document.visibilityState === "visible") {
    const m = experienceUI.model,
      cache = experiencePresented();
    if (!cache.some((v) => v.key === m.key)) {
      experienceUI.cache = [
        ...cache,
        { key: m.key, type: m.type, at: new Date().toISOString() },
      ].slice(-60);
      try {
        localStorage.setItem(
          experienceUI.cacheKey,
          JSON.stringify(experienceUI.cache),
        );
      } catch {}
    }
  }
  if (tab === "settings" && !document.getElementById("experience-preferences"))
    document
      .getElementById("main")
      .insertAdjacentHTML("beforeend", experiencePreferenceView());
}
const experiencePreviousAfterRender = terminalAfterRender;
terminalAfterRender = function () {
  experiencePreviousAfterRender();
  experienceAfterRender();
};
const experienceOriginalBriefingInput = taBriefingInput;
taBriefingInput = function () {
  const input = experienceOriginalBriefingInput(),
    prefs = ExperienceEngine.prefs(S);
  if (!prefs.history)
    input.facts = input.facts.filter((f) =>
      ["session", "active-plan", "live-availability"].includes(f.id),
    );
  input.facts = input.facts.map((f) =>
    f.id === "period-returns"
      ? {
          ...f,
          text: f.text.replace(
            "Sem depósitos/saques;",
            PanelEngine.movements(S).length
              ? "Movimentos de capital registrados entram no denominador por Modified Dietz;"
              : "Sem movimentos de capital registrados;",
          ),
        }
      : f,
  );
  const model = experienceModel();
  if (model.evidence.length)
    input.facts.push({
      id: "assistant-context",
      text: (
        model.evidence.map((e) => e.text).join(" ") +
        " " +
        model.method
      ).slice(0, 1000),
    });
  return input;
};
document.addEventListener("pointerdown", (event) => {
  const desk = event.target.closest(".smc-desk");
  if (!desk || !event.target.closest("button")) return;
  desk.dataset.presence = "attention";
  clearTimeout(experienceUI.presenceTimer);
  experienceUI.presenceTimer = setTimeout(() => {
    if (desk.isConnected) desk.dataset.presence = "idle";
  }, 1400);
});
