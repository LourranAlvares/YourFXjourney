(function (root) {
  "use strict";
  const step = 16,
    project = (x, y) => ({ x: 460 + (x - y) * 0.7, y: 70 + (x + y) * 0.36 }),
    unproject = (x, y) => ({
      x: ((x - 460) / 0.7 + (y - 70) / 0.36) / 2,
      y: ((y - 70) / 0.36 - (x - 460) / 0.7) / 2,
    });
  function walkable(x, y, rooms) {
    return (
      x >= 16 &&
      x <= 752 &&
      y >= 16 &&
      y <= 560 &&
      !rooms.some(
        (r) =>
          x >= r.x - 8 &&
          x <= r.x + r.w + 8 &&
          y >= r.y - 8 &&
          y <= r.y + r.h + 8,
      )
    );
  }
  function path(from, to, rooms) {
    const snap = (v) => Math.round(v / step) * step,
      start = [snap(from.x), snap(from.y)],
      end = [snap(to.x), snap(to.y)],
      key = (a) => a.join(","),
      q = [start],
      prev = new Map([[key(start), null]]);
    if (!walkable(...end, rooms)) return [];
    for (let i = 0; i < q.length && i < 2000; i++) {
      const a = q[i];
      if (key(a) === key(end)) {
        const out = [];
        let k = key(a);
        while (prev.get(k) !== null) {
          const [x, y] = k.split(",").map(Number);
          out.unshift({ x, y });
          k = prev.get(k);
        }
        return out;
      }
      for (const [dx, dy] of [
        [step, 0],
        [-step, 0],
        [0, step],
        [0, -step],
      ]) {
        const b = [a[0] + dx, a[1] + dy],
          k = key(b);
        if (!prev.has(k) && walkable(...b, rooms)) {
          prev.set(k, key(a));
          q.push(b);
        }
      }
    }
    return [];
  }
  function scene(rooms) {
    const p = (x, y, z = 0) => {
        const v = project(x, y);
        return `${v.x},${v.y - z}`;
      },
      poly = (points, fill, stroke = "#715d36") =>
        `<polygon points="${points.join(" ")}" fill="${fill}" stroke="${stroke}" stroke-width="1.1"/>`;
    let s = `<svg class="smc-world-scene" viewBox="0 0 1100 650" aria-label="Edifício isométrico SMC Elite" role="img"><defs><linearGradient id="wwfloor" x2="1" y2="1"><stop stop-color="#24282c"/><stop offset="1" stop-color="#0d1219"/></linearGradient><radialGradient id="wwglow"><stop stop-color="#d9b76e" stop-opacity=".22"/><stop offset="1" stop-color="#d9b76e" stop-opacity="0"/></radialGradient></defs><ellipse cx="500" cy="390" rx="470" ry="240" fill="url(#wwglow)"/>`;
    s += poly([p(0, 0), p(768, 0), p(768, 576), p(0, 576)], "url(#wwfloor)");
    s += poly(
      [p(0, 576), p(768, 576), p(768, 576, -22), p(0, 576, -22)],
      "#080c11",
    );
    s += poly(
      [p(768, 0), p(768, 576), p(768, 576, -22), p(768, 0, -22)],
      "#121821",
    );
    for (let x = 0; x <= 768; x += 32)
      s += `<path d="M${p(x, 0)} L${p(x, 576)}" stroke="#d7b879" opacity=".075"/>`;
    for (let y = 0; y <= 576; y += 32)
      s += `<path d="M${p(0, y)} L${p(768, y)}" stroke="#d7b879" opacity=".075"/>`;
    for (const r of rooms) {
      const { x, y, w, h } = r;
      s += `<g class="smc-world-building" data-building="${r.id}">`;
      s += poly(
        [p(x, y, 65), p(x + w, y, 65), p(x + w, y), p(x, y)],
        "#222b36",
      );
      s += poly(
        [p(x, y, 65), p(x, y + h, 65), p(x, y + h), p(x, y)],
        "#18222c",
      );
      s += poly(
        [p(x, y), p(x + w, y), p(x + w, y + h), p(x, y + h)],
        "#1c252b",
      );
      for (let k = 0; k < 3; k++) {
        const xx = x + 18 + (k * (w - 30)) / 3,
          yy = y + 25;
        s += poly(
          [
            p(xx, yy, 19),
            p(xx + 24, yy, 19),
            p(xx + 24, yy + 22, 19),
            p(xx, yy + 22, 19),
          ],
          "#33414a",
        );
        s += `<path d="M${p(xx + 3, yy + 3, 37)} L${p(xx + 22, yy + 3, 37)} L${p(xx + 22, yy + 3, 23)} L${p(xx + 3, yy + 3, 23)} Z" fill="#142b35" stroke="#b39760"/>`;
        s += `<circle cx="${project(xx + 8, yy + 38).x}" cy="${project(xx + 8, yy + 38).y - 8}" r="6" fill="#4e4734"/>`;
      }
      const d = project(...r.door);
      s += `<ellipse class="smc-world-door" data-door="${r.id}" cx="${d.x}" cy="${d.y}" rx="22" ry="10" fill="${r.future ? "#38404a" : "#b89b5c"}" opacity=".6"/><path d="M${p(x, y + h)} L${p(x + w, y + h)} L${p(x + w, y + h, 8)}" fill="none" stroke="#d8b777" stroke-width="2"/></g>`;
    }
    const center = project(384, 288);
    s += `<ellipse cx="${center.x}" cy="${center.y}" rx="65" ry="30" fill="#12191f" stroke="#a48a56"/><text x="${center.x}" y="${center.y + 4}" text-anchor="middle" fill="#d9bb7d" font-size="16" font-family="sans-serif" letter-spacing="3">SMC ELITE</text><g class="smc-world-avatar" id="smc-world-avatar" aria-hidden="true"><ellipse cy="3" rx="13" ry="6" fill="#0009"/><g class="smc-world-avatar-body"><path d="M-6,-15 L-7,0 M6,-15 L7,0" stroke="#d5b578" stroke-width="6" stroke-linecap="round"/><rect x="-10" y="-35" width="20" height="23" rx="6" fill="#222e39" stroke="#ddbd77"/><path d="M-11,-29 L-15,-17 M11,-29 L15,-17" stroke="#bfa36b" stroke-width="5" stroke-linecap="round"/><rect x="-15" y="-63" width="30" height="28" rx="13" fill="#1a2027" stroke="#ddbd77" stroke-width="2"/><rect x="-11" y="-58" width="22" height="15" rx="7" fill="#080d13"/><path d="M-7,-50 Q-4,-54 -1,-50 M2,-50 Q5,-54 8,-50" fill="none" stroke="#e9c883" stroke-width="2"/></g></g></svg>`;
    return s;
  }
  class MapController {
    constructor(host, rooms, options) {
      this.host = host;
      this.rooms = rooms;
      this.options = options;
      this.position = options.position || { x: 384, y: 336 };
      if (!walkable(this.position.x, this.position.y, rooms))
        this.position = { x: 384, y: 336 };
      host.innerHTML = scene(rooms);
      this.queue = [];
      this.frame = 0;
      this.destination = null;
      this.onKey = (e) => this.key(e);
      this.onHidden = () => {
        if (document.hidden) this.stop();
      };
      document.addEventListener("keydown", this.onKey);
      document.addEventListener("visibilitychange", this.onHidden);
      host.addEventListener(
        "click",
        (this.click = (e) => {
          if (e.target.closest("button")) return;
          const rect = host.querySelector("svg").getBoundingClientRect(),
            v = unproject(
              ((e.clientX - rect.left) * 1100) / rect.width,
              ((e.clientY - rect.top) * 650) / rect.height,
            );
          this.go(v);
        }),
      );
      this.paint();
    }
    paint() {
      const v = project(this.position.x, this.position.y);
      this.host
        .querySelector("#smc-world-avatar")
        ?.setAttribute(
          "transform",
          `translate(${v.x},${v.y}) scale(${innerWidth < 760 ? 1.4 : 1})`,
        );
      const near = this.near(),
        id = near?.id || null;
      if (id !== this.nearId) {
        this.nearId = id;
        this.host
          .querySelectorAll("[data-door]")
          .forEach((d) => d.classList.toggle("near", d.dataset.door === id));
        this.options.onNear?.(near);
      }
    }
    near() {
      return this.rooms
        .filter((r) => !r.future)
        .find(
          (r) =>
            Math.hypot(
              this.position.x - r.door[0],
              this.position.y - r.door[1],
            ) < 45,
        );
    }
    go(v, room = null) {
      this.stop();
      this.queue = path(this.position, v, this.rooms);
      this.destination = room;
      if (!this.queue.length) {
        if (room && this.near()?.id === room.id) this.options.onEnter(room.id);
        return;
      }
      if (
        this.options.reduceMotion ||
        matchMedia("(prefers-reduced-motion:reduce)").matches
      ) {
        this.position = this.queue.at(-1);
        this.queue = [];
        this.paint();
        this.options.onPosition?.(this.position);
        if (room) this.options.onEnter(room.id);
        return;
      }
      this.host.classList.add("walking");
      this.last = performance.now();
      const tick = (t) => {
        if (document.hidden) return this.stop();
        const dt = Math.min(40, t - this.last);
        this.last = t;
        const target = this.queue[0];
        if (!target) return this.stop();
        const dx = target.x - this.position.x,
          dy = target.y - this.position.y,
          d = Math.hypot(dx, dy),
          distance = dt * 0.19;
        if (d <= distance) {
          this.position = { ...target };
          this.queue.shift();
        } else {
          this.position.x += (dx / d) * distance;
          this.position.y += (dy / d) * distance;
        }
        this.paint();
        if (this.queue.length) this.frame = requestAnimationFrame(tick);
        else {
          this.frame = 0;
          this.host.classList.remove("walking");
          this.options.onPosition?.(this.position);
          const enter = this.destination;
          this.destination = null;
          if (enter) this.options.onEnter(enter.id);
        }
      };
      this.frame = requestAnimationFrame(tick);
    }
    key(e) {
      if (
        e.defaultPrevented ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        document.querySelector("dialog[open]") ||
        e.target.closest("input,textarea,select,button,[contenteditable=true]")
      )
        return;
      const deltas = {
        ArrowUp: [0, -16],
        w: [0, -16],
        W: [0, -16],
        ArrowDown: [0, 16],
        s: [0, 16],
        S: [0, 16],
        ArrowLeft: [-16, 0],
        a: [-16, 0],
        A: [-16, 0],
        ArrowRight: [16, 0],
        d: [16, 0],
        D: [16, 0],
      };
      if (deltas[e.key]) {
        e.preventDefault();
        const [dx, dy] = deltas[e.key];
        this.go({
          x: Math.round(this.position.x / 16) * 16 + dx,
          y: Math.round(this.position.y / 16) * 16 + dy,
        });
      } else if (["e", "E", "Enter"].includes(e.key) && this.near()) {
        e.preventDefault();
        this.options.onEnter(this.near().id);
      }
    }
    walkTo(id) {
      const r = this.rooms.find((r) => r.id === id);
      if (r && !r.future) this.go({ x: r.door[0], y: r.door[1] }, r);
    }
    stop() {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.queue = [];
      this.destination = null;
      this.host.classList.remove("walking");
    }
    destroy() {
      this.stop();
      document.removeEventListener("keydown", this.onKey);
      document.removeEventListener("visibilitychange", this.onHidden);
      this.host.removeEventListener("click", this.click);
    }
  }
  const api = { project, unproject, walkable, path, MapController };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SMCWorldMap = api;
})(globalThis);
