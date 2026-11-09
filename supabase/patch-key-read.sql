-- Kunci model milik akun bisa dibaca kembali oleh pemiliknya.
-- Jalankan di Supabase Dashboard → SQL Editor → Run (aman diulang).
--
-- Kenapa perlu: kunci disimpan terenkripsi di Vault. Tanpa fungsi ini server
-- butuh SUPABASE_SERVICE_ROLE_KEY hanya untuk membacanya, sehingga pemilik
-- harus memasukkan kunci ulang setiap login. Fungsi di bawah hanya mengembalikan
-- kunci MILIK PEMANGGIL SEORANG (auth.uid()), jadi tidak perlu service role.

create or replace function public.read_model_key()
returns table (
  model_key text,
  model_name text,
  base_url text,
  offline_ai boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select a.model_key_secret, a.model_name, a.model_provider_url, a.offline_ai
    into v_secret, model_name, base_url, offline_ai
    from public.accounts a
   where a.id = auth.uid();

  select d.decrypted_secret into model_key
    from vault.decrypted_secrets d
   where d.id = v_secret;

  return next;
end;
$$;

revoke all on function public.read_model_key() from public;
grant execute on function public.read_model_key() to authenticated;
