"use strict";
const assert = require("node:assert/strict"),
  { chromium } = require("playwright"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: { SMC_WORLD_ENABLED: "true" } });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const b = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  try {
    const p = await b.newPage({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: "reduce",
      }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.route("**/public/world/world-scenes.js", (r) => r.abort());
    await p.goto("http://127.0.0.1:" + app.server.address().port);
    await p.waitForSelector("#smc-world-enter");
    assert.equal(await p.locator('script[src*="three.min"]').count(), 0);
    const before = await p.evaluate(() => JSON.stringify(S));
    await p.locator("#smc-world-enter").click();
    await p.waitForSelector(".smc-world-webgl canvas");
    const stats = await p.evaluate(() => {
      const m = SMCWorld.controller.map;
      return {
        engine: m.constructor.name,
        triangles: m.renderer.info.render.triangles,
        calls: m.renderer.info.render.calls,
        context: !!m.renderer.getContext(),
        rooms: m.rooms.filter((r) => r.id !== "_central-sculpture").length,
      };
    });
    assert.equal(stats.engine, "World3D");
    assert(stats.context && stats.triangles > 10000 && stats.calls > 100);
    assert.equal(stats.rooms, 10);
    await p.waitForTimeout(400);
    const frame = await p.evaluate(
      () => SMCWorld.controller.map.renderer.info.render.frame,
    );
    await p.waitForTimeout(500);
    assert.equal(
      await p.evaluate(
        () => SMCWorld.controller.map.renderer.info.render.frame,
      ),
      frame,
      "no GPU render loop at rest",
    );
    await p.evaluate(() => SMCWorld.controller.map.go({ x: 528, y: 384 }));
    assert.equal(
      await p.evaluate(() => SMCWorld.controller.map.avatar.position.x),
      144,
    );
    const x = await p.evaluate(() => SMCWorld.controller.map.camera.position.x);
    await p.locator("[data-world-action=camera]").click();
    assert.notEqual(
      await p.evaluate(() => SMCWorld.controller.map.camera.position.x),
      x,
    );
    await p.locator("[data-world-action=camera]").click();
    await p.screenshot({ path: "/tmp/smc-world-real-3d.png", fullPage: true });
    assert.equal(await p.evaluate(() => JSON.stringify(S)), before);
    await p.locator("[data-world-walk=dash]").click();
    await p.waitForSelector("#smc-world-workspace #main");
    assert.equal(await p.evaluate(() => tab), "dash");
    await p.locator("[data-world-action=lobby]").click();
    await p.waitForSelector(".smc-world-webgl canvas");
    await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForTimeout(200);
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await p.screenshot({
      path: "/tmp/smc-world-real-3d-mobile.png",
      fullPage: true,
    });
    await p.evaluate(() =>
      SMCWorld.controller.map.renderer
        .getContext()
        .getExtension("WEBGL_lose_context")
        .loseContext(),
    );
    await p.waitForFunction(
      () => SMCWorld.controller.map.constructor.name === "MapController",
    );
    assert(await p.locator("[data-world-action=classic]").isVisible());
    assert.equal(await p.evaluate(() => JSON.stringify(S)), before);
    await p.locator("[data-world-action=classic]").click();
    assert(await p.locator(".smc-home").isVisible());
    assert.deepEqual(errors, []);
    console.log(
      "PASS real WebGL: " +
        stats.triangles +
        " triangles, perspective camera, 3D avatar motion, real-room routing, no idle render loop, mobile and context-loss fallback; same workspace unchanged",
    );
  } finally {
    await b.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
