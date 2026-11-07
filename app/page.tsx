"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { AgentManagerModal } from "@/components/AgentManagerModal";
import { Toast } from "@/components/Toast";
import { useOffice } from "@/lib/store";

const Office3D = dynamic(
  () => import("@/components/office/Office3D").then((mod) => mod.Office3D),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[62vh] min-h-[430px] w-full items-center justify-center rounded-[22px] border border-white/10 bg-[#060a13]">
        <div className="flex flex-col items-center gap-2">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-300/30 border-t-emerald-300" />
          <span className="text-[11px] font-semibold text-slate-400">Membangun kantor 3D…</span>
        </div>
      </div>
    ),
  },
);

export default function Page() {
  const initAutoLife = useOffice((s) => s.initAutoLife);
  const agents = useOffice((s) => s.agents);

  useEffect(() => {
    initAutoLife();
  }, [initAutoLife]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1780px] flex-col gap-4 px-3 py-4 sm:px-5">
      <Header />

      <div className="grid flex-1 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_404px]">
        <div className="min-w-0">
          <Office3D />
        </div>
        <div className="min-w-0 xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
          <Sidebar />
        </div>
      </div>

      <footer className="flex flex-col items-center justify-between gap-1.5 pb-1 pt-1 text-[9.5px] text-slate-500 sm:flex-row">
        <p>
          Klik karakter untuk memilih · {agents.length} pegawai AI · berjalan lewat pintu, duduk, rapat, sholat, dan tidur.
        </p>
        <p className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Mode demo aktif — API key hanya disimpan di memori browser.
        </p>
      </footer>

      <AgentManagerModal />
      <Toast />
    </div>
  );
}
