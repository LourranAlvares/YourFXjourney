"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  { createProviders } = require("../providers.cjs");
test("hourly-derived daily return: real sign, zero, no prior close, delayed date, future rejection and shared cache", async () => {
  for (const [last, previous, expected] of [
    [110, 100, 10],
    [90, 100, -10],
    [100, 100, 0],
    [110, null, null],
  ]) {
    let calls = 0;
    const provider = createProviders({
        env: { TRADE_MARKET_KEY: "synthetic" },
        now: () => new Date("2026-10-31T12:00Z"),
        fetchFn: async () => {
          calls++;
          return Response.json({
            values: [
              {
                datetime: "2026-10-30 18:00:00",
                high: last + 1,
                low: last - 1,
                close: last,
              },
              ...(previous === null
                ? []
                : [
                    {
                      datetime: "2026-10-29 23:00:00",
                      high: previous + 1,
                      low: previous - 1,
                      close: previous,
                    },
                  ]),
            ],
          });
        },
      }),
      q = new URLSearchParams({ symbols: "EURUSD", timezone: "UTC" }),
      r = await provider.market(q),
      i = r.instruments[0];
    if (expected === null) assert.equal(i.dayChangePercent, null);
    else assert(Math.abs(i.dayChangePercent - expected) < 1e-10);
    assert.equal(i.dayChangeDate, "2026-10-30");
    assert.equal(i.atrPercent, null);
    await provider.market(q);
    assert.equal(calls, 1);
  }
  const future = createProviders({
    env: { TRADE_MARKET_KEY: "synthetic" },
    now: () => new Date("2026-10-30T12:00Z"),
    fetchFn: async () =>
      Response.json({
        values: [
          { datetime: "2026-10-30 18:00:00", high: 101, low: 99, close: 100 },
          { datetime: "2026-10-29 23:00:00", high: 101, low: 99, close: 100 },
        ],
      }),
  });
  assert.equal(
    (
      await future.market(
        new URLSearchParams({ symbols: "EURUSD", timezone: "UTC" }),
      )
    ).instruments[0].dayChangePercent,
    null,
  );
});
