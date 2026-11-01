/* Image-led presentation only: original router, forms, permissions and state are reused. */
(function (root) {
  "use strict";
  const assets = "public/world/assets/";
  const images = {
    dash: "panel.webp",
    trades: "journal.webp",
    plan: "plan.webp",
    analyst: "analyst.webp",
    risk: "risk.webp",
    economic: "news.webp",
    tools: "tools.webp",
    achievements: "achievements.webp",
  };
  // Percent coordinates belong to the architectural viewport, never the browser.
  const doors = {
    dash: [30, 17],
    trades: [68, 18],
    plan: [85, 19],
    analyst: [15, 36],
    risk: [70, 38],
    economic: [88, 46],
    tools: [12, 58],
    community: [32, 61],
    achievements: [71, 63],
    settings: [50, 22],
  };
  const original = { lobby: SMCWorldUI.lobby, room: SMCWorldUI.room };
  const e = SMCWorldUI.e;
  const api = {
    enabled: false,
    async prepare() {
      const image = new Image();
      image.src = assets + "lobby.webp";
      let timer;
      try {
        await Promise.race([
          image.decode(),
          new Promise((_, reject) => {
            timer = setTimeout(
              () => reject(Error("Cenário indisponível")),
              7000,
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
      api.enabled = true;
    },
    decorate(host, room) {
      document.body.classList.toggle("smc-world-cinematic", api.enabled);
      if (!api.enabled) return;
      for (const image of host.querySelectorAll(".smc-cinema-image")) {
        image.addEventListener(
          "error",
          () => {
            image.hidden = true;
            host
              .querySelector(".smc-cinema-stage")
              ?.classList.add("image-unavailable");
            host.querySelector(".smc-cinema-image-error").hidden = false;
          },
          { once: true },
        );
      }
      const workspace = host.querySelector("#smc-world-workspace");
      const shell = host.querySelector(".smc-cinema-room");
      if (!workspace || !shell) return;
      const fit = () => {
        if (typeof panelFitChart === "function" && tab === "dash")
          requestAnimationFrame(() => panelFitChart());
      };
      host.querySelector("[data-cinema-expand]").onclick = (event) => {
        workspace.hidden = false;
        const expanded = shell.classList.toggle("is-expanded");
        event.currentTarget.setAttribute("aria-pressed", String(expanded));
        event.currentTarget.textContent = expanded
          ? "Restaurar ambiente"
          : "Ampliar área de trabalho";
        const environment = host.querySelector("[data-cinema-environment]");
        environment.setAttribute("aria-expanded", "true");
        environment.textContent = "Ver só o ambiente";
        fit();
      };
      host.querySelector("[data-cinema-environment]").onclick = (event) => {
        workspace.hidden = !workspace.hidden;
        event.currentTarget.setAttribute(
          "aria-expanded",
          String(!workspace.hidden),
        );
        event.currentTarget.textContent = workspace.hidden
          ? "Abrir ferramenta"
          : "Ver só o ambiente";
        fit();
      };
    },
  };
  function image(file, label) {
    return `<img class="smc-cinema-image" src="${assets + file}" alt="${e(label)}" decoding="async"><p class="smc-cinema-image-error" hidden>O cenário não carregou. As ferramentas e os botões de retorno continuam disponíveis.</p>`;
  }
  SMCWorldUI.lobby = (rooms, help) => {
    if (!api.enabled) return original.lobby(rooms, help);
    return `<div class="smc-world-lobby smc-cinema-lobby"><div class="smc-cinema-title"><div><p>SMC ELITE / SUA EMPRESA VIRTUAL</p><h1>SMC Elite World</h1><span>Escolha uma sala para acessar suas ferramentas.</span></div></div><div class="smc-cinema-stage" id="smc-world-map" tabindex="0" aria-label="Mapa de salas. Use Tab ou as setas para escolher e Enter para entrar.">${image("lobby.webp", "Átrio SMC Elite com salas envidraçadas, iluminação dourada e globo central")}
      <div class="smc-cinema-doors">${rooms.map((r) => `<button class="smc-cinema-door${r.future ? " closed" : ""}" style="--door-x:${doors[r.id][0]}%;--door-y:${doors[r.id][1]}%" data-world-walk="${r.id}" aria-label="${e(r.name)}" ${r.future ? "disabled" : ""}><span>${e(r.id === "settings" ? "Serviços" : r.future ? "Comunidade" : r.name)}</span>${r.future ? "<small>Em breve</small>" : "<small>Entrar</small>"}</button>`).join("")}</div>
      <span class="smc-cinema-arrival" aria-hidden="true"></span>
      ${help ? '<aside class="smc-cinema-welcome"><strong>Bem-vindo ao SMC Elite World</strong><p>Clique em uma sala. Seu plano, diário e ferramentas continuam os mesmos.</p><button data-world-action="dismiss-help">Entendi →</button></aside>' : ""}
      <div class="smc-cinema-hint" id="smc-world-near">Clique em uma sala para entrar · Tab / setas e Enter</div>
      </div><div class="smc-world-access"><h2>Acesso direto às salas</h2><div class="smc-world-room-list">${rooms.map((r) => `<button data-world-room="${r.id}" ${r.future ? "disabled" : ""}>${'<span aria-hidden="true">' + e(r.icon) + "</span><span>" + e(r.name) + (r.future ? "<small>Em desenvolvimento</small>" : "") + "</span>"}${r.future ? "" : "<b>↗</b>"}</button>`).join("")}</div><button class="smc-cinema-preview-link" data-world-action="community-preview">Ver ambiente da Comunidade · Em desenvolvimento</button></div></div>`;
  };
  SMCWorldUI.room = (room, route, admin) => {
    if (!api.enabled || !images[room.id])
      return original.room(room, route, admin);
    return `<div class="smc-world-room-shell smc-cinema-room" data-world-room-id="${room.id}">
      <div class="smc-world-room-heading"><div><p>SMC ELITE WORLD</p><h1>${e(room.name)}</h1><small>Seu workspace · mesmos dados e ferramentas</small></div></div>
      <div class="smc-cinema-stage">${image(images[room.id], room.name + ": interior com arquitetura e iluminação da referência")}
        <div id="smc-world-workspace" class="smc-world-workspace" role="region" aria-label="Área de trabalho: ${e(room.name)}" tabindex="0"></div>
      </div><div class="smc-cinema-toolbar"><nav class="smc-world-room-routes" aria-label="Ferramentas desta sala">${room.routes
        .filter((r) => r !== "admin" || admin)
        .map(
          (r) =>
            `<button data-world-route="${r}" aria-current="${r === route ? "page" : "false"}">${e(SMCWorldUI.routeLabel(r))}</button>`,
        )
        .join(
          "",
        )}</nav><div><button data-cinema-expand aria-controls="smc-world-workspace" aria-pressed="false">Ampliar área de trabalho</button><button data-cinema-environment aria-controls="smc-world-workspace" aria-expanded="true">Ver só o ambiente</button></div></div></div>`;
  };
  api.futureRoom = (
    room,
  ) => `<div class="smc-world-room-shell smc-cinema-room smc-cinema-future" data-world-room-id="${room.id}">
    <div class="smc-world-room-heading"><div><p>PRÉVIA DO AMBIENTE / EM DESENVOLVIMENTO</p><h1>Comunidade</h1><small>Esta área ainda não oferece rede social, chat ou transmissões.</small></div></div>
    <div class="smc-cinema-stage">${image("community.webp", "Ambiente conceitual da futura Comunidade SMC Elite")}
      <aside class="smc-cinema-future-note"><strong>Comunidade · Em desenvolvimento</strong><p>Prévia visual do espaço. Perfis, publicações e transmissões ainda não estão disponíveis.</p><button data-world-action="lobby">Voltar às salas</button></aside>
    </div></div>`;
  class SceneMap {
    constructor(host, rooms, options) {
      this.host = host;
      this.rooms = rooms;
      this.options = options;
      this.position = { ...options.position };
      this.imageScene = true;
      this.timer = null;
      this.onKey = (event) => {
        if (
          event.defaultPrevented ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          document.querySelector("dialog[open]")
        )
          return;
        if (!this.host.contains(event.target)) return;
        const buttons = [
          ...this.host.querySelectorAll("[data-world-walk]:not(:disabled)"),
        ];
        const index = buttons.indexOf(document.activeElement);
        const delta = {
          ArrowLeft: -1,
          ArrowUp: -1,
          a: -1,
          w: -1,
          ArrowRight: 1,
          ArrowDown: 1,
          d: 1,
          s: 1,
        }[event.key];
        if (delta) {
          event.preventDefault();
          buttons[
            (Math.max(0, index) + delta + buttons.length) % buttons.length
          ]?.focus({ preventScroll: true });
        } else if (
          ["e", "E"].includes(event.key) ||
          (event.key === "Enter" && index < 0)
        ) {
          event.preventDefault();
          this.walkTo(buttons[Math.max(0, index)]?.dataset.worldWalk);
        }
      };
      this.host.addEventListener("keydown", this.onKey);
      this.onHidden = () => {
        if (document.hidden) this.stop();
      };
      document.addEventListener("visibilitychange", this.onHidden);
    }
    walkTo(id) {
      const room = this.rooms.find((r) => r.id === id);
      if (!room || room.future) return;
      this.stop();
      const mark = this.host.querySelector(".smc-cinema-arrival");
      const coords = doors[id];
      mark.style.setProperty("--arrival-x", coords[0] + "%");
      mark.style.setProperty("--arrival-y", coords[1] + "%");
      mark.classList.add("is-entering");
      this.options.onNear?.(room);
      this.timer = setTimeout(
        () => {
          this.position = { x: room.door[0], y: room.door[1] };
          this.options.onPosition?.(this.position);
          this.options.onEnter(id);
        },
        this.options.reduceMotion ||
          matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 240,
      );
    }
    stop() {
      clearTimeout(this.timer);
      this.timer = null;
      this.host
        .querySelector(".smc-cinema-arrival")
        ?.classList.remove("is-entering");
    }
    destroy() {
      this.stop();
      this.host.removeEventListener("keydown", this.onKey);
      document.removeEventListener("visibilitychange", this.onHidden);
    }
  }
  api.MapController = SceneMap;
  root.SMCWorldScenes = api;
})(globalThis);
