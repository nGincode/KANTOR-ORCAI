"use client";

/**
 * The employee roster lives in the account's office document, not in this
 * browser. Adding / editing / deleting an employee is written straight to the
 * selected storage backend (our Supabase or the owner's), and every device reads
 * the same list back.
 *
 * localStorage keeps a copy only so a reload while offline still shows the
 * roster; it is never the source of truth once the owner is signed in.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AgentConfig } from "./types";

export const ROSTER_KEY = "kantor-orcai:roster:v1";

/** the durable half of an employee — runtime is rebuilt by the simulation */
export function configOf(agent: AgentConfig): AgentConfig {
  return {
    id: agent.id,
    name: agent.name,
    role: agent.role,
    shirtColor: agent.shirtColor,
    hairStyle: agent.hairStyle,
    skinTone: agent.skinTone,
    skills: agent.skills,
    agentMd: agent.agentMd,
    apiBaseUrl: agent.apiBaseUrl,
    apiKey: agent.apiKey,
    model: agent.model,
    demoMode: agent.demoMode,
    deskIndex: agent.deskIndex,
  };
}

/** the AI defaults an account hands to every employee that has no connection yet */
export function aiDefaultsOf(key?: string, model?: string, baseUrl?: string): Partial<AgentConfig> {
  return {
    apiKey: key ?? "",
    model: model || "gpt-4o-mini",
    apiBaseUrl:
      baseUrl || process.env.NEXT_PUBLIC_DEFAULT_API_URL || "https://api.openai.com/v1",
    demoMode: false,
  };
}

/**
 * Auto-fills ONLY the AI connection fields when they are empty — persona,
 * name, role and agent.md always stay whatever the owner typed.
 */
export function withAiDefaults(config: AgentConfig, defaults: Partial<AgentConfig>): AgentConfig {
  const filled: AgentConfig = { ...config };
  if (!filled.apiKey?.trim() && defaults.apiKey) filled.apiKey = defaults.apiKey;
  if (!filled.model?.trim() && defaults.model) filled.model = defaults.model;
  if (!filled.apiBaseUrl?.trim() && defaults.apiBaseUrl) filled.apiBaseUrl = defaults.apiBaseUrl;
  if (!config.demoMode) filled.demoMode = false;
  return filled;
}

interface RosterState {
  /** null = this browser never saw a roster; the app falls back to the demo set */
  agents: AgentConfig[] | null;
  save: (agents: AgentConfig[]) => void;
  /** replace the list wholesale (login, another device, server reload) */
  replace: (agents: AgentConfig[]) => void;
  reset: () => void;
}

export const useRoster = create<RosterState>()(
  persist(
    (set) => ({
      agents: null,
      save: (agents) => set({ agents: agents.map(configOf) }),
      replace: (agents) => set({ agents: agents.map(configOf) }),
      reset: () => set({ agents: null }),
    }),
    {
      name: ROSTER_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 2,
    },
  ),
);
