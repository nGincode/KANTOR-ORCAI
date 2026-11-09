-- Patch untuk proyek yang sudah menjalankan schema.sql sebelumnya.
-- Jalankan di Supabase Dashboard → SQL Editor → Run.
-- Menyebabkan RPC read_partner_secret gagal karena pgcrypto ada di schema
-- `extensions`, sedangkan search_path fungsi tidak menyertakannya.

create or replace function public.read_partner_secret(p_account uuid, p_passphrase text)
returns table (project_url text, anon_key text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
    select pl.project_url, extensions.pgp_sym_decrypt(pl.anon_key_enc, p_passphrase)
      from public.partner_links pl
     where pl.account_id = p_account;
end;
$$;

revoke all on function public.read_partner_secret(uuid, text) from public, authenticated;
grant execute on function public.read_partner_secret(uuid, text) to service_role;
