import { NextResponse } from "next/server";
import { parseCompletion } from "@/lib/chat-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEMO_MODELS = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4.1-mini",
  "claude-3.5-sonnet",
  "llama-3.3-70b-versatile",
  "qwen-2.5-72b-instruct",
  "mistral-large-latest",
  "deepseek-chat",
  "gemini-2.0-flash",
];

export async function POST(request: Request) {
  let body: { baseUrl?: string; apiKey?: string; demoMode?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body request tidak valid." }, { status: 400 });
  }

  const baseUrl = (body.baseUrl ?? "").trim().replace(/\/+$/, "");
  const apiKey = (body.apiKey ?? "").trim();

  if (body.demoMode || !apiKey || !baseUrl) {
    // a signed-in owner never picks from a fake list
    return NextResponse.json({ ok: true, simulated: true, models: DEMO_MODELS });
  }

  try {
    const res = await fetch(`${baseUrl}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });

    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        error: `Endpoint models merespons ${res.status}. ${text.slice(0, 220)}`,
      });
    }

    let parsed: unknown;
    try {
      // some gateways answer /models in SSE too
      parsed = parseCompletion(text);
    } catch {
      return NextResponse.json({ ok: false, error: "Respons models bukan JSON yang valid." });
    }

    const list = (parsed as { data?: unknown[] })?.data;
    if (!Array.isArray(list)) {
      return NextResponse.json({ ok: false, error: "Format respons tidak memiliki array data." });
    }

    const models = list
      .map((item) => {
        if (typeof item === "string") return item;
        const obj = item as { id?: string; name?: string };
        return obj.id ?? obj.name ?? "";
      })
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ ok: true, simulated: false, models });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menghubungi endpoint models.";
    return NextResponse.json({ ok: false, error: message });
  }
}
