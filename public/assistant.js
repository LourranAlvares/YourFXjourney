/* Trade Assistant workspace. Additive store fields; original yfx1 records stay intact. */
let taConnection = { available: false, authenticated: false, services: {} },
  taCsrf = "",
  taStatusChecked = false;
let taAnalyst = {
  image: null,
  imageName: "",
  result: null,
  pending: false,
  error: "",
  requestId: 0,
  context: {
    asset: "",
    timeframe: "",
    bias: "",
    macroContext: "",
    entryRegion: "",
    plannedRR: null,
    plannedRisk: null,
  },
};
function taProfile() {
  const raw =
      S.assistantProfile && typeof S.assistantProfile === "object"
        ? S.assistantProfile
        : {},
    timezone =
      typeof raw.timezone === "string" && taZoneValid(raw.timezone)
        ? raw.timezone
        : Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London",
    r = raw.session || {},
    validZone = typeof r.timezone === "string" && taZoneValid(r.timezone),
    validHours =
      /^([01]\d|2[0-3]):[0-5]\d$/.test(r.start || "") &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(r.end || ""),
    days = Array.isArray(r.days)
      ? r.days.filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
      : [1, 2, 3, 4, 5];
  return {
    name: typeof raw.name === "string" ? raw.name.slice(0, 60) : "",
    timezone,
    session: {
      enabled: r.enabled === true && validZone && validHours && days.length > 0,
      label: typeof r.label === "string" ? r.label : "Londres",
      timezone: validZone ? r.timezone : "Europe/London",
      start: validHours ? r.start : "08:00",
      end: validHours ? r.end : "11:00",
      days,
    },
    instruments: Array.isArray(raw.instruments)
      ? raw.instruments.filter((x) => typeof x === "string").slice(0, 20)
      : [],
    newsBeforeMinutes:
      Number.isInteger(raw.newsBeforeMinutes) &&
      raw.newsBeforeMinutes >= 0 &&
      raw.newsBeforeMinutes <= 240
        ? raw.newsBeforeMinutes
        : 15,
    newsAfterMinutes:
      Number.isInteger(raw.newsAfterMinutes) &&
      raw.newsAfterMinutes >= 0 &&
      raw.newsAfterMinutes <= 240
        ? raw.newsAfterMinutes
        : 15,
  };
}
function taPlans() {
  return Array.isArray(S.tradingPlans) ? S.tradingPlans : [];
}
function taCurrentPlan() {
  const current = taPlans().at(-1);
  if (!current) return null;
  try {
    return TradePlanEngine.validatePlan(current);
  } catch {
    return null;
  }
}
function taPersist(patch) {
  const next = { ...S, ...patch };
  try {
    localStorage.setItem(K, JSON.stringify(next));
    S = next;
    return true;
  } catch (e) {
    alert(
      "Não foi possível salvar no navegador. Exporte um backup e libere espaço; os dados anteriores foram mantidos.",
    );
    return false;
  }
}
function taGo(next) {
  tab = next;
  R();
}
async function taApi(path, options = {}) {
  if (location.protocol === "file:") {
    const error = new Error(
      "Abra a versão com servidor para conectar IA e dados ao vivo. O modo offline mantém plano, diário e revisão manual.",
    );
    error.status = 503;
    error.code = "file_mode";
    throw error;
  }
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 65000);
  try {
    const response = await fetch(path, {
      ...options,
      credentials: "same-origin",
      signal: controller.signal,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.method && options.method !== "GET"
          ? { "X-CSRF-Token": taCsrf }
          : {}),
        ...(options.headers || {}),
      },
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(
        "O servidor de integrações não está disponível nesta origem.",
      );
    }
    if (!response.ok) {
      if (response.status === 401) taConnection.authenticated = false;
      const error = new Error(
        data.error?.message ||
          data.error ||
          data.message ||
          "A integração não respondeu.",
      );
      error.status = response.status;
      error.code = data.error?.code || "backend_unavailable";
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}
async function taCheckConnection() {
  if (taStatusChecked) return;
  taStatusChecked = true;
  try {
    const s = await taApi("/api/status");
    if (
      typeof s.authenticated !== "boolean" ||
      typeof s.authConfigured !== "boolean" ||
      !s.services ||
      typeof s.services !== "object"
    )
      throw new Error("Resposta de conexão inválida.");
    taConnection = {
      ...s,
      available: true,
      errorCode: s.authConfigured ? null : "auth_unconfigured",
    };
    taCsrf = s.csrf || "";
  } catch (e) {
    taConnection = {
      available: false,
      authenticated: false,
      services: {},
      error: e.message,
      errorCode: e.code || "backend_unavailable",
    };
  }
  if (["home", "settings", "economic", "analyst"].includes(tab)) R();
}
async function taRetryConnection() {
  taStatusChecked = false;
  if (typeof taDailyReset === "function") taDailyReset();
  await taCheckConnection();
  if (typeof taEnsureDailyData === "function") taEnsureDailyData();
}
function taApiState() {
  if (location.protocol === "file:") return "Arquivo HTML local";
  if (!taConnection.available) return "Servidor indisponível";
  if (!taConnection.authConfigured) return "Servidor sem configuração";
  return taConnection.authenticated
    ? "Servidor autenticado"
    : "Conexão disponível · entre";
}
function taConnectionHelp() {
  return `<div id="ta-connection-help" class="ta-connection-help"><h3>Ativar no Windows</h3>
  <p>O servidor é uma parte deste programa que roda no seu computador. Não é preciso contratar hospedagem. Abrir apenas o HTML permite usar o diário e o plano; IA e notícias precisam dessa parte aberta.</p>
  <ol><li>Antes de trocar de versão, <button class="b s" onclick="bk()">Exportar backup</button> do seu histórico e plano.</li>
  <li>Extraia o ZIP completo. Na pasta extraída, abra <strong>INICIAR-TRADE-ASSISTANT.bat</strong>. Se faltar Node.js, instale a versão LTS pelo site oficial que o iniciador abrir e execute o arquivo novamente.</li>
  <li>Siga as perguntas na janela: crie uma senha pessoal de pelo menos 12 caracteres e informe as chaves dos serviços desejados. Elas ficam no arquivo local <code>.env</code>, fora do HTML. Não envie chaves pelo chat.</li>
  <li>O navegador abrirá o aplicativo. Entre com a senha criada em Configurações e restaure seu backup pelo menu de dados. O endereço do aplicativo tem armazenamento separado do arquivo HTML.</li></ol>
  <p>Mantenha a janela do iniciador aberta enquanto usa os serviços. Para adicionar ou trocar chaves depois, feche o iniciador e abra <strong>CONFIGURAR-TRADE-ASSISTANT.bat</strong>. No macOS, use INICIAR-TRADE-ASSISTANT.command.</p>
  <p><strong>IA:</strong> precisa de uma chave OpenAI API; a assinatura do ChatGPT não inclui essa conexão. <strong>Notícias:</strong> Financial Modeling Prep, com acesso ao calendário econômico. <strong>Mercado:</strong> Twelve Data. Cada serviço depende de credenciais e acesso próprios; você pode pular os que não quiser configurar.</p>
  <p>Obtenha as credenciais nos sites oficiais: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">OpenAI API</a>, <a href="https://site.financialmodelingprep.com/developer/docs" target="_blank" rel="noopener noreferrer">Financial Modeling Prep</a> e <a href="https://twelvedata.com/account/api-keys" target="_blank" rel="noopener noreferrer">Twelve Data</a>.</p>
  <p>Seu Trading Plan continua salvo e orienta o foco e a revisão dos setups. Salvar o plano não ativa os provedores automaticamente.</p>
  <button class="b s" onclick="taRetryConnection()">Verificar conexão novamente</button></div>`;
}
function taNav() {
  const groups = [
    ["Principal", ["home", "analyst", "trades", "dash", "cal"]],
    ["Ferramentas", ["plan", "economic", "ins", "rev"]],
    ["Performance", ["ana", "pat", "risk", "str", "share"]],
    ["Conta", ["settings"]],
  ];
  return groups
    .map(
      ([title, ids]) =>
        `<div class="ta-nav-group"><small>${title}</small>${ids.map((id) => `<button class="${tab === id ? "on" : ""}" ${tab === id ? 'aria-current="page"' : ""} title="${esc(tabs.find((t) => t[0] === id)?.[1] || id)}" aria-label="${esc(tabs.find((t) => t[0] === id)?.[1] || id)}" onclick="taGo('${id}')"><span aria-hidden="true">${terminalIcon(id)}</span>${esc(tabs.find((t) => t[0] === id)?.[1] || id)}</button>`).join("")}</div>`,
    )
    .join("");
}
function taInput(label, id, value = "", type = "text", extra = "") {
  return `<label>${esc(label)}<input ${id ? `id="${id}"` : ""} type="${type}" value="${esc(value ?? "")}" ${extra}></label>`;
}
function taText(label, id, value = "") {
  return `<label>${esc(label)}<textarea id="${id}" maxlength="6000">${esc(value)}</textarea></label>`;
}
function taSelect(label, id, value, options) {
  return `<label>${esc(label)}<select ${id ? `id="${id}"` : ""} ${id === "ta-session-label" ? 'onchange="taSessionPreset(this.value)"' : ""}>${options.map(([key, text]) => `<option value="${esc(key)}" ${key === value ? "selected" : ""}>${esc(text)}</option>`).join("")}</select></label>`;
}
function taList(value) {
  return String(value || "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
function taZoneValid(zone) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone }).format();
    return true;
  } catch {
    return false;
  }
}
function taSessionPreset(label) {
  const presets = {
    Londres: ["Europe/London", "08:00", "11:00"],
    "Nova York": ["America/New_York", "08:00", "11:00"],
    Ásia: ["Asia/Tokyo", "09:00", "12:00"],
  };
  const values = presets[label];
  if (values) {
    $("#ta-session-zone").value = values[0];
    $("#ta-session-start").value = values[1];
    $("#ta-session-end").value = values[2];
  }
}
function vSettings() {
  const p = taProfile(),
    connected = taConnection.services || {};
  return `<section class="card ta-settings"><div class="section-head"><div><div class="eyebrow">Seu ritmo de trading</div><h2>Perfil e rotina</h2><p>Os horários da sessão seguem seu fuso, inclusive no horário de verão.</p></div><span class="badge">${esc(taApiState())}</span></div><form onsubmit="event.preventDefault();taSaveProfile()"><div class="fg">${taInput("Seu nome", "ta-name", p.name, "text", 'maxlength="60"')}${taInput("Seu fuso IANA", "ta-zone", p.timezone, "text", 'list="ta-zones" required')}</div>${taAssetPicker(p.instruments)}<datalist id="ta-zones">${["Europe/London", "America/New_York", "America/Sao_Paulo", "Asia/Tokyo", "Europe/Lisbon", "Etc/UTC"].map((z) => `<option>${z}</option>`).join("")}</datalist><div class="ta-section-divider"></div><label class="ta-check"><input id="ta-session-enabled" type="checkbox" ${p.session.enabled ? "checked" : ""}> Ativar minha sessão de trading</label><div class="fg">${taSelect(
    "Sessão",
    "ta-session-label",
    p.session.label,
    [
      ["Londres", "Londres"],
      ["Nova York", "Nova York"],
      ["Ásia", "Ásia"],
      ["Personalizada", "Personalizada"],
    ],
  )}${taInput("Fuso da sessão", "ta-session-zone", p.session.timezone, "text", 'list="ta-zones" required')}${taInput("Início", "ta-session-start", p.session.start, "time", "required")}${taInput("Fim", "ta-session-end", p.session.end, "time", "required")}</div><p class="muted-note">Os dias abaixo representam o dia em que a sessão começa; sessões que atravessam a meia-noite são suportadas.</p><div class="ta-weekdays">${["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d, i) => `<label><input type="checkbox" data-ta-day="${i + 1}" ${p.session.days.includes(i + 1) ? "checked" : ""}> ${d}</label>`).join("")}</div><div class="fg">${taInput("Cautela antes da notícia (min)", "ta-news-before", p.newsBeforeMinutes, "number", 'min="0" max="240" required')}${taInput("Cautela após a notícia (min)", "ta-news-after", p.newsAfterMinutes, "number", 'min="0" max="240" required')}</div><p id="ta-profile-error" role="status" class="muted-note"></p><button class="b" type="submit">Salvar rotina</button></form></section><section class="card"><div class="eyebrow">Conexões protegidas</div><h2>IA e dados de mercado</h2><p class="muted-note">A análise multimodal e os provedores ao vivo usam credenciais exclusivamente no servidor. O diário, plano e imagens continuam neste navegador. Cada navegador mantém seu próprio histórico; use backup para transferir dados.</p><div class="ta-service-grid">${[
    ["ai", "IA · OpenAI"],
    [
      "economicCalendar",
      connected.economicProvider === "showmytrades"
        ? "Calendário econômico · ShowMyTrades"
        : connected.economicProvider === "forexfactory"
          ? "Calendário econômico · Forex Factory (semanal)"
          : "Calendário econômico · Financial Modeling Prep",
    ],
    ["marketConditions", "Dados de mercado · Twelve Data"],
  ]
    .map(
      ([key, label]) =>
        `<div><span>${label}</span><b>${connected[key] ? (key === "economicCalendar" && ["forexfactory", "showmytrades"].includes(connected.economicProvider) ? "Feed sem chave · validação na consulta" : "Chave configurada · validação na consulta") : "Chave não configurada"}</b></div>`,
    )
    .join(
      "",
    )}</div>${taConnection.available && taConnection.authConfigured ? (taConnection.authenticated ? '<p class="g">Sessão autenticada.</p><button class="b s" onclick="taLogout()">Sair do servidor</button>' : `<form onsubmit="event.preventDefault();taLogin()" class="ta-login">${taInput("Senha do servidor pessoal", "ta-password", "", "password", 'autocomplete="current-password" required')}<button class="b" type="submit">Conectar ao servidor</button><p id="ta-login-error" class="muted-note" role="status"></p></form>`) : '<p class="muted-note">' + esc(taApiState()) + ". Siga a ativação abaixo.</p>"}${taConnectionHelp()}</section><section class="card"><h2>Seus dados</h2><p class="muted-note">Armazenamento local yfx1 preservado. O backup inclui histórico, prints, rotina, planos versionados, análises e correções.</p><button class="b s" onclick="bk()">Exportar backup</button></section>`;
}
function taSaveProfile() {
  const timezone = $("#ta-zone").value.trim(),
    sessionZone = $("#ta-session-zone").value.trim(),
    days = [...document.querySelectorAll("[data-ta-day]:checked")].map(
      (e) => +e.dataset.taDay,
    ),
    enabled = $("#ta-session-enabled").checked,
    start = $("#ta-session-start").value,
    end = $("#ta-session-end").value,
    before = Number($("#ta-news-before").value),
    after = Number($("#ta-news-after").value);
  if (
    !taZoneValid(timezone) ||
    !taZoneValid(sessionZone) ||
    !/^\d{2}:\d{2}$/.test(start) ||
    !/^\d{2}:\d{2}$/.test(end) ||
    (enabled && (!days.length || start === end)) ||
    ![before, after].every((n) => Number.isInteger(n) && n >= 0 && n <= 240)
  ) {
    $("#ta-profile-error").textContent =
      "Confira os fusos, dias, horários e janelas de notícia. Início e fim devem ser diferentes.";
    return;
  }
  if (taAssetRead(document.querySelector(".ta-asset-picker")).length > 5) {
    $("#ta-profile-error").textContent =
      "Selecione até 5 ativos para acompanhar.";
    return;
  }
  const profile = {
    name: $("#ta-name").value.trim().slice(0, 60),
    timezone,
    instruments: taList($("#ta-assets").value)
      .map((s) => s.toUpperCase())
      .slice(0, 20),
    session: {
      enabled,
      label: $("#ta-session-label").value,
      timezone: sessionZone,
      start,
      end,
      days,
    },
    newsBeforeMinutes: before,
    newsAfterMinutes: after,
  };
  if (taPersist({ assistantProfile: profile })) {
    if (typeof taDailyReset === "function") taDailyReset();
    taGo("home");
  }
}
async function taLogin() {
  try {
    const d = await taApi("/api/login", {
      method: "POST",
      body: JSON.stringify({ password: $("#ta-password").value }),
    });
    taCsrf = d.csrf;
    taStatusChecked = false;
    await taCheckConnection();
    if (typeof taDailyReset === "function") taDailyReset();
    R();
  } catch (e) {
    $("#ta-login-error").textContent = e.message;
    $("#ta-password").value = "";
  }
}
async function taLogout() {
  try {
    await taApi("/api/logout", { method: "POST" });
    taConnection.authenticated = false;
    taCsrf = "";
    if (typeof taDailyReset === "function") taDailyReset();
    R();
  } catch (e) {
    alert(e.message);
  }
}
let taCriterionCounter = 0;
function taCriterionRow(c = {}) {
  const id =
    c.id || "criterion-" + Date.now().toString(36) + "-" + ++taCriterionCounter;
  return `<fieldset class="ta-criterion" data-criterion-id="${esc(id)}"><div class="ta-criterion-top">${taInput("Critério", "", c.label || "", "text", 'data-cfield="label" maxlength="120" required')}${taInput("Peso", "", c.weight ?? 1, "number", 'data-cfield="weight" min="0.01" max="100" step="any" required')}<button class="b s" type="button" onclick="this.closest('.ta-criterion').remove()" aria-label="Remover critério">×</button></div><label>Definição e evidência exigida<textarea data-cfield="definition" required maxlength="3000">${esc(c.definition || "")}</textarea></label><div class="fg"><label>Verificação<select data-cfield="kind">${[
    ["evidence", "Evidência do setup"],
    ["minRR", "R:R mínimo"],
    ["maxRisk", "Risco máximo"],
    ["session", "Dentro da sessão"],
    ["newsWindow", "Fora da janela de notícia"],
  ]
    .map(
      ([v, l]) =>
        `<option value="${v}" ${(c.kind || "evidence") === v ? "selected" : ""}>${l}</option>`,
    )
    .join(
      "",
    )}</select></label><label>Função<select data-cfield="role"><option value="confirmation">Confirmação</option><option value="invalidation" ${c.role === "invalidation" ? "selected" : ""}>Invalidação quando presente</option></select></label>${taInput("Limiar (opcional)", "", c.threshold ?? "", "number", 'data-cfield="threshold" min="0" step="any"')}</div><div class="ta-inline-checks"><label><input type="checkbox" data-cfield="required" ${c.required !== false ? "checked" : ""}> Obrigatório</label><label><input type="checkbox" data-cfield="critical" ${c.critical !== false ? "checked" : ""}> Crítico</label></div></fieldset>`;
}
function vPlan() {
  const p = taCurrentPlan() || {
    name: "",
    instruments: [],
    timeframes: [],
    risk: {},
    news: { beforeMinutes: 15, afterMinutes: 15, avoidHighImpact: true },
    criteria: [],
  };
  return `<section class="card"><div class="section-head"><div><div class="eyebrow">Sua estratégia, suas definições</div><h2>Meu Trading Plan</h2><p>Regras explícitas sustentam a avaliação; mudanças geram uma nova versão.</p></div><span class="badge">${p.version ? "Versão " + esc(p.version) : "Ainda não configurado"}</span></div><form id="ta-plan-form" onsubmit="event.preventDefault();taSavePlan()"><div class="fg">${taInput("Nome do plano", "tp-name", p.name, "text", 'maxlength="100" required')}${taInput("Mercados / instrumentos", "tp-instruments", p.instruments.join(", "))}${taInput("Timeframes", "tp-timeframes", p.timeframes.join(", "))}</div><div class="ta-two-columns">${[
    ["biasRequirements", "Viés macro necessário"],
    ["structure", "Estrutura e confirmações"],
    ["entryConditions", "Condições de entrada"],
    ["liquidityRules", "Liquidez e indução"],
    ["orderBlockRules", "Definição de Order Block"],
    ["invalidations", "Condições de invalidação"],
    ["management", "Gerenciamento e saída"],
    ["notes", "Explicações adicionais"],
  ]
    .map(([key, label]) => taText(label, "tp-" + key, p[key] || ""))
    .join(
      "",
    )}</div><h3>Gerenciamento de risco</h3><p class="muted-note">Valores monetários na moeda do histórico; nenhuma porcentagem é presumida.</p><div class="fg">${[
    ["perTrade", "Risco máximo por trade"],
    ["maxDaily", "Limite de risco diário"],
    ["maxWeekly", "Limite de risco semanal"],
    ["minRR", "R:R mínimo"],
  ]
    .map(([key, label]) =>
      taInput(
        label + (key !== "minRR" && S.currency ? " · " + S.currency : ""),
        "tp-risk-" + key,
        p.risk[key] ?? "",
        "number",
        'min="0" step="any"',
      ),
    )
    .join(
      "",
    )}</div><h3>Notícias</h3><div class="fg">${taInput("Cautela antes (min)", "tp-before", p.news.beforeMinutes, "number", 'min="0" max="240"')}${taInput("Cautela após (min)", "tp-after", p.news.afterMinutes, "number", 'min="0" max="240"')}</div><label class="ta-check"><input type="checkbox" id="tp-avoid-news" ${p.news.avoidHighImpact ? "checked" : ""}> Exigir cautela em notícias de alto impacto</label><p class="muted-note">Sua sessão e os dias de trading são configurados em <button type="button" class="ta-link" onclick="taGo('settings')">Configurações</button>.</p><div class="section-head"><div><h3>Critérios verificáveis</h3><p class="muted-note">Pesos definem a nota. Invalidação “atendida” bloqueia a conformidade. Critério obrigatório desconhecido exige revisão.</p></div><button class="b s" type="button" onclick="$('#ta-plan-criteria').insertAdjacentHTML('beforeend',taCriterionRow())">+ Critério</button></div><div id="ta-plan-criteria">${(p.criteria.length ? p.criteria : [{}]).map(taCriterionRow).join("")}</div><p id="ta-plan-error" role="status" class="muted-note"></p><button class="b" type="submit">Salvar nova versão do plano</button></form></section><details class="card"><summary>Histórico de versões (${taPlans().length})</summary><div class="ta-plan-history">${
    taPlans()
      .slice()
      .reverse()
      .map(
        (v) =>
          `<button class="b s" onclick="taShowPlanVersion(${Number(v.version)})">Versão ${Number(v.version)} · ${esc(v.name)} · ${esc((v.createdAt || "").slice(0, 10))}</button>`,
      )
      .join("") || '<p class="mu">Nenhum plano salvo.</p>'
  }</div></details>`;
}
function taReadCriterion(row) {
  const value = (key) => row.querySelector(`[data-cfield="${key}"]`),
    n = rNumber(value("threshold").value);
  return {
    id: row.dataset.criterionId,
    label: value("label").value,
    definition: value("definition").value,
    weight: Number(value("weight").value),
    kind: value("kind").value,
    role: value("role").value,
    threshold: n,
    required: value("required").checked,
    critical: value("critical").checked,
  };
}
function taSavePlan() {
  try {
    const prev = taCurrentPlan(),
      draft = {
        id: prev?.id || "personal-plan",
        version: (prev?.version || 0) + 1,
        createdAt: new Date().toISOString(),
        name: $("#tp-name").value,
        instruments: taList($("#tp-instruments").value),
        timeframes: taList($("#tp-timeframes").value),
        risk: Object.fromEntries(
          ["perTrade", "maxDaily", "maxWeekly", "minRR"].map((k) => [
            k,
            rNumber($("#tp-risk-" + k).value),
          ]),
        ),
        news: {
          beforeMinutes: Number($("#tp-before").value),
          afterMinutes: Number($("#tp-after").value),
          avoidHighImpact: $("#tp-avoid-news").checked,
        },
        criteria: [...document.querySelectorAll(".ta-criterion")].map(
          taReadCriterion,
        ),
      };
    for (const key of [
      "biasRequirements",
      "structure",
      "entryConditions",
      "liquidityRules",
      "orderBlockRules",
      "invalidations",
      "management",
      "notes",
    ])
      draft[key] = $("#tp-" + key).value;
    const plan = TradePlanEngine.validatePlan(draft);
    if (taPersist({ tradingPlans: [...taPlans(), plan] })) R();
  } catch (e) {
    $("#ta-plan-error").textContent =
      e.message + (e.issues ? " · " + e.issues.join("; ") : "");
  }
}
function taShowPlanVersion(version) {
  const p = taPlans().find((x) => x.version === version);
  if (!p) return;
  const d = $("#ta-dialog");
  d.innerHTML = `<div class="section-head"><h2>${esc(p.name)} · versão ${esc(p.version)}</h2><button class="b s" onclick="$('#ta-dialog').close()">Fechar</button></div><p class="muted-note">Versão preservada. Análises anteriores mantêm sua própria cópia do plano.</p><pre class="ta-plan-json">${esc(JSON.stringify(p, null, 2))}</pre>`;
  d.showModal();
}
function taAnalystContext() {
  return {
    asset: $("#ta-a-asset")?.value.trim() || "",
    timeframe: $("#ta-a-timeframe")?.value.trim() || "",
    bias: $("#ta-a-bias")?.value || "",
    macroContext: $("#ta-a-macro")?.value || "",
    entryRegion: $("#ta-a-region")?.value || "",
    plannedRR: rNumber($("#ta-a-rr")?.value),
    plannedRisk: rNumber($("#ta-a-risk")?.value),
  };
}
function taStoreAnalystContext() {
  taAnalyst.context = taAnalystContext();
}
async function taLoadAnalysisImage(file) {
  if (!file) return;
  taStoreAnalystContext();
  taAnalyst.requestId++;
  taAnalyst.pending = false;
  if (
    !/^image\/(png|jpeg|webp)$/.test(file.type) ||
    file.size > 6 * 1024 * 1024
  ) {
    taAnalyst.error = "Use PNG, JPEG ou WebP de até 6 MB.";
    R();
    return;
  }
  try {
    const c = await decodeShotImage(file);
    taAnalyst.image = c.toDataURL("image/jpeg", 0.88);
    taAnalyst.imageName = file.name;
    taAnalyst.result = null;
    taAnalyst.error = "";
    R();
  } catch (e) {
    taAnalyst.error = e.message;
    R();
  }
}
function taPlanChecks(plan, context) {
  const checks = plan.criteria.map((c) => ({
    criterionId: c.id,
    status: "not_verifiable",
    evidence:
      "Sem avaliação visual disponível. Registre a evidência ou conecte o servidor de IA.",
    reason: "Não verificado",
    source: "trader",
  }));
  return TradePlanEngine.scorePlan(plan, checks, context);
}
function taAnalysisResult() {
  const r = taAnalyst.result;
  if (!r) return "";
  const score = r.currentScore || r.score,
    labels = {
      met: "Atendido",
      failed: "Não atendido",
      not_verifiable: "Não verificável",
    },
    statusLabels = {
      compliant: "Conforme o plano registrado",
      needs_review: "Precisa de verificação",
      not_compliant: "Não conforme",
    };
  return `<section class="card ta-analysis-result"><div class="section-head"><div><div class="eyebrow">Aderência ao plano · versão ${esc(r.planSnapshot.version)}</div><h2>${score.score == null || score.coverage === 0 ? "Dados insuficientes" : insNum(score.score, 0) + "%"} <span class="badge">${esc(statusLabels[score.status] || score.status)}</span></h2><p>Setup ${esc(r.context?.asset || "")} · ${esc(r.context?.timeframe || "")} · conformidade com regras, não probabilidade de lucro.</p></div><span class="badge">${r.provider === "manual" ? "Revisão manual · sem IA" : esc(r.model || "Análise por IA")}</span></div><p>${esc(r.analysis?.summary || "Revise os critérios e registre a evidência observada. Não há previsão de direção ou retorno.")}</p><p class="muted-note">Pontuação determinística: ${esc(score.formula || "Peso dos critérios atendidos ÷ peso total")}. Cobertura: ${insNum(score.coverage ?? 0, 0)}%. ${r.asOf ? esc(new Date(r.asOf).toLocaleString("pt-PT")) : ""}</p>${score.blockers?.length ? `<div class="ta-caution"><b>Critérios que impedem a validação completa</b><ul>${score.blockers.map((b) => `<li>${esc(typeof b === "string" ? b : b.message || b.reason || b.label || JSON.stringify(b))}</li>`).join("")}</ul></div>` : ""}<div class="ta-assessments">${score.assessments
    .map((a) => {
      const c = r.planSnapshot.criteria.find((c) => c.id === a.criterionId);
      return `<article class="ta-assessment"><div class="section-head"><h3>${esc(c?.label || a.criterionId)}</h3><span class="badge ${a.status === "met" ? "g" : a.status === "failed" ? "r" : ""}">${labels[a.status]}</span></div><p>${esc(a.evidence || a.reason || "Sem evidência suficiente.")}</p><small>${esc(a.source === "ai" ? "Avaliação da IA" : a.source === "calculation" ? "Cálculo determinístico" : "Registro do trader")} · peso ${esc(c?.weight || "—")}${c?.required ? " · obrigatório" : ""}${c?.critical ? " · crítico" : ""}</small>${
        c?.kind === "evidence"
          ? `<details><summary>Corrigir avaliação</summary><form onsubmit="event.preventDefault();taCorrectAssessment(this)"><input type="hidden" name="criterionId" value="${esc(a.criterionId)}"><label>Status<select name="status">${Object.entries(
              labels,
            )
              .map(
                ([key, text]) =>
                  `<option value="${key}" ${a.status === key ? "selected" : ""}>${text}</option>`,
              )
              .join(
                "",
              )}</select></label><label>Evidência / motivo da correção<textarea name="evidence" maxlength="2000" required></textarea></label><button class="b s" type="submit">Salvar correção</button></form></details>`
          : '<p class="muted-note">Critério automático. Corrija os dados estruturados e execute uma nova avaliação.</p>'
      }</article>`;
    })
    .join(
      "",
    )}</div><p class="muted-note">${Number(r.corrections?.length) || 0} correção(ões) registrada(s). As correções são preservadas para revisão e não retreinam automaticamente o modelo.</p></section>`;
}
function taSafeImage(value) {
  return typeof value === "string" &&
    value.length <= 9 * 1024 * 1024 &&
    /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
    ? value
    : null;
}
function vAnalyst() {
  const p = taCurrentPlan(),
    c = taAnalyst.context;
  return `<section class="card"><div class="section-head"><div><div class="eyebrow">Evidências antes de convicção</div><h2>Trade Analyst</h2><p>Baseado nas definições do seu Trading Plan.</p></div><span class="badge">${p ? "Plano v" + esc(p.version) : "Plano não configurado"}</span></div>${
    !p
      ? '<div class="ta-empty"><h3>Defina as regras que deseja avaliar</h3><p>Salve um Trading Plan com critérios explícitos antes de iniciar uma análise.</p><button class="b" onclick="taGo(\'plan\')">Criar Trading Plan</button></div>'
      : `<div class="ta-analyst-grid"><div><label class="ta-image-upload">${taSafeImage(taAnalyst.image) ? `<img src="${esc(taSafeImage(taAnalyst.image))}" alt="Screenshot do setup em análise">` : "<span>Adicionar screenshot anotado<br><small>PNG, JPEG ou WebP · até 6 MB</small></span>"}<input id="ta-analyst-image" type="file" accept="image/png,image/jpeg,image/webp" hidden onchange="taLoadAnalysisImage(this.files[0])"></label><p class="muted-note">A imagem só é enviada ao provedor de IA ao clicar em Analisar. A revisão manual funciona offline. Envie apenas a evidência que deseja avaliar.</p></div><form id="ta-analyst-form" oninput="taStoreAnalystContext()" onsubmit="event.preventDefault();taRunAnalysis()"><div class="fg">${taInput("Ativo", "ta-a-asset", c.asset, "text", 'maxlength="30" required')}${taInput("Timeframe", "ta-a-timeframe", c.timeframe, "text", 'maxlength="20" required')}${taSelect(
          "Viés planejado",
          "ta-a-bias",
          c.bias,
          [
            ["", "Não informado"],
            ["long", "Compra"],
            ["short", "Venda"],
            ["neutral", "Neutro"],
          ],
        )}${taInput("R:R planejado (se conhecido)", "ta-a-rr", c.plannedRR ?? "", "number", 'min="0" step="any"')}${taInput("Risco planejado (moeda do plano)" + (S.currency ? " · " + S.currency : ""), "ta-a-risk", c.plannedRisk ?? "", "number", 'min="0" step="any"')}</div>${taText("Contexto macro", "ta-a-macro", c.macroContext)}${taText("Região de entrada e anotações", "ta-a-region", c.entryRegion)}<div class="row"><button class="b" type="submit" ${taAnalyst.pending ? "disabled" : ""}>${taAnalyst.pending ? "Analisando evidências…" : "Analisar com IA"}</button><button class="b s" type="button" onclick="taRunManual()" ${taAnalyst.pending ? "disabled" : ""}>Revisar manualmente</button></div><p class="muted-note">Critérios sem evidência suficiente permanecem “Não verificável”. Notícias sem fonte conectada não são consideradas liberadas.</p></form></div>`
  }<p class="ta-status-error" role="status">${esc(taAnalyst.error)}</p></section>${taAnalysisResult()}<details class="card"><summary>Análises anteriores (${(S.setupAnalyses || []).length})</summary><div class="ta-analysis-history">${
    (S.setupAnalyses || [])
      .slice()
      .reverse()
      .map(
        (a) =>
          `<button class="b s" data-id="${esc(a.id)}" onclick="taOpenAnalysis(this.dataset.id)">${esc(a.context?.asset || "Setup")} · ${esc(a.context?.timeframe || "")} · plano v${a.planSnapshot?.version || "—"} · ${esc((a.asOf || "").slice(0, 10))}</button>`,
      )
      .join("") || '<p class="mu">Nenhuma análise salva.</p>'
  }</div></details>`;
}
function taAnalysisContext() {
  const c = taAnalyst.context,
    p = taProfile();
  const context = { ...c };
  if (p.session.enabled) {
    const session = SessionEngine.sessionOverview(p.session, new Date());
    context.withinSession = session.status === "active";
  }
  if (typeof taNewsCheck === "function") {
    const news = taNewsCheck(taCurrentPlan());
    if (typeof news === "boolean") context.newsBlocked = news;
  }
  return context;
}
function taAnalysisSnapshot() {
  return {
    planSnapshot: JSON.parse(JSON.stringify(taCurrentPlan())),
    profileSnapshot: JSON.parse(JSON.stringify(taProfile())),
    context: JSON.parse(JSON.stringify(taAnalyst.context)),
    image: taAnalyst.image,
  };
}
function taSaveAnalysis(result, snapshot = taAnalysisSnapshot()) {
  const record = {
    ...result,
    id:
      "analysis-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 7),
    asOf: result.asOf || new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...snapshot,
    corrections: [],
  };
  if (taPersist({ setupAnalyses: [...(S.setupAnalyses || []), record] })) {
    taAnalyst.result = record;
    return record;
  }
  return null;
}
async function taRunAnalysis() {
  if (taAnalyst.pending) return;
  taStoreAnalystContext();
  const plan = taCurrentPlan();
  if (
    !plan ||
    !taAnalyst.image ||
    !taAnalyst.context.asset ||
    !taAnalyst.context.timeframe
  ) {
    taAnalyst.error = "Inclua um print, ativo, timeframe e um plano salvo.";
    R();
    return;
  }
  taAnalyst.pending = true;
  taAnalyst.error = "";
  const context = taAnalysisContext(),
    snapshot = taAnalysisSnapshot(),
    requestId = ++taAnalyst.requestId;
  R();
  try {
    const result = await taApi("/api/analyse", {
      method: "POST",
      body: JSON.stringify({
        plan: snapshot.planSnapshot,
        image: { dataUrl: snapshot.image },
        context,
        profile: {
          timezone: snapshot.profileSnapshot.timezone,
          session: snapshot.profileSnapshot.session,
        },
      }),
    });
    if (requestId !== taAnalyst.requestId) return;
    const assessments = TradePlanEngine.validateAssessments(
        plan,
        result.analysis.assessments,
      ),
      scoringContext = result.scoringContext || {},
      score = TradePlanEngine.scorePlan(plan, assessments, scoringContext);
    taSaveAnalysis(
      {
        ...result,
        analysis: { ...result.analysis, assessments },
        score,
        scoringContext,
      },
      snapshot,
    );
  } catch (e) {
    taAnalyst.error = e.message + " A revisão manual permanece disponível.";
  } finally {
    if (requestId === taAnalyst.requestId) {
      taAnalyst.pending = false;
      R();
    }
  }
}
function taRunManual() {
  if (taAnalyst.pending) return;
  taStoreAnalystContext();
  const plan = taCurrentPlan();
  if (!plan) return;
  try {
    const context = taAnalysisContext(),
      score = taPlanChecks(plan, context);
    taSaveAnalysis({
      provider: "manual",
      analysis: {
        summary:
          "Revisão manual das evidências. Nenhuma interpretação visual por IA foi executada.",
        assessments: score.assessments,
      },
      score,
      scoringContext: context,
    });
    taAnalyst.error = "";
    R();
  } catch (e) {
    taAnalyst.error = e.message;
    R();
  }
}
function taCorrectAssessment(form) {
  const r = taAnalyst.result;
  if (!r) return;
  const data = new FormData(form),
    id = data.get("criterionId"),
    status = data.get("status"),
    evidence = String(data.get("evidence") || "").trim();
  if (!evidence) return;
  try {
    const current = r.currentScore?.assessments || r.analysis.assessments,
      old = current.find((a) => a.criterionId === id),
      updated = current.map((a) =>
        a.criterionId === id
          ? { ...a, status, evidence, reason: evidence, source: "trader" }
          : a,
      ),
      score = TradePlanEngine.scorePlan(
        r.planSnapshot,
        updated,
        r.scoringContext || {},
      ),
      record = {
        ...r,
        currentScore: score,
        corrections: [
          ...(r.corrections || []),
          {
            criterionId: id,
            from: old?.status,
            to: status,
            evidence,
            at: new Date().toISOString(),
          },
        ],
      };
    if (
      taPersist({
        setupAnalyses: (S.setupAnalyses || []).map((a) =>
          a.id === record.id ? record : a,
        ),
      })
    ) {
      taAnalyst.result = record;
      R();
    }
  } catch (e) {
    alert(e.message);
  }
}
function taOpenAnalysis(id) {
  taAnalyst.requestId++;
  taAnalyst.pending = false;
  const raw = (S.setupAnalyses || []).find((a) => a.id === id);
  if (!raw) return;
  try {
    const record = JSON.parse(JSON.stringify(raw)),
      plan = TradePlanEngine.validatePlan(record.planSnapshot),
      original = TradePlanEngine.validateAssessments(
        plan,
        record.analysis.assessments,
      ),
      current = TradePlanEngine.validateAssessments(
        plan,
        record.currentScore?.assessments || original,
      ),
      context = {};
    for (const key of ["plannedRR", "plannedRisk"])
      if (
        typeof record.scoringContext?.[key] === "number" &&
        Number.isFinite(record.scoringContext[key])
      )
        context[key] = record.scoringContext[key];
    for (const key of ["withinSession", "newsBlocked"])
      if (typeof record.scoringContext?.[key] === "boolean")
        context[key] = record.scoringContext[key];
    taAnalyst.result = {
      ...record,
      planSnapshot: plan,
      analysis: { ...record.analysis, assessments: original },
      currentScore: TradePlanEngine.scorePlan(plan, current, context),
      scoringContext: context,
    };
    taAnalyst.context = { ...record.context };
    taAnalyst.image = taSafeImage(record.image);
    taAnalyst.error = "";
    R();
    document
      .querySelector(".ta-analysis-result")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    alert(
      "Não foi possível validar essa análise do backup. O registro original foi mantido.",
    );
  }
}
let taBriefing = { key: null, pending: false, result: null, error: "" };
function taBriefingInput() {
  const profile = taProfile(),
    week = taDailyWeekStats(),
    plan = taCurrentPlan(),
    facts = [
      {
        id: "sample",
        text: `Semana ${week.from} a ${week.to}: ${week.stats.n} trades fechados. ${week.current.length < 5 ? "Amostra pequena; não concluir tendência." : ""}`,
      },
    ];
  if (week.r.total !== null)
    facts.push({
      id: "r",
      text: `R líquido ${week.r.complete ? "completo" : "parcial"} conhecido: ${week.r.total.toFixed(2)}R em ${week.r.n}/${week.stats.n} trades. R por preço sem custos excluído.`,
    });
  if (week.process.plan.value !== null)
    facts.push({
      id: "plan-compliance",
      text: `Cumprimento do plano declarado em ${week.process.plan.value.toFixed(0)}% dos ${week.process.plan.n} trades com plano avaliado, de ${week.stats.n} operações.`,
    });
  const errors = insErrorCounts(week.current),
    top = Object.entries(errors).sort((a, b) => b[1] - a[1])[0];
  if (top)
    facts.push({
      id: "recorded-error",
      text: `Erro explicitamente registrado: ${INS_ERRORS.find((x) => x[0] === top[0])?.[1] || top[0]}, em ${top[1]} operação(ões). Não inferir causalidade ou emoção.`,
    });
  if (profile.session.enabled) {
    const state = SessionEngine.sessionOverview(profile.session, new Date());
    facts.push({
      id: "session",
      text: `Sessão configurada: ${profile.session.label}, ${profile.session.start}–${profile.session.end}, ${profile.session.timezone}. Estado observado: ${state.status}.`,
    });
  }
  if (plan)
    facts.push({
      id: "active-plan",
      text: `Plano ativo: ${plan.name}, versão ${plan.version}. Prioridade documentada: ${plan.criteria.find((c) => c.required)?.definition || plan.criteria[0].definition}`,
    });
  facts.push({
    id: "live-availability",
    text: "Notícias e volatilidade só podem ser comentadas quando há dados verificados. Este briefing não contém evidência de mercado ao vivo; não inferir condições atuais.",
  });
  return {
    plan,
    profile: { timezone: profile.timezone, session: profile.session },
    facts: facts.map((f) => ({ ...f, text: f.text.slice(0, 1000) })),
  };
}
function taBriefingKey(input = taBriefingInput()) {
  return JSON.stringify(input);
}
function taBriefingHasResult() {
  return !!taBriefing.result && taBriefing.key === taBriefingKey();
}
function taBriefingView() {
  const valid = taBriefingHasResult(),
    ready =
      taConnection.available &&
      taConnection.authenticated &&
      taConnection.services?.ai;
  return `${valid ? `<div class="ta-generated-insight"><p>${esc(taBriefing.result.action)}</p><ul>${taBriefing.result.facts.map((f) => `<li>${esc(f.text)}</li>`).join("")}</ul><small>IA baseada nos registros enviados · ${esc(new Date(taBriefing.result.asOf).toLocaleString("pt-PT"))}. Estatísticas calculadas por código.</small></div>` : ""}<div class="row" style="margin-top:16px">${ready ? `<button class="b s" onclick="taGenerateBriefing()" ${taBriefing.pending ? "disabled" : ""}>${taBriefing.pending ? "Preparando insight…" : valid ? "Atualizar insight com IA" : "Gerar insight com IA"}</button>` : '<button class="b s" onclick="taGo(\'settings\')">Configurar insight com IA</button>'}</div>${taBriefing.error ? `<p class="ta-status-error" role="status">${esc(taBriefing.error)}</p>` : ""}`;
}
async function taGenerateBriefing() {
  if (taBriefing.pending) return;
  const input = taBriefingInput(),
    key = taBriefingKey(input);
  taBriefing = { key, pending: true, result: null, error: "" };
  R();
  try {
    const result = await taApi("/api/briefing", {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (!Array.isArray(result.facts) || typeof result.action !== "string")
      throw new Error("O servidor retornou um insight inválido.");
    const byId = new Map(input.facts.map((f) => [f.id, f]));
    if (result.facts.some((f) => !byId.has(f.id)))
      throw new Error("O insight referenciou dados não disponíveis.");
    if (key === taBriefingKey())
      taBriefing.result = {
        ...result,
        facts: result.facts.map((f) => byId.get(f.id)),
      };
  } catch (e) {
    taBriefing.error =
      e.message +
      " O foco local baseado nos seus registros continua disponível.";
  } finally {
    taBriefing.pending = false;
    if (tab === "home") R();
  }
}
