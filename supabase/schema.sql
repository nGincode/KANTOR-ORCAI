-- Kantor ORCAI — per-account office with an offline worker.
-- Run once in the Supabase SQL editor (Database → SQL editor → paste → Run).
--
-- Design choices, all oriented at "server stays cheap":
--  * offline AI calls use the OWNER'S key; the key is encrypted with Vault
--  * only the server-role can read secrets, RLS keeps every row private
--  * one row per account, everything else in JSONB → 2 tiny tables total
--  * the worker is a single query per tick, no per-agent rows to shuffle

create extension if not exists pgcrypto;
create extension if not exists supabase_vault; -- no-op when already installed
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------- profiles
create table if not exists public.accounts (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  -- model the owner wants the offline worker to use; cleared = no offline AI
  model_provider_url text,
  model_name text,
  -- id of the Vault secret holding their key (never the key itself)
  model_key_secret uuid,
  -- false = the worker only shuffles activities (free), true = calls the model
  offline_ai boolean not null default false,
  -- paused by the owner from the UI
  offline_enabled boolean not null default true,
  -- where the office lives: our project (hosted) or the owner's (own)
  storage_mode text not null default 'hosted' check (storage_mode in ('hosted', 'own')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- roster
create table if not exists public.agents (
  account_id uuid not null references public.accounts (id) on delete cascade,
  agent_id text not null,
  -- urutan tampil / meja
  desk_index int not null default 0,
  name text not null,
  role text not null default '',
  shirt_color text not null default '#6366f1',
  hair_style text not null default 'short',
  skin_tone text not null default '#e8b48a',
  skills jsonb not null default '[]'::jsonb,
  agent_md text not null default '',
  -- koneksi AI per pegawai; key dienkripsi (pgcrypto) dengan passphrase server
  api_base_url text not null default 'https://api.openai.com/v1',
  model text not null default 'gpt-4o-mini',
  api_key_enc bytea,
  demo_mode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (account_id, agent_id)
);

create index if not exists agents_account_idx on public.agents (account_id, desk_index);

alter table public.agents enable row level security;

drop policy if exists "own agents" on public.agents;
create policy "own agents" on public.agents
  for all
  using (auth.uid() = account_id)
  with check (auth.uid() = account_id);

-- ---------------------------------------------------------------- RPC
-- Membaca roster milik pemanggil. Kunci API tidak pernah dikirim balik:
-- browser sudah menyimpannya sendiri lewat /api/account/model-key.
create or replace function public.list_agents()
returns table (
  agent_id text,
  desk_index int,
  name text,
  role text,
  shirt_color text,
  hair_style text,
  skin_tone text,
  skills jsonb,
  agent_md text,
  api_base_url text,
  model text,
  demo_mode boolean,
  has_key boolean,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select a.agent_id, a.desk_index, a.name, a.role, a.shirt_color, a.hair_style,
         a.skin_tone, a.skills, a.agent_md, a.api_base_url, a.model, a.demo_mode,
         a.api_key_enc is not null, a.updated_at
    from public.agents a
   where a.account_id = auth.uid()
   order by a.desk_index;
$$;

revoke all on function public.list_agents() from public;
grant execute on function public.list_agents() to authenticated;

-- Menyimpan satu pegawai (tambah / edit). p_api_key null = jangan ubah kunci.
create or replace function public.save_agent(
  p_agent_id text,
  p_desk_index int,
  p_name text,
  p_role text,
  p_shirt_color text,
  p_hair_style text,
  p_skin_tone text,
  p_skills jsonb,
  p_agent_md text,
  p_api_base_url text,
  p_model text,
  p_api_key text,
  p_demo_mode boolean,
  p_passphrase text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.agents as t (
    account_id, agent_id, desk_index, name, role, shirt_color, hair_style, skin_tone,
    skills, agent_md, api_base_url, model, api_key_enc, demo_mode
  )
  values (
    auth.uid(), p_agent_id, p_desk_index, p_name, coalesce(p_role, ''), p_shirt_color,
    p_hair_style, p_skin_tone, coalesce(p_skills, '[]'::jsonb), coalesce(p_agent_md, ''),
    coalesce(p_api_base_url, 'https://api.openai.com/v1'), coalesce(p_model, 'gpt-4o-mini'),
    case when p_api_key is null or p_api_key = '' then null
         else pgp_sym_encrypt(p_api_key, p_passphrase) end,
    coalesce(p_demo_mode, false)
  )
  on conflict (account_id, agent_id) do update
    set desk_index = excluded.desk_index,
        name = excluded.name,
        role = excluded.role,
        shirt_color = excluded.shirt_color,
        hair_style = excluded.hair_style,
        skin_tone = excluded.skin_tone,
        skills = excluded.skills,
        agent_md = excluded.agent_md,
        api_base_url = excluded.api_base_url,
        model = excluded.model,
        -- kunci hanya diganti kalau dikirim ulang
        api_key_enc = coalesce(excluded.api_key_enc, t.api_key_enc),
        demo_mode = excluded.demo_mode,
        updated_at = now();
end;
$$;

revoke all on function public.save_agent(text,int,text,text,text,text,text,jsonb,text,text,text,text,boolean,text) from public;
grant execute on function public.save_agent(text,int,text,text,text,text,text,jsonb,text,text,text,text,boolean,text) to authenticated;

-- Menghapus satu pegawai milik pemanggil.
create or replace function public.delete_agent(p_agent_id text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.agents where account_id = auth.uid() and agent_id = p_agent_id;
$$;

revoke all on function public.delete_agent(text) from public;
grant execute on function public.delete_agent(text) to authenticated;

-- Mengosongkan roster (dipakai saat login pertama: data demo tidak ikut ke akun).
create or replace function public.clear_agents()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.agents where account_id = auth.uid();
$$;

revoke all on function public.clear_agents() from public;
grant execute on function public.clear_agents() to authenticated;

-- ---------------------------------------------------------------- partner links
-- One row per user who chose "own storage". Nothing here is global config:
-- every user brings their own project, and we only keep the connection so the
-- worker can deliver their data. The anon key is encrypted with pgcrypto using
-- a server-side passphrase (never stored in the database).
create table if not exists public.partner_links (
  account_id uuid primary key references public.accounts (id) on delete cascade,
  project_url text not null,
  -- anon key, encrypted at rest (see public.save_partner)
  anon_key_enc bytea not null,
  created_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_error text
);

alter table public.partner_links enable row level security;

-- the owner may read their own link; writes only through the functions below
create policy "own partner link" on public.partner_links
  for select using (auth.uid() = account_id);

-- ---------------------------------------------------------------- office
-- One JSONB document per account: memory (events/chats/profiles) + agent runtime.
create table if not exists public.offices (
  account_id uuid primary key references public.accounts (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  -- how many ticks the worker already ran, so we can cap daily drift
  ticks_today int not null default 0,
  tick_date date not null default current_date,
  updated_at timestamptz not null default now()
);

alter table public.accounts enable row level security;
alter table public.offices enable row level security;

create policy "own account" on public.accounts
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own office" on public.offices
  for all using (auth.uid() = account_id) with check (auth.uid() = account_id);

-- ---------------------------------------------------------------- helpers
-- Store the owner's model key in Vault and reference it by id.
create or replace function public.set_model_key(p_key text, p_namespace uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- replace the previous secret, never keep two copies around
  delete from vault.secrets where id = (select model_key_secret from public.accounts where id = auth.uid());

  v_id := vault.create_secret(
    p_key,
    coalesce(p_namespace::text, auth.uid()::text) || ':model_key',
    'owner model key for the offline worker'
  );

  update public.accounts
     set model_key_secret = v_id
   where id = auth.uid();
  return v_id;
end;
$$;

revoke all on function public.set_model_key(text, uuid) from public;
grant execute on function public.set_model_key(text, uuid) to authenticated;

-- ---------------------------------------------------------------- roster
create table if not exists public.agents (
  account_id uuid not null references public.accounts (id) on delete cascade,
  agent_id text not null,
  -- urutan tampil / meja
  desk_index int not null default 0,
  name text not null,
  role text not null default '',
  shirt_color text not null default '#6366f1',
  hair_style text not null default 'short',
  skin_tone text not null default '#e8b48a',
  skills jsonb not null default '[]'::jsonb,
  agent_md text not null default '',
  -- koneksi AI per pegawai; key dienkripsi (pgcrypto) dengan passphrase server
  api_base_url text not null default 'https://api.openai.com/v1',
  model text not null default 'gpt-4o-mini',
  api_key_enc bytea,
  demo_mode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (account_id, agent_id)
);

create index if not exists agents_account_idx on public.agents (account_id, desk_index);

alter table public.agents enable row level security;

drop policy if exists "own agents" on public.agents;
create policy "own agents" on public.agents
  for all
  using (auth.uid() = account_id)
  with check (auth.uid() = account_id);

-- ---------------------------------------------------------------- RPC
-- Membaca roster milik pemanggil. Kunci API tidak pernah dikirim balik:
-- browser sudah menyimpannya sendiri lewat /api/account/model-key.
create or replace function public.list_agents()
returns table (
  agent_id text,
  desk_index int,
  name text,
  role text,
  shirt_color text,
  hair_style text,
  skin_tone text,
  skills jsonb,
  agent_md text,
  api_base_url text,
  model text,
  demo_mode boolean,
  has_key boolean,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select a.agent_id, a.desk_index, a.name, a.role, a.shirt_color, a.hair_style,
         a.skin_tone, a.skills, a.agent_md, a.api_base_url, a.model, a.demo_mode,
         a.api_key_enc is not null, a.updated_at
    from public.agents a
   where a.account_id = auth.uid()
   order by a.desk_index;
$$;

revoke all on function public.list_agents() from public;
grant execute on function public.list_agents() to authenticated;

-- Menyimpan satu pegawai (tambah / edit). p_api_key null = jangan ubah kunci.
create or replace function public.save_agent(
  p_agent_id text,
  p_desk_index int,
  p_name text,
  p_role text,
  p_shirt_color text,
  p_hair_style text,
  p_skin_tone text,
  p_skills jsonb,
  p_agent_md text,
  p_api_base_url text,
  p_model text,
  p_api_key text,
  p_demo_mode boolean,
  p_passphrase text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.agents as t (
    account_id, agent_id, desk_index, name, role, shirt_color, hair_style, skin_tone,
    skills, agent_md, api_base_url, model, api_key_enc, demo_mode
  )
  values (
    auth.uid(), p_agent_id, p_desk_index, p_name, coalesce(p_role, ''), p_shirt_color,
    p_hair_style, p_skin_tone, coalesce(p_skills, '[]'::jsonb), coalesce(p_agent_md, ''),
    coalesce(p_api_base_url, 'https://api.openai.com/v1'), coalesce(p_model, 'gpt-4o-mini'),
    case when p_api_key is null or p_api_key = '' then null
         else pgp_sym_encrypt(p_api_key, p_passphrase) end,
    coalesce(p_demo_mode, false)
  )
  on conflict (account_id, agent_id) do update
    set desk_index = excluded.desk_index,
        name = excluded.name,
        role = excluded.role,
        shirt_color = excluded.shirt_color,
        hair_style = excluded.hair_style,
        skin_tone = excluded.skin_tone,
        skills = excluded.skills,
        agent_md = excluded.agent_md,
        api_base_url = excluded.api_base_url,
        model = excluded.model,
        -- kunci hanya diganti kalau dikirim ulang
        api_key_enc = coalesce(excluded.api_key_enc, t.api_key_enc),
        demo_mode = excluded.demo_mode,
        updated_at = now();
end;
$$;

revoke all on function public.save_agent(text,int,text,text,text,text,text,jsonb,text,text,text,text,boolean,text) from public;
grant execute on function public.save_agent(text,int,text,text,text,text,text,jsonb,text,text,text,text,boolean,text) to authenticated;

-- Menghapus satu pegawai milik pemanggil.
create or replace function public.delete_agent(p_agent_id text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.agents where account_id = auth.uid() and agent_id = p_agent_id;
$$;

revoke all on function public.delete_agent(text) from public;
grant execute on function public.delete_agent(text) to authenticated;

-- Mengosongkan roster (dipakai saat login pertama: data demo tidak ikut ke akun).
create or replace function public.clear_agents()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.agents where account_id = auth.uid();
$$;

revoke all on function public.clear_agents() from public;
grant execute on function public.clear_agents() to authenticated;

-- ---------------------------------------------------------------- partner link
-- Registers (or replaces) the caller's own Supabase project. The anon key is
-- encrypted here with pgp_sym_encrypt; the passphrase lives only in the
-- server environment (PARTNER_ENCRYPTION_KEY), never in this database.
create or replace function public.save_partner(p_url text, p_anon_key text, p_passphrase text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_url !~ '^https://[a-z0-9-]+\.supabase\.co$' then
    raise exception 'invalid project url';
  end if;

  insert into public.partner_links (account_id, project_url, anon_key_enc)
  values (auth.uid(), p_url, pgp_sym_encrypt(p_anon_key, p_passphrase))
  on conflict (account_id) do update
    set project_url = excluded.project_url,
        anon_key_enc = excluded.anon_key_enc,
        last_error = null;

  update public.accounts set storage_mode = 'own' where id = auth.uid();
end;
$$;

revoke all on function public.save_partner(text, text, text) from public;
grant execute on function public.save_partner(text, text, text) to authenticated;

-- Returns the decrypted anon key. Service-role only: the worker needs it, the
-- browser never does (it talks to the partner project directly with its own copy).
create or replace function public.read_partner_secret(p_account uuid, p_passphrase text)
returns table (project_url text, anon_key text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
    select pl.project_url, pgp_sym_decrypt(pl.anon_key_enc, p_passphrase)
      from public.partner_links pl
     where pl.account_id = p_account;
end;
$$;

revoke all on function public.read_partner_secret(uuid, text) from public, authenticated;
grant execute on function public.read_partner_secret(uuid, text) to service_role;

-- account bootstrap on first login
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.accounts (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;

  insert into public.offices (account_id) values (new.id)
  on conflict (account_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- worker plan
-- Runs every 15 minutes. It only touches accounts that opted in and only for
-- "office ticks" they are behind: the point is continuity, not real-time.
-- The heavy work (one model call per agent per day, at most) happens in the
-- Edge Function `offline-worker`, never in the browser.
select cron.schedule(
  'kantor-orcai-offline-tick',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'worker_url') || '/api/offline/tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-key', (select decrypted_secret from vault.decrypted_secrets where name = 'worker_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $$
);
