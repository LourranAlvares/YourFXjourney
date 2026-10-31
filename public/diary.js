/* Diary projections reuse existing records; no inferred profits or emotions. */
let diaryMonth = new Date().toISOString().slice(0, 7),
  diarySelected = "",
  diaryMode = "gallery";
function accountHistoryCurve() {
  if (!S.balanceConfirmed) return [];
  const rows = S.trades
    .filter((t) => t.close && rNumber(t.pnl) !== null)
    .sort((a, b) => a.close.localeCompare(b.close));
  if (!rows.length)
    return [
      { date: ymd(new Date()) + " · Inicial", value: Number(S.balance), n: 0 },
    ];
  let value = Number(S.balance);
  const points = [
    { date: rows[0].close.slice(0, 10) + " · Inicial", value, n: 0 },
  ];
  const groups = grp(rows, day);
  for (const date of Object.keys(groups).sort()) {
    value += groups[date].net;
    points.push({ date, value, net: groups[date].net, n: groups[date].n });
  }
  const today = ymd(new Date());
  if (points.at(-1).date < today) points.push({ date: today, value, n: 0 });
  return points;
}
function diaryMove(n) {
  const [y, m] = diaryMonth.split("-").map(Number);
  diaryMonth = ymd(new Date(y, m - 1 + n, 1)).slice(0, 7);
  diarySelected = "";
  R();
}
function diaryChoose(date) {
  diarySelected = diarySelected === date ? "" : date;
  R();
}
function diaryLatest() {
  const rows = ft()
    .filter((t) => t.close)
    .sort((a, b) => a.close.localeCompare(b.close));
  if (rows.length) diaryMonth = day(rows.at(-1)).slice(0, 7);
  diarySelected = "";
  R();
}
let diaryVisited = false;
function diaryWorkspace(ts) {
  if (!diaryVisited) {
    diaryVisited = true;
    if (ts.length && !ts.some((t) => day(t).slice(0, 7) === diaryMonth))
      diaryMonth = [...ts]
        .sort((a, b) => b.close.localeCompare(a.close))[0]
        .close.slice(0, 7);
  }
  const month = ts.filter((t) => day(t).slice(0, 7) === diaryMonth),
    rows = month
      .filter((t) => !diarySelected || day(t) === diarySelected)
      .sort((a, b) => b.close.localeCompare(a.close)),
    totals = st(month),
    known = month.map(realizedTradeR).filter((x) => x.value !== null),
    [y, m] = diaryMonth.split("-").map(Number),
    count = new Date(y, m, 0).getDate(),
    offset = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  let cells = "<span></span>".repeat(offset);
  for (let d = 1; d <= count; d++) {
    const date = diaryMonth + "-" + pad(d),
      list = month.filter((t) => day(t) === date),
      sum = list.reduce((v, t) => v + t.pnl, 0);
    const description = `${date} · ${list.length} operações${list.length ? " · " + money(sum) : ""}`;
    cells += `<button class="diary-day ${date === diarySelected ? "selected" : ""} ${list.length ? cl(sum) : ""}" aria-label="${esc(description)}" title="${esc(description)}" aria-pressed="${date === diarySelected}" onclick="diaryChoose('${date}')"><b>${d}</b><small>${list.length ? list.length + (list.length === 1 ? " op" : " ops") : "—"}</small></button>`;
  }
  const emotions = rows.filter((t) => t.emotion),
    groups = new Map();
  emotions.forEach((t) => {
    const g = groups.get(t.emotion) || { n: 0, pnl: 0 };
    g.n++;
    g.pnl += t.pnl;
    groups.set(t.emotion, g);
  });
  return `<section class="card diary-heading" aria-label="Resumo e navegação do diário"><div class="row"><button class="b s" onclick="diaryMove(-1)" aria-label="Mês anterior">‹</button><label><span class="sr-only">Mês</span><input type="month" value="${diaryMonth}" onchange="if(/^\\d{4}-\\d{2}$/.test(this.value)){diaryMonth=this.value;diarySelected='';R()}"></label><button class="b s" onclick="diaryMove(1)" aria-label="Próximo mês">›</button><button class="b s" onclick="diaryLatest()">Últimos registros</button><button class="b s" onclick="diarySelected='';R()">Mês completo</button><button class="b" onclick="diaryNew()">+ Registrar no diário</button></div><div class="grid">${kp("Resultado no mês", money(totals.net), cl(totals.net))}${kp("Operações", month.length)}${kp(known.length === month.length ? "R realizado" : "R conhecido · parcial", known.length ? shareR(known.reduce((a, b) => a + b.value, 0)) : "—", "", known.length + "/" + month.length + " com R conhecido")}${kp("Com diário", month.filter((t) => t.notes || t.feelings || t.img?.length).length)}</div></section><div class="diary-workspace-layout"><section class="card diary-calendar-panel"><div class="section-head"><h2>Calendário do diário</h2><span>${diarySelected || "Selecione um dia para filtrar a galeria"}</span></div><div class="diary-calendar">${["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => `<small>${d}</small>`).join("")}${cells}</div></section><section class="diary-records-panel"><div class="section-head"><h2>${diarySelected ? "Registros de " + diarySelected : "Galeria do mês"}</h2><span>${rows.length} operações${diarySelected ? " · " + money(st(rows).net) : ""}</span></div><div class="diary-gallery">${rows.map((t) => diaryCard(t)).join("") || '<section class="card"><h3>Nenhum registro neste período</h3><p>Use “Últimos registros”, ajuste os filtros ou registre uma operação.</p></section>'}</div></section></div><details class="card diary-patterns"><summary>Padrões nos seus registros</summary>${diaryPatterns(rows)}${groups.size ? Array.from(groups, ([name, g]) => `<p><b>${esc(name)}</b> · ${g.n} operações · ${money(g.pnl)} ${g.n < 10 ? "· amostra pequena" : ""}</p>`).join("") : "<p>Registre como se sentiu para comparar sua execução ao longo do tempo.</p>"}<p class="muted-note">Somente sentimentos informados pelo usuário; associação descritiva, sem concluir causa ou eficiência. Os filtros do diário também se aplicam aqui.</p></details>`;
}
function diaryCard(t) {
  const r = realizedTradeR(t),
    image = (t.img || []).find((src) =>
      /^data:image\/(png|jpeg|webp|gif);base64,/.test(src),
    );
  return `<article class="card diary-entry">${image ? `<img class="diary-cover" src="${esc(image)}" alt="Print da operação ${esc(t.symbol)}" loading="lazy">` : '<div class="diary-no-print">Sem print · adicione ao revisar</div>'}<div class="section-head"><h3>${esc(t.symbol)}</h3><b class="${cl(t.pnl)}">${money(t.pnl)}${t.est ? " *" : ""}</b></div><small>${esc(t.close.replace("T", " "))} · ${t.side === "long" ? "Compra" : t.side === "short" ? "Venda" : "Lado não informado"}</small><p><span class="badge" title="${esc(r.reason)}">${shareR(r.value)}</span> ${rNumber(t.plannedRR) > 0 ? `<span class="badge">Alvo planejado ${esc(t.plannedRR)}R</span>` : ""} ${t.emotion ? `<span class="badge">${esc(t.emotion)}</span>` : ""}</p>${[
    ["Motivo", t.notes],
    ["Como me senti", t.feelings],
    ["Aprendizado", t.lesson],
  ]
    .filter((x) => x[1])
    .map(([label, text]) => `<p><small>${label}</small><br>${esc(text)}</p>`)
    .join(
      "",
    )}<button class="b s" data-id="${esc(t.id)}" onclick="edit(this.dataset.id)">Abrir / completar diário</button></article>`;
}
function diaryNew() {
  edit(null, diarySelected || undefined);
  const details = document.querySelector("#trade-technical");
  if (details) details.open = false;
  document.querySelector("#f_notes")?.focus();
}

