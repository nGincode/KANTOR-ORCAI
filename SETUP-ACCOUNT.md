# Kantor ORCAI — akun & kantor yang tetap "hidup" saat tab ditutup

## Ringkasan
| Mode | Penyimpanan memori | Jalan saat tab ditutup | Biaya AI |
|---|---|---|---|
| Tamu (tanpa login) | `localStorage` | ❌ | 0 |
| Login Google | Postgres (Supabase) | ✅ worker offline | 0 (putar aktivitas) atau **kunci milik user** |

Desain sengaja:

- **Satu baris per akun**, isinya satu dokumen JSONB (memori + runtime agen). Tidak ada tabel per-agen → query worker tetap murah walau user bertambah.
- **Worker offline gratis** hanya mengacak aktivitas agen. Nol token, nol biaya.
- **AI offline pakai kunci user sendiri.** Kunci disimpan terenkripsi di Supabase Vault. Server hanya mengambilnya di detik memanggil model, tidak pernah menyimpan plaintext.
- **Satu panggilan model per akun per tick**, bukan per agen (`MAX_AI_CALLS_PER_TICK`).

---

## 0. Database utama (sudah terisi)

`.env.local` sudah berisi URL + publishable key proyek **mzeeyxegjxbctbzdmwwk**.
Satu langkah masih wajib kamu lakukan:

1. Buka **Supabase Dashboard → SQL Editor** proyek `mzeeyxegjxbctbzdmwwk`.
2. Tempel seluruh isi `supabase/schema.sql` → **Run**. Membuat tabel `accounts`,
   `offices`, `partner_links`, RPC, trigger profil, dan jadwal cron.
3. **Project Settings → API → secret key** → salin ke `SUPABASE_SERVICE_ROLE_KEY`
   di `.env.local` (hanya server).
4. Restart `npm run dev`.

Cek cepat setelah Run: `GET {URL}/rest/v1/partner_links?select=*` harus membalas
`[]` (bukan 404).

## 1. Setup Supabase

1. Buat proyek di Supabase → **SQL Editor** → tempel seluruh isi `supabase/schema.sql` → Run.
2. **Authentication → Providers → Google**: isi Client ID + Secret dari Google Cloud Console.
   Authorized redirect URI: `https://<project>.supabase.co/auth/v1/callback`
3. **Authentication → URL Configuration**: Site URL = domain kamu, tambahkan juga `http://localhost:3000`.
4. **Database → Vault** (opsional): simpan dua secret berikut untuk cron:
   ```sql
   select vault.create_secret('https://<domain-kamu>', 'project_url');
   select vault.create_secret('<string-acak-panjang>', 'worker_key');
   ```
   Lalu sesuaikan URL di `cron.schedule` pada `schema.sql` menjadi
   `.../api/offline/tick` (Next.js), bukan `/functions/v1/...`.

## 2. Environment

`.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
# hanya untuk /api/offline/tick, jangan pernah expose ke browser
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OFFLINE_WORKER_KEY=<sama dengan worker_key di Vault>
# passphrase enkripsi anon key milik user (partner_links). Bukan kredensial user.
PARTNER_ENCRYPTION_KEY=<string-acak-panjang>
```

Tanpa dua variabel `NEXT_PUBLIC_*` aplikasi tetap jalan sebagai tamu — tidak ada yang error.

## 3. Kunci model per akun

Server action / route yang memanggil `set_model_key` (RPC Postgres, sudah disiapkan):

```ts
await supabase.rpc("set_model_key", { p_key: apiKeyFromForm });
await supabase.from("accounts").update({ offline_ai: true, model_name: "gpt-4o-mini" }).eq("id", user.id);
```

Setelah itu `AccountLayer` membaca `offline_ai` dan menandai akun siap AI offline.

## 3b. Pilihan penyimpanan (toggle di header)

| Pilihan | Login (Google) | Riwayat, agen, kunci model | Worker offline |
|---|---|---|---|
| **Server kami** | Supabase kami | Supabase kami (baris `offices`) | tick tulis ke kami |
| **Supabase milik saya** | tetap di kami | **100% di proyek user** | tick tulis ke proyek user |

Alur pilih "Supabase milik saya":
1. Header → tombol "Data: server kami" → pilih **Supabase milik saya**.
2. Jalankan SQL di panel modal pada proyek Supabase user (buat tabel `offices` + RLS).
3. Isi URL proyek + anon key → Simpan. Browser mulai menulis langsung ke proyek user
   (RLS `auth.uid() = account_id`).

Yang disimpan di server kita saat mode "own": baris login (`accounts`) plus **satu baris
`partner_links`** milik user itu (URL proyek + anon key terenkripsi pgcrypto). Tidak ada
koneksi proyek di env — jumlah user tak terbatas dan tiap user bawa proyeknya sendiri.

`PARTNER_ENCRYPTION_KEY` hanyalah passphrase server untuk mengenkripsi isi kolom
`anon_key_enc`; bukan kredensial milik user dan tidak bisa dipakai ke proyek siapa pun
tanpa baris `partner_links`-nya.

Skrip kerja sama konfirmasi layar pantau:

```text
GET /api/offline/tick   ← dipanggil pg_cron tiap 15 menit
  hosted  : update baris offices kita
  partner : GET + POST ke /rest/v1/offices milik user (kunci dari Vault)
```

## 4. Status implementasi

| Bagian | Status |
|---|---|
| Memori guest → localStorage | ✅ `lib/agent-memory.ts` |
| Memori akun → Postgres | ✅ `app/api/memory/route.ts` + `components/MemoryBridge.tsx` |
| Login Google | ✅ `components/AccountLayer.tsx` (aktif bila env diisi) |
| Aturan kantor bersama browser/server | ✅ `lib/office-dynamics.ts` |
| Tick offline (acak aktivitas) | ✅ `app/api/offline/tick/route.ts` |
| Panggilan model offline | ⏳ stub — butuh provider per akun (ikuti pola `callOpenAICompatible` di `app/api/agent/chat/route.ts`) |
| `set_model_key` di schema | ✅ `supabase/schema.sql` |
| Pilihan penyimpanan (hosted / own) | ✅ `components/StoragePicker.tsx`, `lib/storage-mode.ts`, `lib/partner-storage.ts` |
| Koneksi proyek per user di DB | ✅ `public.partner_links` + RPC `save_partner` / `read_partner_secret` |
| Worker menulis ke proyek user | ✅ `app/api/offline/tick/route.ts` (dekripsi per akun, satu round-trip) |
| Sinkron agen antar perangkat | ✅ snapshot `settings.agents` di `lib/agent-memory.ts` |

Langkah lanjut paling masuk akal: sambungkan stub AI di `runOffice` ke provider memakai key dari Vault, lalu uji dengan satu akun.
