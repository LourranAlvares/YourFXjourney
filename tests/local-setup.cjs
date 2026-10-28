"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const setup = require("../scripts/setup-local.cjs");
(async () => {
  assert.equal(setup.supportedNode("22.16.0"), false);
  assert.equal(setup.supportedNode("22.17.0"), true);
  assert.equal(setup.supportedNode("24.0.0"), true);
  const original =
    "# keep comment\nUNKNOWN=value\nTRADE_AI_KEY=old\nTRADE_AI_KEY=duplicate\n";
  const changed = setup.updateEnv(original, {
    TRADE_AI_KEY: "new-secret",
    TRADE_MARKET_KEY: "",
  });
  assert.equal(setup.parseEnv(changed).TRADE_AI_KEY, "new-secret");
  assert.ok(changed.includes("# keep comment\nUNKNOWN=value"));
  assert.equal(changed.match(/TRADE_AI_KEY=/g).length, 1);
  assert.equal(setup.updateEnv(original, { TRADE_AI_KEY: "" }), original);
  assert.throws(() => setup.encodeEnvValue("secret\nINJECTED=yes"));
  assert.ok(
    setup.validateConfig({
      HOST: "0.0.0.0",
      PORT: "8080",
      TRADE_ASSISTANT_PASSWORD: "test-password-123",
    }).length,
  );
  assert.ok(
    setup.validateConfig({
      HOST: "127.0.0.1",
      PORT: "0",
      TRADE_ASSISTANT_PASSWORD: "short",
    }).length,
  );
  const answers = [
    "test-password-123",
    "test-password-123",
    "mock-ai-key",
    "",
    "",
  ];
  let output = [];
  const configured = await setup.configure({
    text: original,
    inherited: {},
    ask: async () => answers.shift(),
    log: (s) => output.push(s),
  });
  assert.equal(configured.config.TRADE_AI_KEY, "mock-ai-key");
  assert.equal(configured.config.HOST, "127.0.0.1");
  assert.ok(!output.join("").includes("mock-ai-key"));
  assert.ok(!output.join("").includes("test-password-123"));
  const retained = await setup.configure({
    text: configured.text,
    inherited: {},
    ask: async () => "",
    log: () => {},
  });
  assert.equal(retained.config.TRADE_AI_KEY, "mock-ai-key");
  assert.equal(retained.config.TRADE_ASSISTANT_PASSWORD, "test-password-123");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "trade-setup-"));
  try {
    const file = path.join(dir, ".env");
    setup.writeEnvAtomic(file, configured.text);
    assert.equal(fs.readFileSync(file, "utf8"), configured.text);
    if (process.platform !== "win32")
      assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    setup.writeEnvAtomic(file, retained.text);
    assert.deepEqual(fs.readdirSync(dir), [".env"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  assert.equal(
    setup.browserUrl({ HOST: "::1", PORT: "8080" }),
    "http://[::1]:8080/",
  );
  for (const name of [
    "INICIAR-TRADE-ASSISTANT.bat",
    "CONFIGURAR-TRADE-ASSISTANT.bat",
    "INICIAR-TRADE-ASSISTANT.command",
  ])
    assert.ok(fs.existsSync(path.resolve(__dirname, "..", name)));
  console.log(
    "PASS Node version, environment preservation, duplicate replacement, blank preservation, input validation, loopback restriction, guided configuration, secret output protection, atomic permissions and launchers",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
