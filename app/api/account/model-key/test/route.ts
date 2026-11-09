import { NextResponse } from "next/server";
import { parseCompletion } from "@/lib/chat-json";

/**
 * Verifies a model key with ONE tiny completion before it is accepted.
 *
 * The owner's key is only ever used for this single probe; it is not stored here.
 * A failed probe means no AI, so the onboarding wizard stays on this step.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  key?: string;
  baseUrl?: string;
  model?: string;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  const key = (body?.key ?? "").trim();
  const baseUrl = (body?.baseUrl ?? "").trim().replace(/\/+$/, "");
  const model = (body?.model ?? "").trim();

  if (!key || key.length < 16) {
    return NextResponse.json({ ok: false, error: "API key kosong atau terlalu pendek." }, { status: 400 });
  }
  if (!/^https?:\/\//i.test(baseUrl)) {
    return NextResponse.json({ ok: false, error: "Base URL harus diawali http:// atau https://" }, { status: 400 });
  }
  if (!model) {
    return NextResponse.json({ ok: false, error: "Nama model belum diisi." }, { status: 400 });
  }

  const started = Date.now();
  try {
    // 32 tokens: reasoning models spend a few on thinking and would otherwise
    // truncate to an empty completion (some providers then answer in SSE).
    const probe = (maxTokens: number, stream = false) =>
      fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "say ok" }],
          max_tokens: maxTokens,
          temperature: 0,
          stream,
        }),
        signal: AbortSignal.timeout(20000),
        cache: "no-store",
      });

    const res = await probe(32, false);
    const raw = await res.text();
    if (!res.ok) {
      // 401/403 = wrong key, 404 = wrong base URL or model, 429 = quota
      const hint =
        res.status === 401 || res.status === 403
          ? "Kunci ditolak oleh penyedia model."
          : res.status === 404
            ? "Base URL atau nama model tidak ditemukan."
            : res.status === 429
              ? "Kuota/rate limit penyedia model habis."
              : `Penyedia merespons ${res.status}.`;
      return NextResponse.json(
        { ok: false, error: `${hint} ${raw.slice(0, 160)}`, status: res.status, ms: Date.now() - started },
        { status: 200 },
      );
    }

    let parsed: ReturnType<typeof parseCompletion> | null = null;
    try {
      parsed = parseCompletion(raw);
    } catch {
      return NextResponse.json(
        { ok: false, error: `Balasan penyedia tidak dikenali: ${raw.slice(0, 120) || "(kosong)"}` },
        { status: 200 },
      );
    }
    if (!parsed?.choices?.length) {
      return NextResponse.json(
        { ok: false, error: "Penyedia membalas tanpa isi pilihan model. Cek nama model." },
        { status: 200 },
      );
    }

    return NextResponse.json({ ok: true, ms: Date.now() - started, model });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tidak bisa menghubungi penyedia model.";
    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  }
}
