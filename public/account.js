"use strict";
let accountMode = "login",
  accountCsrf = "";
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
async function accountApi(path, data) {
  const r = await fetch(path, {
    method: data ? "POST" : "GET",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      ...(accountCsrf ? { "X-CSRF-Token": accountCsrf } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const d = await r.json();
  if (!r.ok)
    throw Error(
      d.error?.message || "Não foi possível conectar. Tente novamente.",
    );
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
function accountModeSet(mode) {
  accountMode = mode;
  document.querySelector("#account-content h2").textContent = {
    login: "Bem-vindo ao EliteX",
    signup: "Crie sua conta",
    recover: "Recuperar acesso",
    password: "Nova senha",
  }[mode];
  document.querySelector(".account-tabs").hidden = mode === "password";
  aq("account-recover").hidden = mode === "password";
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
  aq("account-password-label").hidden = mode === "recover";
  aq("account-password").required = mode !== "recover";
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
}
function accountAccess(user) {
  if (user?.status === "active") {
    location.replace("/");
    return;
  }
  aq("account-content").hidden = true;
  aq("account-access").hidden = false;
  aq("account-access").innerHTML =
    `<h2>${user?.status === "blocked" ? "Acesso bloqueado" : "Cadastro recebido"}</h2><p>${safe(user?.firstName || user?.name?.trim().split(/\s+/)[0] || user?.email || "")}, ${user?.status === "blocked" ? "fale com a administração para verificar seu acesso." : "sua conta aguarda aprovação da administração. Seus dados ficam separados dos demais usuários."}</p><button class="cloud-primary" id="account-check">Verificar acesso</button><button class="cloud-link" id="account-out">Sair da conta</button><p id="account-access-message" role="status"></p>`;
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
aq("account-form").onsubmit = async (e) => {
  e.preventDefault();
  if (
    ["signup", "password"].includes(accountMode) &&
    aq("account-password").value !== aq("account-password-confirm").value
  ) {
    aq("account-message").textContent =
      "As senhas não coincidem. Confira a confirmação de senha.";
    aq("account-password-confirm").focus();
    return;
  }
  aq("account-submit").disabled = true;
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
            ...(accountMode === "recover"
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
    const d = await accountApi("/api/auth/" + accountMode, payload);
    aq("account-password").value = "";
    aq("account-password-confirm").value = "";
    document
      .querySelectorAll(".account-password-toggle")
      .forEach((button) => accountPasswordVisibility(button, false));
    if (accountMode === "login") accountAccess(d.user);
    else if (accountMode === "password") {
      aq("account-message").textContent =
        "Senha atualizada. Você pode entrar com a nova senha.";
      accountModeSet("login");
      aq("account-message").textContent =
        "Senha atualizada. Entre com a nova senha.";
    } else aq("account-message").textContent = d.message;
  } catch (e) {
    aq("account-message").textContent = e.message;
  } finally {
    aq("account-submit").disabled = false;
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
