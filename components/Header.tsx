"use client";

import { motion } from "framer-motion";
import { Cloud, Cpu, Database, KeyRound, LogIn, LogOut, Settings2, Sparkles, UserRound, Users, Wifi, WifiOff } from "lucide-react";
import { useOffice } from "@/lib/store";
import { accountsEnabled, signInWithGoogle, signOut } from "./AccountLayer";

function Logo() {
  return (
    <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br from-emerald-400/20 via-cyan-400/10 to-indigo-500/20 shadow-[0_0_35px_-12px_rgba(94,234,212,0.9)]">
      <motion.span
        className="absolute inset-2 rounded-full border border-emerald-300/40"
        animate={{ rotate: 360 }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
      />
      <motion.span
        className="absolute inset-[10px] rounded-full border border-cyan-300/40 border-dashed"
        animate={{ rotate: -360 }}
        transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
      />
      <motion.span
        className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_12px_#5eead4]"
        animate={{ scale: [1, 1.35, 1], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 2.4, repeat: Infinity }}
      />
    </div>
  );
}

/** the colourful G, drawn inline so we do not pull an icon pack for it */
function GoogleGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.4 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-2.8-.4-4.1H24v8.2h12.6c-.3 2.1-1.6 5.2-4.7 7.3l7.6 5.9c4.6-4.2 6.6-10.4 6.6-17.3z" />
      <path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.8-6.1C1 16.4 0 20.1 0 24s1 7.6 2.6 10.8l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.5-5.6l-7.6-5.9c-2 1.4-4.7 2.4-7.9 2.4-6.3 0-11.7-3.9-13.6-9.5l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export function Header() {
  const agents = useOffice((s) => s.agents);
  const openModal = useOffice((s) => s.openModal);
  const autoLife = useOffice((s) => s.autoLife);
  const setAutoLife = useOffice((s) => s.setAutoLife);
  const meeting = useOffice((s) => s.meeting);
  const account = useOffice((s) => s.account);
  const setStoragePickerOpen = useOffice((s) => s.setStoragePickerOpen);
  const authBusy = useOffice((s) => s.authBusy);
  const setModelKeyOpen = useOffice((s) => s.setModelKeyOpen);
  const notify = useOffice((s) => s.notify);

  const online = agents.filter((a) => !a.hasError).length;
  // signed in = every agent must run on a real model; guests fall back to demo
  const demoCount = account
    ? agents.filter((a) => a.demoMode || !a.apiKey).length
    : agents.filter((a) => a.demoMode || !a.apiKey).length;

  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3.5">
        <Logo />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">
              AI Office <span className="text-glow text-emerald-300">Orchestra</span>
            </h1>
            <span className="rounded-md border border-emerald-300/25 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-200">
              live 3D
            </span>
          </div>
          <p className="mt-0.5 max-w-xl text-[11px] leading-relaxed text-slate-400 sm:text-xs">
            Kantor virtual 3D tempat para pegawai AI berjalan, duduk, rapat, ngobrol, sholat, dan tidur saat API-nya error.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          <div className="flex items-center gap-1.5">
            <Users size={12} className="text-cyan-300" />
            <span className="text-[10px] font-semibold text-slate-200">
              {online}/{agents.length} online
            </span>
          </div>
          <span className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-1.5">
            <Cpu size={12} className="text-violet-300" />
            <span className="text-[10px] font-semibold text-slate-200">
              {account ? (account.modelKey ? "AI aktif" : "butuh key") : `${demoCount} demo`}
            </span>
          </div>
          <span className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-1.5">
            <Sparkles size={12} className="text-amber-300" />
            <span className="text-[10px] font-semibold text-slate-200">
              {meeting && meeting.phase !== "ended" ? "rapat aktif" : "standby"}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAutoLife(!autoLife)}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-semibold transition ${
            autoLife
              ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20"
              : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]"
          }`}
        >
          {autoLife ? <Wifi size={12} /> : <WifiOff size={12} />}
          {autoLife ? "Mode hidup" : "Dijeda"}
        </button>

        {accountsEnabled && !account && (
          <button
            type="button"
            disabled={authBusy}
            onClick={() => {
              void signInWithGoogle().catch(() => notify("Gagal membuka login Google.", "error"));
            }}
            className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-[10px] font-bold text-white transition hover:border-cyan-300/40 hover:bg-cyan-400/10 disabled:opacity-60"
          >
            <GoogleGlyph />
            {authBusy ? "Menghubungkan…" : "Masuk Google"}
          </button>
        )}

        {account && (
          <button
            type="button"
            onClick={() => setStoragePickerOpen(true)}
            title="Pilih di mana data kantor disimpan"
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-semibold text-slate-300 transition hover:border-cyan-300/40 hover:bg-cyan-400/10 hover:text-cyan-100"
          >
            {account.storageMode === "own" ? <Database size={12} /> : <Cloud size={12} />}
            {account.storageMode === "own" ? "Data: milikmu" : "Data: server kami"}
          </button>
        )}

        {account && (
          <button
            type="button"
            onClick={() => setModelKeyOpen(true)}
            title="Pasang / ganti API key model"
            className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[10px] font-bold transition ${
              account.modelKey
                ? "border-amber-300/30 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20"
                : "border-rose-300/40 bg-rose-400/10 text-rose-200 hover:bg-rose-400/20"
            }`}
          >
            <KeyRound size={11} />
            {account.modelKey ? "API key" : "Pasang API key"}
          </button>
        )}

        {account && (
          <div className="flex items-center gap-1.5 rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1.5">
            <UserRound size={12} className="text-emerald-300" />
            <span className="max-w-[140px] truncate text-[10px] font-semibold text-emerald-100">
              {account.name ?? account.email}
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              title="Keluar"
              className="rounded p-0.5 text-emerald-200/70 transition hover:bg-white/10 hover:text-white"
              aria-label="Keluar"
            >
              <LogOut size={11} />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => openModal()}
          className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-[10px] font-bold text-white transition hover:border-emerald-300/40 hover:bg-emerald-400/10"
        >
          <Settings2 size={13} /> Kelola Pegawai AI
        </button>
      </div>
    </header>
  );
}
