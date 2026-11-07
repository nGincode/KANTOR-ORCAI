"use client";

import { create } from "zustand";
import {
  BED_SPOTS,
  CHAT_SPOTS,
  COOK_SPOTS,
  CORRIDOR_SOFA_SEATS,
  DEFAULT_AGENTS,
  DEFAULT_TOPIC,
  DESKS,
  DRINK_SPOTS,
  IDLE_SPOTS,
  MEETING_SEATS,
  PRAYER_MATS,
  SLEEP_SPOT,
  TOILET_SPOT,
  TV_SEATS,
} from "./office";
import { generateErrorLine } from "./demo-ai";
import type {
  Activity,
  AgentConfig,
  AgentRuntime,
  EventLogEntry,
  MeetingState,
  Pose,
  TranscriptMessage,
} from "./types";

const SPEED = 2.6; // world units (metres) per second
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const rand = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

let meetingRun: string | null = null;
let chatRun: string | null = null;
let chatParticipants: [string, string] | null = null;
let autoLifeStarted = false;

export function walkDuration(fromX: number, fromY: number, toX: number, toY: number) {
  const distance = Math.hypot(toX - fromX, toY - fromY);
  return clamp(distance / SPEED, 0.45, 7);
}

function runtimeFromConfig(config: AgentConfig, patch: Partial<AgentRuntime> = {}): AgentRuntime {
  const desk = DESKS[config.deskIndex % DESKS.length];
  return {
    ...config,
    activity: "IDLE",
    pose: "sitting",
    x: desk.seat.x,
    y: desk.seat.y,
    targetX: desk.seat.x,
    targetY: desk.seat.y,
    moveId: 0,
    moving: false,
    hasError: false,
    direction: "right",
    speech: null,
    speaking: false,
    statusNote: "Siap bekerja",
    task: null,
    meetingSeat: null,
    chatPartnerId: null,
    chatStarted: false,
    lastReply: null,
    pending: null,
    ...patch,
  };
}

const DEFAULT_RUNTIME: AgentRuntime[] = DEFAULT_AGENTS.map((agent, index) => {
  if (agent.id === "agent-andi") {
    return runtimeFromConfig(agent, {
      activity: "ERROR",
      pose: "sleeping",
      hasError: true,
      x: SLEEP_SPOT.x,
      y: SLEEP_SPOT.y,
      targetX: SLEEP_SPOT.x,
      targetY: SLEEP_SPOT.y,
      direction: "left",
      statusNote: "API Error",
    });
  }
  return runtimeFromConfig(agent, {
    statusNote: index === 0 ? "Tech Lead standby" : "Siap bekerja",
  });
});

function sysMessage(content: string): TranscriptMessage {
  return {
    id: uid(),
    round: 0,
    agentId: "orchestra",
    agentName: "Orkestrator",
    role: "System",
    color: "#5eead4",
    content,
    typing: false,
    simulated: false,
    kind: "system",
  };
}

interface StoreState {
  agents: AgentRuntime[];
  selectedAgentId: string;
  sidebarTab: "meeting" | "task" | "quick";
  meeting: MeetingState | null;
  events: EventLogEntry[];
  autoLife: boolean;
  modalOpen: boolean;
  editingAgentId: string | null;
  screenAgentId: string | null;
  toast: { id: string; text: string; kind: "info" | "success" | "error" } | null;
  meetingTopic: string;
  meetingRounds: number;
  meetingPick: string[];

  setSidebarTab: (tab: StoreState["sidebarTab"]) => void;
  selectAgent: (id: string) => void;
  setAutoLife: (on: boolean) => void;
  notify: (text: string, kind?: "info" | "success" | "error") => void;
  pushEvent: (message: string, kind?: EventLogEntry["kind"], agent?: AgentRuntime) => void;
  clearToast: () => void;

  setMeetingTopic: (topic: string) => void;
  setMeetingRounds: (rounds: number) => void;
  toggleMeetingPick: (id: string) => void;
  setMeetingPick: (ids: string[]) => void;

  openModal: (agentId?: string) => void;
  closeModal: () => void;
  focusScreen: (agentId: string | null) => void;

  saveAgent: (config: AgentConfig) => void;
  deleteAgent: (id: string) => void;
  markArrived: (id: string, moveId: number) => void;

  startMeeting: (topic: string, ids: string[], rounds: number) => void;
  stopMeeting: () => void;
  assignTask: (id: string, task: string) => void;
  sendToTV: (id: string) => void;
  sendToDrink: (id: string) => void;
  sendToPray: (id: string) => void;
  sendToCook: (id: string) => void;
  sendToToilet: (id: string) => void;
  sendToSleep: (id: string) => void;
  sendToSofa: (id: string) => void;
  sendToDesk: (id: string) => void;
  simulateError: (id: string, reason?: string) => void;
  recoverAgent: (id: string) => void;
  chatWith: (id: string, partnerId?: string) => void;
  wander: (id: string) => void;
  dispatchQuick: (id: string, type: string) => void;
  initAutoLife: () => void;
  testAgentConnection: (id: string) => Promise<{ ok: boolean; message: string }>;
  requestChat: (args: {
    agent: AgentRuntime;
    kind: "meeting" | "chat" | "task";
    history: { speaker: string; content: string }[];
    topic: string;
    round?: number;
    partnerName?: string;
    instruction?: string;
  }) => Promise<{ ok: boolean; content: string; simulated: boolean; error?: string }>;
}

