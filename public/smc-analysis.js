/* The existing analyst route, backed only by the Python SMC V1 classifier. */
(function () {
  const e = esc,
    roles = ["macro", "micro"],
    tfs = ["M1", "M2", "M3", "M5", "M10", "M15", "M30", "H1", "H4", "D1"];
  const checks = {
    crop_contains_no_future_candles:
      "O recorte não contém candles posteriores à decisão.",
    projections_and_outcome_annotations_removed:
      "Removi projeções e anotações que revelam o resultado.",
    overlays_use_only_predecision_data:
      "Indicadores e perfis usam somente dados anteriores à decisão.",
    context_known_at_decision:
      "Ativo e timeframes eram conhecidos no momento da decisão.",
  };
  let owner = null,
    draft = null,
    history = [],
    nextCursor = null,
    selected = null,
    error = "",
    info = "",
    pending = false,
    loaded = false,
    loading = null,
    poll = null,
    saveTimer = null,
    tool = {},
    drag = {},
    imageRuns = {};
  function fresh() {
    return {
      requestId: crypto.randomUUID(),
      asset: "",
      executionTF: "",
      macroTF: "",
      decision: "",
      timezone: taProfile().timezone,
      images: {},
      jobId: null,
    };
  }
  function db() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("loupply-smc-review", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("drafts");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () =>
        reject(Error("Não foi possível abrir o rascunho neste dispositivo."));
    });
  }
  async function save() {
    if (!draft || owner !== K) return false;
    const data = structuredClone(draft),
      key = owner;
    try {
      const store = await db();
      await new Promise((resolve, reject) => {
        const tx = store.transaction("drafts", "readwrite");
        tx.objectStore("drafts").put(data, key);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(Error("Não foi possível salvar o rascunho."));
        tx.onabort = tx.onerror;
      });
      store.close();
      return owner === key;
    } catch {
      info =
        "O rascunho não pôde ser salvo neste dispositivo. Mantenha a página aberta; análises já enviadas permanecem no histórico do servidor.";
      return false;
    }
  }
  async function restore(key) {
    try {
      const store = await db(),
        data = await new Promise((resolve, reject) => {
          const q = store.transaction("drafts").objectStore("drafts").get(key);
          q.onsuccess = () => resolve(q.result);
          q.onerror = reject;
        });
      store.close();
      return data;
    } catch {
      return null;
    }
  }
  function active() {
    return !CLOUD_BOOT || eliteCloud.ready;
  }
  function busy() {
    return pending || ["queued", "running"].includes(selected?.status);
  }
  function redraw() {
    if (tab === "analyst" && active()) R();
  }
  function remember() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save(), 300);
  }
  async function boot() {
    if (!active()) return;
    if (owner !== K) {
      clearTimeout(poll);
      owner = K;
      draft = null;
      history = [];
      nextCursor = null;
      selected = null;
      loaded = false;
      pending = false;
      imageRuns = {};
      tool = {};
      drag = {};
      error = "";
      info = "";
      loading = null;
    }
    if (draft || loading) return;
    const key = owner;
    loading = (async () => {
      const saved = await restore(key);
      if (owner !== key || K !== key) return;
      draft = saved?.requestId && saved.images ? saved : fresh();
      loaded = true;
      await refreshHistory(false);
      redraw();
    })();
  }
  async function refreshHistory(show = true) {
    if (!active() || !taConnection.authenticated) return;
    const key = owner;
    try {
      const result = await taApi("/api/smc/analyses");
      if (owner !== key || K !== key) return;
      history = result.analyses || [];
      nextCursor = result.next_cursor;
      if (draft?.jobId)
        selected = history.find((j) => j.id === draft.jobId) || selected;
      error = "";
      schedule();
      if (show) redraw();
    } catch (err) {
      if (owner === key) {
        error = err.message;
        if (show) redraw();
      }
    }
  }
  function schedule() {
    clearTimeout(poll);
    if (!selected || !["queued", "running"].includes(selected.status)) return;
    const key = owner,
      id = selected.id;
    poll = setTimeout(async () => {
      if (document.hidden) {
        schedule();
        return;
      }
      try {
        const job = await taApi("/api/smc/analyses/" + id);
        if (owner !== key || K !== key) return;
        selected = job;
        const i = history.findIndex((j) => j.id === id);
        if (i < 0) history.unshift(job);
        else history[i] = job;
        error = "";
        redraw();
        schedule();
      } catch (err) {
        if (owner === key) {
          error =
            err.message +
            " A solicitação não foi reenviada. Atualize o histórico para conferir o resultado.";
          redraw();
        }
      }
    }, 1800);
  }
  function tf(label, id, value) {
    return `<label>${label}<select id="${id}" onchange="smcStoreForm()"><option value="">Não informado</option>${tfs.map((v) => `<option ${value === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>`;
  }
  function field(label, id, value, type = "text") {
    return `<label>${label}<input id="${id}" type="${type}" value="${e(value || "")}" oninput="smcStoreForm()" onchange="smcStoreForm()"></label>`;
  }
  function assetField() {
    const plan = taCurrentPlan(),
      values = [
        ...new Set(
          [
            ...(plan?.instruments || []),
            ...taProfile().instruments,
            ...(S.trades || []).map((t) => t.symbol),
          ].filter((v) => typeof v === "string" && v.length <= 24),
        ),
      ];
    return `<label>Ativo<input id="ta-a-asset" list="smc-known-assets" maxlength="24" value="${e(draft.asset)}" oninput="smcStoreForm()"><datalist id="smc-known-assets">${values.map((v) => `<option value="${e(v)}">`).join("")}</datalist></label>`;
  }
  function card(role) {
    const image = draft.images[role];
    return `<section class="card smc-evidence-card"><div class="section-head"><h3>Print ${role === "macro" ? "Macro" : "Micro"}</h3><label class="b s">${image ? "Trocar print" : "Selecionar print"}<input type="file" accept="image/png,image/jpeg,image/webp" hidden ${busy() ? "disabled" : ""} onchange="smcLoadImage('${role}',this.files[0])"></label></div>${
      image
        ? `${tf("Timeframe desta imagem", "smc-tf-" + role, image.timeframe)}<div class="smc-canvas-wrap"><canvas id="smc-canvas-${role}" aria-label="Revisão visual ${role}" tabindex="0"></canvas></div><div class="row"><button type="button" class="b s" onclick="smcSetTool('${role}','crop')">Marcar recorte</button><button type="button" class="b s" onclick="smcSetTool('${role}','mask')">Marcar máscara</button><button type="button" class="b s" onclick="smcUndoMask('${role}')">Desfazer máscara</button><button type="button" class="b s" onclick="smcResetCrop('${role}')">Imagem inteira</button><button type="button" class="b s" onclick="smcRemoveImage('${role}')">Remover</button></div><p class="muted-note">Arraste sobre a imagem para marcar o recorte ou uma máscara. Retângulo verde: recorte; cinza: máscara. Máscaras não reconstroem candles ocultos. ${image.masks.length} máscara(s).</p><fieldset class="smc-checks"><legend>Revisão temporal desta imagem</legend>${Object.entries(
            checks,
          )
            .map(
              ([k, label]) =>
                `<label><input type="checkbox" data-smc-role="${role}" data-smc-check="${k}" ${image.checks[k] ? "checked" : ""} onchange="smcStoreForm()"> ${label}</label>`,
            )
            .join("")}</fieldset>`
        : '<p class="muted-note">PNG, JPEG ou WebP · até 6 MiB. A imagem original é preservada. Sem macro revisado o motor não aceitará um setup como válido.</p>'
    }</section>`;
  }
  const legacyResult = taAnalysisResult;
  function resultView() {
    if (!selected)
      return taAnalyst.result
        ? `<div class="badge">Análise anterior · formato legado</div>${legacyResult()}`
        : "";
    const labels = {
      queued: "Aguardando processamento",
      running: "Python analisando evidências",
      completed: "Análise concluída",
      failed: "Falha da análise",
      interrupted: "Processamento interrompido",
      cancelled: "Cancelada antes da chamada",
    };
    const result = selected.result,
      a = result?.assessment,
      status = {
        valid: "Setup válido",
        invalid: "Setup inválido",
        insufficient_evidence: "Evidência insuficiente",
      };
    return `<section class="card smc-analysis-result"><div class="section-head"><h2>${e(a ? status[a.classification] : labels[selected.status] || selected.status)}</h2><span class="badge">SMC Elite V1 · Python</span></div>${selected.error ? `<p role="alert">${e(selected.error)}</p>` : ""}${selected.cancel_requested ? "<p>Cancelamento solicitado. Uma chamada já iniciada pode concluir e ter custo; o resultado será preservado.</p>" : ""}${["queued", "running"].includes(selected.status) ? '<p role="status">Você pode sair desta tela e consultar o histórico depois. Não envie a mesma análise novamente.</p><button class="b s" onclick="smcCancel()">Solicitar cancelamento</button>' : ""}${
      a
        ? `<p><b>Direção candidata:</b> ${e(a.direction === "UNKNOWN" ? "Não identificada" : a.direction)}</p><p>${e(a.justification)}</p><p class="muted-note">Classificação das evidências visuais. Consulte os critérios e as limitações antes de tomar sua decisão.</p><div class="smc-evidence-grid">${roles
            .map((role) => {
              const indexes = selected.images
                  .map((i, n) => (i.role === role ? n : -1))
                  .filter((i) => i >= 0),
                items = a.criteria_found.filter((c) =>
                  indexes.includes(c.image_index),
                );
              return `<section><h3>${role === "macro" ? "Contexto e viés macro" : "Estrutura e contexto micro"}</h3>${items.length ? items.map((c) => `<p><b>${e(c.description)}</b><br>${e(c.evidence)}</p>`).join("") : "<p>Não verificável nesta resposta. Consulte os critérios e as limitações.</p>"}</section>`;
            })
            .join("")}</div>${[
            ["criteria_found", "Critérios encontrados"],
            ["criteria_absent", "Critérios ausentes/violados"],
            ["criteria_unverifiable", "Critérios não verificáveis"],
          ]
            .map(
              ([k, title]) =>
                `<details open><summary>${title} (${a[k].length})</summary>${a[k].map((c) => `<article><b>${e(c.criterion_id)} · ${e(c.description)}</b><p>${e(c.evidence)}</p><small>${c.image_index === null ? "Contexto fornecido" : `Imagem ${c.image_index + 1} · ${e(selected.images[c.image_index]?.role || "")}`} · ${e(c.source)}</small></article>`).join("") || "<p>Nenhum item retornado.</p>"}</details>`,
            )
            .join(
              "",
            )}<h3>Limitações</h3>${a.limitations.map((l) => `<p>${e(l)}</p>`).join("") || "<p>Nenhuma limitação adicional declarada pelo modelo.</p>"}${result.system_findings?.length ? `<h3>Filtros do sistema</h3>${result.system_findings.map((f) => `<p>${e(f.rule_id)} · ${e(f.status)} · ${e(f.source)}</p>`).join("")}` : ""}<details><summary>Imagens originais e rastreabilidade</summary>${selected.images.map((i, n) => `<figure><img class="smc-history-image" src="/api/smc/evidence/${e(i.source_id)}" alt="Fonte ${e(i.role)} desta conta"><img class="smc-history-image" src="/api/smc/analyses/${e(selected.id)}/images/${n}" alt="Derivado revisado ${e(i.role)} enviado ao motor"><figcaption>Fonte e derivado ${e(i.role)} · decisão: ${e(i.review.decision_at)} · ${i.review.masks.length} máscara(s); critérios referem-se ao derivado revisado.</figcaption></figure>`).join("")}<p>Pacote ${e(result.engine_package_version)} · regras ${e(result.rules_version)} · prompt ${e(result.prompt_version)}</p><p>SHA regras: ${e(result.rules_sha256)}<br>SHA prompt: ${e(result.prompt_sha256)}</p><p>Modelo: ${e(result.model)} · resposta: ${e(result.response_id)}</p><p>Tokens: ${e(result.usage?.input_tokens)} entrada / ${e(result.usage?.output_tokens)} saída. Custo estimado: ${result.estimated_cost_usd == null ? "não disponível" : e("US$ " + result.estimated_cost_usd.toFixed(6))}. Reserva estimada: US$ ${e(selected.reserved_usd.toFixed(6))}. A fatura do provedor prevalece.</p><details><summary>Resposta original do modelo, antes dos filtros</summary><pre class="ta-plan-json">${e(JSON.stringify(result.model_assessment, null, 2))}</pre></details></details><details><summary>Confirmar ou corrigir interpretação</summary><form id="smc-correction" onsubmit="event.preventDefault();smcSaveCorrection(this)"><div class="fg"><label>Ação<select name="kind"><option value="confirm">Confirmar interpretação</option><option value="correction">Registrar correção</option></select></label><label>Classificação humana<select name="classification"><option value="">Manter / não corrigir</option>${Object.entries(
            status,
          )
            .map(([k, v]) => `<option value="${k}">${v}</option>`)
            .join(
              "",
            )}</select></label><label>Direção humana<select name="direction"><option value="">Não corrigir</option><option>BUY</option><option>SELL</option><option>UNKNOWN</option></select></label><label>Critério opcional<select name="criterion_id"><option value="">Não corrigir critério</option>${[...a.criteria_found, ...a.criteria_absent, ...a.criteria_unverifiable].map((c) => `<option>${e(c.criterion_id)}</option>`).join("")}</select></label><label>Status do critério<select name="criterion_status"><option value="found">Encontrado</option><option value="absent">Ausente/violado</option><option value="unverifiable">Não verificável</option></select></label></div><label>Motivo/evidência<textarea name="reason" maxlength="3000"></textarea></label><button class="b s">Salvar revisão humana</button></form></details><p>${selected.reviews.length} revisão(ões) humana(s). O original permanece inalterado e não há retreinamento automático.</p>${selected.reviews.map((r) => `<article><b>${r.kind === "confirm" ? "Confirmação" : "Correção humana"} · ${e(r.created_at)}</b><p>${e(r.classification || "")} ${e(r.direction || "")} ${e(r.criterion_id || "")} ${e(r.criterion_status || "")}</p><p>${e(r.reason || "")}</p></article>`).join("")}`
        : `<p>Reserva estimada: US$ ${e(selected.reserved_usd.toFixed(6))}. Falhas/interrupções não são tratadas como custo zero nem como setup inválido.</p>`
    }</section>`;
  }
  vAnalyst = function () {
    if (!active())
      return '<section class="card"><p>Carregando a conta…</p></section>';
    if (!draft) {
      boot();
      return '<section class="card"><h2>Analisar um Setup com SMC IA</h2><p>Carregando seu rascunho…</p></section>';
    }
    return `<section class="card"><div class="section-head"><div><div class="eyebrow">SMC Elite V1 · regras V7 · motor Python</div><h2>Analisar um Setup com SMC IA</h2><p>Envie Macro/Micro, revise o instante e as imagens e solicite a classificação do seu operacional.</p></div><button class="b s" onclick="smcNewAnalysis()" ${busy() ? "disabled" : ""}>Nova análise</button></div><form id="ta-analyst-form" onsubmit="event.preventDefault();smcSubmit()"><fieldset class="smc-form-fields" ${busy() ? "disabled" : ""}><div class="fg">${assetField()}${tf("Timeframe operacional da OB", "smc-execution-tf", draft.executionTF)}${tf("Timeframe macro", "smc-macro-tf", draft.macroTF)}${field("Momento da decisão (mercado)", "smc-decision", draft.decision, "datetime-local")}${field("Fuso IANA da decisão", "smc-timezone", draft.timezone)}</div><p class="muted-note">Informe o momento real da decisão. O horário de exportação do print não será usado. Timeframe da imagem e timeframe operacional da OB são informações diferentes.</p><div class="smc-evidence-grid">${roles.map(card).join("")}</div><p class="muted-note">As imagens serão enviadas aos backends e os derivados revisados à OpenAI somente ao analisar. Histórico, rótulos humanos e correções não são enviados como contexto. Sem decisão/revisão conhecida, salve o rascunho pendente neste dispositivo.</p><div class="row"><button class="b" type="submit">Analisar um Setup com SMC IA</button><button class="b s" type="button" onclick="smcSaveDraft()">Salvar revisão pendente</button>${taCurrentPlan() ? '<button class="b s" type="button" onclick="smcManual()">Revisar manualmente meu plano</button>' : ""}</div></fieldset></form><p class="ta-status-error" role="alert">${e(error)}</p><p role="status">${e(info)}</p></section>${resultView()}<details class="card" open><summary>Histórico das análises</summary><button class="b s" onclick="smcRefreshHistory()">Atualizar histórico</button><div class="ta-analysis-history">${history.map((j) => `<button class="b s" data-smc-job="${e(j.id)}" onclick="smcOpenAnalysis(this.dataset.smcJob)">${e(j.context.symbol || "Ativo não informado")} · ${e(j.result?.assessment.classification || j.status)} · ${e(j.created_at)}</button>`).join("")}${(
      S.setupAnalyses || []
    )
      .slice()
      .reverse()
      .map(
        (j) =>
          `<button class="b s" data-legacy-id="${e(j.id)}" onclick="smcOpenLegacy(this.dataset.legacyId)">Legado · ${e(j.context?.asset || "")} · ${e(j.asOf || "")}</button>`,
      )
      .join(
        "",
      )}</div>${nextCursor ? '<button class="b s" onclick="smcMoreHistory()">Carregar análises anteriores</button>' : ""}</details>`;
  };
  window.smcStoreForm = function () {
    if (!draft || owner !== K) return;
    const previousContext = JSON.stringify([
      draft.asset,
      draft.executionTF,
      draft.macroTF,
      draft.decision,
      draft.timezone,
    ]);
    draft.asset =
      document.getElementById("ta-a-asset")?.value.trim().toUpperCase() || "";
    draft.executionTF =
      document.getElementById("smc-execution-tf")?.value || "";
    draft.macroTF = document.getElementById("smc-macro-tf")?.value || "";
    draft.decision = document.getElementById("smc-decision")?.value || "";
    draft.timezone = document.getElementById("smc-timezone")?.value || "";
    for (const role of roles) {
      const image = draft.images[role];
      if (!image) continue;
      const previousTF = image.timeframe;
      image.timeframe =
        document.getElementById("smc-tf-" + role)?.value ??
        image.timeframe ??
        "";
      document
        .querySelectorAll(`[data-smc-role="${role}"]`)
        .forEach((input) => {
          image.checks[input.dataset.smcCheck] = input.checked;
        });
      if (
        previousTF !== image.timeframe ||
        previousContext !==
          JSON.stringify([
            draft.asset,
            draft.executionTF,
            draft.macroTF,
            draft.decision,
            draft.timezone,
          ])
      ) {
        image.checks = {};
        document
          .querySelectorAll(`[data-smc-role="${role}"]`)
          .forEach((input) => (input.checked = false));
      }
    }
    remember();
  };
  window.smcLoadImage = async function (role, file) {
    if (!file || !roles.includes(role) || busy()) return;
    smcStoreForm();
    const key = owner,
      run = crypto.randomUUID();
    imageRuns[role] = run;
    try {
      if (
        !/^image\/(png|jpeg|webp)$/.test(file.type) ||
        file.size > 6 * 1024 * 1024
      )
        throw Error("Use PNG, JPEG ou WebP de até 6 MiB.");
      const data = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(Error("Não foi possível abrir a imagem."));
        r.readAsDataURL(file);
      });
      const img = await loadPicture(data);
      if (img.naturalWidth * img.naturalHeight > 24000000)
        throw Error("Use imagens de até 24 megapixels.");
      if (owner !== key || K !== key || imageRuns[role] !== run) return;
      draft.images[role] = {
        data,
        width: img.naturalWidth,
        height: img.naturalHeight,
        sourceId: null,
        timeframe: role === "macro" ? draft.macroTF : "",
        crop: [0, 0, img.naturalWidth, img.naturalHeight],
        masks: [],
        checks: {},
      };
      error = "";
      await save();
      redraw();
    } catch (err) {
      error = err.message;
      redraw();
    }
  };
  function loadPicture(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(Error("Imagem inválida."));
      image.src = src;
    });
  }
  function paint(role) {
    const canvas = document.getElementById("smc-canvas-" + role),
      item = draft?.images[role];
    if (!canvas || !item) return;
    const key = owner;
    loadPicture(item.data)
      .then((img) => {
        if (owner !== key || !canvas.isConnected) return;
        const scale = Math.min(1, 800 / img.naturalWidth);
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#808080";
        for (const [x0, y0, x1, y1] of item.masks)
          ctx.fillRect(
            x0 * scale,
            y0 * scale,
            (x1 - x0) * scale,
            (y1 - y0) * scale,
          );
        ctx.strokeStyle = "#1fea9c";
        ctx.lineWidth = 2;
        const [x0, y0, x1, y1] = item.crop;
        ctx.strokeRect(
          x0 * scale,
          y0 * scale,
          (x1 - x0) * scale,
          (y1 - y0) * scale,
        );
      })
      .catch(() => {});
    canvas.onpointerdown = (ev) => {
      if (busy()) return;
      canvas.setPointerCapture(ev.pointerId);
      drag[role] = point(canvas, item, ev);
    };
    canvas.onpointerup = (ev) => {
      const start = drag[role];
      if (!start || busy()) return;
      const end = point(canvas, item, ev);
      delete drag[role];
      const rect = [
        Math.min(start[0], end[0]),
        Math.min(start[1], end[1]),
        Math.max(start[0], end[0]),
        Math.max(start[1], end[1]),
      ];
      if (rect[2] - rect[0] < 2 || rect[3] - rect[1] < 2) return;
      if (tool[role] === "mask") item.masks.push(rect);
      else item.crop = rect;
      item.checks = {};
      remember();
      redraw();
    };
    canvas.onpointercancel = () => {
      delete drag[role];
    };
  }
  function point(canvas, item, ev) {
    const r = canvas.getBoundingClientRect();
    return [
      Math.max(
        0,
        Math.min(
          item.width,
          Math.round(((ev.clientX - r.left) * item.width) / r.width),
        ),
      ),
      Math.max(
        0,
        Math.min(
          item.height,
          Math.round(((ev.clientY - r.top) * item.height) / r.height),
        ),
      ),
    ];
  }
  window.smcSetTool = (role, value) => {
    tool[role] = value;
    info =
      value === "mask"
        ? "Arraste para cobrir uma anotação com máscara cinza."
        : "Arraste para delimitar o recorte da decisão.";
    redraw();
  };
  window.smcUndoMask = (role) => {
    if (busy()) return;
    draft.images[role].masks.pop();
    draft.images[role].checks = {};
    remember();
    redraw();
  };
  window.smcResetCrop = (role) => {
    if (busy()) return;
    const i = draft.images[role];
    i.crop = [0, 0, i.width, i.height];
    i.checks = {};
    remember();
    redraw();
  };
  window.smcRemoveImage = (role) => {
    if (busy()) return;
    delete draft.images[role];
    remember();
    redraw();
  };
  window.smcSaveDraft = async () => {
    smcStoreForm();
    info = (await save())
      ? "Revisão pendente salva neste dispositivo. Não houve chamada paga."
      : info;
    redraw();
  };
  window.smcNewAnalysis = async () => {
    if (busy()) return;
    const previous = draft;
    draft = fresh();
    draft.asset = previous?.asset || "";
    draft.executionTF = previous?.executionTF || "";
    draft.macroTF = previous?.macroTF || "";
    selected = null;
    taAnalyst.result = null;
    error = "";
    info = "Nova revisão. O histórico anterior foi preservado.";
    await save();
    redraw();
  };
  window.smcSubmit = async () => {
    if (busy()) return;
    smcStoreForm();
    error = "";
    const key = owner;
    try {
      if (!taConnection.authenticated)
        throw Error("Entre na sua conta/conecte o servidor antes de analisar.");
      if (!draft.decision)
        throw Error(
          "Informe o momento da decisão; sem ele a revisão permanece pendente.",
        );
      const date = draft.decision.slice(0, 10),
        time = draft.decision.slice(11, 16),
        instant = SessionEngine.zonedDateTimeToUtc(
          date,
          time,
          draft.timezone,
          "reject",
        );
      const images = roles.filter((r) => draft.images[r]);
      if (!images.length) throw Error("Selecione pelo menos um print.");
      for (const role of images)
        if (
          !Object.keys(checks).every(
            (k) => draft.images[role].checks[k] === true,
          )
        )
          throw Error(
            "Confirme as quatro verificações temporais de cada imagem.",
          );
      pending = true;
      redraw();
      const health = await taApi("/api/smc/status");
      if (K !== key || owner !== key) return;
      if (!health.configured)
        throw Error(
          "O serviço Python precisa de chave e orçamento configurados no backend. Nenhuma chamada paga foi iniciada.",
        );
      info = "Preparando evidências no backend Python…";
      redraw();
      for (const role of images) {
        const image = draft.images[role];
        if (!image.sourceId) {
          const result = await taApi("/api/smc/evidence", {
            method: "POST",
            body: JSON.stringify({ dataUrl: image.data }),
          });
          if (K !== key || owner !== key) return;
          image.sourceId = result.id;
          await save();
        }
      }
      if (!(await save()))
        throw Error(
          "Não foi possível preservar a solicitação neste dispositivo. Mantenha esta página aberta e salve a revisão antes de reenviar.",
        );
      const result = await taApi("/api/analyse", {
        method: "POST",
        body: JSON.stringify({
          engine: "smc-elite-v1",
          requestId: draft.requestId,
          context: {
            symbol: draft.asset || null,
            execution_ob_timeframe: draft.executionTF || null,
            macro_timeframe: draft.macroTF || null,
          },
          images: images.map((role) => {
            const image = draft.images[role];
            return {
              sourceId: image.sourceId,
              role,
              review: {
                decision_at: instant,
                crop: image.crop,
                masks: image.masks,
                print_timeframe: image.timeframe || null,
                ...image.checks,
              },
            };
          }),
        }),
      });
      if (K !== key || owner !== key) return;
      selected = result;
      draft.jobId = result.id;
      history = [result, ...history.filter((j) => j.id !== result.id)];
      await save();
      info =
        "Solicitação registrada. A classificação será produzida pelo Python.";
      schedule();
    } catch (err) {
      if (owner === key) error = err.message;
    } finally {
      if (owner === key) {
        pending = false;
        redraw();
      }
    }
  };
  window.smcMoreHistory = async () => {
    if (!nextCursor) return;
    const key = owner;
    try {
      const r = await taApi(
        "/api/smc/analyses?before=" + encodeURIComponent(nextCursor),
      );
      if (key !== K || key !== owner) return;
      history = [
        ...history,
        ...r.analyses.filter((j) => !history.some((h) => h.id === j.id)),
      ];
      nextCursor = r.next_cursor;
      redraw();
    } catch (err) {
      if (key === owner) {
        error = err.message;
        redraw();
      }
    }
  };
  window.smcRefreshHistory = () => refreshHistory();
  window.smcOpenAnalysis = async (id) => {
    const key = owner;
    try {
      const result = await taApi("/api/smc/analyses/" + id);
      if (key !== K || owner !== key) return;
      selected = result;
      error = "";
      schedule();
      redraw();
    } catch (err) {
      error = err.message;
      redraw();
    }
  };
  window.smcOpenLegacy = (id) => {
    selected = null;
    taOpenAnalysis(id);
  };
  window.smcSaveCorrection = async (form) => {
    if (!selected) return;
    const key = owner,
      id = selected.id;
    try {
      const body = Object.fromEntries(new FormData(form));
      const result = await taApi("/api/smc/analyses/" + id + "/review", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (key !== K || owner !== key) return;
      selected = result;
      info = "Revisão humana registrada; a análise original foi preservada.";
      redraw();
    } catch (err) {
      error = err.message;
      redraw();
    }
  };
  window.smcCancel = async () => {
    if (!selected) return;
    const key = owner;
    try {
      const result = await taApi(
        "/api/smc/analyses/" + selected.id + "/cancel",
        { method: "POST", body: "{}" },
      );
      if (key !== K || key !== owner) return;
      selected = result;
      schedule();
      redraw();
    } catch (err) {
      if (key === owner) {
        error = err.message;
        redraw();
      }
    }
  };
  window.smcManual = () => {
    taAnalyst.context = {
      ...taAnalyst.context,
      asset: draft.asset,
      timeframe: draft.images.micro?.timeframe || draft.executionTF,
    };
    taAnalyst.image =
      draft.images.micro?.data || draft.images.macro?.data || null;
    selected = null;
    taRunManual();
  };
  const after = terminalAfterRender;
  terminalAfterRender = function () {
    after();
    if (!active()) {
      clearTimeout(poll);
      return;
    }
    if (owner !== K) {
      clearTimeout(poll);
      if (tab === "analyst") boot();
      return;
    }
    if (tab === "analyst") {
      if (!loaded) boot();
      else roles.forEach(paint);
    }
  };
  for (const event of ["pagehide", "beforeunload"])
    window.addEventListener(event, () => save());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) save();
    else schedule();
  });
})();
