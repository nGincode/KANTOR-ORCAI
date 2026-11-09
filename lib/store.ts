"use client";

import { create } from "zustand";
import {
  BED_SPOTS,
  CAR_ENTRY,
  CHAT_LOCATIONS,
  CHAT_SPOTS,
  COOK_SPOTS,
  CORRIDOR_SOFA_SEATS,
  DEFAULT_AGENTS,
  DEFAULT_PROJECT,
  DEFAULT_TOPIC,
  DESKS,
  DRINK_SPOTS,
  ELEVATOR_CAB,
  ELEVATOR_SPOT,
  FLOOR2,
  FLOOR2_SPOTS,
  FLOOR3,
  FLOOR3_SPOTS,
  FLOOR3_TABLE_SEATS,
  PINGPONG_SEATS,
  IDLE_SPOTS,
  LOBBY_EXIT,
  MEETING_SEATS,
  PANTRY_SEATS,
  PRAYER_MATS,
  TOILET_SPOT,
  TV_SEATS,
} from "./office";
import { generateErrorLine } from "./demo-ai";
import { startConversation, logMessage, endConversation } from "./conversations";
import { useMemory, memoryStore } from "./agent-memory";
import { useRoster, withAiDefaults, aiDefaultsOf, configOf as configOfRoster } from "./roster";
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

export const TV_SPEECH_LINES = [
  "Nonton dulu ah, penat banget koding seharian...",
  "Hari ini acaranya kurang seru kyknya.",
  "Wah, serial ini episode barunya rilis!",
  "Break sebentar, berita teknologi menarik nih.",
  "Acara komedi lumayan bikin rileks.",
  "Nanti habis segmen ini lanjut review PR lagi.",
];

let meetingRun: string | null = null;
let chatRun: string | null = null;
/** batas giliran satu obrolan pantry, supaya dua AI tidak ngobrol tanpa henti */
const CHAT_MAX_TURNS = 8;
let chatParticipants: [string, string] | null = null;
let autoLifeStarted = false;
/** pending "return to floor 1" timers, keyed by agent id */
const returnTimers = new Map<string, number>();
/** kapan terakhir seorang pegawai memanggil model untuk memilih aktivitas */
const lastActAt = new Map<string, number>();
/** jangan tanya model lagi ke pegawai yang sama sebelum jeda ini (hemat token) */
const ACT_COOLDOWN_MS = 45_000;

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
  officeProject: string;
  setOfficeProject: (project: string) => void;
  meetingTopic: string;
  meetingLeaderId: string;
  setMeetingLeaderId: (id: string) => void;
  meetingRounds: number;
  meetingPick: string[];
  focusedFloor: 1 | 2 | 3 | "all";
  /** signed-in owner, null while browsing as guest */
  account: {
    id: string;
    email: string;
    name?: string;
    offlineAi: boolean;
    storageMode: "hosted" | "own";
    /** the owner's model key, fetched once per session (never logged) */
    modelKey?: string;
    modelName?: string;
    /** provider base URL that belongs to the key */
    apiBaseUrl?: string;
    /** false until the onboarding wizard finished (storage + model key) */
    setupComplete?: boolean;
  } | null;
  setAccount: (account: StoreState["account"]) => void;
  /** adopts a roster stored in the account document (another device) */
  adoptRoster: (configs: AgentConfig[], offline?: boolean) => void;
  /** sign-out: drop the account roster and return to the guest demo, in place */
  resetAccount: () => void;
  /** the account's saved AI connection, inherited by every new employee */
  aiDefaults: { apiKey: string; model: string; apiBaseUrl: string } | null;
  storagePickerOpen: boolean;
  setStoragePickerOpen: (open: boolean) => void;
  /** true while the Google redirect / profile fetch is in flight */
  authBusy: boolean;
  setAuthBusy: (busy: boolean) => void;
  modelKeyOpen: boolean;
  setModelKeyOpen: (open: boolean) => void;
  /** forces the day/night look of the scene: auto follows the clock */
  timeOfDay: "auto" | "day" | "sunset" | "morning" | "night";
  setTimeOfDay: (mode: StoreState["timeOfDay"]) => void;
  /** how "auto activity" picks a task for an agent */
  activityMode: "random" | "ai";
  autoAct: (id: string) => void;
  setActivityMode: (mode: "random" | "ai") => void;

  setSidebarTab: (tab: StoreState["sidebarTab"]) => void;
  selectAgent: (id: string) => void;
  setFocusedFloor: (floor: 1 | 2 | 3 | "all") => void;
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

  startMeeting: (topic: string, ids: string[], leaderId?: string) => void;
  stopMeeting: () => void;
  assignTask: (id: string, task: string) => void;
  sendToTV: (id: string, speech?: string) => void;
  sendToDrink: (id: string) => void;
  sendToPray: (id: string) => void;
  sendToCook: (id: string) => void;
  sendToToilet: (id: string) => void;
  sendToSleep: (id: string) => void;
  sendToSofa: (id: string) => void;
  sendToPantry: (id: string) => void;
  sendToDrive: (id: string) => void;
  endDrive: (id: string) => void;
  sendToDesk: (id: string) => void;
  sendToFloor: (id: string, floor: 1 | 2 | 3) => void;
  sendToRelax: (id: string) => void;
  sendToPingpong: (id: string) => void;
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
    leaderName?: string;
    /** semua pegawai di kantor supaya AI tahu siapa yang bisa diajak */
    colleagues?: { name: string; role: string }[];
  }) => Promise<{
    ok: boolean;
    content: string;
    simulated: boolean;
    error?: string;
    /** HTTP status dari proxy, undefined kalau jaringan mati */
    status?: number;
    /** chat: model memilih diam / mengajak rekan lain / menutup obrolan */
    action?: "reply" | "invite" | "pass" | "leave";
    invite?: string;
  }>;
}

/** true while the account's roster table is unreachable — keep edits local */
let rosterOffline = false;

/** prompt mode AI: model wajib jawab kode + kalimat dalam satu baris */
function activityPrompt(hasTask: boolean) {
  // urutan diacak tiap panggilan: model cenderung memilih item pertama
  // Kalau tidak ada task yang diberikan atasan, kecualikan WORK agar pegawai menikmati fasilitas kantor
  // Perbanyak kemungkinan CHAT agar pegawai sering berinteraksi satu sama lain
  const rawCodes = hasTask
    ? ["WORK", "CHAT", "CHAT", "TV", "DRINK", "COOK", "SOFA", "PINGPONG", "RELAX"]
    : ["CHAT", "CHAT", "CHAT", "TV", "DRINK", "COOK", "PRAY", "TOILET", "SOFA", "SLEEP", "DRIVE", "PINGPONG", "RELAX", "WANDER"];
  const codes = rawCodes.sort(() => Math.random() - 0.5).join(", ");
  return (
    `Kamu manusia sungguhan di kantor santai. Pilih aktivitas dari daftar: ${codes}. ` +
    "Jawab TEPAT satu baris dengan format KODE|kalimat santai (maksimal 10 kata, Bahasa Indonesia kasual). " +
    "Jangan kaku membahas kerja terus-menerus, lebih banyak nikmati suasana kantor dan istirahat/ngobrol."
  );
}

