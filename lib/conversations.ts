"use client";

/**
 * Riwayat obrolan & rapat, disimpan di Postgres (public.conversations +
 * public.conversation_messages lewat RPC di supabase/patch-conversations.sql).
 *
 * Tulis = fire-and-forget: kantor tidak boleh berhenti hanya karena jaringan
 * putus, jadi kegagalan dicatat di console saja.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { authHeaders } from "./session";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export type ConversationKind = "chat" | "meeting";
export type MessageKind = "chat" | "meeting" | "system";

export interface ConversationSummary {
  id: string;
  kind: ConversationKind;
  topic: string;
  participantIds: string[];
  startedAt: string;
  endedAt: string | null;
  endReason: string | null;
  messageCount: number;
}

export interface ConversationMessage {
  id: number;
  agentId: string | null;
  agentName: string;
  role: string;
  kind: MessageKind;
  content: string;
  round: number;
  createdAt: string;
}

function client(): SupabaseClient | null {
  if (!SUPABASE_URL || !PUBLISHABLE) return null;
  return createClient(SUPABASE_URL, PUBLISHABLE, {
    global: { headers: authHeaders() },
    auth: { persistSession: false },
  });
}

/** null untuk tamu yang belum login — riwayat hanya milik akun */
export async function startConversation(input: {
  kind: ConversationKind;
  topic: string;
  participantIds: string[];
}): Promise<string | null> {
  const supabase = client();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("start_conversation", {
    p_kind: input.kind,
    p_topic: input.topic,
    p_participant_ids: input.participantIds,
  });
  if (error) {
    console.warn("[conversations] start gagal:", error.message);
    return null;
  }
  return (data as string | null) ?? null;
}

export function logMessage(input: {
  conversationId: string | null;
  agentId: string | null;
  agentName: string;
  role: string;
  kind: MessageKind;
  content: string;
  round?: number;
}) {
  if (!input.conversationId || !input.content.trim()) return;
  const supabase = client();
  if (!supabase) return;
  void supabase
    .rpc("log_message", {
      p_conversation_id: input.conversationId,
      p_agent_id: input.agentId,
      p_agent_name: input.agentName,
      p_role: input.role,
      p_kind: input.kind,
      p_content: input.content,
      p_round: input.round ?? 1,
    })
    .then(({ error }) => {
      if (error) console.warn("[conversations] simpan kalimat gagal:", error.message);
    });
}

export function endConversation(conversationId: string | null, reason: string) {
  if (!conversationId) return;
  const supabase = client();
  if (!supabase) return;
  void supabase.rpc("end_conversation", { p_conversation_id: conversationId, p_reason: reason }).then(({ error }) => {
    if (error) console.warn("[conversations] tutup obrolan gagal:", error.message);
  });
}

export async function listConversations(limit = 50): Promise<ConversationSummary[]> {
  const supabase = client();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("list_conversations", { p_limit: limit });
  if (error || !Array.isArray(data)) return [];
  return (
    data as {
      id: string;
      kind: ConversationKind;
      topic: string;
      participant_ids: string[];
      started_at: string;
      ended_at: string | null;
      end_reason: string | null;
      message_count: number;
    }[]
  ).map((r) => ({
    id: r.id,
    kind: r.kind,
    topic: r.topic,
    participantIds: Array.isArray(r.participant_ids) ? r.participant_ids : [],
    startedAt: r.started_at,
    endedAt: r.ended_at,
    endReason: r.end_reason,
    messageCount: Number(r.message_count ?? 0),
  }));
}

export async function listMessages(conversationId: string, limit = 500): Promise<ConversationMessage[]> {
  const supabase = client();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("list_messages", {
    p_conversation_id: conversationId,
    p_limit: limit,
  });
  if (error || !Array.isArray(data)) return [];
  return (
    data as {
      id: number;
      agent_id: string | null;
      agent_name: string;
      role: string;
      kind: MessageKind;
      content: string;
      round: number;
      created_at: string;
    }[]
  ).map((r) => ({
    id: r.id,
    agentId: r.agent_id,
    agentName: r.agent_name,
    role: r.role,
    kind: r.kind,
    content: r.content,
    round: r.round,
    createdAt: r.created_at,
  }));
}
