"use client";

/**
 * Switch between the two storage backends.
 *
 *  hosted → our API (/api/memory)
 *  own    → the user's Supabase project, called straight from their browser with
 *           their own anon key (RLS restricts each row to auth.uid()). Their
 *           project needs the same `offices` table as supabase/schema.sql.
 *
 * Returns a StateStorage-compatible adapter for the memory store.
 *
 * Works with both key formats: classic `anon` JWT and the newer `sb_publishable_*`.
 */

export interface PartnerTarget {
  url: string;
  anonKey: string;
}

const TABLE = "offices";
const COL = "data";

export function partnerStorage(target: PartnerTarget) {
  const base = target.url.replace(/\/+$/, "");
  const headers = {
    apikey: target.anonKey,
    Authorization: `Bearer ${target.anonKey}`,
    "Content-Type": "application/json",
  };

  /** reads the owner's row; RLS returns only rows this session may see */
  const getItem = async () => {
    try {
      const res = await fetch(`${base}/rest/v1/${TABLE}?select=${COL}&limit=1`, {
        headers,
        cache: "no-store",
      });
      if (!res.ok) return null;
      const rows = (await res.json()) as { data?: unknown }[];
      const state = rows?.[0]?.data;
      return state ? JSON.stringify({ state, version: 1 }) : null;
    } catch {
      return null;
    }
  };

  const setItem = async (_name: string, value: string) => {
    try {
      const parsed = JSON.parse(value) as { state?: unknown };
      // upsert keyed on the owner's account id; the table must have a unique key
      await fetch(`${base}/rest/v1/${TABLE}`, {
        method: "POST",
        headers: { ...headers, Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ account_id: currentAccountId(), [COL]: parsed.state ?? {} }),
        keepalive: true,
      });
    } catch {
      /* the UI never waits on a save */
    }
  };

  const removeItem = async () => {
    try {
      await fetch(`${base}/rest/v1/${TABLE}?account_id=eq.${encodeURIComponent(currentAccountId())}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ [COL]: {} }),
      });
    } catch {
      /* ignore */
    }
  };

  return { getItem, setItem, removeItem };
}

/** filled by MemoryBridge once the account is known */
let accountId: string | null = null;
export function setPartnerAccount(id: string | null) {
  accountId = id;
}
function currentAccountId() {
  return accountId ?? "unknown";
}
