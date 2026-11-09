"use client";

/**
 * Runs once per login, before anything else is clickable.
 *
 *  step 1  choose where the office lives (our server / the user's Supabase)
 *  step 2  (own only) connect the project: URL + publishable/anon key — REQUIRED
 *  step 3  (always) plug in a model API key so agents stop running in demo mode
 *
 * Nothing here can be skipped: the owner cannot reach the office with demo
 * agents, because a signed-in account is expected to run on a real model.
 */

import { useState } from "react";
import { ArrowRight, Check, ChevronLeft, Cloud, Database, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useOffice } from "@/lib/store";
import { useMemory } from "@/lib/agent-memory";
import { savePartner, savePartnerAnonKey, type StorageMode } from "@/lib/storage-mode";
import { saveModelKey, testModelKey } from "@/lib/model-key";
import { ModelPicker } from "./ModelPicker";
import { authHeaders } from "@/lib/session";

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

/**
 * API default KANTOR ORCAI (OpenAI-compatible). Pre-filled so the owner only has
 * to paste a key; the model list is fetched from this base URL afterwards.
 * Override with NEXT_PUBLIC_DEFAULT_API_URL when deploying your own gateway.
 */
const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_DEFAULT_API_URL || "https://api.openai.com/v1";
/** picked for real once the key returns a list; empty = must choose */
const DEFAULT_MODEL = "";

