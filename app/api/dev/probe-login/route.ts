import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Creates (or reuses) a throwaway account so the auth + storage flow can be
 * tested end-to-end without a Google consent screen.
 *
 * Only mounted when SUPABASE_SERVICE_ROLE_KEY exists, and only issues a session
 * for an address under @example.com — it can never touch a real user.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";

export async function POST() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY belum diisi." }, { status: 503 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const email = "probe-office@example.com";
  const password = "Probe!2345-" + Math.random().toString(36).slice(2, 8);

  // find or create the probe user
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let user = list.data.users.find((u) => u.email === email);
  if (user) {
    await admin.auth.admin.updateUserById(user.id, { password });
  } else {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) {
      return NextResponse.json({ ok: false, error: created.error.message }, { status: 500 });
    }
    user = created.data.user!;
  }

  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    email,
    session: {
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
      expires_at: data.session?.expires_at,
    },
    userId: user.id,
  });
}
