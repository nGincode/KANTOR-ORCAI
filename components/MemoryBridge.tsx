"use client";

/**
 * Picks the storage backend for the signed-in account, then makes the office's
 * shared memory store write there.
 *
 *  hosted → our API (/api/memory), Google login and history on our side
 *  own    → the user's own Supabase (anon key + RLS), we keep the login row only
 *
 * Anything missing (no env, no partner config) silently falls back to hosted so
 * the office always runs.
 */

import { useEffect } from "react";
import { useMemory, MEMORY_KEY, createRemoteMemory, bindMemory, memoryStore } from "@/lib/agent-memory";
import { useOffice } from "@/lib/store";
import { loadPartner, loadPartnerAnonKey, type StorageMode } from "@/lib/storage-mode";
import { partnerStorage, setPartnerAccount } from "@/lib/partner-storage";
import { authHeaders } from "@/lib/session";

export interface AccountInfo {
  id: string;
  email: string;
  name?: string;
  /** true only when the owner stored their own model key */
  offlineAi: boolean;
  storageMode: StorageMode;
  /** anon key is on file for this device (own mode only) */
  hasPartner?: boolean;
  /** the owner's model key so agents run live instead of demo */
  modelKey?: string;
  modelName?: string;
  /** provider base URL of that key */
  apiBaseUrl?: string;
  /** false until storage + model key were chosen in the wizard */
  setupComplete?: boolean;
}

function localMirror(value: string) {
  try {
    localStorage.setItem(MEMORY_KEY, value);
  } catch {
    /* quota — the remote copy still goes out */
  }
}

/** our server */
function hostedStorage() {
  return {
    getItem: async (_name: string) => {
      const res = await fetch("/api/memory", { cache: "no-store", headers: authHeaders() });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.state ? JSON.stringify({ state: data.state, version: 1 }) : null;
    },
    setItem: async (_name: string, value: string) => {
      localMirror(value);
      void fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: value,
        keepalive: true,
      }).catch(() => undefined);
    },
    removeItem: async (_name: string) => {
      void fetch("/api/memory", { method: "DELETE", headers: authHeaders() }).catch(() => undefined);
    },
  };
}

export function MemoryBridge({ account }: { account: AccountInfo | null }) {
  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    setPartnerAccount(account.id);

    // the browser always talks to the partner project with its own copy of the
    // anon key; the server copy (encrypted in partner_links) is for the worker
    const partner = account.storageMode === "own" ? loadPartner(account.id) : null;
    const partnerKey = account.storageMode === "own" ? loadPartnerAnonKey(account.id) : null;
    const usePartner = Boolean(partner?.url && partnerKey);

    const storage = usePartner
      ? partnerStorage({ url: partner!.url, anonKey: partnerKey! })
      : hostedStorage();

    const remote = createRemoteMemory({
      getItem: async (name) => {
        // local mirror first: an offline reload still shows the last office
        const cached = await Promise.resolve(localStorage.getItem(name));
        try {
          return (await storage.getItem(name)) ?? cached;
        } catch {
          return cached;
        }
      },
      setItem: async (name, value) => {
        localMirror(value);
        await storage.setItem(name, value);
      },
      removeItem: async (name) => {
        await storage.removeItem(name);
      },
    });

    void (async () => {
      await remote.persist.rehydrate();
      if (cancelled) return;

      const remoteState = remote.getState();
      const guest = useMemory.getState();
      const remoteEmpty = remoteState.events.length === 0 && remoteState.chats.length === 0;
      bindMemory(remote);

      // first login after using the app anonymously: carry the guest memory over
      if (remoteEmpty && guest.events.length > 0) {
        memoryStore().setState({
          events: guest.events,
          chats: guest.chats,
          profiles: guest.profiles,
          version: guest.version,
        });
      }
      memoryStore().getState().updateSettings({ storageMode: account.storageMode });

      let finished = false;
      try {
        finished = localStorage.getItem("kantor-orcai:setup-done") === "1";
      } catch {
        /* private mode */
      }

      useOffice.getState().setAccount({
        id: account.id,
        email: account.email,
        name: account.name,
        offlineAi: account.offlineAi,
        storageMode: account.storageMode,
        modelKey: account.modelKey,
        modelName: account.modelName,
        apiBaseUrl: account.apiBaseUrl,
        // needs a storage choice + a model key before the office may run demo-free
        setupComplete: finished || (Boolean(account.modelKey) && account.storageMode === "hosted"),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [account]);

  return null;
}
