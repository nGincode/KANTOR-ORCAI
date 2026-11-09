"use client";

/**
 * "Use my own Supabase" — the setup sheet a user sees after picking that option.
 *
 * Steps, in the order the sheet presents them:
 *  1. create the office table in THEIR project (SQL is copy-pasteable)
 *  2. paste the project URL + publishable/anon key
 *  3. we probe the project, store ONE row in public.partner_links (anon key
 *     encrypted with pgcrypto) and switch the account to storage_mode = 'own'
 *
 * From then on their browser writes their office straight into their project and
 * the worker delivers offline ticks to that same project.
 */

import { useState } from "react";
import { Check, ChevronDown, Code2, Database, ExternalLink, Eye, EyeOff, Loader2, Rocket, ShieldCheck, X } from "lucide-react";
import { useOffice } from "@/lib/store";
import { useMemory } from "@/lib/agent-memory";
import { savePartner, savePartnerAnonKey } from "@/lib/storage-mode";
import { authHeaders } from "@/lib/session";

/** the only table a partner project needs; mirrors supabase/schema.sql */
const PARTNER_SQL = `create table if not exists public.offices (
  account_id uuid primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.offices enable row level security;

create policy "own office" on public.offices
  for all
  using (auth.uid() = account_id)
  with check (auth.uid() = account_id);`;

type Probe =
  | { state: "idle" }
  | { state: "busy" }
  | { state: "ok"; rows: number }
  | { state: "error"; message: string };

