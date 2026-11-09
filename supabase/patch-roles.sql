-- Jabatan / role pilihan per akun.
-- Jalankan di Supabase Dashboard → SQL Editor → Run (aman diulang).
--
-- Template bawaan hidup di kode (lib/office.ts). Tabel ini hanya menampung role
-- buatan pemilik, jadi daftar pilihan = template + milik akun ini.

create table if not exists public.account_roles (
  account_id uuid not null references public.accounts (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  primary key (account_id, name)
);

alter table public.account_roles enable row level security;

drop policy if exists "own roles" on public.account_roles;
create policy "own roles" on public.account_roles
  for all using (auth.uid() = account_id) with check (auth.uid() = account_id);

-- ---------------------------------------------------------------- RPC
create or replace function public.list_roles()
returns table (name text)
language sql
security definer
set search_path = public
as $$
  select r.name from public.account_roles r
   where r.account_id = auth.uid()
   order by r.name;
$$;

revoke all on function public.list_roles() from public;
grant execute on function public.list_roles() to authenticated;

create or replace function public.save_role(p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'role kosong';
  end if;
  insert into public.account_roles (account_id, name)
  values (auth.uid(), trim(p_name))
  on conflict (account_id, name) do nothing;
end;
$$;

revoke all on function public.save_role(text) from public;
grant execute on function public.save_role(text) to authenticated;

create or replace function public.delete_role(p_name text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.account_roles
   where account_id = auth.uid() and name = p_name;
$$;

revoke all on function public.delete_role(text) from public;
grant execute on function public.delete_role(text) to authenticated;
