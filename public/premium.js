/* Progressive interaction layer. No financial calculations, network calls or store writes. */
const premiumMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const premiumFinePointer = window.matchMedia(
  "(hover: hover) and (pointer: fine)",
);
let premiumRoute = null,
  premiumPreviousNav = null,
  premiumExpanded = null,
  premiumFrame = 0,
  premiumPointer = null,
  premiumDrag = null,
  premiumLitCard = null,
  premiumMagnet = null;
let premiumCalendarStamp = null;
const premiumMetricValues = new Map();
function premiumAnimate(element, keyframes, options = {}) {
  if (!premiumMotion.matches && element?.animate)
    return element.animate(keyframes, {
      duration: 220,
      easing: "cubic-bezier(.2,.75,.25,1)",
      ...options,
    });
}
function premiumBeforeRender() {
  const active = document.querySelector("#nav .on"),
    nav = document.querySelector("#nav");
  if (active && nav && innerWidth > 760) {
    const a = active.getBoundingClientRect(),
      n = nav.getBoundingClientRect();
    premiumPreviousNav = {
      top: a.top - n.top + nav.scrollTop,
      height: a.height,
    };
  }
  premiumHideTip();
}
function premiumKeepExpanded() {
  if (premiumExpanded && document.querySelector("#premium-chart-dialog")?.open)
    terminalCharts.set(premiumExpanded.id, premiumExpanded);
}
function premiumAfterRender() {
  const nav = document.querySelector("#nav"),
    active = nav?.querySelector(".on");
  if (active && innerWidth > 760) {
    const a = active.getBoundingClientRect(),
      n = nav.getBoundingClientRect(),
      top = a.top - n.top + nav.scrollTop + 10,
      marker = document.createElement("i");
    marker.className = "premium-nav-marker";
    marker.setAttribute("aria-hidden", "true");
    marker.style.height = Math.max(12, a.height - 20) + "px";
    marker.style.transform = `translateY(${premiumPreviousNav ? premiumPreviousNav.top + 10 : top}px)`;
    nav.append(marker);
    requestAnimationFrame(() => {
      if (marker.isConnected) marker.style.transform = `translateY(${top}px)`;
    });
  }
  if (premiumRoute !== null && premiumRoute !== tab) {
    for (const element of [...document.querySelector("#main").children]
      .filter((e) => !e.classList.contains("terminal-topbar"))
      .slice(0, 8))
      premiumAnimate(
        element,
        [
          { opacity: 0.6, translate: "0 4px" },
          { opacity: 1, translate: "0 0" },
        ],
        { duration: 240 },
      );
  }
  const calendar = document.querySelector(
      ".calendar-scroll,.share-live-scroll",
    ),
    stamp =
      tab +
      "|" +
      (document.querySelector(".month-title")?.textContent ||
        (tab === "share" ? SC.month : ""));
  if (calendar && premiumCalendarStamp && premiumCalendarStamp !== stamp)
    premiumAnimate(calendar, [{ opacity: 0.6 }, { opacity: 1 }], {
      duration: 220,
    });
  premiumCalendarStamp = calendar ? stamp : null;
  premiumRoute = tab;
  document
    .querySelectorAll(
      ".terminal-performance,.ta-assistant-insight,.ta-ready-card",
    )
    .forEach((e) => e.classList.add("premium-lit-card"));
  document
    .querySelectorAll(".page-actions > .b:not(.s),.ta-home-heading > .b")
    .forEach((e) => e.classList.add("premium-magnetic"));
  document.querySelectorAll(".primary-metrics .k").forEach((card, index) => {
    const name = card.querySelector("small")?.textContent || "Métrica",
      value = card.querySelector("b"),
      key = tab + "|" + name;
    if (
      premiumMetricValues.has(key) &&
      premiumMetricValues.get(key) !== value?.textContent
    )
      premiumAnimate(value, [{ opacity: 0.5 }, { opacity: 1 }], {
        duration: 220,
      });
    premiumMetricValues.set(key, value?.textContent);
    card.dataset.metricIndex = index;
    card.setAttribute("role", "button");
    card.tabIndex = 0;
    card.setAttribute("aria-label", "Inspecionar " + name);
    card.dataset.premiumTip = "Ver os trades do período usados nesta métrica";
  });
  document
    .querySelectorAll(".cd:not(.e),.share-live-day:not(:disabled)")
    .forEach((e) => {
      e.dataset.premiumTip =
        e.getAttribute("aria-label") ||
        e.textContent.trim().replace(/\s+/g, " ");
    });
  document.querySelectorAll("header .ta-nav-group button").forEach((e) => {
    if (terminalCollapsed)
      e.dataset.premiumTip =
        e.getAttribute("aria-label") || e.textContent.trim();
  });
  const form = document.querySelector(".ta-analyst-grid form");
  if (form && typeof taAnalyst !== "undefined") {
    form.setAttribute("aria-busy", String(taAnalyst.pending));
    form.classList.toggle("premium-analysis-pending", taAnalyst.pending);
  }
}
function premiumRedrawChart(model, root) {
  const focused = document.activeElement,
    action = focused?.closest("[data-chart-action]")?.dataset.chartAction;
  root.innerHTML = terminalDrawChart(model);
  if (action) {
    const button = [...root.querySelectorAll("[data-chart-action]")].find(
      (b) => b.dataset.chartAction === action && !b.disabled,
    );
    (button || root.querySelector('[data-chart-action="reset"]'))?.focus({
      preventScroll: true,
    });
  }
  premiumAnimate(
    root.querySelector("svg"),
    [{ opacity: 0.72 }, { opacity: 1 }],
    { duration: 150 },
  );
}
function premiumZoom(id, factor, anchor = 0.5) {
  const model = terminalCharts.get(id);
  if (!model || !model.data.length) return;
  const state = model.state,
    total = model.data.length,
    n = state.end - state.start,
    size = Math.min(total, Math.max(2, Math.ceil(n * factor))),
    position = state.start + anchor * (n - 1),
    start = Math.max(
      0,
      Math.min(total - size, Math.round(position - anchor * (size - 1))),
    );
  if (start === state.start && size === n) return;
  state.start = start;
  state.end = start + size;
  const root = document.querySelector(`[data-terminal-chart="${id}"]`);
  if (root) premiumRedrawChart(model, root);
}
function premiumExpandChart(id) {
  const original = terminalCharts.get(id);
  if (!original) return;
  if (original.expanded) {
    premiumCloseChart();
    return;
  }
  let dialog = document.querySelector("#premium-chart-dialog");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "premium-chart-dialog";
    dialog.setAttribute("aria-labelledby", "premium-chart-title");
    dialog.addEventListener("close", () => {
      if (premiumExpanded) {
        const source = premiumExpanded.sourceId;
        terminalCharts.delete(premiumExpanded.id);
        premiumExpanded = null;
        document
          .querySelector(
            `[data-terminal-chart="${source}"] [data-chart-action="expand"]`,
          )
          ?.focus({ preventScroll: true });
      }
    });
    document.body.append(dialog);
  }
  premiumExpanded = {
    ...original,
    id: "expanded-" + id,
    sourceId: id,
    state: { ...original.state },
    readout: false,
    expanded: true,
    height: Math.max(240, Math.min(680, innerHeight - 240)),
    plotWidth: undefined,
  };
  terminalCharts.set(premiumExpanded.id, premiumExpanded);
  dialog.innerHTML = `<div class="section-head"><div><div class="eyebrow">Inspeção ampliada · período selecionado</div><h2 id="premium-chart-title">${esc(original.label)}</h2></div><button type="button" class="b s" onclick="premiumCloseChart()">Fechar gráfico</button></div><div class="terminal-chart" data-terminal-chart="${premiumExpanded.id}" role="group" aria-label="${esc(original.label)} ampliado"></div><p class="muted-note">Mesmos dados e cálculos do painel. Zoom e navegação mudam somente a janela visível.</p>`;
  dialog.showModal();
  const root = dialog.querySelector("[data-terminal-chart]");
  premiumExpanded.plotWidth = Math.max(260, root.clientWidth);
  root.innerHTML = terminalDrawChart(premiumExpanded);
  premiumAnimate(dialog, [
    { opacity: 0.6, translate: "0 6px" },
    { opacity: 1, translate: "0 0" },
  ]);
}
function premiumCloseChart() {
  document.querySelector("#premium-chart-dialog")?.close();
}
function premiumShowMetric(index) {
  const card = document.querySelectorAll(".primary-metrics .k")[index];
  if (!card) return;
  const label = card.querySelector("small").textContent,
    value = card.querySelector("b").textContent,
    note = card.querySelectorAll("small")[1]?.textContent || "",
    trades = ft(),
    rows = [...trades]
      .sort((a, b) => b.close.localeCompare(a.close))
      .slice(0, 100);
  let dialog = document.querySelector("#premium-metric-dialog");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "premium-metric-dialog";
    dialog.setAttribute("aria-labelledby", "premium-metric-title");
    dialog.addEventListener("close", () =>
      document
        .querySelector(`[data-metric-index="${dialog.dataset.index}"]`)
        ?.focus({ preventScroll: true }),
    );
    document.body.append(dialog);
  }
  dialog.dataset.index = index;
  dialog.innerHTML = `<div class="section-head"><div><div class="eyebrow">Dados do período · filtros atuais</div><h2 id="premium-metric-title">${esc(label)}</h2></div><button class="b s" onclick="document.querySelector('#premium-metric-dialog').close()">Fechar detalhes</button></div><div class="premium-metric-value">${esc(value)}</div><p>${esc(note)}</p><p class="muted-note">${index === 6 ? "Payoff realizado: ganho médio dividido pela perda média, sem presumir risco planejado. " : ""}${trades.length} operações no recorte. ${trades.length > 100 ? "Exibindo as 100 mais recentes. " : ""}Valores iguais aos do painel; nenhum registro foi alterado.</p>${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Fechamento</th><th>Ativo</th><th>P&L líquido</th><th>R com risco registrado</th></tr></thead><tbody>${rows.map((t) => `<tr><td>${esc(t.close.replace("T", " "))}</td><td>${esc(t.symbol || "—")}</td><td class="${cl(t.pnl)}">${signed(t.pnl)}${t.est ? " * estimado" : ""}</td><td>${t.risk > 0 ? (t.pnl / t.risk).toFixed(2) + "R" : "—"}</td></tr>`).join("")}</tbody></table></div>` : '<div class="ta-empty">Não há trades correspondentes aos filtros.</div>'}<button class="b s" onclick="document.querySelector('#premium-metric-dialog').close();taGo('trades')">Abrir histórico com estes filtros</button>`;
  dialog.showModal();
  premiumAnimate(dialog, [
    { opacity: 0.6, translate: "0 6px" },
    { opacity: 1, translate: "0 0" },
  ]);
}
let premiumTip,
  premiumTipTarget = null,
  premiumTipDescription = null;
function premiumHideTip() {
  if (premiumTip) premiumTip.hidden = true;
  if (premiumTipTarget) {
    if (premiumTipDescription)
      premiumTipTarget.setAttribute("aria-describedby", premiumTipDescription);
    else premiumTipTarget.removeAttribute("aria-describedby");
  }
  premiumTipTarget = null;
  premiumTipDescription = null;
}
function premiumShowTip(target) {
  const text = target.dataset.premiumTip;
  if (!text) return;
  premiumHideTip();
  premiumTipTarget = target;
  premiumTipDescription = target.getAttribute("aria-describedby");
  target.setAttribute(
    "aria-describedby",
    [premiumTipDescription, "premium-context-tooltip"]
      .filter(Boolean)
      .join(" "),
  );
  if (!premiumTip) {
    premiumTip = document.createElement("div");
    premiumTip.className = "premium-context-tooltip";
    premiumTip.id = "premium-context-tooltip";
    premiumTip.setAttribute("role", "tooltip");
    document.body.append(premiumTip);
  }
  /* Use only the displayed, privacy-filtered text; never inspect the trade store here. */
  premiumTip.textContent = text;
  premiumTip.hidden = false;
  const rect = target.getBoundingClientRect(),
    width = premiumTip.offsetWidth,
    height = premiumTip.offsetHeight;
  premiumTip.style.left =
    Math.max(10, Math.min(innerWidth - width - 10, rect.left)) + "px";
  premiumTip.style.top =
    Math.max(
      10,
      rect.top - height - 8 < 10
        ? Math.min(innerHeight - height - 10, rect.bottom + 8)
        : rect.top - height - 8,
    ) + "px";
}
function premiumInspectAt(root, event) {
  const model = terminalCharts.get(root.dataset.terminalChart);
  if (!model?.geometry) return;
  const svg = root.querySelector("svg"),
    rect = svg.getBoundingClientRect(),
    { W, L, R, visible } = model.geometry,
    ratio = Math.max(
      0,
      Math.min(
        1,
        (((event.clientX - rect.left) / rect.width) * W - L) / (R - L),
      ),
    ),
    index = Math.round(ratio * (visible.length - 1));
  terminalInspect(root, index);
  const tip = root.querySelector(".premium-chart-tooltip");
  if (!tip) return;
  tip.textContent = model.describe(visible[index]).replace(/ · /g, "\n");
  tip.hidden = false;
  const bounds = root.getBoundingClientRect(),
    width = tip.offsetWidth,
    height = tip.offsetHeight;
  tip.style.left =
    Math.max(
      8,
      Math.min(bounds.width - width - 8, event.clientX - bounds.left + 16),
    ) + "px";
  tip.style.top =
    Math.max(
      8,
      Math.min(
        bounds.height - height - 8,
        event.clientY - bounds.top - height - 12,
      ),
    ) + "px";
}
function premiumPointerFrame() {
  premiumFrame = 0;
  const event = premiumPointer;
  if (!event) return;
  if (premiumDrag) {
    const model = terminalCharts.get(premiumDrag.id),
      root = document.querySelector(
        `[data-terminal-chart="${premiumDrag.id}"]`,
      );
    if (!model || !root) {
      premiumDrag = null;
      return;
    }
    if (event.pointerId !== premiumDrag.pointerId) return;
    const state = model.state,
      n = premiumDrag.end - premiumDrag.start,
      shift = Math.round(
        ((event.clientX - premiumDrag.x) / premiumDrag.width) *
          Math.max(1, n - 1),
      ),
      start = Math.max(
        0,
        Math.min(model.data.length - n, premiumDrag.start - shift),
      );
    if (start !== state.start) {
      state.start = start;
      state.end = start + n;
      root.innerHTML = terminalDrawChart(model);
      root.classList.add("premium-dragging");
    }
    return;
  }
  const svg = event.target?.closest?.(".terminal-chart-svg");
  if (svg) premiumInspectAt(svg.closest("[data-terminal-chart]"), event);
  if (!premiumFinePointer.matches || premiumMotion.matches) return;
  const card = event.target?.closest?.(".premium-lit-card");
  if (premiumLitCard && premiumLitCard !== card)
    premiumLitCard.classList.remove("premium-spotlight-active");
  premiumLitCard = card;
  if (card) {
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--spot-x", event.clientX - rect.left + "px");
    card.style.setProperty("--spot-y", event.clientY - rect.top + "px");
    card.classList.add("premium-spotlight-active");
  }
  const magnet = event.target?.closest?.(".premium-magnetic");
  if (premiumMagnet && premiumMagnet !== magnet) {
    premiumMagnet.style.removeProperty("--mag-x");
    premiumMagnet.style.removeProperty("--mag-y");
  }
  premiumMagnet = magnet;
  if (magnet && !magnet.disabled && document.activeElement !== magnet) {
    const rect = magnet.getBoundingClientRect();
    magnet.style.setProperty(
      "--mag-x",
      Math.max(
        -2,
        Math.min(2, (event.clientX - rect.left - rect.width / 2) * 0.025),
      ) + "px",
    );
    magnet.style.setProperty(
      "--mag-y",
      Math.max(
        -2,
        Math.min(2, (event.clientY - rect.top - rect.height / 2) * 0.04),
      ) + "px",
    );
  }
}
document.addEventListener(
  "pointermove",
  (event) => {
    premiumPointer = {
      clientX: event.clientX,
      clientY: event.clientY,
      pointerId: event.pointerId,
      target: event.target,
    };
    if (!premiumFrame)
      premiumFrame = requestAnimationFrame(premiumPointerFrame);
  },
  { passive: true },
);
document.addEventListener("pointerdown", (event) => {
  const svg = event.target.closest?.(".terminal-chart-svg");
  if (!svg || event.button !== 0 || event.pointerType === "touch") return;
  const root = svg.closest("[data-terminal-chart]"),
    model = terminalCharts.get(root.dataset.terminalChart);
  if (!model || model.state.end - model.state.start >= model.data.length)
    return;
  premiumDrag = {
    id: model.id,
    pointerId: event.pointerId,
    x: event.clientX,
    start: model.state.start,
    end: model.state.end,
    width:
      (svg.getBoundingClientRect().width *
        (model.geometry.R - model.geometry.L)) /
      model.geometry.W,
  };
  root.setPointerCapture(event.pointerId);
  root.classList.add("premium-dragging");
});
function premiumEndDrag(event) {
  if (!premiumDrag) return;
  if (event.type === "pointerup") {
    premiumPointer = {
      clientX: event.clientX,
      clientY: event.clientY,
      pointerId: event.pointerId,
      target: event.target,
    };
    if (premiumFrame) cancelAnimationFrame(premiumFrame);
    premiumPointerFrame();
  }
  const root = document.querySelector(
    `[data-terminal-chart="${premiumDrag.id}"]`,
  );
  root?.classList.remove("premium-dragging");
  if (root?.hasPointerCapture(event.pointerId))
    root.releasePointerCapture(event.pointerId);
  premiumDrag = null;
}
document.addEventListener("pointerup", premiumEndDrag);
document.addEventListener("pointercancel", premiumEndDrag);
window.addEventListener("blur", () => {
  if (premiumDrag) premiumEndDrag({ pointerId: premiumDrag.pointerId });
  premiumHideTip();
});
let premiumWheelFrame = 0,
  premiumWheel = null;
document.addEventListener(
  "wheel",
  (event) => {
    const svg = event.target.closest?.(".terminal-chart-svg");
    if (!svg) return;
    const root = svg.closest("[data-terminal-chart]"),
      model = terminalCharts.get(root.dataset.terminalChart);
    if (
      !model ||
      !event.deltaY ||
      (!event.ctrlKey && !event.metaKey && !model.expanded)
    )
      return;
    event.preventDefault();
    const rect = svg.getBoundingClientRect(),
      { W, L, R } = model.geometry;
    premiumWheel = {
      id: model.id,
      factor: event.deltaY < 0 ? 0.8 : 1.25,
      anchor: Math.max(
        0,
        Math.min(
          1,
          (((event.clientX - rect.left) / rect.width) * W - L) / (R - L),
        ),
      ),
    };
    if (!premiumWheelFrame)
      premiumWheelFrame = requestAnimationFrame(() => {
        premiumWheelFrame = 0;
        const p = premiumWheel;
        premiumWheel = null;
        if (p) premiumZoom(p.id, p.factor, p.anchor);
      });
  },
  { passive: false },
);
document.addEventListener("click", (event) => {
  const day = event.target.closest?.(
    ".cd:not(.e),.share-live-day:not(:disabled)",
  );
  if (day) {
    day.parentElement
      .querySelectorAll(".premium-selected")
      .forEach((e) => e.classList.remove("premium-selected"));
    day.classList.add("premium-selected");
  }
  const metric = event.target.closest?.("[data-metric-index]");
  if (metric) {
    premiumHideTip();
    premiumShowMetric(Number(metric.dataset.metricIndex));
  }
});
document.addEventListener("keydown", (event) => {
  const metric = event.target.closest?.("[data-metric-index]");
  if (metric && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    premiumHideTip();
    premiumShowMetric(Number(metric.dataset.metricIndex));
  }
});
document.addEventListener("pointerover", (event) => {
  if (event.pointerType === "touch") return;
  const target = event.target.closest?.("[data-premium-tip]");
  if (target && !target.contains(event.relatedTarget)) premiumShowTip(target);
});
document.addEventListener("pointerout", (event) => {
  const target = event.target.closest?.("[data-premium-tip]");
  if (target && !target.contains(event.relatedTarget)) premiumHideTip();
  const chart = event.target.closest?.("[data-terminal-chart]");
  if (chart && !chart.contains(event.relatedTarget)) {
    const tip = chart.querySelector(".premium-chart-tooltip");
    if (tip) tip.hidden = true;
  }
  const card = event.target.closest?.(".premium-lit-card");
  if (card && !card.contains(event.relatedTarget))
    card.classList.remove("premium-spotlight-active");
  const button = event.target.closest?.(".premium-magnetic");
  if (button && !button.contains(event.relatedTarget)) {
    button.style.removeProperty("--mag-x");
    button.style.removeProperty("--mag-y");
  }
});
document.addEventListener("focusin", (event) => {
  const target = event.target.closest?.("[data-premium-tip]");
  if (target) premiumShowTip(target);
});
document.addEventListener("focusout", premiumHideTip);
document.addEventListener("scroll", premiumHideTip, true);
premiumMotion.addEventListener("change", () => {
  if (premiumMotion.matches) {
    premiumLitCard?.classList.remove("premium-spotlight-active");
    premiumMagnet?.style.removeProperty("--mag-x");
    premiumMagnet?.style.removeProperty("--mag-y");
  }
});
