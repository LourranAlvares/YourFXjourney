/* Trader review: deterministic facts first; AI may only select supplied facts. */
let eliteReview = {
  scope: "all",
  pending: false,
  result: null,
  key: null,
  error: "",
};
function eliteReviewModel() {
  const today = taDailyDate(),
    from =
      eliteReview.scope === "all"
        ? null
        : insAddDays(today, -Number(eliteReview.scope) + 1),
    rows = insUniverse().filter(
      (t) =>
        day(t) <= today &&
        (!from || day(t) >= from) &&
        (!F.sym || t.symbol === F.sym) &&
        (!F.strat || t.strategy === F.strat) &&
        (!F.from || day(t) >= F.from) &&
        (!F.to || day(t) <= F.to),
    ),
    stats = st(rows),
    process = insProcess(rows),
    errors = insErrorCounts(rows),
    reviewed = insErrorRows(rows).length,
    rs = rows.map(realizedTradeR).filter((r) => r.value !== null),
    plan = taCurrentPlan(),
    facts = [
      {
        id: "scope",
        text: `Período ${from || "histórico disponível"} até ${today}: ${rows.length} operações fechadas válidas, respeitando os filtros. ${rows.length < 30 ? "Amostra pequena; observações descritivas." : ""}`,
      },
      {
        id: "performance",
        text: `Resultado monetário registrado: ${stats.net.toFixed(2)} ${S.currency || "(moeda não definida)"}. ${stats.w} ganhos, ${stats.l} perdas. Ganhos/perdas não comprovam cumprimento do plano.`,
      },
      {
        id: "risk-coverage",
        text: `R conhecido em ${rs.length}/${rows.length} operações. ${rs.length ? rs.reduce((a, r) => a + r.value, 0).toFixed(2) + "R somados; soma parcial se houver operações sem R." : "Sem base suficiente para calcular R."} R por preço não desconta custos.`,
      },
      {
        id: "plan-coverage",
        text: `Cumprimento do plano explicitamente avaliável em ${process.plan.n}/${rows.length} operações; ${process.plan.value === null ? "cobertura insuficiente para percentual" : process.plan.value.toFixed(0) + "% dentro do plano entre os avaliados"}. Plano atual é contexto para orientações futuras, não prova das regras usadas no passado.`,
      },
      {
        id: "errors-coverage",
        text: `Erros explicitamente revisados em ${reviewed}/${rows.length} operações. Registros sem avaliação não são considerados livres de erro.`,
      },
    ];
  const errorRows = Object.entries(errors)
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => ({
      id,
      n,
      definition: INS_ERRORS.find((x) => x[0] === id),
    }));
  for (const e of errorRows.slice(0, 3))
    facts.push({
      id: "error-" + e.id,
      text: `${e.definition[1]} registrado em ${e.n}/${reviewed} operações com erros avaliados; ${rows.length} operações no recorte. Não inferir causalidade.`,
    });
  const groups = insGroupRows(rows, (t) => t.symbol).filter(
    (g) => g.n >= Math.max(3, insRules().minGroup),
  );
  if (groups.length)
    facts.push({
      id: "asset-pattern",
      text: `Ativo ${groups[0].name}: ${groups[0].n} operações, resultado ${groups[0].net.toFixed(2)}, taxa de ganhos ${groups[0].wr.toFixed(0)}%. Comparação descritiva; não é previsão de retorno.`,
    });
  if (plan)
    facts.push({
      id: "system",
      text: `Sistema atual: ${plan.name}, versão ${plan.version}. Critério documentado: ${(plan.criteria.find((c) => c.required) || plan.criteria[0])?.definition || "Não informado"}`.slice(
        0,
        1000,
      ),
    });
  const input = {
    plan,
    profile: { timezone: taProfile().timezone, session: taProfile().session },
    facts,
  };
  return {
    rows,
    stats,
    process,
    errorRows,
    reviewed,
    rs,
    input,
    key: JSON.stringify(input),
  };
}
function vInsights() {
  const m = eliteReviewModel(),
    valid = eliteReview.result && eliteReview.key === m.key,
    ready = taConnection.authenticated && taConnection.services?.ai;
  return `<section class="card elite-review"><div class="section-head"><div><div class="eyebrow">Assistente SMC Elite · sua execução</div><h2>Raio-X do Trader</h2><p>O que seus registros mostram, o que precisa de atenção e o que ainda falta avaliar.</p></div><label>Período<select aria-label="Período do Raio-X" onchange="eliteReview.scope=this.value;R()">${[
    ["all", "Todo o histórico"],
    ["30", "Últimos 30 dias"],
    ["90", "Últimos 90 dias"],
  ]
    .map(
      ([id, label]) =>
        `<option value="${id}" ${id === eliteReview.scope ? "selected" : ""}>${label}</option>`,
    )
    .join(
      "",
    )}</select></label></div><div class="grid">${kp("Operações avaliadas", m.rows.length)}${kp("Resultado registrado", money(m.stats.net), cl(m.stats.net))}${kp("Plano: cobertura", m.process.plan.n + "/" + m.rows.length)}${kp("Erros: cobertura", m.reviewed + "/" + m.rows.length)}</div><p class="muted-note">Dados locais calculados sobre operações fechadas válidas; respeita os filtros da página. Nenhum erro é deduzido apenas de uma perda.</p><div class="elite-review-columns"><section><h3>Prioridade de atenção</h3>${m.errorRows.length ? `<p><b>${esc(m.errorRows[0].definition[1])}</b> · ${m.errorRows[0].n}/${m.reviewed} operações revisadas.</p><p>${esc(m.errorRows[0].definition[2])}</p>` : "<p>Sem erros explicitamente registrados neste recorte. Revise os registros no Diário para diferenciar falta de avaliação de execução correta.</p>"}<button class="b s" onclick="taGo('trades')">Revisar no Diário ↗</button></section><section><h3>Leitura do assistente com IA</h3>${valid ? `<p>${esc(eliteReview.result.action)}</p><ul>${eliteReview.result.facts.map((f) => `<li>${esc(f.text)}</li>`).join("")}</ul><small>IA apoiada nos fatos calculados · ${esc(new Date(eliteReview.result.asOf).toLocaleString("pt-PT"))}</small>` : "<p>Gere uma orientação a partir do histórico deste recorte, do sistema salvo e dos erros documentados. Os números são calculados pelo site.</p>"}${ready ? `<button class="b" onclick="eliteGenerateReview()" ${eliteReview.pending || !m.rows.length ? "disabled" : ""}>${eliteReview.pending ? "Revisando registros…" : valid ? "Atualizar Raio-X com IA" : "Gerar Raio-X com IA"}</button>` : '<button class="b s" onclick="taGo(\'settings\')">Conectar IA</button>'}<p class="muted-note">O envio inclui o plano e fatos agregados. Não envia prints nem o texto completo do diário.</p>${eliteReview.error ? `<p role="status" class="r">${esc(eliteReview.error)}</p>` : ""}</section></div><details><summary>Todos os erros registrados (${m.errorRows.length})</summary>${m.errorRows.length ? m.errorRows.map((e) => `<p><b>${esc(e.definition[1])}</b> · ${e.n}/${m.reviewed} operações revisadas.<br>${esc(e.definition[2])}</p>`).join("") : "<p>Nenhum erro explicitamente registrado neste recorte.</p>"}</details><details><summary>Ver todos os fatos e limites desta revisão</summary>${m.input.facts.map((f) => `<p>${esc(f.text)}</p>`).join("")}</details></section><details class="card"><summary>Estatísticas detalhadas, disciplina e comparações por dia, semana ou mês</summary>${vInsightsCore()}</details>`;
}
async function eliteGenerateReview() {
  if (eliteReview.pending) return;
  const snapshot = eliteReviewModel();
  if (!snapshot.rows.length) return;
  eliteReview.pending = true;
  eliteReview.error = "";
  R();
  try {
    const result = await taApi("/api/briefing", {
        method: "POST",
        body: JSON.stringify(snapshot.input),
      }),
      byId = new Map(snapshot.input.facts.map((f) => [f.id, f]));
    if (
      !Array.isArray(result.facts) ||
      !result.facts.length ||
      typeof result.action !== "string" ||
      result.facts.some((f) => !byId.has(f.id))
    )
      throw Error(
        "Resposta de revisão inválida. Os dados locais foram preservados.",
      );
    if (snapshot.key === eliteReviewModel().key) {
      eliteReview.result = {
        ...result,
        facts: result.facts.map((f) => byId.get(f.id)),
      };
      eliteReview.key = snapshot.key;
    }
  } catch (e) {
    if (snapshot.key === eliteReviewModel().key)
      eliteReview.error = e.message + " A revisão local permanece disponível.";
  } finally {
    eliteReview.pending = false;
    if (tab === "ins") R();
  }
}
