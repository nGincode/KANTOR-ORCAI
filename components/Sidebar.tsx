"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BedDouble,
  Coffee,
  Droplets,
  Flame,
  Loader2,
  MessageCircle,
  Monitor,
  Moon,
  PauseCircle,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Send,
  Sofa,
  Sparkles,
  Square,
  Sun,
  Tv,
  Users,
  Zap,
} from "lucide-react";
import { useOffice } from "@/lib/store";
import type { AgentRuntime } from "@/lib/types";

const ACTIVITY_META: Record<string, { label: string; dot: string; text: string }> = {
  IDLE: { label: "Senggang", dot: "bg-slate-400", text: "text-slate-400" },
  WALKING: { label: "Berjalan", dot: "bg-sky-400", text: "text-sky-300" },
  WORKING: { label: "Bekerja", dot: "bg-emerald-400", text: "text-emerald-300" },
  MEETING: { label: "Rapat", dot: "bg-cyan-400", text: "text-cyan-300" },
  WATCHING_TV: { label: "Nonton TV", dot: "bg-violet-400", text: "text-violet-300" },
  DRINKING: { label: "Minum", dot: "bg-amber-400", text: "text-amber-300" },
  PRAYING: { label: "Sholat", dot: "bg-emerald-500", text: "text-emerald-200" },
  COOKING: { label: "Masak mie", dot: "bg-amber-400", text: "text-amber-200" },
  TOILET: { label: "Ke Toilet", dot: "bg-stone-400", text: "text-stone-300" },
  CHATTING: { label: "Ngobrol", dot: "bg-fuchsia-400", text: "text-fuchsia-300" },
  RESTING: { label: "Istirahat", dot: "bg-indigo-400", text: "text-indigo-300" },
  ERROR: { label: "API Error", dot: "bg-rose-500", text: "text-rose-300" },
};

const QUICK_ACTIONS = [
  { type: "WORK", label: "Kerja di Meja", icon: Monitor, tone: "sky" },
  { type: "MEETING", label: "Panggil Meeting", icon: Users, tone: "cyan" },
  { type: "TV", label: "Nonton TV", icon: Tv, tone: "violet" },
  { type: "DRINK", label: "Minum", icon: Coffee, tone: "amber" },
  { type: "PRAY", label: "Sholat", icon: Moon, tone: "emerald" },
  { type: "COOK", label: "Masak Mie", icon: Flame, tone: "amber" },
  { type: "TOILET", label: "Ke Toilet", icon: Droplets, tone: "stone" },
  { type: "SOFA", label: "Duduk Sofa", icon: Sofa, tone: "indigo" },
  { type: "SLEEP", label: "Tidur", icon: BedDouble, tone: "indigo" },
  { type: "ERROR", label: "API Error", icon: AlertTriangle, tone: "rose" },
  { type: "CHAT", label: "Ajak Ngobrol", icon: MessageCircle, tone: "fuchsia" },
  { type: "RECOVER", label: "Pulihkan API", icon: RefreshCw, tone: "teal" },
];

const TONE_CLASSES: Record<string, string> = {
  sky: "border-sky-400/20 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20",
  cyan: "border-cyan-400/20 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20",
  violet: "border-violet-400/20 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20",
  amber: "border-amber-400/20 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20",
  emerald: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20",
  rose: "border-rose-400/20 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20",
  fuchsia: "border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-200 hover:bg-fuchsia-500/20",
  teal: "border-teal-400/20 bg-teal-500/10 text-teal-200 hover:bg-teal-500/20",
  stone: "border-stone-400/20 bg-stone-500/10 text-stone-200 hover:bg-stone-500/20",
  indigo: "border-indigo-400/20 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20",
};

const TASK_SUGGESTIONS = [
  "Refactor modul autentikasi dan tambahkan unit test.",
  "Optimasi query dashboard agar di bawah 200ms.",
  "Bangun halaman onboarding dengan animasi halus.",
  "Susun test matrix rilis dan jalankan regression suite.",
];

