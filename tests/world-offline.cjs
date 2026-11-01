"use strict";
const assert = require("node:assert/strict"),
  path = require("node:path"),
  { chromium } = require("playwright"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
  try {
    const p = await b.newPage({ reducedMotion: "reduce" }),
      base = "http://127.0.0.1:" + app.server.address().port;
    await p.goto(base);
    await p.waitForSelector(".smc-home");
    assert.equal(await p.locator("#smc-world-enter").count(), 0);
    assert.equal(await p.evaluate(() => typeof SMCWorld), "undefined");
    assert.equal(await p.locator("link[href*=world]").count(), 0);
    for (const file of [
      "world-bootstrap.js",
      "world.js",
      "world-map.js",
      "world-ui.js",
      "world-rooms.js",
      "world.css",
    ]) {
      const r = await p.request.get(base + "/public/world/" + file);
      assert.equal(r.status(), 200);
      assert(
        r
          .headers()
          [
            "content-type"
          ].includes(file.endsWith(".css") ? "text/css" : "javascript"),
      );
    }
    assert.equal(
      (await p.request.get(base + "/public/world/private.json")).status(),
      404,
    );
    await p.route("**/YourFXjourney-standalone.html", (r) =>
      r.fulfill({
        contentType: "text/html",
        body: require("node:fs")
          .readFileSync(path.resolve("YourFXjourney-standalone.html"), "utf8")
          .replace(
            "<head>",
            '<head><meta name="smc-world-enabled" content="true">',
          ),
      }),
    );
    await p.route("**/api/**", (r) => r.abort());
    await p.goto(base + "/YourFXjourney-standalone.html");
    await p.waitForSelector("#smc-world-enter");
    const before = await p.evaluate(() => JSON.stringify(S));
    await p.locator("#smc-world-enter").click();
    await p.waitForSelector(".smc-world-room-list");
    assert.equal(await p.locator("script[src*=world]").count(), 0);
    await p.locator("[data-world-room=plan]").click();
    assert(await p.locator("#ta-plan-form").isVisible());
    await p.locator("[data-world-action=classic]").click();
    assert.equal(await p.evaluate(() => JSON.stringify(S)), before);
    assert(await p.locator(".smc-home").isVisible());
    console.log(
      "PASS World flag default off, no scene download in classic, static MIME/whitelist and embedded standalone without external services, room/classic roundtrip (file URL blocked by managed browser policy)",
    );
  } finally {
    await b.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
