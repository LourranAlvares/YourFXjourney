/* Browser-only exports; all text, metrics and images come from the current workspace. */
let growthLogoPromise = null;
function growthLoadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
function growthLogo() {
  return (
    growthLogoPromise ||
    (growthLogoPromise = growthLoadImage(
      document.querySelector(".smc-logo")?.src || "public/smc-logo.png",
    ))
  );
}
function growthText(
  ctx,
  text,
  x,
  y,
  width,
  size = 32,
  lines = 4,
  color = "#d8dce3",
  weight = 400,
) {
  ctx.font = `${weight} ${size}px "SMC Inter", Arial, sans-serif`;
  ctx.fillStyle = color;
  const words = String(text ?? "").split(/\s+/),
    wrapped = [];
  let line = "";
  for (let word of words) {
    while (ctx.measureText(word).width > width && word.length > 1) {
      let count = word.length;
      while (count > 1 && ctx.measureText(word.slice(0, count)).width > width)
        count--;
      if (line) {
        wrapped.push(line);
        line = "";
      }
      wrapped.push(word.slice(0, count));
      word = word.slice(count);
    }
    if (ctx.measureText(line + " " + word).width > width && line) {
      wrapped.push(line);
      line = word;
    } else line += (line ? " " : "") + word;
  }
  if (line) wrapped.push(line);
  wrapped
    .slice(0, lines)
    .forEach((line, i) =>
      ctx.fillText(
        i === lines - 1 && wrapped.length > lines
          ? line.replace(/.{0,3}$/, "") + "…"
          : line,
        x,
        y + i * size * 1.4,
      ),
    );
  return y + Math.min(lines, wrapped.length) * size * 1.4;
}
function growthNum(n, digits = 2) {
  return n === null || n === undefined || !Number.isFinite(n)
    ? "—"
    : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(
        n,
      );
}
function growthAmount(n) {
  return new Intl.NumberFormat(
    "pt-BR",
    S.currency
      ? { style: "currency", currency: S.currency }
      : { maximumFractionDigits: 2 },
  ).format(n);
}
function growthR(m) {
  return m.r === null
    ? "R indisponível"
    : (m.r > 0 ? "+" : "") +
        growthNum(m.r) +
        " R" +
        (!m.rComplete ? " · parcial " + m.rKnown + "/" + m.rows.length : "");
}
function growthSceneContent(m, index, prefs) {
  const s = m.stats,
    period = m.range.from + " — " + (m.partial ? taDailyDate() : m.range.to),
    pct =
      m.percent === null
        ? "Percentual indisponível"
        : (m.percent > 0 ? "+" : "") + growthNum(m.percent) + "%",
    r = growthR(m),
    money = prefs.hideMoney ? "Valor monetário oculto" : growthAmount(s.net),
    plan = m.process.plan;
  const scenes = [
    {
      title:
        m.range.mode === "week" ? "Your Trading Week" : "Your Trading Month",
      lines: [
        period,
        m.partial ? "Período em andamento" : "Período encerrado",
        !prefs.hideName && taProfile().name
          ? taProfile().name
          : "SMC Elite · sua jornada",
      ],
      footer: "Prepare. Execute. Review.",
    },
    {
      title: "Trading Activity",
      lines: [
        s.n + " operações · " + m.days + " dias operados",
        s.w +
          " wins · " +
          s.l +
          " losses · " +
          (s.n - s.w - s.l) +
          " breakevens",
        "Instrumentos: " + (m.symbols.join(", ") || "nenhum registrado"),
        "Faixas da entrada no diário: " +
          (m.sessions.join(", ") || "abertura não informada"),
      ],
      footer:
        "Faixas de sessão seguem a classificação do Painel; não comprovam atividade.",
    },
    {
      title: "Trading Highlights",
      lines: m.highlights.length
        ? m.highlights.map(
            (h) =>
              h.label +
              ": " +
              h.trade.symbol +
              " · " +
              (h.r.value === null
                ? "R indisponível"
                : growthNum(h.r.value) + " R"),
          )
        : ["Sem operações neste período."],
      footer:
        prefs.hideMoney || prefs.hideName
          ? "Prints omitidos pelo modo de privacidade."
          : "Prints existentes somente com inclusão explícita.",
    },
    {
      title: "Discipline & Mindset",
      lines: [
        plan.value === null
          ? "Aderência: cobertura insuficiente"
          : growthNum(plan.value, 0) + "% de aderência entre os avaliados",
        plan.n + "/" + m.rows.length + " operações com plano avaliado",
        m.emotional.top
          ? "Emoção mais registrada: " +
            GrowthEngine.emotions[m.emotional.top][0]
          : "Sem check-ins neste período",
        m.emotional.fomoSessions + " sessões com FOMO declarado",
        m.emotional.afterLoss +
          " registros de frustração até 30 min após perda",
        ...(m.evolution
          ? [
              (m.evolution.delta > 0 ? "+" : "") +
                growthNum(m.evolution.delta, 1) +
                " pontos percentuais de aderência vs período anterior · " +
                m.evolution.previous +
                " e " +
                m.evolution.current +
                " avaliados",
            ]
          : []),
      ],
      footer:
        "Associações descritivas. Emoção e P&L não comprovam causa ou disciplina.",
    },
    {
      title: "Performance",
      lines: [
        s.n ? growthNum(s.wr, 1) + "% win rate" : "Win rate indisponível",
        "Profit factor: " +
          (!s.n || (!s.w && !s.l)
            ? "—"
            : s.pf === Infinity
              ? "∞"
              : growthNum(s.pf)),
        r,
        pct,
        prefs.hideMoney
          ? "Drawdown monetário oculto"
          : "Drawdown: " + growthAmount(s.dd),
        money,
      ],
      footer: m.estimated
        ? "Inclui P&L estimado; confira os registros."
        : "R por preço não desconta custos. Percentual exige saldo inicial confirmado.",
    },
    {
      title: "Personal Development",
      lines: [
        m.development,
        m.priority,
        m.reflection?.answers?.every((a) => a.trim())
          ? "Sua reflexão e sua prioridade foram registradas."
          : "Uma reflexão curta pode ajudar a escolher seu próximo foco.",
      ],
      footer: "Leitura por regras transparentes. Sem diagnóstico psicológico.",
    },
    {
      title:
        m.range.mode === "week"
          ? "Your Weekly Trading Performance"
          : "Your Monthly Trading Performance",
      lines: [
        pct,
        r,
        money,
        ...growthData()
          .certificates.filter(
            (c) =>
              c.status === "valid" &&
              c.range?.to >= m.range.from &&
              c.range?.to <= m.range.to,
          )
          .slice(0, 2)
          .map(
            (c) =>
              "Recognition · " +
              (GrowthEngine.definitions.find(
                (d) => d[0] === c.achievementId,
              )?.[1] || ""),
          ),
      ],
      footer: "Consistency is built through discipline.",
    },
  ];
  return scenes[index];
}
async function growthPaintReview(
  canvas,
  m,
  index,
  prefs,
  progress = 1,
  images = [],
) {
  await document.fonts.ready;
  const logo = await growthLogo(),
    c = canvas.getContext("2d"),
    w = canvas.width,
    h = canvas.height;
  c.save();
  c.scale(w / 1080, h / 1920);
  c.fillStyle = "#080b10";
  c.fillRect(0, 0, 1080, 1920);
  const gradient = c.createLinearGradient(0, 0, 1080, 1920);
  gradient.addColorStop(0, "#141923");
  gradient.addColorStop(1, "#07090d");
  c.fillStyle = gradient;
  c.fillRect(0, 0, 1080, 1920);
  c.strokeStyle = "#74603b";
  c.lineWidth = 2;
  c.strokeRect(40, 40, 1000, 1840);
  if (logo) c.drawImage(logo, 62, 58, 180, 120);
  else growthText(c, "SMC ELITE", 72, 130, 700, 40, 1, "#d7b982", 700);
  growthText(
    c,
    String(index + 1).padStart(2, "0") + " / 07",
    850,
    130,
    150,
    25,
    1,
    "#b4a384",
  );
  const content = growthSceneContent(m, index, prefs);
  const motion = !matchMedia("(prefers-reduced-motion:reduce)").matches;
  const enter = motion ? Math.min(1, progress * 7) : 1;
  c.globalAlpha = 0.35 + 0.65 * enter;
  c.translate(0, motion ? (1 - enter) * 14 : 0);
  let y =
    growthText(c, content.title, 76, 300, 928, 64, 3, "#f0ece4", 650) + 55;
  if (index === 2 && m.highlights.length) {
    const selected = Math.min(
        m.highlights.length - 1,
        Math.floor(progress * m.highlights.length),
      ),
      highlight = m.highlights[selected],
      image = images[selected];
    if (image && !prefs.hideMoney && !prefs.hideName && prefs.screenshots) {
      c.save();
      c.beginPath();
      c.rect(76, y, 928, 500);
      c.clip();
      const ratio =
          Math.min(928 / image.width, 500 / image.height) *
          0.96 *
          (1 +
            (matchMedia("(prefers-reduced-motion:reduce)").matches
              ? 0
              : 0.025 * progress)),
        iw = image.width * ratio,
        ih = image.height * ratio;
      c.drawImage(image, 76 + (928 - iw) / 2, y + (500 - ih) / 2, iw, ih);
      c.restore();
      y += 560;
    } else {
      y =
        growthText(
          c,
          "Seu registro, sem imagem ilustrativa.",
          76,
          y,
          900,
          30,
          2,
          "#969eab",
        ) + 25;
    }
    y = growthText(c, highlight.label, 76, y, 928, 38, 2, "#d7b982", 600) + 18;
    y =
      growthText(
        c,
        highlight.trade.symbol +
          " · " +
          (highlight.r.value === null
            ? "R indisponível"
            : growthNum(highlight.r.value) + " R"),
        76,
        y,
        928,
        58,
        2,
        "#ece7dd",
        600,
      ) + 25;
    if (!prefs.hideMoney)
      y = growthText(
        c,
        growthAmount(highlight.trade.pnl),
        76,
        y,
        928,
        38,
        1,
        highlight.trade.pnl < 0 ? "#e56c83" : "#66c6a8",
      );
    growthText(
      c,
      selected + 1 + " de " + m.highlights.length + " destaques",
      76,
      1580,
      900,
      28,
      1,
      "#a5adba",
    );
  } else {
    for (let i = 0; i < content.lines.length; i++) {
      const counter = motion ? Math.min(1, progress * 5) : 1;
      const text =
          index === 1 && i < 2
            ? content.lines[i].replace(/\d+/g, (value) =>
                String(Math.round(Number(value) * counter)),
              )
            : content.lines[i],
        large = (index === 6 && i < 2) || (index === 4 && i < 1);
      y =
        growthText(
          c,
          text,
          76,
          y,
          928,
          large ? 66 : index === 5 ? 36 : 40,
          index === 5 ? 5 : 3,
          i === 0 ? "#dfc28d" : "#d4d9e2",
          large ? 650 : 400,
        ) + 34;
    }
  }
  c.globalAlpha = 1;
  if ((index === 0 || index === 4 || index === 6) && m.stats.cv.length) {
    const values = [0, ...m.stats.cv],
      lo = Math.min(...values),
      hi = Math.max(...values),
      range = hi - lo || 1,
      x = 76,
      base = 1560,
      width = 928,
      height = 180;
    c.strokeStyle = m.stats.net < 0 ? "#d45b71" : "#d7b982";
    c.lineWidth = 5;
    c.beginPath();
    values.forEach((value, i) => {
      const xx = x + (i / (values.length - 1)) * width,
        yy = base - ((value - lo) / range) * height;
      i ? c.lineTo(xx, yy) : c.moveTo(xx, yy);
    });
    c.stroke();
  }
  growthText(c, content.footer, 76, 1730, 928, 28, 3, "#a7aebb");
  c.fillStyle = "#d7b982";
  c.fillRect(76, 1820, 928 * ((index + progress) / 7), 4);
  c.restore();
  return content;
}
function growthDownload(blob, name) {
  if (!blob) throw Error("O navegador não gerou o arquivo.");
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function growthPNG(canvas) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(Error("PNG indisponível neste navegador.")),
      "image/png",
    ),
  );
}
function growthVideoMime() {
  if (!HTMLCanvasElement.prototype.captureStream || !window.MediaRecorder)
    return null;
  return (
    [
      "video/mp4;codecs=avc1.42E01E",
      "video/mp4;codecs=avc1",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ].find(
      (t) =>
        MediaRecorder.isTypeSupported(t) &&
        document.createElement("video").canPlayType(t),
    ) || null
  );
}
function growthPDF(canvas) {
  const jpg = atob(canvas.toDataURL("image/jpeg", 0.95).split(",")[1]),
    image = Uint8Array.from(jpg, (c) => c.charCodeAt(0)),
    encode = (s) => new TextEncoder().encode(s),
    chunks = [encode("%PDF-1.4\n%SMC\n")],
    offset = [0];
  let length = chunks[0].length;
  const add = (bytes) => {
      chunks.push(bytes);
      length += bytes.length;
    },
    obj = (id, parts) => {
      offset[id] = length;
      add(encode(id + " 0 obj\n"));
      parts.forEach((p) => add(typeof p === "string" ? encode(p) : p));
      add(encode("\nendobj\n"));
    };
  obj(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  obj(2, ["<< /Type /Pages /Kids [3 0 R] /Count 1 >>"]);
  obj(3, [
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>",
  ]);
  obj(4, [
    `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`,
    image,
    "\nendstream",
  ]);
  const stream = "q 842 0 0 595 0 0 cm /Im0 Do Q";
  obj(5, [`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`]);
  const xref = length;
  add(
    encode(
      "xref\n0 6\n0000000000 65535 f \n" +
        offset
          .slice(1)
          .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
          .join("") +
        "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" +
        xref +
        "\n%%EOF",
    ),
  );
  return new Blob(chunks, { type: "application/pdf" });
}

async function growthPaintCertificate(canvas, certificate, hideName = true) {
  await document.fonts.ready;
  const logo = await growthLogo(),
    ctx = canvas.getContext("2d");
  ctx.save();
  ctx.scale(canvas.width / 2400, canvas.height / 1697);
  ctx.fillStyle = "#090c11";
  ctx.fillRect(0, 0, 2400, 1697);
  ctx.strokeStyle = "#b39660";
  ctx.lineWidth = 3;
  ctx.strokeRect(70, 70, 2260, 1557);
  ctx.strokeStyle = "#514735";
  ctx.lineWidth = 1;
  ctx.strokeRect(95, 95, 2210, 1507);
  if (logo) ctx.drawImage(logo, 1020, 110, 360, 240);
  ctx.textAlign = "center";
  growthText(
    ctx,
    "Certificate of Achievement",
    1200,
    440,
    2050,
    65,
    1,
    "#d7bd8a",
    400,
  );
  const name =
    GrowthEngine.definitions.find(
      (d) => d[0] === certificate.achievementId,
    )?.[1] || "Personal Trading Achievement";
  growthText(ctx, name, 1200, 610, 2050, 92, 2, "#f1ece2", 600);
  growthText(
    ctx,
    !hideName && certificate.holderName
      ? certificate.holderName
      : "Personal Trading Achievement",
    1200,
    830,
    2000,
    54,
    2,
    "#d6dbe2",
    500,
  );
  growthText(
    ctx,
    certificate.description || "",
    1200,
    960,
    1900,
    36,
    3,
    "#bcc3cd",
  );
  growthText(
    ctx,
    certificate.criterion || "",
    1200,
    1130,
    1950,
    24,
    2,
    "#9ca6b4",
  );
  growthText(
    ctx,
    "Período: " +
      (certificate.range?.from || "indisponível") +
      " — " +
      (certificate.range?.to || "indisponível"),
    1200,
    1230,
    1900,
    32,
    1,
    "#d2bc94",
  );
  growthText(
    ctx,
    "Emissão: " +
      new Date(certificate.issuedAt).toLocaleDateString("pt-BR") +
      " · " +
      certificate.id,
    1200,
    1295,
    2000,
    25,
    2,
    "#9ca6b4",
  );
  growthText(
    ctx,
    certificate.source || "Registros do usuário; sem auditoria externa.",
    1200,
    1380,
    2000,
    26,
    2,
    "#a9afb8",
  );
  ctx.strokeStyle = "#a88c57";
  ctx.beginPath();
  ctx.arc(1200, 1480, 36, 0, Math.PI * 2);
  ctx.stroke();
  growthText(ctx, "SMC", 1200, 1490, 100, 20, 1, "#d7bd8a", 600);
  growthText(
    ctx,
    "Issued by SMC Elite — Personal Trading Achievement",
    1200,
    1560,
    2000,
    27,
    1,
    "#b7a37e",
  );
  if (certificate.status === "invalidated") {
    ctx.save();
    ctx.translate(1200, 850);
    ctx.rotate(-0.15);
    ctx.globalAlpha = 0.85;
    growthText(ctx, "REGISTRO INVALIDADO", 0, 0, 2150, 110, 1, "#e46b7b", 700);
    ctx.restore();
  }
  ctx.restore();
  return canvas;
}
