import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Long-term office memory for the signed-in account.
 *
 *   GET    → { state } for the owner's row (null when empty)
 *   POST   → replace the owner's memory blob (last write wins, no merge server-side)
 *   DELETE → wipe it
 *
 * The browser swaps its store onto this endpoint after login, so every agent
 * keeps its lessons and history across devices — and the offline worker reads
 * the same blob.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";

function supabaseFor(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (!SUPABASE_URL || !ANON_KEY) return null;
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
}

export async function GET(request: Request) {
  const supabase = supabaseFor(request);
  if (!supabase) return NextResponse.json({ state: null });
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return NextResponse.json({ state: null }, { status: 401 });

  const { data } = await supabase.from("offices").select("data").eq("account_id", user.user.id).maybeSingle();
  return NextResponse.json({ state: data?.data ?? null });
}

export async function POST(request: Request) {
  const supabase = supabaseFor(request);
  if (!supabase) return NextResponse.json({ ok: false }, { status: 503 });
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await request.text();
  if (body.length > 2_000_000) {
    return NextResponse.json({ ok: false, error: "Memori terlalu besar." }, { status: 413 });
  }

  const { error } = await supabase
    .from("offices")
    .upsert({ account_id: user.user.id, data: JSON.parse(body) }, { onConflict: "account_id" });
  return NextResponse.json({ ok: !error, error: error?.message });
}

export async function DELETE(request: Request) {
  const supabase = supabaseFor(request);
  if (!supabase) return NextResponse.json({ ok: false }, { status: 503 });
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return NextResponse.json({ ok: false }, { status: 401 });

  const { error } = await supabase.from("offices").update({ data: {} }).eq("account_id", user.user.id);
  return NextResponse.json({ ok: !error });
}
