"use client";

/**
 * The one thing a signed-in owner must do: plug in a model key.
 *
 * Once saved, every agent leaves demo mode and talks to the real model; the key
 * is stored encrypted in Vault and only ever returned to its owner.
 */

import { useEffect, useState } from "react";
import { Check, KeyRound, Loader2, Sparkles, X } from "lucide-react";
import { useOffice } from "@/lib/store";
import { saveModelKey, testModelKey } from "@/lib/model-key";
import { ModelPicker } from "./ModelPicker";

/** API default KANTOR ORCAI; model dipilih dari daftar penyedia setelah key valid */
const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_DEFAULT_API_URL || "https://api.openai.com/v1";

export function ModelKeyModal({ onClose }: { onClose: () => void }) {
  const account = useOffice((s) => s.account);
  const setAccount = useOffice((s) => s.setAccount);
  const notify = useOffice((s) => s.notify);
  const saveAgent = useOffice((s) => s.saveAgent);
  const agents = useOffice((s) => s.agents);

  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [model, setModel] = useState(account?.modelName ?? "");
  const [keyHint, setKeyHint] = useState<string | null>(null);
  const [key, setKey] = useState(account?.modelKey ?? "");
  const [busy, setBusy] = useState(false);
  const [tested, setTested] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  // the account's key/model/base URL come from the database (read_model_key) —
  // pre-fill them so this modal is only for changing, never for re-entering
  useEffect(() => {
    if (!account) return;
    if (account.modelKey) setKey((prev) => prev || account.modelKey!);
    if (account.modelName) setModel((prev) => prev || account.modelName!);
    if (account.apiBaseUrl) setBaseUrl(account.apiBaseUrl);
  }, [account]);

  const verify = async () => {
    if (key.trim().length < 16) {
      notify("Masukkan API key yang valid.", "error");
      return;
    }
    if (!model.trim()) {
      notify("Pilih model dari daftar dulu — baru tes koneksi bisa jalan.", "error");
      return;
    }
    setBusy(true);
    setNote(null);
    const test = await testModelKey({ key: key.trim(), model: model.trim(), baseUrl: baseUrl.trim() });
    setBusy(false);
    if (!test.ok) {
      setTested(false);
      setNote({ ok: false, text: test.error ?? "Tes gagal." });
      return;
    }
    setTested(true);
    setNote({ ok: true, text: `Model menjawab dalam ${test.ms ?? 0} ms.` });
  };

  const apply = async () => {
    if (!account) return;
    if (!tested) {
      notify("Tes koneksi dulu sebelum mengaktifkan AI.", "error");
      return;
    }
    setBusy(true);
    const res = await saveModelKey({ key: key.trim(), model: model.trim(), baseUrl: baseUrl.trim() });
    if (!res.ok) {
      notify(res.error ?? "Gagal menyimpan API key.", "error");
      setBusy(false);
      return;
    }
    // every employee switches to the real model, keeping its own persona
    for (const agent of agents) {
      saveAgent({
        ...agent,
        apiKey: key.trim(),
        apiBaseUrl: baseUrl.trim(),
        model: model.trim(),
        demoMode: false,
      });
    }
    setAccount({ ...account, modelKey: key.trim(), modelName: model.trim() });
    notify("Semua pegawai AI kini berjalan dengan model asli.", "success");
    setBusy(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[78] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/15 bg-slate-950/95 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <KeyRound size={15} className="text-amber-300" />
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-amber-300/80">Mode AI penuh</p>
              <h2 className="text-sm font-bold text-white">Pasang API key model</h2>
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

        <div className="space-y-3 p-4">
          <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-400">
            <Sparkles size={12} className="mt-0.5 shrink-0 text-amber-300" />
            Setelah login, mode demo dimatikan dan semua pegawai berbicara lewat model asli. Kunci disimpan terenkripsi
            dan hanya dikirim ke model yang kamu pilih.
          </p>
          <p className="rounded-lg border border-amber-300/30 bg-amber-400/10 px-2.5 py-1.5 text-[10px] leading-relaxed text-amber-100">
            Kunci di sini adalah <span className="font-bold">default untuk semua pegawai</span>. Setiap pegawai tetap
            bisa punya kunci sendiri lewat <span className="font-semibold">Kelola Pegawai AI</span>.
          </p>

          <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
            API key
            <input
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setTested(false);
                setModel("");
                setNote(null);
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
                  setTested(false);
                }}
                spellCheck={false}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 font-mono text-[11px] font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-amber-300/60"
              />
            </label>
            <ModelPicker
              baseUrl={baseUrl}
              apiKey={key}
              value={model}
              onChange={(m) => {
                setModel(m);
                setTested(false);
                setNote(null);
              }}
              onKeyHint={setKeyHint}
            />
          </div>

          {keyHint && (
            <p className="rounded-lg border border-amber-300/30 bg-amber-400/10 px-2.5 py-1.5 text-[10px] leading-relaxed text-amber-100">
              {keyHint}
            </p>
          )}

          {note && (
            <p
              className={`flex items-start gap-1.5 rounded-lg border p-2 text-[10px] font-semibold leading-relaxed ${
                note.ok
                  ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
                  : "border-rose-300/30 bg-rose-400/10 text-rose-200"
              }`}
            >
              {note.ok ? <Check size={11} className="mt-0.5 shrink-0" /> : null}
              {note.ok ? "Tes berhasil — " : ""}
              {note.text}
            </p>
          )}

          <p className="text-[9px] leading-relaxed text-slate-500">
            Digunakan oleh semua pegawai sekaligus. Bisa diganti kapan saja lewat tombol ini lagi.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-[10px] font-bold text-slate-300 transition hover:bg-white/10"
            >
              Nanti
            </button>
            <button
              type="button"
              onClick={() => void verify()}
              disabled={busy || key.trim().length < 16 || !model.trim()}
              className="flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-[10px] font-bold text-slate-100 transition hover:bg-white/10 disabled:opacity-40"
            >
              {busy && !tested ? <Loader2 size={11} className="animate-spin" /> : null} Tes koneksi
            </button>
            <button
              type="button"
              onClick={() => void apply()}
              disabled={!tested || busy}
              className="flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-[10px] font-black text-slate-950 transition hover:bg-amber-300 disabled:opacity-50"
            >
              {busy && tested ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Aktifkan AI
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
