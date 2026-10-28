"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const util = require("node:util");
const readline = require("node:readline");
const net = require("node:net");
const http = require("node:http");
const { spawn } = require("node:child_process");
const ROOT = path.resolve(__dirname, "..");
const KNOWN = [
  "TRADE_ASSISTANT_PASSWORD",
  "TRADE_AI_KEY",
  "TRADE_AI_MODEL",
  "TRADE_ECONOMIC_KEY",
  "TRADE_ECONOMIC_PROVIDER",
  "TRADE_MARKET_KEY",
  "HOST",
  "PORT",
];
const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1"]);
function supportedNode(version = process.versions.node) {
  const [major, minor] = version.split(".").map(Number);
  return major > 22 || (major === 22 && minor >= 17);
}
function parseEnv(text = "") {
  if (typeof text !== "string" || text.length > 65536)
    throw new Error("O arquivo .env é inválido ou muito grande.");
  if (typeof util.parseEnv !== "function")
    throw new Error("Instale Node.js 22.17 ou mais recente.");
  return util.parseEnv(text);
}
function encodeEnvValue(value) {
  if (typeof value !== "string" || /[\r\n\0]/.test(value))
    throw new Error(
      "Use um valor em uma única linha, sem caracteres de controle.",
    );
  if (/^[A-Za-z0-9_./:@+\-=]*$/.test(value)) return value;
  for (const quote of ['"', "'", "`"])
    if (!value.includes(quote)) return quote + value + quote;
  if (!value.includes("#") && value.trim() === value) return value;
  throw new Error(
    "Essa combinação de aspas não pode ser salva com segurança no .env. Escolha outro valor.",
  );
}
// Recognize whole assignments, including multiline quoted values. Unknown lines are retained verbatim.
function envEntries(text) {
  const lines = text.split(/\r?\n/),
    entries = [];
  for (let i = 0; i < lines.length; i++) {
    const start = i,
      match = lines[i].match(
        /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/,
      );
    if (!match) {
      entries.push({ key: null, text: lines[i] });
      continue;
    }
    const first = match[2],
      quote = ['"', "'", "`"].includes(first[0]) ? first[0] : null;
    if (quote && first.indexOf(quote, 1) < 0)
      while (++i < lines.length && !lines[i].includes(quote)) {}
    entries.push({
      key: match[1],
      text: lines.slice(start, Math.min(i + 1, lines.length)).join("\n"),
    });
  }
  return entries;
}
function updateEnv(text, updates) {
  parseEnv(text);
  const pending = new Map();
  for (const [key, value] of Object.entries(updates)) {
    if (!KNOWN.includes(key))
      throw new Error("Variável de configuração não suportada.");
    if (value === undefined || value === null || value === "") continue; // blank means keep, never erase a binding
    pending.set(key, `${key}=${encodeEnvValue(String(value))}`);
  }
  const seen = new Set(),
    result = [];
  for (const entry of envEntries(text)) {
    if (!entry.key || !pending.has(entry.key)) result.push(entry.text);
    else if (!seen.has(entry.key)) {
      result.push(pending.get(entry.key));
      seen.add(entry.key);
    }
    // Updated duplicate assignments are removed so a later line cannot restore the old secret.
  }
  for (const [key, line] of pending) if (!seen.has(key)) result.push(line);
  return result.join("\n").replace(/\n*$/, "\n");
}
function effectiveConfig(text, inherited = process.env) {
  const stored = parseEnv(text),
    result = {};
  for (const key of KNOWN) result[key] = stored[key] || inherited[key] || "";
  result.HOST = result.HOST || "127.0.0.1";
  result.PORT = result.PORT || "8080";
  result.TRADE_AI_MODEL = result.TRADE_AI_MODEL || "gpt-4.1-mini";
  return result;
}
function validateConfig(config, requirePassword = true) {
  const issues = [];
  if (!LOOPBACK.has(config.HOST || "127.0.0.1"))
    issues.push(
      "Este iniciador é local. HOST deve ser 127.0.0.1, localhost ou ::1.",
    );
  if (
    !/^\d+$/.test(String(config.PORT || "8080")) ||
    +config.PORT < 1 ||
    +config.PORT > 65535
  )
    issues.push("PORT deve estar entre 1 e 65535.");
  const password = config.TRADE_ASSISTANT_PASSWORD || "";
  if (
    requirePassword &&
    (password.length < 12 ||
      password.trim().length < 12 ||
      password.length > 1024)
  )
    issues.push(
      "A senha precisa ter pelo menos 12 caracteres, sem contar espaços nas extremidades.",
    );
  for (const key of KNOWN)
    if (
      config[key] &&
      (/[\r\n\0]/.test(config[key]) || config[key].length > 4096)
    )
      issues.push(
        "Há uma configuração inválida. Use valores em uma única linha.",
      );
  return issues;
}
function writeEnvAtomic(file, text) {
  if (fs.existsSync(file) && !fs.lstatSync(file).isFile())
    throw new Error("O .env deve ser um arquivo local normal.");
  const temp = file + ".tmp-" + crypto.randomBytes(8).toString("hex");
  try {
    fs.writeFileSync(temp, text, { encoding: "utf8", mode: 0o600, flag: "wx" });
    fs.renameSync(temp, file);
    if (process.platform !== "win32") fs.chmodSync(file, 0o600);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}
function readEnvFile(file) {
  if (!fs.existsSync(file)) return "";
  if (!fs.lstatSync(file).isFile())
    throw new Error("O .env deve ser um arquivo local normal.");
  return fs.readFileSync(file, "utf8");
}
async function promptSecret(label) {
  if (!process.stdin.isTTY)
    throw new Error(
      "Execute o iniciador em uma janela de terminal interativa.",
    );
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 0,
  });
  const original = rl._writeToOutput.bind(rl);
  let masked = false;
  rl._writeToOutput = (text) => {
    if (!masked) original(text);
  };
  return new Promise((resolve, reject) => {
    let done = false;
    rl.once("SIGINT", () => {
      if (done) return;
      done = true;
      masked = false;
      rl.close();
      process.stdout.write("\n");
      reject(
        new Error(
          "Configuração cancelada. Os valores anteriores foram mantidos.",
        ),
      );
    });
    rl.question(label, (answer) => {
      if (done) return;
      done = true;
      masked = false;
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    masked = true;
  });
}
async function configure({
  text = "",
  inherited = process.env,
  ask = promptSecret,
  log = console.log,
} = {}) {
  const current = effectiveConfig(text, inherited),
    updates = {};
  log("\nCONFIGURAR TRADE ASSISTANT");
  log("O servidor é uma parte do aplicativo que roda neste computador.");
  log(
    "Ele conecta a IA e os eventos com segurança. Não é preciso contratar hospedagem.",
  );
  log(
    "As chaves ficam no .env local, nunca no HTML. As respostas abaixo não aparecem na tela.",
  );
  log(
    "Enter mantém um valor existente; nos serviços opcionais, Enter também permite configurar depois.\n",
  );
  let password;
  while (true) {
    password = await ask(
      "Senha para entrar no assistente (mínimo 12 caracteres" +
        (current.TRADE_ASSISTANT_PASSWORD ? ", Enter mantém a atual" : "") +
        "): ",
    );
    if (!password && current.TRADE_ASSISTANT_PASSWORD.length >= 12) break;
    if (
      password.length < 12 ||
      password.trim().length < 12 ||
      password.length > 1024
    ) {
      log("Escolha uma senha com pelo menos 12 caracteres.");
      continue;
    }
    const confirm = await ask("Repita a senha: ");
    if (password !== confirm) {
      log("As senhas não coincidem. Tente novamente.");
      continue;
    }
    try {
      encodeEnvValue(password);
    } catch (e) {
      log(e.message);
      continue;
    }
    updates.TRADE_ASSISTANT_PASSWORD = password;
    break;
  }
  log(
    "\nIA: requer uma chave da API OpenAI. ChatGPT Plus não inclui créditos da API.",
  );
  log(
    "Se não tiver uma chave agora, pressione Enter; revisão manual e diário continuam disponíveis.",
  );
  for (const [key, label] of [
    ["TRADE_AI_KEY", "Chave OpenAI (IA)"],
    [
      "TRADE_ECONOMIC_KEY",
      "Chave Financial Modeling Prep (eventos econômicos)",
    ],
    ["TRADE_MARKET_KEY", "Chave Twelve Data (dados de mercado)"],
  ]) {
    while (true) {
      const answer = (
        await ask(
          label + (current[key] ? " [já configurada]" : " [opcional]") + ": ",
        )
      ).trim();
      if (!answer) break;
      try {
        encodeEnvValue(answer);
        if (answer.length > 4096)
          throw new Error("A chave excede o tamanho permitido.");
        updates[key] = answer;
        break;
      } catch (e) {
        log(e.message);
      }
    }
  }
  if (!parseEnv(text).HOST && !current.HOST) updates.HOST = "127.0.0.1";
  const next = updateEnv(text, updates),
    effective = { ...effectiveConfig(next, inherited), ...updates };
  const issues = validateConfig(effective);
  if (issues.length) throw new Error(issues.join(" "));
  log(
    "\nConfiguração pronta. Os serviços sem chave continuarão identificados como indisponíveis.",
  );
  return { text: next, config: effective };
}
function browserUrl(config) {
  const host = config.HOST === "::1" ? "[::1]" : config.HOST;
  return `http://${host}:${Number(config.PORT)}/`;
}
function openBrowser(
  url,
  { platform = process.platform, spawnFn = spawn } = {},
) {
  let child;
  if (platform === "win32")
    child = spawnFn("cmd.exe", ["/d", "/s", "/c", `start "" "${url}"`], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
  else
    child = spawnFn(platform === "darwin" ? "open" : "xdg-open", [url], {
      detached: true,
      stdio: "ignore",
    });
  child.on("error", () => {});
  child.unref();
}
function getStatus(url, timeout = 1500) {
  return new Promise((resolve) => {
    const req = http.get(url + "api/status", (res) => {
      let text = "";
      res.on("data", (chunk) => {
        if (text.length < 8192) text += chunk;
      });
      res.on("end", () => {
        try {
          const data = JSON.parse(text);
          resolve(
            res.statusCode === 200 && data.mode === "single-owner-local"
              ? data
              : null,
          );
        } catch {
          resolve(null);
        }
      });
    });
    req.setTimeout(timeout, () => req.destroy());
    req.on("error", () => resolve(null));
  });
}
function checkPort(config) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (e) => resolve(e.code || "error"));
    server.listen(Number(config.PORT), config.HOST, () =>
      server.close(() => resolve(null)),
    );
  });
}
async function waitUntilReady(url, child, waitMs = 12000) {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(
        "O servidor encerrou antes de ficar pronto. Confira a porta e a configuração.",
      );
    const status = await getStatus(url, 1000);
    if (status) return status;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(
    "O servidor não respondeu. Feche a janela anterior e tente abrir o iniciador novamente.",
  );
}
async function main(args = process.argv.slice(2)) {
  if (!supportedNode())
    throw new Error(
      "Instale o Node.js 22.17 ou mais recente em https://nodejs.org/en/download e abra o iniciador novamente.",
    );
  const file = path.join(ROOT, ".env");
  let text = readEnvFile(file),
    config = effectiveConfig(text);
  if (
    args.includes("--configure") ||
    !config.TRADE_ASSISTANT_PASSWORD ||
    config.TRADE_ASSISTANT_PASSWORD.length < 12
  ) {
    const result = await configure({ text });
    text = result.text;
    config = result.config;
    writeEnvAtomic(file, text);
    console.log("Configuração salva no computador. Nenhuma chave foi exibida.");
  }
  const issues = validateConfig(config);
  if (issues.length) throw new Error(issues.join(" "));
  const url = browserUrl(config),
    occupied = await checkPort(config);
  if (occupied) {
    if (occupied === "EADDRINUSE" && (await getStatus(url))) {
      console.log(
        "\nTrade Assistant já está aberto. Abrindo a conexão existente: " + url,
      );
      console.log(
        "Se você alterou as chaves, feche a janela anterior do servidor e abra o iniciador novamente.",
      );
      openBrowser(url);
      return;
    }
    throw new Error(
      "A porta " +
        config.PORT +
        " está ocupada ou indisponível. Feche o aplicativo que usa essa porta, ou ajuste PORT no .env.",
    );
  }
  console.log(
    "\nAbra o aplicativo por este iniciador, em vez de abrir o HTML isolado.",
  );
  console.log(
    "Seus dados do arquivo HTML ficam em outra origem do navegador. Exporte o backup antigo e restaure na versão conectada.",
  );
  console.log("Ao abrir, entre em Configurações com a senha definida acima.");
  console.log(
    "Mantenha esta janela aberta enquanto usa IA e dados ao vivo. Ctrl+C encerra o servidor.",
  );
  const env = { ...process.env, ...config },
    child = spawn(
      process.execPath,
      ["--env-file-if-exists=" + file, path.join(ROOT, "server/index.cjs")],
      { cwd: ROOT, env, stdio: ["inherit", "inherit", "pipe"] },
    );
  let stderr = "";
  child.stderr.on("data", (c) => {
    if (stderr.length < 8192) stderr += c.toString();
  });
  child.once("error", () =>
    console.error(
      "Não foi possível iniciar o Node.js. Verifique a instalação e abra o iniciador novamente.",
    ),
  );
  const stop = () => {
    if (child.exitCode === null) child.kill("SIGTERM");
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    await waitUntilReady(url, child);
    console.log("\nAplicativo pronto: " + url);
    openBrowser(url);
    await new Promise((resolve) => child.once("exit", resolve));
    if (child.exitCode && child.exitCode !== 0)
      throw new Error(
        stderr.includes("EADDRINUSE")
          ? "A porta está ocupada. Feche a outra janela do servidor."
          : "O servidor foi encerrado com erro. Confira a configuração e tente novamente.",
      );
  } finally {
    stop();
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error("\n" + error.message);
    process.exitCode = 1;
  });
module.exports = {
  supportedNode,
  parseEnv,
  encodeEnvValue,
  updateEnv,
  effectiveConfig,
  validateConfig,
  writeEnvAtomic,
  readEnvFile,
  configure,
  browserUrl,
  openBrowser,
  main,
};
