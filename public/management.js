/* Account administration only. Trading data remains private. */
const smcAdmin = {
  ready: false,
  offset: 0,
  more: false,
  query: "",
  saving: false,
  registration: null,
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
  return `<section class="card smc-admin-heading"><div class="section-head"><div><h2>Gestão da plataforma</h2><p>Contas, permissões e prazos de acesso.</p></div><button class="b s" onclick="eliteCloudLoadAccounts()" ${eliteCloud.adminPending ? "disabled" : ""}>Atualizar</button></div><form class="smc-admin-search" onsubmit="smcAdminSearch(event)"><label>Buscar por nome ou e-mail<input id="smc-admin-query" value="${esc(smcAdmin.query)}" placeholder="Nome ou e-mail" maxlength="100"></label><button class="b s" type="submit">Buscar</button></form>${smcRegistrationHealthView()}<p role="status">${eliteCloud.adminPending ? "Carregando…" : eliteCloud.adminError ? esc(eliteCloud.adminError) : `${rows.length} conta(s) nesta página`}</p>${!smcAdmin.ready && !eliteCloud.adminPending && !eliteCloud.adminError ? '<div class="cloud-banner"><h3>Ativar prazos e auditoria</h3><p>Execute a atualização de gestão no SQL Editor do Supabase. Aprovação e bloqueio atuais continuam disponíveis.</p><a class="b s" href="https://github.com/LourranAlvares/YourFXjourney/blob/main/server/cloud/management.sql" target="_blank" rel="noopener">Abrir atualização SQL</a></div>' : ""}</section><div class="smc-admin-users">${rows
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
      return `<article class="card smc-admin-user" data-account-search="${esc((u.name + " " + u.email).toLowerCase())}"><div class="section-head"><div><h3>${esc(u.name || "Sem nome")}</h3><p>${esc(u.email)}</p></div><span class="badge">${self ? "Administradora" : state}</span></div><dl><div><dt>Cadastro</dt><dd>${esc(smcDate(u.created_at))}</dd></div><div><dt>Plano</dt><dd>${self ? "Administração" : smcPlan(u.access?.plan)}</dd></div><div><dt>Vencimento</dt><dd>${self ? "Não se aplica" : esc(smcDate(u.access?.expires_at))}</dd></div></dl><div class="cloud-account-actions">${self ? '<span class="badge">Conta protegida</span>' : smcAdmin.ready ? `<button class="b s" data-id="${esc(u.id)}" onclick="smcAdminEdit(this.dataset.id)">Configurar acesso</button><button class="b s" data-id="${esc(u.id)}" onclick="smcAdminAudit(this.dataset.id)">Auditoria</button>` : `<button class="b s" data-id="${esc(u.id)}" onclick="eliteCloudAccess(this.dataset.id,'active')">Liberar acesso</button><button class="b s" data-id="${esc(u.id)}" onclick="eliteCloudAccess(this.dataset.id,'blocked')">Bloquear</button>`}</div></article>`;
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
  d.dataset.request = crypto.randomUUID();
  d.innerHTML = `<div class="section-head"><h2>${esc(title)}</h2><button class="b s" onclick="document.getElementById('smc-management-dialog').close()">Fechar</button></div>${content}`;
  if (!d.open) d.showModal();
  return d;
}
function smcAdminEdit(id) {
  const u = eliteCloud.adminRows.find((u) => u.id === id);
  if (!u || u.role === "admin") return;
  const d = smcManagementDialog(
    "Configurar acesso",
    `<p>${esc(u.name)} · ${esc(u.email)}</p><form id="smc-access-form"><div class="smc-admin-fields"><label>Status<select name="status">${[
      ["active", "Ativo"],
      ["pending", "Aguardando aprovação"],
      ["blocked", "Bloqueado"],
    ]
      .map(
        ([k, v]) =>
          `<option value="${k}" ${u.status === k ? "selected" : ""}>${v}</option>`,
      )
      .join(
        "",
      )}</select></label><label>Prazo<select name="term" onchange="document.getElementById('smc-custom-expiry').hidden=this.value!=='custom'">${[
      ["keep", "Manter prazo atual"],
      ["trial7", "Trial · 7 dias"],
      ["trial14", "Trial · 14 dias"],
      ["monthly", "1 mês"],
      ["quarterly", "3 meses"],
      ["annual", "1 ano"],
      ["custom", "Data personalizada"],
      ["unlimited", "Sem vencimento"],
    ]
      .map(([k, v]) => `<option value="${k}">${v}</option>`)
      .join(
        "",
      )}</select></label><label id="smc-custom-expiry" hidden>Válido até (fim do dia UTC)<input name="expiry" type="date"></label><label class="smc-admin-wide">Observações administrativas<textarea name="notes" maxlength="2000" rows="3" placeholder="Ex.: condição de acesso combinada">${esc(u.access?.notes || "")}</textarea></label></div><label class="smc-admin-checkbox"><input type="checkbox" name="revoke"> Encerrar as sessões atuais deste usuário</label><p class="muted-note">Um novo prazo começa agora e substitui o anterior. “Manter” preserva o vencimento. Bloqueio e vencimento restringem o sistema sem excluir o histórico.</p><p id="smc-access-message" role="status"></p><button class="b" type="submit">Salvar acesso</button></form>`,
  );
  d.querySelector("form").onsubmit = async (event) => {
    event.preventDefault();
    if (smcAdmin.saving) return;
    const f = new FormData(event.target),
      term = f.get("term");
    let data = {
      id,
      status: f.get("status"),
      term,
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
    try {
      await taApi("/api/admin/management", {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      if (d.dataset.request === request) d.close();
      await eliteCloudLoadAccounts();
    } catch (e) {
      const message = d.querySelector("#smc-access-message");
      if (message) message.textContent = e.message;
    } finally {
      smcAdmin.saving = false;
      button.disabled = false;
    }
  };
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
