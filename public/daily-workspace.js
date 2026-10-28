/* Daily preparation: existing local journal + authenticated provider data, never demo events. */
const taDailyState = {
  calendarDate: null,
  relevantOnly: true,
  requests: new Map(),
  refreshing: false,
};
function taDailyProfile() {
  return taProfile();
}
function taDailyParts(now = new Date(), zone = taDailyProfile().timezone) {
  try {
    return SessionEngine.zonedParts(now, zone);
  } catch {
    return {
      date: ymd(now),
      hour: now.getHours(),
      weekday: ((now.getDay() + 6) % 7) + 1,
    };
  }
}
function taDailyDate() {
  return taDailyParts().date;
}
function taDailyAdd(date, n) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function taDailyCurrencies() {
  const known = new Set([
      "USD",
      "EUR",
      "GBP",
      "JPY",
      "CHF",
      "AUD",
      "NZD",
      "CAD",
      "CNY",
      "CNH",
      "BRL",
      "HKD",
      "SGD",
      "SEK",
      "NOK",
      "MXN",
      "ZAR",
    ]),
    currencies = new Set();
  for (const asset of taDailyProfile().instruments || []) {
    const s = String(asset)
      .toUpperCase()
      .replace(/^[A-Z]+:/, "")
      .replace(/[^A-Z]/g, "");
    for (const c of [s.slice(0, 3), s.slice(3, 6)])
      if (known.has(c)) currencies.add(c);
  }
  return [...currencies].sort();
}
function taDailySymbols() {
  return (taDailyProfile().instruments || [])
    .map((raw) => {
      const s = String(raw).toUpperCase().trim();
      return /^[A-Z]{6}$/.test(s) ? s.slice(0, 3) + "/" + s.slice(3) : s;
    })
    .filter(Boolean);
}
function taDailyConnection() {
  const c = typeof taConnection === "object" ? taConnection : {};
  if (!c.available)
    return {
      ready: false,
      text:
        typeof location !== "undefined" && location.protocol === "file:"
          ? "Você abriu o HTML local. Para ativar IA e notícias no Windows, use INICIAR-TRADE-ASSISTANT.bat. Veja o guia em Configurações."
          : "O servidor não respondeu. Verifique se o iniciador está aberto e tente novamente em Configurações.",
    };
  if (c.authConfigured === false)
    return {
      ready: false,
      text: "O servidor está aberto, mas falta criar a senha e configurar os serviços. Use CONFIGURAR-TRADE-ASSISTANT.bat.",
    };
  if (!c.authenticated)
    return {
      ready: false,
      text: "Entre na conexão segura em Configurações para consultar os provedores.",
    };
  return { ready: true, text: "" };
}
function taDailyKey(kind, date = taDailyDate()) {
  const p = taDailyProfile(),
    currencies =
      kind === "events" && (tab === "home" || taDailyState.relevantOnly)
        ? taDailyCurrencies()
        : [];
  return kind === "events"
    ? "events|" + date + "|" + currencies.join(",") + "|" + p.timezone
    : "market|" + taDailySymbols().join(",") + "|" + p.timezone;
}
function taDailyRequestState(kind, date = taDailyDate()) {
  return (
    taDailyState.requests.get(taDailyKey(kind, date)) || {
      status: "idle",
      data: null,
      error: null,
    }
  );
}
async function taDailyFetch(kind, date, force = false) {
  const key = taDailyKey(kind, date),
    existing = taDailyState.requests.get(key),
    now = Date.now();
  if (existing?.promise) return existing.promise;
  if (!force && existing && existing.expiresAt > now) return false;
  const p = taDailyProfile(),
    currencies =
      kind === "events" && (tab === "home" || taDailyState.relevantOnly)
        ? taDailyCurrencies()
        : [],
    params = new URLSearchParams({ timezone: p.timezone });
  if (kind === "events") {
    params.set("from", taDailyAdd(date, -1));
    params.set("to", taDailyAdd(date, 1));
    if (currencies.length) params.set("currencies", currencies.join(","));
  } else {
    const symbols = taDailySymbols();
    if (!symbols.length) return false;
    params.set("symbols", symbols.join(","));
  }
  const record = {
    status: "loading",
    data: existing?.data || null,
    error: null,
    expiresAt: 0,
    promise: null,
  };
  taDailyState.requests.set(key, record);
  record.promise = (async () => {
    try {
      const data = await taApi(
        "/api/" +
          (kind === "events" ? "economic-calendar" : "market-conditions") +
          "?" +
          params.toString(),
      );
      if (kind === "events" && !Array.isArray(data.events))
        throw new Error("Resposta do calendário inválida.");
      if (kind === "market" && !Array.isArray(data.instruments))
        throw new Error("Resposta do mercado inválida.");
      record.data = data;
      record.status = "success";
      record.expiresAt = Date.now() + 5 * 60 * 1000;
    } catch (error) {
      record.status = "error";
      record.error = String(error?.message || "Provedor indisponível.");
      record.expiresAt = Date.now() + 60 * 1000;
    } finally {
      record.promise = null;
    }
    return true;
  })();
  return record.promise;
}
function taEnsureDailyData(force = false) {
  if (!["home", "economic"].includes(tab) || !taDailyConnection().ready)
    return Promise.resolve();
  const date =
      tab === "economic"
        ? taDailyState.calendarDate || taDailyDate()
        : taDailyDate(),
    jobs = [taDailyFetch("events", date, force)];
  if (tab === "home") jobs.push(taDailyFetch("market", date, force));
  return Promise.all(jobs).then((changed) => {
    if (changed.some(Boolean) && ["home", "economic"].includes(tab)) R();
  });
}
function taDailyReset() {
  taDailyState.requests.clear();
  taDailyState.calendarDate = null;
  return taEnsureDailyData();
}
function taDailyRefresh() {
  if (taDailyState.refreshing) return;
  taDailyState.refreshing = true;
  taEnsureDailyData(true).finally(() => {
    taDailyState.refreshing = false;
    if (["home", "economic"].includes(tab)) R();
  });
  R();
}
function taEconomicDate(value) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    isNaN(new Date(value + "T12:00:00Z"))
  )
    return;
  taDailyState.calendarDate = value;
  R();
}
function taDailyFormatTime(
  value,
  options = { hour: "2-digit", minute: "2-digit" },
) {
  try {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "Horário indisponível";
    return new Intl.DateTimeFormat("pt-PT", {
      timeZone: taDailyProfile().timezone,
      ...options,
    }).format(date);
  } catch {
    return "Horário indisponível";
  }
}
function taDailyTimeLeft(instant) {
  const ms = new Date(instant).getTime() - Date.now();
  if (!Number.isFinite(ms)) return "Horário indisponível";
  if (ms <= 0) return "Agora / já divulgado";
  const minutes = Math.ceil(ms / 60000);
  return minutes < 60
    ? "em " + minutes + " min"
    : "em " + Math.floor(minutes / 60) + "h " + (minutes % 60) + "min";
}
function taDailySession(now = new Date()) {
  const session = taDailyProfile().session;
  if (!session?.enabled) return { configured: false, status: "unconfigured" };
  try {
    return SessionEngine.sessionOverview(session, now);
  } catch {
    return { configured: false, status: "unconfigured" };
  }
}
function taDailySessionCountdown(session) {
  if (!session.configured) return "";
  if (session.status === "active")
    return "Termina " + taDailyTimeLeft(session.endAt);
  if (session.status === "finished")
    return "Próxima sessão " + taDailyTimeLeft(session.nextStartAt);
  return "Começa " + taDailyTimeLeft(session.startAt);
}
function taDailyEventTime(event) {
  const t = event?.time;
  if (typeof t !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/.test(t)) return null;
  const instant = new Date(t).getTime();
  return Number.isFinite(instant) ? instant : null;
}
function taDailyEventWindow(event) {
  const instant = taDailyEventTime(event),
    profile = taDailyProfile(),
    session = profile.session;
  if (instant === null || !session?.enabled)
    return { withinSession: false, caution: false };
  try {
    const local = SessionEngine.zonedParts(new Date(instant), session.timezone);
    for (const date of [local.date, taDailyAdd(local.date, -1)]) {
      const parts = SessionEngine.zonedParts(
        new Date(date + "T12:00:00Z"),
        "UTC",
      );
      if (!session.days.includes(parts.weekday)) continue;
      const overnight = session.end <= session.start,
        endDate = overnight ? taDailyAdd(date, 1) : date,
        start = Date.parse(
          SessionEngine.zonedDateTimeToUtc(
            date,
            session.start,
            session.timezone,
          ),
        ),
        end = Date.parse(
          SessionEngine.zonedDateTimeToUtc(
            endDate,
            session.end,
            session.timezone,
          ),
        );
      if (instant >= start && instant < end) {
        const before = Number(profile.newsBeforeMinutes) || 0,
          after = Number(profile.newsAfterMinutes) || 0;
        return {
          withinSession: true,
          caution:
            Date.now() >= instant - before * 60000 &&
            Date.now() <= instant + after * 60000,
          before,
          after,
          start,
          end,
        };
      }
    }
    return { withinSession: false, caution: false };
  } catch {
    return { withinSession: false, caution: false };
  }
}
function taDailyEvents(date = taDailyDate()) {
  const state = taDailyRequestState("events", date),
    allowed = taDailyCurrencies();
  return (state.data?.events || [])
    .filter(
      (e) =>
        taDailyEventTime(e) !== null &&
        SessionEngine.zonedParts(
          new Date(taDailyEventTime(e)),
          taDailyProfile().timezone,
        ).date === date &&
        (!taDailyState.relevantOnly ||
          !allowed.length ||
          e.currency === "ALL" ||
          allowed.includes(e.currency)),
    )
    .sort((a, b) => taDailyEventTime(a) - taDailyEventTime(b));
}
function taDailySource(data) {
  if (!data) return "";
  return `<p class="muted-note ta-source">${esc(data.source || "Provedor externo")} · consultado ${esc(taDailyFormatTime(data.asOf, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }))}${data.cached ? " · cache" : ""}</p>${data.notice ? `<p class="muted-note">${esc(data.notice)}</p>` : ""}`;
}
function taDailyAvailability(kind, date) {
  const connection = taDailyConnection(),
    state = taDailyRequestState(kind, date);
  if (!connection.ready)
    return `<p class="ta-unavailable">${esc(connection.text)}</p><button class="b s" onclick="taGo('settings')">Configurar conexão</button>`;
  if (state.status === "loading" || state.status === "idle")
    return '<div class="premium-loading" role="status" aria-live="polite"><span class="premium-loading-dot" aria-hidden="true"></span><p>Consultando o provedor…</p><div class="premium-loading-bars" aria-hidden="true"><i></i><i></i><i></i></div></div>';
  if (state.status === "error")
    return `<p class="ta-unavailable">${esc(state.error)}</p><button class="b s" onclick="taDailyRefresh()">Tentar novamente</button>`;
  if (
    kind === "events" &&
    state.data?.coverageFrom &&
    (date < state.data.coverageFrom || date > state.data.coverageTo)
  )
    return '<p class="ta-unavailable">Esta data está fora dos dias cobertos pelo provedor disponível. Não é possível confirmar os eventos deste dia.</p>';
  return "";
}
function taDailyEventList(events, compact = false) {
  const list = compact
    ? events
        .filter(
          (e) =>
            taDailyEventTime(e) >=
            Date.now() -
              Math.max(0, Number(taDailyProfile().newsAfterMinutes) || 0) *
                60000,
        )
        .slice(0, 3)
    : events;
  if (!list.length)
    return '<div class="ta-empty"><p>O provedor não retornou eventos para este recorte.</p><small>Isso não garante ausência de risco ou de notícias não programadas.</small></div>';
  return `<div class="ta-events">${list
    .map((e) => {
      const window = taDailyEventWindow(e),
        high = e.impact === "high",
        impact =
          {
            high: "Alto",
            medium: "Médio",
            low: "Baixo",
            unknown: "Não informado",
          }[e.impact] || "Não informado";
      return `<article class="ta-event ${high ? "ta-event-high" : ""}"><div class="ta-event-time"><b>${esc(taDailyFormatTime(e.time))}</b><small>${esc(taDailyTimeLeft(e.time))}</small></div><div class="ta-event-info"><div><span class="badge">${esc(e.currency || "—")}</span> <strong>${esc(e.name)}</strong></div><p class="muted-note">Impacto na fonte: ${esc(impact.toLowerCase())}${window.withinSession ? " · Durante sua sessão" : ""}${window.caution ? " · Dentro da janela de cautela" : ""}</p>${compact ? "" : `<div class="ta-event-values"><span>Anterior <b>${esc(e.previous ?? "—")}</b></span><span>Previsão <b>${esc(e.forecast ?? "—")}</b></span><span>Atual <b>${esc(e.actual ?? "—")}</b></span></div>`}</div>${high && window.withinSession ? '<span class="ta-event-warning">Atenção na sessão</span>' : ""}</article>`;
    })
    .join("")}</div>`;
}
function taDailyCalendarCard() {
  const date = taDailyDate(),
    state = taDailyRequestState("events", date),
    unavailable = taDailyAvailability("events", date),
    events = taDailyEvents(date),
    profile = taDailyProfile(),
    inside = events.filter(
      (e) => e.impact === "high" && taDailyEventWindow(e).withinSession,
    );
  return `<section class="card ta-home-events"><div class="section-head"><div><div class="eyebrow">Catalisadores programados</div><h2>Eventos importantes hoje</h2><p>${esc(profile.timezone)}</p></div><button class="b s" onclick="taGo('economic')">Calendário completo</button></div>${unavailable || taDailyEventList(events, true)}${!unavailable && inside.length ? `<p class="ta-caution">${inside.length} evento(s) de alto impacto durante sua sessão. Janela configurada: ${Number(profile.newsBeforeMinutes) || 0} min antes e ${Number(profile.newsAfterMinutes) || 0} min depois. Siga as restrições do seu Plano de Trading.</p>` : ""}${taDailySource(state.data)}</section>`;
}
function taDailyMarketCard() {
  const symbols = taDailySymbols(),
    state = taDailyRequestState("market"),
    unavailable = symbols.length
      ? taDailyAvailability("market", taDailyDate())
      : '<p class="ta-unavailable">Escolha os instrumentos monitorados nas Configurações.</p><button class="b s" onclick="taGo(\'settings\')">Escolher instrumentos</button>';
  return `<section class="card ta-market-card"><div class="eyebrow">Contexto observado</div><h2>Condições de mercado</h2>${
    unavailable ||
    `<div class="ta-market-list">${state.data.instruments
      .map((i) => {
        const label =
          { low: "Baixa", moderate: "Moderada", high: "Alta" }[i.volatility] ||
          "Indisponível";
        return `<div class="ta-market-instrument"><div><b>${esc(i.symbol)}</b><span class="badge ta-volatility ta-volatility-${["low", "moderate", "high"].includes(i.volatility) ? i.volatility : "unknown"}"><i aria-hidden="true"></i>Volatilidade ${label}</span></div><p class="muted-note">${i.atrPercent == null ? "ATR indisponível" : `ATR / fechamento: ${Number(i.atrPercent).toFixed(3)}%`}${i.asOf ? " · dados de " + esc(taDailyFormatTime(i.asOf, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })) : ""}${i.delayed ? " · atrasados" : ""}</p>${i.reason ? `<p class="muted-note">${esc(i.reason)}</p>` : ""}</div>`;
      })
      .join(
        "",
      )}</div><details class="ta-method"><summary>Como a volatilidade é classificada</summary><p class="muted-note">${esc(state.data.method?.name || "Método não informado pelo servidor")}. ${state.data.method ? `Baixa abaixo de ${Number(state.data.method.lowBelow)}%; alta a partir de ${Number(state.data.method.highFrom)}%. As demais leituras são moderadas.` : ""} As cores representam intensidade, não direção nem sinal de entrada. Classificação quantitativa, sem previsão de direção.</p></details>`
  }${taDailySource(state.data)}</section>`;
}
function taDailyWeekStats() {
  const today = taDailyDate(),
    weekday = taDailyParts().weekday,
    from = taDailyAdd(today, 1 - weekday),
    previousFrom = taDailyAdd(from, -7),
    previousTo = taDailyAdd(today, -7),
    pool = S.trades.filter(
      (t) =>
        typeof t.close === "string" &&
        /^\d{4}-\d{2}-\d{2}/.test(t.close) &&
        typeof t.pnl === "number" &&
        Number.isFinite(t.pnl),
    ),
    current = pool.filter((t) => day(t) >= from && day(t) <= today),
    previous = pool.filter(
      (t) => day(t) >= previousFrom && day(t) <= previousTo,
    ),
    stats = st(current),
    process = insProcess(current);
  function risk(rows) {
    const details = rows.map(realizedTradeR),
      known = details.filter((r) => r.value !== null && r.source !== "price"),
      total = known.reduce((sum, r) => sum + r.value, 0);
    return {
      n: known.length,
      total: known.length ? total : null,
      avg: known.length ? total / known.length : null,
      complete: rows.length > 0 && known.length === rows.length,
    };
  }
  return {
    from,
    to: today,
    previousFrom,
    previousTo,
    current,
    previous,
    stats,
    process,
    r: risk(current),
    previousR: risk(previous),
  };
}
function taDailyInsight(week) {
  const recent = S.trades
      .filter(
        (t) =>
          typeof t.close === "string" && t.close.slice(0, 10) <= taDailyDate(),
      )
      .sort((a, b) => b.close.localeCompare(a.close))
      .slice(0, 25),
    plan = taCurrentPlan(),
    assessed = recent.filter((t) => typeof t.behavior?.plan === "boolean"),
    errors = recent.filter((t) => Array.isArray(t.behavior?.errors));
  if (errors.length >= 5 && errors.length / Math.max(1, recent.length) >= 0.6) {
    const counts = insErrorCounts(errors),
      best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0],
      def = best && INS_ERRORS.find((e) => e[0] === best[0]);
    if (best && best[1] >= 2 && def)
      return {
        label: "Registro observado",
        text: `${def[1]} aparece em ${best[1]} de ${errors.length} operações com erros avaliados, entre seus últimos ${recent.length} trades.`,
        action: def[2],
      };
  }
  if (assessed.length >= 5 && assessed.length / recent.length >= 0.6) {
    const n = assessed.filter((t) => t.behavior.plan).length;
    return {
      label: "Registro observado",
      text: `${n} de ${assessed.length} trades com plano avaliado foram registrados dentro do plano (${((n / assessed.length) * 100).toFixed(0)}%), entre seus últimos ${recent.length} trades.`,
      action:
        n === assessed.length
          ? "Mantenha o mesmo checklist de confirmação nas próximas operações."
          : "Confira as condições de entrada antes de executar a próxima operação.",
    };
  }
  if (plan) {
    const first = (plan.criteria || []).find(
      (c) => c.required && c.role !== "invalidation",
    );
    return {
      label: "Sugestão baseada no plano",
      text: first
        ? `Prioridade documentada: ${first.label}. Confira sua definição no Plano de Trading antes de executar.`
        : "Prepare sua sessão seguindo os limites e condições registrados no Plano de Trading.",
      action:
        "Use o Trade Analyst para conferir as evidências do próximo setup com essa versão do plano.",
    };
  }
  return {
    label: "Preparação inicial",
    text: "Salve seu Plano de Trading para receber orientações alinhadas às suas próprias regras.",
    action:
      "O assistente só identifica padrões de execução quando existem registros suficientes.",
  };
}
function taDailyPreparation(week, insight) {
  const profile = taDailyProfile(),
    plan = taCurrentPlan(),
    today = taDailyDate();
  const trades = S.trades.filter(
    (t) =>
      typeof t.close === "string" &&
      day(t) === today &&
      typeof t.pnl === "number" &&
      Number.isFinite(t.pnl),
  );
  const net = trades.reduce((sum, t) => sum + t.pnl, 0),
    assessed = trades.filter((t) => typeof t.behavior?.plan === "boolean"),
    followed = assessed.filter((t) => t.behavior.plan).length;
  const connection = typeof taConnection === "object" ? taConnection : {},
    logged = connection.authenticated === true;
  const initials = (profile.name || "Trader")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  const criteria = (plan?.criteria || [])
    .filter((c) => c.required && c.role !== "invalidation")
    .slice(0, 2);
  const state = taDailyRequestState("events", today),
    available =
      state.status === "success" && !taDailyAvailability("events", today);
  const events = available
    ? taDailyEvents(today)
        .filter((e) => e.impact === "high" && taDailyEventTime(e) >= Date.now())
        .slice(0, 2)
    : [];
  return `<div class="ta-preparation"><div class="ta-personal-profile"><span class="ta-profile-avatar" aria-hidden="true">${esc(initials)}</span><div><b>${esc(profile.name || "Nome não informado")}</b><small>${logged ? "Sessão do servidor autenticada" : "Sessão do servidor não autenticada"} · ${esc(profile.timezone)}</small></div><button class="b s" onclick="taGo('settings')">Perfil</button></div>
  <div class="ta-preparation-stats"><div><small>Trades hoje</small><b>${trades.length}</b></div><div><small>Resultado registrado</small><b class="${net < 0 ? "r" : net > 0 ? "g" : ""}">${trades.length ? money(net) : "—"}</b></div><div><small>Dentro do plano</small><b>${assessed.length ? followed + "/" + assessed.length : "Sem avaliação"}</b></div></div>
  <p class="ta-preparation-caption">Fechamentos na data registrada do trade. ${assessed.length}/${trades.length} operações com plano avaliado. Não representa saldo ou posições abertas.</p>
  <div class="ta-preparation-plan"><div class="ta-preparation-heading"><span>Seu plano de hoje</span><button onclick="taGo('plan')">${plan ? "Revisar plano ↗" : "Criar plano ↗"}</button></div>${plan ? `<b>${esc(plan.name)} <small>v${Number(plan.version)}</small></b>${criteria.length ? `<ul>${criteria.map((c) => `<li><strong>${esc(c.label)}</strong>${c.definition ? `<span>${esc(c.definition.slice(0, 180))}${c.definition.length > 180 ? "…" : ""}</span>` : ""}</li>`).join("")}</ul>` : '<p class="muted-note">Revise as condições documentadas antes da próxima entrada.</p>'}${plan.risk?.minRR != null ? `<p class="ta-plan-risk-note">R:R mínimo documentado <b>${Number(plan.risk.minRR).toFixed(2)}</b> · alvo planejado, sem garantia de resultado</p>` : ""}` : '<p class="muted-note">Salve suas regras para preparar a sessão com critérios próprios.</p>'}</div>
  <div class="ta-preparation-focus"><span>Prioridade operacional</span><p>${esc(insight.action)}</p><small>${esc(insight.label)} · ${week.stats.n} trades nesta semana</small></div>
  <div class="ta-preparation-events"><span>Atenção no dia</span>${!available ? "<p>Calendário ainda não confirmado. Confira a fonte antes de executar.</p>" : events.length ? events.map((e) => `<p><b>${esc(taDailyFormatTime(e.time))}</b> ${esc(e.currency)} · ${esc(e.name)}</p>`).join("") : "<p>Sem novos eventos de alto impacto retornados para este recorte de hoje. Isso não garante ausência de notícias.</p>"}<button class="b s" onclick="taGo('economic')">Conferir calendário</button></div>
  </div>`;
}
function taDailyReadyCard() {
  const profile = taDailyProfile(),
    plan = taCurrentPlan(),
    connection = typeof taConnection === "object" ? taConnection : {},
    state = taDailyRequestState("events", taDailyDate());
  const calendarReady =
    state.status === "success" && !taDailyAvailability("events", taDailyDate());
  const recent = S.trades
    .filter(
      (t) =>
        typeof t.close === "string" &&
        day(t) <= taDailyDate() &&
        typeof t.pnl === "number" &&
        Number.isFinite(t.pnl),
    )
    .sort((a, b) => b.close.localeCompare(a.close))[0];
  const rows = [
    {
      label: "Plano operacional",
      ready: !!plan,
      detail: plan
        ? plan.name + " · v" + plan.version
        : "Defina seus critérios antes de avaliar uma entrada.",
      action: plan ? "Revisar" : "Criar plano",
      tab: "plan",
    },
    {
      label: "Acesso aos serviços",
      ready: connection.authenticated === true,
      detail: connection.authenticated
        ? "Sessão autenticada no servidor."
        : "Entre para consultar mercado e serviços online.",
      action: connection.authenticated ? "Ver conexão" : "Entrar",
      tab: "settings",
    },
    {
      label: "Agenda do dia",
      ready: calendarReady,
      detail: calendarReady
        ? "Consulta recebida · confira a cobertura e os horários."
        : "Consulta ainda não confirmada. Confira antes de executar.",
      action: "Conferir",
      tab: "economic",
    },
  ];
  return `<section class="card ta-ready-card"><div class="section-head"><div><div class="eyebrow">Preparação em poucos cliques</div><h2>Seu radar de hoje</h2></div><button type="button" class="b s" onclick="taAssetOpen()">${profile.instruments.length ? "Editar ativos" : "Escolher ativos"}</button></div><div class="ta-radar-assets">${profile.instruments.length ? profile.instruments.map((symbol) => `<span class="badge">${esc(symbol)}</span>`).join("") : "<p>Selecione os ativos que você acompanha, sem digitar símbolos.</p>"}</div><div class="ta-ready-steps">${rows.map((row) => `<div class="ta-ready-step"><span class="ta-ready-state ${row.ready ? "ready" : ""}" aria-hidden="true">${row.ready ? "✓" : "○"}</span><div><b>${row.label}</b><small>${esc(row.detail)}</small></div><button class="b s" onclick="taGo('${row.tab}')">${row.action}</button></div>`).join("")}</div><div class="ta-ready-recent">${recent ? `<div><span>Último fechamento registrado</span><b>${esc(recent.symbol || "Ativo não informado")} <span class="${recent.pnl < 0 ? "r" : recent.pnl > 0 ? "g" : ""}">${money(recent.pnl)}</span></b><small>${esc(recent.close.replace("T", " "))} · consulte o diário antes da próxima decisão.</small></div><button class="b s" onclick="taGo('trades')">Ver histórico</button>` : '<div><b>Já tem um histórico ou plano salvo?</b><small>Traga seu backup anterior para personalizar a preparação.</small></div><label class="b s">Restaurar backup<input type="file" accept=".json" hidden onchange="rb(this.files[0])"></label>'}</div></section>`;
}
function vHome() {
  const profile = taDailyProfile(),
    parts = taDailyParts(),
    hour = Number(parts.hour),
    greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite",
    session = taDailySession(),
    week = taDailyWeekStats(),
    insight = taDailyInsight(week),
    trend =
      week.current.length >= 5 &&
      week.previous.length >= 5 &&
      week.r.complete &&
      week.previousR.complete
        ? `Média de R ${week.r.avg > week.previousR.avg ? "maior" : week.r.avg < week.previousR.avg ? "menor" : "igual"}: ${week.previousR.avg.toFixed(2)}R → ${week.r.avg.toFixed(2)}R (${week.previous.length} e ${week.current.length} trades). Comparação descritiva de dias equivalentes.`
        : "Histórico insuficiente para comparar a tendência em R entre semanas equivalentes.",
    event = taDailyEvents().find(
      (e) => e.impact === "high" && taDailyEventTime(e) >= Date.now(),
    ),
    sessionCopy = !session.configured
      ? "Configure seus horários e documente seu plano para preparar cada sessão."
      : session.status === "active"
        ? "Sua sessão está ativa. Confira o plano e execute somente critérios confirmados."
        : session.status === "finished"
          ? "Sua sessão de hoje terminou. Registre a execução antes de preparar o próximo dia."
          : "Sua próxima sessão começa " +
            taDailyTimeLeft(session.startAt) +
            ". Prepare o plano com calma.";
  return `<div class="ta-home-heading"><div><div class="eyebrow">EliteX · preparação diária</div><h1>${greeting}${profile.name ? ", " + esc(profile.name) : ""}.</h1><p>${esc(sessionCopy)}${event ? " " + esc(event.currency) + " tem evento de alto impacto " + esc(taDailyTimeLeft(event.time)) + "." : ""}</p><span class="muted-note">${esc(new Intl.DateTimeFormat("pt-PT", { dateStyle: "full", timeZone: profile.timezone }).format(new Date()))} · ${esc(profile.timezone)}</span></div><button class="b s" onclick="taDailyRefresh()" ${taDailyState.refreshing ? "disabled" : ""}>${taDailyState.refreshing ? "Atualizando…" : "Atualizar briefing"}</button></div><div class="ta-home-overview"><section class="card ta-session-card"><div class="eyebrow">Seu horário, seu processo</div><h2>Sua sessão de trading</h2>${session.configured ? `<div class="ta-session-title"><strong>${esc(session.label || profile.session.label)}</strong><span class="badge">${{ active: "Ativa", upcoming: "Próxima", finished: "Finalizada" }[session.status]}</span></div><div class="ta-session-hours">${esc(profile.session.start)} <span>—</span> ${esc(profile.session.end)}</div><p>${esc(taDailySessionCountdown(session))}</p><p class="muted-note">${esc(profile.session.timezone)} · ${esc(profile.session.days.map((n) => ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][n - 1]).join(", "))}</p><p class="muted-note">No seu fuso: ${esc(taDailyFormatTime(session.startAt))}–${esc(taDailyFormatTime(session.endAt))}</p>` : '<p class="ta-unavailable">Sua sessão ainda não foi configurada.</p>'}<button class="b s" onclick="taGo('settings')">${session.configured ? "Ajustar sessão" : "Configurar sessão"}</button>${taDailyPreparation(week, insight)}</section><div class="ta-preparation-right">${taDailyMarketCard()}<section class="card ta-assistant-insight"><div class="eyebrow">Seu assistente</div><div class="section-head"><h2>Um foco para hoje</h2><span class="badge">${esc(insight.label)}</span></div>${typeof taBriefingHasResult === "function" && taBriefingHasResult() ? "" : `<p>${esc(insight.text)}</p><p class="muted-note">${esc(insight.action)}</p>`}${typeof taBriefingView === "function" ? taBriefingView() : ""}<button class="b s" onclick="taGo('${taCurrentPlan() ? "analyst" : "plan"}')">${taCurrentPlan() ? "Analisar próximo setup" : "Criar meu plano"}</button></section></div></div>${taDailyReadyCard()}${taDailyCalendarCard()}<div class="ta-quick-actions">${[
    ["analyst", "Analisar setup", "Evidências e regras"],
    ["plan", "Meu Trading Plan", "Sua estratégia documentada"],
    ["trades", "Diário", "Operações e registros"],
    ["dash", "Estatísticas", "Performance detalhada"],
    ["economic", "Calendário econômico", "Eventos e cautela"],
  ]
    .map(
      ([id, label, note]) =>
        `<button class="ta-quick-action" onclick="taGo('${id}')"><b>${label}</b><small>${note}</small><span aria-hidden="true">↗</span></button>`,
    )
    .join(
      "",
    )}<button class="ta-quick-action" onclick="edit(null)"><b>Adicionar trade</b><small>Print ou registro manual</small><span aria-hidden="true">＋</span></button></div><section class="card ta-week-snapshot"><div class="section-head"><div><div class="eyebrow">Sua semana, em perspectiva</div><h2>Performance essencial</h2><p>${week.from} → ${week.to} · datas de fechamento registradas</p></div><button class="b s" onclick="taGo('dash')">Abrir analytics</button></div><div class="grid">${metric("Trades nesta semana", week.stats.n)}${metric("Win rate", week.stats.n ? week.stats.wr.toFixed(1) + "%" : "—")}${metric(week.r.complete ? "R líquido" : "R líquido parcial", week.r.total === null ? "—" : week.r.total.toFixed(2) + "R", "", `${week.r.n}/${week.stats.n} trades com R líquido; R por preço sem custos fica fora deste total`)}${metric("R médio conhecido", week.r.avg === null ? "—" : week.r.avg.toFixed(2) + "R", "", `${week.r.n}/${week.stats.n} trades`)}${metric("Profit factor", week.stats.n && (week.stats.w || week.stats.l) ? (isFinite(week.stats.pf) ? week.stats.pf.toFixed(2) : "∞") : "—", "", "Sobre resultados monetários líquidos")}${metric("Cumprimento do plano", week.process.plan.value === null ? "—" : week.process.plan.value.toFixed(0) + "%", "", `${week.process.plan.n}/${week.stats.n} trades com plano avaliado`)}</div><p class="muted-note">${esc(trend)}</p></section>`;
}
function vEconomicCalendar() {
  const date = taDailyState.calendarDate || taDailyDate(),
    state = taDailyRequestState("events", date),
    unavailable = taDailyAvailability("events", date),
    currencies = taDailyCurrencies();
  return `<section class="card ta-economic-toolbar"><div class="section-head"><div><div class="eyebrow">Calendário econômico</div><h2>Prepare-se para os eventos</h2><p>Horários em ${esc(taDailyProfile().timezone)}. Eventos observados no provedor, sem dados simulados.</p></div><button class="b s" onclick="taDailyRefresh()" ${taDailyState.refreshing ? "disabled" : ""}>Atualizar</button></div><div class="row"><button class="b s" aria-label="Dia anterior no calendário econômico" onclick="taEconomicDate(taDailyAdd('${date}',-1))">‹</button><label>Data <input type="date" aria-label="Data do calendário econômico" value="${date}" onchange="taEconomicDate(this.value)"></label><button class="b s" aria-label="Próximo dia no calendário econômico" onclick="taEconomicDate(taDailyAdd('${date}',1))">›</button><button class="b s" onclick="taEconomicDate(taDailyDate())">Hoje</button><label class="ta-currency-filter"><input type="checkbox" ${taDailyState.relevantOnly ? "checked" : ""} ${currencies.length ? "" : "disabled"} onchange="taDailyState.relevantOnly=this.checked;R()"> Somente moedas dos meus instrumentos</label></div><p class="muted-note">${currencies.length ? "Moedas monitoradas: " + currencies.join(", ") : "Nenhuma moeda identificada nos instrumentos monitorados; exibindo todas as moedas retornadas."}</p></section><section class="card ta-economic-events">${unavailable || taDailyEventList(taDailyEvents(date))}${taDailySource(state.data)}<p class="muted-note">Atenção informativa: eventos de alto impacto dentro da sessão são destacados. Janela configurada: ${Number(taDailyProfile().newsBeforeMinutes) || 0} min antes e ${Number(taDailyProfile().newsAfterMinutes) || 0} min depois. A disponibilidade e o atraso dependem do plano contratado com o provedor.</p></section>`;
}
