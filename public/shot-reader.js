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
// Position-tool rectangles give an entry boundary independently of badge color.
function shotPositionBoundaries(canvas) {
  const w = canvas.width,
    h = canvas.height,
    d = canvas
      .getContext("2d", { willReadFrequently: true })
      .getImageData(0, 0, w, h).data;
  const bands = { red: [], green: [] },
    active = { red: null, green: null },
    minWidth = Math.max(45, w * 0.035);
  const color = (i) => {
    const r = d[i],
      g = d[i + 1],
      b = d[i + 2];
    return r - g > 12 && r - b > 12
      ? "red"
      : g - r > 9 && g - b > 7
        ? "green"
        : "";
  };
  for (let y = 0; y <= h; y++) {
    const best = { red: null, green: null };
    let start = 0,
      last = "";
    for (let x = Math.floor(w * 0.35); x <= w - 75 && y < h; x++) {
      const next = x < w - 75 ? color((y * w + x) * 4) : "";
      if (next !== last) {
        if (
          last &&
          x - start >= minWidth &&
          (!best[last] || x - start > best[last].right - best[last].left)
        )
          best[last] = { left: start, right: x };
        start = x;
        last = next;
      }
    }
    for (const kind of ["red", "green"]) {
      const row = best[kind],
        band = active[kind];
      if (
        row &&
        (!band ||
          Math.min(row.right, band.right) - Math.max(row.left, band.left) >
            minWidth * 0.7)
      ) {
        if (!band)
          active[kind] = {
            top: y,
            bottom: y + 1,
            left: row.left,
            right: row.right,
            rows: 1,
          };
        else {
          band.bottom = y + 1;
          band.rows++;
          band.left = Math.max(band.left, row.left);
          band.right = Math.min(band.right, row.right);
        }
      } else {
        if (band && band.rows >= 8 && band.right - band.left >= minWidth)
          bands[kind].push(band);
        active[kind] = row
          ? { top: y, bottom: y + 1, left: row.left, right: row.right, rows: 1 }
          : null;
      }
    }
  }
  const pairs = [];
  for (const r of bands.red)
    for (const g of bands.green) {
      const overlap = Math.min(r.right, g.right) - Math.max(r.left, g.left),
        gap = Math.min(Math.abs(r.bottom - g.top), Math.abs(g.bottom - r.top));
      if (overlap < minWidth || gap > Math.max(4, h * 0.004)) continue;
      const long = g.top < r.top,
        entryY = long ? (g.bottom + r.top) / 2 : (r.bottom + g.top) / 2;
      pairs.push({
        entryY,
        stopY: long ? r.bottom : r.top,
        targetY: long ? g.top : g.bottom,
        long,
        left: Math.max(r.left, g.left),
        right: Math.min(r.right, g.right),
      });
    }
  return pairs;
}
async function shotReadGeometricLabels(worker, canvas) {
  const pairs = shotPositionBoundaries(canvas);
  if (pairs.length !== 1)
    return {
      text: "",
      issues:
        pairs.length > 1
          ? ["Mais de uma ferramenta de posição visível. Recorte uma operação."]
          : [],
    };
  if (!worker.setParameters) return { text: "", issues: [] };
  const geometry = pairs[0],
    w = canvas.width,
    h = canvas.height,
    ctx = canvas.getContext("2d", { willReadFrequently: true }),
    d = ctx.getImageData(0, 0, w, h).data;
  const read = async (y, kind, style) => {
    const x0 = Math.max(0, w - Math.max(115, Math.round(w * 0.085))),
      pad = Math.max(18, Math.round(h * 0.022)),
      rows = [];
    const matches = (i) => {
      const r = d[i],
        g = d[i + 1],
        b = d[i + 2];
      return kind === "red"
        ? r > 140 && r > g * 1.4 && r > b * 1.2
        : kind === "green"
          ? g > 85 && g > r * 1.2 && g > b * 1.1
          : Math.max(r, g, b) - Math.min(r, g, b) < 20 && r < 185;
    };
    let xend = w;
    if (kind === "neutral")
      while (
        xend > x0 &&
        [-1, -0.5, 0, 0.5, 1].every((f) =>
          matches(
            (Math.max(0, Math.min(h - 1, Math.round(y + f * pad))) * w +
              xend -
              1) *
              4,
          ),
        )
      )
        xend--;
    for (
      let yy = Math.max(0, Math.floor(y - pad));
      yy < Math.min(h, Math.ceil(y + pad));
      yy++
    ) {
      let count = 0,
        left = w,
        right = 0;
      for (let x = x0; x < xend; x++)
        if (matches((yy * w + x) * 4)) {
          count++;
          left = Math.min(left, x);
          right = x + 1;
        }
      rows.push({ y: yy, count, left, right });
    }
    const groups = [];
    let group = null;
    for (const row of rows) {
      if (row.count >= Math.max(10, w * 0.006)) {
        if (!group)
          group = {
            top: row.y,
            bottom: row.y + 1,
            left: row.left,
            right: row.right,
            rows: 1,
            lefts: [row.left],
            rights: [row.right],
          };
        else {
          group.bottom = row.y + 1;
          group.left = Math.min(group.left, row.left);
          group.right = Math.max(group.right, row.right);
          group.rows++;
          group.lefts.push(row.left);
          group.rights.push(row.right);
        }
      } else if (group && row.y - group.bottom > 2) {
        groups.push(group);
        group = null;
      }
    }
    if (group) groups.push(group);
    const choices = groups
      .filter(
        (b) =>
          b.rows >= 5 &&
          b.bottom - b.top <= Math.max(44, h * 0.045) &&
          Math.abs((b.top + b.bottom) / 2 - y) <= Math.max(10, h * 0.012),
      )
      .sort(
        (a, b) =>
          Math.abs((a.top + a.bottom) / 2 - y) -
          Math.abs((b.top + b.bottom) / 2 - y),
      );
    if (!choices.length) return null;
    const box = choices[0];
    box.left = box.lefts.sort((a, b) => a - b)[
      Math.floor(box.lefts.length / 2)
    ];
    box.right = box.rights.sort((a, b) => a - b)[
      Math.floor(box.rights.length / 2)
    ];
    const cw = box.right - box.left,
      ch = box.bottom - box.top,
      samples = [];
    for (let yy = box.top; yy < box.bottom; yy++)
      for (let x = box.left; x < box.right; x++) {
        const i = (yy * w + x) * 4;
        if (matches(i))
          samples.push(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
      }
    samples.sort((a, b) => a - b);
    const bg = samples[Math.floor(samples.length * 0.35)];
    const small = document.createElement("canvas");
    small.width = cw + 8;
    small.height = ch + 8;
    const sx = small.getContext("2d");
    sx.fillStyle = "white";
    sx.fillRect(0, 0, small.width, small.height);
    const pixels = sx.getImageData(4, 4, cw, ch);
    for (let yy = 0; yy < ch; yy++)
      for (let x = 0; x < cw; x++) {
        const i = ((yy + box.top) * w + x + box.left) * 4,
          j = (yy * cw + x) * 4,
          lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        pixels.data[j] =
          pixels.data[j + 1] =
          pixels.data[j + 2] =
            style === "soft"
              ? 255 -
                Math.round(
                  Math.max(0, Math.min(1, (lum - bg) / Math.max(1, 255 - bg))) *
                    255,
                )
              : lum > bg + (255 - bg) * style
                ? 0
                : 255;
        pixels.data[j + 3] = 255;
      }
    sx.putImageData(pixels, 4, 4);
    const c = document.createElement("canvas");
    c.width = small.width * 4;
    c.height = small.height * 4;
    c.getContext("2d").drawImage(small, 0, 0, c.width, c.height);
    const values = [];
    for (const mode of ["7", "6", "8", "13"]) {
      await worker.setParameters({
        tessedit_pageseg_mode: mode,
        tessedit_char_whitelist: "0123456789.,",
      });
      const result = await worker.recognize(c),
        text = (result.data.text || "").trim().replace(/\s/g, "");
      if (/^\d{1,8}(?:[.,]\d{1,8})?$/.test(text))
        values.push(text.replace(",", "."));
    }
    const options = [...new Set(values)],
      votes = options.map((value) => ({
        raw: value,
        votes: values.filter(
          (v) =>
            v === value ||
            (!v.includes(".") &&
              value.includes(".") &&
              v === value.replace(".", "")),
        ).length,
      }));
    return votes
      .filter((v) => v.votes >= 2)
      .map((v) => ({
        ...v,
        value: Number(v.raw),
        precision: v.raw.includes(".") ? v.raw.split(".")[1].length : 0,
      }));
  };
  try {
    for (const style of ["soft", 0.15, 0.45]) {
      const stops = await read(geometry.stopY, "red", style),
        entries = await read(geometry.entryY, "neutral", style),
        targets = await read(geometry.targetY, "green", style),
        valid = new Map();
      if (!stops || !entries || !targets) continue;
      for (const s of stops)
        for (const e of entries)
          for (const t of targets) {
            const values = [s, e, t],
              precisions = values
                .filter((v) => v.precision > 0)
                .map((v) => v.precision),
              distinct = [...new Set(precisions)];
            if (distinct.length > 1) continue;
            const precision = distinct[0] || 0;
            if (precision > 0 && precisions.length < 2) continue;
            const normalized = values.map((v) =>
              v.precision === precision
                ? v.value
                : v.precision === 0 && v.raw.length > precision
                  ? v.value / 10 ** precision
                  : NaN,
            );
            if (normalized.some((v) => !Number.isFinite(v) || v <= 0)) continue;
            const [stop, entry, target] = normalized;
            if (
              !(geometry.long
                ? stop < entry && entry < target
                : target < entry && entry < stop)
            )
              continue;
            const pixelRatio =
                Math.abs(geometry.targetY - geometry.entryY) /
                Math.abs(geometry.stopY - geometry.entryY),
              priceRatio = Math.abs(target - entry) / Math.abs(stop - entry);
            if (Math.abs(priceRatio / pixelRatio - 1) > 0.22) continue;
            valid.set(normalized.join("|"), {
              stop,
              entry,
              target,
              decimalRestored: values.some((v) => v.precision !== precision),
            });
          }
      if (valid.size !== 1) continue;
      const { stop, entry, target, decimalRestored } = [...valid.values()][0];
      return {
        text: `\nEntry price: ${entry}\nStop loss: ${stop}\nTarget price: ${target}`,
        issues: [
          "Entrada identificada na divisão entre as áreas de alvo e stop. Confira os preços com o print.",
          ...(decimalRestored
            ? [
                "Separador decimal recuperado pela precisão das outras duas etiquetas da mesma escala. Revise os números.",
              ]
            : []),
        ],
      };
    }
    return {
      text: "",
      issues: [
        "Confira os números da ferramenta: a leitura das etiquetas não foi consistente com a escala.",
      ],
    };
  } finally {
    await worker.setParameters({
      tessedit_pageseg_mode: "11",
      tessedit_char_whitelist: "",
    });
  }
}

const shotReadLabelsStrict = readPositionLabels;
readPositionLabels = async function (worker, canvas) {
  const geometric = await shotReadGeometricLabels(worker, canvas);
  if (geometric.text) return geometric;
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
  return { text: direct.text, issues: [...geometric.issues, ...direct.issues] };
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
