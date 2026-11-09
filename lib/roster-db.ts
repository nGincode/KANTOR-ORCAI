"use client";

/**
 * Employee roster, stored server-side per account.
 *
 *  hosted → KANTOR ORCAI's Supabase, table public.agents (RPC list_agents /
 *           save_agent / delete_agent). One row per employee, so an edit is a
 *           small write.
 *  own    → the owner's project: same table recipe (supabase/patch-agents.sql),
 *           written through PostgREST with their anon key + RLS.
 *
 * A guest (not signed in) falls back to the roster in memory only.
 * Nothing here ever runs for a demo employee — the demo set is discarded on login.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AgentConfig, HairStyle } from "./types";
import { authHeaders } from "./session";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const PUBLISHABLE =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export type RosterMode =
  | { kind: "guest" }
  | { kind: "hosted"; userId: string }
  | { kind: "own"; userId: string; url: string; anonKey: string };

let mode: RosterMode = { kind: "guest" };

export function setRosterMode(next: RosterMode) {
  mode = next;
}

export type Row = {
  agent_id: string;
  desk_index: number;
  name: string;
  role: string;
  shirt_color: string;
  hair_style: string;
  skin_tone: string;
  skills: unknown;
  agent_md: string;
  api_base_url: string;
  model: string;
  demo_mode: boolean;
  has_key?: boolean;
};

export function rowToConfig(r: Row): AgentConfig {
  return {
    id: r.agent_id,
    name: r.name,
    role: r.role,
    shirtColor: r.shirt_color,
    hairStyle: r.hair_style as HairStyle,
    skinTone: r.skin_tone,
    skills: Array.isArray(r.skills) ? (r.skills as string[]) : [],
    agentMd: r.agent_md ?? "",
    apiBaseUrl: r.api_base_url ?? "https://api.openai.com/v1",
    // the key is never sent back by the server; the browser keeps its own copy
    apiKey: "",
    model: r.model ?? "",
    demoMode: r.demo_mode ?? false,
    deskIndex: r.desk_index ?? 0,
  };
}

export function configToRow(config: AgentConfig): Row {
  return {
    agent_id: config.id,
    desk_index: config.deskIndex,
    name: config.name,
    role: config.role,
    shirt_color: config.shirtColor,
    hair_style: config.hairStyle,
    skin_tone: config.skinTone,
    skills: config.skills,
    agent_md: config.agentMd,
    api_base_url: config.apiBaseUrl,
    model: config.model,
    demo_mode: false,
  };
}

function hostedClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !PUBLISHABLE) return null;
  return createClient(SUPABASE_URL, PUBLISHABLE, {
    // the token is read from localStorage on every call
    global: { headers: authHeaders() },
    auth: { persistSession: false },
  });
}

function partnerClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

const PARTNER_COLUMNS =
  "agent_id, desk_index, name, role, shirt_color, hair_style, skin_tone, skills, agent_md, api_base_url, model, demo_mode";

/* --------------------------------------------------------------- read */

/** null = the store itself is unreachable (table/RPC missing), so writes must not pretend */
export async function loadRoster(): Promise<AgentConfig[] | null> {
  if (mode.kind === "guest") return [];

  if (mode.kind === "hosted") {
    const supabase = hostedClient();
    if (!supabase) return null;
    const { data, error } = await supabase.rpc("list_agents");
    if (error) return null;
    return Array.isArray(data) ? (data as Row[]).map(rowToConfig) : [];
  }

  const supabase = partnerClient(mode.url, mode.anonKey);
  const { data, error } = await supabase.from("agents").select(PARTNER_COLUMNS).order("desk_index");
  if (error) return null;
  return Array.isArray(data) ? (data as Row[]).map(rowToConfig) : [];
}

/* --------------------------------------------------------------- write */

export async function saveAgentRow(config: AgentConfig, passphrase = "") {
  if (mode.kind === "guest") return { ok: true };

  if (mode.kind === "hosted") {
    const supabase = hostedClient();
    if (!supabase) return { ok: false, error: "Supabase belum dikonfigurasi." };
    const { error } = await supabase.rpc("save_agent", {
      p_agent_id: config.id,
      p_desk_index: config.deskIndex,
      p_name: config.name,
      p_role: config.role,
      p_shirt_color: config.shirtColor,
      p_hair_style: config.hairStyle,
      p_skin_tone: config.skinTone,
      p_skills: config.skills,
      p_agent_md: config.agentMd,
      p_api_base_url: config.apiBaseUrl,
      p_model: config.model,
      // only sent when the owner actually set a per-employee key
      p_api_key: config.apiKey || null,
      p_demo_mode: false,
      p_passphrase: passphrase,
    });
    return { ok: !error, error: error?.message };
  }

  const supabase = partnerClient(mode.url, mode.anonKey);
  // the agent row itself no longer uses account_id in the partner schema
  const { error } = await supabase
    .from("agents")
    .upsert({ ...configToRow(config), account_id: mode.userId }, { onConflict: "account_id,agent_id" });
  return { ok: !error, error: error?.message };
}

export async function deleteAgentRow(agentId: string) {
  if (mode.kind === "guest") return { ok: true };

  if (mode.kind === "hosted") {
    const supabase = hostedClient();
    if (!supabase) return { ok: false };
    const { error } = await supabase.rpc("delete_agent", { p_agent_id: agentId });
    return { ok: !error, error: error?.message };
  }

  const supabase = partnerClient(mode.url, mode.anonKey);
  const { error } = await supabase
    .from("agents")
    .delete()
    .eq("account_id", mode.userId)
    .eq("agent_id", agentId);
  return { ok: !error, error: error?.message };
}

/** first login: the demo roster must not be copied into the account */
export async function clearRosterRows() {
  if (mode.kind === "guest") return { ok: true };

  if (mode.kind === "hosted") {
    const supabase = hostedClient();
    if (!supabase) return { ok: false };
    const { error } = await supabase.rpc("clear_agents");
    return { ok: !error, error: error?.message };
  }

  const supabase = partnerClient(mode.url, mode.anonKey);
  const { error } = await supabase.from("agents").delete().eq("account_id", mode.userId);
  return { ok: !error, error: error?.message };
}
