"use client";

/**
 * Where one account's office lives. Picked on first login, changeable later.
 *
 *  hosted → our Supabase. We keep the login (Google) always, plus history,
 *           agents and the model key when the user asks us to.
 *  own    → the user's own Supabase. We keep ONLY the login row: partner
 *           credentials + encrypted service key + mode. History, agents and
 *           their model key all live in their project.
 *
 * NOTE: the mode column is not part of the sample schema in supabase/schema.sql
 * yet — add `storage_mode`, `partner_url`, `partner_key_secret` to `accounts`
 * before enabling the "own" path (see SETUP-ACCOUNT.md).
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// new dashboards label the public key "publishable key"; keep accepting both names
const anon =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export type StorageMode = "hosted" | "own";

export interface PartnerConfig {
  mode: StorageMode;
  /** user's own Supabase project URL, only for mode = "own" */
  url: string;
  /** which table recipe their project uses */
  schema: "kantor-orcai";
  connectedAt: number;
}

export const PARTNER_SCHEMA = "kantor-orcai";

export const partnerKey = (userId: string) => `kantor-orcai:partner:${userId}`;

/** stored locally only; never sent to our servers */
export function loadPartner(userId: string): PartnerConfig | null {
  try {
    const raw = localStorage.getItem(partnerKey(userId));
    return raw ? (JSON.parse(raw) as PartnerConfig) : null;
  } catch {
    return null;
  }
}

export function savePartner(userId: string, config: PartnerConfig | null) {
  try {
    if (config) localStorage.setItem(partnerKey(userId), JSON.stringify(config));
    else localStorage.removeItem(partnerKey(userId));
  } catch {
    /* quota — the UI still reflects the choice for this session */
  }
}

/** the anon key of the user's project, also kept on this device only */
export function savePartnerAnonKey(userId: string, anonKey: string) {
  try {
    localStorage.setItem(`kantor-orcai:partner-anon:${userId}`, anonKey);
  } catch {
    /* ignore */
  }
}

export function loadPartnerAnonKey(userId: string): string | null {
  try {
    return localStorage.getItem(`kantor-orcai:partner-anon:${userId}`);
  } catch {
    return null;
  }
}

export const accountsEnabled = Boolean(url && anon);
