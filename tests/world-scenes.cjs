"use strict";
const assert = require("node:assert/strict"),
  { chromium } = require("playwright"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: { SMC_WORLD_ENABLED: "true" } });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
  });
  try {
    const p = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    const errors = [],
      requests = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("request", (r) => requests.push(r.url()));
    const base = "http://127.0.0.1:" + app.server.address().port;
    await p.goto(base);
    await p.waitForSelector("#smc-world-enter");
    assert(
      !requests.some((u) => u.includes("/world/assets/")),
      "no scenery download on classic Home",
    );
    const before = await p.evaluate(() => JSON.stringify(S));
    await p.locator("#smc-world-enter").click();
    await p.waitForSelector(".smc-cinema-lobby");
    await p.waitForFunction(() => SMCWorldScenes.enabled);
    assert(
      !requests.some((u) => u.includes("three.min")),
      "image mode needs no 3D engine",
    );
    assert(!requests.some((u) => u.endsWith("panel.webp")), "room art is lazy");
    assert.equal(await p.locator(".smc-cinema-door").count(), 10);
    assert(await p.locator("[data-world-walk=community]").isDisabled());
    const asset = await p.request.get(base + "/public/world/assets/lobby.webp");
    assert.equal(asset.status(), 200);
    assert.equal(asset.headers()["content-type"], "image/webp");
    assert.equal(
      (
        await p.request.get(base + "/public/world/assets/private.json")
      ).status(),
      404,
    );
    await p.locator("[data-world-action=dismiss-help]").click();
    await p.locator(".smc-cinema-image").evaluate((i) => i.decode());
    await p.screenshot({ path: "/tmp/world-scenes-lobby.png", fullPage: true });
    await p.locator("[data-world-walk=dash]").click();
    await p.waitForSelector("#smc-world-workspace #main");
    assert.equal(await p.evaluate(() => tab), "dash");
    assert.equal(
      await p.locator("#main").count(),
      1,
      "one original operational workspace",
    );
    await p.locator(".smc-cinema-image").evaluate((i) => i.decode());
    await p.screenshot({ path: "/tmp/world-scenes-dash.png", fullPage: true });
    await p.locator("[data-cinema-environment]").click();
    assert(await p.locator("#smc-world-workspace").isHidden());
    await p.locator("[data-cinema-environment]").click();
    assert(await p.locator("#main").isVisible());
    await p.locator("[data-cinema-expand]").click();
    assert(
      await p
        .locator(".smc-cinema-room")
        .evaluate((n) => n.classList.contains("is-expanded")),
    );
    await p.locator("[data-cinema-expand]").click();
    await p.locator("[data-world-action=lobby]").click();
    // Keyboard activates the same rooms. Focused form text is never movement input.
    await p.locator("[data-world-walk=plan]").focus();
    await p.keyboard.press("e");
    await p.waitForSelector("#tp-name");
    await p.locator("#tp-name").fill("Rascunho visual preservado");
    await p.keyboard.press("w");
    const draftName = await p.locator("#tp-name").inputValue();
    assert(
      draftName.startsWith("Rascunho visual preservado"),
      "typed draft is intact: " + draftName,
    );
    assert.equal(await p.evaluate(() => SMCWorld.controller.room), "plan");
    await p.locator(".smc-cinema-image").evaluate((i) => i.decode());
    await p.screenshot({ path: "/tmp/world-scenes-plan.png", fullPage: true });
    await p.locator("[data-world-action=lobby]").click();
    await p.locator("[data-world-walk=trades]").click();
    await p.waitForSelector("#smc-world-workspace #main");
    assert.equal(await p.evaluate(() => tab), "trades");
    await p.locator(".smc-cinema-image").evaluate((i) => i.decode());
    await p.screenshot({
      path: "/tmp/world-scenes-trades.png",
      fullPage: true,
    });
    for (const width of [320, 390, 768, 1280, 1440, 1920]) {
      await p.setViewportSize({ width, height: 1000 });
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "room fits " + width,
      );
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await p.screenshot({
      path: "/tmp/world-scenes-mobile-room.png",
      fullPage: true,
    });
    await p.locator("[data-world-action=lobby]").click();
    for (const width of [320, 390, 768, 1280, 1440, 1920]) {
      await p.setViewportSize({ width, height: 1000 });
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "lobby fits " +
          width +
          JSON.stringify(
            await p.evaluate(() =>
              [...document.querySelectorAll("body *")]
                .filter(
                  (n) =>
                    n.getBoundingClientRect().right > innerWidth + 1 &&
                    n.getBoundingClientRect().width > 0,
                )
                .slice(-12)
                .map((n) => ({
                  c: n.className,
                  w: n.getBoundingClientRect().width,
                  right: n.getBoundingClientRect().right,
                })),
            ),
          ),
      );
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await p.screenshot({
      path: "/tmp/world-scenes-mobile.png",
      fullPage: true,
    });
    await p.locator("[data-world-room=plan]").click();
    await p.waitForTimeout(180);
    assert(
      (await p.locator("#tp-name").inputValue()).startsWith(
        "Rascunho visual preservado",
      ),
      JSON.stringify(
        await p.evaluate(() => ({
          value: document.querySelector("#tp-name").value,
          draft: SMCWorld.controller.drafts.get("plan"),
        })),
      ),
    );
    await p.locator("[data-world-action=classic]").click();
    assert.equal(
      await p.evaluate(() => JSON.stringify(S)),
      before,
      "navigation and drafts never mutate saved workspace",
    );
    assert(
      !(await p
        .locator("body")
        .evaluate((n) => n.classList.contains("smc-world-cinematic"))),
    );
    assert(await p.locator(".smc-home").isVisible());
    // Missing art still leaves real forms, navigation and classic exit usable.
    await p.route("**/public/world/assets/plan.webp", (r) => r.abort());
    await p.locator("#smc-world-enter").click();
    await p.locator("[data-world-room=plan]").click();
    await p.waitForSelector(".smc-cinema-stage.image-unavailable");
    assert(await p.locator("#tp-name").isVisible());
    await p.locator("[data-world-action=classic]").click();
    assert.deepEqual(errors, []);
    // Missing lobby image must select an independent functional fallback.
    const fallback = await browser.newPage({ reducedMotion: "reduce" });
    await fallback.route("**/public/world/assets/lobby.webp", (r) => r.abort());
    await fallback.route("**/public/world/vendor/three.min.js", (r) =>
      r.abort(),
    );
    await fallback.goto(base);
    await fallback.locator("#smc-world-enter").click();
    await fallback.waitForSelector(".smc-world-avatar");
    await fallback.locator("[data-world-room=plan]").click();
    assert(await fallback.locator("#tp-name").isVisible());
    await fallback.locator("[data-world-action=classic]").click();
    console.log(
      "PASS image-led World: lazy optimized artwork, clickable and keyboard rooms, same live views/drafts/state, responsive 320–1920, reduced motion, no engine dependency, missing-art fallback and classic return",
    );
  } finally {
    await browser.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