export const useOffice = create<StoreState>((set, get) => {
  function patchAgent(id: string, patch: Partial<AgentRuntime>) {
    set((state) => ({
      agents: state.agents.map((agent) => (agent.id === id ? { ...agent, ...patch } : agent)),
    }));
  }

  function addTranscript(message: TranscriptMessage) {
    set((state) =>
      state.meeting
        ? { meeting: { ...state.meeting, transcript: [...state.meeting.transcript, message] } }
        : {},
    );
  }

  function pushEvent(
    message: string,
    kind: EventLogEntry["kind"] = "info",
    agent?: AgentRuntime,
  ) {
    set((state) => ({
      events: [
        {
          id: uid(),
          at: Date.now(),
          message,
          kind,
          agentName: agent?.name,
          color: agent?.shirtColor,
        },
        ...state.events,
      ].slice(0, 40),
    }));
  }

  function freeBed(id: string) {
    const taken = new Set(
      get()
        .agents.filter(
          (a) =>
            a.id !== id &&
            ((a.activity === "RESTING" && a.pose === "sleeping") ||
              (a.activity === "ERROR" && a.pose === "sleeping") ||
              (a.moving && a.pending?.pose === "sleeping")),
        )
        .map((a) =>
          a.moving
            ? `${Math.round(a.targetX * 10)},${Math.round(a.targetY * 10)}`
            : `${Math.round(a.x * 10)},${Math.round(a.y * 10)}`,
        ),
    );
    return (
      BED_SPOTS.find((bed) => !taken.has(`${Math.round(bed.x * 10)},${Math.round(bed.y * 10)}`)) ??
      BED_SPOTS[0]
    );
  }

  function goTo(
    id: string,
    target: { x: number; y: number },
    activity: Activity,
    pose: Pose,
    note: string | null,
    speech: string | null = null,
  ) {
    const agent = get().agents.find((a) => a.id === id);
    if (!agent) return;
    patchAgent(id, {
      x: target.x,
      y: target.y,
      targetX: target.x,
      targetY: target.y,
      moving: true,
      moveId: agent.moveId + 1,
      pose: "walking",
      activity: "WALKING",
      direction: target.x < agent.x ? "left" : "right",
      pending: { activity, pose, note },
      speech,
      speaking: !!speech,
      statusNote: "Berjalan...",
      chatStarted: false,
    });
  }

  function maybeStartChat() {
    if (!chatRun || !chatParticipants) return;
    const st = get();
    const [aId, bId] = chatParticipants;
    const a = st.agents.find((x) => x.id === aId);
    const b = st.agents.find((x) => x.id === bId);
    if (!a || !b) return;
    if (a.moving || b.moving || a.activity !== "CHATTING" || b.activity !== "CHATTING") return;
    if (a.chatStarted) return;
    const token = chatRun;
    patchAgent(a.id, { chatStarted: true });
    patchAgent(b.id, { chatStarted: true });
    void runChat(token, a.id, b.id);
  }

  async function runChat(token: string, aId: string, bId: string) {
    const history: { speaker: string; content: string }[] = [];
    const order: [string, string][] = [
      [aId, bId],
      [bId, aId],
      [aId, bId],
    ];
    for (const [speakerId, listenerId] of order) {
      if (chatRun !== token) return;
      const speaker = get().agents.find((a) => a.id === speakerId);
      const listener = get().agents.find((a) => a.id === listenerId);
      if (!speaker || !listener) return;
      if (speaker.activity !== "CHATTING" || speaker.moving) return;

      patchAgent(speakerId, { speaking: true, speech: "...", statusNote: "Mengobrol" });
      const res = await get().requestChat({
        agent: speaker,
        kind: "chat",
        history,
        topic: "obrolan santai di pantry",
        partnerName: listener.name,
      });
      if (chatRun !== token) return;
      const text = res.ok ? res.content : "Hehe, nanti kita lanjut ya.";
      patchAgent(speakerId, { speaking: true, speech: text, chatPartnerId: listenerId });
      if (res.ok) history.push({ speaker: speaker.name, content: text });
      await sleep(clamp(1500 + text.length * 28, 2600, 7000));
      if (chatRun !== token) return;
      patchAgent(speakerId, { speaking: false, speech: null, statusNote: "Mengobrol" });
      await sleep(400);
    }
    if (chatRun !== token) return;
    chatRun = null;
    chatParticipants = null;
    for (const id of [aId, bId]) {
      const agent = get().agents.find((a) => a.id === id);
      if (agent && agent.activity === "CHATTING") {
        patchAgent(id, {
          activity: "IDLE",
          pose: "standing",
          speech: null,
          speaking: false,
          statusNote: "Senggang",
          chatPartnerId: null,
        });
      }
    }
    pushEvent("Obrolan pantry selesai.", "info");
  }

  function maybeStartMeeting() {
    const state = get();
    const meeting = state.meeting;
    if (!meeting || meeting.phase !== "gathering") return;
    const allSeated = meeting.participantIds.every((id) => {
      const agent = state.agents.find((a) => a.id === id);
      return agent && agent.activity === "MEETING" && !agent.moving;
    });
    if (!allSeated) return;
    set({
      meeting: {
        ...meeting,
        phase: "discussing",
        transcript: [
          ...meeting.transcript,
          sysMessage("Semua peserta sudah duduk. Diskusi AI dimulai. 🎙️"),
        ],
      },
    });
    const runId = meeting.id;
    window.setTimeout(() => {
      if (meetingRun !== runId) return;
      void runDiscussion(runId);
    }, 700);
  }

  async function runDiscussion(meetingId: string) {
    const initial = get().meeting;
    if (!initial || initial.id !== meetingId) return;

    pushEvent(`Rapat dimulai: ${initial.topic}`, "info");

    for (let round = 1; round <= initial.rounds; round++) {
      if (meetingRun !== meetingId) return;
      set((state) =>
        state.meeting
          ? {
              meeting: {
                ...state.meeting,
                currentRound: round,
                transcript: [
                  ...state.meeting.transcript,
                  sysMessage(`Putaran ${round} dari ${initial.rounds}`),
                ],
              },
            }
          : {},
      );

      for (const participantId of initial.participantIds) {
        if (meetingRun !== meetingId) return;
        const agent = get().agents.find((a) => a.id === participantId);
        const meeting = get().meeting;
        if (!meeting) return;
        if (!agent || agent.hasError || agent.activity !== "MEETING" || agent.moving) continue;

        const history = meeting.transcript
          .filter((m) => m.kind === "meeting")
          .slice(-8)
          .map((m) => ({ speaker: m.agentName, content: m.content }));

        set((state) =>
          state.meeting ? { meeting: { ...state.meeting, speakingId: agent.id } } : {},
        );
        patchAgent(agent.id, { speaking: true, speech: "...", statusNote: "Berbicara di rapat" });

        const result = await get().requestChat({
          agent,
          kind: "meeting",
          history,
          topic: initial.topic,
          round,
        });

        if (meetingRun !== meetingId) return;
        const current = get().agents.find((a) => a.id === agent.id);
        if (!current || current.activity !== "MEETING") continue;

        if (!result.ok) {
          patchAgent(agent.id, { speaking: false, speech: null });
          addTranscript(
            sysMessage(`⚠️ ${agent.name} kehilangan koneksi API dan meninggalkan rapat.`),
          );
          get().simulateError(agent.id, result.error);
          continue;
        }

        addTranscript({
          id: uid(),
          round,
          agentId: agent.id,
          agentName: agent.name,
          role: agent.role,
          color: agent.shirtColor,
          content: result.content,
          typing: false,
          simulated: result.simulated,
          kind: "meeting",
        });
        patchAgent(agent.id, {
          speaking: true,
          speech: result.content,
          statusNote: "Berbicara di rapat",
          lastReply: result.content,
        });
        pushEvent(`${agent.name} berbicara di rapat.`, "info", agent);

        await sleep(clamp(1800 + result.content.length * 34, 3200, 9500));
        if (meetingRun !== meetingId) return;
        patchAgent(agent.id, { speaking: false, speech: null, statusNote: "Mendengarkan" });
        await sleep(350);
      }
    }

    if (meetingRun !== meetingId) return;
    set((state) =>
      state.meeting
        ? {
            meeting: {
              ...state.meeting,
              phase: "ended",
              speakingId: null,
              transcript: [
                ...state.meeting.transcript,
                sysMessage("Rapat selesai. Keputusan dicatat. ✅"),
              ],
            },
          }
        : {},
    );
    pushEvent("Rapat selesai.", "success");
    window.setTimeout(() => {
      if (meetingRun !== meetingId) return;
      meetingRun = null;
      const participants = get().meeting?.participantIds ?? [];
      participants.forEach((pid, index) => {
        const agent = get().agents.find((a) => a.id === pid);
        if (!agent || agent.activity !== "MEETING" || agent.hasError) return;
        if (index % 2 === 0) {
          get().sendToTV(pid);
        } else {
          const desk = DESKS[agent.deskIndex % DESKS.length];
          goTo(pid, desk.seat, "IDLE", "sitting", "Kembali ke meja");
        }
      });
    }, 3200);
  }

  async function requestChat(args: {
    agent: AgentRuntime;
    kind: "meeting" | "chat" | "task";
    history: { speaker: string; content: string }[];
    topic: string;
    round?: number;
    partnerName?: string;
    instruction?: string;
  }): Promise<{ ok: boolean; content: string; simulated: boolean; error?: string }> {
    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: {
            name: args.agent.name,
            role: args.agent.role,
            skills: args.agent.skills,
            agentMd: args.agent.agentMd,
            apiBaseUrl: args.agent.apiBaseUrl,
            apiKey: args.agent.apiKey,
            model: args.agent.model,
            demoMode: args.agent.demoMode,
          },
          kind: args.kind,
          history: args.history,
          topic: args.topic,
          round: args.round ?? 1,
          partnerName: args.partnerName,
          instruction: args.instruction,
        }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      if (!data?.ok) {
        return {
          ok: false,
          content: "",
          simulated: !!data?.simulated,
          error: data?.error ?? "API gagal.",
        };
      }
      return { ok: true, content: data.content as string, simulated: !!data.simulated };
    } catch (error) {
      return {
        ok: false,
        content: "",
        simulated: false,
        error: error instanceof Error ? error.message : "Tidak dapat menghubungi server.",
      };
    }
  }

  return {
    agents: DEFAULT_RUNTIME,
    selectedAgentId: DEFAULT_RUNTIME[0].id,
    sidebarTab: "meeting",
    meeting: null,
    events: [
      {
        id: "boot",
        at: Date.now(),
        message: "Orkestrator siap. 5 pegawai AI terdaftar, 1 sedang error di kasur.",
        kind: "success",
      },
    ],
    autoLife: true,
    modalOpen: false,
    editingAgentId: null,
    screenAgentId: null,
    toast: null,
    meetingTopic: DEFAULT_TOPIC,
    meetingRounds: 2,
    meetingPick: DEFAULT_RUNTIME.filter((a) => !a.hasError).map((a) => a.id),

    setSidebarTab: (tab) => set({ sidebarTab: tab }),
    selectAgent: (id) => set({ selectedAgentId: id }),
    setAutoLife: (on) => {
      set({ autoLife: on });
      pushEvent(
        on ? "Mode hidup aktif: pegawai mulai beraktivitas otomatis." : "Mode hidup dijeda.",
        "info",
      );
    },
    notify: (text, kind = "info") => {
      const id = uid();
      set({ toast: { id, text, kind } });
      window.setTimeout(() => {
        if (get().toast?.id === id) set({ toast: null });
      }, 4200);
    },
    clearToast: () => set({ toast: null }),
    pushEvent,
    requestChat,

    setMeetingTopic: (topic) => set({ meetingTopic: topic }),
    setMeetingRounds: (rounds) => set({ meetingRounds: clamp(rounds, 1, 4) }),
    toggleMeetingPick: (id) =>
      set((state) => ({
        meetingPick: state.meetingPick.includes(id)
          ? state.meetingPick.filter((x) => x !== id)
          : [...state.meetingPick, id],
      })),
    setMeetingPick: (ids) => set({ meetingPick: ids }),

    openModal: (agentId) => set({ modalOpen: true, editingAgentId: agentId ?? null }),
    closeModal: () => set({ modalOpen: false, editingAgentId: null }),
    focusScreen: (agentId) => set({ screenAgentId: agentId }),

    saveAgent: (config) => {
      const existing = get().agents.find((a) => a.id === config.id);
      if (existing) {
        set((state) => ({
          agents: state.agents.map((a) =>
            a.id === config.id
              ? { ...a, ...config, hasError: false, statusNote: "Konfigurasi diperbarui" }
              : a,
          ),
        }));
        pushEvent(`Konfigurasi ${config.name} diperbarui.`, "success");
        get().notify(`Pegawai ${config.name} berhasil diperbarui.`, "success");
      } else {
        if (get().agents.length >= DESKS.length) {
          get().notify(`Meja kerja penuh (maksimal ${DESKS.length} pegawai).`, "error");
          return;
        }
        const usedDesks = new Set(get().agents.map((a) => a.deskIndex));
        const freeDesk = DESKS.find((d) => !usedDesks.has(d.id)) ?? DESKS[0];
        const runtime = runtimeFromConfig({ ...config, deskIndex: freeDesk.id });
        set((state) => ({
          agents: [...state.agents, runtime],
          meetingPick: [...state.meetingPick, runtime.id],
          selectedAgentId: runtime.id,
        }));
        pushEvent(`${config.name} bergabung sebagai ${config.role}.`, "success", runtime);
        get().notify(`Selamat datang, ${config.name}!`, "success");
      }
    },

    deleteAgent: (id) => {
      const agent = get().agents.find((a) => a.id === id);
      if (!agent) return;
      if (agent.activity === "MEETING" && get().meeting) get().stopMeeting();
      set((state) => ({
        agents: state.agents.filter((a) => a.id !== id),
        meetingPick: state.meetingPick.filter((x) => x !== id),
        selectedAgentId:
          state.selectedAgentId === id
            ? state.agents.find((a) => a.id !== id)?.id ?? ""
            : state.selectedAgentId,
        editingAgentId: null,
      }));
      chatRun = null;
      pushEvent(`${agent.name} dihapus dari kantor.`, "error");
      get().notify(`${agent.name} telah dihapus.`, "info");
    },

    markArrived: (id, moveId) => {
      const agent = get().agents.find((a) => a.id === id);
      if (!agent || !agent.moving || agent.moveId !== moveId) return;
      const pending = agent.pending;
      const activity = pending?.activity ?? ("IDLE" as Activity);
      const pose = pending?.pose ?? ("standing" as Pose);
      patchAgent(id, {
        moving: false,
        activity,
        pose,
        statusNote: pending?.note ?? "Senggang",
        pending: null,
      });
      if (activity === "MEETING") window.setTimeout(() => maybeStartMeeting(), 120);
      if (activity === "CHATTING") window.setTimeout(() => maybeStartChat(), 120);
    },

    startMeeting: (topic, ids, rounds) => {
      if (!ids.length) {
        get().notify("Pilih minimal satu pegawai untuk rapat.", "error");
        return;
      }
      const runId = uid();
      meetingRun = runId;
      chatRun = null;
      chatParticipants = null;

      get().agents.forEach((agent) => {
        if (agent.activity === "MEETING" && !ids.includes(agent.id)) {
          goTo(agent.id, rand(IDLE_SPOTS), "IDLE", "standing", "Keluar dari ruang meeting");
        }
      });

      const participants = ids
        .map((id) => get().agents.find((a) => a.id === id))
        .filter(Boolean) as AgentRuntime[];
      if (participants.length === 0) return;

      set({
        meeting: {
          id: runId,
          topic,
          rounds,
          participantIds: ids,
          phase: "gathering",
          currentRound: 0,
          speakingId: null,
          simulated: participants.some((p) => p.demoMode || !p.apiKey),
          transcript: [sysMessage(`Undangan rapat: "${topic}" — ${ids.length} peserta.`)],
        },
        meetingTopic: topic,
        meetingRounds: rounds,
        meetingPick: ids,
        sidebarTab: "meeting",
      });

      ids.forEach((id, index) => {
        const seat = MEETING_SEATS[index % MEETING_SEATS.length];
        patchAgent(id, {
          speech: null,
          speaking: false,
          task: null,
          meetingSeat: index,
          hasError: false,
        });
        goTo(id, seat, "MEETING", "sitting", `Menuju kursi rapat #${index + 1}`);
      });
      pushEvent(`Lonceng rapat berbunyi. ${ids.length} pegawai menuju ruang meeting. 🔔`, "info");
      get().notify("Rapat dipanggil — menunggu semua peserta duduk.", "info");
    },

    stopMeeting: () => {
      const meeting = get().meeting;
      meetingRun = null;
      if (!meeting) return;
      set({
        meeting: {
          ...meeting,
          phase: "ended",
          speakingId: null,
          transcript: [...meeting.transcript, sysMessage("Rapat dihentikan oleh operator.")],
        },
      });
      meeting.participantIds.forEach((pid, index) => {
        const agent = get().agents.find((a) => a.id === pid);
        if (!agent) return;
        if (agent.activity === "MEETING" || agent.activity === "WALKING") {
          if (index % 2 === 0) {
            get().sendToTV(pid);
          } else {
            const desk = DESKS[agent.deskIndex % DESKS.length];
            goTo(pid, desk.seat, "IDLE", "sitting", "Kembali ke meja");
          }
        }
      });
      pushEvent("Rapat dihentikan.", "error");
    },

    assignTask: (id, task) => {
      const agent = get().agents.find((a) => a.id === id);
      if (!agent) return;
      const desk = DESKS[agent.deskIndex % DESKS.length];
      patchAgent(id, { task, hasError: false });
      goTo(id, desk.seat, "WORKING", "working", task, `Siap. Saya mulai: ${task.slice(0, 70)}`);
      pushEvent(`${agent.name} mulai bekerja: ${task.slice(0, 60)}`, "info", agent);
      window.setTimeout(() => {
        const current = get().agents.find((a) => a.id === id);
        if (current && current.activity === "WORKING") {
          patchAgent(id, { speech: null, speaking: false, statusNote: "Mengerjakan tugas" });
        }
      }, 5200);
    },

    sendToDesk: (id) => {
      const agent = get().agents.find((a) => a.id === id);
      if (!agent) return;
      const desk = DESKS[agent.deskIndex % DESKS.length];
      goTo(id, desk.seat, "IDLE", "sitting", "Kembali ke meja");
      patchAgent(id, { task: null });
    },

    sendToTV: (id) => {
      const agents = get().agents;
      const taken = new Set(
        agents
          .filter(
            (a) =>
              a.activity === "WATCHING_TV" ||
              (a.moving && a.pending?.activity === "WATCHING_TV"),
          )
          .map((a) => `${a.moving ? a.targetX : a.x},${a.moving ? a.targetY : a.y}`),
      );
      const seat = TV_SEATS.find((s) => !taken.has(`${s.x},${s.y}`));
      if (!seat) {
        get().sendToSofa(id);
        return;
      }
      goTo(id, seat, "WATCHING_TV", "sitting", "Menonton TV", "Wah, acara ini menarik. 📺");
      pushEvent(`${agents.find((a) => a.id === id)?.name} ke lounge menonton TV.`, "info");
      window.setTimeout(() => {
        const a = get().agents.find((x) => x.id === id);
        if (a && a.activity === "WATCHING_TV") patchAgent(id, { speech: null, speaking: false });
      }, 4200);
    },

    sendToDrink: (id) => {
      const taken = new Set(
        get()
          .agents.filter(
            (a) =>
              a.activity === "DRINKING" ||
              (a.moving && a.pending?.activity === "DRINKING"),
          )
          .map((a) => `${a.moving ? a.targetX : a.x},${a.moving ? a.targetY : a.y}`),
      );
      const spot = DRINK_SPOTS.find((s) => !taken.has(`${s.x},${s.y}`));
      if (!spot) {
        get().wander(id);
        return;
      }
      goTo(
        id,
        { x: spot.x, y: spot.y },
        "DRINKING",
        "drinking",
        `Minum di ${spot.label}`,
        "☕ Waktunya ngopi sebentar...",
      );
      pushEvent(`${get().agents.find((a) => a.id === id)?.name} ke pantry untuk minum.`, "info");
      window.setTimeout(() => {
        const a = get().agents.find((x) => x.id === id);
        if (
          a &&
          a.activity === "DRINKING" &&
          !a.moving &&
          !get().meeting?.participantIds.includes(id)
        ) {
          get().sendToTV(id);
        }
      }, 9500);
    },

    sendToCook: (id) => {
      const agent = get().agents.find((a) => a.id === id);
      if (!agent) return;
      const taken = new Set(
        get()
          .agents.filter(
            (a) =>
              a.id !== id &&
              (a.activity === "COOKING" ||
                (a.moving && a.pending?.activity === "COOKING")),
          )
          .map((a) =>
            a.moving
              ? `${Math.round(a.targetX * 10)},${Math.round(a.targetY * 10)}`
              : `${Math.round(a.x * 10)},${Math.round(a.y * 10)}`,
          ),
      );
      const spot = COOK_SPOTS.find(
        (s) => !taken.has(`${Math.round(s.x * 10)},${Math.round(s.y * 10)}`),
      );
      if (!spot) {
        get().wander(id);
        return;
      }
      goTo(id, spot, "COOKING", "standing", "Masak mie di pantry", "Masak mie dulu, ya 🍜");
      pushEvent(`${agent.name} memasak mie di pantry.`, "info", agent);
      window.setTimeout(() => {
        const a = get().agents.find((x) => x.id === id);
        if (
          a &&
          a.activity === "COOKING" &&
          !a.moving &&
          !get().meeting?.participantIds.includes(id)
        ) {
          get().sendToDesk(id);
        }
      }, 15000);
    },

    sendToToilet: (id) => {
      const agent = get().agents.find((a) => a.id === id);
      if (!agent) return;
      const busy = get().agents.some(
        (a) =>
          a.id !== id &&
          (a.activity === "TOILET" || (a.moving && a.pending?.activity === "TOILET")),
      );
      if (busy) {
        get().notify("Toilet sedang dipakai. Cari aktivitas lain dulu.", "info");
        return;
      }
      goTo(id, TOILET_SPOT, "TOILET", "standing", "Ke toilet 🚻");
      pushEvent(`${agent.name} menuju toilet.`, "info", agent);
      window.setTimeout(() => {
        const a = get().agents.find((x) => x.id === id);
        if (
          a &&
          a.activity === "TOILET" &&
          !a.moving &&
          !get().meeting?.participantIds.includes(id)
        ) {
          get().sendToDesk(id);
        }
      }, 9000);
    },

    sendToSleep: (id) => {
      const agent = get().agents.find((a) => a.id === id);
      if (!agent) return;
      const bed = freeBed(id);
      goTo(id, bed, "RESTING", "sleeping", "Tidur di kasur", null);
      pushEvent(`${agent.name} istirahat dan tidur di kasur.`, "info", agent);
      window.setTimeout(() => {
        const a = get().agents.find((x) => x.id === id);
        if (a && a.activity === "RESTING" && !a.moving && !a.hasError) {
          get().sendToDesk(id);
        }
      }, 45000);
    },

    sendToSofa: (id) => {
      const agent = get().agents.find((a) => a.id === id);
      if (!agent) return;
      const taken = new Set(
        get()
          .agents.filter(
            (a) =>
              (a.activity === "RESTING" && a.pose === "sitting") ||
              (a.moving && a.pending?.activity === "RESTING" && a.pending.pose === "sitting"),
          )
          .map((a) =>
            a.moving
              ? `${a.targetX.toFixed(1)},${a.targetY.toFixed(1)}`
              : `${a.x.toFixed(1)},${a.y.toFixed(1)}`,
          ),
      );
      const seat = CORRIDOR_SOFA_SEATS.find(
        (s) => !taken.has(`${s.x.toFixed(1)},${s.y.toFixed(1)}`),
      );
      if (!seat) {
        get().wander(id);
        return;
      }
      goTo(id, seat, "RESTING", "sitting", "Duduk santai di sofa koridor");
      pushEvent(`${agent.name} duduk di sofa koridor.`, "info", agent);
      window.setTimeout(() => {
        const a = get().agents.find((x) => x.id === id);
        if (a && a.activity === "RESTING" && a.pose === "sitting" && !a.moving) {
          get().sendToDesk(id);
        }
      }, 28000);
    },

    sendToPray: (id) => {
      const taken = new Set(
        get()
          .agents.filter(
            (a) =>
              a.activity === "PRAYING" ||
              (a.moving && a.pending?.activity === "PRAYING"),
          )
          .map((a) => `${a.moving ? a.targetX : a.x},${a.moving ? a.targetY : a.y}`),
      );
      const mat = PRAYER_MATS.find((m) => !taken.has(`${m.seat.x},${m.seat.y}`));
      if (!mat) {
        get().wander(id);
        return;
      }
      goTo(id, mat.seat, "PRAYING", "praying", "Sedang sholat 🕌", "Saya sholat dulu, ya. 🕌");
      pushEvent(`${get().agents.find((a) => a.id === id)?.name} ke Musholla untuk sholat.`, "info");
      window.setTimeout(() => {
        const a = get().agents.find((x) => x.id === id);
        if (
          a &&
          a.activity === "PRAYING" &&
          !a.moving &&
          !get().meeting?.participantIds.includes(id)
        ) {
          get().sendToDesk(id);
        }
      }, 12000);
    },

    simulateError: (id, reason) => {
      const agent = get().agents.find((a) => a.id === id);
      if (!agent) return;
      const line = generateErrorLine({
        name: agent.name,
        role: agent.role,
        skills: agent.skills,
        agentMd: agent.agentMd,
      });
      chatRun = null;
      patchAgent(id, {
        hasError: true,
        activity: "ERROR",
        pose: agent.moving ? "walking" : "sitting",
        moving: false,
        pending: null,
        speech: line,
        speaking: true,
        statusNote: reason ? `API Error: ${reason.slice(0, 60)}` : "API Error",
      });
      if (get().meeting) {
        addTranscript(sysMessage(`⚠️ ${agent.name}: "${line}" — meninggalkan rapat.`));
      }
      pushEvent(`${agent.name} mengalami API error. Menuju kasur istirahat.`, "error", agent);
      get().notify(`⚠️ API ${agent.name} gagal. Karakter berjalan ke kasur di Sick Bay.`, "error");
      window.setTimeout(() => {
        const still = get().agents.find((a) => a.id === id);
        if (!still || !still.hasError) return;
        const bed = freeBed(id);
        goTo(id, bed, "ERROR", "sleeping", "API Error — tidur di kasur");
        window.setTimeout(() => {
          const now = get().agents.find((a) => a.id === id);
          if (now && now.activity === "ERROR" && !now.moving) {
            patchAgent(id, { speech: null, speaking: false });
          }
        }, 1600);
      }, 2800);
    },

    recoverAgent: (id) => {
      const agent = get().agents.find((a) => a.id === id);
      if (!agent) return;
      const desk = DESKS[agent.deskIndex % DESKS.length];
      patchAgent(id, {
        hasError: false,
        speech: "Koneksi sudah pulih. Saya siap bekerja lagi!",
        speaking: true,
        statusNote: "Pulih",
      });
      goTo(
        id,
        desk.seat,
        "IDLE",
        "sitting",
        "Kembali ke meja",
        "Koneksi sudah pulih. Saya siap bekerja lagi!",
      );
      window.setTimeout(() => {
        const a = get().agents.find((x) => x.id === id);
        if (a && a.activity === "IDLE") patchAgent(id, { speech: null, speaking: false });
      }, 4200);
      pushEvent(`${agent.name} kembali online.`, "success", agent);
    },

    chatWith: (id, partnerId) => {
      const agents = get().agents;
      const agent = agents.find((a) => a.id === id);
      if (!agent) return;
      if (chatRun) {
        get().notify("Masih ada obrolan berlangsung. Tunggu sebentar.", "info");
        return;
      }
      let partner = partnerId ? agents.find((a) => a.id === partnerId) : undefined;
      if (!partner) {
        const candidates = agents.filter(
          (a) =>
            a.id !== id &&
            !a.hasError &&
            !a.moving &&
            ["IDLE", "WATCHING_TV", "RESTING"].includes(a.activity),
        );
        partner = candidates.length ? rand(candidates) : agents.find((a) => a.id !== id && !a.hasError);
      }
      if (!partner || partner.id === id) {
        get().notify("Tidak ada rekan yang tersedia untuk diajak ngobrol.", "error");
        return;
      }
      const token = uid();
      chatRun = token;
      chatParticipants = [id, partner.id];
      patchAgent(id, { chatPartnerId: partner.id, chatStarted: false, lastReply: null });
      patchAgent(partner.id, { chatPartnerId: id, chatStarted: false, lastReply: null });
      goTo(id, CHAT_SPOTS[0], "CHATTING", "standing", "Ngobrol di pantry");
      goTo(partner.id, CHAT_SPOTS[1], "CHATTING", "standing", "Ngobrol di pantry");
      patchAgent(id, { direction: "right" });
      patchAgent(partner.id, { direction: "left" });
      pushEvent(`${agent.name} mengajak ${partner.name} ngobrol di pantry.`, "info", agent);
      get().notify("Obrolan santai dimulai di pantry.", "info");
    },

    wander: (id) => {
      const taken = new Set(
        get()
          .agents.filter(
            (a) =>
              a.id !== id &&
              (a.activity === "IDLE" || (a.moving && a.pending?.activity === "IDLE")),
          )
          .map((a) =>
            a.moving
              ? `${Math.round(a.targetX * 10)},${Math.round(a.targetY * 10)}`
              : `${Math.round(a.x * 10)},${Math.round(a.y * 10)}`,
          ),
      );
      const available = IDLE_SPOTS.filter(
        (spot) => !taken.has(`${Math.round(spot.x * 10)},${Math.round(spot.y * 10)}`),
      );
      goTo(id, rand(available.length ? available : IDLE_SPOTS), "IDLE", "standing", "Jalan-jalan sebentar");
    },

    dispatchQuick: (id, type) => {
      switch (type) {
        case "WORK":
          get().assignTask(id, "Review backlog sprint, rapikan kode, dan siapkan PR.");
          break;
        case "MEETING":
          get().startMeeting(
            DEFAULT_TOPIC,
            get().agents.filter((a) => !a.hasError).map((a) => a.id),
            2,
          );
          break;
        case "TV":
          get().sendToTV(id);
          break;
        case "DRINK":
          get().sendToDrink(id);
          break;
        case "PRAY":
          get().sendToPray(id);
          break;
        case "COOK":
          get().sendToCook(id);
          break;
        case "TOILET":
          get().sendToToilet(id);
          break;
        case "SLEEP":
          get().sendToSleep(id);
          break;
        case "SOFA":
          get().sendToSofa(id);
          break;
        case "ERROR":
          get().simulateError(id, "Simulasi operator: API key tidak valid");
          break;
        case "RECOVER":
          get().recoverAgent(id);
          break;
        case "CHAT":
          get().chatWith(id);
          break;
        case "DESK":
          get().sendToDesk(id);
          break;
        default:
          break;
      }
    },

    initAutoLife: () => {
      if (autoLifeStarted) return;
      autoLifeStarted = true;
      window.setInterval(() => {
        const state = get();
        if (!state.autoLife) return;
        if (state.meeting && state.meeting.phase !== "ended") return;
        const idle = state.agents.filter(
          (a) => !a.hasError && !a.moving && a.activity === "IDLE" && !a.task,
        );
        if (!idle.length) return;
        const agent = rand(idle);
        const roll = Math.random();
        const hour = new Date().getHours();
        const night = hour < 6 || hour >= 18;
        const bedBusy =
          state.agents.filter(
            (a) => a.activity === "RESTING" && a.pose === "sleeping" && !a.moving,
          ).length >= BED_SPOTS.length;
        const toiletBusy = state.agents.some(
          (a) =>
            a.id !== agent.id &&
            (a.activity === "TOILET" || (a.moving && a.pending?.activity === "TOILET")),
        );
        if (night && !bedBusy && roll < 0.3) get().sendToSleep(agent.id);
        else if (night && roll < 0.4) get().sendToSofa(agent.id);
        else if (roll < 0.22) get().sendToTV(agent.id);
        else if (roll < 0.34) get().sendToDrink(agent.id);
        else if (roll < 0.42) get().sendToCook(agent.id);
        else if (roll < 0.52) get().sendToPray(agent.id);
        else if (roll < 0.58) {
          if (toiletBusy) get().wander(agent.id);
          else get().sendToToilet(agent.id);
        } else if (roll < 0.66) get().sendToSofa(agent.id);
        else if (roll < 0.86 && !chatRun) get().chatWith(agent.id);
        else get().wander(agent.id);
      }, 15000);
    },

    testAgentConnection: async (id) => {
      const agent = get().agents.find((a) => a.id === id);
      if (!agent) return { ok: false, message: "Agen tidak ditemukan." };
      try {
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            test: true,
            agent: {
              name: agent.name,
              role: agent.role,
              skills: agent.skills,
              agentMd: agent.agentMd,
              apiBaseUrl: agent.apiBaseUrl,
              apiKey: agent.apiKey,
              model: agent.model,
              demoMode: agent.demoMode,
            },
          }),
          signal: AbortSignal.timeout(32000),
        });
        const data = await res.json();
        if (data.ok) {
          patchAgent(id, {
            hasError: false,
            statusNote: data.simulated ? "Demo siap" : "API terhubung",
          });
          pushEvent(`${agent.name}: ${data.message ?? "Koneksi berhasil."}`, "success", agent);
          return { ok: true, message: data.message ?? "Koneksi berhasil." };
        }
        get().simulateError(id, data.error ?? "Test connection gagal");
        return { ok: false, message: data.error ?? "Koneksi gagal." };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Koneksi gagal.";
        get().simulateError(id, message);
        return { ok: false, message };
      }
    },
  };
});
