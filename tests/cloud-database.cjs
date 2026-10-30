"use strict";
const { PGlite } = require("@electric-sql/pglite"),
  fs = require("node:fs/promises"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
(async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`,
    );
    const sql = await fs.readFile("server/cloud/schema.sql", "utf8");
    await db.exec(sql);
    await db.exec(sql);
    const a = crypto.randomUUID(),
      b = crypto.randomUUID();
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3),($4,$5,$6)",
      [
        a,
        "a@example.test",
        JSON.stringify({ name: "Alice", role: "admin" }),
        b,
        "b@example.test",
        JSON.stringify({ name: "Bob" }),
      ],
    );
    assert.equal(
      (
        await db.query(
          "select role,status from public.elitex_profiles where id=$1",
          [a],
        )
      ).rows[0].role,
      "member",
    );
    await db.query(
      "update public.elitex_profiles set status='active' where id=any($1::uuid[])",
      [[a, b]],
    );
    async function asUser(id, fn) {
      await db.exec("set role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ]);
      try {
        return await fn();
      } finally {
        await db.exec("reset role");
      }
    }
    const data = {
        trades: [{ id: "private-a", close: "2026-10-01T10:00", pnl: 10 }],
        reviews: {},
        strats: [],
        balance: 1000,
      },
      mutation = crypto.randomUUID();
    const save = (rev, value, id = crypto.randomUUID()) =>
      db.query(
        "select public.elitex_save_workspace($1,$2::jsonb,$3::uuid) as result",
        [rev, JSON.stringify(value), id],
      );
    await asUser(a, async () => {
      const r = await save(0, data, mutation);
      assert.equal(r.rows[0].result.revision, 1);
      assert.equal((await save(0, data, mutation)).rows[0].result.revision, 1);
      await assert.rejects(
        () => save(0, { ...data, balance: 2000 }),
        /Workspace changed/,
      );
      await assert.rejects(
        () =>
          db.query(
            "update public.elitex_profiles set role='admin' where id=$1",
            [a],
          ),
        /permission denied/,
      );
      await assert.rejects(
        () => db.query("update public.elitex_workspaces set data='{}'"),
        /permission denied/,
      );
    });
    await asUser(b, async () => {
      assert.equal(
        (await db.query("select * from public.elitex_workspaces")).rows.length,
        0,
      );
      await save(0, { ...data, trades: [{ id: "private-b" }] });
      assert.equal(
        (await db.query("select * from public.elitex_profiles")).rows.length,
        1,
      );
    });
    await asUser(a, async () => {
      for (let rev = 1; rev <= 5; rev++)
        await save(rev, { ...data, balance: 1000 + rev });
      const history = (
        await db.query(
          "select revision from public.elitex_workspace_history order by revision",
        )
      ).rows.map((r) => Number(r.revision));
      assert.deepEqual(history, [3, 4, 5]);
      assert.equal(
        (await db.query("select data from public.elitex_workspaces")).rows[0]
          .data.trades[0].id,
        "private-a",
      );
    });
    await db.query(
      "update public.elitex_profiles set status='blocked' where id=$1",
      [a],
    );
    await asUser(a, async () => {
      assert.equal(
        (await db.query("select * from public.elitex_workspaces")).rows.length,
        0,
      );
      assert.equal(
        (await db.query("select * from public.elitex_workspace_history")).rows
          .length,
        0,
      );
      await assert.rejects(() => save(6, data), /Account is not active/);
    });
    console.log(
      "PASS real PostgreSQL schema rerun, metadata cannot promote, RLS separates users, direct writes denied, revision conflicts, idempotent retries, three backups and blocked-account denial",
    );
  } finally {
    await db.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