/** tugas kerja cadangan saat AI tidak mengirim kalimat */
function pickTaskLine(agent: { skills: string[]; role: string }) {
  const skill = agent.skills[0] ?? agent.role;
  const list = [
    `Rapikan modul ${skill}`,
    `Review PR bagian ${skill}`,
    `Tulis test untuk ${skill}`,
    `Beresin bug di ${skill}`,
    `Dokumentasikan ${skill}`,
  ];
  return list[Math.floor(Math.random() * list.length)];
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
      ].slice(0, 18),
    }));
    // long-term copy for the agents themselves (browser only, budgeted)
    useMemory.getState().rememberEvent({ kind, text: message, agent: agent?.name });
  }

  /**
   * Mirrors the agent runtime into the selected storage backend (hosted or the
   * owner's own Supabase, see MemoryBridge). Only the fields the offline worker
   * and another device would need are copied — no animation state.
   */
  function snapshotAgents() {
    const { agents } = get();
    const { settings } = memoryStore().getState();
    memoryStore().setState({
      settings: {
        ...settings,
        agents: agents.map((a) => ({
          id: a.id,
          name: a.name,
          role: a.role,
          activity: a.activity,
          statusNote: a.statusNote,
          floor: a.floor ?? 1,
          hasError: a.hasError,
          // the model key never leaves the browser on the agent object; the
          // account-level key (Vault / own project) is what the worker uses
          demoMode: a.demoMode,
          model: a.model,
          x: Math.round(a.x * 100) / 100,
          y: Math.round(a.y * 100) / 100,
          // persona so another device restores the same roster
          shirtColor: a.shirtColor,
          hairStyle: a.hairStyle,
          skinTone: a.skinTone,
          skills: a.skills,
          agentMd: a.agentMd,
          apiBaseUrl: a.apiBaseUrl,
          deskIndex: a.deskIndex,
        })),
      },
    });
  }

  /** writes the current roster so a refresh cannot resurrect the demo employees */
  function persistRoster() {
    useRoster.getState().save(get().agents);
  }

  /**
   * Adopsi roster lokal TANPA menyentuh localStorage. Dipakai saat server
   * mengembalikan 0 baris padahal browser masih punya pegawai — jangan sampai
   * server yang belum siap menghapus pekerjaan user.
   */
  function adoptRosterFromCache(configs: AgentConfig[]) {
    const account = get().account;
    const key = account?.modelKey?.trim() ?? "";
    const baseUrl = account?.apiBaseUrl?.trim() || get().aiDefaults?.apiBaseUrl || "";
    set((state) => ({
      agents: configs.map((config) => {
        const existing = state.agents.find((a) => a.id === config.id);
        return runtimeFromConfig(
          {
            ...config,
            demoMode: false,
            apiKey: key || config.apiKey,
            model: account?.modelName || config.model,
            apiBaseUrl: baseUrl || config.apiBaseUrl,
          },
          existing
            ? {
                x: existing.x,
                y: existing.y,
                targetX: existing.targetX,
                targetY: existing.targetY,
                activity: existing.activity,
                pose: existing.pose,
                statusNote: existing.statusNote,
                floor: existing.floor,
                moving: existing.moving,
                moveId: existing.moveId,
              }
            : {},
        );
      }),
      meetingPick: configs.map((c) => c.id),
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
    // remember where the agent is headed so its profile reflects real habits
    if (note) useMemory.getState().rememberActivity(id, note.slice(0, 40));
  }

  /** Lifts an agent to another floor: step into the cab, ride up/down, then walk out. */
  function rideElevator(id: string, targetFloor: 1 | 2 | 3) {
    const agent = get().agents.find((a) => a.id === id);
    if (!agent) return;
    // step inside the cab and wait for it to travel
    patchAgent(id, {
      activity: "ELEVATOR",
      pose: "standing",
      moving: false,
      pending: null,
      speech: null,
      speaking: false,
      statusNote: `Di dalam lift menuju Lantai ${targetFloor} 🛗`,
      floor: agent.floor ?? 1,
      x: ELEVATOR_CAB.x,
      y: ELEVATOR_CAB.y,
      targetX: ELEVATOR_CAB.x,
      targetY: ELEVATOR_CAB.y,
      cabin: { from: agent.floor ?? 1, to: targetFloor },
    } as Partial<AgentRuntime>);
    // travel time matches the cab animation (see Elevator component)
    const travel = Math.abs(((agent.floor ?? 1) - targetFloor)) * 1500 + 600;
    window.setTimeout(() => {
      const now = get().agents.find((x) => x.id === id);
      if (!now || now.activity !== "ELEVATOR") return;
      patchAgent(id, { floor: targetFloor, cabin: null } as Partial<AgentRuntime>);
      if (targetFloor === 1) {
        const desk = DESKS[agent.deskIndex % DESKS.length];
        goTo(id, { x: ELEVATOR_SPOT.x + 1.2, y: ELEVATOR_SPOT.y }, "IDLE", "standing", "Keluar lift");
        window.setTimeout(() => goTo(id, desk.seat, "IDLE", "sitting", "Kembali ke meja", null), 1800);
      } else {
        const spot = rand(targetFloor === 2 ? FLOOR2_SPOTS : FLOOR3_SPOTS);
        goTo(id, { x: ELEVATOR_SPOT.x + 1.2, y: ELEVATOR_SPOT.y }, "IDLE", "standing", "Keluar lift");
        window.setTimeout(() => goTo(id, spot, "WORKING", "sitting", `Bekerja di Lantai ${targetFloor}`, null), 1800);
      }
    }, travel);
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

  /**
   * Percakapan nyata: dua pegawai duduk, lalu bergiliran bicara sampai salah
   * satu memutuskan berhenti (atau batas giliran tercapai). Model yang memilih
   * diam / mengajak orang lain / menutup obrolan — bukan timer tetap.
   */
  async function runChat(token: string, aId: string, bId: string) {
    const history: { speaker: string; content: string }[] = [];
    const chatTopics = [
      "obrolan santai di pantry",
      "ngobrolin film atau series terbaru",
      "cerita lucu hari ini",
      "rencana akhir pekan",
      "makan siang apa hari ini",
      "hobi baru yang lagi seru",
      "game yang lagi main",
      "cuaca dan rencana liburan",
      "gosip kantor yang ringan",
      "makanan favorit masing-masing",
    ];
    const topic = chatTopics[Math.floor(Math.random() * chatTopics.length)];
    const colleagues = () =>
      get()
        .agents.filter((a) => !a.hasError)
        .map((a) => ({ name: a.name, role: a.role }));
    const conversationId = await startConversation({
      kind: "chat",
      topic,
      participantIds: [aId, bId],
    });
    const finish = (reason: string) => {
      endConversation(conversationId, reason);
      closeChat(aId, bId);
      pushEvent(`Obrolan santai selesai (${reason}).`, "info");
    };

    let speakerId = aId;
    let listenerId = bId;
    for (let turn = 0; turn < CHAT_MAX_TURNS; turn++) {
      if (chatRun !== token) {
        endConversation(conversationId, "dibatalkan");
        return;
      }
      const speaker = get().agents.find((a) => a.id === speakerId);
      const listener = get().agents.find((a) => a.id === listenerId);
      if (!speaker || !listener) return finish("pegawai pergi");
      if (speaker.activity !== "CHATTING" || speaker.moving) return finish("pegawai berpindah");

      patchAgent(speakerId, { speaking: true, speech: "...", statusNote: "Mengobrol" });
      const res = await get().requestChat({
        agent: speaker,
        kind: "chat",
        history,
        topic,
        // giliran pertama = tawaran untuk memulai; sisanya balasan
        partnerName: turn === 0 ? undefined : listener.name,
        colleagues: colleagues(),
      });
      if (chatRun !== token) {
        endConversation(conversationId, "dibatalkan");
        return;
      }

      if (res.action === "pass") {
        patchAgent(speakerId, { speaking: false, speech: null, statusNote: "Mengobrol" });
        return finish(`${speaker.name} memilih diam`);
      }
      if (res.action === "invite" && res.invite) {
        patchAgent(speakerId, { speaking: false, speech: null, statusNote: "Mengobrol" });
        const target = get().agents.find(
          (a) => a.name.toLowerCase() === res.invite!.toLowerCase() && a.id !== speakerId && !a.hasError,
        );
        if (!target) return finish(`${speaker.name} tidak menemukan rekan yang dimaksud`);
        // rekan yang diajak pindah ke pantry; percakapan lanjut di sana
        goTo(target.id, CHAT_SPOTS[1], "CHATTING", "standing", "Diajak ngobrol di pantry");
        goTo(speakerId, CHAT_SPOTS[0], "CHATTING", "standing", "Ngobrol di pantry");
        patchAgent(speakerId, { chatPartnerId: target.id, chatStarted: true });
        patchAgent(target.id, { chatPartnerId: speakerId, chatStarted: true, lastReply: null });
        chatParticipants = [speakerId, target.id];
        pushEvent(`${speaker.name} mengajak ${target.name} ngobrol.`, "info", speaker);
        history.length = 0;
        listenerId = target.id;
        await sleep(1200);
        continue;
      }

      const text = res.ok ? res.content : `${speaker.name} kehilangan koneksi API.`;
      if (!res.ok) {
        patchAgent(speakerId, { speaking: false, speech: null });
        logMessage({
          conversationId,
          agentId: speakerId,
          agentName: speaker.name,
          role: speaker.role,
          kind: "system",
          content: `⚠️ ${text}`,
        });
        return finish("koneksi API putus");
      }
      patchAgent(speakerId, { speaking: true, speech: text, chatPartnerId: listenerId, lastReply: text });
      history.push({ speaker: speaker.name, content: text });
      logMessage({
        conversationId,
        agentId: speakerId,
        agentName: speaker.name,
        role: speaker.role,
        kind: "chat",
        content: text,
      });
      if (res.action === "leave") {
        await sleep(clamp(900 + text.length * 18, 1400, 4000));
        patchAgent(speakerId, { speaking: false, speech: null, statusNote: "Mengobrol" });
        return finish(`${speaker.name} menutup obrolan`);
      }
      await sleep(clamp(1200 + text.length * 22, 1800, 6000));
      if (chatRun !== token) {
        endConversation(conversationId, "dibatalkan");
        return;
      }
      patchAgent(speakerId, { speaking: false, speech: null, statusNote: "Mengobrol" });
      await sleep(300);
      // giliran bergantian seperti manusia
      [speakerId, listenerId] = [listenerId, speakerId];
    }
    return finish("obrolan cukup panjang");
  }

  /** kedua pegawai kembali ke aktivitas senggang */
  function closeChat(aId: string, bId: string) {
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
    // setiap kalimat rapat ikut tercatat di database, bukan cuma di memori browser
    const conversationId = await startConversation({
      kind: "meeting",
      topic: initial.topic,
      participantIds: initial.participantIds,
    });

    /** pegawai yang sudah menyatakan tidak punya tambahan */
    const endedIds = new Set<string>();
    for (let round = 1; round <= initial.rounds; round++) {
      if (endedIds.size >= initial.participantIds.length) break;
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
        if (endedIds.has(agent.id)) continue;

        const history = meeting.transcript
          .filter((m) => m.kind === "meeting")
          .slice(-8)
          .map((m) => ({ speaker: m.agentName, content: m.content }));

        set((state) =>
          state.meeting ? { meeting: { ...state.meeting, speakingId: agent.id } } : {},
        );
        patchAgent(agent.id, { speaking: true, speech: "...", statusNote: "Berbicara di rapat" });

        const leaderAgent = get().agents.find((a) => a.id === initial.leaderId);
        const result = await get().requestChat({
          agent,
          kind: "meeting",
          history,
          topic: initial.topic,
          round,
          leaderName: leaderAgent?.name,
          colleagues: get()
            .agents.filter((a) => !a.hasError)
            .map((a) => ({ name: a.name, role: a.role })),
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
        logMessage({
          conversationId,
          agentId: agent.id,
          agentName: agent.name,
          role: agent.role,
          kind: "meeting",
          content: result.content,
          round,
        });

        await sleep(clamp(1800 + result.content.length * 34, 3200, 9500));
        if (meetingRun !== meetingId) {
          endConversation(conversationId, "rapat dihentikan");
          return;
        }
        patchAgent(agent.id, { speaking: false, speech: null, statusNote: "Mendengarkan" });
        await sleep(350);

        // jika pemimpin rapat menyimpulkan atau peserta menyatakan selesai
        if (result.action === "leave" || /SELESAI|KESIMPULAN|MENUTUP RAPAT|RAPAT DITUTUP/i.test(result.content)) {
          if (agent.id === initial.leaderId) {
            addTranscript(sysMessage(`${agent.name} (Pemimpin) telah menyimpulkan dan menutup rapat.`));
            endedIds.clear();
            initial.participantIds.forEach((pid) => endedIds.add(pid));
            break;
          } else {
            patchAgent(agent.id, { speech: null, statusNote: "Rapat selesai untuknya" });
            addTranscript(sysMessage(`${agent.name} telah menyampaikan solusi dan tidak ada tambahan.`));
            endedIds.add(agent.id);
          }
        }
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
    endConversation(conversationId, "rapat selesai");
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
    leaderName?: string;
    colleagues?: { name: string; role: string }[];
  }): Promise<{
    ok: boolean;
    content: string;
    simulated: boolean;
    error?: string;
    status?: number;
    action?: "reply" | "invite" | "pass" | "leave";
    invite?: string;
  }> {
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
          project: get().officeProject,
          leaderName: args.leaderName,
          colleagues: args.colleagues,
          memory: useMemory.getState().buildContext(args.agent.id),
          // signed in → the server must never invent a demo answer
          live: Boolean(get().account),
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
          status: res.status,
        };
      }
      const content = data.content as string;
      // what the agent said becomes something it can learn from next time
      const mem = useMemory.getState();
      mem.rememberChat({ from: args.agent.id, name: args.agent.name, kind: args.kind, text: content });
      if (args.kind !== "meeting") mem.rememberLesson(args.agent.id, content);
      return {
        ok: true,
        content: content ?? "",
        simulated: !!data.simulated,
        action: data.action as "reply" | "invite" | "pass" | "leave" | undefined,
        invite: data.invite as string | undefined,
      };
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
    // deterministic on server AND client: the saved roster is hydrated in
    // initAutoLife (client only) so hydration never diverges
    agents: DEFAULT_RUNTIME,
    selectedAgentId: DEFAULT_RUNTIME[0].id,
    sidebarTab: "meeting",
    meeting: null,
    events: [],
    autoLife: true,
    modalOpen: false,
    editingAgentId: null,
    screenAgentId: null,
    toast: null,
    officeProject: DEFAULT_PROJECT,
    setOfficeProject: (project) => set({ officeProject: project }),
    meetingTopic: DEFAULT_TOPIC,
    meetingLeaderId: DEFAULT_RUNTIME[0].id,
    setMeetingLeaderId: (id) => set({ meetingLeaderId: id }),
    meetingRounds: 4,
    meetingPick: DEFAULT_RUNTIME.filter((a) => !a.hasError).map((a) => a.id),
    focusedFloor: 1,
    account: null,
    aiDefaults: null,
    setAccount: (account) => {
      if (!account) {
        get().resetAccount();
        return;
      }
      // Signed in → demo mode is gone for good. The account key (or the key the
      // owner already set per agent) is used for every employee; an agent left
      // without any key is flagged instead of being served a fake answer.
      const key = account.modelKey?.trim() ?? "";
      const modelName = account.modelName?.trim() ?? "";
      const baseUrl = account.apiBaseUrl?.trim() ?? "";
      set((state) => ({
        account,
        // saved AI settings belong to the account: new employees inherit them.
        // The saved key may only be known after a reload, so keep what works.
        aiDefaults: {
          apiKey: key || state.aiDefaults?.apiKey || "",
          model: modelName || state.aiDefaults?.model || "",
          apiBaseUrl: baseUrl || state.aiDefaults?.apiBaseUrl || "",
        },
        activityMode: "ai",
        agents: state.agents.map((agent) => {
          const apiKey = key || agent.apiKey;
          return {
            ...agent,
            demoMode: false,
            apiKey,
            model: modelName || agent.model,
            apiBaseUrl: baseUrl || agent.apiBaseUrl,
            statusNote: apiKey
              ? agent.statusNote
              : "Butuh API key — buka Pasang API key",
          };
        }),
      }));
      // the roster saved on disk must not keep demoMode/empty keys either
      persistRoster();
      // roster writes follow the chosen backend (hosted RPC or the owner's project)
      void import("./roster-db").then(async ({ setRosterMode, loadRoster }) => {
        const stored = (() => {
          try {
            return JSON.parse(localStorage.getItem(`kantor-orcai:partner:${account.id}`) ?? "null") as
              | { url?: string }
              | null;
          } catch {
            return null;
          }
        })();
        const anonKey = (() => {
          try {
            return localStorage.getItem(`kantor-orcai:partner-anon:${account.id}`) ?? "";
          } catch {
            return "";
          }
        })();
        setRosterMode(
          account.storageMode === "own" && stored?.url && anonKey
            ? { kind: "own", userId: account.id, url: stored.url, anonKey }
            : { kind: "hosted", userId: account.id },
        );

        // signed in → the account's roster is the truth; the demo set is discarded
        const rows = await loadRoster();
        if (rows === null) {
          // the account's table/RPC is missing or unreachable: keep the roster
          // editable locally instead of silently swallowing every write
          rosterOffline = true;
          const cached = useRoster.getState().agents;
          if (cached) get().adoptRoster(cached, true);
          get().notify(
            account.storageMode === "own"
              ? "Tabel `agents` belum ada di proyek Supabase kamu — jalankan supabase/patch-agents.sql. Perubahan disimpan di perangkat ini."
              : "Server roster (tabel `agents`) belum siap — jalankan supabase/patch-agents.sql. Perubahan disimpan di perangkat ini.",
            "error",
          );
        } else if (rows.length) {
          get().adoptRoster(
            rows.map((row) => withAiDefaults(row, aiDefaultsOf(key, account.modelName, account.apiBaseUrl))),
            false,
          );
        } else {
          // Roster kosong di server: JANGAN langsung hapus roster lokal yang sudah
          // ada (pegawai baru dibuat user sebelum DB siap). Biarkan user kembali ke
          // mode server saat baris benar-benar tersimpan.
          const cached = useRoster.getState().agents;
          if (cached && cached.length) {
            adoptRosterFromCache(cached);
          } else {
            useRoster.getState().replace([]);
            rosterOffline = false;
            set({ agents: [], meetingPick: [], selectedAgentId: "" });
          }
        }
      });
    },
    resetAccount: () => {
      useRoster.getState().reset();
      useMemory.getState().updateSettings({ storageMode: "hosted" });
      rosterOffline = false;
      set({
        account: null,
        aiDefaults: null,
        activityMode: "random",
        agents: DEFAULT_RUNTIME,
        meetingPick: DEFAULT_RUNTIME.filter((a) => !a.hasError).map((a) => a.id),
        selectedAgentId: DEFAULT_RUNTIME[0].id,
        editingAgentId: null,
        modalOpen: false,
        meeting: null,
      });
      pushEvent("Keluar dari akun — kantor kembali ke mode tamu.", "info");
    },
    adoptRoster: (configs, offline = false) => {
      if (!configs.length) {
        // Server kosong sengaja ≠ izin menghapus. Biarkan pemanggil memutuskan.
        return;
      }
      rosterOffline = offline;
      const account = get().account;
      const key = account?.modelKey?.trim() ?? "";
      const baseUrl = account?.apiBaseUrl?.trim() || get().aiDefaults?.apiBaseUrl || "";
      useRoster.getState().replace(configs);
      set((state) => ({
        agents: configs.map((config) => {
          const existing = state.agents.find((a) => a.id === config.id);
          return runtimeFromConfig(
            {
              ...config,
              demoMode: false,
              apiKey: key || config.apiKey,
              model: account?.modelName || config.model,
              apiBaseUrl: baseUrl || config.apiBaseUrl,
            },
            existing
              ? {
                  x: existing.x,
                  y: existing.y,
                  targetX: existing.targetX,
                  targetY: existing.targetY,
                  activity: existing.activity,
                  pose: existing.pose,
                  statusNote: existing.statusNote,
                  floor: existing.floor,
                  moving: existing.moving,
                  moveId: existing.moveId,
                }
              : {},
          );
        }),
        meetingPick: configs.filter((c) => c.id).map((c) => c.id),
      }));
    },
    storagePickerOpen: false,
    setStoragePickerOpen: (open) => set({ storagePickerOpen: open }),
    authBusy: false,
    setAuthBusy: (busy) => set({ authBusy: busy }),
    modelKeyOpen: false,
    setModelKeyOpen: (open) => set({ modelKeyOpen: open }),
    timeOfDay: "auto",
    setTimeOfDay: (mode) => {
      set({ timeOfDay: mode });
      pushEvent(
        mode === "auto" ? "Pencahayaan mengikuti jam." : mode === "day" ? "Mode siang aktif." : "Mode malam aktif.",
        "info",
      );
    },
    activityMode: "random",
    setActivityMode: (mode) => set({ activityMode: mode }),

    /**
     * Picks an activity for one agent. `random` rolls the same table as the auto-life
     * loop; `ai` asks the agent model which activity fits it right now.
     */
    autoAct: (id) => {
      const st = get();
      const agent = st.agents.find((a) => a.id === id);
      if (!agent) return;
      if (agent.hasError) {
        get().recoverAgent(id);
        return;
      }
      if (agent.moving) {
        get().notify(`${agent.name} sedang berjalan. Coba lagi sebentar.`, "info");
        return;
      }
      type Pick = 'WORK' | 'TV' | 'DRINK' | 'COOK' | 'PRAY' | 'TOILET' | 'SOFA' | 'SLEEP' | 'DRIVE' | 'CHAT' | 'WANDER' | 'FLOOR' | 'PANTRY' | 'PINGPONG' | 'RELAX';
      const perform = (kind: Pick, line: string | null = null) => {
        // kalimat AI jadi balon percakapan; muncul saat pegawai mulai bergerak
        // dan bertahan sesaat setelah tiba
        const say = () => {
          if (!line) return;
          const cur = get().agents.find((a) => a.id === id);
          if (!cur || cur.hasError) return;
          patchAgent(id, { speech: line, speaking: true });
          window.setTimeout(() => {
            const now = get().agents.find((a) => a.id === id);
            if (now?.speech === line) patchAgent(id, { speech: null, speaking: false });
          }, 8000);
        };
        switch (kind) {
          case "WORK":
            // tugas nyata: AI menyebut apa yang dikerjakan, bukan sekadar duduk
            get().assignTask(id, line ? line.replace(/^Aku mau\s*/i, "") : pickTaskLine(agent));
            break;
          case "TV":
            get().sendToTV(id);
            break;
          case "DRINK":
            get().sendToDrink(id);
            break;
          case "COOK":
            get().sendToCook(id);
            break;
          case "PRAY":
            get().sendToPray(id);
            break;
          case "TOILET":
            get().sendToToilet(id);
            break;
          case "SOFA":
            get().sendToSofa(id);
            break;
          case "SLEEP":
            get().sendToSleep(id);
            break;
          case "DRIVE":
            get().sendToDrive(id);
            break;
          case "CHAT":
            get().chatWith(id);
            break;
          case "WANDER":
            get().wander(id);
            break;
          case "FLOOR":
            get().sendToFloor(id, rand<2 | 3>([2, 3]));
            break;
          case "PINGPONG":
            get().sendToPingpong(id);
            break;
          case "RELAX":
            get().sendToRelax(id);
            break;
          default:
            get().sendToPantry(id);
        }
        // assignTask sudah memasang balon dari tugasnya sendiri
        if (kind !== "WORK") say();
      };

      if (st.activityMode === "random") {
        const roll = Math.random();
        const pick: Pick =
          roll < 0.22
            ? "WORK"
            : roll < 0.32
              ? "TV"
              : roll < 0.42
                ? "DRINK"
                : roll < 0.5
                  ? "COOK"
                  : roll < 0.58
                    ? "PRAY"
                    : roll < 0.65
                      ? "TOILET"
                      : roll < 0.73
                        ? "SOFA"
                        : roll < 0.79
                          ? "SLEEP"
                          : roll < 0.86
                            ? "CHAT"
                            : roll < 0.92
                              ? "DRIVE"
                              : roll < 0.9
                                ? "FLOOR"
                                : roll < 0.95
                                  ? "PINGPONG"
                                  : roll < 0.98
                                    ? "RELAX"
                                    : "PANTRY";
        perform(pick);
        return;
      }

      // AI mode: model memilih aktivitas DAN kalimat yang diucapkan. Tanpa toast —
      // semuanya masuk log kantor.
      void get()
        .requestChat({
          agent,
          kind: "task",
          history: [],
          topic: "memilih aktivitas berikutnya di kantor",
          instruction: activityPrompt(Boolean(agent.task)),
        })
        .then((res) => {
          const valid: Pick[] = [
            "WORK",
            "TV",
            "DRINK",
            "COOK",
            "PRAY",
            "TOILET",
            "SOFA",
            "SLEEP",
            "CHAT",
            "DRIVE",
            "FLOOR",
            "PINGPONG",
            "RELAX",
          ];
          // Proxy down / model menolak (405, 5xx, 429) → pegawai sakit & tidur.
          const down =
            !res.ok &&
            !res.simulated &&
            (res.status === undefined || res.status === 405 || res.status >= 500 || res.status === 429);
          if (down) {
            get().simulateError(id, res.status ? `${res.status} ${res.error ?? ""}`.trim() : res.error);
            return;
          }
          const raw = res.ok ? res.content.trim() : "";
          // format "KODE|kalimat"; model kadang hanya menjawab satu kode
          const [head, ...rest] = raw.split("|");
          const line = rest.join("|").trim();
          const answer = head.toUpperCase();
          const hit = [...valid]
            .sort((a, b) => b.length - a.length)
            .find((v) => new RegExp(`\\b${v}\\b`).test(answer));
          const pick = hit ?? rand(valid);
          pushEvent(
            `${agent.name} → ${pick}${res.simulated ? " (demo)" : ""}${line ? `: "${line.slice(0, 90)}"` : ""}`,
            hit ? "success" : "info",
            agent,
          );
          perform(pick, line || null);
        });
    },

    setSidebarTab: (tab) => set({ sidebarTab: tab }),
    selectAgent: (id) => set({ selectedAgentId: id }),
    setFocusedFloor: (floor) => set({ focusedFloor: floor }),
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
      // connection fields are auto-filled from the account when left empty
      const account = get().account;
      const filled = withAiDefaults(
        config,
        aiDefaultsOf(account?.modelKey, account?.modelName, account?.apiBaseUrl),
      );
      config = filled;
      const existing = get().agents.find((a) => a.id === config.id);
      if (existing) {
        set((state) => ({
          agents: state.agents.map((a) =>
            a.id === config.id
              ? { ...a, ...config, hasError: false, statusNote: "Konfigurasi diperbarui" }
              : a,
          ),
        }));
        persistRoster();
        if (!rosterOffline)
          void (import("./roster-db")).then((m) => m.saveAgentRow(configOfRoster(config))).then((r) => {
            if (!r?.ok) {
              // server menolak: jangan biarkan UI seolah tersimpan. Ikuti cache
              // lokal saja sampai server siap, dengan pesan sekali.
              rosterOffline = true;
              get().notify(`Gagal menyimpan ke database: ${r?.error ?? "unknown"}. Perubahan disimpan di perangkat ini.`, "error");
            }
          });
        pushEvent(`Konfigurasi ${config.name} diperbarui.`, "success");
        get().notify(`Pegawai ${config.name} berhasil diperbarui.`, "success");
      } else {
        if (get().agents.length >= DESKS.length) {
          get().notify(`Meja kerja penuh (maksimal ${DESKS.length} pegawai).`, "error");
          return;
        }
        const usedDesks = new Set(get().agents.map((a) => a.deskIndex));
        const freeDesk = DESKS.find((d) => !usedDesks.has(d.id)) ?? DESKS[0];
        // Spawns outside on the plaza in front of the lobby
        const spawnX = -0.4;
        const spawnY = 9.8;
        const runtime = runtimeFromConfig(
          { ...config, deskIndex: freeDesk.id },
          {
            x: spawnX,
            y: spawnY,
            targetX: spawnX,
            targetY: spawnY,
            activity: "WALKING",
            pose: "walking",
            floor: 1,
            statusNote: "Tiba di kantor...",
          },
        );
        set((state) => ({
          agents: [...state.agents, runtime],
          meetingPick: [...state.meetingPick, runtime.id],
          selectedAgentId: runtime.id,
        }));
        persistRoster();
        // Selalu coba simpan ke server. Kalau gagal → rosterOffline agar
        // setAccount() berikutnya tidak menimpa roster lokal dengan 0 baris.
        void (import("./roster-db")).then((m) => m.saveAgentRow(configOfRoster(runtime))).then((r) => {
          if (!r?.ok) {
            rosterOffline = true;
            get().notify(`Gagal menyimpan pegawai ke database: ${r?.error ?? "unknown"}. Disimpan di perangkat ini.`, "error");
          }
        });
        pushEvent(`${config.name} tiba dari luar dan masuk lewat lobi.`, "success", runtime);
        get().notify(`Selamat datang, ${config.name}! Berjalan masuk lewat lobi.`, "success");

        // Walks inside through the lobby directly to Tech Lead's desk to report
        const tlDesk = DESKS[0];
        const reportSpot = { x: tlDesk.cx + 1.15, y: tlDesk.seat.y };
        window.setTimeout(() => {
          goTo(
            runtime.id,
            reportSpot,
            "CHATTING",
            "standing",
            "Melapor ke Tech Lead",
            `Halo Tech Lead, saya ${config.name} siap bergabung sebagai ${config.role}!`,
          );
          // Tech Lead greets the new recruit, then they take their desk
          window.setTimeout(() => {
            const tl = get().agents.find((a) => a.id === "agent-budi");
            if (tl) {
              patchAgent(tl.id, {
                speaking: true,
                speech: `Selamat datang di tim, ${config.name}! Silakan tempati meja kerjamu.`,
                statusNote: "Menyambut pegawai baru",
              });
              window.setTimeout(() => {
                patchAgent(tl.id, { speaking: false, speech: null, statusNote: "Tech Lead standby" });
              }, 4000);
            }
            window.setTimeout(() => {
              goTo(
                runtime.id,
                freeDesk.seat,
                "IDLE",
                "sitting",
                "Siap bekerja",
                "Terima kasih, saya mulai setup meja.",
              );
              window.setTimeout(() => {
                patchAgent(runtime.id, { speech: null, speaking: false });
              }, 4200);
            }, 3200);
          }, 6800);
        }, 120);
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
      persistRoster();
      if (!rosterOffline) void (import("./roster-db")).then((m) => m.deleteAgentRow(id));
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
      // arrived at lift entrance → ride up/down
      if (activity === "ELEVATOR" && agent.pendingFloor) {
        const target = agent.pendingFloor;
        patchAgent(id, { pendingFloor: null });
        window.setTimeout(() => rideElevator(id, target), 700);
      }
      // durability point: the offline worker and other devices read this copy
      snapshotAgents();
    },

    startMeeting: (topic, ids, leaderId) => {
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

      const chosenLeader = leaderId && ids.includes(leaderId)
        ? leaderId
        : ids.find((id) => {
            const a = get().agents.find((x) => x.id === id);
            return a && /(lead|architect|manager)/i.test(a.role);
          }) ?? ids[0];

      const leaderAgent = get().agents.find((a) => a.id === chosenLeader);
      const leaderName = leaderAgent ? leaderAgent.name : "Pemimpin Rapat";

      set({
        meeting: {
          id: runId,
          topic,
          rounds: 8,
          participantIds: ids,
          leaderId: chosenLeader,
          phase: "gathering",
          currentRound: 0,
          speakingId: null,
          simulated: participants.some((p) => p.demoMode || !p.apiKey),
          transcript: [
            sysMessage(`Undangan rapat: "${topic}" — Pemimpin: ${leaderName} (${ids.length} peserta).`),
          ],
        },
        meetingTopic: topic,
        meetingLeaderId: chosenLeader,
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

    sendToPantry: (id) => {
      const agent = get().agents.find((a) => a.id === id);
      if (!agent) return;
      const taken = new Set(
        get()
          .agents.filter(
            (a) =>
              (a.activity === "DRINKING" && a.pose === "sitting") ||
              (a.moving && a.pending?.activity === "DRINKING" && a.pending.pose === "sitting"),
          )
          .map((a) =>
            a.moving
              ? `${a.targetX.toFixed(1)},${a.targetY.toFixed(1)}`
              : `${a.x.toFixed(1)},${a.y.toFixed(1)}`,
          ),
      );
      const seat = PANTRY_SEATS.find(
        (s) => !taken.has(`${s.x.toFixed(1)},${s.y.toFixed(1)}`),
      );
      if (!seat) {
        get().wander(id);
        return;
      }
      goTo(id, seat, "DRINKING", "sitting", "Duduk santai di pantry", "Duduk dulu ah, haus ☕");
      pushEvent(`${agent.name} duduk di bangku pantry.`, "info");
      window.setTimeout(() => {
        const a = get().agents.find((x) => x.id === id);
        if (
          a &&
          a.activity === "DRINKING" &&
          a.pose === "sitting" &&
          !a.moving &&
          !get().meeting?.participantIds.includes(id)
        ) {
          get().sendToDesk(id);
        }
      }, 14000);
    },

    sendToDrive: (id) => {
      const agent = get().agents.find((a) => a.id === id);
      if (!agent) return;
      const busy = get().agents.some(
        (a) => a.id !== id && (a.activity === "DRIVING" || (a.moving && a.pending?.activity === "DRIVING")),
      );
      if (busy) {
        get().notify("Mobil sedang dipakai pegawai lain.", "info");
        return;
      }
      goTo(id, CAR_ENTRY, "DRIVING", "sitting", "Parkir mobil", "Saya parkir dulu ya 🚗");
      pushEvent(`${agent.name} berjalan ke mobil di parkiran.`, "info");
    },

    endDrive: (id) => {
      const agent = get().agents.find((a) => a.id === id);
      if (!agent || agent.activity !== "DRIVING") return;
      const desk = DESKS[agent.deskIndex % DESKS.length];
      goTo(id, desk.seat, "IDLE", "sitting", "Kembali dari parkir");
      pushEvent(`${agent.name} selesai memarkir mobil dan kembali ke meja.`, "info");
    },

    sendToDesk: (id) => {
      const agent = get().agents.find((a) => a.id === id);
      if (!agent) return;
      if ((agent.floor ?? 1) !== 1) {
        get().sendToFloor(id, 1);
        return;
      }
      const desk = DESKS[agent.deskIndex % DESKS.length];
      goTo(id, desk.seat, "IDLE", "sitting", "Kembali ke meja");
      patchAgent(id, { task: null });
    },

    sendToFloor: (id, targetFloor) => {
      const agent = get().agents.find((a) => a.id === id);
      if (!agent) return;
      if ((agent.floor ?? 1) === targetFloor) {
        get().notify(`${agent.name} sudah berada di Lantai ${targetFloor}.`, "info");
        return;
      }
      if (agent.activity === "MEETING") return;
      pushEvent(`${agent.name} naik lift ke Lantai ${targetFloor}. 🛗`, "info", agent);
      patchAgent(id, { pendingFloor: targetFloor });
      goTo(id, ELEVATOR_SPOT, "ELEVATOR", "standing", `Menuju lift ke Lantai ${targetFloor}`);
      // only one pending auto-return per agent; a newer trip cancels the old one
      const prev = returnTimers.get(id);
      if (prev) window.clearTimeout(prev);
      returnTimers.delete(id);
      if (targetFloor > 1) {
        const timer = window.setTimeout(() => {
          returnTimers.delete(id);
          const later = get().agents.find((x) => x.id === id);
          if (
            later &&
            (later.floor ?? 1) === targetFloor &&
            !later.moving &&
            !later.cabin &&
            later.activity !== "MEETING"
          ) {
            get().sendToFloor(id, 1);
          }
        }, 28000);
        returnTimers.set(id, timer);
      }
    },

    sendToRelax: (id) => {
      const agent = get().agents.find((a) => a.id === id);
      if (!agent) return;
      const taken = new Set(
        get()
          .agents.filter((a) => a.id !== id && a.activity === "RELAXING")
          .map((a) => `${a.x.toFixed(1)},${a.y.toFixed(1)}`),
      );
      // coffee break lives on the Lantai 3 cafe: bar stools first, then tables
      const seats = [
        ...FLOOR3.barStools,
        ...FLOOR3_TABLE_SEATS,
        ...FLOOR3.sofas,
      ];
      const seat = seats.find((s) => !taken.has(`${s.x.toFixed(1)},${s.y.toFixed(1)}`)) ?? null;
      if ((agent.floor ?? 1) !== 3) get().sendToFloor(id, 3);
      const arrive = () => {
        if (seat) {
          goTo(id, seat, "RELAXING", "sitting", "Santai minum kopi di Lantai 3", "Kopi dulu, santai sebentar ☕");
        } else {
          goTo(id, rand(FLOOR3_SPOTS), "RELAXING", "standing", "Santai di Lantai 3", "Nongkrong dulu ah ☕");
        }
        pushEvent(`${agent.name} santai di kafe Lantai 3. ☕`, "info", agent);
      };
      // let the lift finish first
      window.setTimeout(arrive, (agent.floor ?? 1) === 3 ? 0 : 4200);
    },

    sendToPingpong: (id) => {
      const agent = get().agents.find((a) => a.id === id);
      if (!agent) return;
      // ping-pong table sits in the Lantai 3 garden
      const taken = new Set(
        get()
          .agents.filter((a) => a.id !== id && a.activity === "PINGPONG")
          .map((a) => `${a.x.toFixed(1)},${a.y.toFixed(1)}`),
      );
      const seat =
        PINGPONG_SEATS.find((s) => !taken.has(`${s.x.toFixed(1)},${s.y.toFixed(1)}`)) ??
        PINGPONG_SEATS[0];
      if ((agent.floor ?? 1) !== 3) get().sendToFloor(id, 3);
      window.setTimeout(
        () => {
          goTo(id, seat, "PINGPONG", "standing", "Main pingpong di Lantai 3", "Pingpong dulu yuk 🏓");
          pushEvent(`${agent.name} main pingpong di Lantai 3. 🏓`, "info", agent);
        },
        (agent.floor ?? 1) === 3 ? 0 : 4200,
      );
    },

    sendToTV: (id, customSpeech?: string) => {
      const agents = get().agents;
      const agent = agents.find((a) => a.id === id);
      if (!agent) return;
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
      let line = customSpeech;
      if (!line) {
        line = rand(TV_SPEECH_LINES);
      } else if (line === "ai") {
        line = rand(TV_SPEECH_LINES);
        void get()
          .requestChat({
            agent,
            kind: "chat",
            history: [],
            topic: "sedang santai menonton TV di lounge kantor",
            instruction: "Tulis reaksimu saat menonton TV lounge, santai dan maksimal 1 kalimat natural.",
          })
          .then((res) => {
            if (res.ok && res.content) {
              const cur = get().agents.find((x) => x.id === id);
              if (cur && cur.activity === "WATCHING_TV") {
                patchAgent(id, { speech: res.content, speaking: true });
              }
            }
          });
      }
      goTo(id, seat, "WATCHING_TV", "sitting", "Menonton TV", line);
      pushEvent(`${agent.name} ke lounge menonton TV.`, "info", agent);
      window.setTimeout(() => {
        const a = get().agents.find((x) => x.id === id);
        if (a && a.activity === "WATCHING_TV") patchAgent(id, { speech: null, speaking: false });
      }, 4200);
      // nobody parks in front of the TV forever — head back after a while
      window.setTimeout(() => {
        const a = get().agents.find((x) => x.id === id);
        if (
          a &&
          a.activity === "WATCHING_TV" &&
          !a.moving &&
          !get().meeting?.participantIds.includes(id)
        ) {
          get().sendToDesk(id);
        }
      }, 26000);
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

      const loc = rand(CHAT_LOCATIONS);
      const spotA = loc.spots[0];
      const spotB = loc.spots[1];

      goTo(id, { x: spotA.x, y: spotA.y }, "CHATTING", spotA.pose, `Ngobrol di ${loc.name}`);
      goTo(partner.id, { x: spotB.x, y: spotB.y }, "CHATTING", spotB.pose, `Ngobrol di ${loc.name}`);
      patchAgent(id, { direction: spotA.facing });
      patchAgent(partner.id, { direction: spotB.facing });
      pushEvent(`${agent.name} mengajak ${partner.name} ngobrol di ${loc.name}.`, "info", agent);
      get().notify(`Obrolan santai dimulai di ${loc.name}.`, "info");
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
            id,
          );
          break;
        case "TV":
          get().sendToTV(id);
          break;
        case "DRINK":
          get().sendToDrink(id);
          break;
        case "PANTRY":
          get().sendToPantry(id);
          break;
        case "DRIVE":
          get().sendToDrive(id);
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
        case "PINGPONG":
          get().sendToPingpong(id);
          break;
        case "RELAX":
          get().sendToRelax(id);
          break;
        case "DESK":
          get().sendToDesk(id);
          break;
        case "ELEVATOR":
          get().sendToFloor(id, 2);
          break;
        default:
          break;
      }
    },

    initAutoLife: () => {
      if (autoLifeStarted) return;
      autoLifeStarted = true;
      // restore this browser's roster (guest) after hydration — a saved roster
      // (including an intentionally empty one) must replace the demo set
      const local = useRoster.getState().agents;
      if (local) get().adoptRoster(local);

      // whatever the offline worker (or another device) left in storage
      const saved = memoryStore().getState().settings.agents;
      if (saved?.length) {
        set((state) => ({
          agents: state.agents.map((agent) => {
            const snap = saved.find((a) => a.id === agent.id);
            if (!snap || agent.activity === "MEETING") return agent;
            return {
              ...agent,
              activity: snap.activity as Activity,
              statusNote: snap.statusNote,
              floor: snap.floor,
              hasError: snap.hasError,
              x: snap.x,
              y: snap.y,
              targetX: snap.x,
              targetY: snap.y,
              pose: snap.activity === "ERROR" ? "sleeping" : "sitting",
              moving: false,
              speech: null,
              speaking: false,
            };
          }),
        }));
      }
      window.setInterval(() => {
        const state = get();
        if (!state.autoLife) return;
        if (state.meeting && state.meeting.phase !== "ended") return;
        const idle = state.agents.filter(
          (a) => !a.hasError && !a.moving && a.activity === "IDLE" && !a.task,
        );
        if (!idle.length) return;
        // keep the office lively: nudge one or two people every tick
        const shuffle = [...idle].sort(() => Math.random() - 0.5);

        // Mode AI: satu pegawai per tick, bergiliran dan berjeda, supaya semua
        // kebagian dan token tidak habis. Pegawai yang baru dipanggil model
        // dilewati sampai cooldown lewat.
        if (state.activityMode === "ai") {
          const now = Date.now();
          const ready = shuffle.filter((a) => now - (lastActAt.get(a.id) ?? 0) > ACT_COOLDOWN_MS);
          if (!ready.length) return;
          // yang paling lama tidak dipanggil duluan → rotasi adil
          ready.sort((a, b) => (lastActAt.get(a.id) ?? 0) - (lastActAt.get(b.id) ?? 0));
          lastActAt.set(ready[0].id, now);
          get().autoAct(ready[0].id);
          return;
        }

        const picks = shuffle.slice(0, Math.random() < 0.4 ? 2 : 1);
        const hour = new Date().getHours();
        const night = hour < 6 || hour >= 18;
        for (const agent of picks) {
          const st = get();
          const current = st.agents.find((a) => a.id === agent.id);
          if (!current || current.activity !== "IDLE" || current.moving || current.task) continue;
          const roll = Math.random();
          const bedBusy =
            st.agents.filter(
              (a) => a.activity === "RESTING" && a.pose === "sleeping" && !a.moving,
            ).length >= BED_SPOTS.length;
          const toiletBusy = st.agents.some(
            (a) =>
              a.id !== agent.id &&
              (a.activity === "TOILET" || (a.moving && a.pending?.activity === "TOILET")),
          );
          const driveBusy = st.agents.some(
            (a) =>
              a.id !== agent.id &&
              (a.activity === "DRIVING" || (a.moving && a.pending?.activity === "DRIVING")),
          );
          if (night && !bedBusy && roll < 0.22) get().sendToSleep(agent.id);
          else if (roll < 0.40 && !chatRun) get().chatWith(agent.id);
          else if (roll < 0.50) get().sendToSofa(agent.id);
          else if (roll < 0.60) get().sendToTV(agent.id);
          else if (roll < 0.70) get().sendToDrink(agent.id);
          else if (roll < 0.78) get().sendToCook(agent.id);
          else if (roll < 0.84) get().sendToPray(agent.id);
          else if (roll < 0.90) {
            if (toiletBusy) get().wander(agent.id);
            else get().sendToToilet(agent.id);
          } else if (roll < 0.95 && !driveBusy) get().sendToDrive(agent.id);
          else get().sendToPantry(agent.id);
        }
      }, 14000);
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

// Dev-only: expose the store so browser tooling can inspect agent state.
if (typeof window !== "undefined") {
  (window as unknown as { __office?: typeof useOffice }).__office = useOffice;
}