export function OnboardingWizard({ onDone }: { onDone: () => void }) {
  const account = useOffice((s) => s.account);
  const setAccount = useOffice((s) => s.setAccount);
  const agents = useOffice((s) => s.agents);
  const saveAgent = useOffice((s) => s.saveAgent);
  const notify = useOffice((s) => s.notify);

  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<StorageMode | null>(null);

  // partner project
  const [url, setUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [partnerBusy, setPartnerBusy] = useState(false);
  const [partnerDone, setPartnerDone] = useState(false);

  // model key
  // the account already saved these: show them instead of the shipped default
  const [baseUrl, setBaseUrl] = useState(account?.apiBaseUrl || DEFAULT_BASE_URL);
  const [model, setModel] = useState(account?.modelName || DEFAULT_MODEL);
  const [modelKey, setModelKey] = useState(account?.modelKey ?? "");
  const [keyHint, setKeyHint] = useState<string | null>(null);
  const [modelBusy, setModelBusy] = useState(false);
  /** passed once the provider answered a real completion */
  const [testPassed, setTestPassed] = useState(false);
  const [testNote, setTestNote] = useState<{ ok: boolean; text: string } | null>(null);

  const cleanUrl = url.trim().replace(/\/+$/, "");
  const urlOk = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cleanUrl);
  const anonOk = anonKey.trim().length >= 40;

  /* ------------------------------------------------------------- connect project */
  const connectProject = async () => {
    if (!account) return;
    if (!urlOk || !anonOk) {
      notify("URL dan publishable/anon key wajib diisi dengan benar.", "error");
      return;
    }
    setPartnerBusy(true);
    try {
      // probe first: the table must exist, otherwise their office would be lost
      const probe = await fetch(`${cleanUrl}/rest/v1/offices?select=account_id&limit=1`, {
        headers: { apikey: anonKey.trim(), Authorization: `Bearer ${anonKey.trim()}` },
        cache: "no-store",
      });
      if (!probe.ok) {
        notify(
          probe.status === 404
            ? "Tabel `offices` belum ada di proyekmu — jalankan SQL dulu."
            : `Proyek merespons ${probe.status}.`,
          "error",
        );
        setPartnerBusy(false);
        return;
      }

      const res = await fetch("/api/account/partner", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ url: cleanUrl, anonKey: anonKey.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data?.ok) {
        notify(data?.error ?? "Gagal menyimpan koneksi proyek.", "error");
        setPartnerBusy(false);
        return;
      }

      savePartner(account.id, {
        mode: "own",
        url: cleanUrl,
        schema: "kantor-orcai",
        connectedAt: Date.now(),
      });
      savePartnerAnonKey(account.id, anonKey.trim());
      setPartnerDone(true);
      setStep(2);
    } catch {
      notify("Tidak bisa menghubungi proyek Supabase kamu.", "error");
    } finally {
      setPartnerBusy(false);
    }
  };

  /* ------------------------------------------------------------- model key */
  const verifyModel = async () => {
    if (modelKey.trim().length < 16) {
      notify("API key model wajib diisi agar AI bisa berjalan.", "error");
      return;
    }
    if (!model.trim()) {
      notify("Pilih model dari daftar dulu — baru tes koneksi bisa jalan.", "error");
      return;
    }
    setModelBusy(true);
    setTestNote(null);
    const test = await testModelKey({ key: modelKey.trim(), model: model.trim(), baseUrl: baseUrl.trim() });
    setModelBusy(false);
    if (!test.ok) {
      setTestPassed(false);
      setTestNote({ ok: false, text: test.error ?? "Tes gagal." });
      return;
    }
    setTestPassed(true);
    setTestNote({ ok: true, text: `Model menjawab dalam ${test.ms ?? 0} ms.` });
  };

  const activateModel = async () => {
    if (!account) return;
    if (!testPassed) {
      notify("Tes API key dulu — AI hanya aktif setelah tes berhasil.", "error");
      return;
    }
    setModelBusy(true);
    const res = await saveModelKey({ key: modelKey.trim(), model: model.trim(), baseUrl: baseUrl.trim() });
    if (!res.ok) {
      // never "swallow" the key: keep it in the field and tell the user why
      notify(res.error ?? "Gagal menyimpan API key. Coba lagi.", "error");
      setModelBusy(false);
      return;
    }
    for (const agent of agents) {
      saveAgent({
        ...agent,
        apiKey: modelKey.trim(),
        apiBaseUrl: baseUrl.trim(),
        model: model.trim(),
        demoMode: false,
      });
    }
    const storageMode: StorageMode = mode === "own" ? "own" : "hosted";
    useMemory.getState().updateSettings({ storageMode, offlineAi: true });
    setAccount({
      ...account,
      storageMode,
      modelKey: modelKey.trim(),
      modelName: model.trim(),
      offlineAi: true,
      setupComplete: true,
    });
    notify("Semua pegawai AI aktif dengan model asli.", "success");
    setModelBusy(false);
    onDone();
  };

  const chooseMode = (next: StorageMode) => {
    setMode(next);
    if (next === "hosted") {
      // our server keeps everything; nothing to connect
      useMemory.getState().updateSettings({ storageMode: "hosted" });
      if (account) setAccount({ ...account, storageMode: "hosted" });
      setStep(2);
    } else {
      setStep(1);
    }
  };

  /* ------------------------------------------------------------- UI */
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md">
      <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-slate-950/97 shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">
            Selamat datang{account?.name ? `, ${account.name.split(" ")[0]}` : ""}
          </p>
          <h2 className="text-sm font-bold text-white">Siapkan kantormu — 2 langkah, tidak bisa dilewati</h2>
          <div className="mt-2 flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full ${
                  i < step ? "bg-emerald-400" : i === step ? "bg-cyan-400" : "bg-white/10"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3 p-4">
          {/* step 1 — storage */}
          {step === 0 && (
            <>
              <p className="text-[11px] font-bold text-white">1. Di mana data kantor disimpan?</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => chooseMode("hosted")}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left transition hover:border-cyan-300/60 hover:bg-cyan-400/10"
                >
                  <Cloud size={15} className="text-cyan-300" />
                  <p className="mt-1.5 text-[11px] font-bold text-white">Server KANTOR ORCAI</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-slate-400">
                    Riwayat, agen, dan API key disimpan di Supabase kami. Paling cepat.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => chooseMode("own")}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left transition hover:border-emerald-300/60 hover:bg-emerald-400/10"
                >
                  <Database size={15} className="text-emerald-300" />
                  <p className="mt-1.5 text-[11px] font-bold text-white">Supabase milik saya</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-slate-400">
                    Data hanya ada di proyekmu. Wajib menyerahkan URL + API key Supabase.
                  </p>
                </button>
              </div>
            </>
          )}

          {/* step 2 — partner project (own only) */}
          {step === 1 && (
            <>
              <p className="text-[11px] font-bold text-white">2. Hubungkan proyek Supabase milikmu</p>
              <p className="text-[10px] leading-relaxed text-slate-400">
                Jalankan SQL ini di <span className="text-slate-200">SQL Editor</span> proyekmu, lalu tempel URL dan
                publishable/anon key di bawah.
              </p>
              <pre className="max-h-40 overflow-auto rounded-lg bg-black/60 p-2.5 font-mono text-[9.5px] leading-relaxed text-emerald-200">
                {PARTNER_SQL}
              </pre>

              <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                Project URL <span className="text-rose-300">*</span>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://abcdefghijkl.supabase.co"
                  spellCheck={false}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 font-mono text-[11px] font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-emerald-300/60"
                />
              </label>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                Publishable / anon key <span className="text-rose-300">*</span>
                <input
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  type="password"
                  autoComplete="off"
                  placeholder="sb_publishable_… / eyJ…"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 font-mono text-[11px] font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-emerald-300/60"
                />
              </label>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-slate-300 hover:bg-white/10"
                >
                  <ChevronLeft size={11} /> Kembali
                </button>
                <button
                  type="button"
                  onClick={() => void connectProject()}
                  disabled={!urlOk || !anonOk || partnerBusy}
                  className="ml-auto flex items-center gap-1.5 rounded-lg bg-emerald-400 px-3 py-1.5 text-[10px] font-black text-slate-950 transition hover:bg-emerald-300 disabled:opacity-40"
                >
                  {partnerBusy ? <Loader2 size={11} className="animate-spin" /> : <ArrowRight size={11} />} Hubungkan
                </button>
              </div>
            </>
          )}

          {/* step 3 — model key (always) */}
          {step === 2 && (
            <>
              <p className="text-[11px] font-bold text-white">
                {mode === "own" ? "3" : "2"}. API key model <span className="text-rose-300">*</span>
              </p>
              <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-400">
                <KeyRound size={12} className="mt-0.5 shrink-0 text-amber-300" />
                Setelah login, semua pegawai berjalan dengan model asli (mode demo dimatikan). Kunci disimpan
                terenkripsi dan hanya dipakai untuk memanggil model.
              </p>
              <p className="rounded-lg border border-amber-300/30 bg-amber-400/10 px-2.5 py-1.5 text-[10px] leading-relaxed text-amber-100">
                Kunci yang kamu isi di sini menjadi <span className="font-bold">default untuk semua pegawai AI</span>.
                Tiap pegawai masih bisa memakai kunci, base URL, dan model sendiri lewat{" "}
                <span className="font-semibold">Kelola Pegawai AI</span>.
              </p>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                API key <span className="text-rose-300">*</span>
                <input
                  value={modelKey}
                  onChange={(e) => {
                    setModelKey(e.target.value);
                    setTestPassed(false);
                    setTestNote(null);
                    setModel("");
                  }}
                  type="password"
                  autoComplete="off"
                  placeholder="API key model"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 font-mono text-[11px] font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-amber-300/60"
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  Base URL
                  <input
                    value={baseUrl}
                    onChange={(e) => {
                      setBaseUrl(e.target.value);
                      setModel("");
                      setTestPassed(false);
                    }}
                    spellCheck={false}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 font-mono text-[11px] font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-amber-300/60"
                  />
                </label>
                <ModelPicker
                  baseUrl={baseUrl}
                  apiKey={modelKey}
                  value={model}
                  onChange={(m) => {
                    setModel(m);
                    setTestPassed(false);
                    setTestNote(null);
                  }}
                  onKeyHint={setKeyHint}
                />
              </div>

              {keyHint && (
                <p className="rounded-lg border border-amber-300/30 bg-amber-400/10 px-2.5 py-1.5 text-[10px] leading-relaxed text-amber-100">
                  {keyHint}
                </p>
              )}

              {partnerDone && (
                <p className="flex items-center gap-1.5 rounded-lg border border-emerald-300/30 bg-emerald-400/10 p-2 text-[10px] font-semibold text-emerald-200">
                  <Check size={11} /> Proyek Supabase milikmu terhubung.
                </p>
              )}

              {testNote && (
                <p
                  className={`flex items-start gap-1.5 rounded-lg border p-2 text-[10px] font-semibold leading-relaxed ${
                    testNote.ok
                      ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
                      : "border-rose-300/30 bg-rose-400/10 text-rose-200"
                  }`}
                >
                  {testNote.ok ? <Check size={11} className="mt-0.5 shrink-0" /> : null}
                  {testNote.ok ? "Tes berhasil — " : ""}
                  {testNote.text}
                </p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setStep(mode === "own" ? 1 : 0)}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-slate-300 hover:bg-white/10"
                >
                  <ChevronLeft size={11} /> Kembali
                </button>
                <button
                  type="button"
                  onClick={() => void verifyModel()}
                  disabled={modelKey.trim().length < 16 || !model.trim() || modelBusy}
                  className="ml-auto flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-[10px] font-bold text-slate-100 transition hover:bg-white/10 disabled:opacity-40"
                >
                  {modelBusy && !testPassed ? <Loader2 size={11} className="animate-spin" /> : null} Tes koneksi
                </button>
                <button
                  type="button"
                  onClick={() => void activateModel()}
                  disabled={!testPassed || modelBusy}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-[10px] font-black text-slate-950 transition hover:bg-amber-300 disabled:opacity-40"
                >
                  {modelBusy && testPassed ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}{" "}
                  Aktifkan AI
                </button>
              </div>
            </>
          )}
        </div>

        <p className="flex items-start gap-1.5 border-t border-white/10 px-4 py-2.5 text-[9px] leading-relaxed text-slate-500">
          <ShieldCheck size={11} className="mt-0.5 shrink-0" />
          Login Google selalu tersimpan di server KANTOR ORCAI. Data kantor & API key hanya ke tujuan yang kamu pilih.
        </p>
      </div>
    </div>
  );
}
