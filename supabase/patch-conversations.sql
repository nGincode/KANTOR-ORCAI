-- Riwayat obrolan & rapat pegawai, tersimpan permanen per akun.
-- Jalankan di Supabase Dashboard → SQL Editor → Run (aman diulang).
--
-- Beda dengan public.offices (blob memori di browser): tabel ini append-only,
-- satu baris per kalimat, jadi bisa dibaca ulang & difilter per akun.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  kind text not null check (kind in ('chat', 'meeting')),
  topic text not null default '',
  -- [agent_id, ...] pegawai yang ikut
  participant_ids jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason text
);

create index if not exists conversations_account_idx
  on public.conversations (account_id, started_at desc);

create table if not exists public.conversation_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  agent_id text,
  agent_name text not null default '',
  role text not null default '',
  kind text not null default 'chat' check (kind in ('chat', 'meeting', 'system')),
  content text not null,
  round int not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists conversation_messages_conversation_idx
  on public.conversation_messages (conversation_id, id);

alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

drop policy if exists "own conversations" on public.conversations;
create policy "own conversations" on public.conversations
  for all using (auth.uid() = account_id) with check (auth.uid() = account_id);

drop policy if exists "own conversation messages" on public.conversation_messages;
create policy "own conversation messages" on public.conversation_messages
  for all using (auth.uid() = account_id) with check (auth.uid() = account_id);

-- ---------------------------------------------------------------- RPC
-- Membuka obrolan/rapat baru; balikan id-nya untuk dipakai menulis kalimat.
create or replace function public.start_conversation(
  p_kind text,
  p_topic text,
  p_participant_ids jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.conversations (account_id, kind, topic, participant_ids)
  values (auth.uid(), p_kind, coalesce(p_topic, ''), coalesce(p_participant_ids, '[]'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.start_conversation(text, text, jsonb) from public;
grant execute on function public.start_conversation(text, text, jsonb) to authenticated;

-- Menulis satu kalimat. conversation_id harus milik pemanggil (dicek lewat FK + RLS insert).
create or replace function public.log_message(
  p_conversation_id uuid,
  p_agent_id text,
  p_agent_name text,
  p_role text,
  p_kind text,
  p_content text,
  p_round int default 1
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from public.conversations c
     where c.id = p_conversation_id and c.account_id = auth.uid()
  ) then
    raise exception 'conversation bukan milik akun ini';
  end if;
  insert into public.conversation_messages
    (conversation_id, account_id, agent_id, agent_name, role, kind, content, round)
  values
    (p_conversation_id, auth.uid(), p_agent_id, coalesce(p_agent_name, ''), coalesce(p_role, ''),
     coalesce(p_kind, 'chat'), coalesce(p_content, ''), coalesce(p_round, 1));
end;
$$;

revoke all on function public.log_message(uuid, text, text, text, text, text, int) from public;
grant execute on function public.log_message(uuid, text, text, text, text, text, int) to authenticated;

create or replace function public.end_conversation(p_conversation_id uuid, p_reason text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.conversations
     set ended_at = now(), end_reason = coalesce(p_reason, '')
   where id = p_conversation_id and account_id = auth.uid();
$$;

revoke all on function public.end_conversation(uuid, text) from public;
grant execute on function public.end_conversation(uuid, text) to authenticated;

-- Riwayat terbaru untuk satu akun (halaman "Riwayat Obrolan").
create or replace function public.list_conversations(p_limit int default 50)
returns table (
  id uuid,
  kind text,
  topic text,
  participant_ids jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  end_reason text,
  message_count bigint
)
language sql
security definer
set search_path = public
as $$
  select c.id, c.kind, c.topic, c.participant_ids, c.started_at, c.ended_at, c.end_reason,
         (select count(*) from public.conversation_messages m where m.conversation_id = c.id)
    from public.conversations c
   where c.account_id = auth.uid()
   order by c.started_at desc
   limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke all on function public.list_conversations(int) from public;
grant execute on function public.list_conversations(int) to authenticated;

-- Isi satu obrolan.
create or replace function public.list_messages(p_conversation_id uuid, p_limit int default 500)
returns table (
  id bigint,
  agent_id text,
  agent_name text,
  role text,
  kind text,
  content text,
  round int,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select m.id, m.agent_id, m.agent_name, m.role, m.kind, m.content, m.round, m.created_at
    from public.conversation_messages m
    join public.conversations c on c.id = m.conversation_id
   where m.conversation_id = p_conversation_id and c.account_id = auth.uid()
   order by m.id
   limit greatest(1, least(coalesce(p_limit, 500), 2000));
$$;

revoke all on function public.list_messages(uuid, int) from public;
grant execute on function public.list_messages(uuid, int) to authenticated;
