"use client";

/**
 * Jabatan / role pilihan.
 *
 *  template  → ROLE_PRESETS di lib/office.ts (selalu ada, tanpa login)
 *  milik akun → tabel public.account_roles (RPC save_role / list_roles /
 *              delete_role) — hanya untuk pemilik yang login
 *
 * Daftar pilihan = gabungan keduanya, unik, urut abjad. Guest hanya melihat
 * template.
 */

import { useCallback, useEffect, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ROLE_PRESETS } from "./office";
import { authHeaders } from "./session";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

function client(): SupabaseClient | null {
  if (!SUPABASE_URL || !PUBLISHABLE) return null;
  return createClient(SUPABASE_URL, PUBLISHABLE, {
    global: { headers: authHeaders() },
    auth: { persistSession: false },
  });
}

export function mergeRoles(custom: string[]): string[] {
  const seen = new Set<string>();
  for (const role of [...ROLE_PRESETS, ...custom]) {
    const name = role.trim();
    if (name) seen.add(name);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/** roles of the signed-in owner; empty for a guest */
export async function loadRoles(): Promise<string[]> {
  const supabase = client();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("list_roles");
  if (error || !Array.isArray(data)) return [];
  return (data as { name: string }[]).map((r) => r.name);
}

export async function saveRole(name: string) {
  const supabase = client();
  if (!supabase) return { ok: false, error: "Supabase belum dikonfigurasi." };
  const { error } = await supabase.rpc("save_role", { p_name: name });
  return { ok: !error, error: error?.message };
}

export async function deleteRole(name: string) {
  const supabase = client();
  if (!supabase) return { ok: false };
  const { error } = await supabase.rpc("delete_role", { p_name: name });
  return { ok: !error, error: error?.message };
}

/** roles + a save that persists before it shows up in the list */
export function useRoleOptions(enabled: boolean) {
  const [custom, setCustom] = useState<string[]>([]);

  const reload = useCallback(async () => {
    if (!enabled) {
      setCustom([]);
      return;
    }
    setCustom(await loadRoles());
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const add = useCallback(
    async (name: string) => {
      const clean = name.trim();
      if (!clean) return { ok: false } as const;
      if (!enabled) {
        setCustom((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
        return { ok: true } as const;
      }
      const result = await saveRole(clean);
      if (result.ok) setCustom((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
      return result;
    },
    [enabled],
  );

  const remove = useCallback(
    async (name: string) => {
      const clean = name.trim();
      if (!clean) return { ok: false } as const;
      if (!enabled) {
        setCustom((prev) => prev.filter((r) => r !== clean));
        return { ok: true } as const;
      }
      const result = await deleteRole(clean);
      if (result.ok) setCustom((prev) => prev.filter((r) => r !== clean));
      return result;
    },
    [enabled],
  );

  return { roles: mergeRoles(custom), custom, add, remove, reload };
}
