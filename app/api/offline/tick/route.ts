import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pickActivity, type OfficeActivity } from "../../../../lib/office-dynamics";

/**
 * Offline tick: keeps every opted-in office alive while its owner's tab is
 * closed. Called by pg_cron every 15 minutes.
 *
 * Storage follows the owner's choice, resolved per account from the database —
 * no per-user configuration in the environment:
 *  - hosted  → our `offices` row
 *  - own     → the project stored in `partner_links` for THAT user. Its anon key
 *              is encrypted with PARTNER_ENCRYPTION_KEY, decrypted only here,
 *              for the duration of one request.
 *
 * Cost guard rails: N accounts per tick, one REST round-trip each, zero model
 * calls unless the owner enabled AI with their own key.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const WORKER_KEY = process.env.OFFLINE_WORKER_KEY ?? "";
const PASSPHRASE = process.env.PARTNER_ENCRYPTION_KEY ?? "";

const MAX_ACCOUNTS_PER_TICK = 20;
const MAX_PARTNERS_PER_TICK = 20;

interface AgentSnapshot {
  id: string;
  name: string;
  activity: string;
  statusNote?: string | null;
  hasError?: boolean;
}

interface OfficeDoc {
  events?: { at: number; kind: string; text: string; agent?: string }[];
  settings?: { agents?: AgentSnapshot[] };
  [key: string]: unknown;
}

function nextActivity(agent: AgentSnapshot): OfficeActivity {
  // anti-repetition: re-roll once when the agent just did the same thing
  const first = pickActivity(Math.random());
  return first === agent.activity ? pickActivity(Math.random()) : first;
}

/** pure rule, shared by hosted and partner storage */
function tickOffice(doc: OfficeDoc, now = Date.now()): OfficeDoc {
  const agents = doc.settings?.agents ?? [];
  if (!agents.length) return doc;

  for (const agent of agents) {
    if (agent.hasError || agent.activity === "ERROR" || agent.activity === "MEETING") continue;
    agent.activity = nextActivity(agent);
    agent.statusNote = `Aktif offline (${agent.activity.toLowerCase()})`;
  }

  const events = [
    ...(doc.events ?? []).slice(-60),
    ...agents.slice(0, 3).map((agent) => ({
      at: now,
      kind: "info",
      text: `${agent.name} ${agent.activity.toLowerCase()} saat kamu offline.`,
      agent: agent.name,
    })),
  ];
  return { ...doc, events: events.slice(-100) };
}

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ ok: false, error: "Supabase belum dikonfigurasi." }, { status: 503 });
  }
  if (WORKER_KEY && request.headers.get("x-worker-key") !== WORKER_KEY) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ---- hosted accounts: our own row -------------------------------------
  const { data, error } = await admin
    .from("offices")
    .select("account_id, data")
    .limit(MAX_ACCOUNTS_PER_TICK);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // skip rows whose owner picked "own" — their office lives elsewhere
  const { data: ownRows } = await admin
    .from("accounts")
    .select("id")
    .eq("storage_mode", "own");
  const own = new Set((ownRows ?? []).map((r) => (r as { id: string }).id));

  let hosted = 0;
  for (const row of data ?? []) {
    if (own.has(row.account_id)) continue;
    const next = tickOffice((row.data ?? {}) as OfficeDoc);
    const { error: upErr } = await admin
      .from("offices")
      .update({ data: next, updated_at: new Date().toISOString() })
      .eq("account_id", row.account_id);
    if (!upErr) hosted += 1;
  }

  // ---- partner projects: one row per user, from the database ------------
  let partner = 0;
  if (PASSPHRASE) {
    const { data: links } = await admin
      .from("partner_links")
      .select("account_id, project_url, anon_key_enc")
      .limit(MAX_PARTNERS_PER_TICK);

    for (const link of links ?? []) {
      const row = link as { account_id: string; project_url: string; anon_key_enc: string };
      // decrypt through the service-role function (pgcrypto, passphrase from env)
      const { data: secret } = await admin.rpc("read_partner_secret", {
        p_account: row.account_id,
        p_passphrase: PASSPHRASE,
      });
      const creds = (secret as { project_url: string; anon_key: string }[] | null)?.[0];
      if (!creds?.anon_key) continue;

      const base = creds.project_url.replace(/\/+$/, "");
      const headers = {
        apikey: creds.anon_key,
        Authorization: `Bearer ${creds.anon_key}`,
        "Content-Type": "application/json",
      };

      try {
        const res = await fetch(`${base}/rest/v1/offices?select=data&account_id=eq.${row.account_id}&limit=1`, {
          headers,
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const rows = (await res.json()) as { data?: OfficeDoc }[];
          const doc = rows?.[0]?.data;
          if (doc) {
            const save = await fetch(`${base}/rest/v1/offices`, {
              method: "POST",
              headers: { ...headers, Prefer: "resolution=merge-duplicates" },
              body: JSON.stringify({ account_id: row.account_id, data: tickOffice(doc) }),
              signal: AbortSignal.timeout(8000),
            });
            if (save.ok) partner += 1;
            else await admin.from("partner_links").update({ last_error: `save ${save.status}` }).eq("account_id", row.account_id);
          }
        } else {
          await admin.from("partner_links").update({ last_error: `read ${res.status}` }).eq("account_id", row.account_id);
        }
        await admin.from("partner_links").update({ last_sync_at: new Date().toISOString() }).eq("account_id", row.account_id);
      } catch {
        // one partner project down must not stop the others
      }
    }
  }

  return NextResponse.json({ ok: true, hosted, partner });
}
