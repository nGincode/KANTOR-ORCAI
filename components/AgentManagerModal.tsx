"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Bot,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Link2,
  Loader2,
  Plug,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  User,
  Wand2,
  X,
} from "lucide-react";
import { useOffice } from "@/lib/store";
import {
  DESKS,
  HAIR_STYLES,
  ROLE_PRESETS,
  SHIRT_COLORS,
  SKIN_TONES,
} from "@/lib/office";
import type { AgentConfig, AgentRuntime, HairStyle } from "@/lib/types";

const SKILL_POOL = [
  "Node.js",
  "Next.js",
  "TypeScript",
  "React",
  "PostgreSQL",
  "Redis",
  "Docker",
  "System Design",
  "Security",
  "Playwright",
  "CI/CD",
  "Tailwind CSS",
  "Kubernetes",
  "GraphQL",
  "Python",
  "Prompt Engineering",
];

function blankAgent(id: string, deskIndex: number): AgentConfig {
  return {
    id,
    name: "",
    role: "Backend Developer",
    shirtColor: SHIRT_COLORS[0],
    hairStyle: "short",
    skinTone: SKIN_TONES[0],
    skills: ["Node.js", "PostgreSQL"],
    agentMd: "",
    apiBaseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini",
    demoMode: true,
    deskIndex,
  };
}

function traitsFor(role: string) {
  const r = role.toLowerCase();
  if (/(lead|architect|manager|principal)/.test(r))
    return {
      persona: "tenang, strategic, dan mengubah diskusi liar menjadi rencana eksekusi",
      voice: "Membuka diskusi dengan tujuan, menengahi perbedaan, lalu menyimpulkan keputusan.",
      sop: "Pecah pekerjaan menjadi milestone kecil dengan deliverable jelas.",
      boundary: "Tidak menulis implementasi detail; delegasikan sesuai spesialisasi.",
    };
  if (/(qa|test|quality)/.test(r))
    return {
      persona: "skeptis sehat, teliti, dan senang menemukan edge case",
      voice: "Mengajukan skenario gagal, kriteria penerimaan, dan bukti pengujian.",
      sop: "Susun test matrix sebelum rilis dan prioritaskan regression alur kritis.",
      boundary: "Tidak menandai rilis lolos tanpa bukti pengujian terdokumentasi.",
    };
  if (/(database|data|dba)/.test(r))
    return {
      persona: "analitis, hati-hati, dan peduli integritas data",
      voice: "Membahas normalisasi, index, migrasi, dan strategi rollback dengan angka.",
      sop: "Setiap perubahan skema lewat migrasi reversible dan review query plan.",
      boundary: "Tidak menjalankan migrasi destruktif tanpa persetujuan.",
    };
  if (/(frontend|ui|react|web)/.test(r))
    return {
      persona: "kreatif, detail pada animasi, dan vokal soal pengalaman pengguna",
      voice: "Memakai analogi UI, membahas state management dan aksesibilitas.",
      sop: "Validasi di dua breakpoint, ukur Core Web Vitals, jaga design system.",
      boundary: "Tidak menambah library baru tanpa persetujuan Tech Lead.",
    };
  if (/(devops|infra|sre|platform)/.test(r))
    return {
      persona: "sistematis, waspada pada risiko operasional, dan hemat biaya",
      voice: "Membahas pipeline, observability, canary, dan rollback otomatis.",
      sop: "Infrastruktur reproducible, health check, dan alert yang actionable.",
      boundary: "Tidak menyentuh akses produksi tanpa persetujuan.",
    };
  return {
    persona: "praktis, kolaboratif, dan fokus pada solusi yang bisa dieksekusi",
    voice: "Memberi pendapat teknis spesifik dengan contoh konkret.",
    sop: "Definisikan kriteria selesai sebelum implementasi dan dokumentasikan hasil.",
    boundary: "Tidak mengambil keputusan produk sendirian.",
  };
}

