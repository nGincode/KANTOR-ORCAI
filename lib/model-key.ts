"use client";

/**
 * Model key for a signed-in owner: every agent then runs on a real model.
 *
 *  GET  → { key, model, baseUrl }  (null key = not configured yet)
 *  POST → { key, model, baseUrl }
 *  DELETE
 */

import { authHeaders } from "./session";

const ENDPOINT = "/api/account/model-key";

export interface ModelConfig {
  key: string | null;
  model?: string | null;
  baseUrl?: string | null;
  needsReentry?: boolean;
  offlineAi?: boolean;
}

export async function fetchModelKey(): Promise<ModelConfig> {
  try {
    const res = await fetch(ENDPOINT, { cache: "no-store", headers: authHeaders() });
    if (!res.ok) return { key: null };
    return (await res.json()) as ModelConfig;
  } catch {
    return { key: null };
  }
}

/** one tiny real completion; nothing is stored until this returns ok */
export async function testModelKey(input: { key: string; model: string; baseUrl: string }) {
  const res = await fetch(`${ENDPOINT}/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  return (await res.json().catch(() => ({ ok: false, error: "Respons server tidak valid." }))) as {
    ok?: boolean;
    error?: string;
    ms?: number;
  };
}

export async function saveModelKey(input: { key: string; model: string; baseUrl: string }) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  return (await res.json().catch(() => ({ ok: false, error: "Respons server tidak valid." }))) as {
    ok?: boolean;
    error?: string;
  };
}

export async function clearModelKey() {
  await fetch(ENDPOINT, { method: "DELETE", headers: authHeaders() }).catch(() => undefined);
}

/** state keys that make every agent stop pretending */
export const LIVE_AGENT_DEFAULTS = {
  demoMode: false,
} as const;
