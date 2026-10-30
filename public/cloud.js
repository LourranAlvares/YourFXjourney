/* Cloud state is scoped by authenticated user. Legacy browser data is opt-in only. */
const eliteCloud = {
  ready: false,
  user: null,
  revision: 0,
  pending: null,
  mutation: null,
  flight: null,
  timer: null,
  retry: 0,
  conflict: false,
  state: "loading",
  message: "Conectando à sua conta…",
  cacheOK: true,
  adminRows: null,
  adminPending: false,
};
const eliteCloudDefault = () => ({
  trades: [],
  reviews: {},
  strats: [],
  balance: 10000,
});
function eliteCloudState(state, message) {
  eliteCloud.state = state;
  eliteCloud.message = message;
  eliteCloudAfterRender();
}
function eliteCloudCache() {
  try {
    localStorage.setItem(
      K,
      JSON.stringify({
        data: S,
        revision: eliteCloud.revision,
        dirty: !!eliteCloud.pending,
        mutationId: eliteCloud.mutation,
      }),
    );
    eliteCloud.cacheOK = true;
  } catch {
    eliteCloud.cacheOK = false;
  }
}
function eliteCloudPersist(next) {
  if (!eliteCloud.ready) throw Error("Sua conta ainda está carregando.");
  const encoded = JSON.stringify(next);
  if (new TextEncoder().encode(encoded).length > 25 * 1024 * 1024)
    throw Error(
      "Seus dados excedem o limite de envio. Exporte um backup antes de remover imagens.",
    );
  eliteCloud.pending = JSON.parse(encoded);
  eliteCloud.mutation = crypto.randomUUID();
  try {
    localStorage.setItem(
      K,
      JSON.stringify({
        data: next,
        revision: eliteCloud.revision,
        dirty: true,
        mutationId: eliteCloud.mutation,
      }),
    );
    eliteCloud.cacheOK = true;
  } catch {
    eliteCloud.cacheOK = false;
  }
  eliteCloudState(
    eliteCloud.conflict ? "conflict" : "pending",
    eliteCloud.conflict
      ? "Revisar conflito de versões"
      : eliteCloud.cacheOK
        ? "Alterações aguardando envio"
        : "Alterações somente nesta aba; mantenha-a aberta",
  );
  clearTimeout(eliteCloud.timer);
  if (!eliteCloud.conflict)
    eliteCloud.timer = setTimeout(eliteCloudFlush, 1000);
  return true;
}
async function eliteCloudFlush() {
  if (!eliteCloud.ready || !eliteCloud.pending || eliteCloud.conflict)
    return false;
  if (eliteCloud.flight) return eliteCloud.flight;
  const data = eliteCloud.pending,
    mutationId = eliteCloud.mutation,
    revision = eliteCloud.revision;
  eliteCloudState("saving", "Salvando na nuvem…");
  eliteCloud.flight = (async () => {
    try {
      const result = await taApi("/api/workspace", {
        method: "PUT",
        body: JSON.stringify({ data, revision, mutationId }),
      });
      if (!Number.isSafeInteger(result.revision))
        throw Error("A nuvem não confirmou o salvamento.");
      eliteCloud.revision = result.revision;
      eliteCloud.retry = 0;
      if (eliteCloud.mutation === mutationId) {
        eliteCloud.pending = null;
        eliteCloud.mutation = null;
      }
      eliteCloudCache();
      eliteCloudState(
        eliteCloud.pending ? "pending" : "saved",
        eliteCloud.pending ? "Enviando últimas alterações…" : "Salvo na nuvem",
      );
      return true;
    } catch (e) {
      if (e.status === 409) {
        eliteCloud.conflict = true;
        eliteCloudState(
          "conflict",
          "Outra sessão salvou uma nova versão. Revise suas alterações.",
        );
      } else {
        eliteCloudState(
          "error",
          e.message +
            (eliteCloud.cacheOK
              ? " Alterações mantidas neste navegador."
              : " Exporte um backup antes de fechar esta aba."),
        );
        eliteCloud.retry++;
      }
      return false;
    } finally {
      eliteCloud.flight = null;
      clearTimeout(eliteCloud.timer);
      if (eliteCloud.pending && !eliteCloud.conflict && eliteCloud.ready)
        eliteCloud.timer = setTimeout(
          eliteCloudFlush,
          Math.min(60000, eliteCloud.retry ? 10000 * eliteCloud.retry : 1000),
        );
    }
  })();
  return eliteCloud.flight;
}
function eliteCloudAfterRender() {
  if (typeof CLOUD_BOOT === "undefined" || !CLOUD_BOOT || !eliteCloud.ready)
    return;
  const label = document.querySelector(".terminal-connection-label");
  if (label) {
    label.textContent = eliteCloud.message;
    label.closest("button").dataset.cloudState = eliteCloud.state;
    label.classList.add("cloud-status");
    label.dataset.state = eliteCloud.state;
    label.setAttribute("role", "status");
    label.title = eliteCloud.user.email + " · " + eliteCloud.message;
  }
  const small = document.querySelector(".elite-profile small");
  if (small) small.textContent = eliteCloud.user.email;
  let toast = document.getElementById("cloud-save-notice");
  if (["error", "conflict"].includes(eliteCloud.state)) {
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "cloud-save-notice";
      toast.className = "cloud-save-notice";
      document.body.append(toast);
    }
    toast.innerHTML = `<p role="status">${esc(eliteCloud.message)}</p><button class="b s" onclick="taGo('settings')">Revisar salvamento</button>`;
  } else toast?.remove();
  if (
    tab === "home" &&
    eliteCloud.revision === 0 &&
    !S.trades.length &&
    eliteCloudLegacy() &&
    !document.getElementById("cloud-import-banner")
  ) {
    const banner = document.createElement("section");
    banner.id = "cloud-import-banner";
    banner.className = "cloud-banner";
    banner.innerHTML =
      '<h3>Seu histórico anterior está neste navegador</h3><p>Revise os dados antes de associá-los à sua conta na nuvem.</p><button class="b" onclick="eliteCloudImportLegacy()">Revisar e importar meu histórico</button>';
    document.querySelector(".reference-topbar")?.after(banner);
  }
  if (
    tab === "admin" &&
    eliteCloud.user.role === "admin" &&
    !eliteCloud.adminRows &&
    !eliteCloud.adminPending
  )
    eliteCloudLoadAccounts();
}
function eliteCloudGate(message) {
  document.getElementById("main").innerHTML =
    `<section class="cloud-gate"><h1>Seu espaço EliteX</h1><p role="status">${esc(message)}</p><div><button class="b" onclick="eliteCloudBoot()">Tentar novamente</button> <a href="/account">Minha conta</a></div></section>`;
}
async function eliteCloudBoot() {
  eliteCloud.ready = false;
  eliteCloudGate("Carregando seus dados na nuvem…");
  try {
    await taCheckConnection(true);
    const user = taConnection.user;
    if (!taConnection.authenticated || !user || user.status !== "active") {
      location.replace("/account");
      return;
    }
    eliteCloud.user = user;
    K = "elitex-workspace:" + user.id;
    const remote = await taApi("/api/workspace");
    if (
      !remote.data ||
      !Array.isArray(remote.data.trades) ||
      !Number.isSafeInteger(remote.revision)
    )
      throw Error(
        "A nuvem retornou dados inválidos. Nenhum histórico foi substituído.",
      );
    let cached;
    try {
      cached = JSON.parse(localStorage.getItem(K) || "null");
    } catch {}
    eliteCloud.revision = remote.revision;
    eliteCloud.pending = null;
    eliteCloud.conflict = false;
    if (cached?.dirty && cached.data && Array.isArray(cached.data.trades)) {
      S = cached.data;
      eliteCloud.pending = cached.data;
      eliteCloud.mutation = cached.mutationId || crypto.randomUUID();
      if (cached.revision !== remote.revision) eliteCloud.conflict = true;
    } else S = { ...eliteCloudDefault(), ...remote.data };
    if (!S.assistantProfile?.name && user.name)
      S.assistantProfile = {
        ...taProfile(),
        name: user.firstName || user.name.trim().split(/\s+/)[0],
      };
    if (user.role === "admin" && !tabs.some(([id]) => id === "admin"))
      tabs.push(["admin", "Administração"]);
    else if (user.role !== "admin") {
      const i = tabs.findIndex(([id]) => id === "admin");
      if (i >= 0) tabs.splice(i, 1);
    }
    eliteCloud.ready = true;
    eliteCloudCache();
    eliteCloudState(
      eliteCloud.conflict
        ? "conflict"
        : eliteCloud.pending
          ? "pending"
          : "saved",
      eliteCloud.conflict
        ? "Há alterações locais e uma nova versão na nuvem."
        : eliteCloud.pending
          ? "Retomando salvamento…"
          : "Salvo na nuvem",
    );
    R();
    if (eliteCloud.pending && !eliteCloud.conflict) eliteCloudFlush();
  } catch (e) {
    eliteCloudGate(e.message + " Seu histórico local não foi apagado.");
  }
}
function eliteCloudLock() {
  if (!CLOUD_BOOT) return;
  eliteCloudCache();
  eliteCloud.ready = false;
  clearTimeout(eliteCloud.timer);
  S = eliteCloudDefault();
  location.replace("/account");
}
async function eliteCloudLogout() {
  if (eliteCloud.pending) {
    const saved = await eliteCloudFlush();
    if (!saved && eliteCloud.pending) {
      alert(
        "Há alterações que ainda não chegaram à nuvem. Exporte um backup ou resolva o salvamento antes de sair.",
      );
      taGo("settings");
      return;
    }
  }
  try {
    await taApi("/api/auth/logout", { method: "POST", body: "{}" });
    try {
      localStorage.removeItem(K);
      localStorage.removeItem(K + ":conflict-backup");
    } catch {}
    S = eliteCloudDefault();
    eliteCloud.ready = false;
    location.replace("/account");
  } catch (e) {
    alert(e.message);
  }
}
function eliteCloudDownload() {
  const blob = new Blob([JSON.stringify(S, null, 2)], {
      type: "application/json",
    }),
    a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "elitex-backup-" + taDailyDate() + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function eliteCloudLoadRemote() {
  if (eliteCloud.flight) return;
  if (
    !confirm(
      "Usar a versão da nuvem? As alterações locais pendentes não serão enviadas. Você pode baixar um backup antes.",
    )
  )
    return;
  try {
    const remote = await taApi("/api/workspace");
    localStorage.setItem(K + ":conflict-backup", JSON.stringify(S));
    S = remote.data;
    eliteCloud.revision = remote.revision;
    eliteCloud.pending = null;
    eliteCloud.mutation = null;
    eliteCloud.conflict = false;
    eliteCloudCache();
    eliteCloudState("saved", "Versão da nuvem carregada");
    document.querySelectorAll("dialog[open]").forEach((d) => d.close());
    R();
  } catch (e) {
    alert(e.message);
  }
}
function eliteCloudLegacy() {
  if (eliteCloud.user?.role !== "admin") return null;
  try {
    const data = JSON.parse(localStorage.getItem("yfx1") || "null");
    return data && (data.trades?.length || data.tradingPlans?.length)
      ? data
      : null;
  } catch {
    return null;
  }
}
function eliteCloudImportLegacy() {
  const data = eliteCloudLegacy();
  if (!data) return;
  if (S.trades.length || S.tradingPlans?.length) {
    alert(
      "Esta conta já contém dados. Exporte os dois históricos antes de substituir qualquer informação.",
    );
    return;
  }
  const d = document.getElementById("ta-dialog");
  d.innerHTML = `<h2>Trazer meu histórico anterior</h2><p>Encontramos ${data.trades?.length || 0} trade(s) e ${data.tradingPlans?.length || 0} plano(s) salvos anteriormente neste navegador. Só importe se esses dados forem seus.</p><label><input type="checkbox" id="cloud-legacy-confirm"> Confirmo que este histórico é meu e quero associá-lo à minha conta.</label><div class="cloud-account-actions"><button class="b" id="cloud-legacy-import">Importar para minha conta</button><button class="b s" onclick="document.getElementById('ta-dialog').close()">Cancelar</button></div>`;
  d.showModal();
  document.getElementById("cloud-legacy-import").onclick = () => {
    if (!document.getElementById("cloud-legacy-confirm").checked) return;
    S = { ...eliteCloudDefault(), ...data };
    save();
    d.close();
    R();
  };
}
function eliteCloudSettingsPanel() {
  return `<section class="card cloud-account-panel"><div class="section-head"><div><div class="eyebrow">Sua conta</div><h2>Conta e nuvem</h2><p>${esc(eliteCloud.user.email)}</p></div><span class="badge">${eliteCloud.user.role === "admin" ? "Administradora" : "Conta pessoal"}</span></div><p class="cloud-status" data-state="${eliteCloud.state}" role="status">${esc(eliteCloud.message)}</p><p>Diário, prints, plano e preferências de trading são salvos nesta conta. O acesso aos serviços online usa a sua sessão.</p><div class="cloud-account-actions"><button class="b s" onclick="eliteCloudFlush()" ${eliteCloud.flight ? "disabled" : ""}>Salvar agora</button><button class="b s" onclick="eliteCloudDownload()">Baixar meu backup</button><button class="b s" onclick="eliteCloudVersions()">Versões anteriores</button><a class="b s" href="/account?change_password=1">Alterar senha</a><button class="b s" onclick="eliteCloudLogout()">Sair da minha conta</button></div>${eliteCloud.conflict ? '<div class="cloud-banner"><h3>Conflito entre sessões</h3><p>Suas alterações locais foram preservadas. Baixe uma cópia antes de decidir qual versão usar.</p><div class="cloud-conflict-actions"><button class="b" onclick="eliteCloudDownload()">Baixar minhas alterações</button><button class="b s" onclick="eliteCloudLoadRemote()">Usar versão da nuvem</button></div></div>' : ""}${eliteCloudLegacy() && !S.trades.length && !S.tradingPlans?.length ? '<div class="cloud-banner"><h3>Seu histórico anterior</h3><p>Há dados antigos neste navegador. Eles não foram associados automaticamente a esta conta.</p><button class="b" onclick="eliteCloudImportLegacy()">Revisar e importar meu histórico</button></div>' : ""}</section>`;
}
function vSettings() {
  const html = vSettingsLegacy();
  if (!CLOUD_BOOT) return html;
  const routine =
    html.split('</section><section class="card">')[0] + "</section>";
  return (
    eliteCloudSettingsPanel() +
    routine +
    `<section class="card"><h2>Serviços conectados</h2><p>As chaves ficam no servidor e não são expostas à sua conta.</p><div class="ta-service-grid">${[
      ["ai", "EliteX Analyst · IA"],
      ["economicCalendar", "Notícias"],
      ["marketConditions", "Dados de mercado"],
    ]
      .map(
        ([key, label]) =>
          `<div><span>${label}</span><b>${taConnection.services?.[key] ? "Configurado · validação na consulta" : "Indisponível"}</b></div>`,
      )
      .join("")}</div></section>`
  );
}
async function eliteCloudVersions() {
  try {
    const result = await taApi("/api/workspace/history"),
      d = document.getElementById("ta-dialog");
    d.innerHTML = `<h2>Versões anteriores da sua conta</h2><p>As três versões anteriores ficam disponíveis para recuperação. Restaurar cria uma nova versão.</p>${result.versions.map((v) => `<p>Versão ${v.revision} · ${esc(new Date(v.created_at).toLocaleString("pt-PT"))} <button class="b s" data-version="${v.revision}" onclick="eliteCloudRestore(this.dataset.version)">Revisar restauração</button></p>`).join("") || "<p>Ainda não há versões anteriores.</p>"}<button class="b s" onclick="document.getElementById('ta-dialog').close()">Fechar</button>`;
    d.showModal();
  } catch (e) {
    alert(e.message);
  }
}
async function eliteCloudRestore(revision) {
  try {
    const result = await taApi(
        "/api/workspace/history?revision=" + encodeURIComponent(revision),
      ),
      row = result.versions[0];
    if (!row?.data) throw Error("Versão indisponível.");
    if (eliteCloud.conflict)
      throw Error("Resolva o conflito de versões antes de restaurar.");
    if (eliteCloud.pending) {
      const saved = await eliteCloudFlush();
      if (!saved || eliteCloud.pending)
        throw Error(
          "Conclua o salvamento atual antes de restaurar uma versão.",
        );
    }
    if (
      !confirm(
        `Restaurar a versão ${revision}, com ${row.data.trades?.length || 0} trade(s)? O estado atual ficará no histórico de versões após o salvamento.`,
      )
    )
      return;
    S = row.data;
    save();
    document.getElementById("ta-dialog").close();
    R();
  } catch (e) {
    alert(e.message);
  }
}
async function eliteCloudLoadAccounts() {
  if (eliteCloud.adminPending) return;
  eliteCloud.adminPending = true;
  try {
    const data = await taApi("/api/admin/accounts");
    eliteCloud.adminRows = data.accounts;
    eliteCloud.adminError = "";
  } catch (e) {
    eliteCloud.adminError = e.message;
    eliteCloud.adminRows = [];
  } finally {
    eliteCloud.adminPending = false;
    if (tab === "admin") R();
  }
}
function vCloudAdmin() {
  if (!CLOUD_BOOT || eliteCloud.user?.role !== "admin")
    return '<section class="card"><h2>Acesso restrito</h2></section>';
  const rows = eliteCloud.adminRows || [];
  return `<section class="card"><div class="section-head"><div><h2>Gerenciar acessos</h2><p>Aprove novos cadastros ou bloqueie o acesso aos serviços e à nuvem. Os históricos permanecem privados.</p></div><button class="b s" onclick="eliteCloudLoadAccounts()" ${eliteCloud.adminPending ? "disabled" : ""}>Atualizar</button></div><label>Buscar conta<input class="cloud-admin-search" id="cloud-admin-search" placeholder="Nome ou e-mail" oninput="document.querySelectorAll('[data-account-search]').forEach(row=>row.hidden=!row.dataset.accountSearch.includes(this.value.toLowerCase()))"></label><p role="status">${eliteCloud.adminPending ? "Carregando contas…" : eliteCloud.adminError ? esc(eliteCloud.adminError) : rows.length + " conta(s)"}</p><div class="table-wrap"><table class="cloud-admin-table"><thead><tr><th>Conta</th><th>Acesso</th><th>Cadastro</th><th>Ações</th></tr></thead><tbody>${rows.map((u) => `<tr data-account-search="${esc((u.name + " " + u.email).toLowerCase())}"><td><b>${esc(u.name)}</b><br>${esc(u.email)}</td><td>${{ active: "Ativo", pending: "Aguardando aprovação", blocked: "Bloqueado" }[u.status] || esc(u.status)}</td><td>${esc(new Date(u.created_at).toLocaleDateString("pt-PT"))}</td><td>${u.role === "admin" ? '<span class="badge">Conta administradora</span>' : `<div class="cloud-account-actions"><button class="b s" data-id="${esc(u.id)}" onclick="eliteCloudAccess(this.dataset.id,'active')" ${u.status === "active" ? "disabled" : ""}>Liberar acesso</button><button class="b s" data-id="${esc(u.id)}" onclick="eliteCloudAccess(this.dataset.id,'blocked')" ${u.status === "blocked" ? "disabled" : ""}>Bloquear</button></div>`}</td></tr>`).join("")}</tbody></table></div></section>`;
}
async function eliteCloudAccess(id, status) {
  try {
    await taApi("/api/admin/accounts", {
      method: "PATCH",
      body: JSON.stringify({ id, status }),
    });
    await eliteCloudLoadAccounts();
  } catch (e) {
    alert(e.message);
  }
}
window.addEventListener("online", () => {
  if (CLOUD_BOOT && eliteCloud.ready && eliteCloud.pending) eliteCloudFlush();
});
window.addEventListener("beforeunload", (e) => {
  if (CLOUD_BOOT && eliteCloud.pending) {
    e.preventDefault();
    e.returnValue = "";
  }
});
document.addEventListener("visibilitychange", () => {
  if (
    CLOUD_BOOT &&
    document.visibilityState === "hidden" &&
    eliteCloud.ready &&
    eliteCloud.pending
  )
    eliteCloudFlush();
});
