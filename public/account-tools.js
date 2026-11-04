/* Account denomination and a small risk planning utility. Never converts or rewrites trades. */
const ACCOUNT_CURRENCIES = [
  ["GBP", "£"],
  ["EUR", "€"],
  ["USD", "$"],
  ["BRL", "R$"],
];
const accountFormatters = new Map();
function formatAccountMoney(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (dashboardMoneyHidden()) return "••••";
  const code = typeof S.currency === "string" ? S.currency : "";
  if (!accountFormatters.has(code)) {
    try {
      accountFormatters.set(
        code,
        new Intl.NumberFormat(
          "pt-PT",
          code
            ? {
                style: "currency",
                currency: code,
                currencyDisplay: "narrowSymbol",
              }
            : { minimumFractionDigits: 2, maximumFractionDigits: 2 },
        ),
      );
    } catch {
      accountFormatters.set(
        code,
        new Intl.NumberFormat("pt-PT", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
      );
    }
  }
  return (
    (value < 0 ? "−" : "") + accountFormatters.get(code).format(Math.abs(value))
  );
}
function accountCurrencyControl() {
  const current = typeof S.currency === "string" ? S.currency : "";
  const extra =
    current && !ACCOUNT_CURRENCIES.some(([code]) => code === current)
      ? `<option value="${esc(current)}" selected>${esc(current)}</option>`
      : "";
  return `<label class="account-currency-control" title="Moeda dos registros. Define a unidade exibida; não faz conversão de câmbio."><span>Moeda da conta</span><select aria-label="Moeda da conta" onchange="setAccountCurrency(this.value)"><option value="" ${!current ? "selected" : ""}>Moeda</option>${extra}${ACCOUNT_CURRENCIES.map(([code, symbol]) => `<option value="${code}" ${current === code ? "selected" : ""}>${code} · ${symbol}</option>`).join("")}</select></label><button class="b s account-capital-edit" type="button" onclick="accountOpenEditor()" aria-label="Editar capital inicial">Capital</button>`;
}
function setAccountCurrency(code) {
  if (code !== "" && !ACCOUNT_CURRENCIES.some(([value]) => value === code))
    return;
  taPersist({ currency: code });
  R();
  document
    .querySelector('select[aria-label="Moeda da conta"]')
    ?.focus({ preventScroll: true });
}

let riskCalculator = { base: "", percent: "", manualBase: false };
function simpleRiskView(ts) {
  const stats = st(ts),
    recorded = ts.filter(
      (t) =>
        typeof t.risk === "number" && Number.isFinite(t.risk) && t.risk > 0,
    ),
    missing = ts.filter(
      (t) =>
        !(typeof t.risk === "number" && Number.isFinite(t.risk) && t.risk > 0),
    );
  const average = recorded.length
      ? recorded.reduce((sum, t) => sum + t.risk, 0) / recorded.length
      : null,
    largest = recorded.length ? Math.max(...recorded.map((t) => t.risk)) : null;
  const totalNet = S.trades
      .filter(
        (t) => t.close && typeof t.pnl === "number" && Number.isFinite(t.pnl),
      )
      .reduce((sum, t) => sum + t.pnl, 0),
    balance =
      S.balanceConfirmed && Number.isFinite(S.balance)
        ? S.balance + totalNet
        : null;
  if (!riskCalculator.manualBase)
    riskCalculator.base =
      balance !== null && balance > 0 ? String(Number(balance.toFixed(2))) : "";
  return `<section class="card risk-intro"><div class="eyebrow">Simples e direto</div><h2>Quanto arriscar na próxima operação?</h2><p>Informe um saldo e um percentual. Veja o valor em dinheiro antes de executar.</p><span class="muted-note">A moeda no topo define a unidade dos seus registros. Não há conversão cambial.</span></section>
  <div class="risk-workspace"><section class="card risk-calculator"><div class="section-head"><h2>Calcular valor de risco</h2><button class="b s" type="button" onclick="riskResetCalculator()">Limpar cálculo</button></div><div class="fg"><label>Saldo usado no cálculo${S.currency ? " · " + esc(S.currency) : ""}<input id="risk-reference" type="number" min="0" step="any" inputmode="decimal" placeholder="Informe um saldo" value="${esc(riskCalculator.base)}" oninput="riskUpdateCalculator(true)"></label><label>Risco por operação (%)<input id="risk-percent" type="number" min="0" max="100" step="any" inputmode="decimal" placeholder="Ex.: 0,5" value="${esc(riskCalculator.percent)}" oninput="riskUpdateCalculator()"></label></div><div class="risk-presets" role="group" aria-label="Percentuais de risco">${[
    ["0.25", "0,25%"],
    ["0.5", "0,5%"],
    ["1", "1%"],
  ]
    .map(
      ([n, label]) =>
        `<button class="b s" type="button" onclick="riskChoosePercent('${n}')" aria-pressed="${riskCalculator.percent === n}">${label}</button>`,
    )
    .join(
      "",
    )}</div><div class="risk-calculation-result"><small>Valor de risco planejado</small><output id="risk-result" aria-live="polite">${riskCalculationText(riskCalculator.base, riskCalculator.percent)}</output><p id="risk-calculation-note">${riskCalculationNote(riskCalculator.base, riskCalculator.percent)}</p></div><p class="muted-note">O saldo é uma referência editável. O cálculo não altera saldo, plano ou trades e não consulta posições abertas.</p><button class="b s" onclick="taGo('plan')">Conferir meu limite no plano</button></section>
  <section class="card risk-recorded"><div class="section-head"><div><div class="eyebrow">Dados do período selecionado</div><h2>O que seu histórico mostra</h2></div></div><div class="risk-recorded-metrics">${metric("Risco médio registrado", money(average), "", `${recorded.length}/${stats.n} trades com risco inicial informado`)}${metric("Maior risco registrado", money(largest), "", "Valor planejado registrado; não é a maior perda")}${metric("Maior queda acumulada", stats.n ? money(stats.dd) : "—", stats.dd ? "r" : "", "Drawdown: queda do pico ao vale dos resultados fechados")}</div><div class="risk-next-focus"><b>${!stats.n ? "Comece com seus próprios dados" : missing.length ? "Complete o risco que falta" : "Riscos registrados no período"}</b><p>${!stats.n ? "Você pode usar o cálculo ao lado mesmo sem histórico." : missing.length ? `${missing.length} de ${stats.n} trades não têm risco inicial em dinheiro registrado. Revise esses valores sem presumir um risco fixo.` : "Revise o valor de risco antes de cada nova operação e siga seu plano."}</p><button class="b s" onclick="taGo('trades')">${missing.length ? "Revisar histórico" : "Abrir trades"}</button></div></section></div>
  ${
    missing.length
      ? `<details class="card risk-missing"><summary>Revisar risco de ${missing.length} operações</summary><p class="muted-note">Atalhos para as 5 operações mais recentes sem risco em dinheiro. Um R informado separadamente continua preservado.</p>${[
          ...missing,
        ]
          .sort((a, b) => b.close.localeCompare(a.close))
          .slice(0, 5)
          .map(
            (t) =>
              `<div class="risk-missing-row"><span><b>${esc(t.symbol || "Ativo não informado")}</b><small>${esc(t.close.replace("T", " "))}</small></span><span class="${cl(t.pnl)}">${money(t.pnl)}</span><button class="b s" data-risk-trade="${esc(t.id)}" onclick="edit(this.dataset.riskTrade)">Informar risco</button></div>`,
          )
          .join("")}</details>`
      : ""
  }`;
}
function riskCalculationValue(base, percent) {
  if (base === "" || percent === "") return null;
  const b = Number(base),
    p = Number(percent);
  if (!Number.isFinite(b) || b <= 0 || !Number.isFinite(p) || p < 0 || p > 100)
    return null;
  const amount = (b * p) / 100;
  return Number.isFinite(amount) ? amount : null;
}
function riskCalculationText(base, percent) {
  const amount = riskCalculationValue(base, percent);
  return amount === null ? "—" : money(amount);
}
function riskCalculationNote(base, percent) {
  if (base === "" || percent === "")
    return "Escolha um percentual e informe o saldo de referência.";
  if (riskCalculationValue(base, percent) === null)
    return "Use saldo maior que zero e percentual entre 0% e 100%.";
  return `${Number(percent).toLocaleString("pt-PT")}% de ${money(Number(base))}. Apenas planejamento; siga as regras do seu plano.`;
}
function riskUpdateCalculator(manual = false) {
  const base = document.querySelector("#risk-reference"),
    percent = document.querySelector("#risk-percent");
  if (!base || !percent) return;
  riskCalculator.base = base.value;
  riskCalculator.percent = percent.value;
  if (manual) riskCalculator.manualBase = true;
  document.querySelector("#risk-result").textContent = riskCalculationText(
    base.value,
    percent.value,
  );
  document.querySelector("#risk-calculation-note").textContent =
    riskCalculationNote(base.value, percent.value);
  document
    .querySelectorAll(".risk-presets button")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(
          button.textContent.replace(",", ".").replace("%", "") ===
            percent.value,
        ),
      ),
    );
}
function riskChoosePercent(value) {
  document.querySelector("#risk-percent").value = value;
  riskUpdateCalculator();
}
function riskResetCalculator() {
  riskCalculator = { base: "", percent: "", manualBase: false };
  R();
}

