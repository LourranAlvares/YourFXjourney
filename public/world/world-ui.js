(function (root) {
  "use strict";
  const e = (s) =>
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
  const icon = (r) =>
    typeof terminalIcon === "function"
      ? terminalIcon(
          { tools: "tools", community: "ins", achievements: "ins" }[r.id] ||
            r.id,
        )
      : r.icon;
  const routeLabel = (id) =>
    ({
      home: "Briefing / Início",
      dash: "Painel completo",
      trades: "Diário e importações",
      plan: "Trading Plan",
      analyst: "Análise de prints",
      economic: "Calendário econômico",
      risk: "Calculadoras de risco",
      achievements: "Conquistas e certificados",
      settings: "Conta e configurações",
      admin: "Administração",
      ana: "Análise histórica",
      ins: "Raio-X do Trader",
      cal: "Calendário",
      pat: "Padrões",
      str: "Estratégias",
      rev: "Revisões",
      share: "Calendário compartilhável",
    })[id] || id;
  function header() {
    return `<header class="smc-world-hud"><div><span class="smc-world-brand">SMC ELITE <b>WORLD</b></span><span class="smc-world-location" id="smc-world-location">Átrio · Recepção</span></div><nav aria-label="Navegação do World"><button data-world-action="lobby">Voltar ao World</button><button data-world-action="destinations">Salas e ferramentas</button><button data-world-action="help">Ajuda</button><button class="smc-world-exit" data-world-action="classic">Voltar ao modo clássico</button></nav></header><p id="smc-world-status" class="smc-world-status" role="status" aria-live="polite"></p>`;
  }
  function lobby(rooms, help) {
    return `<div class="smc-world-lobby"><div class="smc-world-intro"><div><span class="smc-world-eyebrow">SEU ESPAÇO DE TRADING</span><h1>Bem-vindo à sua empresa.</h1><p>Mesmo plano. Mesmo diário. Outra maneira de navegar.</p></div><button data-world-action="reset">Reposicionar avatar</button></div>${help ? `<aside class="smc-world-instructions"><span>Toque em uma sala para caminhar. Use WASD / setas e E para entrar. Prefere acesso direto? Use a lista de salas.</span><button data-world-action="dismiss-help" aria-label="Dispensar orientação">Entendi</button></aside>` : ""}<div class="smc-world-map-wrap"><div id="smc-world-map" class="smc-world-map"></div><div class="smc-world-signs">${rooms
      .map((r) => {
        const p = SMCWorldMap.project(r.x + r.w / 2, r.y + r.h / 2);
        return `<button class="smc-world-sign ${r.future ? "closed" : ""}" style="left:${p.x / 11}%;top:${(p.y - 62) / 6.5}%" data-world-walk="${r.id}" ${r.future ? "disabled" : ""}><span>${icon(r)}</span>${e(r.short)}${r.future ? "<small>Em desenvolvimento</small>" : ""}</button>`;
      })
      .join(
        "",
      )}</div><div class="smc-world-near" id="smc-world-near">Clique no piso para caminhar</div></div><div class="smc-world-access"><div><h2>Acesso direto às salas</h2><p>Entre com um clique, sem precisar caminhar.</p></div><div class="smc-world-room-list">${rooms.map((r) => `<button data-world-room="${r.id}" ${r.future ? "disabled" : ""}><span>${icon(r)}</span><span>${e(r.name)}${r.future ? "<small>Em desenvolvimento</small>" : ""}</span>${r.future ? "" : "<b>↗</b>"}</button>`).join("")}</div></div></div>`;
  }
  function room(room, route, admin) {
    return `<div class="smc-world-room-shell" data-world-room-id="${room.id}"><div class="smc-world-room-ambience" aria-hidden="true"><i></i><i></i><i></i><span>SMC ELITE / ${e(room.short)}</span></div><div class="smc-world-room-heading"><span class="smc-world-room-emblem">${icon(room)}</span><div><p>DEPARTAMENTO / ${e(room.short)}</p><h1>${e(room.name)}</h1><small>Ferramenta original · dados da sua conta</small></div></div><nav class="smc-world-room-routes" aria-label="Ferramentas desta sala">${room.routes
      .filter((r) => r !== "admin" || admin)
      .map(
        (r) =>
          `<button data-world-route="${r}" aria-current="${route === r ? "page" : "false"}">${e(routeLabel(r))}</button>`,
      )
      .join(
        "",
      )}</nav><div id="smc-world-workspace" class="smc-world-workspace"></div></div>`;
  }
  function destinations(rooms, admin) {
    return `<div class="smc-world-destinations"><h2>Salas e ferramentas</h2><p>As mesmas funções do modo clássico, sem sair do World.</p>${rooms
      .filter((r) => !r.future)
      .map(
        (r) =>
          `<section><h3>${e(r.name)}</h3>${r.routes
            .filter((id) => id !== "admin" || admin)
            .map(
              (id) =>
                `<button data-world-route="${id}">${e(routeLabel(id))}</button>`,
            )
            .join(
              "",
            )}${r.id === "tools" ? "<small>Importação, OCR e prints estão no Diário; exportações no Calendário compartilhável.</small>" : ""}</section>`,
      )
      .join(
        "",
      )}<p>Comunidade: em desenvolvimento. Sem feed ou transmissão nesta versão.</p></div>`;
  }
  root.SMCWorldUI = { e, header, lobby, room, destinations, routeLabel };
})(globalThis);
