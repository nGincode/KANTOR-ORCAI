"use client";

import { motion } from "framer-motion";
import { Cpu, Settings2, Sparkles, Users, Wifi, WifiOff } from "lucide-react";
import { useOffice } from "@/lib/store";

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

export function Header() {
  const agents = useOffice((s) => s.agents);
  const openModal = useOffice((s) => s.openModal);
  const autoLife = useOffice((s) => s.autoLife);
  const setAutoLife = useOffice((s) => s.setAutoLife);
  const meeting = useOffice((s) => s.meeting);

  const online = agents.filter((a) => !a.hasError).length;
  const demoCount = agents.filter((a) => a.demoMode || !a.apiKey).length;

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
            <span className="text-[10px] font-semibold text-slate-200">{demoCount} demo</span>
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
