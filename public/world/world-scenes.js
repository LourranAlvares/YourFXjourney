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
  const original = {
    header: SMCWorldUI.header,
    lobby: SMCWorldUI.lobby,
    room: SMCWorldUI.room,
  };
  const e = SMCWorldUI.e;
  const api = {
    enabled: false,
    stopClock() {
      clearInterval(api.clockTimer);
      api.clockTimer = null;
    },
    startClock() {
      api.stopClock();
      const update = () => {
        if (document.hidden) return;
        const clock = document.getElementById("world-live-clock");
        if (clock) clock.textContent = eliteClockText();
      };
      update();
      api.clockTimer = setInterval(update, 1000);
    },
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
      api.startClock();
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
  SMCWorldUI.header = () => {
    if (!api.enabled) return original.header();
    return `<header class="smc-world-hud smc-cinema-hud"><div class="world-hud-search"><button data-world-action="destinations" aria-label="Salas e ferramentas" title="Salas e ferramentas">☰</button><button class="world-search" data-world-action="search"><span>Busque trades por data ou ativo…</span><kbd>Ctrl + K</kbd></button></div><div class="world-hud-date"><span>${e(taDailyDate())}</span><b id="world-live-clock">${e(eliteClockText())}</b></div><nav aria-label="Navegação do World"><button data-world-action="lobby">Voltar ao World</button><button data-world-action="capital">Capital</button><button data-world-action="help">Como funciona?</button><button class="smc-world-exit" data-world-action="classic">Voltar ao modo clássico</button></nav><span class="sr-only" id="smc-world-location">Átrio · Recepção</span></header><p id="smc-world-status" class="smc-world-status" role="status" aria-live="polite"></p>`;
  };
  SMCWorldUI.lobby = (rooms, help) => {
    if (!api.enabled) return original.lobby(rooms, help);
    return `<div class="smc-world-lobby smc-cinema-lobby"><div class="smc-cinema-title"><div><p>SMC ELITE / SUA EMPRESA VIRTUAL</p><h1>SMC Elite World</h1><span>Escolha uma sala para acessar suas ferramentas.</span></div></div><div class="smc-cinema-stage" id="smc-world-map" tabindex="0" aria-label="Mapa de salas. Use Tab ou as setas para escolher e Enter para entrar.">${image("lobby.webp", "Átrio SMC Elite com salas envidraçadas, iluminação dourada e globo central")}
      <div class="smc-cinema-doors">${rooms.map((r) => `<button class="smc-cinema-door${r.future ? " closed" : ""}" style="--door-x:${doors[r.id][0]}%;--door-y:${doors[r.id][1]}%" data-world-walk="${r.id}" aria-label="${e(r.name)}" ${r.future ? "disabled" : ""}><span>${e(r.id === "settings" ? "Serviços" : r.future ? "Comunidade" : r.name)}</span>${r.future ? "<small>Em breve</small>" : "<small>Entrar</small>"}</button>`).join("")}<div class="smc-world-avatar smc-cinema-avatar" aria-hidden="true"><span class="smc-cinema-avatar-sprite"></span></div></div>
      ${help ? '<aside class="smc-cinema-welcome"><strong>Bem-vindo ao SMC Elite World</strong><p>Clique em uma sala. Seu plano, diário e ferramentas continuam os mesmos.</p><button data-world-action="dismiss-help">Entendi →</button></aside>' : ""}
      <div class="smc-cinema-hint" id="smc-world-near">Clique em uma sala para entrar · Tab / setas e Enter</div>
      </div><div class="smc-world-access"><h2>Acesso direto às salas</h2><div class="smc-world-room-list">${rooms.map((r) => `<button data-world-room="${r.id}" ${r.future ? "disabled" : ""}>${'<span aria-hidden="true">' + e(r.icon) + "</span><span>" + e(r.name) + (r.future ? "<small>Em desenvolvimento</small>" : "") + "</span>"}${r.future ? "" : "<b>↗</b>"}</button>`).join("")}</div><button class="smc-cinema-preview-link" data-world-action="community-preview">Ver ambiente da Comunidade · Em desenvolvimento</button></div></div>`;
  };
  SMCWorldUI.room = (room, route, admin) => {
    if (!api.enabled || !images[room.id])
      return original.room(room, route, admin);
    return `<div class="smc-world-room-shell smc-cinema-room" data-world-room-id="${room.id}">
      <div class="smc-world-room-heading"><div><p>SMC ELITE WORLD</p><h1>${e(room.name)}</h1><small>Painéis integrados ao ambiente · dados da sua conta</small></div></div>
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
  const walkingDoors = {
    dash: [35, 35],
    trades: [65, 35],
    plan: [80, 38],
    analyst: [26, 57],
    risk: [65, 55],
    economic: [80, 65],
    tools: [24, 77],
    achievements: [68, 80],
    settings: [50, 28],
  };
  const avatarTransform = (p) =>
    "translate(-50%,-100%) scale(" + (0.5 + p[1] * 0.006) + ")";
  function walkingPath(start, target) {
    const points = [
      [50, 84],
      [35, 72],
      [65, 72],
      [27, 63],
      [80, 64],
      [35, 35],
      [65, 35],
      [50, 28],
    ];
    const links = [
      [0, 1],
      [0, 2],
      [1, 3],
      [1, 5],
      [2, 4],
      [2, 6],
      [4, 6],
      [5, 7],
      [7, 6],
    ];
    const closest = (p) =>
      points.reduce(
        (best, q, i) =>
          Math.hypot(q[0] - p[0], q[1] - p[1]) <
          Math.hypot(points[best][0] - p[0], points[best][1] - p[1])
            ? i
            : best,
        0,
      );
    const from = closest(start),
      to = closest(target),
      distance = points.map(() => Infinity),
      previous = points.map(() => -1),
      open = new Set(points.map((_, i) => i));
    distance[from] = 0;
    while (open.size) {
      const current = [...open].reduce((a, b) =>
        distance[a] < distance[b] ? a : b,
      );
      open.delete(current);
      if (current === to) break;
      for (const [a, b] of links) {
        const next = a === current ? b : b === current ? a : -1;
        if (next < 0 || !open.has(next)) continue;
        const d =
          distance[current] +
          Math.hypot(
            points[current][0] - points[next][0],
            points[current][1] - points[next][1],
          );
        if (d < distance[next]) {
          distance[next] = d;
          previous[next] = current;
        }
      }
    }
    const path = [];
    for (let i = to; i >= 0; i = previous[i]) {
      path.unshift(points[i]);
      if (i === from) break;
    }
    const result = [start, ...path, target];
    return result.filter(
      (p, i) =>
        !i ||
        Math.hypot(p[0] - result[i - 1][0], p[1] - result[i - 1][1]) > 0.1,
    );
  }
  class SceneMap {
    constructor(host, rooms, options) {
      this.host = host;
      this.rooms = rooms;
      this.options = options;
      this.position = { ...options.position };
      this.imageScene = true;
      this.avatar = this.host.querySelector(".smc-cinema-avatar");
      const recent = rooms.find(
        (r) =>
          r.door[0] === options.position.x && r.door[1] === options.position.y,
      );
      this.visualPosition =
        recent && walkingDoors[recent.id] ? walkingDoors[recent.id] : [50, 80];
      this.placeAvatar(this.visualPosition);
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
      const target = walkingDoors[id],
        avatar = this.avatar;
      const route = walkingPath(this.visualPosition, target);
      this.host
        .querySelector('[data-world-walk="' + id + '"]')
        .classList.add("is-destination");
      this.options.onNear?.(room);
      const hint = this.host.querySelector("#smc-world-near");
      if (hint) hint.textContent = "Caminhando até " + room.name + "…";
      const enter = () => {
        this.visualPosition = target;
        this.placeAvatar(target);
        avatar.classList.remove("is-walking");
        this.position = { x: room.door[0], y: room.door[1] };
        this.options.onPosition?.(this.position);
        this.options.onEnter(id);
      };
      if (
        this.options.reduceMotion ||
        matchMedia("(prefers-reduced-motion: reduce)").matches ||
        !avatar.animate
      ) {
        this.timer = setTimeout(enter, 0);
        return;
      }
      const distances = [0];
      for (let i = 1; i < route.length; i++)
        distances.push(
          distances[i - 1] +
            Math.hypot(
              route[i][0] - route[i - 1][0],
              route[i][1] - route[i - 1][1],
            ),
        );
      const total = distances.at(-1) || 1;
      const frames = route.map((p, i) => ({
        left: p[0] + "%",
        top: p[1] + "%",
        transform: avatarTransform(p),
        offset: distances[i] / total,
      }));
      avatar.classList.add("is-walking");
      const animation = avatar.animate(frames, {
        duration: Math.max(500, Math.min(2200, total * 30)),
        easing: "linear",
        fill: "forwards",
      });
      this.animation = animation;
      animation.finished
        .then(() => {
          if (this.animation === animation) {
            this.animation = null;
            animation.cancel();
            enter();
          }
        })
        .catch(() => {});
    }
    placeAvatar(point) {
      this.avatar.style.left = point[0] + "%";
      this.avatar.style.top = point[1] + "%";
      this.avatar.style.transform = avatarTransform(point);
    }
    stop() {
      clearTimeout(this.timer);
      this.timer = null;
      if (this.animation) {
        const box = this.avatar.getBoundingClientRect(),
          stage = this.host
            .querySelector(".smc-cinema-doors")
            .getBoundingClientRect();
        if (stage.width && stage.height)
          this.visualPosition = [
            ((box.left + box.width / 2 - stage.left) / stage.width) * 100,
            ((box.bottom - stage.top) / stage.height) * 100,
          ];
        this.animation.cancel();
        this.animation = null;
        this.placeAvatar(this.visualPosition);
      }
      this.avatar?.classList.remove("is-walking");
      this.host
        .querySelector(".is-destination")
        ?.classList.remove("is-destination");
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