function generateMd(agent: AgentConfig) {
  const t = traitsFor(agent.role);
  const name = agent.name.trim() || "Pegawai AI";
  const skills = agent.skills.length ? agent.skills : ["Problem Solving"];
  return `# agent.md — ${name}

## Peran
${agent.role} di AI Office Orchestra. ${t.persona.charAt(0).toUpperCase() + t.persona.slice(1)}.

## Kepribadian
- ${t.persona.charAt(0).toUpperCase() + t.persona.slice(1)}.
- Kolaboratif, terbuka pada kritik, dan fokus pada solusi.

## Gaya Bicara Saat Rapat
- ${t.voice}
- Selalu rujuk keahlian: ${skills.join(", ")}.
- Jawab 2–4 kalimat, ringkas dan konkret.

## SOP Kerja
- ${t.sop}
- Catat keputusan dan tindak lanjut di transkrip rapat.

## Batasan Peran
- ${t.boundary}
- Tidak mengubah keputusan arsitektur tanpa koordinasi Tech Lead.

## AI Skills
${skills.map((s) => `- ${s}`).join("\n")}`;
}

function AvatarPreview({ agent }: { agent: AgentConfig }) {
  return (
    <div className="flex h-[76px] w-[76px] items-center justify-center rounded-2xl border border-white/10 bg-slate-950/60">
      <svg viewBox="0 0 100 110" width="62" height="68">
        <ellipse cx={50} cy={103} rx={22} ry={4} fill="rgba(148,163,184,0.18)" />
        <rect x={27} y={62} width={46} height={40} rx={14} fill={agent.shirtColor} />
        <path d="M42 62 L50 74 L58 62" stroke="#0f172a" strokeOpacity={0.22} strokeWidth={5} fill="none" strokeLinecap="round" />
        <rect x={45} y={54} width={10} height={11} rx={4} fill={agent.skinTone} />
        <circle cx={50} cy={40} r={20} fill={agent.skinTone} />
        {agent.hairStyle === "long" && <rect x={26} y={24} width={48} height={52} rx={22} fill="#2b2118" />}
        {agent.hairStyle === "bun" && <circle cx={50} cy={15} r={8} fill="#2b2118" />}
        <circle cx={50} cy={40} r={20} fill={agent.skinTone} />
        {agent.hairStyle === "curly" ? (
          <g fill="#2b2118">
            <circle cx={34} cy={28} r={8} />
            <circle cx={45} cy={21} r={9} />
            <circle cx={57} cy={21} r={9} />
            <circle cx={66} cy={29} r={8} />
          </g>
        ) : (
          <path
            d="M30 37 Q30 16 50 16 Q70 16 70 37 Q61 27 50 27 Q39 27 30 37Z"
            fill={agent.hairStyle === "cap" ? agent.shirtColor : "#2b2118"}
          />
        )}
        <ellipse cx={42} cy={41} rx={2.4} ry={2.9} fill="#1f2937" />
        <ellipse cx={58} cy={41} rx={2.4} ry={2.9} fill="#1f2937" />
        <path d="M45 50 Q50 53 55 50" stroke="#7f1d1d" strokeWidth={2} fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function MarkdownPreview({ md }: { md: string }) {
  const lines = md.split("\n");
  return (
    <div className="space-y-1 text-[11px] leading-relaxed text-slate-300">
      {lines.map((line, index) => {
        if (line.startsWith("# "))
          return (
            <h3 key={index} className="text-[14px] font-black text-white">
              {line.slice(2)}
            </h3>
          );
        if (line.startsWith("## "))
          return (
            <h4 key={index} className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
              {line.slice(3)}
            </h4>
          );
        if (/^[-*] /.test(line))
          return (
            <div key={index} className="flex gap-1.5 pl-1">
              <span className="text-emerald-400">•</span>
              <span>{line.slice(2)}</span>
            </div>
          );
        if (!line.trim()) return <div key={index} className="h-1" />;
        return <p key={index}>{line}</p>;
      })}
    </div>
  );
}

export function AgentManagerModal() {
  const modalOpen = useOffice((s) => s.modalOpen);
  const editingAgentId = useOffice((s) => s.editingAgentId);
  const closeModal = useOffice((s) => s.closeModal);
  const agents = useOffice((s) => s.agents);
  const saveAgent = useOffice((s) => s.saveAgent);
  const deleteAgent = useOffice((s) => s.deleteAgent);
  const notify = useOffice((s) => s.notify);
  const testAgentConnection = useOffice((s) => s.testAgentConnection);

  const [activeId, setActiveId] = useState("");
  const [form, setForm] = useState<AgentConfig | null>(null);
  const [skillInput, setSkillInput] = useState("");
  const [mdTab, setMdTab] = useState<"edit" | "preview">("edit");
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [modelNote, setModelNote] = useState<{ text: string; error: boolean } | null>(null);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [testState, setTestState] = useState<{ loading: boolean; message: string; error: boolean } | null>(null);

  const isNew = !agents.some((a) => a.id === activeId);
  const freeDesk = DESKS.find((d) => !agents.some((a) => a.deskIndex === d.id))?.id ?? 0;

  useEffect(() => {
    if (!modalOpen) {
      setForm(null);
      setActiveId("");
      return;
    }
    const existing = agents.find((a) => a.id === editingAgentId);
    if (existing) {
      setForm({ ...existing, skills: [...existing.skills] });
      setActiveId(existing.id);
    } else {
      const id = `agent-${Date.now().toString(36)}`;
      setForm(blankAgent(id, freeDesk));
      setActiveId(id);
    }
    setSkillInput("");
    setMdTab("edit");
    setModels([]);
    setModelNote(null);
    setTestState(null);
    setShowKey(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, editingAgentId]);

  const setField = <K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const openAgent = (agent: AgentRuntime) => {
    setForm({ ...agent, skills: [...agent.skills] });
    setActiveId(agent.id);
    setSkillInput("");
    setModels([]);
    setModelNote(null);
    setTestState(null);
    setMdTab("edit");
  };

  const startNew = () => {
    if (agents.length >= DESKS.length) {
      notify(`Semua ${DESKS.length} meja sudah terisi. Hapus satu pegawai dulu.`, "error");
      return;
    }
    const id = `agent-${Date.now().toString(36)}`;
    setForm(blankAgent(id, freeDesk));
    setActiveId(id);
    setSkillInput("");
    setModels([]);
    setModelNote(null);
    setTestState(null);
    setMdTab("edit");
  };

  const addSkill = (raw: string) => {
    if (!form) return;
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...form.skills];
    parts.forEach((part) => {
      if (!next.some((s) => s.toLowerCase() === part.toLowerCase())) next.push(part);
    });
    setField("skills", next.slice(0, 14));
    setSkillInput("");
  };

  const fetchModels = async () => {
    if (!form) return;
    setFetchingModels(true);
    setModelNote(null);
    try {
      const res = await fetch("/api/agent/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: form.apiBaseUrl,
          apiKey: form.apiKey,
          demoMode: form.demoMode,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setModels(data.models ?? []);
        setModelNote({
          text: data.simulated
            ? "Mode demo: daftar model contoh. Masukkan API key untuk model asli."
            : `${data.models.length} model ditemukan dari endpoint.`,
          error: false,
        });
        if (!form.model && data.models?.[0]) setField("model", data.models[0]);
      } else {
        setModelNote({ text: data.error ?? "Gagal mengambil model.", error: true });
      }
    } catch {
      setModelNote({ text: "Tidak dapat menghubungi server proxy.", error: true });
    } finally {
      setFetchingModels(false);
    }
  };

  const testConnection = async () => {
    if (!form) return;
    setTestState({ loading: true, message: "Menguji POST /chat/completions…", error: false });
    if (!isNew) {
      const result = await testAgentConnection(form.id);
      setTestState({
        loading: false,
        message: result.ok
          ? "Koneksi berhasil. Pegawai siap bekerja."
          : `Gagal: ${result.message}. Karakter menuju sofa error.`,
        error: !result.ok,
      });
      return;
    }
    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          test: true,
          agent: {
            name: form.name || "Pegawai AI",
            role: form.role,
            skills: form.skills,
            agentMd: form.agentMd,
            apiBaseUrl: form.apiBaseUrl,
            apiKey: form.apiKey,
            model: form.model,
            demoMode: form.demoMode,
          },
        }),
      });
      const data = await res.json();
      setTestState({
        loading: false,
        message: data.ok
          ? data.message ?? "Koneksi berhasil."
          : data.error ?? "Koneksi gagal.",
        error: !data.ok,
      });
    } catch {
      setTestState({ loading: false, message: "Tidak dapat menghubungi server proxy.", error: true });
    }
  };

  const save = () => {
    if (!form) return;
    if (!form.name.trim()) {
      notify("Nama pegawai wajib diisi.", "error");
      return;
    }
    if (!form.role.trim()) {
      notify("Jabatan pegawai wajib diisi.", "error");
      return;
    }
    if (isNew && agents.length >= DESKS.length) {
      notify("Meja kerja penuh. Hapus pegawai lain terlebih dahulu.", "error");
      return;
    }
    const config: AgentConfig = {
      ...form,
      name: form.name.trim(),
      role: form.role.trim(),
      apiBaseUrl: form.apiBaseUrl.trim(),
      apiKey: form.apiKey.trim(),
      model: form.model.trim(),
      agentMd: form.agentMd.trim() || generateMd(form),
      skills: form.skills.length ? form.skills : ["Problem Solving"],
    };
    saveAgent(config);
    closeModal();
  };

  const remove = () => {
    if (!form || isNew) return;
    if (window.confirm(`Hapus ${form.name} dari kantor? Konfigurasi dan agent.md-nya akan hilang.`)) {
      deleteAgent(form.id);
      closeModal();
    }
  };

  return (
    <AnimatePresence>
      {modalOpen && form && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-5"
          onClick={closeModal}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            onClick={(event) => event.stopPropagation()}
            className="flex h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-white/15 bg-[#0a1020] shadow-[0_50px_120px_-40px_rgba(0,0,0,1)]"
          >
            {/* team list */}
            <div className="hidden w-[218px] shrink-0 flex-col border-r border-white/10 bg-slate-950/40 md:flex">
              <div className="border-b border-white/10 px-3 py-3">
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  <Bot size={11} /> Tim AI ({agents.length})
                </p>
              </div>
              <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => openAgent(agent)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-2 py-2 text-left transition ${
                      activeId === agent.id
                        ? "border-emerald-300/35 bg-emerald-400/10"
                        : "border-transparent hover:bg-white/[0.04]"
                    }`}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-black text-white"
                      style={{ background: agent.shirtColor }}
                    >
                      {agent.name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-semibold text-slate-100">{agent.name}</span>
                      <span className={`block truncate text-[8.5px] ${agent.hasError ? "text-rose-300" : "text-slate-500"}`}>
                        {agent.hasError ? "API Error" : agent.role}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="border-t border-white/10 p-2">
                <button
                  type="button"
                  onClick={startNew}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/15 px-2 py-2 text-[10px] font-semibold text-slate-300 transition hover:border-emerald-300/40 hover:text-emerald-200"
                >
                  <Plus size={11} /> Pegawai Baru
                </button>
                <p className="mt-2 text-center text-[8px] text-slate-600">{DESKS.length} meja tersedia</p>
              </div>
            </div>

            {/* form */}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between border-b border-white/10 px-5 py-3.5">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-bold text-white">
                    <Sparkles size={14} className="text-emerald-300" />
                    {isNew ? "Tambah Pegawai AI" : "Kelola Pegawai AI"}
                  </h2>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    Identitas, AI skills, dokumen agent.md, dan koneksi API OpenAI-compatible.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-white/10 p-1.5 text-slate-400 transition hover:border-white/25 hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
                {/* identity */}
                <section>
                  <SectionTitle icon={<User size={12} />} title="1. Identitas Pegawai" />
                  <div className="mt-2.5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                    <Field label="Nama Orang">
                      <input
                        value={form.name}
                        onChange={(event) => setField("name", event.target.value)}
                        placeholder="Budi Santoso"
                        className="field"
                      />
                    </Field>
                    <Field label="Jabatan / Role">
                      <input
                        value={form.role}
                        onChange={(event) => setField("role", event.target.value)}
                        list="role-presets"
                        placeholder="Backend Developer"
                        className="field"
                      />
                      <datalist id="role-presets">
                        {ROLE_PRESETS.map((role) => (
                          <option key={role} value={role} />
                        ))}
                      </datalist>
                    </Field>
                    <AvatarPreview agent={form} />
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <Field label="Warna Baju">
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {SHIRT_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setField("shirtColor", color)}
                            className={`h-6 w-6 rounded-full border-2 transition ${
                              form.shirtColor === color
                                ? "scale-110 border-white shadow-[0_0_0_2px_rgba(255,255,255,0.25)]"
                                : "border-transparent hover:scale-105"
                            }`}
                            style={{ background: color }}
                            aria-label={`Warna ${color}`}
                          />
                        ))}
                      </div>
                    </Field>
                    <Field label="Warna Kulit">
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {SKIN_TONES.map((tone) => (
                          <button
                            key={tone}
                            type="button"
                            onClick={() => setField("skinTone", tone)}
                            className={`h-6 w-6 rounded-full border-2 transition ${
                              form.skinTone === tone
                                ? "scale-110 border-white"
                                : "border-transparent hover:scale-105"
                            }`}
                            style={{ background: tone }}
                            aria-label={`Kulit ${tone}`}
                          />
                        ))}
                      </div>
                    </Field>
                    <Field label="Gaya Rambut">
                      <div className="relative">
                        <select
                          value={form.hairStyle}
                          onChange={(event) => setField("hairStyle", event.target.value as HairStyle)}
                          className="field appearance-none pr-8"
                        >
                          {HAIR_STYLES.map((style) => (
                            <option key={style.value} value={style.value}>
                              {style.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      </div>
                    </Field>
                  </div>
                </section>

                <div className="grid gap-5 lg:grid-cols-2">
                  {/* skills */}
                  <section>
                    <SectionTitle icon={<Wand2 size={12} />} title="2. AI Skills" />
                    <div className="mt-2.5 rounded-xl border border-white/10 bg-slate-950/40 p-3">
                      <div className="flex flex-wrap gap-1.5">
                        {form.skills.map((skill) => (
                          <span
                            key={skill}
                            className="flex items-center gap-1 rounded-md border border-cyan-300/20 bg-cyan-400/10 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-100"
                          >
                            {skill}
                            <button
                              type="button"
                              onClick={() => setField("skills", form.skills.filter((s) => s !== skill))}
                              className="text-cyan-300/70 hover:text-white"
                            >
                              <X size={8} />
                            </button>
                          </span>
                        ))}
                        {!form.skills.length && (
                          <span className="text-[9px] text-slate-500">Belum ada skill. Tambahkan di bawah.</span>
                        )}
                      </div>
                      <div className="mt-2 flex gap-1.5">
                        <input
                          value={skillInput}
                          onChange={(event) => setSkillInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === ",") {
                              event.preventDefault();
                              addSkill(skillInput);
                            }
                          }}
                          placeholder="Tambah skill lalu Enter…"
                          className="field h-8 flex-1 text-[11px]"
                        />
                        <button
                          type="button"
                          onClick={() => addSkill(skillInput)}
                          className="rounded-lg border border-white/10 bg-white/[0.05] px-2 text-slate-300 transition hover:bg-white/10"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {SKILL_POOL.filter((s) => !form.skills.includes(s))
                          .slice(0, 9)
                          .map((skill) => (
                            <button
                              key={skill}
                              type="button"
                              onClick={() => addSkill(skill)}
                              className="rounded border border-white/10 px-1.5 py-0.5 text-[8px] text-slate-400 transition hover:border-cyan-300/30 hover:text-cyan-200"
                            >
                              + {skill}
                            </button>
                          ))}
                      </div>
                    </div>
                  </section>

                  {/* API */}
                  <section>
                    <SectionTitle icon={<Plug size={12} />} title="3. Koneksi API (OpenAI-compatible)" />
                    <div className="mt-2.5 space-y-2.5 rounded-xl border border-white/10 bg-slate-950/40 p-3">
                      <Field label="API Base URL">
                        <div className="relative">
                          <Link2 size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input
                            value={form.apiBaseUrl}
                            onChange={(event) => setField("apiBaseUrl", event.target.value)}
                            placeholder="https://api.openai.com/v1"
                            className="field pl-7 font-mono text-[10.5px]"
                          />
                        </div>
                      </Field>
                      <Field label="API Key (Bearer)">
                        <div className="relative">
                          <KeyRound size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input
                            type={showKey ? "text" : "password"}
                            value={form.apiKey}
                            onChange={(event) => setField("apiKey", event.target.value)}
                            placeholder="sk-…"
                            className="field px-7 font-mono text-[10.5px]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                          >
                            {showKey ? <EyeOff size={11} /> : <Eye size={11} />}
                          </button>
                        </div>
                      </Field>
                      <label className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-2 py-1.5">
                        <span className="text-[9.5px] font-semibold text-slate-300">
                          Mode Demo / Simulated API
                          <span className="block text-[8px] font-normal text-slate-500">
                            Tanpa API key tetap hidup dengan respons AI simulasi.
                          </span>
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={form.demoMode}
                          onClick={() => setField("demoMode", !form.demoMode)}
                          className={`relative h-4.5 w-8 shrink-0 rounded-full transition ${
                            form.demoMode ? "bg-emerald-400" : "bg-slate-700"
                          }`}
                          style={{ height: 18, width: 32 }}
                        >
                          <span
                            className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all ${
                              form.demoMode ? "left-[16px]" : "left-[2px]"
                            }`}
                          />
                        </button>
                      </label>

                      <Field label="Model">
                        <div className="flex gap-1.5">
                          <input
                            value={form.model}
                            onChange={(event) => setField("model", event.target.value)}
                            placeholder="gpt-4o-mini"
                            className="field flex-1 font-mono text-[10.5px]"
                          />
                          <button
                            type="button"
                            onClick={fetchModels}
                            disabled={fetchingModels}
                            className="flex items-center gap-1 rounded-lg border border-cyan-300/25 bg-cyan-400/10 px-2 text-[9px] font-semibold text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-50"
                          >
                            {fetchingModels ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                            Fetch Models
                          </button>
                        </div>
                        {models.length > 0 && (
                          <div className="relative mt-1.5">
                            <select
                              value={models.includes(form.model) ? form.model : ""}
                              onChange={(event) => event.target.value && setField("model", event.target.value)}
                              className="field appearance-none pr-8 text-[10.5px]"
                            >
                              <option value="">— Pilih dari {models.length} model —</option>
                              {models.map((model) => (
                                <option key={model} value={model}>
                                  {model}
                                </option>
                              ))}
                            </select>
                            <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          </div>
                        )}
                        {modelNote && (
                          <p className={`mt-1 text-[8.5px] ${modelNote.error ? "text-rose-300" : "text-slate-500"}`}>
                            {modelNote.text}
                          </p>
                        )}
                      </Field>

                      <button
                        type="button"
                        onClick={testConnection}
                        disabled={testState?.loading}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-[9.5px] font-bold text-slate-200 transition hover:border-emerald-300/30 hover:bg-emerald-400/10 disabled:opacity-50"
                      >
                        {testState?.loading ? <Loader2 size={11} className="animate-spin" /> : <Plug size={11} />}
                        Test Connection
                      </button>
                      {testState && !testState.loading && (
                        <p
                          className={`flex items-start gap-1 rounded-md px-2 py-1.5 text-[9px] leading-snug ${
                            testState.error
                              ? "bg-rose-500/10 text-rose-200"
                              : "bg-emerald-500/10 text-emerald-200"
                          }`}
                        >
                          {testState.error ? <AlertCircle size={10} className="mt-0.5 shrink-0" /> : <Check size={10} className="mt-0.5 shrink-0" />}
                          {testState.message}
                        </p>
                      )}
                      <p className="text-[8px] leading-relaxed text-slate-600">
                        Proxy Next.js memanggil <span className="font-mono">GET /models</span> dan{" "}
                        <span className="font-mono">POST /chat/completions</span> agar bebas CORS. Key tidak disimpan di server.
                      </p>
                    </div>
                  </section>
                </div>

                {/* agent.md */}
                <section>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <SectionTitle icon={<FileText size={12} />} title="4. Dokumen agent.md" />
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (!form) return;
                          setField("agentMd", generateMd(form));
                          setMdTab("edit");
                          notify("agent.md berhasil di-generate dari jabatan & skills.", "success");
                        }}
                        className="flex items-center gap-1 rounded-lg border border-violet-300/25 bg-violet-400/10 px-2 py-1 text-[9px] font-semibold text-violet-200 transition hover:bg-violet-400/20"
                      >
                        <Sparkles size={10} /> Auto-Generate agent.md
                      </button>
                      <div className="flex rounded-lg border border-white/10 p-0.5">
                        {(["edit", "preview"] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setMdTab(mode)}
                            className={`rounded-md px-2 py-1 text-[9px] font-semibold capitalize transition ${
                              mdTab === mode ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
                            }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="mt-1 text-[9px] text-slate-500">
                    Isi dokumen ini digabung dengan AI Skills sebagai <span className="font-mono">system prompt</span> saat memanggil API.
                  </p>
                  <div className="mt-2 min-h-[190px] rounded-xl border border-white/10 bg-slate-950/60">
                    {mdTab === "edit" ? (
                      <textarea
                        value={form.agentMd}
                        onChange={(event) => setField("agentMd", event.target.value)}
                        placeholder={"# agent.md — Nama\n\n## Peran\nBackend Developer…"}
                        className="h-[220px] w-full resize-y bg-transparent px-3 py-2.5 font-mono text-[10.5px] leading-relaxed text-slate-200 placeholder:text-slate-600 focus:outline-none"
                      />
                    ) : (
                      <div className="h-[220px] overflow-y-auto px-3 py-2.5">
                        {form.agentMd.trim() ? (
                          <MarkdownPreview md={form.agentMd} />
                        ) : (
                          <p className="text-[10px] text-slate-500">
                            Belum ada isi. Klik Auto-Generate atau tulis manual.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-white/10 bg-slate-950/40 px-5 py-3">
                <div className="flex items-center gap-2">
                  {!isNew && (
                    <button
                      type="button"
                      onClick={remove}
                      className="flex items-center gap-1 rounded-lg border border-rose-400/25 bg-rose-500/10 px-2.5 py-2 text-[9.5px] font-semibold text-rose-200 transition hover:bg-rose-500/20"
                    >
                      <Trash2 size={11} /> Hapus
                    </button>
                  )}
                  <span className="hidden text-[8.5px] text-slate-600 sm:block">
                    {isNew ? "Pegawai baru akan menempati meja kosong." : `Meja #${form.deskIndex + 1}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-semibold text-slate-300 transition hover:bg-white/[0.06]"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-2 text-[10px] font-black text-slate-950 shadow-[0_10px_30px_-12px_rgba(94,234,212,0.9)] transition hover:brightness-110"
                  >
                    <Save size={12} /> Simpan Pegawai
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/[0.06] text-emerald-300">
        {icon}
      </span>
      <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">{title}</h3>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
