function eliteDashSessionName(t) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t.open || "")
    ? sess(t)
    : "Não informado";
}
/* Compact dashboard: projections of the existing journal, never sample performance. */
let eliteDashSession = "",
  eliteDashUnit = "money",
  eliteDashPeriod = "week";
function eliteDashModel(ts) {
  const rows = ts.filter(
      (t) =>
        t.close &&
        rNumber(t.pnl) !== null &&
        (!eliteDashSession || eliteDashSessionName(t) === eliteDashSession),
    ),
    known = rows.map(realizedTradeR),
    complete = rows.length > 0 && known.every((r) => r.value !== null);
  if (eliteDashUnit === "r" && !complete) eliteDashUnit = "money";
  const values = rows.map((t, i) => ({
    ...t,
    pnl: eliteDashUnit === "r" ? known[i].value : t.pnl,
  }));
  return {
    rows,
    values,
    stats: st(values),
    complete,
    known: known.filter((r) => r.value !== null).length,
  };
}
function eliteDashFormat(n) {
  return dashboardMoneyHidden()
    ? "••••"
    : eliteDashUnit === "r"
      ? Number(n).toFixed(2) + " R"
      : money(n);
}
function eliteDashSigned(n) {
  return !dashboardMoneyHidden() && n > 0
    ? "+" + eliteDashFormat(n)
    : eliteDashFormat(n);
}
function eliteDashChangeUnit(unit) {
  eliteDashUnit = unit;
  chartMode = unit === "r" ? "r" : "pnl";
  R();
}
function eliteDashSpark(data, color = "var(--g)") {
  if (data.length < 2) return "";
  const lo = Math.min(...data),
    range = Math.max(...data) - lo || 1,
    points = data
      .slice(-32)
      .map(
        (v, i, a) =>
          `${(i * 100) / (a.length - 1)},${36 - ((v - lo) / range) * 32}`,
      )
      .join(" ");
  return `<svg class="elite-dash-spark" viewBox="0 0 100 40" aria-hidden="true"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg>`;
}
function eliteDashDonut(parts, center, label, small = false) {
  const total = parts.reduce((n, p) => n + p.n, 0),
    c = 251.327;
  let offset = 0;
  return `<div class="elite-dash-donut ${small ? "mini" : ""}"><svg viewBox="0 0 100 100" role="img" aria-label="${esc(parts.map((p) => p.label + ": " + p.n).join(", "))}"><circle cx="50" cy="50" r="40" fill="none" stroke="var(--ring-track, #333a43)" stroke-width="10"/>${parts
    .map((p) => {
      const length = total ? (p.n / total) * c : 0,
        mark = `<circle cx="50" cy="50" r="40" fill="none" stroke="${p.color}" stroke-width="10" stroke-dasharray="${length} ${c - length}" stroke-dashoffset="${-offset}" transform="rotate(-90 50 50)"/>`;
      offset += length;
      return mark;
    })
    .join(
      "",
    )}</svg>${small ? "" : `<span><b style="font-size:${Math.min(24, Math.max(10, 104 / Math.max(1, String(center).length)))}px">${esc(center)}</b></span><small class="elite-dash-donut-label">${esc(label)}</small>`}</div>`;
}
function eliteDashDistribution(parts, center, label) {
  const total = parts.reduce((n, p) => n + p.n, 0);
  return `<div class="elite-dash-distribution">${eliteDashDonut(parts, center, label)}<ul>${parts.map((p) => `<li><i style="background:${p.color}"></i><span>${p.label}</span><b>${p.n} <small>(${total ? ((p.n / total) * 100).toFixed(1) : "0.0"}%)</small></b></li>`).join("")}</ul></div>`;
}
function eliteDashBars(
  groups,
  asset = false,
  chronological = false,
  format = eliteDashFormat,
  signedFormat = eliteDashSigned,
) {
  const entries = Object.entries(groups).sort((a, b) =>
      chronological ? a[0].localeCompare(b[0]) : b[1].net - a[1].net,
    ),
    first = chronological ? entries.slice(-8) : entries.slice(0, 5);
  if (!chronological && entries.length > 5)
    first.push([
      "Outros",
      {
        net: entries.slice(5).reduce((n, [, s]) => n + s.net, 0),
        n: entries.slice(5).reduce((n, [, s]) => n + s.n, 0),
      },
    ]);
  if (!first.length)
    return '<div class="elite-dash-empty">Sem operações no período.</div>';
  const hi = Math.max(0, ...first.map(([, s]) => s.net)),
    lo = Math.min(0, ...first.map(([, s]) => s.net)),
    range = hi - lo || 1,
    y = (v) => 22 + ((hi - v) / range) * 125,
    zero = y(0),
    width = first.length * 60 + 64;
  return `<svg class="elite-dash-bars" viewBox="0 0 ${width} 180" role="img" aria-label="Resultados registrados por grupo">${[
    0, 0.5, 1,
  ]
    .map((f) => {
      const v = hi - range * f,
        yy = y(v);
      return `<line x1="55" x2="${width}" y1="${yy}" y2="${yy}" stroke="#1c363d"/><text x="49" y="${yy + 3}" text-anchor="end">${esc(format(v))}</text>`;
    })
    .join(
      "",
    )}${first.map(([name, s], i) => `<g ${asset && name !== "Outros" ? `role="button" tabindex="0" data-asset="${esc(name)}" onclick="F.sym=this.dataset.asset;R()" onkeydown="if(event.key==='Enter'){F.sym=this.dataset.asset;R()}"` : ""}><title>${esc(name)}: ${esc(signedFormat(s.net))} · ${s.n} trades</title><rect x="${70 + i * 60}" y="${Math.min(zero, y(s.net))}" width="24" height="${Math.max(1, Math.abs(zero - y(s.net)))}" rx="2" fill="${s.net > 0 ? "var(--chart-positive, #00d7b0)" : s.net < 0 ? "#ff476b" : "#7a929e"}"/><text x="${82 + i * 60}" y="168" text-anchor="middle">${esc(name.length > 10 ? name.slice(0, 9) + "…" : name)}</text></g>`).join("")}</svg>`;
}
function eliteDashSeries(m, mode) {
  if (mode === "balance") return accountHistoryCurve();
  const values =
    mode === "r" && eliteDashUnit !== "r"
      ? m.rows
          .filter((t) => realizedTradeR(t).value !== null)
          .map((t) => ({ ...t, pnl: realizedTradeR(t).value }))
      : m.values;
  let total = 0,
    peak = 0;
  return Object.entries(grp(values, day))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, s]) => {
      if (mode === "dd")
        s.ts.forEach((t) => {
          total += t.pnl;
          peak = Math.max(peak, total);
        });
      else total += s.net;
      return {
        date,
        value: mode === "daily" ? s.net : mode === "dd" ? total - peak : total,
        net: s.net,
        n: s.n,
      };
    });
}
function eliteDashboardView(ts) {
  const m = eliteDashModel(ts);
  if (chartMode === "balance" && !S.balanceConfirmed) chartMode = "pnl";
  if (chartMode === "r" && !m.known) chartMode = "pnl";
  const s = m.stats,
    has = s.n > 0,
    daily = eliteDashSeries(m, "daily"),
    dd = eliteDashSeries(m, "dd"),
    formatMode =
      chartMode === "balance"
        ? money
        : chartMode === "r" && eliteDashUnit !== "r"
          ? (n) => (dashboardMoneyHidden() ? "••••" : n.toFixed(2) + " R")
          : eliteDashFormat;

  const chart = eliteDashSeries(m, chartMode),
    metricCard = (label, value, color, note, visual = "") =>
      metric(label, value, color, note).replace("</div>", visual + "</div>"),
    wins = [
      { label: "Vitórias", n: s.w, color: "var(--chart-positive, #00d7b0)" },
      { label: "Derrotas", n: s.l, color: "#ff476b" },
      { label: "Empates", n: s.n - s.w - s.l, color: "#718c9b" },
    ],
    direction = [
      {
        label: "Compra",
        n: m.rows.filter((t) => t.side === "long").length,
        color: "var(--chart-positive, #00d7b0)",
      },
      {
        label: "Venda",
        n: m.rows.filter((t) => t.side === "short").length,
        color: "#ff476b",
      },
      {
        label: "Não informado",
        n: m.rows.filter((t) => !["long", "short"].includes(t.side)).length,
        color: "#718c9b",
      },
    ],
    sessions = grp(m.values, eliteDashSessionName),
    period = grp(m.values, (t) =>
      eliteDashPeriod === "month"
        ? day(t).slice(0, 7)
        : insAddDays(day(t), -(new Date(day(t) + "T12:00").getDay() + 6) % 7),
    );
  return `<section class="elite-dashboard"><div class="smc-result-coverage"><small>${m.known}/${m.rows.length} trades com R conhecido${m.rows.some((t) => t.est) ? " · contém P&L estimado *" : ""}</small></div><div class="primary-metrics elite-dash-metrics">${
    metricCard(
      "P&L líquido",
      has ? eliteDashSigned(s.net) : "—",
      cl(s.net),
      has ? "Resultado no período" : "Aguardando operações",
      eliteDashSpark(s.cv),
    ) +
    metricCard(
      "Taxa de acerto",
      has ? s.wr.toFixed(1) + "%" : "—",
      "",
      `${s.w} ganhos · ${s.l} perdas`,
      eliteDashDonut(wins, "", "", true),
    ) +
    metricCard(
      "Profit factor",
      has && (s.w || s.l)
        ? Number.isFinite(s.pf)
          ? s.pf.toFixed(2)
          : "∞"
        : "—",
      "",
      "Lucro bruto ÷ perda bruta",
    ) +
    metricCard(
      "Expectancy / trade",
      has ? eliteDashSigned(s.ex) : "—",
      cl(s.ex),
      "Resultado líquido médio",
    ) +
    metricCard(
      "Drawdown máximo",
      has ? eliteDashFormat(-s.dd) : "—",
      s.dd ? "r" : "",
      "Queda desde o pico",
      eliteDashSpark(
        dd.map((p) => p.value),
        "var(--r)",
      ),
    ) +
    metricCard(
      "Total de operações",
      s.n,
      "",
      "Fechadas no período",
      eliteDashSpark(
        daily.map((p) => p.n),
        "#829eae",
      ),
    )
  }</div>
    <div class="elite-dash-charts"><section class="card terminal-performance"><div class="section-head"><h2>Evolução do resultado</h2><label><span class="sr-only">Visualização do gráfico</span><select aria-label="Visualização do gráfico" onchange="chartMode=this.value;R()">${Object.entries(
      chartNames,
    )
      .map(
        ([key, label]) =>
          `<option value="${key}" ${chartMode === key ? "selected" : ""} ${(key === "balance" && !S.balanceConfirmed) || (key === "r" && !m.known) ? "disabled" : ""}>${label}</option>`,
      )
      .join(
        "",
      )}</select></label></div>${terminalChart(chart, { id: "performance", height: 200, label: chartNames[chartMode], format: formatMode, netFormat: formatMode, daily: chartMode === "daily", readout: true, includeZero: chartMode !== "balance" })}<div class="elite-dash-chart-note">${chartMode === "balance" ? "Saldo inicial + P&L do histórico completo; sem depósitos, saques ou posições abertas." : chartMode === "r" && !m.complete ? `R parcial: somente ${m.known}/${m.rows.length} operações. Sem R informado não equivale a zero.` : "Resultados fechados · período selecionado."}</div><button class="scene-link" onclick="chartMode='balance';R()" ${S.balanceConfirmed ? "" : "disabled"}>Saldo desde o início</button>${!S.balanceConfirmed ? '<button class="scene-link" onclick="diaryConfigureBalance()">Configurar saldo inicial</button>' : ""}</section></div>
    <details class="smc-dashboard-disclosure" ${innerWidth > 760 ? "open" : ""}><summary>Comparar resultados <span>Ativos, sessões e operações</span></summary><div class="elite-dash-support"><section class="card"><h2>Distribuição de resultados</h2>${eliteDashDistribution(wins, s.n, "operações")}</section><section class="card"><h2>Resultado por ativo</h2>${eliteDashBars(
      grp(m.values, (t) => t.symbol || "Não informado"),
      true,
    )}</section><section class="card"><h2>Resultado por sessão</h2>${eliteDashBars(sessions)}<small>Entrada registrada · fuso original.</small></section><section class="card"><h2>Tipo de operação</h2>${eliteDashDistribution(direction, s.n, "operações")}</section></div>
    </details><div class="elite-dash-bottom"><details class="smc-dashboard-disclosure smc-statistics-disclosure" ${innerWidth > 760 ? "open" : ""}><summary>Estatísticas detalhadas <span>Ganhos, perdas e sequências</span></summary><section class="card elite-dash-statistics"><h2>Estatísticas detalhadas</h2><div class="secondary-metrics">${[
      ["Lucro bruto", has ? eliteDashSigned(s.aw * s.w) : "—", "g"],
      ["Perda bruta", has ? eliteDashFormat(-s.al * s.l) : "—", "r"],
      ["Comissões e taxas", "—", "", "Não separadas do P&L registrado"],
      [
        "Risco/retorno médio",
        s.w && s.l ? (s.aw / s.al).toFixed(2) : "—",
        "",
        "Payoff realizado",
      ],
      ["Ganho médio", s.w ? eliteDashFormat(s.aw) : "—", "g"],
      ["Perda média", s.l ? eliteDashFormat(-s.al) : "—", "r"],
      [
        "Melhor dia",
        daily.length
          ? eliteDashSigned(Math.max(...daily.map((p) => p.value)))
          : "—",
        "g",
      ],
      [
        "Pior dia",
        daily.length
          ? eliteDashSigned(Math.min(...daily.map((p) => p.value)))
          : "—",
        "r",
      ],
      [
        "Média diária",
        daily.length ? eliteDashSigned(s.net / daily.length) : "—",
        cl(s.net),
      ],
      ["Maior sequência", `${s.mcw} ganhos · ${s.mcl} perdas`, ""],
    ]
      .map(([label, value, color, note]) =>
        metric(label, value, color, note || ""),
      )
      .join(
        "",
      )}</div><details class="elite-dash-extra"><summary>Saldo da conta e estatísticas completas</summary>${eliteDashboardLegacyDetails(m.rows)}</details></section></details><div class="elite-dash-calendar">${vCal(m.rows)}<div class="elite-dash-legend"><span><i class="win"></i>Dia positivo</span><span><i class="loss"></i>Dia negativo</span><span><i class="even"></i>Empate</span><span><i></i>Sem operação</span></div></div></div>
    <div class="elite-dash-footer"><section class="card terminal-recent"><div class="section-head"><h2>Operações recentes</h2><button class="scene-link" onclick="taGo('trades')">Ver todas ${terminalIcon("arrow")}</button></div>${m.rows.length ? terminalRecentTrades(m.rows) : '<p class="mu">Sem operações neste período.</p>'}</section><section class="card"><div class="section-head"><h2>Desempenho semanal / mensal</h2><select aria-label="Agrupar desempenho" onchange="eliteDashPeriod=this.value;R()"><option value="week" ${eliteDashPeriod === "week" ? "selected" : ""}>Semanal</option><option value="month" ${eliteDashPeriod === "month" ? "selected" : ""}>Mensal</option></select></div>${eliteDashBars(period, false, true)}<small>Até oito períodos recentes com operações registradas.</small></section></div></section>`;
}
function eliteDashboardLegacyDetails(ts) {
  const s = st(ts),
    has = s.n > 0,
    days = Object.values(grp(ts, day)),
    daily = days.map((d) => d.net),
    all = st(S.trades.filter((t) => t.close)),
    balance = S.balanceConfirmed ? S.balance + all.net : null;
  return `<section class="card"><div class="section-head"><div><div class="eyebrow">Detalhes da performance</div><h2>Além do resultado</h2><p>Estatísticas do período selecionado, salvo indicação.</p></div><span class="badge">${S.currency ? esc(S.currency) : "Moeda não informada"}</span></div><div class="secondary-metrics">${metric("Saldo registrado calculado", money(balance), "", "Histórico completo · saldo inicial + P&L")}${metric("Trades vencedores", has ? s.w : "—", "g")}${metric("Trades perdedores", has ? s.l : "—", "r")}${metric("Trades breakeven", has ? s.n - s.w - s.l : "—")}${metric("Ganho médio", s.w ? money(s.aw) : "—", "g")}${metric("Perda média", s.l ? money(-s.al) : "—", "r")}${metric("Payoff realizado", s.w && s.l ? (s.aw / s.al).toFixed(2) : "—", "", "Ganho médio ÷ perda média; não é R:R planejado")}${metric("R realizado médio", s.avgR == null ? "—" : s.avgR.toFixed(2) + "R", "", `${s.rn} de ${s.n} trades com risco informado`)}${metric("R realizado total", s.totR == null ? "—" : s.totR.toFixed(2) + "R", "", "Somente operações com risco informado")}${metric("Drawdown máximo (%)", has && S.balanceConfirmed && S.balance > 0 ? s.ddp.toFixed(2) + "%" : "—", "", "Base: saldo inicial configurado + pico de P&L no período")}${metric("Lucro bruto", has ? money(s.aw * s.w) : "—", "g")}${metric("Perda bruta", has ? money(-s.al * s.l) : "—", "r")}${metric("Comissões e taxas", "—", "", "Não armazenadas separadamente; P&L importado pode já ser líquido")}${metric("Melhor dia", daily.length ? signed(Math.max(...daily)) : "—", daily.length ? cl(Math.max(...daily)) : "")}${metric("Pior dia", daily.length ? signed(Math.min(...daily)) : "—", daily.length ? cl(Math.min(...daily)) : "")}${metric("Média diária", daily.length ? money(s.net / daily.length) : "—", cl(s.net), "Por dia com trades no período")}${metric("Sequência de ganhos", has ? s.mcw : "—", "g", "Maior sequência no período")}${metric("Sequência de perdas", has ? s.mcl : "—", "r", "Maior sequência no período")}</div><p class="muted-note">R = P&L ÷ risco monetário informado. R:R planejado e equity com posições abertas não estão disponíveis. ${ts.some((t) => t.est) ? "Há P&L estimado neste período: revise os trades marcados com *." : ""}</p>${dashboardMoneyHidden() ? '<p class="muted-note">Mostre os valores para configurar saldo e moeda.</p>' : accountConfig()}</section>`;
}

function smcDashboardFilterControls(ts) {
  const m = eliteDashModel(ts);
  return `<div class="elite-dash-unit"><span>Visão completa do seu desempenho</span><label>Sessão <select aria-label="Sessão do painel" onchange="eliteDashSession=this.value;R()"><option value="">Todas as sessões</option>${[
    ...new Set(ts.map(eliteDashSessionName)),
  ]
    .sort()
    .map(
      (v) =>
        `<option value="${esc(v)}" ${v === eliteDashSession ? "selected" : ""}>${esc(v)}</option>`,
    )
    .join(
      "",
    )}</select></label><label>Unidade <select aria-label="Unidade do painel" onchange="eliteDashChangeUnit(this.value)"><option value="money" ${eliteDashUnit === "money" ? "selected" : ""}>${esc(S.currency || "Moeda da conta")}</option><option value="r" ${eliteDashUnit === "r" ? "selected" : ""} ${m.complete ? "" : "disabled"}>R realizado</option></select></label><small>${m.known}/${m.rows.length} trades com R conhecido${m.rows.some((t) => t.est) ? " · contém P&L estimado *" : ""}${eliteDashUnit === "r" ? " · calendário e histórico em moeda da conta" : ""}</small></div>`;
}