export function PartnerSetup({ onClose }: { onClose: () => void }) {
  const account = useOffice((s) => s.account);
  const setAccount = useOffice((s) => s.setAccount);
  const notify = useOffice((s) => s.notify);

  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [sqlOpen, setSqlOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [probe, setProbe] = useState<Probe>({ state: "idle" });
  const [saving, setSaving] = useState(false);

  const normaliseUrl = (raw: string) => raw.trim().replace(/\/+$/, "");
  const urlOk = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(normaliseUrl(url));
  const keyOk = key.trim().length >= 40;

  const testConnection = async () => {
    if (!urlOk || !keyOk) {
      setProbe({ state: "error", message: "Lengkapi URL dan key dulu." });
      return;
    }
    setProbe({ state: "busy" });
    try {
      const res = await fetch(`${normaliseUrl(url)}/rest/v1/offices?select=account_id&limit=1`, {
        headers: { apikey: key.trim(), Authorization: `Bearer ${key.trim()}` },
        cache: "no-store",
      });
      if (!res.ok) {
        setProbe({
          state: "error",
          message:
            res.status === 404
              ? "Tabel `offices` belum ada. Jalankan SQL di langkah 1."
              : `Proyek merespons ${res.status}.`,
        });
        return;
      }
      const rows = (await res.json()) as unknown[];
      setProbe({ state: "ok", rows: Array.isArray(rows) ? rows.length : 0 });
    } catch {
      setProbe({ state: "error", message: "Tidak bisa menghubungi proyek. Cek URL, key, dan koneksi." });
    }
  };

  const connect = async () => {
    if (!account) return;
    if (!urlOk || !keyOk) {
      notify("Isi URL Supabase dan publishable/anon key yang benar.", "error");
      return;
    }
    setSaving(true);
    try {
      // the server encrypts the key before it is stored (public.partner_links)
      const res = await fetch("/api/account/partner", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ url: normaliseUrl(url), anonKey: key.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data?.ok) {
        notify(data?.error ?? "Gagal menyimpan koneksi proyek.", "error");
        setSaving(false);
        return;
      }

      // the browser keeps its own copy so it can write straight to the project
      savePartner(account.id, {
        mode: "own",
        url: normaliseUrl(url),
        schema: "kantor-orcai",
        connectedAt: Date.now(),
      });
      savePartnerAnonKey(account.id, key.trim());
      useMemory.getState().updateSettings({ storageMode: "own" });
      setAccount({ ...account, storageMode: "own" });
      notify("Terhubung. Data kantor kini disimpan di Supabase milikmu.", "success");
      onClose();
    } catch {
      notify("Gagal menghubungi server. Coba lagi.", "error");
    } finally {
      setSaving(false);
    }
  };

  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(PARTNER_SQL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      notify("Clipboard diblokir browser. Salin manual dari blok kode.", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-slate-950/95 shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <Database size={15} className="text-cyan-300" />
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">Hubungkan Supabase</p>
              <h2 className="text-sm font-bold text-white">Data kantor disimpan di proyek milikmu</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Tutup"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {/* 1 — schema */}
          <section className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-white">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-cyan-400/15 text-[9px] text-cyan-200">1</span>
              Siapkan tabel di proyekmu
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
              Buka <span className="text-slate-200">Supabase → SQL Editor</span> di proyekmu, tempel skrip ini, lalu Run.
              Cukup satu tabel; riwayat, agen, dan kunci model tersimpan di sana.
            </p>
            <button
              type="button"
              onClick={() => setSqlOpen((v) => !v)}
              className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-cyan-300 hover:text-cyan-200"
            >
              <Code2 size={11} /> {sqlOpen ? "Sembunyikan" : "Lihat"} SQL
              <ChevronDown size={11} className={sqlOpen ? "rotate-180 transition" : "transition"} />
            </button>
            {sqlOpen && (
              <div className="mt-2">
                <pre className="max-h-52 overflow-auto rounded-lg bg-black/60 p-2.5 font-mono text-[9.5px] leading-relaxed text-emerald-200">
                  {PARTNER_SQL}
                </pre>
                <button
                  type="button"
                  onClick={() => void copySql()}
                  className="mt-1.5 flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[9px] font-bold text-slate-300 transition hover:bg-white/10"
                >
                  {copied ? <Check size={10} className="text-emerald-300" /> : null}
                  {copied ? "Tersalin" : "Salin SQL"}
                </button>
              </div>
            )}
          </section>

          {/* 2 — credentials */}
          <section className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-white">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-cyan-400/15 text-[9px] text-cyan-200">2</span>
              Masukkan alamat + kunci proyek
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
              Dashboard → <span className="text-slate-200">Project Settings → API</span>. Pakai{" "}
              <span className="text-slate-200">Project URL</span> dan{" "}
              <span className="text-slate-200">publishable / anon key</span> (yang aman untuk browser). Jangan pernah
              memakai secret key.
            </p>

            <label className="mt-2.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
              Project URL
              <input
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setProbe({ state: "idle" });
                }}
                placeholder="https://abcdefghijkl.supabase.co"
                spellCheck={false}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 font-mono text-[11px] font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-cyan-300/60"
              />
            </label>

            <label className="mt-2 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
              Publishable / anon key
              <div className="relative mt-1">
                <input
                  value={key}
                  onChange={(e) => {
                    setKey(e.target.value);
                    setProbe({ state: "idle" });
                  }}
                  type={showKey ? "text" : "password"}
                  placeholder="sb_publishable_… atau eyJhbGciOi…"
                  spellCheck={false}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 pr-9 font-mono text-[11px] font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-cyan-300/60"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-white"
                  aria-label={showKey ? "Sembunyikan key" : "Tampilkan key"}
                >
                  {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
            </label>

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void testConnection()}
                disabled={probe.state === "busy"}
                className="flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-[10px] font-bold text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
              >
                {probe.state === "busy" ? <Loader2 size={11} className="animate-spin" /> : <Rocket size={11} />}
                Tes koneksi
              </button>
              {probe.state === "ok" && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-300">
                  <Check size={11} /> Terhubung — tabel offices terbaca
                </span>
              )}
              {probe.state === "error" && (
                <span className="text-[10px] font-semibold text-rose-300">{probe.message}</span>
              )}
            </div>
          </section>

          <p className="flex items-start gap-1.5 rounded-lg border border-emerald-300/25 bg-emerald-400/5 p-2.5 text-[10px] leading-relaxed text-emerald-100/90">
            <ShieldCheck size={12} className="mt-0.5 shrink-0" />
            Yang kami simpan: email login Google dan satu baris koneksi (URL + key terenkripsi) agar worker bisa
            mengirim aktivitas offline ke proyekmu. Riwayat, agen, dan kunci model tidak pernah disalin ke server kami.
          </p>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur">
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-cyan-200"
          >
            Buka dashboard Supabase <ExternalLink size={10} />
          </a>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-[10px] font-bold text-slate-300 transition hover:bg-white/10"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => void connect()}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-400 px-3 py-1.5 text-[10px] font-black text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
            >
              {saving && <Loader2 size={11} className="animate-spin" />} Hubungkan &amp; simpan di sana
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
