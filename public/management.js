/* Administration manages access. Coaching summaries require revocable member consent. */
const smcAdmin = {
  ready: false,
  offset: 0,
  more: false,
  query: "",
  saving: false,
  consent: null,
  consentFlight: false,
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
  return `<section class="card smc-admin-heading"><div class="section-head"><div><h2>Gestão da plataforma</h2><p>Contas, prazos de acesso e acompanhamento autorizado.</p></div><button class="b s" onclick="eliteCloudLoadAccounts()" ${eliteCloud.adminPending ? "disabled" : ""}>Atualizar</button></div><form class="smc-admin-search" onsubmit="smcAdminSearch(event)"><label>Buscar por nome ou e-mail<input id="smc-admin-query" value="${esc(smcAdmin.query)}" placeholder="Nome ou e-mail" maxlength="100"></label><button class="b s" type="submit">Buscar</button></form><p role="status">${eliteCloud.adminPending ? "Carregando…" : eliteCloud.adminError ? esc(eliteCloud.adminError) : `${rows.length} conta(s) nesta página`}</p>${!smcAdmin.ready && !eliteCloud.adminPending && !eliteCloud.adminError ? '<div class="cloud-banner"><h3>Ativar prazos e auditoria</h3><p>Execute a atualização de gestão no SQL Editor do Supabase. Aprovação e bloqueio atuais continuam disponíveis.</p><a class="b s" href="https://github.com/LourranAlvares/YourFXjourney/blob/main/server/cloud/management.sql" target="_blank" rel="noopener">Abrir atualização SQL</a></div>' : ""}</section><div class="smc-admin-users">${rows
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
      return `<article class="card smc-admin-user" data-account-search="${esc((u.name + " " + u.email).toLowerCase())}"><div class="section-head"><div><h3>${esc(u.name || "Sem nome")}</h3><p>${esc(u.email)}</p></div><span class="badge">${self ? "Administradora" : state}</span></div><dl><div><dt>Cadastro</dt><dd>${esc(smcDate(u.created_at))}</dd></div><div><dt>Plano</dt><dd>${self ? "Administração" : smcPlan(u.access?.plan)}</dd></div><div><dt>Vencimento</dt><dd>${self ? "Não se aplica" : esc(smcDate(u.access?.expires_at))}</dd></div></dl><p class="muted-note">${u.coaching?.enabled ? "Resumo de desempenho autorizado pelo usuário." : "Desempenho privado · sem autorização para acompanhamento."}</p><div class="cloud-account-actions">${self ? '<span class="badge">Conta protegida</span>' : smcAdmin.ready ? `<button class="b s" data-id="${esc(u.id)}" onclick="smcAdminEdit(this.dataset.id)">Configurar acesso</button><button class="b s" data-id="${esc(u.id)}" onclick="smcAdminAudit(this.dataset.id)">Auditoria</button>${u.coaching?.enabled ? `<button class="b s" data-id="${esc(u.id)}" onclick="smcAdminPerformance(this.dataset.id)">Ver desempenho</button>` : ""}` : `<button class="b s" data-id="${esc(u.id)}" onclick="eliteCloudAccess(this.dataset.id,'active')">Liberar acesso</button><button class="b s" data-id="${esc(u.id)}" onclick="eliteCloudAccess(this.dataset.id,'blocked')">Bloquear</button>`}</div></article>`;
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
      )}</select></label><label id="smc-custom-expiry" hidden>Válido até (fim do dia UTC)<input name="expiry" type="date"></label><label class="smc-admin-wide">Observações administrativas<textarea name="notes" maxlength="2000" rows="3" placeholder="Ex.: condição de acesso combinada">${esc(u.access?.notes || "")}</textarea></label></div><label class="smc-consent-label"><input type="checkbox" name="revoke"> Encerrar as sessões atuais deste usuário</label><p class="muted-note">Um novo prazo começa agora e substitui o anterior. “Manter” preserva o vencimento. Bloqueio e vencimento restringem o sistema sem excluir o histórico.</p><p id="smc-access-message" role="status"></p><button class="b" type="submit">Salvar acesso</button></form>`,
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
      `<p>Últimas 50 alterações. Horários no fuso deste dispositivo.</p>${events.map((e) => `<article class="smc-audit-entry"><b>${e.action === "coaching_consent" ? (e.details.enabled ? "Compartilhamento autorizado" : "Compartilhamento revogado") : "Acesso atualizado"}</b><small>${esc(smcDate(e.created_at))}</small>${e.action === "access_updated" ? `<p>Status: ${esc(e.details.status)} · Plano: ${esc(smcPlan(e.details.plan))}<br>Vencimento: ${esc(smcDate(e.details.expires_at))}${e.details.sessions_revoked ? " · sessões encerradas" : ""}</p>` : ""}</article>`).join("") || "<p>Nenhuma alteração registrada.</p>"}`,
    );
  } catch (e) {
    const message = d.querySelector("[role=status]");
    if (message) message.textContent = e.message;
  }
}
async function smcAdminPerformance(id) {
  const d = smcManagementDialog(
    "Desempenho compartilhado",
    '<p role="status">Conferindo autorização atual…</p>',
  );
  const request = d.dataset.request;
  try {
    // Read a fresh permission and summary each time, never a cached private workspace.
    const target = eliteCloud.adminRows.find((u) => u.id === id);
    const data = await taApi(
        "/api/admin/management?offset=0&q=" +
          encodeURIComponent(target?.email || ""),
      ),
      u = data.accounts.find((u) => u.id === id),
      s = u?.coaching?.summary;
    if (!d.open || d.dataset.request !== request) return;
    if (!u?.coaching?.enabled) {
      smcManagementDialog(
        "Desempenho compartilhado",
        "<p>Este usuário não autorizou ou revogou o compartilhamento.</p>",
      );
      return;
    }
    if (!s) {
      smcManagementDialog(
        "Desempenho compartilhado",
        "<p>Autorizado. O resumo estará disponível após salvar o próximo registro.</p>",
      );
      return;
    }
    const amount = (v) =>
      typeof v === "number"
        ? new Intl.NumberFormat(
            "pt-BR",
            s.currency
              ? { style: "currency", currency: s.currency }
              : { maximumFractionDigits: 2 },
          ).format(v)
        : "—";
    smcManagementDialog(
      "Desempenho compartilhado",
      `<p>${esc(u.name)} · atualizado ${esc(smcDate(s.asOf))}</p><div class="smc-admin-summary">${[
        ["Operações fechadas", s.trades],
        ["P&L total", amount(s.net)],
        [
          "Taxa de acerto",
          s.winRate === null ? "—" : s.winRate.toFixed(1) + "%",
        ],
        [
          "Profit factor",
          s.profitFactor === null ? "—" : s.profitFactor.toFixed(2),
        ],
        ["Drawdown", amount(s.drawdown)],
        ["Sequência atual de perdas", s.lossStreak],
        ["Semana", amount(s.week.net)],
        ["Mês", amount(s.month.net)],
        [
          "Retorno sobre saldo inicial",
          s.returnPercent === null
            ? "Saldo não confirmado"
            : s.returnPercent.toFixed(2) + "%",
        ],
      ]
        .map(([a, b]) => `<div><small>${a}</small><b>${esc(b)}</b></div>`)
        .join(
          "",
        )}</div><p class="muted-note">Datas de fechamento registradas; semana iniciada na segunda-feira UTC. Sem depósitos, saques ou posições abertas. Comissões somente se incluídas no P&L. Resumo declarado pelo usuário, não extrato verificado da corretora. Prints, notas e diário não são compartilhados.</p>`,
    );
  } catch (e) {
    const message = d.querySelector("[role=status]");
    if (message) message.textContent = e.message;
  }
}
const smcOriginalCloudAfterRender = eliteCloudAfterRender;
eliteCloudAfterRender = function () {
  smcOriginalCloudAfterRender();
  if (CLOUD_BOOT && eliteCloud.ready && tab === "settings") {
    smcRenderCoaching();
    if (smcAdmin.consent === null && !smcAdmin.consentFlight) smcLoadConsent();
  }
};
async function smcLoadConsent() {
  smcAdmin.consentFlight = true;
  try {
    smcAdmin.consent = await taApi("/api/account/coaching");
  } catch (e) {
    smcAdmin.consent = { ready: false, error: e.message };
  } finally {
    smcAdmin.consentFlight = false;
    smcRenderCoaching();
  }
}
function smcRenderCoaching() {
  if (tab !== "settings" || !eliteCloud.ready) return;
  const parent = document.querySelector(".cloud-account-panel");
  if (!parent) return;
  let section = document.getElementById("smc-coaching-consent");
  if (!section) {
    section = document.createElement("section");
    section.id = "smc-coaching-consent";
    section.className = "card";
    parent.after(section);
  }
  const c = smcAdmin.consent;
  section.innerHTML = `<p class="muted-note">Seu acesso: ${smcPlan(eliteCloud.user.plan)} · ${esc(smcDate(eliteCloud.user.accessExpiresAt))}</p><h2>Acompanhamento pela administração</h2><p>Opcional: compartilhar somente um resumo de operações, lucro/prejuízo, acerto, drawdown, semana e mês com a administração para acompanhamento. Seu diário, prints, anotações e plano completo permanecem privados.</p><p>Você pode revogar a autorização aqui a qualquer momento; o resumo deixa de ficar disponível para novas consultas.</p>${!c ? '<p role="status">Carregando preferência…</p>' : !c.ready ? `<p class="muted-note">${esc(c.error || "Compartilhamento ainda não ativado pela plataforma. Nenhum resumo está sendo compartilhado.")}</p>` : `<p class="badge">${c.enabled ? "Compartilhamento autorizado" : "Não compartilhado"}</p><p class="muted-note">${c.enabled ? "Último resumo: " + esc(c.updatedAt ? smcDate(c.updatedAt) : "aguardando atualização") : ""}</p><button class="b s" onclick="smcSetConsent(${!c.enabled})" ${smcAdmin.consentFlight ? "disabled" : ""}>${c.enabled ? "Revogar compartilhamento" : "Autorizar resumo de desempenho"}</button>`}`;
}
async function smcSetConsent(enabled) {
  if (smcAdmin.consentFlight) return;
  smcAdmin.consentFlight = true;
  smcRenderCoaching();
  try {
    smcAdmin.consent = await taApi("/api/account/coaching", {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    });
  } catch (e) {
    alert(e.message);
  } finally {
    smcAdmin.consentFlight = false;
    smcRenderCoaching();
  }
}