/* The confirmed initial capital remains editable. Never infer it from P&L alone. */
function accountOpenEditor() {
  if (CLOUD_BOOT && (!eliteCloud.ready || eliteCloud.user?.status !== "active"))
    return;
  const owner = K;
  const scope = accountInitialScope();
  const evidence =
    (S.capitalImportEvidence?.accountId || "") === scope.id
      ? S.capitalImportEvidence
      : null;
  const current =
    scope.confirmed && Number.isFinite(scope.amount) ? scope.amount : "";
  const options = [
    ["", "Não informada"],
    ["GBP", "GBP · Libra"],
    ["USD", "USD · Dólar"],
    ["EUR", "EUR · Euro"],
    ["BRL", "BRL · Real"],
  ];
  if (scope.currency && !options.some(([id]) => id === scope.currency))
    options.push([scope.currency, scope.currency]);
  const dialog = growthDialog(
    "Capital inicial" + (scope.name ? " · " + scope.name : " da conta"),
    `<form id="account-initial-form" novalidate><p>Informe o saldo anterior à primeira operação do histórico. Alterar esse valor recalcula a base da conta e não modifica trades, depósitos ou retiradas.</p><label>Capital inicial<input id="account-edit-baseline" type="number" min="0" step="any" inputmode="decimal" value="${esc(current)}" placeholder="Não confirmado"></label><label>Moeda<select id="account-edit-currency">${options.map(([id, label]) => `<option value="${esc(id)}" ${scope.currency === id ? "selected" : ""}>${esc(label)}</option>`).join("")}</select></label>${evidence ? `<aside class="account-import-evidence"><p>O relatório importado informa capital inicial de <b>${esc(evidence.amount)} ${esc(evidence.currency || "")}</b>.</p><button class="b s" type="button" id="account-use-import">Usar valor do relatório</button></aside>` : '<p class="muted-note">Sem saldo inicial explícito no relatório, o resultado dos trades sozinho não determina o capital da conta.</p>'}<p id="account-edit-status" role="status"></p><div class="row"><button type="submit" class="b">Salvar capital inicial</button><button type="button" class="b s" id="account-unconfirm">Deixar capital não confirmado</button></div></form>`,
  );
  const form = dialog.querySelector("form");
  form.onsubmit = (event) => {
    event.preventDefault();
    if (
      K !== owner ||
      (CLOUD_BOOT &&
        (!eliteCloud.ready || eliteCloud.user?.status !== "active"))
    )
      return;
    const raw = form.querySelector("#account-edit-baseline").value,
      amount = Number(raw);
    if (raw === "" || !Number.isFinite(amount) || amount < 0) {
      form.querySelector("#account-edit-status").textContent =
        "Informe um valor maior ou igual a zero, ou deixe o capital não confirmado.";
      return;
    }
    try {
      const next = accountInitialPatch(
        scope,
        amount,
        form.querySelector("#account-edit-currency").value,
        true,
      );
      persistState(next);
      S = next;
      dialog.close();
      riskCalculator.manualBase = false;
      accountRefreshAfterEdit();
      diaryNotice(
        "Capital inicial atualizado. As operações foram preservadas.",
      );
    } catch (error) {
      form.querySelector("#account-edit-status").textContent =
        "Não foi possível salvar. " + error.message;
    }
  };
  dialog.querySelector("#account-unconfirm").onclick = () => {
    if (
      K !== owner ||
      (CLOUD_BOOT &&
        (!eliteCloud.ready || eliteCloud.user?.status !== "active"))
    )
      return;
    try {
      const next = accountInitialPatch(
        scope,
        scope.amount,
        scope.currency,
        false,
      );
      persistState(next);
      S = next;
      dialog.close();
      riskCalculator.manualBase = false;
      accountRefreshAfterEdit();
      diaryNotice("Capital inicial deixado como não confirmado.");
    } catch (error) {
      form.querySelector("#account-edit-status").textContent =
        "Não foi possível salvar. " + error.message;
    }
  };
  dialog.querySelector("#account-use-import")?.addEventListener("click", () => {
    form.querySelector("#account-edit-baseline").value = evidence.amount;
    if (evidence.currency && options.some(([id]) => id === evidence.currency))
      form.querySelector("#account-edit-currency").value = evidence.currency;
  });
  form.querySelector("input").focus();
}
function accountCommitInitial() {
  const input = document.getElementById("account-baseline"),
    raw = input?.value ?? "",
    amount = Number(raw);
  if (raw === "" || !Number.isFinite(amount) || amount < 0) {
    diaryNotice("Informe um capital inicial maior ou igual a zero.", true);
    return false;
  }
  try {
    const next = accountInitialPatch(
      accountInitialScope(),
      amount,
      document.getElementById("account-currency").value,
      true,
    );
    persistState(next);
    S = next;
    riskCalculator.manualBase = false;
    accountRefreshAfterEdit();
    diaryNotice("Capital inicial atualizado.");
    return true;
  } catch (error) {
    diaryNotice("Não foi possível salvar o capital. " + error.message, true);
    return false;
  }
}

function accountRefreshAfterEdit() {
  const world = window.SMCWorld?.controller;
  if (world?.active) {
    world.refreshLayout();
  } else R();
}

function accountInitialScope() {
  const id = String(
    (typeof panelUI !== "undefined" && panelUI.account) || S.accountId || "",
  );
  const entry = (S.tradingAccounts || []).find((a) => String(a.id) === id);
  return {
    id,
    name: entry?.name || id,
    entry: !!entry,
    amount: entry ? entry.initialBalance : S.balance,
    confirmed: entry ? entry.balanceConfirmed : S.balanceConfirmed,
    currency: entry?.currency || S.currency || "",
  };
}
function accountInitialPatch(scope, amount, currency, confirmed) {
  if (scope.entry) {
    return {
      ...S,
      currency,
      tradingAccounts: S.tradingAccounts.map((a) =>
        String(a.id) === scope.id
          ? {
              ...a,
              initialBalance: amount,
              balanceConfirmed: confirmed,
              currency,
            }
          : a,
      ),
    };
  }
  return { ...S, balance: amount, balanceConfirmed: confirmed, currency };
}
