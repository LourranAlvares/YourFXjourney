/* Account administration only. Trading data remains private. */
const smcAdmin = {
  ready: false,
  offset: 0,
  more: false,
  query: "",
  saving: false,
  registration: null,
  notice: null,
};
const smcDate = (v) =>
  v ? new Date(v).toLocaleString("pt-BR") : "Sem vencimento";
const smcPlan = (p) =>
  ({
    standard: "Padrão",
    trial: "Trial",
    monthly: "Mensal",
    quarterly: "Trimestral",
    annual: "Anual",
    custom: "Personalizado",
  })[p] || "Padrão";
async function eliteCloudLoadAccounts(offset = smcAdmin.offset) {
  if (eliteCloud.adminPending) return;
  eliteCloud.adminPending = true;
  try {
    const result = await taApi(
      "/api/admin/management?offset=" +
        offset +
        "&q=" +
        encodeURIComponent(smcAdmin.query),
    );
    try {
      smcAdmin.registration = await taApi("/api/admin/registration-health");
    } catch {
      smcAdmin.registration = null;
    }
    eliteCloud.adminRows = result.accounts;
    smcAdmin.ready = result.ready;
    smcAdmin.more = result.hasMore;
    smcAdmin.offset = result.offset;
    eliteCloud.adminError = "";
  } catch (e) {
    eliteCloud.adminError = e.message;
    eliteCloud.adminRows = [];
  } finally {
    eliteCloud.adminPending = false;
    if (tab === "admin") R();
  }
}
function smcAdminSearch(event) {
  event.preventDefault();
  smcAdmin.query = document.getElementById("smc-admin-query").value.trim();
  eliteCloudLoadAccounts(0);
}
function vCloudAdmin() {
  if (!CLOUD_BOOT || eliteCloud.user?.role !== "admin")
    return '<section class="card"><h2>Acesso restrito</h2></section>';
  const rows = eliteCloud.adminRows || [];
  return `<section class="card smc-admin-heading"><div class="section-head"><div><h2>Gestão da plataforma</h2><p>Contas, permissões e prazos de acesso.</p></div><button class="b s" onclick="eliteCloudLoadAccounts()" ${eliteCloud.adminPending ? "disabled" : ""}>Atualizar</button></div><form class="smc-admin-search" onsubmit="smcAdminSearch(event)"><label>Buscar por nome ou e-mail<input id="smc-admin-query" value="${esc(smcAdmin.query)}" placeholder="Nome ou e-mail" maxlength="100"></label><button class="b s" type="submit">Buscar</button></form>${smcAdmin.notice ? `<div id="smc-admin-notice" class="smc-admin-notice" role="status"><span aria-hidden="true">✓</span><p>${esc(smcAdmin.notice)}</p><button class="b s" onclick="smcAdmin.notice=null;R()" aria-label="Dispensar confirmação">×</button></div>` : ""}${smcRegistrationHealthView()}<p role="status">${eliteCloud.adminPending ? "Carregando…" : eliteCloud.adminError ? esc(eliteCloud.adminError) : `${rows.length} conta(s) nesta página`}</p>${!smcAdmin.ready && !eliteCloud.adminPending && !eliteCloud.adminError ? '<div class="cloud-banner"><h3>Ativar prazos e auditoria</h3><p>Execute a atualização de gestão no SQL Editor do Supabase. Aprovação e bloqueio atuais continuam disponíveis.</p><a class="b s" href="https://github.com/LourranAlvares/YourFXjourney/blob/main/server/cloud/management.sql" target="_blank" rel="noopener">Abrir atualização SQL</a></div>' : ""}</section><div class="smc-admin-users">${rows
    .map((u) => {
      const expired =
          u.status === "active" &&
          u.access?.expires_at &&
          Date.parse(u.access.expires_at) <= Date.now(),
        state = expired
          ? "Prazo encerrado"
          : {
              active: "Ativo",
              pending: "Aguardando aprovação",
              blocked: "Bloqueado",
            }[u.status],
        self = u.role === "admin";
      return `<article class="card smc-admin-user" data-account-search="${esc((u.name + " " + u.email).toLowerCase())}"><div class="section-head"><div><h3>${esc(u.name || "Sem nome")}</h3><p>${esc(u.email)}</p></div><span class="badge">${self ? "Administradora" : (u.status === "active" && !expired ? "✓ " : "") + state}</span></div><dl><div><dt>Cadastro</dt><dd>${esc(smcDate(u.created_at))}</dd></div><div><dt>Plano</dt><dd>${self ? "Administração" : smcPlan(u.access?.plan)}</dd></div><div><dt>Vencimento</dt><dd>${self ? "Não se aplica" : esc(smcDate(u.access?.expires_at))}</dd></div></dl><div class="cloud-account-actions">${self ? '<span class="badge">Conta protegida</span>' : `<button class="b s" data-id="${esc(u.id)}" onclick="smcAdminEdit(this.dataset.id${u.status !== "active" || expired ? ",'active'" : ""})">${u.status === "active" && !expired ? "Configurar acesso" : expired ? "Renovar acesso" : "Liberar acesso"}</button>${smcAdmin.ready ? `<button class="b s" data-id="${esc(u.id)}" onclick="smcAdminAudit(this.dataset.id)">Auditoria</button>` : `<button class="b s" data-id="${esc(u.id)}" onclick="smcAdminLegacy(this.dataset.id,'blocked')" ${smcAdmin.saving ? "disabled" : ""}>Bloquear</button>`}`}</div></article>`;
    })
    .join(
      "",
    )}</div><div class="cloud-account-actions"><button class="b s" onclick="eliteCloudLoadAccounts(smcAdmin.offset-100)" ${smcAdmin.offset === 0 || eliteCloud.adminPending ? "disabled" : ""}>Anterior</button><span>Página ${Math.floor(smcAdmin.offset / 100) + 1}</span><button class="b s" onclick="eliteCloudLoadAccounts(smcAdmin.offset+100)" ${!smcAdmin.more || eliteCloud.adminPending ? "disabled" : ""}>Próxima</button></div>`;
}
function smcManagementDialog(title, content) {
  let d = document.getElementById("smc-management-dialog");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "smc-management-dialog";
    document.body.append(d);
  }
  d.setAttribute("aria-label", title);
  d.dataset.request = crypto.randomUUID();
  d.innerHTML = `<div class="section-head"><h2>${esc(title)}</h2><button class="b s" onclick="document.getElementById('smc-management-dialog').close()">Fechar</button></div>${content}`;
  if (!d.open) d.showModal();
  return d;
}
function smcAdminEdit(id, requestedStatus = null) {
  const u = eliteCloud.adminRows.find((u) => u.id === id);
  if (!u || u.role === "admin") return;
  smcAdmin.notice = null;
  if (!smcAdmin.ready) {
    smcManagementDialog(
      "Ativar plano e vencimento",
      `<p>${esc(u.name)} · ${esc(u.email)}</p><div class="cloud-banner"><h3>Gestão de prazos ainda não ativada no banco</h3><p>Para salvar planos e aplicar vencimentos automaticamente, execute a atualização de gestão no SQL Editor do Supabase. Os dados existentes são preservados.</p><a class="b s" href="https://github.com/LourranAlvares/YourFXjourney/blob/main/server/cloud/management.sql" target="_blank" rel="noopener">Abrir atualização SQL</a></div><p class="muted-note">A aprovação simples abaixo libera sem data de vencimento. Ela não configura um prazo.</p><button class="b" data-id="${esc(id)}" onclick="smcAdminLegacy(this.dataset.id,'active')" ${smcAdmin.saving ? "disabled" : ""}>Liberar sem vencimento</button><button class="b s" data-id="${esc(id)}" onclick="smcAdminRefreshAccess(this.dataset.id)">Verificar configuração</button><p id="smc-access-message" role="status"></p>`,
    );
    return;
  }
  const needsTerm =
    !u.access ||
    (u.access.expires_at && Date.parse(u.access.expires_at) <= Date.now());
  const d = smcManagementDialog(
    requestedStatus === "active" ? "Liberar acesso" : "Configurar acesso",
    `<p>${esc(u.name)} · ${esc(u.email)}</p><form id="smc-access-form"><div class="smc-admin-fields"><label>Status<select name="status" onchange="this.form.elements.term.required=this.value==='active'">${[
      ["active", "Ativo"],
      ["pending", "Aguardando aprovação"],
      ["blocked", "Bloqueado"],
    ]
      .map(
        ([k, v]) =>
          `<option value="${k}" ${(requestedStatus || u.status) === k ? "selected" : ""}>${v}</option>`,
      )
      .join(
        "",
      )}</select></label><label>Plano de acesso<select name="plan">${["standard", "trial", "monthly", "quarterly", "annual", "custom"].map((k) => `<option value="${k}" ${u.access?.plan === k ? "selected" : ""}>${smcPlan(k)}</option>`).join("")}</select></label><label>Prazo<select name="term" required onchange="smcAdminTermChanged(this)">${needsTerm ? '<option value="" selected disabled>Escolha o prazo de acesso</option>' : ""}${[
      ...(!needsTerm ? [["keep", "Manter prazo atual"]] : []),
      ["trial7", "Trial · 7 dias"],
      ["trial14", "Trial · 14 dias"],
      ["monthly", "1 mês"],
      ["bimonthly", "2 meses"],
      ["quarterly", "3 meses"],
      ["semiannual", "6 meses"],
      ["annual", "1 ano"],
      ["biennial", "2 anos"],
      ["custom", "Data personalizada"],
      ["unlimited", "Sem vencimento"],
    ]
      .map(([k, v]) => `<option value="${k}">${v}</option>`)
      .join(
        "",
      )}</select></label><label id="smc-custom-expiry" hidden>Válido até (fim do dia UTC)<input name="expiry" type="date" min="${new Date().toISOString().slice(0, 10)}"></label><label class="smc-admin-wide">Observações administrativas<textarea name="notes" maxlength="2000" rows="3" placeholder="Ex.: condição de acesso combinada">${esc(u.access?.notes || "")}</textarea></label></div><label class="smc-admin-checkbox"><input type="checkbox" name="revoke"> Encerrar as sessões atuais deste usuário</label><p class="muted-note">Um novo prazo começa agora e substitui o anterior. “Manter” preserva o vencimento. Bloqueio e vencimento restringem o sistema sem excluir o histórico.</p><p id="smc-access-message" role="status"></p><button class="b" type="submit">Salvar acesso</button></form>`,
  );
  d.querySelector("form").onsubmit = async (event) => {
    event.preventDefault();
    if (smcAdmin.saving) return;
    const f = new FormData(event.target),
      term = f.get("term") || (f.get("status") !== "active" ? "keep" : "");
    let data = {
      id,
      status: f.get("status"),
      term,
      plan: f.get("plan"),
      notes: f.get("notes"),
      revokeSessions: f.get("revoke") === "on",
    };
    if (term === "keep") {
      data.term = "keep";
    } else if (term === "custom")
      data.expiresAt = f.get("expiry")
        ? f.get("expiry") + "T23:59:59.999Z"
        : "";
    const request = d.dataset.request;
    smcAdmin.saving = true;
    const button = event.target.querySelector("[type=submit]");
    button.disabled = true;
    d.querySelector("#smc-access-message").textContent = "Salvando acesso…";
    try {
      const result = await taApi("/api/admin/management", {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      if (result?.ok !== true || result.account?.id !== id)
        throw Error(
          "O servidor não confirmou a alteração. Atualize a lista antes de tentar novamente.",
        );
      const account = result.account;
      smcAdmin.notice = `${account.status === "active" ? "Acesso liberado" : account.status === "blocked" ? "Acesso bloqueado" : "Acesso definido como pendente"} para ${u.name || u.email}. Plano: ${smcPlan(account.plan)}. ${account.expires_at ? "Válido até " + smcDate(account.expires_at) + "." : "Sem vencimento."}`;
      if (d.dataset.request === request) d.close();
      R();
      document
        .getElementById("smc-admin-notice")
        ?.scrollIntoView({ block: "nearest" });
      await eliteCloudLoadAccounts();
    } catch (e) {
      const message = d.querySelector("#smc-access-message");
      if (message && d.dataset.request === request)
        message.textContent = e.message;
    } finally {
      smcAdmin.saving = false;
      button.disabled = false;
      if (tab === "admin") R();
    }
  };
}
function smcAdminTermChanged(select) {
  const form = select.form,
    custom = select.value === "custom";
  document.getElementById("smc-custom-expiry").hidden = !custom;
  form.elements.expiry.required = custom;
  const plans = {
    trial7: "trial",
    trial14: "trial",
    monthly: "monthly",
    quarterly: "quarterly",
    annual: "annual",
    bimonthly: "custom",
    semiannual: "custom",
    biennial: "custom",
    custom: "custom",
    unlimited: "standard",
  };
  if (plans[select.value]) form.elements.plan.value = plans[select.value];
}
async function smcAdminRefreshAccess(id) {
  await eliteCloudLoadAccounts();
  if (!eliteCloud.adminError) smcAdminEdit(id, "active");
}
async function smcAdminLegacy(id, status) {
  if (smcAdmin.saving) return;
  const u = eliteCloud.adminRows.find((u) => u.id === id);
  if (!u || u.role === "admin") return;
  smcAdmin.saving = true;
  smcAdmin.notice = null;
  const d = document.getElementById("smc-management-dialog"),
    message = d?.querySelector("#smc-access-message");
  if (message) message.textContent = "Salvando acesso…";
  const request = d?.dataset.request;
  const buttons = d ? [...d.querySelectorAll("button")] : [];
  buttons.forEach((b) => (b.disabled = true));
  try {
    const result = await taApi("/api/admin/accounts", {
      method: "PATCH",
      body: JSON.stringify({ id, status }),
    });
    if (result?.ok !== true)
      throw Error(
        "O servidor não confirmou a alteração. Atualize a lista antes de tentar novamente.",
      );
    smcAdmin.notice = `${status === "active" ? (result.account?.expires_at ? "Acesso liberado até " + smcDate(result.account.expires_at) : "Acesso liberado sem vencimento") : "Acesso bloqueado"} para ${u.name || u.email}.`;
    if (d?.dataset.request === request) d?.close();
    R();
    await eliteCloudLoadAccounts();
  } catch (e) {
    if (message && d?.dataset.request === request)
      message.textContent = e.message;
    else {
      eliteCloud.adminError = e.message;
      R();
    }
  } finally {
    smcAdmin.saving = false;
    buttons.forEach((b) => (b.disabled = false));
    if (tab === "admin") R();
  }
}
async function smcAdminAudit(id) {
  const d = smcManagementDialog(
    "Histórico de gestão",
    '<p role="status">Carregando…</p>',
  );
  const request = d.dataset.request;
  try {
    const { events } = await taApi(
      "/api/admin/audit?id=" + encodeURIComponent(id),
    );
    if (!d.open || d.dataset.request !== request) return;
    smcManagementDialog(
      "Histórico de gestão",
      `<p>Últimas 50 alterações. Horários no fuso deste dispositivo.</p>${events.map((e) => `<article class="smc-audit-entry"><b>Acesso atualizado</b><small>${esc(smcDate(e.created_at))}</small>${e.action === "access_updated" ? `<p>Status: ${esc(e.details.status)} · Plano: ${esc(smcPlan(e.details.plan))}<br>Vencimento: ${esc(smcDate(e.details.expires_at))}${e.details.sessions_revoked ? " · sessões encerradas" : ""}</p>` : ""}</article>`).join("") || "<p>Nenhuma alteração registrada.</p>"}`,
    );
  } catch (e) {
    const message = d.querySelector("[role=status]");
    if (message) message.textContent = e.message;
  }
}

function smcRegistrationHealthView() {
  const h = smcAdmin.registration;
  if (!h) return "";
  const labels = {
    auth_email_rate_limit: "Envio de confirmações limitado pelo provedor",
    auth_email_configuration: "Configuração de e-mail necessária",
    auth_email_delivery: "Falha no envio de confirmação",
    auth_request_rate_limit: "Tentativas limitadas pelo provedor",
    provider_accepted: "Último envio aceito pelo provedor",
    not_verified: "Envio de e-mails: ainda não verificado",
  };
  return `<details class="smc-registration-health" ${h.state.startsWith("auth_") ? "open" : ""}><summary>${esc(labels[h.state] || "Configuração de cadastro")}</summary><p>${h.state === "provider_accepted" ? "O provedor aceitou uma solicitação. Isso não confirma entrega na caixa de entrada." : "Para receber cadastros de clientes, configure SMTP próprio no Supabase e revise os limites de envio. O envio padrão tem restrições."}</p>${h.lastErrorAt ? `<small>Última ocorrência técnica: ${esc(smcDate(h.lastErrorAt))}. O diagnóstico não contém e-mails ou dados pessoais.</small>` : ""}<a class="b s" href="https://github.com/LourranAlvares/YourFXjourney/blob/main/server/cloud/REGISTRATION.md" target="_blank" rel="noopener">Ver configuração de e-mails</a> <a class="b s" href="https://github.com/LourranAlvares/YourFXjourney/blob/main/server/cloud/management.sql" target="_blank" rel="noopener">Atualizar estrutura de gestão</a></details>`;
}
