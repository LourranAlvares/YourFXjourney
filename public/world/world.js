(function (root) {
  "use strict";
  class World {
    constructor(bridge) {
      this.bridge = bridge;
      this.owner = K;
      this.room = null;
      this.active = false;
      this.map = null;
      this.drafts = new Map();
      this.originalParent = document.getElementById("main").parentNode;
      this.anchor = document.createComment("classic-main-anchor");
      this.originalParent.insertBefore(
        this.anchor,
        document.getElementById("main"),
      );
      this.key = "smc-elite-world-ui-v1:" + K;
      this.position = { x: 384, y: 336 };
      this.help = true;
      this.reduceMotion = false;
      try {
        const ui = JSON.parse(localStorage.getItem(this.key) || "null");
        if (ui && Number.isFinite(ui.x) && Number.isFinite(ui.y))
          this.position = { x: ui.x, y: ui.y };
        if (ui?.help === false) this.help = false;
        this.reduceMotion = ui?.reduceMotion === true;
      } catch {}
      this.root = document.createElement("section");
      this.root.id = "smc-world";
      this.root.className = "smc-world";
      this.root.setAttribute("aria-label", "SMC Elite World");
      this.root.classList.toggle("smc-world-motion-reduced", this.reduceMotion);
      this.root.hidden = true;
      document.body.append(this.root);
      this.onClick = (event) => {
        const button = event.target.closest("button");
        if (!button) return;
        const action = button.dataset.worldAction;
        if (action === "classic") this.exit();
        if (action === "lobby") this.lobby();
        if (action === "destinations") this.showDestinations();
        if (action === "help") this.showHelp();
        if (action === "camera") this.map?.changeView?.();
        if (action === "reset") {
          this.position = { x: 384, y: 336 };
          this.saveUI();
          this.lobby();
        }
        if (action === "dismiss-help") {
          this.help = false;
          this.saveUI();
          this.lobby();
        }
        if (button.dataset.worldRoom) this.open(button.dataset.worldRoom);
        if (button.dataset.worldWalk)
          this.map?.walkTo(button.dataset.worldWalk);
        if (button.dataset.worldRoute) this.navigate(button.dataset.worldRoute);
      };
      this.root.addEventListener("click", this.onClick);
      this.onEscape = (event) => {
        if (
          event.key !== "Escape" ||
          event.defaultPrevented ||
          !this.active ||
          document.querySelector("dialog[open]") ||
          event.target.closest("input,textarea,select,[contenteditable=true]")
        )
          return;
        if (this.room) {
          event.preventDefault();
          this.lobby();
        }
      };
      document.addEventListener("keydown", this.onEscape);
      this.onPageHide = () => this.map?.stop();
      window.addEventListener("pagehide", this.onPageHide);
    }
    isAdmin() {
      return (
        CLOUD_BOOT &&
        eliteCloud.ready &&
        eliteCloud.user?.status === "active" &&
        eliteCloud.user?.role === "admin"
      );
    }
    canUse() {
      return (
        K === this.owner &&
        (!CLOUD_BOOT ||
          (eliteCloud.ready && eliteCloud.user?.status === "active"))
      );
    }
    blocked() {
      if (document.querySelector("dialog[open]")) {
        this.status("Conclua ou feche o diálogo aberto antes de alternar.");
        return true;
      }
      return false;
    }
    status(text) {
      const node = document.getElementById("smc-world-status");
      if (node) node.textContent = text;
    }
    saveUI() {
      try {
        localStorage.setItem(
          this.key,
          JSON.stringify({
            x: Math.round(this.position.x),
            y: Math.round(this.position.y),
            help: this.help,
            reduceMotion: this.reduceMotion,
          }),
        );
      } catch {}
    }
    park() {
      const main = document.getElementById("main");
      if (main.parentNode !== this.originalParent)
        this.originalParent.insertBefore(main, this.anchor.nextSibling);
    }
    formFields(main) {
      return [
        ...main.querySelectorAll(
          "input:not([type=file]):not([type=password]),textarea,select",
        ),
      ].filter((n) => !n.closest(".smc-filters-disclosure"));
    }
    remember() {
      const main = document.getElementById("main"),
        fields = this.formFields(main).map((n, i) => ({
          id: n.id,
          index: i,
          value: n.value,
          checked: n.checked,
          type: n.type,
        })),
        details = [...main.querySelectorAll("details")].map((n) => n.open);
      this.drafts.set(tab, {
        fields,
        details,
        criteriaHTML:
          tab === "plan"
            ? main.querySelector("#ta-plan-criteria")?.innerHTML
            : null,
        planVersion: taCurrentPlan()?.version,
        scroll: window.scrollY,
      });
    }
    restore(route) {
      const draft = this.drafts.get(route);
      if (
        !draft ||
        (route === "plan" && draft.planVersion !== taCurrentPlan()?.version)
      )
        return;
      const main = document.getElementById("main");
      if (route === "plan" && typeof draft.criteriaHTML === "string") {
        const criteria = main.querySelector("#ta-plan-criteria");
        if (criteria) criteria.innerHTML = draft.criteriaHTML;
      }
      const nodes = this.formFields(main);
      for (const field of draft.fields) {
        const n = field.id
          ? nodes.find((n) => n.id === field.id)
          : nodes[field.index];
        if (n && n.type === field.type) {
          n.value = field.value;
          if (["checkbox", "radio"].includes(field.type))
            n.checked = field.checked;
        }
      }
      main.querySelectorAll("details").forEach((n, i) => {
        if (draft.details[i] !== undefined) n.open = draft.details[i];
      });
    }
    enter() {
      if (this.active || this.blocked() || !this.canUse()) return;
      if (typeof eliteMobileClose === "function") eliteMobileClose(false);
      this.classicRoute = tab;
      this.active = true;
      document.body.classList.add("smc-world-active");
      this.root.hidden = false;
      this.lobby();
    }
    render(content) {
      this.root.setAttribute("role", this.room ? "region" : "main");
      this.park();
      this.root.innerHTML =
        SMCWorldUI.header() + `<div id="smc-world-content">${content}</div>`;
      this.root.querySelector("[data-world-action=lobby]").hidden = !this.room;
      this.root.querySelector("#smc-world-location").textContent = this.room
        ? SMCWorldRooms.find(this.room).name
        : "Átrio · Recepção";
    }
    lobby() {
      if (!this.active || this.blocked()) return;
      this.remember();
      this.map?.destroy();
      this.map = null;
      this.room = null;
      try {
        this.render(SMCWorldUI.lobby(SMCWorldRooms.rooms, this.help));
        const createMap = (Controller) =>
          new Controller(
            this.root.querySelector("#smc-world-map"),
            SMCWorldRooms.rooms,
            {
              position: this.position,
              reduceMotion: this.reduceMotion,
              onGraphicsLost: () => {
                this.graphicsFallback = true;
                this.lobby();
              },
              onEnter: (id) => this.open(id),
              onPosition: (p) => {
                this.position = { ...p };
                this.saveUI();
              },
              onNear: (r) => {
                const n = document.getElementById("smc-world-near");
                if (n)
                  n.textContent = r
                    ? "E / Enter · " + r.name
                    : "Clique no piso para caminhar";
              },
            },
          );
        try {
          this.map = createMap(
            window.SMCWorld3D && !this.graphicsFallback
              ? SMCWorld3D
              : SMCWorldMap.MapController,
          );
        } catch {
          this.map = createMap(SMCWorldMap.MapController);
          this.status(
            "Modo compatível ativo: o dispositivo não disponibilizou a cena 3D.",
          );
        }
        this.sceneLayout = this.map.rooms;
        if (!this.map.renderer)
          this.status(
            "Modo compatível 2.5D: a cena WebGL não está disponível neste ambiente. Todas as salas continuam acessíveis.",
          );
        this.root.querySelector("h1")?.setAttribute("tabindex", "-1");
        this.root.querySelector("h1")?.focus({ preventScroll: true });
        window.scrollTo(0, 0);
      } catch (error) {
        this.fail(error);
      }
    }
    open(id) {
      const room = SMCWorldRooms.find(id);
      if (!room || room.future || !this.canUse()) return;
      this.navigate(
        room.routes.find((r) => SMCWorldRooms.allowed(r, this.isAdmin())),
        room.id,
      );
    }
    navigate(route, roomId = null) {
      if (
        !this.active ||
        !this.canUse() ||
        this.blocked() ||
        !SMCWorldRooms.allowed(route, this.isAdmin())
      )
        return false;
      const room =
        SMCWorldRooms.find(roomId) ||
        (this.room && SMCWorldRooms.find(this.room).routes.includes(route)
          ? SMCWorldRooms.find(this.room)
          : SMCWorldRooms.forRoute(route));
      if (!room || room.future) return false;
      this.remember();
      this.map?.destroy();
      this.map = null;
      this.room = room.id;
      const effectiveRoom =
        this.sceneLayout?.find((r) => r.id === room.id) || room;
      this.position = { x: effectiveRoom.door[0], y: effectiveRoom.door[1] };
      this.saveUI();
      try {
        this.render(SMCWorldUI.room(room, route, this.isAdmin()));
        this.root
          .querySelector("#smc-world-workspace")
          .append(document.getElementById("main"));
        this.pendingRestore = route;
        this.bridge.go(route);
        this.root
          .querySelector(".smc-world-room-heading h1")
          ?.setAttribute("tabindex", "-1");
        this.root
          .querySelector(".smc-world-room-heading h1")
          ?.focus({ preventScroll: true });
        window.scrollTo(0, 0);
        return true;
      } catch (error) {
        this.fail(error);
        return false;
      }
    }
    attach() {
      if (!this.active || !this.room) return;
      const host = this.root.querySelector("#smc-world-workspace");
      if (!host) return;
      host.append(document.getElementById("main"));
      if (this.pendingRestore) {
        this.restore(this.pendingRestore);
        this.pendingRestore = null;
      }
      this.root
        .querySelectorAll("[data-world-route]")
        .forEach((n) =>
          n.setAttribute(
            "aria-current",
            n.dataset.worldRoute === tab ? "page" : "false",
          ),
        );
      if (tab === "dash" && typeof panelFitChart === "function")
        panelFitChart();
    }
    afterRender() {
      if (!this.active) return;
      if (!this.canUse()) {
        this.exit(true);
        this.drafts.clear();
        return;
      }
      this.attach();
    }
    showDestinations() {
      if (this.blocked()) return;
      const dialog = growthDialog(
        "Destinos do SMC Elite World",
        SMCWorldUI.destinations(SMCWorldRooms.rooms, this.isAdmin()),
      );
      dialog.querySelectorAll("[data-world-route]").forEach(
        (n) =>
          (n.onclick = () => {
            dialog.close();
            this.navigate(n.dataset.worldRoute);
          }),
      );
    }
    showHelp() {
      if (this.blocked()) return;
      const dialog = growthDialog(
        "Como navegar no World",
        "<p>WASD ou setas movem o avatar. Perto de uma porta, use E ou Enter. Toque na placa da sala para caminhar e entrar. Use a lista de salas para acesso imediato.</p><p>Escape retorna ao átrio quando não há formulário em foco ou diálogo aberto. Os botões de retorno estão sempre no topo. A preferência de movimento reduzido do dispositivo é respeitada.</p><p>As ferramentas são as mesmas do clássico. Não existem pontos, XP ou resultados de exemplo.</p>",
      );
      const label = document.createElement("label");
      label.className = "growth-checkbox";
      label.innerHTML =
        '<input type="checkbox" id="smc-world-motion"> Reduzir movimento no World';
      const checkbox = label.querySelector("input");
      checkbox.checked = this.reduceMotion;
      checkbox.onchange = () => {
        this.reduceMotion = checkbox.checked;
        this.root.classList.toggle(
          "smc-world-motion-reduced",
          this.reduceMotion,
        );
        this.saveUI();
        if (this.map) {
          this.map.options.reduceMotion = this.reduceMotion;
          this.map.stop();
        }
      };
      dialog.append(label);
    }
    exit(force = false) {
      if (!force && this.blocked()) return;
      if (!force && this.active) this.remember();
      this.map?.destroy();
      this.map = null;
      this.park();
      this.active = false;
      this.room = null;
      this.root.hidden = true;
      document.body.classList.remove("smc-world-active");
      if (!force && this.canUse()) {
        const route = this.classicRoute || "home";
        if (tab !== route) {
          this.pendingClassicRestore = route;
          this.bridge.go(route);
          this.restore(route);
        } else {
          if (tab === "dash" && typeof panelFitChart === "function")
            panelFitChart();
        }
        document
          .getElementById("smc-world-enter")
          ?.focus({ preventScroll: true });
      }
    }
    fail(error) {
      this.map?.destroy();
      this.map = null;
      this.park();
      this.room = null;
      this.root.innerHTML =
        SMCWorldUI.header() +
        '<div class="smc-world-error"><h1>Não foi possível abrir este ambiente</h1><p>Seus dados continuam no workspace original. Volte ao modo clássico para continuar.</p></div>';
      this.status("Falha na cena. O retorno ao clássico permanece disponível.");
      console.warn("SMC World scene unavailable:", error?.message);
    }
    dispose() {
      this.exit(true);
      document.removeEventListener("keydown", this.onEscape);
      window.removeEventListener("pagehide", this.onPageHide);
      this.root.remove();
      this.anchor.remove();
      this.drafts.clear();
    }
  }
  root.SMCWorldController = World;
})(globalThis);