function diaryConfigureBalance() {
  const el = document.querySelector(".account-settings");
  if (el) {
    el.open = true;
    el.scrollIntoView({ block: "center" });
    document.querySelector("#account-baseline")?.focus();
  }
}
function shareRiskSuggestion() {
  const rows = shareMonthTrades().filter((t) => rNumber(t.risk) > 0),
    values = [...new Set(rows.map((t) => Number(t.risk)))];
  return rows.length >= 2 && values.length === 1 ? values[0] : null;
}
function shareUseSuggestedRisk() {
  const value = shareRiskSuggestion();
  if (value !== null) {
    document.querySelector("#share-common-risk").value = value;
    previewShareCommonRisk();
  }
}

function diaryPrepareEditor() {
  const details = document.querySelector("#trade-technical");
  if (!details) return;
  const quick = document.createElement("div");
  quick.className = "fg diary-quick-fields";
  for (const key of ["symbol", "close", "pnl"]) {
    const label = document.querySelector("#f_" + key)?.closest("label");
    if (label) quick.append(label);
  }
  details.before(quick);
  details.open = false;
}

function diaryPatterns(rows) {
  const summaries = [];
  for (const [label, fn] of [
    ["Ativo", (t) => t.symbol],
    ["Setup", (t) => t.setup],
    ["Sessão", (t) => (t.open ? sess(t) : null)],
  ]) {
    for (const [name, summary] of Object.entries(grp(rows, fn))) {
      if (summary.n >= 3) summaries.push({ label, name, summary });
    }
  }
  summaries.sort((a, b) => b.summary.n - a.summary.n);
  return (
    summaries
      .slice(0, 3)
      .map(
        ({ label, name, summary: g }) =>
          `<p><b>${esc(label)} · ${esc(name)}</b> · ${g.n} operações · ${g.wr.toFixed(0)}% vencedoras · ${money(g.net)}${g.n < 30 ? " · amostra pequena" : ""}</p>`,
      )
      .join("") ||
    '<p class="muted-note">Os agrupamentos por ativo, setup e sessão aparecem a partir de 3 registros comparáveis.</p>'
  );
}