function statusOf(agent: AgentRuntime) {
  return ACTIVITY_META[agent.activity] ?? ACTIVITY_META.IDLE;
}

function AgentChip({
  agent,
  active,
  onClick,
  selected,
}: {
  agent: AgentRuntime;
  active?: boolean;
  onClick: () => void;
  selected?: boolean;
}) {
  const meta = statusOf(agent);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
        active || selected
          ? "border-cyan-300/40 bg-cyan-400/10"
          : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
      }`}
    >
      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white" style={{ background: agent.shirtColor }}>
        {agent.name
          .split(" ")
          .map((n) => n[0])
          .slice(0, 2)
          .join("")}
        <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0b1220] ${meta.dot}`} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-semibold text-slate-100">{agent.name}</span>
        <span className={`block truncate text-[9px] font-medium ${agent.hasError ? "text-rose-300" : "text-slate-400"}`}>
          {agent.hasError ? "API Error" : agent.role}
        </span>
      </span>
    </button>
  );
}

export function Sidebar() {
  const agents = useOffice((s) => s.agents);
  const meeting = useOffice((s) => s.meeting);
  const tab = useOffice((s) => s.sidebarTab);
  const setTab = useOffice((s) => s.setSidebarTab);
  const topic = useOffice((s) => s.meetingTopic);
  const setTopic = useOffice((s) => s.setMeetingTopic);
  const rounds = useOffice((s) => s.meetingRounds);
  const setRounds = useOffice((s) => s.setMeetingRounds);
  const picks = useOffice((s) => s.meetingPick);
  const togglePick = useOffice((s) => s.toggleMeetingPick);
  const setPick = useOffice((s) => s.setMeetingPick);
  const startMeeting = useOffice((s) => s.startMeeting);
  const stopMeeting = useOffice((s) => s.stopMeeting);
  const selectedAgentId = useOffice((s) => s.selectedAgentId);
  const selectAgent = useOffice((s) => s.selectAgent);
  const assignTask = useOffice((s) => s.assignTask);
  const dispatchQuick = useOffice((s) => s.dispatchQuick);
  const autoLife = useOffice((s) => s.autoLife);
  const setAutoLife = useOffice((s) => s.setAutoLife);
  const events = useOffice((s) => s.events);
  const openModal = useOffice((s) => s.openModal);
  const notify = useOffice((s) => s.notify);

  const [taskText, setTaskText] = useState("Rancang endpoint analytics dan lakukan code review.");
  const transcriptRef = useRef<HTMLDivElement>(null);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? agents[0];
  const meetingBusy = !!meeting && (meeting.phase === "gathering" || meeting.phase === "discussing");

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [meeting?.transcript.length, meeting?.phase]);

  return (
    <aside className="panel flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 lg:w-[404px] lg:shrink-0">
      <div className="border-b border-white/10 px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-white">
              <Radio size={14} className="text-emerald-300" />
              Orchestra Console
            </h2>
            <p className="mt-0.5 text-[10px] text-slate-400">Kendali AI employee & rapat real-time</p>
          </div>
          <button
            type="button"
            onClick={() => openModal()}
            className="flex items-center gap-1 rounded-lg border border-emerald-300/25 bg-emerald-400/10 px-2 py-1.5 text-[10px] font-semibold text-emerald-200 transition hover:bg-emerald-400/20"
          >
            <Plus size={11} /> Pegawai
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {agents.map((agent) => (
            <AgentChip
              key={agent.id}
              agent={agent}
              selected={agent.id === selectedAgentId}
              onClick={() => selectAgent(agent.id)}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-1 border-b border-white/10 px-2 pt-2">
        {(
          [
            { key: "meeting", label: "Meeting", icon: Users },
            { key: "task", label: "Tugas", icon: Sparkles },
            { key: "quick", label: "Aksi Cepat", icon: Zap },
          ] as const
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-t-lg px-2 py-2.5 text-[11px] font-semibold transition ${
              tab === item.key ? "text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <item.icon size={12} />
            {item.label}
            {tab === item.key && (
              <motion.span layoutId="sidebar-tab" className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-emerald-300" />
            )}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="p-4"
          >
            {tab === "meeting" && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Topik diskusi
                    <span className="text-[9px] font-medium normal-case tracking-normal text-slate-500">
                      {topic.length}/400
                    </span>
                  </label>
                  <textarea
                    value={topic}
                    onChange={(event) => setTopic(event.target.value.slice(0, 400))}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-[12px] leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-emerald-300/40 focus:ring-2 focus:ring-emerald-400/10"
                    placeholder="Contoh: Rancang arsitektur MVP dashboard analitik real-time…"
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Putaran diskusi
                    </span>
                    <span className="rounded-md bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold text-cyan-200">
                      {rounds} putaran
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={4}
                    step={1}
                    value={rounds}
                    onChange={(event) => setRounds(Number(event.target.value))}
                    className="w-full"
                  />
                  <div className="mt-1 flex justify-between text-[8px] font-semibold text-slate-500">
                    <span>Singkat</span>
                    <span>2</span>
                    <span>3</span>
                    <span>Mendalam</span>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Peserta ({picks.length})
                    </span>
                    <div className="flex gap-2 text-[9px] font-semibold">
                      <button
                        type="button"
                        className="text-cyan-300 hover:text-cyan-200"
                        onClick={() => setPick(agents.map((a) => a.id))}
                      >
                        Semua
                      </button>
                      <span className="text-slate-600">·</span>
                      <button
                        type="button"
                        className="text-slate-400 hover:text-slate-200"
                        onClick={() => setPick([])}
                      >
                        Kosongkan
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {agents.map((agent) => {
                      const active = picks.includes(agent.id);
                      return (
                        <button
                          key={agent.id}
                          type="button"
                          onClick={() => togglePick(agent.id)}
                          className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition ${
                            active
                              ? "border-emerald-300/35 bg-emerald-400/10"
                              : "border-white/10 bg-white/[0.02] hover:border-white/20"
                          }`}
                        >
                          <span
                            className={`flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border text-[8px] font-black ${
                              active ? "border-emerald-300 bg-emerald-400 text-slate-900" : "border-slate-600 text-transparent"
                            }`}
                          >
                            ✓
                          </span>
                          <span className="h-2 w-2 rounded-full" style={{ background: agent.shirtColor }} />
                          <span className="min-w-0">
                            <span className="block truncate text-[10px] font-semibold text-slate-100">
                              {agent.name.split(" ")[0]}
                            </span>
                            <span className="block truncate text-[8px] text-slate-500">{agent.role}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={meetingBusy || picks.length === 0}
                    onClick={() => {
                      if (!topic.trim()) {
                        notify("Topik meeting masih kosong.", "error");
                        return;
                      }
                      startMeeting(topic.trim(), picks, rounds);
                    }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-3 py-2.5 text-[11px] font-black text-slate-900 shadow-[0_10px_30px_-12px_rgba(94,234,212,0.9)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {meetingBusy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                    {meetingBusy ? "Rapat berjalan…" : "Panggil ke Ruang Meeting"}
                  </button>
                  {meetingBusy && (
                    <button
                      type="button"
                      onClick={stopMeeting}
                      className="flex items-center justify-center rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 text-rose-200 transition hover:bg-rose-500/20"
                      title="Hentikan rapat"
                    >
                      <Square size={13} />
                    </button>
                  )}
                </div>

                {meeting && (
                  <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-300">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            meeting.phase === "gathering"
                              ? "animate-pulse bg-amber-400"
                              : meeting.phase === "discussing"
                                ? "animate-pulse bg-emerald-400"
                                : "bg-slate-500"
                          }`}
                        />
                        {meeting.phase === "gathering"
                          ? "Menunggu peserta duduk"
                          : meeting.phase === "discussing"
                            ? `Diskusi · putaran ${meeting.currentRound}/${meeting.rounds}`
                            : "Rapat selesai"}
                      </span>
                      {meeting.simulated && (
                        <span className="rounded border border-amber-300/25 bg-amber-400/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-200">
                          demo ai
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[10.5px] leading-snug text-slate-400">
                      {meeting.topic}
                    </p>
                  </div>
                )}

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      <Radio size={10} className="text-rose-400" /> Live transcript
                    </span>
                    <span className="text-[9px] text-slate-500">{meeting?.transcript.length ?? 0} baris</span>
                  </div>
                  <div
                    ref={transcriptRef}
                    className="max-h-[300px] min-h-[120px] space-y-2.5 overflow-y-auto rounded-xl border border-white/10 bg-slate-950/60 p-3"
                  >
                    {!meeting && (
                      <div className="flex h-[100px] flex-col items-center justify-center gap-1 text-center">
                        <Users size={18} className="text-slate-600" />
                        <p className="text-[10px] text-slate-500">Transkrip percakapan AI akan muncul di sini.</p>
                      </div>
                    )}
                    {meeting?.transcript.map((msg) =>
                      msg.kind === "system" ? (
                        <div key={msg.id} className="flex items-center gap-2 py-0.5">
                          <span className="h-px flex-1 bg-white/10" />
                          <span className="text-center text-[8.5px] font-medium leading-tight text-slate-500">
                            {msg.content}
                          </span>
                          <span className="h-px flex-1 bg-white/10" />
                        </div>
                      ) : (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="rounded-lg border border-white/10 bg-white/[0.025] p-2.5"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ background: msg.color }} />
                            <span className="text-[10px] font-bold text-slate-100">{msg.agentName}</span>
                            <span className="rounded bg-white/5 px-1 py-[1px] text-[7.5px] font-semibold uppercase tracking-wide text-slate-400">
                              {msg.role}
                            </span>
                            <span className="ml-auto text-[8px] font-mono text-slate-500">R{msg.round}</span>
                            {msg.simulated && (
                              <span className="rounded bg-amber-400/10 px-1 text-[7px] font-bold uppercase text-amber-300">
                                sim
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{msg.content}</p>
                        </motion.div>
                      ),
                    )}
                  </div>
                </div>
              </div>
            )}

            {tab === "task" && (
              <div className="space-y-4">
                <div>
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Pilih pegawai
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {agents.map((agent) => (
                      <AgentChip
                        key={agent.id}
                        agent={agent}
                        selected={agent.id === selectedAgentId}
                        onClick={() => selectAgent(agent.id)}
                      />
                    ))}
                  </div>
                </div>

                {selectedAgent && (
                  <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[12px] font-bold text-white">{selectedAgent.name}</p>
                        <p className="text-[10px] text-slate-400">{selectedAgent.role}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${statusOf(selectedAgent).text} bg-white/5`}>
                        {statusOf(selectedAgent).label}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {selectedAgent.skills.map((skill) => (
                        <span key={skill} className="rounded bg-white/5 px-1.5 py-0.5 text-[8px] font-semibold text-slate-300">
                          {skill}
                        </span>
                      ))}
                    </div>
                    {selectedAgent.task && (
                      <p className="mt-2 line-clamp-2 rounded bg-emerald-400/5 px-2 py-1 text-[9px] text-emerald-200/80">
                        Tugas aktif: {selectedAgent.task}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Instruksi tugas
                  </label>
                  <textarea
                    value={taskText}
                    onChange={(event) => setTaskText(event.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-[12px] leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-sky-300/40 focus:ring-2 focus:ring-sky-400/10"
                    placeholder="Tulis instruksi untuk pegawai…"
                  />
                  <div className="mt-2 flex flex-wrap gap-1">
                    {TASK_SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setTaskText(suggestion)}
                        className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-left text-[8.5px] text-slate-400 transition hover:border-sky-300/30 hover:text-sky-200"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!selectedAgent || !taskText.trim()}
                  onClick={() => {
                    if (!selectedAgent) return;
                    assignTask(selectedAgent.id, taskText.trim());
                    notify(`${selectedAgent.name} berjalan ke meja dan mulai bekerja.`, "success");
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 to-indigo-400 px-3 py-2.5 text-[11px] font-black text-slate-950 shadow-[0_10px_30px_-12px_rgba(56,189,248,0.8)] transition hover:brightness-110 disabled:opacity-40"
                >
                  <Send size={13} /> Berikan Tugas & Duduk di Meja
                </button>

                <button
                  type="button"
                  onClick={() => selectedAgent && dispatchQuick(selectedAgent.id, "DESK")}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-semibold text-slate-300 transition hover:bg-white/[0.07]"
                >
                  <ArrowRight size={11} /> Kembalikan ke meja tanpa tugas
                </button>
              </div>
            )}

            {tab === "quick" && (
              <div className="space-y-4">
                <div>
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Pegawai target
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {agents.map((agent) => (
                      <AgentChip
                        key={agent.id}
                        agent={agent}
                        selected={agent.id === selectedAgentId}
                        onClick={() => selectAgent(agent.id)}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300">
                        <Activity size={15} />
                      </span>
                      <div>
                        <p className="text-[11px] font-bold text-slate-100">Mode Hidup Otomatis</p>
                        <p className="text-[9px] text-slate-500">Pegawai bergerak sendiri saat senggang</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={autoLife}
                      onClick={() => setAutoLife(!autoLife)}
                      className={`relative h-5 w-9 rounded-full transition ${autoLife ? "bg-emerald-400" : "bg-slate-700"}`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${autoLife ? "left-[18px]" : "left-0.5"}`}
                      />
                    </button>
                  </div>
                  <p className="mt-2 flex items-center gap-1 text-[8.5px] text-slate-500">
                    {autoLife ? (
                      <>
                        <Sun size={9} className="text-amber-300" /> Kantor hidup: TV, kopi, sholat, dan obrolan berjalan otomatis.
                      </>
                    ) : (
                      <>
                        <PauseCircle size={9} /> Otomatisasi dijeda. Kendalikan manual dari tombol di bawah.
                      </>
                    )}
                  </p>
                </div>

                <div>
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Kontrol aktivitas cepat
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {QUICK_ACTIONS.map((action) => (
                      <button
                        key={action.type}
                        type="button"
                        onClick={() => selectedAgent && dispatchQuick(selectedAgent.id, action.type)}
                        className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[10px] font-semibold transition ${TONE_CLASSES[action.tone]}`}
                      >
                        <action.icon size={13} />
                        {action.label}
                      </button>
                    ))}
                  </div>
                  {selectedAgent && (
                    <p className="mt-2 text-center text-[8.5px] text-slate-500">
                      Target: <span className="font-semibold text-slate-300">{selectedAgent.name}</span> ·{" "}
                      {statusOf(selectedAgent).label}
                    </p>
                  )}
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Aktivitas terbaru
                    </span>
                    <span className="text-[9px] text-slate-500">{events.length}</span>
                  </div>
                  <div className="max-h-[240px] space-y-1.5 overflow-y-auto rounded-xl border border-white/10 bg-slate-950/60 p-2.5">
                    {events.map((event) => (
                      <div key={event.id} className="flex items-start gap-2">
                        <span
                          className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                            event.kind === "error"
                              ? "bg-rose-400"
                              : event.kind === "success"
                                ? "bg-emerald-400"
                                : "bg-sky-400"
                          }`}
                        />
                        <p className="text-[9.5px] leading-snug text-slate-400">{event.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="border-t border-white/10 px-4 py-2.5">
        <div className="flex items-center justify-between text-[9px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Orkestrator aktif
          </span>
          <span className="font-mono">
            {agents.filter((a) => !a.hasError).length}/{agents.length} online
          </span>
        </div>
      </div>
    </aside>
  );
}
