"use strict";
const assert = require("node:assert/strict"),
  R = require("../public/world/world-rooms.js"),
  M = require("../public/world/world-map.js");
for (const room of R.rooms.filter((r) => !r.future)) {
  const path = M.path(
    { x: 384, y: 336 },
    { x: room.door[0], y: room.door[1] },
    R.rooms,
  );
  assert(path.length, "reachable " + room.id);
  assert(path.every((p) => M.walkable(p.x, p.y, R.rooms)));
  assert.deepEqual(path.at(-1), { x: room.door[0], y: room.door[1] });
}
for (const [x, y] of [
  [0, 0],
  [384, 288],
  [768, 576],
]) {
  const p = M.project(x, y),
    back = M.unproject(p.x, p.y);
  assert(Math.abs(back.x - x) < 0.001 && Math.abs(back.y - y) < 0.001);
}
assert.equal(M.path({ x: 384, y: 336 }, { x: 64, y: 64 }, R.rooms).length, 0);
assert(!R.allowed("admin", false));
assert(R.allowed("admin", true));
assert(!R.allowed("__proto__", true));
assert(R.find("community").future);
console.log(
  "PASS World map: every functional room reachable, no collisions, reversible projection, locked community and allowlisted routes",
);
