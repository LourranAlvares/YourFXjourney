BEGIN;
-- Execute once in the Supabase SQL Editor. Safe to rerun; never deletes workspaces.
create table if not exists public.elitex_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  role text not null default 'member' check (role in ('admin','member')),
  session_version bigint not null default 0,
  status text not null default 'pending' check (status in ('pending','active','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.elitex_profiles add column if not exists session_version bigint not null default 0;
create table if not exists public.elitex_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"trades":[],"reviews":{},"strats":[],"balance":10000}',
  revision bigint not null default 0,
  mutation_id uuid,
  updated_at timestamptz not null default now()
);
create table if not exists public.elitex_workspace_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  primary key(user_id,revision)
);
create or replace function public.elitex_new_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.elitex_profiles(id,email,name)
  values(new.id,coalesce(new.email,''),left(coalesce(new.raw_user_meta_data->>'name',''),100))
  on conflict(id) do nothing;
  return new;
end $$;
drop trigger if exists elitex_create_profile on auth.users;
create trigger elitex_create_profile after insert on auth.users
for each row execute function public.elitex_new_profile();
-- Existing Auth accounts are included without promoting or approving anyone.
insert into public.elitex_profiles(id,email,name)
select id,coalesce(email,''),left(coalesce(raw_user_meta_data->>'name',''),100) from auth.users
on conflict(id) do nothing;
create or replace function public.elitex_is_active() returns boolean
language sql stable security definer set search_path = '' as $$
select exists(select 1 from public.elitex_profiles where id=auth.uid() and status='active');
$$;
alter table public.elitex_profiles enable row level security;
alter table public.elitex_workspaces enable row level security;
alter table public.elitex_workspace_history enable row level security;
drop policy if exists own_profile on public.elitex_profiles;
create policy own_profile on public.elitex_profiles for select to authenticated using(id=auth.uid());
drop policy if exists own_workspace on public.elitex_workspaces;
create policy own_workspace on public.elitex_workspaces for select to authenticated using(user_id=auth.uid() and public.elitex_is_active());
drop policy if exists own_workspace_history on public.elitex_workspace_history;
create policy own_workspace_history on public.elitex_workspace_history for select to authenticated using(user_id=auth.uid() and public.elitex_is_active());
revoke all on public.elitex_profiles,public.elitex_workspaces,public.elitex_workspace_history from anon,authenticated;
grant select on public.elitex_profiles,public.elitex_workspaces,public.elitex_workspace_history to authenticated;
grant all on public.elitex_profiles,public.elitex_workspaces,public.elitex_workspace_history to service_role;
create or replace function public.elitex_save_workspace(expected_revision bigint,workspace_data jsonb,mutation_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare account uuid:=auth.uid(); current_row public.elitex_workspaces; next_revision bigint;
begin
 if account is null or not public.elitex_is_active() then raise sqlstate 'PT403' using message='Account is not active'; end if;
 if expected_revision is null or expected_revision<0 or mutation_id is null or
    jsonb_typeof(workspace_data) is distinct from 'object' or
    jsonb_typeof(workspace_data->'trades') is distinct from 'array' or
    jsonb_typeof(workspace_data->'reviews') is distinct from 'object' or
    jsonb_typeof(workspace_data->'strats') is distinct from 'array' or
    octet_length(workspace_data::text)>26214400
 then raise sqlstate 'PT400' using message='Invalid workspace'; end if;
 insert into public.elitex_workspaces(user_id) values(account) on conflict(user_id) do nothing;
 select * into current_row from public.elitex_workspaces where user_id=account for update;
 if current_row.mutation_id=elitex_save_workspace.mutation_id and current_row.data=workspace_data then
   return jsonb_build_object('revision',current_row.revision,'updatedAt',current_row.updated_at);
 end if;
 if current_row.revision<>expected_revision then raise sqlstate 'PT409' using message='Workspace changed in another session'; end if;
 if current_row.revision>0 then
   insert into public.elitex_workspace_history(user_id,revision,data) values(account,current_row.revision,current_row.data) on conflict do nothing;
 end if;
 next_revision:=current_row.revision+1;
 update public.elitex_workspaces set data=workspace_data,revision=next_revision,mutation_id=elitex_save_workspace.mutation_id,updated_at=now() where user_id=account;
 delete from public.elitex_workspace_history where user_id=account and revision not in
 (select revision from public.elitex_workspace_history where user_id=account order by revision desc limit 3);
 return jsonb_build_object('revision',next_revision,'updatedAt',now());
end $$;
revoke all on function public.elitex_save_workspace(bigint,jsonb,uuid) from public,anon;
grant execute on function public.elitex_save_workspace(bigint,jsonb,uuid) to authenticated;
revoke all on function public.elitex_new_profile() from public,anon,authenticated;
revoke all on function public.elitex_is_active() from public,anon;
grant execute on function public.elitex_is_active() to authenticated;

-- SMC_ACCOUNT_MANAGEMENT
-- SMC Elite: additive account management. Run after schema.sql. Safe to rerun.
create table if not exists public.elitex_account_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 plan text not null default 'standard' check(plan in ('standard','trial','monthly','quarterly','annual','custom')),
 expires_at timestamptz,
 notes text not null default '' check(length(notes)<=2000),
 updated_at timestamptz not null default now()
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
alter table public.elitex_admin_audit enable row level security;
revoke all on public.elitex_account_access,public.elitex_admin_audit from anon,authenticated;
grant all on public.elitex_account_access,public.elitex_admin_audit to service_role;
grant usage,select on sequence public.elitex_admin_audit_id_seq to service_role;
grant select(user_id,plan,expires_at,updated_at) on public.elitex_account_access to authenticated;
drop policy if exists own_account_access on public.elitex_account_access;
create policy own_account_access on public.elitex_account_access for select to authenticated using(user_id=auth.uid());
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
revoke all on function public.elitex_admin_manage(uuid,uuid,text,text,timestamptz,text,boolean) from public,anon,authenticated;
grant execute on function public.elitex_admin_manage(uuid,uuid,text,text,timestamptz,text,boolean) to service_role;
-- Remove the withdrawn reporting feature only; private workspaces are untouched.
drop function if exists public.elitex_set_coaching_share(boolean);
drop function if exists public.elitex_refresh_coaching_summary(uuid,jsonb);
drop table if exists public.elitex_coaching_shares;

NOTIFY pgrst, 'reload schema';
COMMIT;
