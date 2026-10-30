"use strict";
const assert = require("node:assert/strict"),
  E = require("../public/growth-engine.js");
const profile = {
  timezone: "Europe/London",
  session: {
    enabled: true,
    label: "Londres",
    timezone: "Europe/London",
    days: [1, 2, 3, 4, 5],
    start: "08:00",
    end: "11:00",
  },
};
assert.deepEqual(E.bounds("week", "2026-10-30"), {
  mode: "week",
  from: "2026-10-26",
  to: "2026-11-01",
  key: "week:2026-10-26",
});
assert.equal(E.previous(E.bounds("month", "2028-03-01")).to, "2028-02-29");
const now = new Date("2026-10-30T09:00:00Z"),
  s = E.context(profile, now);
assert.equal(s.status, "active");
assert(!E.due({ monitor: { enabled: true, mode: "manual" } }, profile, now));
assert(
  E.due(
    {
      monitor: { enabled: true, mode: "manual" },
      activeRun: { sessionKey: s.key },
    },
    profile,
    now,
  ),
);
assert(E.due({ monitor: { enabled: true, mode: "auto" } }, profile, now));
assert(
  !E.due(
    {
      monitor: { enabled: true, mode: "auto" },
      prompts: { [s.key]: { ignored: true } },
    },
    profile,
    now,
  ),
);
assert(
  !E.due(
    { monitor: { enabled: true, mode: "auto" } },
    { ...profile, session: { ...profile.session, enabled: false } },
    now,
  ),
);
assert(
  !E.due(
    { monitor: { enabled: true, mode: "auto" } },
    profile,
    new Date("2026-10-31T09:00Z"),
  ),
);
assert.equal(
  E.context(profile, new Date("2026-03-30T07:30Z")).status,
  "active",
);
assert.equal(
  E.context(profile, new Date("2026-10-26T07:30Z")).status,
  "upcoming",
);
const overnight = {
  ...profile,
  session: { ...profile.session, start: "22:00", end: "02:00" },
};
assert.equal(
  E.context(overnight, new Date("2026-10-31T00:30Z")).status,
  "active",
);
assert.equal(E.normalise(null).checkins.length, 0);
assert.equal(E.normalise({ rules: { planDays: -1 } }).rules.planDays, 30);
console.log(
  "PASS review dates/leap years; manual and opt-in scheduling; disabled sessions; weekends, DST and overnight schedules; safe empty state",
);

assert.equal(E.normalise({ monitor: { frequency: 17 } }).monitor.frequency, 17);
assert(!E.normalise({ monitor: { enabled: "true" } }).monitor.enabled);
assert(
  !E.due(
    {
      monitor: { enabled: true, mode: "auto" },
      prompts: {
        [s.key]: { snoozedUntil: Date.parse(now) + 600000, lastAt: 0 },
      },
    },
    profile,
    now,
  ),
);
assert(
  E.due(
    {
      monitor: { enabled: true, mode: "auto" },
      prompts: { [s.key]: { snoozedUntil: Date.parse(now) - 1, lastAt: 0 } },
    },
    profile,
    now,
  ),
);
