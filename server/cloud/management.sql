BEGIN;
-- SMC Elite: additive account management. Run after schema.sql. Safe to rerun.
create table if not exists public.elitex_account_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 plan text not null default 'standard' check(plan in ('standard','trial','monthly','quarterly','annual','custom')),
 expires_at timestamptz,
 notes text not null default '' check(length(notes)<=2000),
 updated_at timestamptz not null default now()
);
create table if not exists public.elitex_coaching_shares (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default false,
 consent_version text not null default 'aggregate-v1',
 consent_at timestamptz not null default now(),
 summary jsonb,
 updated_at timestamptz
);
create table if not exists public.elitex_admin_audit (
 id bigint generated always as identity primary key,
 actor_id uuid references auth.users(id) on delete set null,
 user_id uuid references auth.users(id) on delete set null,
 action text not null,
 details jsonb not null default '{}',
 created_at timestamptz not null default now()
);
alter table public.elitex_account_access enable row level security;
alter table public.elitex_coaching_shares enable row level security;
alter table public.elitex_admin_audit enable row level security;
revoke all on public.elitex_account_access,public.elitex_coaching_shares,public.elitex_admin_audit from anon,authenticated;
grant all on public.elitex_account_access,public.elitex_coaching_shares,public.elitex_admin_audit to service_role;
grant usage,select on sequence public.elitex_admin_audit_id_seq to service_role;
grant select(user_id,plan,expires_at,updated_at) on public.elitex_account_access to authenticated;
grant select on public.elitex_coaching_shares to authenticated;
drop policy if exists own_account_access on public.elitex_account_access;
create policy own_account_access on public.elitex_account_access for select to authenticated using(user_id=auth.uid());
drop policy if exists own_coaching_share on public.elitex_coaching_shares;
create policy own_coaching_share on public.elitex_coaching_shares for select to authenticated using(user_id=auth.uid());
create or replace function public.elitex_is_active() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.elitex_profiles p where p.id=auth.uid() and p.status='active' and
 (p.role='admin' or not exists(select 1 from public.elitex_account_access a where a.user_id=p.id and a.expires_at is not null and a.expires_at<=now())));
$$;
create or replace function public.elitex_admin_manage(actor uuid,account uuid,new_status text,access_plan text,access_expiry timestamptz,admin_notes text,revoke_sessions boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.elitex_profiles; previous_access jsonb;
begin
 if not exists(select 1 from public.elitex_profiles where id=actor and role='admin' and status='active') then raise sqlstate 'PT403' using message='Admin required'; end if;
 select * into target from public.elitex_profiles where id=account for update;
 if target.id is null or target.role='admin' or account=actor then raise sqlstate 'PT403' using message='Protected account'; end if;
 if new_status not in ('active','pending','blocked') or access_plan not in ('standard','trial','monthly','quarterly','annual','custom') or admin_notes is null or length(admin_notes)>2000 then raise sqlstate 'PT400' using message='Invalid settings'; end if;
 select to_jsonb(a) into previous_access from public.elitex_account_access a where user_id=account;
 insert into public.elitex_account_access(user_id,plan,expires_at,notes) values(account,access_plan,access_expiry,admin_notes)
 on conflict(user_id) do update set plan=excluded.plan,expires_at=excluded.expires_at,notes=excluded.notes,updated_at=now();
 update public.elitex_profiles set status=new_status,session_version=session_version+case when revoke_sessions then 1 else 0 end,updated_at=now() where id=account;
 insert into public.elitex_admin_audit(actor_id,user_id,action,details) values(actor,account,'access_updated',jsonb_build_object('previous_status',target.status,'status',new_status,'previous_access',previous_access,'plan',access_plan,'expires_at',access_expiry,'sessions_revoked',revoke_sessions));
 return jsonb_build_object('ok',true);
end $$;
create or replace function public.elitex_set_coaching_share(allow_sharing boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare account uuid:=auth.uid();
begin
 if account is null or allow_sharing is null or (allow_sharing and not public.elitex_is_active()) then raise sqlstate 'PT403' using message='Active account required'; end if;
 insert into public.elitex_coaching_shares(user_id,enabled,consent_at) values(account,allow_sharing,now())
 on conflict(user_id) do update set enabled=excluded.enabled,consent_at=now(),summary=null,updated_at=null;
 insert into public.elitex_admin_audit(actor_id,user_id,action,details) values(account,account,'coaching_consent',jsonb_build_object('enabled',allow_sharing,'version','aggregate-v1'));
 return jsonb_build_object('enabled',allow_sharing);
end $$;
create or replace function public.elitex_refresh_coaching_summary(account uuid,summary_data jsonb)
returns void language sql security definer set search_path='' as $$
 update public.elitex_coaching_shares set summary=summary_data,updated_at=now() where user_id=account and enabled=true and coalesce((select revision from public.elitex_workspaces where user_id=account),0)=coalesce((summary_data->>'workspaceRevision')::bigint,0);
$$;
revoke all on function public.elitex_admin_manage(uuid,uuid,text,text,timestamptz,text,boolean) from public,anon,authenticated;
grant execute on function public.elitex_admin_manage(uuid,uuid,text,text,timestamptz,text,boolean) to service_role;
revoke all on function public.elitex_set_coaching_share(boolean) from public,anon;
grant execute on function public.elitex_set_coaching_share(boolean) to authenticated;
revoke all on function public.elitex_refresh_coaching_summary(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.elitex_refresh_coaching_summary(uuid,jsonb) to service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
