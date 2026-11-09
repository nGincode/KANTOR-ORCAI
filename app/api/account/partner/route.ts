import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Registers / removes the caller's own Supabase project ("own storage").
 *
 * One row per user in public.partner_links — never a global env var, never a
 * shared project. The anon key is encrypted in Postgres with
 * PARTNER_ENCRYPTION_KEY (server-side only), so a database dump alone cannot
 * reach anyone's project.
 *
 *   POST   { url, anonKey } → save / replace the link
 *   DELETE                  → unlink, back to hosted storage
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";
const PASSPHRASE = process.env.PARTNER_ENCRYPTION_KEY ?? "";

const PROJECT_URL = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i;

function clientFor(request: Request) {
  if (!SUPABASE_URL || !ANON_KEY) return null;
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: request.headers.get("authorization") ?? "" } },
    auth: { persistSession: false },
  });
}

export async function POST(request: Request) {
  const supabase = clientFor(request);
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase belum dikonfigurasi." }, { status: 503 });
  if (!PASSPHRASE) {
    return NextResponse.json(
      { ok: false, error: "PARTNER_ENCRYPTION_KEY belum diisi di server." },
      { status: 503 },
    );
  }

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return NextResponse.json({ ok: false, error: "Belum login." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { url?: string; anonKey?: string } | null;
  const url = (body?.url ?? "").trim().replace(/\/+$/, "");
  const anonKey = (body?.anonKey ?? "").trim();

  if (!PROJECT_URL.test(url)) {
    return NextResponse.json({ ok: false, error: "URL proyek tidak valid." }, { status: 400 });
  }
  // a JWT-ish string; we do not need to verify it, RLS on their side does
  if (anonKey.length < 40) {
    return NextResponse.json({ ok: false, error: "Anon key kelihatan tidak valid." }, { status: 400 });
  }

  // reachable + the offices table exists before we store anything
  try {
    const probe = await fetch(`${url}/rest/v1/offices?select=account_id&limit=1`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!probe.ok) {
      const hint = probe.status === 404 ? "Tabel `offices` belum ada di proyekmu." : `Proyek merespons ${probe.status}.`;
      return NextResponse.json({ ok: false, error: hint }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Tidak bisa menghubungi proyek Supabase kamu." }, { status: 400 });
  }

  const { error } = await supabase.rpc("save_partner", {
    p_url: url,
    p_anon_key: anonKey,
    p_passphrase: PASSPHRASE,
  });
  return NextResponse.json({ ok: !error, error: error?.message });
}

export async function DELETE(request: Request) {
  const supabase = clientFor(request);
  if (!supabase) return NextResponse.json({ ok: false }, { status: 503 });

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return NextResponse.json({ ok: false }, { status: 401 });

  await supabase.from("partner_links").delete().eq("account_id", user.user.id);
  const { error } = await supabase.from("accounts").update({ storage_mode: "hosted" }).eq("id", user.user.id);
  return NextResponse.json({ ok: !error });
}
