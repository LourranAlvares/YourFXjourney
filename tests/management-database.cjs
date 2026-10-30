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
    });
    assert.equal(
      (
        await db.query(
          "select to_regclass('public.elitex_coaching_shares') as t",
        )
      ).rows[0].t,
      null,
    );
    assert.equal(
      (
        await db.query(
          "select to_regprocedure('public.elitex_set_coaching_share(boolean)') as f",
        )
      ).rows[0].f,
      null,
    );
    // Upgrading an already-installed reporting schema removes only the withdrawn feature.
    await db.exec(
      "create table public.elitex_coaching_shares(user_id uuid,summary jsonb)",
    );
    await db.exec(migration);
    assert.equal(
      (
        await db.query(
          "select to_regclass('public.elitex_coaching_shares') as t",
        )
      ).rows[0].t,
      null,
    );
    assert.equal(
      (await db.query("select count(*) as n from public.elitex_profiles"))
        .rows[0].n,
      3,
    );
    assert(
      (await db.query("select * from public.elitex_admin_audit")).rows.length >=
        2,
    );
    await asUser(a, () =>
      assert.rejects(
        () => db.query("select * from public.elitex_admin_audit"),
        /permission denied/,
      ),
    );
    console.log(
      "PASS PostgreSQL migration reruns, expiry/renewal, protected owner, session revocation, audit and removal of reporting without deleting accounts",
    );
  } finally {
    await db.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
