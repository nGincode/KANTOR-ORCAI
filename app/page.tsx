"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { AgentManagerModal } from "@/components/AgentManagerModal";
import { Toast } from "@/components/Toast";
import { StoragePicker } from "@/components/StoragePicker";
import { ModelKeyModal } from "@/components/ModelKeyModal";
import { ConversationHistoryPanel } from "@/components/ConversationHistoryPanel";
import { OnboardingGate } from "@/components/OnboardingGate";
import { AccountLayer } from "@/components/AccountLayer";
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
  const storagePickerOpen = useOffice((s) => s.storagePickerOpen);
  const setStoragePickerOpen = useOffice((s) => s.setStoragePickerOpen);
  const modelKeyOpen = useOffice((s) => s.modelKeyOpen);
  const setModelKeyOpen = useOffice((s) => s.setModelKeyOpen);
  const account = useOffice((s) => s.account);
  const [historyOpen, setHistoryOpen] = useState(false);

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
          {account
            ? account.modelKey
              ? `Masuk sebagai ${account.email} · semua pegawai berjalan dengan model asli.`
              : `Masuk sebagai ${account.email} · pasang API key untuk mengaktifkan AI penuh.`
            : "Belum login — pegawai masih memakai jawaban demo. Masuk dengan Google untuk AI penuh."}
          {account && (
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="rounded border border-white/10 px-1.5 py-0.5 font-bold text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-200"
            >
              Riwayat obrolan
            </button>
          )}
        </p>
      </footer>

      <AccountLayer />
      <OnboardingGate />
      {storagePickerOpen && <StoragePicker onClose={() => setStoragePickerOpen(false)} />}
      {modelKeyOpen && <ModelKeyModal onClose={() => setModelKeyOpen(false)} />}
      {historyOpen && <ConversationHistoryPanel onClose={() => setHistoryOpen(false)} />}
      <AgentManagerModal />
      <Toast />
    </div>
  );
}
