/* Trade Assistant: timezone-aware sessions using IANA zones, including DST transitions. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SessionEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const pad = (n) => String(n).padStart(2, "0"),
    formatters = new Map();
  function checkZone(zone) {
    if (typeof zone !== "string" || zone.length > 100)
      throw new Error("Fuso horário inválido.");
    try {
      new Intl.DateTimeFormat("en-GB", { timeZone: zone }).format(0);
    } catch {
      throw new Error("Fuso horário IANA inválido.");
    }
    return zone;
  }
  function formatter(zone) {
    if (!formatters.has(zone)) {
      checkZone(zone);
      formatters.set(
        zone,
        new Intl.DateTimeFormat("en-GB", {
          timeZone: zone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
        }),
      );
    }
    return formatters.get(zone);
  }
  function validInstant(value) {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) throw new Error("Data inválida.");
    return d;
  }
  function zonedParts(value = new Date(), timezone = "Europe/London") {
    const d = validInstant(value),
      parts = Object.fromEntries(
        formatter(timezone)
          .formatToParts(d)
          .filter((p) => p.type !== "literal")
          .map((p) => [p.type, +p.value]),
      ),
      weekday =
        ((new Date(
          Date.UTC(parts.year, parts.month - 1, parts.day),
        ).getUTCDay() +
          6) %
          7) +
        1;
    return {
      ...parts,
      weekday,
      date: parts.year + "-" + pad(parts.month) + "-" + pad(parts.day),
      time: pad(parts.hour) + ":" + pad(parts.minute),
      timezone,
    };
  }
  function parseDate(date) {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))
      throw new Error("Use uma data YYYY-MM-DD.");
    const [y, m, d] = date.split("-").map(Number),
      check = new Date(0);
    check.setUTCFullYear(y, m - 1, d);
    check.setUTCHours(12, 0, 0, 0);
    if (
      check.getUTCFullYear() !== y ||
      check.getUTCMonth() + 1 !== m ||
      check.getUTCDate() !== d
    )
      throw new Error("Data de calendário inválida.");
    return [y, m, d];
  }
  function utcNumber(parts) {
    const date = new Date(0);
    date.setUTCFullYear(parts[0], parts[1] - 1, parts[2]);
    date.setUTCHours(parts[3] || 0, parts[4] || 0, parts[5] || 0, 0);
    return date.getTime();
  }
  function shiftDate(date, days) {
    const [y, m, d] = parseDate(date),
      instant = new Date(utcNumber([y, m, d, 12]));
    instant.setUTCDate(instant.getUTCDate() + days);
    return (
      instant.getUTCFullYear() +
      "-" +
      pad(instant.getUTCMonth() + 1) +
      "-" +
      pad(instant.getUTCDate())
    );
  }
  function parseTime(time) {
    if (typeof time !== "string" || !/^\d{2}:\d{2}$/.test(time))
      throw new Error("Use o horário HH:mm.");
    const [h, m] = time.split(":").map(Number);
    if (h > 23 || m > 59) throw new Error("Horário inválido.");
    return [h, m];
  }
  function zonedDateTimeToUtc(
    date,
    time,
    timezone = "Europe/London",
    disambiguation = "compatible",
  ) {
    checkZone(timezone);
    if (!["compatible", "earlier", "later", "reject"].includes(disambiguation))
      throw new Error("Desambiguação inválida.");
    const targetParts = [...parseDate(date), ...parseTime(time)],
      target = utcNumber(targetParts),
      offsets = new Set();
    for (let hours = -36; hours <= 36; hours += 6) {
      const instant = target + hours * 36e5,
        local = zonedParts(instant, timezone);
      offsets.add(
        utcNumber([
          local.year,
          local.month,
          local.day,
          local.hour,
          local.minute,
          local.second,
        ]) - instant,
      );
    }
    const exact = [],
      near = [];
    for (const offset of offsets) {
      const instant = target - offset,
        local = zonedParts(instant, timezone),
        wall = utcNumber([
          local.year,
          local.month,
          local.day,
          local.hour,
          local.minute,
        ]);
      if (wall === target) exact.push(instant);
      near.push({ instant, delta: wall - target });
    }
    exact.sort((a, b) => a - b);
    if (exact.length) {
      if (exact.length > 1 && disambiguation === "reject")
        throw new Error("Horário repetido pela mudança de horário de verão.");
      return new Date(
        disambiguation === "later" ? exact.at(-1) : exact[0],
      ).toISOString();
    }
    if (disambiguation === "reject")
      throw new Error("Horário inexistente pela mudança de horário de verão.");
    const side =
      disambiguation === "earlier"
        ? near.filter((n) => n.delta < 0).sort((a, b) => b.delta - a.delta)
        : near.filter((n) => n.delta > 0).sort((a, b) => a.delta - b.delta);
    if (!side.length) throw new Error("Não foi possível converter o horário.");
    return new Date(side[0].instant).toISOString();
  }
  function validateSession(config) {
    if (!config || typeof config !== "object" || Array.isArray(config))
      throw new Error("Configure sua sessão de trading.");
    const timezone = checkZone(config.timezone),
      start = config.start,
      end = config.end;
    parseTime(start);
    parseTime(end);
    if (start === end)
      throw new Error("Início e fim da sessão devem ser diferentes.");
    if (
      !Array.isArray(config.days) ||
      config.days.length < 1 ||
      config.days.some((d) => !Number.isInteger(d) || d < 1 || d > 7)
    )
      throw new Error("Selecione dias de 1 (segunda) a 7 (domingo).");
    return {
      label:
        typeof config.label === "string"
          ? config.label.trim().slice(0, 100)
          : "Minha sessão",
      timezone,
      start,
      end,
      days: [...new Set(config.days)].sort((a, b) => a - b),
    };
  }
  function sessionInterval(config, date) {
    const c = validateSession(config),
      [y, m, d] = parseDate(date),
      weekday = ((new Date(utcNumber([y, m, d])).getUTCDay() + 6) % 7) + 1;
    if (!c.days.includes(weekday)) return null;
    const overnight = c.end < c.start,
      startAt = zonedDateTimeToUtc(date, c.start, c.timezone),
      endAt = zonedDateTimeToUtc(
        overnight ? shiftDate(date, 1) : date,
        c.end,
        c.timezone,
        "later",
      );
    if (Date.parse(endAt) <= Date.parse(startAt)) return null;
    return { startAt, endAt, date, overnight, timezone: c.timezone };
  }
  function sessionOverview(config, now = new Date()) {
    let c;
    try {
      c = validateSession(config);
      validInstant(now);
    } catch (e) {
      return {
        configured: false,
        status: "unconfigured",
        error: e.message,
        label: config?.label || "Minha sessão",
        timezone: config?.timezone || null,
        start: config?.start || null,
        end: config?.end || null,
        days: [],
        localDate: null,
        startAt: null,
        endAt: null,
        nextStartAt: null,
        nextEndAt: null,
        secondsRemaining: null,
        current: null,
        next: null,
      };
    }
    const currentTime = new Date(now).getTime(),
      local = zonedParts(now, c.timezone),
      intervals = [];
    for (let i = -1; i <= 8; i++) {
      const interval = sessionInterval(c, shiftDate(local.date, i));
      if (interval) intervals.push(interval);
    }
    const active = intervals.find(
        (i) =>
          Date.parse(i.startAt) <= currentTime &&
          currentTime < Date.parse(i.endAt),
      ),
      next = intervals.find((i) => Date.parse(i.startAt) > currentTime),
      today = intervals.find((i) => i.date === local.date),
      finished = today && Date.parse(today.endAt) <= currentTime,
      status = active ? "active" : finished ? "finished" : "upcoming",
      shown = active || (finished && today) || next;
    if (!shown || !next)
      return {
        configured: false,
        status: "unconfigured",
        error: "Não foi encontrada uma sessão no período configurado.",
        secondsRemaining: null,
        current: null,
        next: null,
      };
    return {
      ...c,
      configured: true,
      status,
      localDate: local.date,
      startAt: shown.startAt,
      endAt: shown.endAt,
      nextStartAt: next.startAt,
      nextEndAt: next.endAt,
      secondsRemaining: Math.max(
        0,
        Math.ceil(
          ((active ? Date.parse(active.endAt) : Date.parse(next.startAt)) -
            currentTime) /
            1000,
        ),
      ),
      current: active ? { ...active } : null,
      next: { ...next },
    };
  }
  function formatInZone(date, timezone = "Europe/London", options = {}) {
    checkZone(timezone);
    return new Intl.DateTimeFormat("pt-PT", {
      ...(Object.keys(options).length
        ? options
        : { dateStyle: "short", timeStyle: "short" }),
      timeZone: timezone,
    }).format(validInstant(date));
  }
  return Object.freeze({
    checkZone,
    zonedParts,
    zonedDateTimeToUtc,
    shiftDate,
    validateSession,
    sessionInterval,
    sessionOverview,
    formatInZone,
  });
});
