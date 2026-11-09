/**
 * Long-term memory for every agent.
 *
 * Same data model, two backends:
 *  - guest  → localStorage (dies with the browser, zero cost)
 *  - signed in → Postgres through /api/memory (lib/memory-remote.ts), so the
 *    office keeps living while the tab is closed.
 *
 * Kept deliberately small:
 *  - events    → 300 newest one-liners, near-duplicates dropped
 *  - chats     → 120 newest lines, 240 chars each
 *  - profiles  → per-agent lesson lines + visit counters (bounded, merged)
 * The payload is also capped at MEMORY_BUDGET bytes, dropping the oldest slices
 * on overflow so a write never dies on the browser quota.
 */

import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";

export const MEMORY_KEY = "kantor-orcai:memory:v1";
const MEMORY_BUDGET = 900 * 1024; // ≈0.9 MB

export const LIMITS = {
  events: 50,
  chats: 40,
  lessons: 8,
  activities: 20,
} as const;

export interface MemoryEvent {
  at: number;
  kind: "info" | "success" | "error";
  text: string;
  agent?: string;
}

export interface MemoryChat {
  at: number;
  /** agent id whose turn it was */
  from: string;
  name: string;
  kind: "chat" | "meeting" | "task";
  text: string;
}

export interface AgentProfile {
  visits: Record<string, number>;
  lessons: string[];
  lastSeen: number;
}

/** the smallest agent snapshot another device / the worker needs */
export interface AgentSnapshot {
  id: string;
  name: string;
  role: string;
  activity: string;
  statusNote: string | null;
  floor: number;
  hasError: boolean;
  demoMode: boolean;
  model: string;
  x: number;
  y: number;
  /** persona + appearance, so the roster can be restored on another device */
  shirtColor?: string;
  hairStyle?: string;
  skinTone?: string;
  skills?: string[];
  agentMd?: string;
  apiBaseUrl?: string;
  deskIndex?: number;
}

export interface MemorySettings {
  agents?: AgentSnapshot[];
  storageMode?: "hosted" | "own";
  offlineAi?: boolean;
}

export interface AgentMemoryState {
  events: MemoryEvent[];
  chats: MemoryChat[];
  profiles: Record<string, AgentProfile>;
  /** account-level settings that must follow the user across devices */
  settings: MemorySettings;
  /** bump per saved entry so UI can react without parsing the blob */
  version: number;

  rememberEvent: (e: Omit<MemoryEvent, "at"> & { at?: number }) => void;
  rememberChat: (c: Omit<MemoryChat, "at"> & { at?: number }) => void;
  rememberActivity: (agentId: string, label: string) => void;
  /** pushes the agent's own words into their lesson list */
  rememberLesson: (agentId: string, lesson: string) => void;
  /** compact prompt block for the model; empty when nothing was learned yet */
  buildContext: (agentId: string, budget?: number) => string;
  clearMemory: () => void;
  /** merge a patch into the account-level settings */
  updateSettings: (patch: Partial<MemorySettings>) => void;
}

type MemorySlice = Pick<AgentMemoryState, "events" | "chats" | "profiles" | "settings" | "version">;

const emptyProfile = (): AgentProfile => ({ visits: {}, lessons: [], lastSeen: 0 });
const byNewest = <T extends { at: number }>(list: T[], max: number) =>
  list.length > max ? list.slice(list.length - max) : list;

/** drops the oldest data until the payload fits the budget */
function trimToBudget(slice: MemorySlice): MemorySlice {
  let json = JSON.stringify(slice);
  while (json.length > MEMORY_BUDGET && (slice.events.length > 20 || slice.chats.length > 10)) {
    if (slice.events.length >= slice.chats.length) {
      slice.events = slice.events.slice(-Math.floor(slice.events.length * 0.8));
    } else {
      slice.chats = slice.chats.slice(-Math.floor(slice.chats.length * 0.8));
    }
    json = JSON.stringify(slice);
  }
  return slice;
}

