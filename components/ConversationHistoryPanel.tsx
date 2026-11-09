"use client";

/**
 * Riwayat obrolan & rapat pegawai dari database (public.conversations).
 * Hanya untuk pemilik yang login; tamu melihat ajakan login.
 */

import { useEffect, useState } from "react";
import { MessageSquare, Users, X } from "lucide-react";
import { useOffice } from "@/lib/store";
import {
  listConversations,
  listMessages,
  type ConversationMessage,
  type ConversationSummary,
} from "@/lib/conversations";

export function ConversationHistoryPanel({ onClose }: { onClose: () => void }) {
  const account = useOffice((s) => s.account);
  const [items, setItems] = useState<ConversationSummary[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  useEffect(() => {
    if (!account) return;
    void listConversations(50).then(setItems);
  }, [account]);

  useEffect(() => {
    if (!openId) {
      setMessages([]);
      return;
    }
    void listMessages(openId).then(setMessages);
  }, [openId]);

  return (
    <div className="fixed inset-0 z-[79] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="flex h-[82vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-950/95 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageSquare size={15} className="text-cyan-300" />
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">Arsip kantor</p>
              <h2 className="text-sm font-bold text-white">Riwayat obrolan & rapat</h2>
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

        <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[260px_1fr]">
          <div className="min-h-0 overflow-y-auto border-b border-white/10 p-2 sm:border-b-0 sm:border-r">
            {!account && <p className="p-2 text-[10px] text-slate-400">Masuk dengan Google untuk melihat riwayat.</p>}
            {account && items === null && <p className="p-2 text-[10px] text-slate-500">memuat…</p>}
            {account && items?.length === 0 && (
              <p className="p-2 text-[10px] text-slate-500">Belum ada obrolan. Pegawai akan tercatat saat mulai ngobrol.</p>
            )}
            {items?.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setOpenId(c.id)}
                className={`mb-1 w-full rounded-lg px-2 py-1.5 text-left transition ${
                  openId === c.id ? "bg-cyan-400/15 text-cyan-100" : "text-slate-300 hover:bg-white/5"
                }`}
              >
                <p className="flex items-center gap-1 text-[8.5px] font-bold uppercase tracking-wider text-slate-500">
                  {c.kind === "meeting" ? "Rapat" : "Ngobrol"} · {new Date(c.startedAt).toLocaleString("id-ID")}
                </p>
                <p className="truncate text-[10.5px] font-semibold">{c.topic || "(tanpa topik)"}</p>
                <p className="flex items-center gap-1 text-[9px] text-slate-500">
                  <Users size={9} /> {c.participantIds.length} pegawai · {c.messageCount} kalimat
                </p>
              </button>
            ))}
          </div>

          <div className="min-h-0 overflow-y-auto p-3">
            {!openId && <p className="text-[10px] text-slate-500">Pilih satu obrolan di kiri.</p>}
            {messages.map((m) => (
              <div key={m.id} className="mb-2">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  {m.agentName || "Sistem"} <span className="font-normal normal-case text-slate-600">{m.role}</span>
                  {m.kind === "meeting" ? ` · putaran ${m.round}` : ""}
                </p>
                <p
                  className={`text-[11px] leading-relaxed ${
                    m.kind === "system" ? "italic text-amber-200/80" : "text-slate-200"
                  }`}
                >
                  {m.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
