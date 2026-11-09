/* Local TradingView OCR: bounded adaptive passes, no external upload or inferred realized P&L. */
const shotParseStrict = parseTradingShot;
parseTradingShot = function (text) {
  const normalized = String(text || "")
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .replace(/[−–]/g, "-")
    .replace(
      /\s+(?=(?:Entry price|Stop loss(?: price)?|Target price|Take profit(?: price)?|Risk amount|Realized P&L)\s*[:=|])/gi,
      "\n",
    );
  const lines = normalized.split(/\r?\n/).map((line) => {
    let value = line.trim();
    // Separators are optional in OCR output, but price labels stay explicit.
    value = value.replace(
      /^(Entry(?: price)?|Pre[cç]o (?:de )?entrada|Entrada|Stop loss(?: price)?|Stop price|Pre[cç]o (?:do )?stop|SL|Take profit(?: price)?|Target price|Pre[cç]o (?:do )?alvo|Alvo|TP|Risk amount|Risco monet[aá]rio|Realized P&L|P&L realizado|Resultado l[ií]quido realizado|Quantity|Quantidade|Qty)\s*(?:[:=|]\s*|\s+)(?=[+\-£$€\d])/i,
      "$1: ",
    );
    // Common OCR pair formatting, including lowercase and slash-separated FX symbols.
    value = value.replace(
      /\b(EUR|GBP|USD|AUD|NZD|CAD|CHF|JPY|XAU|XAG|BTC|ETH)\s*[/·-]?\s*(USD[T]?|EUR|GBP|JPY|CHF|CAD|AUD|NZD)\b/gi,
      (m) => m.replace(/[\s/·-]/g, "").toUpperCase(),
    );
    value = value.replace(/^(?:S[yv]mbol|Ativo|Ticker)\s*[|=]\s*/i, "Symbol: ");
    return value;
  });
  const aliases = lines.slice(0, 6).flatMap((line) => {
    if (
      /^(?:Gold Spot\s*\/\s*(?:U\.?S\.? Dollar|USD)|Ouro\s*\/\s*D[oó]lar)\b/i.test(
        line,
      )
    )
      return ["Symbol: XAUUSD"];
    if (/^Silver Spot\s*\/\s*(?:U\.?S\.? Dollar|USD)\b/i.test(line))
      return ["Symbol: XAGUSD"];
    return [];
  });
  const parsed = shotParseStrict([...aliases, ...lines].join("\n"));
  // The asset can appear below a toolbar. Only explicit labels may be read outside the header.
  if (!parsed.fields.symbol) {
    const explicit = lines.filter((l) =>
      /^(?:Symbol|Ativo|Ticker)\s*:/i.test(l),
    );
    if (explicit.length) {
      const extra = shotParseStrict(explicit.join("\n"));
      if (
        extra.fields.symbol &&
        !parsed.issues.some((i) => i.includes("Vários ativos"))
      )
        parsed.fields.symbol = extra.fields.symbol;
    }
  }
  const sideValues = [
    ...new Set(
      lines.flatMap((line) => {
        const m = line.match(
          /^(?:Direction|Side|Dire[cç][aã]o|Tipo de ordem)\s*[:=|]\s*(Buy|Sell|Long|Short|Compra|Venda)\s*$/i,
        );
        return m
          ? [/^(?:Buy|Long|Compra)$/i.test(m[1]) ? "long" : "short"]
          : [];
      }),
    ),
  ];
  if (sideValues.length === 1) {
    if (parsed.fields.side && parsed.fields.side !== sideValues[0]) {
      delete parsed.fields.side;
      parsed.issues.push(
        "Direção informada diverge dos preços; confirme manualmente.",
      );
    } else parsed.fields.side = sideValues[0];
  } else if (sideValues.length > 1) {
    delete parsed.fields.side;
    parsed.issues.push("Direções conflitantes no print; confirme manualmente.");
  }
  return parsed;
};
function shotOCRCanvas(source, rect, maxWidth = 3200) {
  const [x, y, w, h] = rect,
    scale = Math.min(2.5, maxWidth / w, Math.sqrt(5000000 / (w * h))),
    c = document.createElement("canvas");
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(source, x, y, w, h, 0, 0, c.width, c.height);
  const pixels = ctx.getImageData(0, 0, c.width, c.height),
    d = pixels.data,
    samples = [];
  for (let i = 0; i < d.length; i += 400)
    samples.push((d[i] + d[i + 1] + d[i + 2]) / 3);
  samples.sort((a, b) => a - b);
  const dark = samples[Math.floor(samples.length / 2)] < 128;
  for (let i = 0; i < d.length; i += 4) {
    let lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    if (dark) lum = 255 - lum;
    lum = Math.max(0, Math.min(255, (lum - 25) * 1.2));
    d[i] = d[i + 1] = d[i + 2] = lum;
    d[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  return c;
}
const shotReadLabelsStrict = readPositionLabels;
readPositionLabels = async function (worker, canvas) {
  const direct = await shotReadLabelsStrict(worker, canvas);
  if (direct.text) return direct;
  const { width: w, height: h } = canvas,
    ctx = canvas.getContext("2d", { willReadFrequently: true }),
    d = ctx.getImageData(0, 0, w, h).data,
    ends = new Map();
  // Locate solid red/green price badges even when panels sit to the right of the scale.
  const kind = (x, y) => {
    const i = (y * w + x) * 4,
      r = d[i],
      g = d[i + 1],
      b = d[i + 2];
    return r > 150 && r > g * 1.5 && g < 150
      ? "red"
      : g > 90 && g > r * 1.4 && b > r * 1.2
        ? "green"
        : "";
  };
  for (let y = 1; y < h - 1; y += 2) {
    let start = 0,
      last = "";
    for (let x = Math.floor(w * 0.5); x <= w; x++) {
      const next = x < w ? kind(x, y) : "";
      if (next !== last) {
        const len = x - start;
        if (last && len >= 40 && len <= 180) {
          const key = Math.round(x / 5) * 5;
          let c = ends.get(key);
          if (!c) ends.set(key, (c = { edge: x, red: 0, green: 0 }));
          c[last]++;
          c.edge = Math.max(c.edge, x);
        }
        start = x;
        last = next;
      }
    }
  }
  const candidates = [...ends.values()]
      .filter((c) => c.red >= 2 && c.green >= 2 && c.edge < w - 100)
      .sort((a, b) => b.red + b.green - (a.red + a.green))
      .slice(0, 2),
    results = [];
  for (const candidate of candidates) {
    const crop = document.createElement("canvas");
    crop.width = Math.min(w, candidate.edge + 6);
    crop.height = h;
    crop.getContext("2d").drawImage(canvas, 0, 0);
    const r = await shotReadLabelsStrict(worker, crop);
    if (r.text) results.push(r);
  }
  const distinct = [...new Set(results.map((r) => r.text))];
  if (distinct.length === 1) return results[0];
  if (distinct.length > 1)
    return {
      text: "",
      issues: [
        "Mais de uma posição visível. Recorte a operação que deseja registrar.",
      ],
    };
  return direct;
};
let shotChartQueue = Promise.resolve();
function shotReadChart(worker, canvas, current, status) {
  const work = async () => {
    const check = () => {
      if (!current()) throw Error("Leitura cancelada.");
    };
    const params = async (p) => {
      if (worker.setParameters) await worker.setParameters(p);
    };
    check();
    await params({
      tessedit_pageseg_mode: "11",
      tessedit_char_whitelist: "",
      user_defined_dpi: "300",
    });
    status("Lendo os rótulos do gráfico…");
    const result = await worker.recognize(canvas);
    check();
    let text = result.data.text || "",
      parsed = parseTradingShot(text);
    if (!parsed.fields.symbol) {
      status("Ampliando o cabeçalho para identificar o ativo…");
      const header = shotOCRCanvas(canvas, [
        0,
        0,
        canvas.width,
        Math.max(1, Math.min(canvas.height, Math.round(canvas.height * 0.22))),
      ]);
      const extra = await worker.recognize(header);
      check();
      // Keep full evidence: contradictory assets remain unresolved.
      text = (extra.data.text || "") + "\n" + text;
      parsed = parseTradingShot(text);
    }
    status("Verificando entrada, stop e alvo…");
    const levels = await readPositionLabels(worker, canvas);
    check();
    parsed = parseTradingShot(text + levels.text);
    if (!parsed.fields.entry && !parsed.fields.stop && !parsed.fields.target) {
      status("Tentando novamente com mais contraste…");
      await params({ tessedit_pageseg_mode: "6" });
      const enhanced = shotOCRCanvas(canvas, [
        0,
        0,
        canvas.width,
        canvas.height,
      ]);
      const retry = await worker.recognize(enhanced);
      check();
      text += "\n" + (retry.data.text || "");
      parsed = parseTradingShot(text);
    }
    parsed = parseTradingShot(text + levels.text);
    parsed.issues.push(...levels.issues);
    return { result, levels, parsed };
  };
  const job = shotChartQueue.catch(() => {}).then(() => shotWait(work()));
  shotChartQueue = job.catch(() => {});
  return job;
}
