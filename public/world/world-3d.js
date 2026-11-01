/* Real WebGL scene, entirely local. No screenshots or financial demo textures. */
(function (root) {
  "use strict";
  if (!root.THREE || !root.SMCWorldMap) return;
  const T = root.THREE,
    Base = SMCWorldMap.MapController;
  const layout = (rooms) => {
    const poses = {
      dash: [32, 32, 192, 128, 128, 192],
      settings: [256, 32, 144, 128, 320, 192],
      trades: [448, 32, 144, 128, 512, 192],
      plan: [608, 32, 128, 128, 672, 192],
      analyst: [32, 208, 160, 112, 224, 272],
      risk: [608, 208, 128, 112, 576, 272],
      tools: [32, 432, 160, 128, 128, 400],
      community: [224, 432, 128, 128, 288, 400],
      achievements: [576, 432, 160, 128, 640, 400],
      economic: [608, 336, 128, 64, 576, 368],
    };
    return [
      ...rooms.map((r) => {
        const p = poses[r.id];
        return p
          ? { ...r, x: p[0], y: p[1], w: p[2], h: p[3], door: [p[4], p[5]] }
          : r;
      }),
      {
        id: "_central-sculpture",
        x: 304,
        y: 208,
        w: 160,
        h: 160,
        door: [400, 384],
        future: true,
      },
    ];
  };
  class World3D extends Base {
    constructor(host, rooms, options) {
      super(host, layout(rooms), options);
      if (!SMCWorldMap.walkable(this.position.x, this.position.y, this.rooms))
        this.position = { x: 400, y: 384 };
      try {
        this.build3D();
        document.body.classList.add("smc-world-3d-active");
        const rootEl = host.closest("#smc-world");
        const title = rootEl?.querySelector(".smc-world-intro h1");
        if (title) title.textContent = "SMC Elite World";
        const instruction = rootEl?.querySelector(".smc-world-instructions");
        if (instruction) host.parentNode.append(instruction);
        const cameraButton = document.createElement("button");
        cameraButton.className = "smc-world-camera";
        cameraButton.dataset.worldAction = "camera";
        cameraButton.textContent = "Alterar câmera 3D";
        host.parentNode.append(cameraButton);
        host.classList.add("smc-world-webgl");
        host.querySelector("svg").style.display = "none";
        host.removeEventListener("click", this.click);
        host.addEventListener(
          "click",
          (this.click3D = (e) => this.floorClick(e)),
        );
        this.observer = new ResizeObserver(() => this.resize3D());
        this.observer.observe(host);
        this.resize3D();
        this.paint();
        this.contextLost = (e) => {
          e.preventDefault();
          this.options.onGraphicsLost?.();
        };
        this.renderer.domElement.addEventListener(
          "webglcontextlost",
          this.contextLost,
        );
      } catch (error) {
        this.dispose3D();
        super.destroy();
        throw error;
      }
    }
    material(color, metal = 0.25, rough = 0.4, extra = {}) {
      return new T.MeshStandardMaterial({
        color,
        metalness: metal,
        roughness: rough,
        ...extra,
      });
    }
    box(x, y, z, w, h, d, mat, parent = this.scene) {
      const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (this.activeRoomId) mesh.userData.roomId = this.activeRoomId;
      parent.add(mesh);
      return mesh;
    }
    cylinder(x, y, z, r1, r2, h, mat, parent = this.scene) {
      const mesh = new T.Mesh(new T.CylinderGeometry(r1, r2, h, 32), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (this.activeRoomId) mesh.userData.roomId = this.activeRoomId;
      parent.add(mesh);
      return mesh;
    }
    ring(x, y, z, r, t, mat, parent = this.scene) {
      const mesh = new T.Mesh(new T.TorusGeometry(r, t, 8, 80), mat);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    }
    label(text, w = 256, h = 72) {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const c = canvas.getContext("2d");
      c.fillStyle = "#0b1119";
      c.fillRect(0, 0, w, h);
      c.strokeStyle = "#c9a767";
      c.lineWidth = 3;
      c.strokeRect(3, 3, w - 6, h - 6);
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.font =
        "bold " +
        Math.min(28, Math.floor(w / (text.length * 0.56))) +
        "px Arial";
      c.fillStyle = "#edcf91";
      c.fillText(text, w / 2, h / 2);
      const tex = new T.CanvasTexture(canvas);
      tex.colorSpace = T.SRGBColorSpace;
      this.textures.push(tex);
      return tex;
    }
    sign(text, x, y, z, w = 100, h = 27) {
      const mesh = new T.Mesh(
        new T.PlaneGeometry(w, h),
        new T.MeshBasicMaterial({ map: this.label(text), side: T.DoubleSide }),
      );
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      return mesh;
    }
    build3D() {
      this.textures = [];
      this.doorMeshes = new Map();
      this.renderer = new T.WebGLRenderer({
        antialias: innerWidth > 760,
        alpha: false,
        powerPreference: "low-power",
      });
      this.renderer.setPixelRatio(
        Math.min(devicePixelRatio || 1, innerWidth < 760 ? 1 : 1.5),
      );
      this.renderer.outputColorSpace = T.SRGBColorSpace;
      this.renderer.toneMapping = T.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.65;
      this.renderer.shadowMap.enabled = innerWidth > 760;
      this.renderer.shadowMap.type = T.PCFSoftShadowMap;
      this.renderer.domElement.setAttribute(
        "aria-label",
        "Átrio SMC Elite em três dimensões; use as placas ou a lista de salas",
      );
      this.host.append(this.renderer.domElement);
      this.scene = new T.Scene();
      this.scene.background = new T.Color("#080d14");
      this.scene.fog = new T.FogExp2("#080d14", 0.00052);
      this.camera = new T.PerspectiveCamera(35, 1, 1, 3500);
      this.camera.position.set(80, 670, 1020);
      this.camera.lookAt(0, 30, -10);
      this.ray = new T.Raycaster();
      this.floorPlane = new T.Plane(new T.Vector3(0, 1, 0), 0);
      this.scene.add(new T.HemisphereLight("#b8cbe1", "#3a2612", 3.8));
      const sun = new T.DirectionalLight("#ffe1a1", 6);
      sun.position.set(-200, 600, 150);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      Object.assign(sun.shadow.camera, {
        left: -550,
        right: 550,
        top: 500,
        bottom: -500,
        far: 1300,
      });
      sun.shadow.bias = -0.0005;
      this.scene.add(sun);
      const fill = new T.PointLight("#e5b85f", 20000, 850, 2);
      fill.position.set(0, 150, 20);
      this.scene.add(fill);
      const env = new T.Scene();
      env.background = new T.Color("#333b48");
      for (const [x, y, z] of [
        [0, 60, 0],
        [80, 0, 0],
        [-80, 0, 0],
        [0, 0, 80],
        [0, 0, -80],
      ]) {
        const p = new T.Mesh(
          new T.BoxGeometry(40, 10, 40),
          new T.MeshBasicMaterial({ color: "#f1ca88" }),
        );
        p.position.set(x, y, z);
        env.add(p);
      }
      const pmrem = new T.PMREMGenerator(this.renderer);
      this.environment = pmrem.fromScene(env, 0.08);
      this.scene.environment = this.environment.texture;
      pmrem.dispose();
      env.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
      this.gold = this.material("#caa05a", 0.7, 0.25, {
        emissive: "#6b4318",
        emissiveIntensity: 0.28,
      });
      this.dark = this.material("#131923", 0.6, 0.32);
      this.stone = this.material("#44464a", 0.25, 0.26);
      this.wood = this.material("#32271e", 0.3, 0.5);
      this.glow = new T.MeshStandardMaterial({
        color: "#eaca8a",
        emissive: "#f6ad3f",
        emissiveIntensity: 2.3,
        metalness: 0.4,
        roughness: 0.25,
      });
      this.glass = new T.MeshPhysicalMaterial({
        color: "#9bb2bd",
        metalness: 0.05,
        roughness: 0.12,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        side: T.DoubleSide,
      });
      this.box(0, -9, 0, 880, 18, 680, this.dark);
      this.box(0, 0.3, 0, 830, 2, 630, this.stone);
      for (let x = -416; x <= 416; x += 48)
        this.box(x, 1.5, 0, 0.6, 0.4, 625, this.material("#7d858c", 0.5, 0.6));
      for (let z = -312; z <= 312; z += 48)
        this.box(0, 1.5, z, 832, 0.4, 0.6, this.material("#7d858c", 0.5, 0.6));
      this.box(0, 85, -322, 200, 170, 12, this.dark);
      this.box(0, 172, -315, 224, 10, 45, this.stone);
      for (let i = -96; i <= 96; i += 12)
        this.box(i, 90, -313, 2, 150, 2, this.gold);
      this.archBrand = this.sign("SMC ELITE", 0, 128, -302, 154, 42);
      this.sign("RECEPÇÃO", 0, 63, -301, 95, 23);
      for (const x of [-125, 125]) {
        this.box(x, 74, -305, 6, 148, 6, this.gold);
        this.box(x + 7, 74, -305, 2, 145, 2, this.glow);
      }
      for (const r of this.rooms) {
        if (r.id === "_central-sculpture") continue;
        this.activeRoomId = r.id;
        const x = r.x + r.w / 2 - 384,
          z = r.y + r.h / 2 - 288,
          w = r.w,
          h = r.h;
        this.box(x, 4, z, w, 8, h, this.wood);
        this.box(x, 59, z - h / 2, w, 110, 5, this.dark);
        this.box(
          x,
          65,
          z - h / 2 + 3,
          w - 16,
          68,
          1,
          this.material("#4a3420", 0.2, 0.65, {
            emissive: "#442200",
            emissiveIntensity: 0.25,
          }),
        );
        this.box(x - w / 2, 59, z, 3, 110, h, this.glass);
        this.box(x + w / 2, 59, z, 3, 110, h, this.glass);
        this.box(x, 119, z - h / 2, w + 8, 9, 12, this.dark);
        this.box(x - w / 2, 119, z, 10, 9, h + 8, this.dark);
        this.box(x + w / 2, 119, z, 10, 9, h + 8, this.dark);
        this.box(x, 114, z + h / 2 + 2, w + 5, 3, 3, this.glow);
        this.box(x, 108, z - h / 2 + 5, w - 10, 2, 3, this.glow);
        this.box(x, 123, z - h / 2, w + 8, 2, 3, this.gold);
        for (const xx of [x - w / 2, x + w / 2])
          for (const zz of [z - h / 2, z + h / 2]) {
            this.box(xx, 60, zz, 4, 115, 4, this.gold);
            this.box(xx + 2, 58, zz, 1, 104, 1, this.glow);
          }
        // The near roof is an open frame: it never hides the working interior.

        const desk = this.material("#473527", 0.3, 0.35);
        for (const dx of [-w * 0.23, w * 0.23]) {
          this.box(x + dx, 31, z - 10, w * 0.39, 4, 34, desk);
          for (const leg of [-w * 0.14, w * 0.14])
            this.box(x + dx + leg, 17, z - 8, 3, 28, 3, this.dark);
          this.box(x + dx, 44, z - 17, 30, 19, 3, this.gold);
          this.box(
            x + dx,
            44,
            z - 15,
            27,
            16,
            1,
            this.material("#17303b", 0.45, 0.2),
          );
          this.cylinder(x + dx, 15, z + 26, 12, 12, 4, this.dark);
          this.box(
            x + dx,
            25,
            z + 34,
            23,
            23,
            4,
            this.material("#372b22", 0.1, 0.7),
          );
          this.cylinder(x + dx, 8, z + 26, 2, 3, 11, this.gold);
        }
        this.sign(
          r.short.toUpperCase(),
          x,
          86,
          z - h / 2 + 4,
          Math.min(w - 14, 140),
          25,
        );
        if (r.id === "trades") {
          const paper = this.material("#d9cba5", 0.05, 0.8);
          const page1 = this.box(x - 12, 42, z, 24, 3, 30, paper),
            page2 = this.box(x + 12, 42, z, 24, 3, 30, paper);
          page1.rotation.z = 0.12;
          page2.rotation.z = -0.12;
          this.box(x, 27, z, 65, 25, 40, this.wood);
        }
        if (r.id === "plan") {
          this.box(x, 47, z, 72, 3, 32, this.wood);
          for (const xx of [-32, 32])
            this.box(x + xx, 22, z, 4, 44, 4, this.gold);
          this.sign(
            "PLANO • EXECUÇÃO • RISCO",
            x,
            68,
            z - h / 2 + 6,
            Math.min(w - 15, 125),
            24,
          );
        }
        if (r.id === "achievements") {
          this.cylinder(x, 16, z, 17, 20, 30, this.dark);
          this.cylinder(x, 37, z, 16, 5, 17, this.gold);
          this.cylinder(x, 27, z, 3, 3, 12, this.gold);
          for (const xx of [-18, 18]) {
            const handle = new T.Mesh(
              new T.TorusGeometry(8, 1.5, 8, 24),
              this.gold,
            );
            handle.position.set(x + xx, 36, z);
            this.scene.add(handle);
          }
        }
        if (r.future) {
          this.box(x, 18, z, 68, 16, 28, this.material("#55432e", 0.1, 0.7));
          this.box(x, 32, z - 12, 68, 20, 6, this.wood);
          for (const xx of [-32, 32])
            this.box(x + xx, 28, z, 7, 20, 28, this.wood);
        }
        this.plant(x - w / 2 + 13, z - h / 2 + 18, 1);
        this.plant(x + w / 2 - 13, z + h / 2 - 15, 0.8);
        const door = SMCWorldMap.project(...r.door);
        const dx = r.door[0] - 384,
          dz = r.door[1] - 288;
        this.doorMeshes.set(
          r.id,
          this.ring(dx, 3, dz, 16, 1.4, r.future ? this.dark : this.gold),
        );
        if (r.future)
          this.sign(
            "EM DESENVOLVIMENTO",
            x,
            52,
            z - h / 2 + 5,
            Math.min(w - 10, 130),
            16,
          );
      }
      this.activeRoomId = null;
      // Central sculpture: an illuminated wire globe, never a market chart.
      this.cylinder(0, 9, 0, 77, 82, 16, this.dark);
      this.cylinder(0, 19, 0, 62, 69, 8, this.gold);
      this.cylinder(0, 38, 0, 45, 52, 34, this.dark);
      this.ring(0, 8, 0, 80, 1.5, this.glow);
      this.ring(0, 24, 0, 63, 1.2, this.glow);
      this.stageBrand = this.sign("SMC ELITE", 0, 41, 48, 76, 20);
      const globe = new T.Group();
      globe.position.set(0, 108, 0);
      this.scene.add(globe);
      const goldLine = new T.LineBasicMaterial({
        color: "#ffc563",
        transparent: true,
        opacity: 1,
        toneMapped: false,
      });
      for (let j = 0; j < 12; j++) {
        const pts = [];
        for (let i = 0; i <= 80; i++) {
          const a = (i / 80) * Math.PI * 2,
            b = (j / 12) * Math.PI;
          pts.push(
            new T.Vector3(
              Math.cos(a) * 43 * Math.cos(b),
              Math.sin(a) * 43,
              Math.cos(a) * 43 * Math.sin(b),
            ),
          );
        }
        globe.add(
          new T.Line(new T.BufferGeometry().setFromPoints(pts), goldLine),
        );
      }
      for (let j = -3; j <= 3; j++) {
        const yy = j * 10,
          rr = Math.sqrt(43 * 43 - yy * yy),
          pts = [];
        for (let i = 0; i <= 80; i++) {
          const a = (i / 80) * Math.PI * 2;
          pts.push(new T.Vector3(Math.cos(a) * rr, yy, Math.sin(a) * rr));
        }
        globe.add(
          new T.Line(new T.BufferGeometry().setFromPoints(pts), goldLine),
        );
      }
      const ball = new T.Mesh(
        new T.SphereGeometry(42, 32, 24),
        new T.MeshPhysicalMaterial({
          color: "#513b18",
          metalness: 0.6,
          roughness: 0.18,
          transparent: true,
          opacity: 0.38,
        }),
      );
      globe.add(ball);
      this.ring(0, 102, 0, 65, 1, this.glow).rotation.z = 0.25;
      const gc = document.createElement("canvas");
      gc.width = gc.height = 128;
      const ctx = gc.getContext("2d"),
        grad = ctx.createRadialGradient(64, 64, 1, 64, 64, 64);
      grad.addColorStop(0, "rgba(255,186,60,.23)");
      grad.addColorStop(0.5, "rgba(255,157,30,.09)");
      grad.addColorStop(1, "rgba(255,157,30,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      const gt = new T.CanvasTexture(gc);
      this.textures.push(gt);
      const gs = new T.Sprite(
        new T.SpriteMaterial({
          map: gt,
          transparent: true,
          depthWrite: false,
          blending: T.AdditiveBlending,
        }),
      );
      gs.scale.set(180, 180, 1);
      gs.position.set(0, 108, 0);
      this.scene.add(gs);
      if (innerWidth > 900 && window.SMCWorldReflector) {
        this.reflector = new SMCWorldReflector(new T.PlaneGeometry(830, 630), {
          color: 0x49433b,
          textureWidth: 512,
          textureHeight: 512,
          clipBias: 0.003,
        });
        this.reflector.rotation.x = -Math.PI / 2;
        this.reflector.position.y = 1.42;
        this.scene.add(this.reflector);
      }
      for (const x of [-410, 410])
        for (const z of [-265, -90, 90, 265]) this.plant(x, z, 1.5);
      // Railings and gold inlays establish depth without blocking navigation.
      for (const x of [-430, 430]) {
        this.box(x, 27, 0, 2, 2, 610, this.gold);
        for (let z = -300; z <= 300; z += 60)
          this.box(x, 14, z, 2, 28, 2, this.gold);
      }
      this.avatar = new T.Group();
      this.scene.add(this.avatar);
      this.avatarBody = new T.Group();
      this.avatar.add(this.avatarBody);
      const bodyMat = this.material("#101820", 0.65, 0.3);
      this.cylinder(0, 18, 0, 10, 9, 23, bodyMat, this.avatarBody);
      this.box(0, 29, 0, 18, 5, 14, this.gold, this.avatarBody);
      const head = new T.Mesh(new T.SphereGeometry(15, 28, 20), bodyMat);
      head.position.y = 43;
      head.scale.set(1, 0.94, 0.9);
      this.avatarBody.add(head);
      const visor = new T.Mesh(
        new T.SphereGeometry(13, 28, 16, 0, Math.PI),
        this.material("#05090d", 0.55, 0.13),
      );
      visor.rotation.y = -Math.PI / 2;
      visor.position.set(0, 44, 3);
      this.avatarBody.add(visor);
      for (const xx of [-7, 7]) {
        const eye = new T.Mesh(
          new T.TorusGeometry(3, 0.9, 6, 16, Math.PI),
          this.glow,
        );
        eye.position.set(xx, 45, 12);
        this.avatarBody.add(eye);
        this.cylinder(xx, 5, 0, 3.5, 4, 13, this.gold, this.avatarBody);
      }
      for (const xx of [-16, 16]) {
        const ear = new T.Mesh(new T.SphereGeometry(4, 12, 10), this.gold);
        ear.position.set(xx, 44, 0);
        this.avatarBody.add(ear);
        this.box(xx * 0.75, 19, 0, 5, 19, 6, bodyMat, this.avatarBody);
      }
      this.ring(0, 2, 0, 19, 0.8, this.glow, this.avatar);
      const logo = document.querySelector(".smc-logo");
      if (logo?.complete && logo.naturalWidth) {
        const cv = document.createElement("canvas");
        cv.width = 512;
        cv.height = 300;
        const c = cv.getContext("2d");
        c.drawImage(logo, 70, 0, 372, 300);
        const tx = new T.CanvasTexture(cv);
        tx.colorSpace = T.SRGBColorSpace;
        this.textures.push(tx);
        const material = new T.MeshBasicMaterial({
          map: tx,
          transparent: true,
          depthWrite: false,
          toneMapped: false,
        });
        const arch = new T.Mesh(new T.PlaneGeometry(132, 78), material);
        arch.position.set(0, 132, -299);
        this.scene.add(arch);
        const stage = new T.Mesh(new T.PlaneGeometry(62, 36), material);
        stage.position.set(0, 40, 53);
        this.scene.add(stage);
        this.archBrand.visible = false;
        this.stageBrand.visible = false;
      }
      this.cameraMode = 0;
    }
    plant(x, z, scale) {
      const green = this.material("#405238", 0.08, 0.8);
      this.cylinder(
        x,
        10 * scale,
        z,
        8 * scale,
        6 * scale,
        18 * scale,
        this.gold,
      );
      for (let j = 0; j < 4; j++) {
        const leaf = new T.Mesh(new T.SphereGeometry(9 * scale, 8, 6), green);
        leaf.position.set(
          x + Math.sin(j * 2) * 5 * scale,
          29 * scale + j * 3,
          z + Math.cos(j * 2) * 5 * scale,
        );
        leaf.scale.set(0.65, 2, 0.5);
        leaf.rotation.z = Math.sin(j) * 0.55;
        this.scene.add(leaf);
      }
    }
    paint() {
      super.paint();
      if (!this.renderer || !this.avatar) return;
      this.avatar.position.set(this.position.x - 384, 3, this.position.y - 288);
      const walking = this.queue?.length > 0;
      this.avatarBody.rotation.z = walking
        ? Math.sin(performance.now() * 0.018) * 0.055
        : 0;
      if (walking)
        this.avatarBody.position.y =
          Math.abs(Math.sin(performance.now() * 0.018)) * 1.6;
      else this.avatarBody.position.y = 0;
      const near = this.near();
      this.doorMeshes.forEach((mesh, id) => {
        mesh.material =
          id === near?.id
            ? this.glow
            : this.rooms.find((r) => r.id === id)?.future
              ? this.dark
              : this.gold;
        mesh.scale.setScalar(id === near?.id ? 1.2 : 1);
      });
      this.draw3D();
    }
    draw3D() {
      if (!this.renderer || document.hidden) return;
      this.renderer.render(this.scene, this.camera);
      this.placeSigns();
    }
    placeSigns() {
      const signs = this.host.parentNode?.querySelectorAll("[data-world-walk]");
      if (!signs) return;
      for (const sign of signs) {
        const r = this.rooms.find((r) => r.id === sign.dataset.worldWalk);
        if (!r) continue;
        sign.setAttribute("aria-label", r.name);
        for (const node of sign.childNodes)
          if (node.nodeType === 3 && node.textContent.trim())
            node.textContent = " " + (r.future ? "Comunidade" : r.name);
        const v = new T.Vector3(
          r.x + r.w / 2 - 384,
          135,
          r.y + r.h / 2 - 288,
        ).project(this.camera);
        sign.style.left = (v.x + 1) * 50 + "%";
        sign.style.top = (1 - v.y) * 50 + "%";
        sign.style.visibility = v.z > 1 ? "hidden" : "visible";
      }
    }
    resize3D() {
      if (!this.renderer) return;
      const rect = this.host.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      if (this.lastSize === rect.width + ":" + rect.height) return;
      this.lastSize = rect.width + ":" + rect.height;
      this.renderer.setSize(rect.width, rect.height, false);
      this.camera.aspect = rect.width / rect.height;
      this.camera.updateProjectionMatrix();
      this.draw3D();
    }
    floorClick(event) {
      if (event.target.closest("button") || !this.renderer) return;
      const rect = this.renderer.domElement.getBoundingClientRect(),
        p = new T.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          (-(event.clientY - rect.top) / rect.height) * 2 + 1,
        );
      this.ray.setFromCamera(p, this.camera);
      const roomHit = this.ray
        .intersectObjects(this.scene.children, true)
        .find((h) => h.object.userData.roomId);
      if (roomHit) {
        const room = this.rooms.find(
          (r) => r.id === roomHit.object.userData.roomId,
        );
        if (room && !room.future) this.walkTo(room.id);
        return;
      }
      const hit = new T.Vector3();
      if (this.ray.ray.intersectPlane(this.floorPlane, hit))
        this.go({ x: hit.x + 384, y: hit.z + 288 });
    }
    changeView() {
      this.cameraMode = (this.cameraMode + 1) % 2;
      this.camera.position.set(
        this.cameraMode ? 590 : 80,
        this.cameraMode ? 750 : 670,
        this.cameraMode ? 890 : 1020,
      );
      this.camera.lookAt(0, 30, -10);
      this.draw3D();
    }
    dispose3D() {
      this.observer?.disconnect();
      this.host.removeEventListener("click", this.click3D);
      if (this.renderer) {
        this.renderer.domElement.removeEventListener(
          "webglcontextlost",
          this.contextLost,
        );
        this.scene?.traverse((o) => {
          o.geometry?.dispose();
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material?.dispose();
        });
        this.textures?.forEach((t) => t.dispose());
        this.environment?.dispose();
        this.reflector?.getRenderTarget().dispose();
        this.renderer.dispose();
        this.renderer.forceContextLoss();
        this.renderer.domElement.remove();
      }
      this.host.classList.remove("smc-world-webgl");
      document.body.classList.remove("smc-world-3d-active");
      this.host.parentNode?.querySelector(".smc-world-camera")?.remove();
    }
    destroy() {
      this.dispose3D();
      super.destroy();
    }
  }
  root.SMCWorld3D = World3D;
})(globalThis);
