/* MT5 closed-position reports. Never estimate cash profits from lot sizes. */
function mt5Header(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[:.]+$/, "")
    .replace(/\s*\/\s*/g, "/");
}
function mt5Number(value) {
  let s = String(value ?? "")
    .trim()
    .replace(/[\s\u00a0']/g, "")
    .replace("−", "-");
  if (!s || s === "—" || s === "-") return null;
  if (!/^[+-]?[\d.,]+$/.test(s)) return null;
  const comma = s.lastIndexOf(","),
    dot = s.lastIndexOf(".");
  if (comma >= 0 && dot >= 0)
    s =
      comma > dot
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "");
  else if (comma >= 0) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function mt5Time(value) {
  const m = String(value || "")
    .trim()
    .match(/^(\d{4})[.-](\d{2})[.-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m,
    dt = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(se || 0)));
  if (
    dt.getUTCFullYear() !== +y ||
    dt.getUTCMonth() !== +mo - 1 ||
    dt.getUTCDate() !== +d ||
    +h > 23 ||
    +mi > 59 ||
    +(se || 0) > 59
  )
    return null;
  return `${y}-${mo}-${d}T${h}:${mi}${se ? ":" + se : ""}`;
}
function mt5Rows(text) {
  if (/<(?:!doctype|html|table)\b/i.test(text)) {
    const doc = new DOMParser().parseFromString(
      text
        .replace(
          /<(script|style|iframe|object|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
          "",
        )
        .replace(
          /<\/?(?!table\b|tr\b|td\b|th\b|thead\b|tbody\b|tfoot\b)[a-z][^>]*>/gi,
          "",
        ),
      "text/html",
    );
    return [...doc.querySelectorAll("tr")].map((row) =>
      [...row.querySelectorAll(":scope > td,:scope > th")].map((cell) =>
        cell.textContent.trim(),
      ),
    );
  }
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/),
    header = lines.find(
      (line) =>
        /symbol|s[ií]mbolo|ativo/i.test(line) &&
        /profit|lucro|resultado/i.test(line),
    );
  if (header?.includes("\t"))
    return lines.map((line) => line.split("\t").map((x) => x.trim()));
  return csv(header ? lines.slice(lines.indexOf(header)).join("\n") : text);
}
function parseMT5(text) {
  const rows = mt5Rows(text);
  let header = null,
    index = -1;
  const names = {
    symbol: ["symbol", "simbolo", "ativo"],
    type: ["type", "tipo", "side", "direcao"],
    ticket: ["position", "posicao", "ticket", "position id"],
    profit: ["profit", "lucro", "resultado", "profit/loss"],
    net: [
      "net profit",
      "net profit/loss",
      "lucro liquido",
      "resultado liquido",
    ],
    commission: ["commission", "comissao"],
    swap: ["swap"],
    fee: ["fee", "taxa", "fees"],
    volume: ["volume", "lots", "lotes"],
    stop: ["s/l", "sl", "stop loss"],
    target: ["t/p", "tp", "take profit"],
    open: [
      "open time",
      "opening time",
      "horario de abertura",
      "hora de abertura",
    ],
    close: [
      "close time",
      "closing time",
      "horario de fechamento",
      "hora de fechamento",
    ],
    entry: ["open price", "opening price", "preco de abertura"],
    exit: ["close price", "closing price", "preco de fechamento"],
  };
  const find = (h, key) => h.findIndex((v) => names[key].includes(v));
  for (let i = 0; i < rows.length; i++) {
    const h = rows[i].map(mt5Header),
      time = h
        .map((v, j) =>
          ["time", "horario", "hora", "data/hora"].includes(v) ? j : -1,
        )
        .filter((j) => j >= 0),
      price = h
        .map((v, j) => (["price", "preco"].includes(v) ? j : -1))
        .filter((j) => j >= 0);
    if (
      find(h, "symbol") >= 0 &&
      find(h, "type") >= 0 &&
      find(h, "ticket") >= 0 &&
      (find(h, "profit") >= 0 || find(h, "net") >= 0) &&
      (time.length >= 2 || (find(h, "open") >= 0 && find(h, "close") >= 0)) &&
      (price.length >= 2 || (find(h, "entry") >= 0 && find(h, "exit") >= 0))
    ) {
      header = { h, time, price };
      index = i;
      break;
    }
  }
  if (!header) {
    if (/MetaTrader\s*5|\bMT5\b/i.test(text))
      return {
        err: "Relatório MT5 reconhecido, mas sem a tabela de posições fechadas. No MT5: Histórico → Todo o histórico → Relatório → HTML. Envie o relatório com abertura, fechamento e lucro; listas de ordens ou negócios isolados não comprovam a operação completa.",
      };
    return null;
  }
  const { h, time, price } = header,
    col = (key) => find(h, key),
    get = (row, key) => row[col(key)],
    openCol = col("open") >= 0 ? col("open") : time[0],
    closeCol = col("close") >= 0 ? col("close") : time[1],
    entryCol = col("entry") >= 0 ? col("entry") : price[0],
    exitCol = col("exit") >= 0 ? col("exit") : price[1];
  const trades = [];
  let skipped = 0;
  for (const row of rows.slice(index + 1)) {
    if (
      row.some((v) =>
        /^(orders|deals|ordens|negocios|open positions|posicoes abertas)$/i.test(
          mt5Header(v),
        ),
      )
    )
      break;
    const type = mt5Header(get(row, "type"));
    if (!["buy", "sell", "compra", "venda"].includes(type)) continue;
    const symbol = String(get(row, "symbol") || "").trim(),
      ticket = String(get(row, "ticket") || "").trim(),
      open = mt5Time(row[openCol]),
      close = mt5Time(row[closeCol]),
      profit = mt5Number(get(row, col("net") >= 0 ? "net" : "profit"));
    if (
      !symbol ||
      !ticket ||
      !open ||
      !close ||
      close < open ||
      profit === null
    ) {
      skipped++;
      continue;
    }
    const costs = {};
    let invalid = false;
    for (const key of ["commission", "swap", "fee"])
      if (col(key) >= 0) {
        const raw = get(row, key),
          value = mt5Number(raw);
        if (
          value === null &&
          String(raw || "").trim() &&
          !["—", "-"].includes(String(raw).trim())
        )
          invalid = true;
        costs[key] = value || 0;
      }
    if (invalid) {
      skipped++;
      continue;
    }
    const pnl =
        profit +
        (col("net") >= 0 ? 0 : Object.values(costs).reduce((a, b) => a + b, 0)),
      riskFields = importedRiskFields(h, [row]);
    trades.push(
      mk({
        symbol: symbol.toUpperCase(),
        side: ["buy", "compra"].includes(type) ? "long" : "short",
        open,
        close,
        entry: mt5Number(row[entryCol]),
        exit: mt5Number(row[exitCol]),
        size: mt5Number(get(row, "volume")),
        ...riskFields,
        stop:
          mt5Number(get(row, "stop")) > 0
            ? mt5Number(get(row, "stop"))
            : (riskFields.stop ?? null),
        target:
          mt5Number(get(row, "target")) > 0
            ? mt5Number(get(row, "target"))
            : (riskFields.target ?? null),
        pnl,
        est: false,
        importSource: "mt5",
        mt5StopConfirmed: false,
        mt5Ticket: ticket,
        mt5Costs: costs,
        ext:
          "MT5|" +
          ticket +
          "|" +
          symbol.toUpperCase() +
          "|" +
          open +
          "|" +
          close +
          "|" +
          String(mt5Number(get(row, "volume")) ?? get(row, "volume")) +
          "|" +
          String(mt5Number(row[exitCol]) ?? row[exitCol]),
      }),
    );
  }
  if (!trades.length)
    return {
      err: "Nenhuma posição fechada válida foi encontrada no relatório MT5. Confira se o relatório inclui os horários de abertura e fechamento e o lucro realizado.",
    };
  return {
    trades,
    note: `MT5: posições fechadas; ${col("net") >= 0 ? "resultado líquido do relatório" : "lucro + comissão + swap + taxas, quando presentes"}. Horários mantidos como no relatório da corretora. ${skipped ? skipped + " linha(s) incompleta(s) ignorada(s). " : ""}S/L do relatório pode ter sido alterado durante a operação: confirme o stop inicial antes de usar R.`,
    skipped,
  };
}
function importMT5(parsed) {
  if (parsed.err) return parsed;
  const existing = new Map(
      S.trades.filter((t) => t.ext).map((t) => [t.ext, t]),
    ),
    seen = new Set(existing.keys()),
    fresh = [];
  let dup = 0;
  for (const t of parsed.trades) {
    if (seen.has(t.ext)) {
      dup++;
      continue;
    }
    seen.add(t.ext);
    fresh.push(t);
  }
  const next = { ...S, trades: [...S.trades, ...fresh] };
  try {
    persistState(next);
  } catch {
    return {
      err: "Não foi possível salvar o histórico. Libere espaço ou exporte um backup; os registros anteriores foram mantidos.",
    };
  }
  S = next;
  return { ok: fresh.length, dup, enriched: 0, note: parsed.note };
}
