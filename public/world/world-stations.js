/* World-only operational composition. Existing engines, form nodes and save flows remain authoritative. */
(function (root) {
  "use strict";
  const e = SMCWorldUI.e;
  const node = (html) => {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };
  const card = (title, html = "", cls = "") =>
    node(
      `<section class="world-station ${cls}"><h2>${e(title)}</h2>${html}</section>`,
    );
  const put = (slot, ...nodes) => {
    for (const n of nodes.flat()) if (n) slot.append(n);
    return slot;
  };
  const take = (host, selector) => host.querySelector(selector);
  const button = (label, action) =>
    `<button type="button" data-station-action="${action}">${e(label)}</button>`;
  function originalControls(main, old, grid) {
    const bar = node(
      '<details class="world-station-options"><summary>Filtros e opções</summary><div></div></details>',
    );
    const area = bar.querySelector("div");
    put(area, take(old, ".page-actions"), take(old, ".smc-filters-disclosure"));
    take(old, ".terminal-topbar")?.remove();
    take(old, ".page-top")?.remove();
    if (area.children.length) grid.before(bar);
    const more = node(
      '<details class="world-station-more"><summary>Detalhes e histórico</summary><div></div></details>',
    );
    more.querySelector("div").append(old);
    main.append(more);
  }
  function build(main, kind) {
    const old = document.createElement("div");
    old.className = "world-original-options";
    old.append(...main.childNodes);
    const grid = node(
      `<div class="world-stations world-stations-${kind}" data-world-stations="${kind}"></div>`,
    );
    main.append(grid);
    main.classList.add("world-station-main");
    return { old, grid };
  }
  function dashboard(main, world) {
    const { old, grid } = build(main, "dashboard"),
      m = panelModel();
    grid.classList.add("panel-workspace");
    old.querySelector(".panel-workspace")?.classList.remove("panel-workspace");
    put(grid, take(old, ".panel-tabs"));
    if (panelUI.view !== "overview") {
      const view = card(
        {
          performance: "Performance",
          capital: "Risco & Capital",
          insights: "Insights",
        }[panelUI.view] || "Painel",
        "",
        "world-wide",
      );
      put(view, take(old, "#panel-content"));
      grid.append(view);
      originalControls(main, old, grid);
      return;
    }
    const equity = card("Curva de resultado", "", "world-equity");
    put(equity, take(old, ".elite-dash-charts"));
    const chart = equity.querySelector("[data-terminal-chart]");
    if (chart) {
      const model = terminalCharts.get(chart.dataset.terminalChart);
      if (model) {
        terminalCharts.set("world-equity", { ...model, id: "world-equity" });
        chart.dataset.terminalChart = "world-equity";
      }
    }
    grid.append(equity);
    const data = panelChartData(m, "dd");
    grid.append(
      card(
        "Drawdown",
        data.length
          ? terminalChart(data, {
              id: "world-drawdown",
              height: 150,
              label: "Drawdown do resultado fechado",
              format: money,
              includeZero: true,
            })
          : '<p class="world-empty">Sem operações suficientes.</p>',
        "world-drawdown",
      ),
    );
    const stats = card(
      "Resumo de performance",
      `<dl><div><dt>Resultado líquido</dt><dd>${e(m.s.n ? panelMoney(m.s.net, m) : "—")}</dd></div><div><dt>Retorno</dt><dd>${e(panelPct(m.returns.percent))}</dd></div><div><dt>Trades fechados</dt><dd>${m.s.n}</dd></div><div><dt>Ganhos / perdas</dt><dd>${m.s.w} / ${m.s.l}</dd></div><div><dt>R conhecido</dt><dd>${e(panelR(m.r))}</dd></div></dl>`,
      "world-summary",
    );
    grid.append(stats);
    const kpis = take(old, ".panel-primary");
    if (kpis) {
      kpis.classList.add("world-metrics");
      kpis.querySelectorAll(".k b").forEach((b) => {
        if (b.textContent === "Dados insuficientes") {
          b.title = b.textContent;
          b.textContent = "—";
        }
      });
      grid.append(kpis);
    }
    const groups = [...old.querySelectorAll(".panel-overview-bottom>.card")];
    groups.forEach((n, i) => {
      n.classList.add(
        "world-station",
        i === 0
          ? "world-assets"
          : i === 1
            ? "world-sessions"
            : "world-consistency",
      );
      grid.append(n);
    });
    const recent = card(
      "Últimas operações",
      m.rows.length
        ? terminalRecentTrades(m.rows.slice(-5))
        : '<p class="world-empty">Nenhum registro nos filtros.</p>',
      "world-recent",
    );
    grid.append(recent);
    const cal = take(old, ".panel-calendar");
    if (cal) {
      cal.open = true;
      cal.classList.add("world-station", "world-calendar");
      grid.append(cal);
    }
    originalControls(main, old, grid);
  }
  function plan(main, world) {
    const { old, grid } = build(main, "plan"),
      p = taCurrentPlan(),
      form = take(old, "#ta-plan-form");
    if (!form) {
      main.append(old);
      return;
    }
    world.planDeskMode ||= p ? "overview" : "edit";
    const nav = card(
      "Estrutura do Trading Plan",
      `<nav aria-label="Seções do plano">${[
        ["overview", "Visão geral do plano"],
        ["identity", "Identidade e mercados"],
        ["context", "Contexto e viés"],
        ["setup", "Setup e execução"],
        ["management", "Gestão e saída"],
        ["risk", "Gestão de risco"],
        ["criteria", "Regras verificáveis"],
      ]
        .map(
          ([id, label]) =>
            `<button type="button" data-plan-section="${id}">${e(label)}</button>`,
        )
        .join("")}</nav>`,
      "world-plan-nav",
    );
    grid.append(nav);
    const overview = node('<div class="world-plan-overview"></div>');
    overview.append(
      card(
        "Regras essenciais do sistema",
        p?.criteria?.length
          ? `<ul class="world-rule-list">${p.criteria.map((c) => `<li><b>${e(c.label)}</b><small>${e(c.definition || "Sem definição adicional")}${c.required ? " · Obrigatório" : ""}${c.critical ? " · Crítico" : ""}</small></li>`).join("")}</ul>`
          : "<p>Configure e salve suas regras para orientar a revisão dos setups.</p>",
        "world-plan-rules",
      ),
    );
    overview.append(
      card(
        "Setup e invalidação",
        `<p>${e(p?.entryConditions || "Descreva as condições de entrada no seu plano.")}</p><h3>Invalidação</h3><p>${e(p?.invalidations || "Ainda não definida.")}</p>`,
        "world-plan-setup",
      ),
    );
    overview.append(
      card(
        "Resumo do plano atual",
        `<dl><div><dt>Nome</dt><dd>${e(p?.name || "Não configurado")}</dd></div><div><dt>Versão</dt><dd>${e(p?.version || "—")}</dd></div><div><dt>Mercados</dt><dd>${e(p?.instruments?.join(", ") || "—")}</dd></div><div><dt>Timeframes</dt><dd>${e(p?.timeframes?.join(", ") || "—")}</dd></div><div><dt>Risco máximo / trade</dt><dd>${e(p?.risk?.perTrade != null ? formatAccountMoney(p.risk.perTrade) : "—")}</dd></div><div><dt>R:R mínimo</dt><dd>${e(p?.risk?.minRR ?? "—")}</dd></div></dl>`,
        "world-plan-summary",
      ),
    );
    overview.append(
      card(
        "Checklist operacional",
        `<p>Use os critérios do plano para revisar a evidência de cada setup.</p><ul>${
          (p?.criteria || [])
            .filter((c) => c.required)
            .map((c) => `<li>${e(c.label)}</li>`)
            .join("") || "<li>Cadastre critérios obrigatórios no plano.</li>"
        }</ul>${button("Verificar um setup", "open-analyst")}`,
        "world-plan-check",
      ),
    );
    grid.append(overview);
    form.classList.add("world-plan-editor");
    grid.append(form);
    const error = take(form, "#ta-plan-error");
    if (error) error.setAttribute("role", "status");
    function show(section) {
      world.planDeskMode = section === "overview" ? "overview" : "edit";
      overview.hidden = world.planDeskMode !== "overview";
      form.hidden = world.planDeskMode !== "edit";
      grid
        .querySelectorAll("[data-plan-section]")
        .forEach((b) =>
          b.setAttribute(
            "aria-pressed",
            String(b.dataset.planSection === section),
          ),
        );
      if (section !== "overview") {
        const sections = [...form.querySelectorAll(".plan-design-section")];
        const index = {
          identity: 0,
          context: 1,
          setup: 2,
          management: 3,
          risk: 4,
        }[section];
        const target =
          section === "criteria"
            ? form.querySelector("#ta-plan-criteria")
            : sections[index ?? 0];
        target?.scrollIntoView({ block: "nearest" });
      }
    }
    nav
      .querySelectorAll("[data-plan-section]")
      .forEach((b) => (b.onclick = () => show(b.dataset.planSection)));
    show(world.planDeskMode === "overview" ? "overview" : "identity");
    originalControls(main, old, grid);
  }
  function journal(main, world) {
    const { old, grid } = build(main, "journal");
    const form = card(
      "Registrar trade no Diário",
      `<form id="world-journal-form" novalidate><div class="world-entry-fields"><label>Ativo<input id="world-j-symbol" maxlength="30" placeholder="Ex.: EURUSD"></label><label>Direção<select id="world-j-side"><option value="">Não informado</option><option value="long">Compra</option><option value="short">Venda</option></select></label><label>Fechamento<input id="world-j-close" type="datetime-local"></label><label>Setup / timeframe<input id="world-j-setup" maxlength="100" placeholder="Seu setup"></label></div><div class="world-entry-blocks"><fieldset><legend>Entrada do trade</legend><label>Entrada<input id="world-j-entry" type="number" step="any"></label><label>Stop<input id="world-j-stop" type="number" step="any"></label><label>Alvo<input id="world-j-target" type="number" step="any"></label><label>P&L realizado<input id="world-j-pnl" type="number" step="any" placeholder="Informe o resultado"></label></fieldset><fieldset><legend>Captura de tela</legend><label class="world-print-drop">Arraste ou adicione prints<input id="world-j-files" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden></label><p id="world-j-file-note"></p></fieldset></div><label>Notas e contexto<textarea id="world-j-notes" placeholder="Raciocínio, confirmações e execução do plano"></textarea></label><div class="world-journal-bottom"><section><h3>Clareza e controle</h3><p>Registre vulnerabilidades e comportamentos no monitor emocional.</p>${button("Fazer check-in", "checkin")}</section><label>Aprendizado<textarea id="world-j-lesson"></textarea></label></div><button class="world-primary" type="submit">Salvar registro no Diário</button><small>Todos os campos são opcionais. Prints e notas ficam salvos mesmo sem resultado financeiro.</small></form>`,
      "world-journal-entry",
    );
    grid.append(form);
    const submit = form.querySelector("button[type=submit]");
    submit.setAttribute("form", "world-journal-form");
    form.append(submit);
    const fileInput = form.querySelector("#world-j-files"),
      fileNote = form.querySelector("#world-j-file-note");
    const paintFiles = () =>
      (fileNote.textContent =
        (world.journalFiles || []).map((f) => f.name).join(", ") ||
        "Nenhum print selecionado.");
    fileInput.onchange = () => {
      world.journalFiles = [...fileInput.files];
      paintFiles();
    };
    const drop = form.querySelector(".world-print-drop");
    drop.ondragover = (ev) => ev.preventDefault();
    drop.ondrop = (ev) => {
      ev.preventDefault();
      world.journalFiles = [...ev.dataTransfer.files].filter((f) =>
        /^image\/(png|jpeg|webp)$/.test(f.type),
      );
      paintFiles();
    };
    paintFiles();
    form.querySelector("form").onsubmit = async (event) => {
      event.preventDefault();
      if (!world.canUse() || world.blocked()) return;
      const values = {};
      for (const key of [
        "symbol",
        "side",
        "close",
        "setup",
        "entry",
        "stop",
        "target",
        "pnl",
        "notes",
        "lesson",
      ])
        values[key] = form.querySelector("#world-j-" + key).value;
      edit(null);
      for (const [key, value] of Object.entries(values)) {
        const n = document.getElementById("f_" + key);
        if (n) n.value = value;
      }
      if (
        world.journalFiles?.length &&
        (await addImg(world.journalFiles)) === false
      )
        return;
      const dialog = document.getElementById("dlg");
      dialog.classList.add("world-journal-review");
      dialog.addEventListener(
        "close",
        () => {
          dialog.classList.remove("world-journal-review");
          if (
            [...S.trades, ...(S.tradeDrafts || [])].some((t) => t.id === cur.id)
          ) {
            world.journalFiles = [];
            world.drafts.delete("trades");
          }
        },
        { once: true },
      );
      await saveT();
    };
    const records = card(
      "Meus registros recentes",
      "",
      "world-journal-records",
    );
    put(
      records,
      take(old, ".diary-partials"),
      take(old, ".diary-records-panel"),
    );
    grid.append(records);
    const overview = take(old, ".diary-heading");
    if (overview) {
      overview.classList.add("world-journal-period");
      grid.append(overview);
    }
    originalControls(main, old, grid);
  }
  function analyst(main, world) {
    const { old, grid } = build(main, "analyst"),
      upload = take(old, ".ta-analyst-grid>div"),
      form = take(old, "#ta-analyst-form"),
      result = take(old, ".ta-analysis-result");
    const image = card("Print do setup", "", "world-analysis-print");
    if (upload) image.append(upload);
    else
      image.innerHTML +=
        "<p>Salve um Trading Plan antes de iniciar a revisão.</p>" +
        button("Configurar Trading Plan", "open-plan");
    grid.append(image);
    const context = card(
      "Contexto e leitura da estrutura",
      "",
      "world-analysis-context",
    );
    put(context, form);
    grid.append(context);
    const report = card(
      "Relatório da análise",
      result
        ? ""
        : '<p class="world-empty">Envie um print e revise seus critérios. Nenhuma evidência foi avaliada.</p><p>O resultado mede aderência ao plano, não probabilidade de vitória.</p>',
      "world-analysis-report",
    );
    put(report, result);
    grid.append(report);
    const criteria = card(
      "Critérios do seu Trading Plan",
      `<ul class="world-rule-list">${(taCurrentPlan()?.criteria || []).map((c) => `<li><b>${e(c.label)}</b><small>${e(c.definition || "Defina a evidência exigida no plano.")}</small></li>`).join("") || "<li>Nenhum critério configurado.</li>"}</ul>${button("Editar critérios", "open-plan")}`,
      "world-analysis-criteria",
    );
    grid.append(criteria);
    const guide = take(old, ".elite-analysis-guide");
    if (guide) {
      const help = node(
        '<details class="world-station world-analysis-guide"><summary>Como preparar a análise</summary></details>',
      );
      help.append(guide);
      grid.append(help);
    }
    originalControls(main, old, grid);
  }
  function risk(main, world) {
    const { old, grid } = build(main, "risk"),
      m = panelModel(),
      c = m.cap,
      p = taCurrentPlan();
    const calculator = take(old, ".risk-calculator");
    if (calculator) {
      calculator.classList.add("world-station", "world-risk-calc");
      grid.append(calculator);
    }
    grid.append(
      card(
        "Capital da conta",
        `<dl><div><dt>Capital inicial confirmado</dt><dd>${e(panelMoney(c.available ? c.initial : null, m))}</dd></div><div><dt>Saldo realizado</dt><dd>${e(panelMoney(c.available ? c.balance : null, m))}</dd></div><div><dt>Drawdown atual</dt><dd>${e(panelMoney(c.available ? -c.currentDD : null, m))}</dd></div><div><dt>Drawdown máximo</dt><dd>${e(panelMoney(c.available ? -c.maxDD : null, m))}</dd></div></dl><small>Conta inteira. Não representa equity ao vivo.</small>${button("Capital e movimentações", "capital")}`,
        "world-risk-capital",
      ),
    );
    const series = panelChartData(m, "dd");
    grid.append(
      card(
        "Evolução do drawdown",
        series.length
          ? terminalChart(series, {
              id: "world-risk-curve",
              height: 160,
              label: "Drawdown dos resultados registrados",
              format: money,
              includeZero: true,
            })
          : '<p class="world-empty">Sem histórico suficiente para o gráfico.</p>',
        "world-risk-chart",
      ),
    );
    grid.append(
      card(
        "Limites do Trading Plan",
        `<dl>${[
          ["Por operação", "perTrade"],
          ["Diário", "maxDaily"],
          ["Semanal", "maxWeekly"],
        ]
          .map(
            ([label, key]) =>
              `<div><dt>${label}</dt><dd>${e(p?.risk?.[key] != null ? formatAccountMoney(p.risk[key]) : "Não definido")}</dd></div>`,
          )
          .join(
            "",
          )}<div><dt>R:R mínimo</dt><dd>${e(p?.risk?.minRR ?? "Não definido")}</dd></div></dl>${button("Revisar limites", "open-plan")}`,
        "world-risk-limits",
      ),
    );
    const summary = take(old, ".risk-workspace>section");
    if (summary) {
      summary.classList.add("world-station", "world-risk-coverage");
      grid.append(summary);
    }
    originalControls(main, old, grid);
  }
  function news(main, world) {
    const { old, grid } = build(main, "news");
    const calendar = card("Calendário econômico", "", "world-news-calendar");
    put(
      calendar,
      take(old, ".ta-economic-toolbar"),
      take(old, ".ta-economic-events"),
    );
    grid.append(calendar);
    const markets = node(taDailyMarketCard());
    markets.classList.add("world-station", "world-news-markets");
    grid.append(markets);
    const session = taDailySession(),
      profile = taDailyProfile();
    grid.append(
      card(
        "Sessão e relevância",
        `<h3>${e(session.configured ? session.label || profile.session.label : "Sessão não configurada")}</h3><p>${e(profile.timezone)}</p><p>${e(session.configured ? taDailySessionCountdown(session) : "Configure os horários em que opera para contextualizar os eventos.")}</p>${button("Configurar sessão", "settings")}`,
        "world-news-session",
      ),
    );
    const briefing = card(
      "Briefing do dia",
      typeof taBriefingView === "function"
        ? taBriefingView()
        : "<p>Briefing não disponível.</p>",
      "world-news-briefing",
    );
    grid.append(briefing);
    const events = node(taDailyCalendarCard());
    events.classList.add("world-station", "world-news-events");
    grid.append(events);
    originalControls(main, old, grid);
  }
  function tools(main, world, route) {
    const { old, grid } = build(main, "tools");
    grid.innerHTML = [
      ["risk", "Calculadoras", "Planeje risco com os seus parâmetros."],
      [
        "share",
        "Calendário compartilhável",
        "Prepare uma exportação com os seus registros.",
      ],
      [
        "ocr",
        "OCR de prints",
        "Abra a captura e revise os dados reconhecidos.",
      ],
      ["import", "Importar histórico", "Use os importadores reais do Diário."],
      [
        "str",
        "Estratégias e setups",
        "Documente regras e modelos de execução.",
      ],
    ]
      .map(
        ([id, label, description]) =>
          `<button type="button" class="world-station world-tool-${id}" data-world-tool="${id}"><strong>${e(label)}</strong><span>${e(description)}</span><b aria-hidden="true">↗</b></button>`,
      )
      .join("");
    const selected = card("Ferramenta selecionada", "", "world-tool-selected");
    selected.hidden = !world.toolSelection;
    selected.append(old);
    grid.append(selected);
    grid.querySelectorAll("[data-world-tool]").forEach(
      (b) =>
        (b.onclick = () => {
          const id = b.dataset.worldTool,
            next = { ocr: "trades", import: "trades" }[id] || id;
          world.toolSelection = next;
          if (!world.navigate(next, "tools")) return;
          if (id === "ocr") edit(null);
          if (id === "import") {
            const detail = [...document.querySelectorAll("#main details")].find(
              (d) =>
                d
                  .querySelector("summary")
                  ?.textContent.includes("Importar histórico"),
            );
            if (detail) {
              detail.open = true;
              detail.scrollIntoView({ block: "nearest" });
            }
          }
        }),
    );
    selected.prepend(
      node(button("Voltar à seleção de ferramentas", "tools-home")),
    );
  }
  function achievements(main, world) {
    const { old, grid } = build(main, "achievements"),
      all = growthAchievements(),
      earned = all.filter((a) => a.earned);
    const history = card("Galeria de certificados", "", "world-certificates");
    put(history, take(old, ".growth-cert-history"));
    if (!history.querySelector("details"))
      history.innerHTML += "<p>Nenhum certificado emitido.</p>";
    else history.querySelector("details").open = true;
    const name = take(old, "#growth-certificate-name")?.closest("label");
    put(history, name);
    grid.append(history);
    grid.append(
      card(
        "Seu progresso de conquistas",
        `<strong class="world-progress-value">${earned.length} / ${all.length}</strong><p>Conquistas elegíveis nos registros atuais.</p><progress value="${earned.length}" max="${all.length || 1}" aria-label="Conquistas elegíveis"></progress><small>Regras e elegibilidade do motor original. Sem XP ou sequência inventada.</small>`,
        "world-achievement-summary",
      ),
    );
    const categories = take(old, ".growth-category");
    if (categories) {
      categories.classList.add("world-achievement-categories");
      grid.append(categories);
    }
    const cards = take(old, ".growth-achievement-grid");
    if (cards) {
      cards.classList.add("world-achievement-cards");
      grid.append(cards);
    }
    originalControls(main, old, grid);
  }
  const handlers = {
    dash: dashboard,
    trades: journal,
    plan,
    analyst,
    risk,
    economic: news,
    tools,
    achievements,
  };
  root.SMCWorldStations = {
    fit(main) {
      main.querySelectorAll("[data-terminal-chart^=world-]").forEach((el) => {
        const m = terminalCharts.get(el.dataset.terminalChart);
        if (m) {
          m.plotWidth = Math.max(240, Math.round(el.clientWidth));
          m.height = 150;
          el.innerHTML = terminalDrawChart(m);
        }
      });
    },
    mount(main, room, route, world) {
      if (
        !window.SMCWorldScenes?.enabled ||
        !handlers[room] ||
        (!(
          {
            dash: "dash",
            trades: "trades",
            plan: "plan",
            analyst: "analyst",
            risk: "risk",
            economic: "economic",
            achievements: "achievements",
          }[room] === route
        ) &&
          room !== "tools")
      ) {
        main.classList.remove("world-station-main");
        main.closest(".smc-cinema-room")?.classList.remove("has-stations");
        return;
      }
      if (main.querySelector("[data-world-stations]")) return;
      handlers[room](main, world, route);
      main.closest(".smc-cinema-room")?.classList.add("has-stations");
      this.fit(main);
      main.querySelectorAll("[data-station-action]").forEach(
        (b) =>
          (b.onclick = () => {
            const action = b.dataset.stationAction;
            if (!world.canUse() || world.blocked()) return;
            if (action === "open-analyst") world.navigate("analyst");
            if (action === "open-plan") world.navigate("plan");
            if (action === "settings") world.navigate("settings");
            if (action === "checkin") growthCheckin();
            if (action === "edit-capital") accountOpenEditor();
            if (action === "capital") {
              panelUI.view = "capital";
              world.navigate("dash");
            }
            if (action === "tools-home") {
              world.toolSelection = null;
              R();
            }
          }),
      );
    },
  };
})(globalThis);
