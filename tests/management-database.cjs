"use strict";
const { PGlite } = require("@electric-sql/pglite"),
  fs = require("node:fs/promises"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
(async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;",
    );
    const schema = await fs.readFile("server/cloud/schema.sql", "utf8"),
      migration = await fs.readFile("server/cloud/management.sql", "utf8");
    await db.exec(schema);
    await db.exec(migration);
    await db.exec(schema);
    const owner = crypto.randomUUID(),
      a = crypto.randomUUID(),
      b = crypto.randomUUID();
    for (const id of [owner, a, b])
      await db.query("insert into auth.users(id,email) values($1,$2)", [
        id,
        id + "@example.test",
      ]);
    await db.query("update public.elitex_profiles set status='active'");
    await db.query(
      "update public.elitex_profiles set role='admin' where id=$1",
      [owner],
    );
    const asUser = async (id, fn) => {
      await db.exec("set role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ]);
      try {
        return await fn();
      } finally {
        await db.exec("reset role");
      }
    };
    const manage = (actor, target, expiry, revoke = false) =>
      db.query(
        "select public.elitex_admin_manage($1,$2,'active','trial',$3,'agreed terms',$4)",
        [actor, target, expiry, revoke],
      );
    await assert.rejects(
      () => asUser(a, () => manage(owner, b, null)),
      /permission denied/,
    );
    await assert.rejects(() => manage(a, b, null), /Admin required/);
    await assert.rejects(() => manage(owner, owner, null), /Protected account/);
    await manage(owner, a, "2020-01-01");
    await asUser(a, async () => {
      assert.equal(
        (await db.query("select public.elitex_is_active() as active")).rows[0]
          .active,
        false,
      );
      await assert.rejects(
        () =>
          db.query(
            'select public.elitex_save_workspace(0,\'{"trades":[],"reviews":{},"strats":[]}\', $1)',
            [crypto.randomUUID()],
          ),
        /Account is not active/,
      );
    });
    await manage(owner, a, "2099-01-01", true);
    assert.equal(
      (
        await db.query(
          "select session_version from public.elitex_profiles where id=$1",
          [a],
        )
      ).rows[0].session_version,
      1,
    );
    await asUser(a, async () => {
      assert.equal(
        (await db.query("select public.elitex_is_active() as active")).rows[0]
          .active,
        true,
      );
      await assert.rejects(
        () => db.query("select notes from public.elitex_account_access"),
        /permission denied/,
      );
      await db.query("select public.elitex_set_coaching_share(true)");
      await assert.rejects(
        () =>
          db.query(
            "update public.elitex_coaching_shares set enabled=true where user_id=$1",
            [b],
          ),
        /permission denied/,
      );
      await assert.rejects(
        () =>
          db.query("select public.elitex_refresh_coaching_summary($1,$2)", [
            a,
            "{}",
          ]),
        /permission denied/,
      );
    });
    await db.query("select public.elitex_refresh_coaching_summary($1,$2)", [
      a,
      JSON.stringify({ net: 50, trades: 2 }),
    ]);
    await db.query(
      "insert into public.elitex_workspaces(user_id,revision) values($1,2)",
      [a],
    );
    await db.query("select public.elitex_refresh_coaching_summary($1,$2)", [
      a,
      JSON.stringify({ net: 999, workspaceRevision: 1 }),
    ]);
    assert.equal(
      (
        await db.query(
          "select summary from public.elitex_coaching_shares where user_id=$1",
          [a],
        )
      ).rows[0].summary.net,
      50,
      "stale report overwrites latest summary",
    );
    await db.query("select public.elitex_refresh_coaching_summary($1,$2)", [
      a,
      JSON.stringify({ net: 80, workspaceRevision: 2 }),
    ]);
    assert.equal(
      (
        await db.query(
          "select summary from public.elitex_coaching_shares where user_id=$1",
          [a],
        )
      ).rows[0].summary.net,
      80,
    );
    await asUser(b, async () =>
      assert.equal(
        (await db.query("select * from public.elitex_coaching_shares")).rows
          .length,
        0,
      ),
    );
    await asUser(a, () =>
      db.query("select public.elitex_set_coaching_share(false)"),
    );
    assert.equal(
      (
        await db.query(
          "select summary from public.elitex_coaching_shares where user_id=$1",
          [a],
        )
      ).rows[0].summary,
      null,
    );
    await db.query(
      "update public.elitex_profiles set status='blocked' where id=$1",
      [a],
    );
    await asUser(a, () =>
      db.query("select public.elitex_set_coaching_share(false)"),
    );
    await assert.rejects(
      () =>
        asUser(a, () =>
          db.query("select public.elitex_set_coaching_share(true)"),
        ),
      /Active account required/,
    );
    assert(
      (await db.query("select * from public.elitex_admin_audit")).rows.length >=
        5,
    );
    await asUser(a, () =>
      assert.rejects(
        () => db.query("select * from public.elitex_admin_audit"),
        /permission denied/,
      ),
    );
    console.log(
      "PASS PostgreSQL migration reruns, expiry and renewal, protected owner, session revocation, atomic audit, self-only revocable consent and private summaries",
    );
  } finally {
    await db.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
