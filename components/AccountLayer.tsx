"use client";

/**
 * Optional account layer. The app is fully usable as a guest (localStorage).
 * Once NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY are set, Google sign-in appears in
 * the header and memory moves to the account (see MemoryBridge).
 *
 * The auth client is created lazily so the bundle stays small for guests.
 */

import { useEffect, useState } from "react";
import { useOffice } from "@/lib/store";
import { MemoryBridge, type AccountInfo } from "./MemoryBridge";
import { loadPartner } from "@/lib/storage-mode";
import { fetchModelKey } from "@/lib/model-key";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const accountsEnabled = Boolean(url && anon);

type SupabaseLike = {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null } }>;
    onAuthStateChange: (cb: (event: string) => void) => { data: { subscription: { unsubscribe: () => void } } };
    signInWithOAuth: (args: { provider: string; options: { redirectTo: string } }) => Promise<unknown>;
    signOut: () => Promise<unknown>;
  };
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, value: string) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null }> };
    };
  };
};

let client: SupabaseLike | null = null;
function supabase(): SupabaseLike {
  if (client) return client;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createClient } = require("@supabase/supabase-js");
  client = createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client as SupabaseLike;
}

export async function signInWithGoogle() {
  useOffice.getState().setAuthBusy(true);
  try {
    await supabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  } finally {
    // a full page redirect happens; this only matters if the browser blocks it
    useOffice.getState().setAuthBusy(false);
  }
}

/**
 * Signs out in place — the office switches back to the guest demo without a
 * page reload. resetAccount() clears the account roster + wizard flags; the
 * Supabase SDK also fires onAuthStateChange, which re-runs the same path.
 */
export async function signOut() {
  useOffice.getState().setAuthBusy(true);
  await supabase().auth.signOut().catch(() => undefined);
  try {
    // the wizard must run again for the next person on this device
    localStorage.removeItem("kantor-orcai:setup-done");
  } catch {
    /* private mode */
  }
  client = null; // drop the cached session-aware client
  useOffice.getState().resetAccount();
  useOffice.getState().setAuthBusy(false);
}

function toAccount(
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> },
  offlineAi: boolean,
  storageMode?: unknown,
  model?: { key: string | null; model?: string | null; baseUrl?: string | null },
): AccountInfo {
  return {
    id: user.id,
    email: user.email ?? "",
    name: (user.user_metadata?.full_name as string) ?? (user.user_metadata?.name as string) ?? undefined,
    offlineAi,
    // the database is the source of truth; the device cache is only a fallback
    storageMode:
      storageMode === "own" || storageMode === "hosted"
        ? storageMode
        : "hosted",
    hasPartner: storageMode === "own" || Boolean(loadPartner(user.id)?.url),
    modelKey: model?.key ?? undefined,
    modelName: model?.model ?? undefined,
    apiBaseUrl: model?.baseUrl ?? undefined,
  };
}

function AccountGate() {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [ready, setReady] = useState(!accountsEnabled);
  /** true once a real session was found in this tab — lets a sign-out land instantly */
  const [wasSignedIn, setWasSignedIn] = useState(false);

  useEffect(() => {
    if (!accountsEnabled) return;
    const sb = supabase();

    const load = async () => {
      useOffice.getState().setAuthBusy(true);
      const { data } = await sb.auth.getUser();
      const user = data.user;
      if (!user) {
        setAccount(null);
        setReady(true);
        // a signed-in tab that lost its session: switch to the guest office now
        if (wasSignedIn) useOffice.getState().resetAccount();
        useOffice.getState().setAuthBusy(false);
        return;
      }
      setWasSignedIn(true);
      // offline AI only unlocks when the owner stored a model key
      const { data: row } = await sb
        .from("accounts")
        .select("offline_ai, model_key_secret, storage_mode")
        .eq("id", user.id)
        .maybeSingle();
      // fetch the key once per login; without it every agent must still leave demo
      // mode, but the UI shows a "pasang API key" hint
      const model = await fetchModelKey().catch(() => ({ key: null }));
      setAccount(toAccount(user, Boolean(row?.offline_ai && row?.model_key_secret), row?.storage_mode, model));
      setReady(true);
      useOffice.getState().setAuthBusy(false);
    };

    void load();
    const { data } = sb.auth.onAuthStateChange((event) => {
      // SIGNED_OUT reaches here before signOut() returns: no reload needed
      if (event === "SIGNED_OUT") useOffice.getState().resetAccount();
      void load();
    });
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return null;
  return <MemoryBridge account={account} />;
}

export function AccountLayer() {
  if (!accountsEnabled) return null;
  return <AccountGate />;
}
