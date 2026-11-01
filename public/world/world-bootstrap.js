/* Small, data-free bridge. Heavy scene code/styles load only after explicit entry. */
(function () {
  "use strict";
  const meta = document.querySelector('meta[name="smc-world-enabled"]'),
    enabled = meta
      ? meta.content === "true"
      : location.protocol === "file:" ||
        ["localhost", "127.0.0.1"].includes(location.hostname);
  if (!enabled) return;
  const baseR = R,
    baseGo = taGo;
  let world = null,
    loading = null,
    styleReady = false;
  function allowed() {
    return (
      !CLOUD_BOOT ||
      (typeof eliteCloud !== "undefined" &&
        eliteCloud.ready &&
        eliteCloud.user?.status === "active")
    );
  }
  function button() {
    if (
      !allowed() ||
      world?.active ||
      tab !== "home" ||
      document.getElementById("smc-world-enter")
    )
      return;
    const host = document.querySelector(".smc-home .scene-greeting");
    if (!host) return;
    const b = document.createElement("button");
    b.id = "smc-world-enter";
    b.className = "b s";
    b.style.cssText =
      "margin-top:14px;display:inline-flex;align-items:center;gap:8px;font-size:12px;max-width:100%;white-space:normal";
    b.textContent = "Entrar no SMC Elite World";
    b.onclick = enter;
    host.append(b);
  }
  function load() {
    if (window.SMCWorldController) return Promise.resolve();
    if (loading) return loading;
    loading = (async () => {
      if (!window.SMC_WORLD_EMBEDDED) {
        if (!styleReady)
          await new Promise((resolve, reject) => {
            const l = document.createElement("link");
            l.rel = "stylesheet";
            l.href = "public/world/world.css";
            l.onload = () => {
              styleReady = true;
              resolve();
            };
            l.onerror = () => {
              l.remove();
              reject(Error("Falha ao carregar o estilo World."));
            };
            document.head.append(l);
          });
        for (const name of ["world-rooms", "world-map", "world-ui", "world"])
          await new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "public/world/" + name + ".js";
            s.onload = resolve;
            s.onerror = () => {
              s.remove();
              reject(Error("Falha ao carregar o World."));
            };
            document.body.append(s);
          });
      }
    })().catch((e) => {
      loading = null;
      throw e;
    });
    return loading;
  }
  async function enter() {
    if (!allowed() || document.querySelector("dialog[open]")) return;
    const b = document.getElementById("smc-world-enter");
    if (b) {
      b.disabled = true;
      b.textContent = "Abrindo SMC Elite World…";
    }
    try {
      await load();
      if (!allowed()) return;
      if (world && world.owner !== K) {
        world.dispose();
        world = null;
      }
      if (!world) world = new SMCWorldController({ go: baseGo });
      world.enter();
    } catch (e) {
      if (b) {
        b.textContent = "Tentar abrir SMC Elite World";
        b.title = e.message;
      }
    } finally {
      if (b) {
        b.disabled = false;
        if (world?.active) b.textContent = "Entrar no SMC Elite World";
      }
    }
  }
  R = function () {
    if (world && !world.canUse()) {
      world.dispose();
      world = null;
    }
    if (world?.active && !world.room) return;
    try {
      const result = baseR();
      world?.afterRender();
      button();
      return result;
    } catch (error) {
      if (world?.active) {
        world.fail(error);
        return;
      }
      throw error;
    }
  };
  taGo = function (route) {
    if (world?.active) return world.navigate(route);
    const result = baseGo(route);
    if (world?.canUse()) world.restore(route);
    return result;
  };
  window.SMCWorld = {
    enter,
    get controller() {
      return world;
    },
    get enabled() {
      return enabled;
    },
    exit: () => world?.exit(),
  };
})();