/** the behaviour half — shared by the local and the remote store */
const memoryImpl: (
  set: (fn: (s: AgentMemoryState) => Partial<AgentMemoryState>) => void,
  get: () => AgentMemoryState,
) => Omit<AgentMemoryState, "events" | "chats" | "profiles" | "settings" | "version"> = (set, get) => ({
  rememberEvent: (e) => {
    const last = get().events[get().events.length - 1];
    if (last && last.text === e.text && Date.now() - last.at < 4000) return;
    set((s) => ({
      events: byNewest(
        [...s.events, { at: e.at ?? Date.now(), kind: e.kind, text: e.text.slice(0, 160), agent: e.agent }],
        LIMITS.events,
      ),
      version: s.version + 1,
    }));
  },

  rememberChat: (c) => {
    if (!c.text.trim()) return;
    set((s) => ({
      chats: byNewest(
        [...s.chats, { at: c.at ?? Date.now(), from: c.from, name: c.name, kind: c.kind, text: c.text.slice(0, 240) }],
        LIMITS.chats,
      ),
      version: s.version + 1,
    }));
  },

  rememberActivity: (agentId, label) => {
    set((s) => {
      const prev = s.profiles[agentId] ?? emptyProfile();
      const visits = { ...prev.visits, [label]: (prev.visits[label] ?? 0) + 1 };
      const kept = Object.entries(visits)
        .sort((a, b) => b[1] - a[1])
        .slice(0, LIMITS.activities);
      return {
        profiles: {
          ...s.profiles,
          [agentId]: { ...prev, visits: Object.fromEntries(kept), lastSeen: Date.now() },
        },
        version: s.version + 1,
      };
    });
  },

  rememberLesson: (agentId, lesson) => {
    const clean = lesson.replace(/\s+/g, " ").trim().slice(0, 160);
    if (clean.length < 8) return;
    set((s) => {
      const prev = s.profiles[agentId] ?? emptyProfile();
      // models repeat themselves; keep each thought once
      if (prev.lessons.some((l) => l.slice(0, 40) === clean.slice(0, 40))) return {};
      return {
        profiles: {
          ...s.profiles,
          [agentId]: { ...prev, lessons: [...prev.lessons, clean].slice(-LIMITS.lessons), lastSeen: Date.now() },
        },
        version: s.version + 1,
      };
    });
  },

  buildContext: (agentId, budget = 1200) => {
    const { chats, events, profiles } = get();
    const p = profiles[agentId];
    const parts: string[] = [];
    if (p) {
      const rooms = Object.entries(p.visits)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([k, v]) => `${k} (${v}×)`);
      if (rooms.length) parts.push(`Ruangan yang sering kamu datangi: ${rooms.join(", ")}.`);
      if (p.lessons.length) {
        parts.push(`Yang kamu pelajari sebelumnya:\n${p.lessons.map((l) => `- ${l}`).join("\n")}`);
      }
    }
    const mine = chats.filter((c) => c.from === agentId).slice(-6).map((c) => `- ${c.text}`);
    if (mine.length) parts.push(`Kalimat terakhirmu:\n${mine.join("\n")}`);
    const recent = events.slice(-12).map((e) => `- ${e.agent ? `${e.agent}: ` : ""}${e.text}`);
    if (recent.length) parts.push(`Kejadian terakhir di kantor:\n${recent.join("\n")}`);
    const text = parts.join("\n\n");
    return text.length > budget ? text.slice(0, budget) : text;
  },

  clearMemory: () => set(() => ({ events: [], chats: [], profiles: {}, settings: {}, version: 0 })),

  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch }, version: s.version + 1 })),
});

const initial: MemorySlice = { events: [], chats: [], profiles: {}, settings: {}, version: 0 };

const mergeSlice = (persisted: unknown, current: AgentMemoryState): AgentMemoryState => {
  const p = (persisted ?? {}) as Partial<MemorySlice>;
  return {
    ...current,
    events: p.events ?? [],
    chats: p.chats ?? [],
    profiles: p.profiles ?? {},
    settings: p.settings ?? {},
    version: p.version ?? 0,
  };
};

/** guest store: survives reloads, dies with the browser, costs nothing */
export function createLocalMemory() {
  return create<AgentMemoryState>()(
    persist(
      (set, get) => ({ ...initial, ...memoryImpl(set, get) }),
      {
        name: MEMORY_KEY,
        storage: createJSONStorage(() => localStorage),
        version: 1,
        partialize: (s) =>
          trimToBudget({ events: s.events, chats: s.chats, profiles: s.profiles, settings: s.settings, version: s.version }),
        merge: mergeSlice,
      },
    ),
  );
}

/** signed-in store: identical API, persisted through the account API */
export function createRemoteMemory(storage: StateStorage) {
  return create<AgentMemoryState>()(
    persist(
      (set, get) => ({ ...initial, ...memoryImpl(set, get) }),
      {
        name: MEMORY_KEY,
        storage: createJSONStorage(() => storage),
        version: 1,
        partialize: (s) =>
          trimToBudget({ events: s.events, chats: s.chats, profiles: s.profiles, settings: s.settings, version: s.version }),
        merge: mergeSlice,
      },
    ),
  );
}

/** which store `bindMemory` last selected; lets callers seed it after a swap */
let activeStore: ReturnType<typeof createLocalMemory> = createLocalMemory();

export const useMemory = createLocalMemory();

/**
 * Points the shared `useMemory` symbol at another store (the account one after
 * login). Every existing `useMemory.getState()` call keeps working — the
 * function object is the same, only its guts are swapped.
 */
export function bindMemory(store: ReturnType<typeof createLocalMemory>) {
  activeStore = store;
  Object.assign(useMemory, {
    getState: store.getState,
    setState: store.setState,
    subscribe: store.subscribe,
  });
}

/** the store currently receiving writes (guest local until bindMemory runs) */
export function memoryStore() {
  return activeStore;
}
