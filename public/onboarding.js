/* First-use guidance belongs to the existing user workspace; it never creates financial records. */
(function () {
  const steps = [
    {
      title: "Seu perfil e horário",
      text: "Em Configurações, informe seu nome, fuso e os ativos que acompanha. Configure sua sessão para que os horários e eventos façam sentido para você.",
      action: "Abrir meu perfil",
      route: "settings",
    },
    {
      title: "Moeda e capital inicial",
      text: "Informe o capital com que começou a conta e a moeda correta. Você poderá editar depois no botão Capital. Esse valor não é o lucro de um trade.",
      action: "Configurar capital",
      open: () => accountOpenEditor(),
    },
    {
      title: "Seu Trading Plan",
      text: "Cadastre suas regras, risco e critérios de entrada. O plano orienta a avaliação dos setups. Você pode deixar essa etapa para depois.",
      action: "Conhecer o Trading Plan",
      route: "plan",
    },
    {
      title: "Seu primeiro registro no Diário",
      text: "Registre trades, notas ou apenas prints. Todos os campos do Diário são opcionais. Prints sem resultado conhecido ficam salvos sem entrar nas estatísticas financeiras.",
      action: "Abrir o Diário",
      route: "trades",
    },
    {
      title: "Preparação e check-ins",
      text: "Na Home, confira sua sessão e os próximos eventos. Para receber perguntas sobre como está se sentindo, escolha “Ativar automaticamente no meu horário”. As perguntas aparecem com o site aberto.",
      action: "Ver minha preparação",
      route: "home",
    },
    {
      title: "Conheça o SMC Elite World",
      text: "Na Home, escolha “Entrar no SMC Elite World”. Clique nas entradas para o personagem caminhar até as salas. O World usa os mesmos dados, com outra experiência visual.",
      action: "Ir para a Home",
      route: "home",
    },
    {
      title: "Tudo pronto para explorar",
      text: "Você pode voltar a este passo a passo nas Configurações. Perfil, capital, plano e registros continuam editáveis a qualquer momento.",
    },
  ];
  let owner = null,
    error = "",
    minimized = false;
  function configured() {
    return !!(
      typeof S.assistantProfile?.name === "string" &&
      S.assistantProfile.name.trim() &&
      S.assistantProfile?.timezone &&
      S.currency &&
      S.balanceConfirmed === true
    );
  }
  function eligible() {
    return (!CLOUD_BOOT || eliteCloud.ready) && typeof K === "string";
  }
  function write(patch) {
    if (!eligible() || owner !== K) return false;
    try {
      const next = {
        ...S,
        onboarding: {
          version: 1,
          ...S.onboarding,
          ...patch,
          updatedAt: new Date().toISOString(),
        },
      };
      persistState(next);
      S = next;
      error = "";
      return true;
    } catch {
      error =
        "Não foi possível salvar seu progresso. Seus dados foram mantidos; tente novamente.";
      render();
      return false;
    }
  }
  function close(status) {
    if (write({ status })) render();
  }
  function render() {
    const existing = document.getElementById("first-use-tour");
    if (!eligible()) {
      existing?.remove();
      owner = null;
      return;
    }
    if (owner !== K) {
      existing?.remove();
      owner = K;
      error = "";
      minimized = false;
    }
    const saved = S.onboarding;
    if (saved?.status === "skipped" || saved?.status === "completed") {
      existing?.remove();
      return;
    }
    if (
      !saved &&
      (configured() ||
        S.trades?.length ||
        S.tradeDrafts?.length ||
        S.tradingPlans?.length)
    ) {
      existing?.remove();
      return;
    }
    const active = saved?.status === "active";
    const index = Math.max(
        0,
        Math.min(
          steps.length - 1,
          Number.isInteger(saved?.step) ? saved.step : 0,
        ),
      ),
      step = steps[index];
    const host = existing || document.createElement("aside");
    host.id = "first-use-tour";
    host.dataset.phase = active ? "active" : "welcome";
    host.dataset.owner = K;
    host.setAttribute("aria-label", "Tutorial de primeiro acesso");
    host.classList.toggle("tour-minimized", active && minimized);
    host.innerHTML = `<div class="tour-heading"><span>SMC Elite · ${active ? "Passo " + (index + 1) + " de " + steps.length : "Boas-vindas"}</span><button type="button" data-tour="skip" aria-label="Pular tutorial">×</button></div><h2>${active ? step.title : "Vamos configurar sua conta?"}</h2><p>${active ? step.text : "Conheça o site em poucos passos, configure sua conta e descubra o Diário e o World. Você também pode pular e explorar por conta própria."}</p>${active ? '<progress aria-label="Progresso do tutorial" max="' + steps.length + '" value="' + (index + 1) + '"></progress>' : ""}${active && configured() ? '<p class="tour-ready">Seu perfil e capital já estão configurados.</p>' : ""}<div class="tour-actions">${!active ? '<button type="button" class="b" data-tour="start">Começar passo a passo</button>' : `${step.action ? '<button type="button" class="b" data-tour="open">' + step.action + "</button>" : ""}${index > 0 ? '<button type="button" class="b s" data-tour="back">Voltar</button>' : ""}<button type="button" class="b s" data-tour="next">${index === steps.length - 1 ? "Concluir tutorial" : "Próximo"}</button>`}<button type="button" class="tour-skip" data-tour="skip">Pular e descobrir sozinho</button></div><p class="tour-error" role="status"></p>`;
    if (active && minimized)
      host.innerHTML =
        '<button class="b s" type="button" data-tour="resume">Continuar tutorial · passo ' +
        (index + 1) +
        '</button><p class="tour-error" role="status"></p>';
    host.querySelector(".tour-error").textContent = error;
    host.onclick = (e) => {
      const action = e.target.closest("[data-tour]")?.dataset.tour;
      if (!action || host.dataset.owner !== K || !eligible()) return;
      if (action === "resume") {
        minimized = false;
        render();
      }
      if (action === "skip") close("skipped");
      if (action === "start" && write({ status: "active", step: 0 })) render();
      if (action === "back" && write({ step: index - 1 })) render();
      if (action === "next") {
        if (index === steps.length - 1) close("completed");
        else if (write({ step: index + 1 })) render();
      }
      if (action === "open") {
        minimized = true;
        render();
        if (step.open) step.open();
        else taGo(step.route);
      }
    };
    if (!host.isConnected)
      (active
        ? document.body
        : document.querySelector(".smc-home") ||
          document.getElementById("main") ||
          document.body
      ).append(host);
  }
  window.smcRestartTour = function () {
    owner = K;
    minimized = false;
    if (write({ status: "active", step: 0 })) render();
  };
  const previous = terminalAfterRender;
  terminalAfterRender = function () {
    previous();
    render();
    if (
      tab === "settings" &&
      eligible() &&
      !document.getElementById("tour-restart")
    ) {
      const area = document.createElement("section");
      area.className = "card";
      area.id = "tour-restart";
      area.innerHTML =
        '<h2>Ajuda para começar</h2><p>Reveja a configuração da conta e as principais funções do site.</p><button class="b s" type="button" onclick="smcRestartTour()">Rever tutorial</button>';
      document.getElementById("main")?.append(area);
    }
  };
})();
