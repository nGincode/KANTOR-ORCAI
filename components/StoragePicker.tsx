"use client";

/**
 * After login the owner picks where the office lives.
 *
 *  hosted → our Supabase: login + history + agents + model key
 *  own    → their own Supabase project: we keep ONLY the login row plus the
 *           connection row (public.partner_links), everything else is theirs.
 *
 * Picking "own" opens <PartnerSetup/> which walks through the schema + keys.
 */

import { useState } from "react";
import { Cloud, Database, Loader2, Plug, ServerCog, ShieldCheck, X } from "lucide-react";
import { useOffice } from "@/lib/store";
import { useMemory } from "@/lib/agent-memory";
import { loadPartner, savePartner } from "@/lib/storage-mode";
import { PartnerSetup } from "./PartnerSetup";
import { authHeaders } from "@/lib/session";

export function StoragePicker({ onClose }: { onClose: () => void }) {
  const account = useOffice((s) => s.account);
  const setAccount = useOffice((s) => s.setAccount);
  const notify = useOffice((s) => s.notify);

  const [tab, setTab] = useState<"hosted" | "own">(account?.storageMode === "own" ? "own" : "hosted");
  const [setupOpen, setSetupOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  /** the project this device already linked (URL only, key stays in storage) */
  const linked = account ? loadPartner(account.id) : null;

  const switchToHosted = async () => {
    if (!account) return;
    setBusy(true);
    // drop the partner row + encrypted key on our side, keep the data in their project
    void fetch("/api/account/partner", { method: "DELETE", headers: authHeaders() }).catch(() => undefined);
    savePartner(account.id, null);
    useMemory.getState().updateSettings({ storageMode: "hosted" });
    setAccount({ ...account, storageMode: "hosted" });
    notify("Data kantor kembali disimpan di server kami.", "success");
    setBusy(false);
    onClose();
  };

  if (setupOpen) return <PartnerSetup onClose={() => setSetupOpen(false)} />;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/15 bg-slate-950/95 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">Penyimpanan</p>
            <h2 className="text-sm font-bold text-white">Di mana data kantormu disimpan?</h2>
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
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              {
                id: "hosted" as const,
                icon: Cloud,
                title: "Server kami",
                desc: "Login, riwayat, agen, dan kunci model disimpan di Supabase kami. Langsung jalan.",
              },
              {
                id: "own" as const,
                icon: Database,
                title: "Supabase milik saya",
                desc: "Riwayat, agen, dan kunci model ke proyekmu. Kami hanya simpan data login + koneksi.",
              },
            ].map((opt) => {
              const Icon = opt.icon;
              const active = tab === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTab(opt.id)}
                  className={`rounded-xl border p-3 text-left transition ${
                    active ? "border-cyan-300/60 bg-cyan-400/10" : "border-white/10 bg-white/[0.02] hover:border-white/25"
                  }`}
                >
                  <Icon size={15} className={active ? "text-cyan-300" : "text-slate-400"} />
                  <p className="mt-1.5 text-[11px] font-bold text-white">{opt.title}</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-slate-400">{opt.desc}</p>
                </button>
              );
            })}
          </div>

          {tab === "own" && (
            <div className="space-y-2 rounded-xl border border-amber-300/30 bg-amber-400/5 p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-200">
                <ShieldCheck size={12} /> Login Google tetap di server kami. Data kantor pindah ke proyekmu.
              </p>
              {linked ? (
                <>
                  <p className="text-[10px] leading-relaxed text-slate-300">
                    Sudah terhubung ke{" "}
                    <span className="font-mono text-cyan-200">{linked.url.replace(/^https:\/\//, "")}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAccount(account ? { ...account, storageMode: "own" } : account);
                        notify("Memakai proyek Supabase milikmu.", "success");
                        onClose();
                      }}
                      className="rounded-lg bg-cyan-400 px-2.5 py-1.5 text-[10px] font-black text-slate-950 hover:bg-cyan-300"
                    >
                      Pakai proyek ini
                    </button>
                    <button
                      type="button"
                      onClick={() => setSetupOpen(true)}
                      className="flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-[10px] font-bold text-slate-200 hover:bg-white/10"
                    >
                      <Plug size={10} /> Ganti / hubungkan ulang
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setSetupOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-cyan-400 px-2.5 py-1.5 text-[10px] font-black text-slate-950 hover:bg-cyan-300"
                >
                  <Plug size={11} /> Hubungkan proyek Supabase
                </button>
              )}
            </div>
          )}

          {tab === "hosted" && (
            <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-400">
              <ServerCog size={12} className="mt-0.5 shrink-0 text-slate-500" />
              Semua diproses di server kami dan tersinkron antar perangkat. Pilih opsi kanan kalau ingin data hanya ada
              di proyek Supabase milikmu.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-[10px] font-bold text-slate-300 transition hover:bg-white/10"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => void (tab === "hosted" ? switchToHosted() : setSetupOpen(true))}
            disabled={busy || (tab === "own" && Boolean(linked))}
            className="flex items-center gap-1.5 rounded-lg bg-cyan-400 px-3 py-1.5 text-[10px] font-black text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
          >
            {busy && <Loader2 size={11} className="animate-spin" />}
            {tab === "own" ? "Hubungkan" : "Simpan di server kami"}
          </button>
        </div>
      </div>
    </div>
  );
}
