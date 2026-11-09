import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Returns the caller's model key (decrypted) to their own browser, once per
 * login, so every agent can run on a real model instead of demo mode.
 *
 *  GET          → { key, model, baseUrl } or { key: null } when not configured
 *  POST { key, model, baseUrl } → store / replace the key in Vault
 *  DELETE       → forget the key (agents fall back to inline answers)
 *
 * The key is never logged, never returned to anyone but its owner, and never
 * written into the office document that the worker reads.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";

const DEFAULT_BASE = "https://api.openai.com/v1";

function userClient(request: Request) {
  if (!SUPABASE_URL || !ANON_KEY) return null;
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: request.headers.get("authorization") ?? "" } },
    auth: { persistSession: false },
  });
}

export async function GET(request: Request) {
  const supabase = userClient(request);
  if (!supabase) return NextResponse.json({ key: null });
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return NextResponse.json({ key: null }, { status: 401 });

  const { data: row } = await supabase
    .from("accounts")
    .select("model_key_secret, model_name, model_provider_url, offline_ai")
    .eq("id", user.user.id)
    .maybeSingle();

  const meta = row as { model_name?: string | null; model_provider_url?: string | null; offline_ai?: boolean } | null;
  const secretId = (row as { model_key_secret?: string | null } | null)?.model_key_secret;

  // 1) the owner reads their own key through a security-definer RPC — works
  //    without the service-role key, so the key is entered only once
  const { data: rpc, error: rpcError } = await supabase.rpc("read_model_key");
  const self = Array.isArray(rpc) ? (rpc[0] as Record<string, unknown> | undefined) : undefined;
  if (!rpcError && self?.model_key) {
    return NextResponse.json({
      key: self.model_key,
      model: (self.model_name as string | null) ?? meta?.model_name ?? null,
      baseUrl: (self.base_url as string | null) ?? meta?.model_provider_url ?? DEFAULT_BASE,
      offlineAi: Boolean(self.offline_ai),
    });
  }

  // 2) the RPC is not installed yet: fall back to a service-role Vault read
  if (secretId && SERVICE_KEY) {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: secret } = await admin
      .schema("vault" as never)
      .from("decrypted_secrets")
      .select("decrypted_secret")
      .eq("id", secretId)
      .maybeSingle();
    const key = (secret as { decrypted_secret?: string } | null)?.decrypted_secret ?? null;
    if (key) {
      return NextResponse.json({
        key,
        model: meta?.model_name ?? null,
        baseUrl: meta?.model_provider_url ?? DEFAULT_BASE,
      });
    }
  }

  // 3) no key at all vs unreachable: model name is still useful to pre-fill the form
  return NextResponse.json({
    key: null,
    model: meta?.model_name ?? null,
    needsReentry: Boolean(secretId),
    reason: rpcError?.message,
  });
}

export async function POST(request: Request) {
  const supabase = userClient(request);
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase belum dikonfigurasi." }, { status: 503 });

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    // the browser did not present our session token; say so precisely so the UI
    // can ask the user to sign in again instead of blaming the key
    return NextResponse.json(
      { ok: false, error: "Sesi login tidak terbaca. Muat ulang halaman lalu masuk lagi dengan Google." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { key?: string; model?: string; baseUrl?: string }
    | null;
  const key = (body?.key ?? "").trim();
  if (key.length < 16) {
    return NextResponse.json({ ok: false, error: "API key kelihatan tidak valid." }, { status: 400 });
  }
  const model = (body?.model ?? "").trim() || "gpt-4o-mini";
  const baseUrl = (body?.baseUrl ?? DEFAULT_BASE).trim().replace(/\/+$/, "");

  // 1) encrypted secret in Vault, referenced by the account row
  const { error: keyError } = await supabase.rpc("set_model_key", { p_key: key });
  if (keyError) return NextResponse.json({ ok: false, error: keyError.message }, { status: 400 });

  // 2) agent-level copy so the existing chat pipeline keeps working unchanged
  const { error } = await supabase
    .from("accounts")
    .update({
      model_name: model,
      model_provider_url: baseUrl,
      offline_ai: true,
    })
    .eq("id", user.user.id);

  // 3) per-agent settings live in the office document (encrypted at rest only in Vault)
  return NextResponse.json({ ok: !error, error: error?.message });
}

export async function DELETE(request: Request) {
  const supabase = userClient(request);
  if (!supabase) return NextResponse.json({ ok: false }, { status: 503 });
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return NextResponse.json({ ok: false }, { status: 401 });

  const { error } = await supabase
    .from("accounts")
    .update({ model_key_secret: null, offline_ai: false })
    .eq("id", user.user.id);
  return NextResponse.json({ ok: !error });
}
