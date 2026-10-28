/* Quick instrument selection; catalog metadata only, never prices or availability claims. */
const TA_ASSET_CATALOG = [
  ["EURUSD", "Euro / Dólar americano", "Forex"],
  ["GBPUSD", "Libra / Dólar americano", "Forex"],
  ["USDJPY", "Dólar / Iene", "Forex"],
  ["USDCHF", "Dólar / Franco suíço", "Forex"],
  ["USDCAD", "Dólar americano / Dólar canadense", "Forex"],
  ["AUDUSD", "Dólar australiano / Dólar americano", "Forex"],
  ["NZDUSD", "Dólar neozelandês / Dólar americano", "Forex"],
  ["EURGBP", "Euro / Libra", "Forex"],
  ["EURJPY", "Euro / Iene", "Forex"],
  ["GBPJPY", "Libra / Iene", "Forex"],
  ["CADJPY", "Dólar canadense / Iene", "Forex"],
  ["AUDCAD", "Dólar australiano / Canadense", "Forex"],
  ["AUDJPY", "Dólar australiano / Iene", "Forex"],
  ["EURCAD", "Euro / Dólar canadense", "Forex"],
  ["GBPCAD", "Libra / Dólar canadense", "Forex"],
  ["EURAUD", "Euro / Dólar australiano", "Forex"],
  ["GBPCHF", "Libra / Franco suíço", "Forex"],
  ["CHFJPY", "Franco suíço / Iene", "Forex"],
  ["XAUUSD", "Ouro / Dólar", "Metais"],
  ["XAGUSD", "Prata / Dólar", "Metais"],
  ["BTCUSD", "Bitcoin / Dólar", "Cripto"],
  ["ETHUSD", "Ethereum / Dólar", "Cripto"],
  ["SOLUSD", "Solana / Dólar", "Cripto"],
];
function taAssetNormalize(value) {
  const symbol = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s/g, "");
  return /^[A-Z]{3}\/[A-Z]{3}$/.test(symbol) ? symbol.replace("/", "") : symbol;
}
function taAssetRead(root) {
  return [
    ...new Set(
      root
        .querySelector("[data-asset-values]")
        .value.split(",")
        .map(taAssetNormalize)
        .filter(Boolean),
    ),
  ];
}
function taAssetCatalogHTML(symbols, query = "", group = "Todos") {
  const selected = new Set(symbols),
    normalize = (s) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase(),
    q = normalize(query);
  const options = TA_ASSET_CATALOG.filter(
    ([symbol, name, category]) =>
      (q || group === "Todos" || category === group) &&
      normalize(symbol + " " + name).includes(q),
  );
  return options.length
    ? options
        .map(
          ([symbol, name]) =>
            `<button type="button" class="ta-asset-option ${selected.has(symbol) ? "selected" : ""}" data-symbol="${symbol}" aria-pressed="${selected.has(symbol)}" aria-label="${selected.has(symbol) ? "Remover" : "Selecionar"} ${symbol}" onclick="taAssetToggle(this.closest('.ta-asset-picker'),this.dataset.symbol)"><span><b>${symbol}</b><small>${esc(name)}</small></span><i aria-hidden="true">${selected.has(symbol) ? "✓" : "+"}</i></button>`,
        )
        .join("")
    : '<p class="muted-note">Nenhum ativo encontrado. Você pode adicionar um símbolo personalizado abaixo.</p>';
}
function taAssetPicker(symbols, modal = false) {
  const normalized = [
    ...new Set(symbols.map(taAssetNormalize).filter(Boolean)),
  ];
  return `<div class="ta-asset-picker" data-group="Todos"><input type="hidden" id="${modal ? "ta-assets-modal" : "ta-assets"}" data-asset-values value="${esc(normalized.join(", "))}"><div class="ta-asset-picker-heading"><div><b>Seus instrumentos</b><p>Escolha até 5 ativos para acompanhar.</p></div><span data-asset-count>${normalized.length}/5</span></div><div class="ta-asset-selected">${taAssetSelectedHTML(normalized)}</div><label class="ta-asset-search-label">Buscar ativo<input type="search" data-asset-search placeholder="Ex.: EURUSD, ouro, libra…" autocomplete="off" oninput="taAssetRefresh(this.closest('.ta-asset-picker'))"></label><div class="ta-asset-groups" role="group" aria-label="Categorias de ativos">${["Todos", "Forex", "Metais", "Cripto"].map((category) => `<button type="button" aria-pressed="${category === "Todos"}" data-category="${category}" onclick="taAssetGroup(this)">${category}</button>`).join("")}</div><div class="ta-asset-options">${taAssetCatalogHTML(normalized)}</div><details class="ta-asset-custom"><summary>Outro ativo / símbolo personalizado</summary><div><input data-asset-custom placeholder="Símbolo do provedor" aria-label="Símbolo personalizado" maxlength="25" onkeydown="if(event.key==='Enter'){event.preventDefault();taAssetCustom(this.closest('.ta-asset-picker'))}"><button type="button" class="b s" onclick="taAssetCustom(this.closest('.ta-asset-picker'))">Adicionar</button></div><p class="muted-note">A disponibilidade de cada símbolo depende do seu provedor de mercado.</p></details><p class="ta-asset-feedback" role="status" aria-live="polite"></p></div>`;
}
function taAssetSelectedHTML(symbols) {
  return symbols.length
    ? symbols
        .map(
          (symbol) =>
            `<button type="button" class="ta-asset-chip" data-symbol="${esc(symbol)}" aria-label="Remover ${esc(symbol)}" onclick="taAssetToggle(this.closest('.ta-asset-picker'),this.dataset.symbol)">${esc(symbol)} <span aria-hidden="true">×</span></button>`,
        )
        .join("")
    : '<span class="muted-note">Nenhum ativo selecionado ainda.</span>';
}
function taAssetRefresh(root) {
  const symbols = taAssetRead(root);
  root.querySelector(".ta-asset-options").innerHTML = taAssetCatalogHTML(
    symbols,
    root.querySelector("[data-asset-search]").value,
    root.dataset.group,
  );
  root.querySelector(".ta-asset-selected").innerHTML =
    taAssetSelectedHTML(symbols);
  root.querySelector("[data-asset-count]").textContent = symbols.length + "/5";
}
function taAssetToggle(root, symbol) {
  const focusWasOption =
      document.activeElement?.classList.contains("ta-asset-option"),
    focusWasChip = document.activeElement?.classList.contains("ta-asset-chip");
  const selected = taAssetRead(root),
    normalized = taAssetNormalize(symbol),
    index = selected.indexOf(normalized),
    feedback = root.querySelector(".ta-asset-feedback");
  if (index >= 0) selected.splice(index, 1);
  else {
    if (selected.length >= 5) {
      feedback.textContent =
        "Você já selecionou 5 ativos. Remova um para adicionar outro.";
      return;
    }
    if (!/^[A-Z0-9]{1,12}(?:\/[A-Z0-9]{1,12})?$/.test(normalized)) {
      feedback.textContent =
        "Informe um símbolo válido, como EURUSD ou BTC/USD.";
      return;
    }
    selected.push(normalized);
  }
  root.querySelector("[data-asset-values]").value = selected.join(", ");
  feedback.textContent = selected.length + " ativo(s) selecionado(s).";
  taAssetRefresh(root);
  if (focusWasOption || focusWasChip) {
    const targets = root.querySelectorAll(
      focusWasOption ? ".ta-asset-option" : ".ta-asset-chip",
    );
    const target = [...targets].find((e) => e.dataset.symbol === normalized);
    (target || root.querySelector("[data-asset-search]")).focus({
      preventScroll: true,
    });
  }
}
function taAssetGroup(button) {
  const root = button.closest(".ta-asset-picker");
  root.dataset.group = button.dataset.category;
  root
    .querySelectorAll("[data-category]")
    .forEach((e) => e.setAttribute("aria-pressed", String(e === button)));
  taAssetRefresh(root);
}
function taAssetCustom(root) {
  const input = root.querySelector("[data-asset-custom]"),
    symbol = taAssetNormalize(input.value);
  if (!symbol) return;
  if (taAssetRead(root).includes(symbol)) {
    root.querySelector(".ta-asset-feedback").textContent =
      "Esse ativo já está selecionado.";
    return;
  }
  taAssetToggle(root, symbol);
  if (taAssetRead(root).includes(symbol)) input.value = "";
}
function taAssetOpen() {
  let dialog = document.querySelector("#ta-assets-dialog");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "ta-assets-dialog";
    dialog.setAttribute("aria-labelledby", "ta-assets-title");
    document.body.append(dialog);
  }
  dialog.innerHTML = `<div class="section-head"><h2 id="ta-assets-title">Escolha seus ativos</h2><button type="button" class="b s" onclick="document.querySelector('#ta-assets-dialog').close()">Cancelar</button></div>${taAssetPicker(taProfile().instruments, true)}<div class="ta-asset-dialog-actions"><button class="b" type="button" onclick="taAssetSaveQuick()">Salvar ativos</button></div>`;
  dialog.showModal();
  dialog.querySelector("[data-asset-search]").focus();
}
function taAssetSaveQuick() {
  const dialog = document.querySelector("#ta-assets-dialog"),
    root = dialog.querySelector(".ta-asset-picker"),
    instruments = taAssetRead(root);
  if (instruments.length > 5) {
    root.querySelector(".ta-asset-feedback").textContent =
      "Selecione no máximo 5 ativos.";
    return;
  }
  if (
    taPersist({
      assistantProfile: {
        ...(S.assistantProfile || {}),
        ...taProfile(),
        instruments,
      },
    })
  ) {
    if (typeof taDailyReset === "function") taDailyReset();
    dialog.close();
    R();
  }
}
