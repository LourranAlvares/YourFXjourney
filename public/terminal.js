/* Original terminal components. Financial calculations remain in the journal. */
const terminalCharts = new Map();
let terminalChartSequence = 0;
const terminalWindows = new Map();
let terminalCollapsed = false;
try {
  terminalCollapsed = localStorage.getItem("yfx-terminal-nav") === "collapsed";
} catch {}
function terminalIcon(name) {
  const paths = {
    home: "M3 10 12 3l9 7v10H3z M9 20v-7h6v7",
    dash: "M3 18V6m0 12h18 M6 14l4-5 4 3 6-8",
    trades: "M4 7h15m-4-4 4 4-4 4 M20 17H5m4-4-4 4 4 4",
    cal: "M4 5h16v16H4z M4 10h16 M8 3v4 M16 3v4",
    analyst: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14m5-2 6 6",
    plan: "M5 3h14v18H5z M8 8h8 M8 12h8 M8 16h5",
    economic: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l4 2",
    ins: "M12 3v4 M12 17v4 M3 12h4 M17 12h4 M8 12l3 3 5-6",
    rev: "M5 3h14v18H5z M8 7h8 M8 11h8 M8 15h5",
    ana: "M4 20V10h4v10 M10 20V4h4v16 M16 20V7h4v13",
    pat: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    risk: "M12 3 3 7v6c0 4 9 8 9 8s9-4 9-8V7z M12 8v5 M12 16v1",
    str: "M5 21V3h14l-3 5 3 5H5",
    share: "M7 17 20 4 M10 4h10v10 M4 7v13h13",
    settings:
      "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.dash}"/></svg>`;
}
function terminalToggleNav() {
  terminalCollapsed = !terminalCollapsed;
  try {
    localStorage.setItem(
      "yfx-terminal-nav",
      terminalCollapsed ? "collapsed" : "expanded",
    );
  } catch {}
  R();
}
function terminalBackdrop() {
  if (document.querySelector(".terminal-market-backdrop")) return;
  const layer = document.createElement("div");
  layer.className = "terminal-market-backdrop";
  layer.setAttribute("aria-hidden", "true");
  layer.setAttribute("role", "presentation");
  const candles = Array.from({ length: 48 }, (_, i) => {
    const x = i * 40 + 8,
      center = 150 + Math.sin(i * 0.55) * 56 + Math.cos(i * 0.19) * 30,
      body = 12 + ((i * 13) % 35),
      up = i % 3 !== 0;
    return `<g class="ambient-candle ${up ? "ambient-rise" : "ambient-fall"}"><line x1="${x}" x2="${x}" y1="${center - body - 20}" y2="${center + body + 18}"/><rect x="${x - 6}" y="${center - body / 2}" width="12" height="${body}" rx="2"/></g>`;
  }).join("");
  const points = Array.from(
    { length: 97 },
    (_, i) =>
      `${i * 20},${230 + Math.sin(i * 0.23) * 48 + Math.cos(i * 0.11) * 24 - i * 0.6}`,
  ).join(" ");
  layer.innerHTML = `<svg viewBox="0 0 1920 400" preserveAspectRatio="none" focusable="false"><g class="ambient-market-track">${candles}<g transform="translate(1920 0)">${candles}</g></g><g class="ambient-price-track"><polyline points="${points}"/><polyline points="${points}" transform="translate(1920 0)"/></g></svg>`;
  document.body.prepend(layer);
}
function terminalBeginRender() {
  if (typeof premiumBeforeRender === "function") premiumBeforeRender();
  terminalBackdrop();
  terminalCharts.clear();
  if (typeof premiumKeepExpanded === "function") premiumKeepExpanded();
  terminalChartSequence = 0;
  document.body.classList.toggle("terminal-collapsed", terminalCollapsed);
  document.body.dataset.workspace = tab;
}
function terminalTopbar() {
  const title = tabs.find((t) => t[0] === tab)?.[1] || "Início";
  return `<div class="terminal-topbar"><div class="terminal-breadcrumb"><button class="terminal-icon-button" onclick="terminalToggleNav()" aria-label="${terminalCollapsed ? "Expandir" : "Recolher"} navegação" aria-expanded="${!terminalCollapsed}">☰</button><span class="terminal-wordmark">ELITE<strong>X</strong><span> / </span></span><span>${esc(title)}</span></div><div class="terminal-top-status"><span class="terminal-storage" title="Trades e planos permanecem no armazenamento deste navegador">Dados neste navegador</span><button class="terminal-connection" onclick="taGo('settings')"><i class="${taConnection.authenticated ? "connected" : ""}"></i>${esc(taApiState())}</button></div></div>`;
}
function terminalChart(
  data,
  {
    id,
    height = 300,
    format = money,
    label = "Performance",
    daily = false,
    readout = false,
  } = {},
) {
  id = id || "terminal-chart-" + ++terminalChartSequence;
  const signature = data.map((p) => p.date + ":" + p.value).join("|");
  let windowState = terminalWindows.get(id);
  if (!windowState || windowState.signature !== signature) {
    windowState = { signature, start: 0, end: data.length };
    terminalWindows.set(id, windowState);
  }
  const model = {
    id,
    data,
    height,
    format,
    label,
    daily,
    readout,
    state: windowState,
  };
  terminalCharts.set(id, model);
  return `<div class="terminal-chart" data-terminal-chart="${id}" role="group" aria-label="${esc(label)}">${terminalDrawChart(model)}</div>`;
}
function terminalDrawChart(model) {
  const { id, data, height: H, format, label, daily, readout, state } = model;
  const visible = data.slice(state.start, state.end),
    n = visible.length;
  if (!n)
    return '<div class="empty-chart"><b>Aguardando operações</b><span>O gráfico usa somente seus registros.</span></div>';
  const W =
      model.plotWidth ||
      Math.max(
        290,
        Math.min(
          1200,
          window.innerWidth - (window.innerWidth > 760 ? 260 : 40),
        ),
      ),
    L = 14,
    T = 20,
    B = H - 34,
    R = W - 114;
  const lo = Math.min(0, ...visible.map((p) => p.value)),
    hi = Math.max(0, ...visible.map((p) => p.value)),
    span = hi - lo || 1,
    min = lo - span * 0.08,
    max = hi + span * 0.08;
  const x = (i) => (n === 1 ? (L + R) / 2 : L + (i / (n - 1)) * (R - L)),
    y = (v) => B - ((v - min) / (max - min)) * (B - T);
  model.geometry = { W, L, T, B, R, x, y, visible };
  const describe = (p) =>
    `${p.date} · ${label}: ${format(p.value)}${p.net != null ? " · P&L diário: " + money(p.net) : ""}${p.n != null ? " · " + p.n + " trades" : ""}${p.r != null ? " · " + p.r.toFixed(2) + "R" : ""}${p.coverage != null ? " · " + p.coverage + " com risco" : ""}`;
  model.describe = describe;
  let grid = "";
  for (let i = 0; i <= 4; i++) {
    const v = min + ((max - min) * i) / 4,
      Y = y(v);
    grid += `<line x1="${L}" x2="${R}" y1="${Y}" y2="${Y}" class="terminal-gridline"/><text x="${R + 12}" y="${Y + 4}" class="terminal-axis">${esc(format(v))}</text>`;
  }
  const dates = [
    ...new Set(
      R - L < 400
        ? [0, n - 1]
        : [0, Math.floor((n - 1) / 3), Math.floor(((n - 1) * 2) / 3), n - 1],
    ),
  ];
  for (const i of dates) {
    grid += `<line x1="${x(i)}" x2="${x(i)}" y1="${T}" y2="${B}" class="terminal-gridline"/><text x="${x(i)}" y="${H - 10}" text-anchor="${i === 0 ? "start" : i === n - 1 ? "end" : "middle"}" class="terminal-axis">${esc(visible[i].date)}</text>`;
  }
  const color =
      visible.at(-1).value < 0
        ? "var(--r)"
        : visible.at(-1).value > 0
          ? "var(--g)"
          : "var(--secondary)",
    points = visible.map((p, i) => x(i) + "," + y(p.value)).join(" ");
  const graph = daily
    ? visible
        .map((p, i) => {
          const width = Math.min(40, ((R - L) / n) * 0.65);
          return `<rect x="${x(i) - width / 2}" y="${Math.min(y(0), y(p.value))}" width="${width}" height="${Math.max(1, Math.abs(y(p.value) - y(0)))}" fill="${p.value < 0 ? "var(--r)" : "var(--g)"}" opacity=".75"/>`;
        })
        .join("")
    : `<polygon points="${x(0)},${y(0)} ${points} ${x(n - 1)},${y(0)}" fill="${color}" opacity=".045"/><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.6" vector-effect="non-scaling-stroke"/>`;
  const marks = visible
    .map(
      (p, i) =>
        `<circle class="chart-point" cx="${x(i)}" cy="${y(p.value)}" r="8" fill="transparent" tabindex="0" role="img" aria-label="${esc(describe(p))}" data-terminal-point="${i}" data-info="${esc(describe(p))}"></circle>`,
    )
    .join("");
  return `<div class="terminal-chart-toolbar"><span class="terminal-chart-label">${esc(label)}</span><div class="terminal-chart-tools"><button type="button" aria-label="Pontos anteriores" data-chart-action="previous" ${state.start === 0 ? "disabled" : ""}>‹</button><button type="button" aria-label="Diminuir zoom" data-chart-action="out" ${n === data.length ? "disabled" : ""}>−</button><span>${n}/${data.length}</span><button type="button" aria-label="Aumentar zoom" data-chart-action="in" ${n <= 2 ? "disabled" : ""}>+</button><button type="button" aria-label="Próximos pontos" data-chart-action="next" ${state.end === data.length ? "disabled" : ""}>›</button><button type="button" aria-label="Restaurar gráfico" data-chart-action="reset">Tudo</button><button type="button" aria-label="${model.expanded ? "Fechar gráfico ampliado" : "Ampliar gráfico"}" data-chart-action="expand">${model.expanded ? "⤡" : "⤢"}</button></div></div><div ${readout ? 'id="chart-readout"' : ""} class="chart-readout" role="status">${esc(describe(visible.at(-1)))}</div><svg class="chart-svg terminal-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="group" aria-label="${esc(label)} por data" style="height:${H}px">${grid}<line x1="${R}" x2="${R}" y1="0" y2="${H}" stroke="var(--bd)"/><line x1="${L}" x2="${R}" y1="${y(0)}" y2="${y(0)}" stroke="var(--mu)" opacity=".25"/>${graph}<g class="terminal-crosshair" visibility="hidden"><line class="terminal-cross-x" y1="${T}" y2="${B}"/><line class="terminal-cross-y" x1="${L}" x2="${R}"/><circle r="3" fill="${color}"/></g>${marks}</svg><output class="premium-chart-tooltip" aria-hidden="true" hidden></output><div class="terminal-chart-caption">${state.start + 1}–${state.end} de ${data.length} pontos · Cursor / toque para inspecionar · Arraste para navegar · Ctrl + roda para zoom</div>`;
}
function terminalAfterRender() {
  document.querySelectorAll("[data-terminal-chart]").forEach((element) => {
    const model = terminalCharts.get(element.dataset.terminalChart);
    if (!model) return;
    model.plotWidth = Math.max(260, Math.round(element.clientWidth));
    element.innerHTML = terminalDrawChart(model);
  });
}
function terminalChartAction(id, action) {
  const model = terminalCharts.get(id);
  if (!model) return;
  if (action === "expand") {
    premiumExpandChart(id);
    return;
  }
  if (action === "in" || action === "out") {
    premiumZoom(id, action === "in" ? 0.65 : 1.6);
    return;
  }
  const s = model.state,
    n = s.end - s.start,
    total = model.data.length,
    step = Math.max(1, Math.floor(n / 4));
  if (action === "reset") {
    s.start = 0;
    s.end = total;
  }
  if (action === "in" && n > 2) {
    const size = Math.max(2, Math.ceil(n * 0.65));
    s.start += Math.floor((n - size) / 2);
    s.end = s.start + size;
  }
  if (action === "out") {
    const size = Math.min(total, Math.ceil(n * 1.6));
    s.start = Math.max(
      0,
      Math.min(total - size, s.start - Math.floor((size - n) / 2)),
    );
    s.end = s.start + size;
  }
  if (action === "previous") {
    s.start = Math.max(0, s.start - step);
    s.end = s.start + n;
  }
  if (action === "next") {
    s.end = Math.min(total, s.end + step);
    s.start = s.end - n;
  }
  const element = document.querySelector(`[data-terminal-chart="${id}"]`);
  if (element) premiumRedrawChart(model, element);
}
function terminalInspect(root, index) {
  const model = terminalCharts.get(root.dataset.terminalChart);
  if (!model?.geometry) return;
  const svg = root.querySelector("svg");
  if (model.inspectedSVG === svg && model.inspectedIndex === index) return;
  model.inspectedSVG = svg;
  model.inspectedIndex = index;
  const { visible, x, y } = model.geometry;
  index = Math.max(0, Math.min(visible.length - 1, index));
  const point = root.querySelectorAll(".chart-point")[index];
  if (!point) return;
  const readout = root.querySelector(".chart-readout");
  if (readout.textContent !== point.dataset.info)
    readout.textContent = point.dataset.info;
  const cross = root.querySelector(".terminal-crosshair");
  cross.setAttribute("visibility", "visible");
  cross.querySelector(".terminal-cross-x").setAttribute("x1", x(index));
  cross.querySelector(".terminal-cross-x").setAttribute("x2", x(index));
  cross
    .querySelector(".terminal-cross-y")
    .setAttribute("y1", y(visible[index].value));
  cross
    .querySelector(".terminal-cross-y")
    .setAttribute("y2", y(visible[index].value));
  cross.querySelector("circle").setAttribute("cx", x(index));
  cross.querySelector("circle").setAttribute("cy", y(visible[index].value));
}
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-chart-action]");
  if (button) {
    const root = button.closest("[data-terminal-chart]");
    terminalChartAction(root.dataset.terminalChart, button.dataset.chartAction);
  }
});
document.addEventListener("focusin", (event) => {
  const point = event.target.closest("[data-terminal-point]");
  if (point)
    terminalInspect(
      point.closest("[data-terminal-chart]"),
      +point.dataset.terminalPoint,
    );
});
function terminalPerformanceChart(ts) {
  const canBalance = S.balanceConfirmed && !F.sym && !F.strat,
    canR = ts.some((t) => t.risk > 0);
  if ((chartMode === "balance" && !canBalance) || (chartMode === "r" && !canR))
    chartMode = "pnl";
  const data = chartData(ts, chartMode),
    isR = chartMode === "r";
  return `<section class="card terminal-performance"><div class="section-head"><div><div class="eyebrow">Performance da conta</div><h2>Evolução dos resultados</h2><p>${chartMode === "balance" ? "Saldo inicial confirmado + resultados fechados; não representa equity em tempo real." : "Resultados fechados · período selecionado"}</p></div><label><span class="sr-only">Visualização do gráfico</span><select aria-label="Visualização do gráfico" onchange="chartMode=this.value;R()">${Object.entries(
    chartNames,
  )
    .map(
      ([key, name]) =>
        `<option value="${key}" ${chartMode === key ? "selected" : ""} ${(key === "balance" && !canBalance) || (key === "r" && !canR) ? "disabled" : ""}>${name}</option>`,
    )
    .join(
      "",
    )}</select></label></div>${data.length ? terminalChart(data, { id: "performance", height: 400, label: chartNames[chartMode], format: isR ? (v) => v.toFixed(2) + "R" : money, daily: chartMode === "daily", readout: true }) : '<div class="empty-chart"><b>A sua performance começa aqui</b><span>Adicione ou importe trades para visualizar os resultados.</span><button class="b s" onclick="taGo(\'trades\')">Abrir Trades</button></div>'}<div class="chart-foot"><span>${isR ? "R inclui apenas trades com risco informado." : "Datas e horários seguem os registros originais, sem conversão de fuso."}</span><span>${ts.length} trades</span></div></section>`;
}
function terminalLine(values, height = 170, dates = []) {
  return terminalChart(
    values.map((value, i) => ({ date: dates[i] || "Trade " + (i + 1), value })),
    { height: Math.max(190, height), label: "Performance registrada" },
  );
}
function terminalBars(groups, keys) {
  keys = keys.filter((key) => Object.hasOwn(groups, key));
  if (!keys.length) return '<p class="mu">Sem dados no período.</p>';
  const maximum = Math.max(
    1e-9,
    ...keys.map((key) => Math.abs(groups[key].net)),
  );
  return `<div class="terminal-bars">${keys
    .map((key) => {
      const s = groups[key],
        negative = s.net < 0;
      return `<div class="terminal-bar-row" tabindex="0" title="${esc(key)} · ${s.n} trades · ${s.wr.toFixed(1)}% win"><div><span>${esc(key)}</span><b class="${cl(s.net)}">${signed(s.net)}</b></div><div class="terminal-bar-track"><i style="${negative ? "right:50%" : "left:50%"};width:${(Math.abs(s.net) / maximum) * 50}%;background:var(--${negative ? "r" : "g"})"></i></div><small>${s.n} trades · ${s.wr.toFixed(0)}% win · PF ${Number.isFinite(s.pf) ? s.pf.toFixed(2) : "∞"}</small></div>`;
    })
    .join("")}</div>`;
}
function terminalDashboardPanels(ts) {
  const s = st(ts),
    dd = chartData(ts, "dd");
  return `<div class="terminal-analysis-grid">${performanceChart(ts)}<aside class="card terminal-context"><div class="section-head"><div><div class="eyebrow">Risco observado</div><h2>Drawdown</h2></div><span class="badge">Fechamento diário</span></div>${dd.length ? terminalChart(dd, { id: "dashboard-drawdown", height: 210, label: "Drawdown", format: money }) : '<p class="mu">Sem operações no período.</p>'}<dl><div><dt>Queda máxima no período</dt><dd class="r">${s.n ? money(s.dd) : "—"}</dd></div><div><dt>R realizado conhecido</dt><dd>${s.rn ? s.totR.toFixed(2) + "R" : "—"}</dd></div><div><dt>Cobertura de risco</dt><dd>${s.rn} / ${s.n} trades</dd></div></dl></aside></div><div class="terminal-breakdowns"><section class="card"><div class="eyebrow">Distribuição do resultado</div><h2>Por ativo</h2>${terminalBars(
    grp(ts, (t) => t.symbol || "Não informado"),
    [...new Set(ts.map((t) => t.symbol || "Não informado"))],
  )}</section><section class="card"><div class="eyebrow">Horário registrado</div><h2>Por sessão</h2>${terminalBars(grp(ts, sess), [...new Set(ts.map(sess))])}<p class="muted-note">Sessões calculadas conforme os horários originais dos trades.</p></section></div><section class="card terminal-recent"><div class="section-head"><h2>Operações recentes</h2><button class="b s" onclick="taGo('trades')">Abrir histórico ↗</button></div>${ts.length ? terminalRecentTrades(ts) : '<p class="mu">Nenhuma operação no período.</p>'}</section>`;
}
function terminalRecentTrades(ts) {
  /* The dashboard privacy preference also covers this supporting table. */
  const rows = [...ts]
    .sort((a, b) => b.close.localeCompare(a.close))
    .slice(0, 5);
  return `<div class="table-wrap"><table><thead><tr><th>Fechamento</th><th>Ativo</th><th>Lado</th><th>P&L</th><th>R realizado</th></tr></thead><tbody>${rows.map((t) => `<tr tabindex="0" data-trade-id="${esc(t.id)}" onclick="edit(this.dataset.tradeId)" onkeydown="if(event.key==='Enter')edit(this.dataset.tradeId)"><td>${esc(t.close.replace("T", " "))}</td><td>${esc(t.symbol)}</td><td>${t.side === "long" ? "Compra" : "Venda"}</td><td class="${cl(t.pnl)}">${signed(t.pnl)}</td><td>${t.risk > 0 ? (t.pnl / t.risk).toFixed(2) + "R" : "—"}</td></tr>`).join("")}</tbody></table></div>`;
}
let terminalTradeSort = { key: "close", direction: -1 };
function terminalSortTrades(key) {
  terminalTradeSort = {
    key,
    direction: terminalTradeSort.key === key ? -terminalTradeSort.direction : 1,
  };
  R();
}
function terminalTradeTable(ts) {
  if (!ts.length) return "";
  const columns = [
    ["close", "Fechamento"],
    ["symbol", "Ativo"],
    ["side", "Lado"],
    ["entry", "Entrada"],
    ["exit", "Saída"],
    ["pnl", "P&L"],
    ["r", "R"],
    ["strategy", "Estratégia"],
  ];
  const value = (t, key) =>
    key === "r" ? (t.risk > 0 ? t.pnl / t.risk : null) : t[key];
  const sorted = [...ts].sort((a, b) => {
    const av = value(a, terminalTradeSort.key),
      bv = value(b, terminalTradeSort.key);
    if (av == null) return bv == null ? 0 : 1;
    if (bv == null) return -1;
    return (
      (typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv))) * terminalTradeSort.direction
    );
  });
  return `<div class="table-wrap terminal-trade-table"><table><thead><tr>${columns.map(([key, label]) => `<th scope="col" aria-sort="${terminalTradeSort.key === key ? (terminalTradeSort.direction === 1 ? "ascending" : "descending") : "none"}"><button onclick="terminalSortTrades('${key}')">${label}<span aria-hidden="true">${terminalTradeSort.key === key ? (terminalTradeSort.direction === 1 ? "↑" : "↓") : "↕"}</span></button></th>`).join("")}<th scope="col">Diário</th></tr></thead><tbody>${sorted.map((t) => `<tr tabindex="0" data-trade-id="${esc(t.id)}" onclick="edit(this.dataset.tradeId)" onkeydown="if(event.key==='Enter')edit(this.dataset.tradeId)"><td>${esc(t.close.replace("T", " "))}</td><td><b>${esc(t.symbol)}</b></td><td><span class="badge">${t.side === "long" ? "Compra" : "Venda"}</span></td><td>${esc(t.entry ?? "—")}</td><td>${esc(t.exit ?? "—")}</td><td class="${cl(t.pnl)}">${f2(t.pnl)}${t.est ? " *" : ""}</td><td class="${cl(t.pnl)}">${t.risk > 0 ? (t.pnl / t.risk).toFixed(2) : "—"}</td><td>${esc(t.strategy)}</td><td>${t.img?.length ? '<span class="badge">Print</span> ' : ""}${t.notes || t.lesson ? '<span class="badge">Nota</span>' : ""}</td></tr>`).join("")}</tbody></table></div>`;
}
