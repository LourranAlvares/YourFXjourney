const assert = require("node:assert/strict"),
  E = require("../public/session-engine.js");
let passed = 0;
const test = (name, run) => {
    run();
    passed++;
    console.log("PASS", name);
  },
  london = {
    label: "Londres",
    timezone: "Europe/London",
    start: "08:00",
    end: "11:00",
    days: [1, 2, 3, 4, 5],
  };
test("IANA timezone parts are independent of host timezone", () => {
  assert.equal(
    E.zonedParts("2026-10-27T12:00:00Z", "America/New_York").time,
    "08:00",
  );
  assert.equal(
    E.zonedParts("2026-10-27T12:00:00Z", "Asia/Tokyo").time,
    "21:00",
  );
  assert.equal(
    E.zonedParts("2026-10-27T23:30:00Z", "Asia/Tokyo").date,
    "2026-10-28",
  );
});
test("London session adjusts UTC start around spring and autumn DST", () => {
  assert.equal(
    E.sessionInterval(london, "2026-03-27").startAt,
    "2026-03-27T08:00:00.000Z",
  );
  assert.equal(
    E.sessionInterval(london, "2026-03-30").startAt,
    "2026-03-30T07:00:00.000Z",
  );
  assert.equal(
    E.sessionInterval(london, "2026-10-23").startAt,
    "2026-10-23T07:00:00.000Z",
  );
  assert.equal(
    E.sessionInterval(london, "2026-10-26").startAt,
    "2026-10-26T08:00:00.000Z",
  );
});
test("New York sessions follow US DST dates rather than London dates", () => {
  const ny = {
    ...london,
    label: "Nova York",
    timezone: "America/New_York",
    start: "08:00",
    end: "11:00",
  };
  assert.equal(
    E.sessionInterval(ny, "2026-03-06").startAt,
    "2026-03-06T13:00:00.000Z",
  );
  assert.equal(
    E.sessionInterval(ny, "2026-03-09").startAt,
    "2026-03-09T12:00:00.000Z",
  );
  assert.equal(
    E.sessionInterval(ny, "2026-10-26").startAt,
    "2026-10-26T12:00:00.000Z",
  );
});
test("spring nonexistent time advances by the missing interval or rejects explicitly", () => {
  assert.equal(
    E.zonedDateTimeToUtc("2026-03-29", "01:30", "Europe/London"),
    "2026-03-29T01:30:00.000Z",
  );
  assert.equal(
    E.zonedDateTimeToUtc("2026-03-29", "01:30", "Europe/London", "earlier"),
    "2026-03-29T00:30:00.000Z",
  );
  assert.throws(() =>
    E.zonedDateTimeToUtc("2026-03-29", "01:30", "Europe/London", "reject"),
  );
});
test("autumn repeated time supports earlier/later/reject deterministically", () => {
  assert.equal(
    E.zonedDateTimeToUtc("2026-10-25", "01:30", "Europe/London"),
    "2026-10-25T00:30:00.000Z",
  );
  assert.equal(
    E.zonedDateTimeToUtc("2026-10-25", "01:30", "Europe/London", "later"),
    "2026-10-25T01:30:00.000Z",
  );
  assert.throws(() =>
    E.zonedDateTimeToUtc("2026-10-25", "01:30", "Europe/London", "reject"),
  );
});
test("upcoming/active/finished boundaries and countdown use real instants", () => {
  let r = E.sessionOverview(london, "2026-10-27T07:00:00Z");
  assert.equal(r.status, "upcoming");
  assert.equal(r.secondsRemaining, 3600);
  r = E.sessionOverview(london, "2026-10-27T08:00:00Z");
  assert.equal(r.status, "active");
  assert.equal(r.secondsRemaining, 10800);
  r = E.sessionOverview(london, "2026-10-27T11:00:00Z");
  assert.equal(r.status, "finished");
  assert.equal(r.current, null);
  assert.equal(r.nextStartAt, "2026-10-28T08:00:00.000Z");
  assert.equal(r.secondsRemaining, 21 * 3600);
});
test("weekends point to next configured weekday without pretending an active session", () => {
  const r = E.sessionOverview(london, "2026-10-31T09:00:00Z");
  assert.equal(r.status, "upcoming");
  assert.equal(r.nextStartAt, "2026-11-02T08:00:00.000Z");
  assert.equal(E.sessionInterval(london, "2026-10-31"), null);
});
test("overnight sessions remain active on the next local date and retain original weekday", () => {
  const asian = {
      label: "Noturna",
      timezone: "Asia/Tokyo",
      start: "22:00",
      end: "02:00",
      days: [1],
    },
    r = E.sessionOverview(asian, "2026-10-26T16:00:00Z");
  assert.equal(r.localDate, "2026-10-27");
  assert.equal(r.status, "active");
  assert.equal(r.startAt, "2026-10-26T13:00:00.000Z");
  assert.equal(r.endAt, "2026-10-26T17:00:00.000Z");
  assert.equal(r.secondsRemaining, 3600);
});
test("invalid timezone/time/weekday config becomes an explicit unconfigured state", () => {
  for (const c of [
    {},
    null,
    { ...london, timezone: "Invalid/Zone" },
    { ...london, start: "25:00" },
    { ...london, days: [] },
    { ...london, days: [0] },
    { ...london, start: "08:00", end: "08:00" },
  ]) {
    const r = E.sessionOverview(c, "2026-10-27T10:00:00Z");
    assert.equal(r.configured, false);
    assert.equal(r.status, "unconfigured");
    assert.equal(r.secondsRemaining, null);
  }
});
test("calendar dates, leap days and formatting options are validated", () => {
  assert.equal(E.shiftDate("2024-02-28", 1), "2024-02-29");
  assert.equal(E.shiftDate("2026-12-31", 1), "2027-01-01");
  assert.throws(() => E.zonedDateTimeToUtc("2026-02-30", "08:00", "UTC"));
  assert.throws(() => E.zonedDateTimeToUtc("2026-10-27", "24:00", "UTC"));
  assert.ok(
    E.formatInZone("2026-10-27T10:00:00Z", "Europe/London", {
      hour: "2-digit",
      minute: "2-digit",
    }).includes("10:00"),
  );
});
console.log(`${passed} session-engine tests passed`);
