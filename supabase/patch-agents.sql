-- Roster (daftar pegawai) sebagai tabel sungguhan, bukan JSONB di offices.
-- Jalankan di Supabase Dashboard → SQL Editor → Run.
--
-- Alasan: user menambah/mengedit/menghapus pegawai satu per satu. Tabel
-- terpisah membuat tiap perubahan kecil (1 baris), bisa di-query, dan tidak
-- menulis ulang seluruh dokumen kantor.
--
-- Aman dijalankan berulang.

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
