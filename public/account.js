"use strict";
let accountMode = "login",
  accountCsrf = "",
  accountSubmitting = false,
  accountMailPausedUntil = 0;
const accountCooldowns = new Map();
const aq = (id) => document.getElementById(id),
  safe = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
async function accountApi(path, data, method = data ? "POST" : "GET") {
  const r = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      ...(accountCsrf ? { "X-CSRF-Token": accountCsrf } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  let d;
  try {
    d = await r.json();
  } catch {
    throw Error(
      "O servidor não respondeu corretamente. Aguarde alguns instantes e tente novamente.",
    );
  }
  if (!r.ok) {
    const error = Error(
      d.error?.message || "Não foi possível conectar. Tente novamente.",
    );
    error.code = d.error?.code;
    error.status = r.status;
    error.retryAfterSeconds = d.error?.retryAfterSeconds;
    throw error;
  }
  if (d.csrf) accountCsrf = d.csrf;
  return d;
}
function accountPasswordIcon(visible = false) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>${visible ? '<path d="m3 3 18 18"/>' : ""}</svg>`;
}
function accountPasswordVisibility(button, visible) {
  const input = aq(button.dataset.input);
  input.type = visible ? "text" : "password";
  button.setAttribute("aria-pressed", String(visible));
  button.setAttribute(
    "aria-label",
    (visible ? "Ocultar " : "Mostrar ") +
      (input.id === "account-password" ? "senha" : "confirmação de senha"),
  );
  button.innerHTML = accountPasswordIcon(visible);
}
document.querySelectorAll(".account-password-toggle").forEach((button) => {
  accountPasswordVisibility(button, false);
  button.onclick = () =>
    accountPasswordVisibility(
      button,
      aq(button.dataset.input).type === "password",
    );
});
function accountModeSet(mode, force = false) {
  if (accountSubmitting && !force) return;
  accountMode = mode;
  document.querySelector("#account-content h2").textContent = {
    login: "Bem-vindo ao SMC Elite",
    signup: "Crie sua conta",
    recover: "Recuperar acesso",
    resend: "Reenviar confirmação",
    password: "Nova senha",
  }[mode];
  document.querySelector(".account-tabs").hidden = mode === "password";
  aq("account-recover").hidden = mode === "password";
  aq("account-resend").hidden = mode === "password";
  aq("account-name-fields").hidden = mode !== "signup";
  aq("account-last-name").required = mode === "signup";
  aq("account-confirm-label").hidden = !["signup", "password"].includes(mode);
  aq("account-password-confirm").required = ["signup", "password"].includes(
    mode,
  );
  aq("account-password-confirm").value = "";
  document
    .querySelectorAll(".account-password-toggle")
    .forEach((button) => accountPasswordVisibility(button, false));
  aq("account-name").required = mode === "signup";
  aq("account-password-label").hidden = ["recover", "resend"].includes(mode);
  aq("account-password").required = !["recover", "resend"].includes(mode);
  aq("account-password").minLength =
    mode === "signup" || mode === "password" ? 12 : 1;
  aq("account-password").autocomplete =
    mode === "signup" || mode === "password"
      ? "new-password"
      : "current-password";
  aq("account-email").closest("label").hidden = mode === "password";
  aq("account-email").required = mode !== "password";
  aq("account-password-hint").hidden = !["signup", "password"].includes(mode);
  aq("account-submit").textContent = {
    login: "Entrar",
    signup: "Criar minha conta",
    recover: "Enviar instruções",
    resend: "Reenviar confirmação",
    password: "Salvar nova senha",
  }[mode];
  aq("account-login-tab").setAttribute(
    "aria-pressed",
    String(mode === "login"),
  );
  aq("account-signup-tab").setAttribute(
    "aria-pressed",
    String(mode === "signup"),
  );
  aq("account-message").textContent = "";
  accountUpdateSubmit();
}
function accountCooldownKey() {
  return accountMode + "|" + aq("account-email").value.trim().toLowerCase();
}
function accountUpdateSubmit() {
  const labels = {
      login: "Entrar",
      signup: "Criar minha conta",
      recover: "Enviar instruções",
      resend: "Reenviar confirmação",
      password: "Salvar nova senha",
    },
    mail = ["signup", "recover", "resend"].includes(accountMode),
    until = Math.max(
      accountCooldowns.get(accountCooldownKey()) || 0,
      mail ? accountMailPausedUntil : 0,
    ),
    remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
  aq("account-submit").disabled = accountSubmitting || remaining > 0;
  aq("account-submit").textContent = accountSubmitting
    ? "Aguarde…"
    : labels[accountMode] + (remaining ? " (" + remaining + "s)" : "");
}
setInterval(accountUpdateSubmit, 1000);
aq("account-email").addEventListener("input", accountUpdateSubmit);
function accountAccess(user) {
  if (user?.status === "active") {
    location.replace("/");
    return;
  }
  aq("account-content").hidden = true;
  aq("account-access").hidden = false;
  aq("account-access").innerHTML =
    `<h2>${user?.status === "blocked" ? "Acesso bloqueado" : user?.status === "expired" ? "Prazo de acesso encerrado" : "Cadastro recebido"}</h2><p>${safe(user?.firstName || user?.name?.trim().split(/\s+/)[0] || user?.email || "")}, ${user?.status === "expired" ? "seu prazo terminou. Fale com a administração para renovar. Seu histórico foi preservado." : user?.status === "blocked" ? "fale com a administração para verificar seu acesso." : "sua conta aguarda aprovação da administração. Seus dados ficam separados dos demais usuários."}</p><button class="cloud-primary" id="account-check">Verificar acesso</button><button class="cloud-link" id="account-out">Sair da conta</button><p id="account-access-message" role="status"></p>`;
  aq("account-check").onclick = async () => {
    try {
      const d = await accountApi("/api/account");
      if (d.user) accountAccess(d.user);
      else location.reload();
    } catch (e) {
      aq("account-access-message").textContent = e.message;
    }
  };
  aq("account-out").onclick = async () => {
    try {
      await accountApi("/api/auth/logout", {});
      location.reload();
    } catch (e) {
      aq("account-access-message").textContent = e.message;
    }
  };
}
aq("account-login-tab").onclick = () => accountModeSet("login");
aq("account-signup-tab").onclick = () => accountModeSet("signup");
aq("account-recover").onclick = () => accountModeSet("recover");
aq("account-resend").onclick = () => accountModeSet("resend");
aq("account-form").onsubmit = async (e) => {
  e.preventDefault();
  if (accountSubmitting || aq("account-submit").disabled) return;
  const action = accountMode,
    key = accountCooldownKey();
  if (
    ["signup", "password"].includes(accountMode) &&
    aq("account-password").value !== aq("account-password-confirm").value
  ) {
    aq("account-message").textContent =
      "As senhas não coincidem. Confira a confirmação de senha.";
    aq("account-password-confirm").focus();
    return;
  }
  accountSubmitting = true;
  accountUpdateSubmit();
  aq("account-message").textContent = "Aguarde…";
  try {
    const payload =
      accountMode === "password"
        ? {
            password: aq("account-password").value,
            passwordConfirmation: aq("account-password-confirm").value,
          }
        : {
            email: aq("account-email").value.trim(),
            ...(["recover", "resend"].includes(accountMode)
              ? {}
              : { password: aq("account-password").value }),
            ...(accountMode === "signup"
              ? {
                  firstName: aq("account-name").value.trim(),
                  lastName: aq("account-last-name").value.trim(),
                  passwordConfirmation: aq("account-password-confirm").value,
                }
              : {}),
          };
    const d = await accountApi("/api/auth/" + action, payload);
    if (["signup", "recover", "resend"].includes(action))
      accountCooldowns.set(key, Date.now() + 60000);
    aq("account-password").value = "";
    aq("account-password-confirm").value = "";
    document
      .querySelectorAll(".account-password-toggle")
      .forEach((button) => accountPasswordVisibility(button, false));
    if (accountMode === "login") accountAccess(d.user);
    else if (accountMode === "password") {
      aq("account-message").textContent =
        "Senha atualizada. Você pode entrar com a nova senha.";
      accountModeSet("login", true);
      aq("account-message").textContent =
        "Senha atualizada. Entre com a nova senha.";
    } else aq("account-message").textContent = d.message;
  } catch (e) {
    aq("account-message").textContent = e.message;
    if (e.status === 429) {
      const seconds = Number.isFinite(e.retryAfterSeconds)
        ? Math.max(1, Math.min(e.retryAfterSeconds, 86400))
        : 60;
      accountCooldowns.set(key, Date.now() + seconds * 1000);
      if (e.code === "auth_email_rate_limit")
        accountMailPausedUntil = Date.now() + seconds * 1000;
    }
  } finally {
    accountSubmitting = false;
    accountUpdateSubmit();
  }
};
(async () => {
  try {
    const fragment = new URLSearchParams(location.hash.slice(1)),
      query = new URLSearchParams(location.search),
      recovery = (fragment.get("type") || query.get("type")) === "recovery",
      hash = query.get("token_hash"),
      token = fragment.get("access_token"),
      refresh = fragment.get("refresh_token");
    // Clear auth material from the address bar before making any other request.
    if (location.hash || location.search)
      history.replaceState({}, "", "/account");
    if (hash || token) {
      const d = await accountApi(
        hash ? "/api/auth/verify" : "/api/auth/exchange",
        hash
          ? { token_hash: hash, type: query.get("type") || "email" }
          : { access_token: token, refresh_token: refresh },
      );
      if (recovery) {
        accountModeSet("password");
        aq("account-message").textContent =
          "Crie uma nova senha para sua conta.";
      } else accountAccess(d.user);
      return;
    }
    const d = await accountApi("/api/account");
    if (d.user) {
      if (query.get("change_password") === "1") {
        accountModeSet("password");
        aq("account-message").textContent =
          "Crie uma nova senha para sua conta.";
      } else accountAccess(d.user);
    }
  } catch (e) {
    aq("account-message").textContent = e.message;
  }
})();
