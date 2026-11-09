/* Optional diary records share the existing workspace. Missing results never become zero-P&L trades. */
const diaryImageFlights = new WeakMap(),
  diarySaveFlights = new WeakSet();
let diaryNoticeTimer;
function diaryNotice(message, error = false) {
  const dialog = document.querySelector("#dlg");
  let local = dialog?.querySelector("#diary-save-status");
  if (dialog?.open && !local) {
    local = document.createElement("p");
    local.id = "diary-save-status";
    local.className = "diary-save-status";
    dialog.prepend(local);
  }
  if (local) {
    local.textContent = message;
    local.dataset.state = error ? "error" : "success";
    local.setAttribute("role", error ? "alert" : "status");
  }
  let toast = document.getElementById("journal-record-notice");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "journal-record-notice";
    toast.className = "journal-record-notice";
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.dataset.state = error ? "error" : "success";
  toast.setAttribute("role", error ? "alert" : "status");
  toast.hidden = false;
  clearTimeout(diaryNoticeTimer);
  diaryNoticeTimer = setTimeout(() => {
    toast.hidden = true;
  }, 7000);
}
function diaryTrackImage(trade, promise) {
  let flights = diaryImageFlights.get(trade);
  if (!flights) {
    flights = new Set();
    diaryImageFlights.set(trade, flights);
  }
  const flight = Promise.resolve(promise);
  flights.add(flight);
  flight.then(
    () => flights.delete(flight),
    () => flights.delete(flight),
  );
  return flight;
}
async function diaryAddImages(files) {
  const trade = cur;
  const tasks = [...files].map((file) =>
    diaryTrackImage(
      trade,
      (async () => {
        const source = await decodeShotImage(file),
          scale = Math.min(1, 1000 / source.width),
          canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(source.width * scale));
        canvas.height = Math.max(1, Math.round(source.height * scale));
        canvas
          .getContext("2d")
          .drawImage(source, 0, 0, canvas.width, canvas.height);
        trade.img = Array.isArray(trade.img) ? trade.img : [];
        trade.img.push(canvas.toDataURL("image/jpeg", 0.8));
        if (cur === trade && document.querySelector("#dlg")?.open) thumbs();
      })(),
    ),
  );
  try {
    await Promise.all(tasks);
    return true;
  } catch (error) {
    diaryNotice(
      "Não foi possível abrir um dos prints. Os demais dados continuam no editor. " +
        error.message,
      true,
    );
    return false;
  }
}
addImg = diaryAddImages;
function diaryReadRecord() {
  const record = { ...cur };
  for (const [key, , type] of FL) {
    const input = document.getElementById("f_" + key),
      raw = input?.value ?? "";
    if (type === "number") {
      const parsed =
        typeof diaryFieldNumber === "function"
          ? diaryFieldNumber(key, raw)
          : rNumber(raw);
      if (raw.trim() && parsed === null)
        throw Error(
          "Confira o valor de " +
            (FL.find((f) => f[0] === key)?.[1] || key) +
            ". Use números como -5,20 ou -5.20.",
        );
      record[key] = parsed;
    } else record[key] = raw;
  }
  if (document.getElementById("f_leverage")) {
    const raw = document.getElementById("f_leverage").value;
    record.leverage = diaryFieldNumber("leverage", raw);
    if (raw.trim() && record.leverage === null)
      throw Error("Confira a alavancagem informada.");
  }
  record.symbol = String(record.symbol || "")
    .trim()
    .toUpperCase();
  for (const key of ["feelings", "notes", "lesson"])
    record[key] = document.getElementById("f_" + key)?.value || "";
  if (record.importSource === "mt5")
    record.mt5StopConfirmed = !!document.getElementById("f_mt5_stop_confirmed")
      ?.checked;
  const behavior = insReadBehavior();
  if (behavior) record.behavior = behavior;
  else delete record.behavior;
  record.img = Array.isArray(cur.img) ? [...cur.img] : [];
  return record;
}
async function diarySaveRecord(mode = "auto") {
  const trade = cur,
    owner = K,
    dialog = document.querySelector("#dlg");
  if (!trade || !dialog?.open || diarySaveFlights.has(trade)) return false;
  diarySaveFlights.add(trade);
  try {
    const flights = [...(diaryImageFlights.get(trade) || [])];
    if (flights.length) {
      diaryNotice("Anexando os prints antes de salvar…");
      await Promise.all(flights);
    }
    if (cur !== trade || K !== owner || !dialog.open) return false;
    const record = diaryReadRecord();
    const confirmed =
      !record.screenshotIntake ||
      !!document.getElementById("shot-reviewed")?.checked;
    const realized =
      mode !== "planned" &&
      /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(record.close || "") &&
      Number.isFinite(Date.parse(record.close)) &&
      typeof record.pnl === "number" &&
      Number.isFinite(record.pnl) &&
      confirmed;
    const now = new Date().toISOString();
    record.createdAt = record.createdAt || now;
    record.updatedAt = now;
    delete record.isNew;
    delete record.draftId;
    if (!trade.isNew && record.pnl !== trade.pnl) record.est = false;
    const id = record.id;
    let trades = S.trades.filter((t) => t.id !== id),
      drafts = (S.tradeDrafts || []).filter(
        (t) => t.id !== id && t.id !== trade.draftId,
      );
    if (realized) {
      delete record.status;
      const index = S.trades.findIndex((t) => t.id === id);
      if (index >= 0) {
        trades = [...S.trades];
        trades[index] = record;
      } else trades.push(record);
    } else {
      record.status = mode === "planned" ? "planned" : "journal";
      drafts.push(record);
    }
    const next = { ...S, trades, tradeDrafts: drafts };
    // Persist first: a quota/auth failure must keep both saved records and this editor intact.
    persistState(next);
    S = next;
    if (realized) {
      diaryMonth = record.close.slice(0, 7);
      F = { ...F, from: "", to: "", sym: "", strat: "" };
    }
    shotGeneration++;
    dialog.close();
    R();
    diaryNotice(
      CLOUD_BOOT
        ? "Registro preservado neste navegador; aguardando confirmação da nuvem."
        : realized
          ? "Operação salva no Diário."
          : "Registro salvo no Diário. Complete o resultado e a data quando quiser incluir nas estatísticas.",
    );
    return true;
  } catch (error) {
    diaryNotice(
      "Não foi possível salvar. Seus campos e prints continuam no editor. " +
        (error.message || "Tente novamente."),
      true,
    );
    return false;
  } finally {
    diarySaveFlights.delete(trade);
  }
}
function diaryEditPartial(id) {
  const draft = (S.tradeDrafts || []).find((t) => t.id === id);
  if (!draft) return;
  edit(null);
  cur = JSON.parse(JSON.stringify(draft));
  cur.isNew = true;
  cur.draftId = id;
  for (const [key] of FL) {
    const input = document.getElementById("f_" + key);
    if (input) input.value = cur[key] ?? "";
  }
  for (const key of ["feelings", "notes", "lesson"])
    document.getElementById("f_" + key).value = cur[key] || "";
  const behavior = document.querySelector("#dlg .behavior-panel");
  if (behavior) behavior.outerHTML = insBehaviorForm();
  if (cur.screenshotIntake) {
    document.getElementById("shot-results").innerHTML =
      '<label class="shot-review"><input id="shot-reviewed" type="checkbox"> Conferi os campos reconhecidos para usar nos resultados</label>';
  }
  document.getElementById("trade-technical").open =
    typeof journalQuickRefresh !== "function";
  if (document.getElementById("f_leverage"))
    document.getElementById("f_leverage").value = cur.leverage ?? "";
  thumbs();
  if (typeof journalQuickRefresh === "function") journalQuickRefresh(true);
  document.getElementById("shot-status").textContent =
    "Todos os campos são opcionais. Seus prints e notas podem ser salvos sem resultado financeiro.";
}
function diaryPartialList() {
  const records = S.tradeDrafts || [];
  if (!records.length) return "";
  return `<section class="card diary-partials" aria-label="Registros do Diário sem resultado"><div class="section-head"><h2>Registros salvos · sem resultado confirmado</h2><span>${records.length} registro(s)</span></div><p class="muted-note">Prints, notas e planejamentos permanecem registrados. Sem fechamento e resultado confirmado, não entram no P&L ou win rate.</p><div class="diary-partial-grid">${[
    ...records,
  ]
    .reverse()
    .map((record) => {
      const image = (record.img || []).find(
        (src) => typeof taSafeImage === "function" && taSafeImage(src),
      );
      return `<article class="diary-partial-card">${image ? `<img src="${esc(image)}" alt="Print do registro ${esc(record.symbol || "sem ativo")}" loading="lazy">` : ""}<div><h3>${esc(record.symbol || "Registro sem ativo informado")}</h3><p>${esc(record.notes || record.lesson || record.feelings || "Você pode adicionar detalhes quando quiser.")}</p><small>${esc(record.close || "Fechamento não informado")}</small>${typeof record.pnl === "number" ? `<p>Resultado informado: <b>${esc(formatAccountMoney(record.pnl))}</b> · aguardando conclusão</p>` : ""}<div class="row"><button class="b s" data-id="${esc(record.id)}" onclick="editShotDraft(this.dataset.id)">Revisar / concluir</button><button class="b s" data-id="${esc(record.id)}" onclick="deleteShotDraft(this.dataset.id)">Excluir registro</button></div></div></article>`;
    })
    .join("")}</div></section>`;
}
