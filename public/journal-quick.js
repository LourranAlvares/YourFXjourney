/* Practical journal inputs: suggestions are choices, never financial defaults. */
function diaryNumericValue(raw) {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let s = String(raw ?? "")
    .trim()
    .replace(/[−–]/g, "-");
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s);
  if (negative) s = s.slice(1, -1);
  s = s
    .replace(/(?:USD|EUR|GBP|BRL|CAD|AUD|NZD|JPY|CHF|R\$|US\$|[$€£¥])/gi, "")
    .replace(/\s/g, "");
  if (s.includes(".") && s.includes(",")) {
    const decimal = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
    s = s.slice(0, decimal).replace(/[.,]/g, "") + "." + s.slice(decimal + 1);
  } else if ((s.match(/[.,]/g) || []).length > 1) {
    if (!/^[+-]?\d{1,3}(?:[.,]\d{3})+$/.test(s)) return null;
    s = s.replace(/[.,]/g, "");
  } else s = s.replace(",", ".");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? (negative ? -Math.abs(n) : n) : null;
}
function diaryFieldNumber(key, raw) {
  let value = String(raw ?? "");
  if (["plannedRR", "realizedR", "leverage"].includes(key))
    value = value.replace(/\s*[xR]\s*$/i, "");
  if (key === "size") value = value.replace(/\s*(?:lotes?|lots?)\s*$/i, "");
  return diaryNumericValue(value);
}
function journalPriceInput(event) {
  const key = event.target.id;
  if (!key?.startsWith("f_")) return;
  const side = document.getElementById("f_side"),
    rr = document.getElementById("f_plannedRR");
  if (key === "f_side") side.dataset.calculated = "false";
  if (key === "f_plannedRR") rr.dataset.calculated = "false";
  if (!["f_entry", "f_stop", "f_target"].includes(key)) return;
  const [entry, stop, target] = ["entry", "stop", "target"].map((k) =>
    diaryFieldNumber(k, document.getElementById("f_" + k).value),
  );
  const direction =
    entry > 0 && stop > 0 && target > 0
      ? stop < entry && target > entry
        ? "long"
        : stop > entry && target < entry
          ? "short"
          : null
      : null;
  if (direction) {
    if (!side.value || side.dataset.calculated === "true") {
      side.value = direction;
      side.dataset.calculated = "true";
    }
    if (!rr.value || rr.dataset.calculated === "true") {
      rr.value = String(Math.abs(target - entry) / Math.abs(entry - stop));
      rr.dataset.calculated = "true";
    }
  } else if (rr.dataset.calculated === "true") rr.value = "";
}
function journalResultSign(sign) {
  const input = document.getElementById("f_pnl"),
    value = diaryNumericValue(input.value);
  input.dataset.resultSign = sign;
  if (value !== null)
    input.value = String((sign === "loss" ? -1 : 1) * Math.abs(value));
  input.focus();
  journalQuickRefresh();
}
function journalResultInput(event) {
  if (event.target.id !== "f_pnl") return;
  const input = event.target,
    value = diaryNumericValue(input.value);
  if (input.dataset.resultSign === "loss" && value > 0)
    input.value = "-" + input.value;
}
function journalQuickChoice(key, value) {
  const el = document.getElementById("f_" + key);
  if (!el) return;
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  journalQuickRefresh();
}
function journalCloseNow() {
  const input = document.getElementById("f_close");
  if (!input) return;
  const now = SessionEngine.zonedParts(new Date(), taProfile().timezone);
  input.value = now.date + "T" + now.time;
  journalQuickRefresh();
}
function journalResetReview() {
  document.getElementById("journal-confirmation")?.replaceChildren();
}
function journalQuickRefresh(showPrices = false) {
  const form = document.getElementById("dlg");
  if (!form?.open) return;
  const readerNote = document.getElementById("journal-reader-note");
  if (readerNote)
    readerNote.textContent =
      document.getElementById("shot-status")?.textContent || "";
  form
    .querySelectorAll("[data-side-choice]")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(
          document.getElementById("f_side").value === b.dataset.sideChoice,
        ),
      ),
    );
  const confirmation = document.getElementById("journal-confirmation"),
    reviewInput = document.getElementById("shot-reviewed");
  if (confirmation && reviewInput)
    confirmation.append(reviewInput.closest("label"));
  const pnl = diaryNumericValue(document.getElementById("f_pnl")?.value),
    close = document.getElementById("f_close")?.value,
    review = document.getElementById("shot-reviewed");
  if (pnl !== null)
    document.getElementById("f_pnl").dataset.resultSign =
      pnl < 0 ? "loss" : "gain";
  const hint = document.getElementById("journal-result-hint");
  if (hint)
    hint.textContent =
      pnl === null
        ? "Pode salvar só o print ou as notas. Nenhum resultado será inventado."
        : `Resultado informado: ${formatAccountMoney(pnl)}. ${!close ? "Escolha o fechamento (ou Agora) para concluir a operação." : review && !review.checked ? "Confira os dados reconhecidos e marque a confirmação do print para incluir no P&L." : "Este resultado entrará nas estatísticas ao salvar."}`;
  form
    .querySelectorAll("[data-result-sign]")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(
          (pnl === null
            ? document.getElementById("f_pnl").dataset.resultSign
            : pnl < 0
              ? "loss"
              : "gain") === b.dataset.resultSign,
        ),
      ),
    );
  const prices = document.getElementById("journal-prices");
  if (
    showPrices === true &&
    prices &&
    ["entry", "stop", "target", "size", "risk", "leverage"].some(
      (k) => document.getElementById("f_" + k)?.value,
    )
  )
    prices.open = true;
  const reread = document.getElementById("journal-reread");
  if (reread) reread.hidden = !cur?.img?.length;
  const photo = document.getElementById("journal-shot-area");
  if (photo && showPrices === true && cur?.img?.length) {
    photo.open = false;
    photo.querySelector("summary").textContent =
      "Print anexado · abrir para conferir ou ler novamente";
  }
  const notes = document.getElementById("journal-notes");
  if (
    notes &&
    showPrices === true &&
    ["notes", "lesson", "feelings"].some(
      (k) => document.getElementById("f_" + k)?.value,
    )
  )
    notes.open = true;
}
async function journalRereadPrint() {
  const owner = K,
    trade = cur,
    source = trade?.img?.at(-1);
  if (!source || !taSafeImage(source)) return;
  const blob = await (await fetch(source)).blob();
  if (owner !== K || cur !== trade) return;
  return readTradingShot(
    new File([blob], "print-salvo.jpg", { type: blob.type }),
    { existing: true },
  );
}
async function journalReadWithAI() {
  const trade = cur,
    owner = K,
    source = trade?.img?.at(-1),
    status = document.getElementById("shot-status");
  if (!source || !taSafeImage(source)) {
    status.textContent =
      "Adicione um print primeiro. A leitura local continua disponível.";
    return;
  }
  if (!taConnection.authenticated || !taConnection.services?.ai) {
    status.textContent =
      "Conecte a IA nas Configurações para usar esta leitura. O print continua salvo no editor.";
    return;
  }
  const run = ++shotGeneration;
  status.textContent = "Lendo o print com IA…";
  const button = document.getElementById("journal-ai");
  button.disabled = true;
  try {
    const result = await taApi("/api/extract-trade", {
      method: "POST",
      body: JSON.stringify({
        image: { dataUrl: source },
        currency: S.currency || null,
      }),
    });
    if (
      K !== owner ||
      cur !== trade ||
      run !== shotGeneration ||
      !document.getElementById("dlg").open
    )
      return;
    let count = 0;
    for (const [key, value] of Object.entries(result.fields || {})) {
      const input = document.getElementById("f_" + key);
      if (input && input.value === "") {
        input.value = value;
        count++;
      }
    }
    cur.screenshotIntake = true;
    cur.shotEvidence = {
      engine: "vision",
      reader: "TV-3",
      issues: result.issues || [],
      evidence: result.evidence || "",
    };
    journalResetReview();
    document.getElementById("shot-results").innerHTML =
      `<p>${count} campo(s) preenchido(s) pela IA. Valores já digitados foram preservados.</p><p>${esc(result.evidence || "")}</p>${(result.issues || []).map((i) => `<p class="muted-note">${esc(i)}</p>`).join("")}<label class="shot-review"><input id="shot-reviewed" type="checkbox"> Conferi os campos reconhecidos com o print</label>`;
    status.textContent = count
      ? "Confira os preços, a direção e os demais campos antes de salvar."
      : "A IA não identificou dados suficientes. O print continua disponível para registrar.";
    journalQuickRefresh(true);
  } catch (e) {
    if (K === owner && cur === trade && run === shotGeneration)
      status.textContent =
        "Não foi possível ler com IA: " +
        e.message +
        " O print e seus campos foram preservados.";
  } finally {
    if (button.isConnected) button.disabled = false;
    journalQuickRefresh();
  }
}
function journalQuickMount() {
  const dialog = document.getElementById("dlg");
  if (!dialog?.open || document.getElementById("journal-result-hint")) return;
  for (const [key, , type] of FL)
    if (type === "number") {
      const input = document.getElementById("f_" + key);
      input.type = "text";
      input.inputMode = "decimal";
      input.autocomplete = "off";
    }
  let quick = dialog.querySelector(".diary-quick-fields");
  if (!quick) {
    quick = document.createElement("div");
    quick.className = "fg diary-quick-fields";
    document.getElementById("trade-technical").before(quick);
  }
  for (const key of ["symbol", "side", "pnl", "close", "strategy", "setup"])
    quick.append(document.getElementById("f_" + key).closest("label"));
  const side = document.getElementById("f_side");
  side.hidden = true;
  const choices = document.createElement("div");
  choices.className = "journal-side-choices";
  choices.setAttribute("role", "group");
  choices.setAttribute("aria-label", "Direção da operação");
  choices.innerHTML = ["long", "short", ""]
    .map(
      (v, i) =>
        `<button class="b s" type="button" data-side-choice="${v}" onclick="journalQuickChoice('side',this.dataset.sideChoice)">${["Compra", "Venda", "Não sei"][i]}</button>`,
    )
    .join("");
  side.after(choices);
  const resultButtons = document.createElement("div");
  resultButtons.className = "journal-side-choices";
  resultButtons.setAttribute("role", "group");
  resultButtons.setAttribute("aria-label", "Tipo do resultado");
  resultButtons.innerHTML =
    '<button type="button" class="b s" data-result-sign="gain" onclick="journalResultSign(\'gain\')">Ganho</button><button type="button" class="b s" data-result-sign="loss" onclick="journalResultSign(\'loss\')">Perda</button>';
  document.getElementById("f_pnl").after(resultButtons);
  const now = document.createElement("button");
  now.type = "button";
  now.className = "b s";
  now.textContent = "Encerrada agora";
  now.onclick = journalCloseNow;
  document.getElementById("f_close").after(now);
  const hint = document.createElement("p");
  hint.id = "journal-result-hint";
  hint.className = "journal-result-hint";
  hint.setAttribute("role", "status");
  quick.after(hint);
  const prices = document.createElement("details");
  prices.id = "journal-prices";
  prices.className = "journal-prices";
  prices.innerHTML =
    '<summary>Entrada, stop, alvo e quantidade · revisar dados do print</summary><div class="fg"></div>';
  hint.after(prices);
  for (const key of ["entry", "stop", "target", "plannedRR", "size", "risk"])
    prices
      .querySelector(".fg")
      .append(document.getElementById("f_" + key).closest("label"));
  prices
    .querySelector(".fg")
    .insertAdjacentHTML(
      "beforeend",
      '<label>Alavancagem (x), se informada<input id="f_leverage" type="text" inputmode="decimal" placeholder="Opcional"></label>',
    );
  document.getElementById("f_leverage").value = cur.leverage ?? "";
  const confirmation = document.createElement("div");
  confirmation.id = "journal-confirmation";
  prices.after(confirmation);
  const rows = [...(S.trades || []), ...(S.tradeDrafts || [])],
    plan = taCurrentPlan();
  for (const key of ["symbol", "strategy", "setup", "tags"]) {
    const values = [
      ...new Set(
        [
          ...(key === "symbol"
            ? [...(taProfile().instruments || []), ...(plan?.instruments || [])]
            : key === "strategy"
              ? [...(S.strats || []).map((s) => s.name), plan?.name]
              : []),
          ...rows
            .slice()
            .reverse()
            .map((t) => t[key]),
        ].filter((v) => typeof v === "string" && v.trim()),
      ),
    ].slice(0, 30);
    const input = document.getElementById("f_" + key),
      list = document.createElement("datalist");
    list.id = "journal-options-" + key;
    list.innerHTML = values
      .map((v) => `<option value="${esc(v)}"></option>`)
      .join("");
    input.setAttribute("list", list.id);
    dialog.append(list);
    if (key !== "tags" && values.length) {
      const options = document.createElement("div");
      options.className = "journal-suggestions";
      options.innerHTML = values
        .slice(0, 4)
        .map(
          (v) =>
            `<button type="button" class="b s" data-value="${esc(v)}">${esc(v)}</button>`,
        )
        .join("");
      options.onclick = (e) => {
        const b = e.target.closest("[data-value]");
        if (b) journalQuickChoice(key, b.dataset.value);
      };
      input.after(options);
    }
  }
  const technical = document.getElementById("trade-technical");
  technical.querySelector("summary").textContent = "Mais dados opcionais";
  technical.open = false;
  const shot = document.getElementById("shot-results");
  if (shot) {
    const tools = document.createElement("div");
    tools.className = "journal-reader-tools";
    tools.innerHTML =
      '<button type="button" class="b s" id="journal-reread" onclick="journalRereadPrint()">Reler print salvo</button><button type="button" class="b s" id="journal-ai" onclick="journalReadWithAI()">Preencher com IA</button><small>Ao clicar em IA, o último print e a moeda da conta são enviados à OpenAI. Nenhum histórico é enviado. Confira os campos antes de salvar.</small>';
    shot.after(tools);
  }
  const intake = dialog.querySelector(".shot-intake");
  if (intake) {
    const area = document.createElement("details");
    area.id = "journal-shot-area";
    area.open = !cur.img?.length;
    area.innerHTML =
      "<summary>Print (opcional) · ler e preencher os campos</summary>";
    intake.before(area);
    area.append(intake);
    const tools = dialog.querySelector(".journal-reader-tools");
    if (tools) {
      area.after(tools);
      const note = document.createElement("p");
      note.id = "journal-reader-note";
      note.className = "muted-note";
      note.setAttribute("role", "status");
      tools.after(note);
    }
    area.append(document.getElementById("th"));
  }
  const notes = document.createElement("details");
  notes.id = "journal-notes";
  notes.className = "journal-prices";
  notes.innerHTML = "<summary>Notas, emoção e contexto · opcional</summary>";
  const feelings = document.getElementById("f_feelings").closest("label"),
    paragraph = document.getElementById("f_notes").closest("p"),
    emotion = document.getElementById("f_emotion").closest("label"),
    behavior = dialog.querySelector(".behavior-panel");
  feelings.before(notes);
  for (const node of [emotion, feelings, behavior, paragraph])
    if (node) notes.append(node);
  dialog.addEventListener("input", journalResultInput);
  dialog.addEventListener("input", journalPriceInput);
  dialog.addEventListener("input", journalQuickRefresh);
  dialog.addEventListener("change", journalQuickRefresh);
  journalQuickRefresh(true);
}
const journalEditOriginal = edit;
edit = function () {
  const result = journalEditOriginal.apply(this, arguments);
  journalQuickMount();
  return result;
};
