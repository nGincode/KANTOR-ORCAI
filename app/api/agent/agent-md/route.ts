import { NextResponse } from "next/server";
import { parseCompletion } from "@/lib/chat-json";
import { generateAgentMd } from "@/lib/agent-md";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  name?: string;
  role?: string;
  skills?: string[];
  apiBaseUrl?: string;
  apiKey?: string;
  model?: string;
}

/** agent.md dari model terpilih; template lokal dipakai kalau AI belum tersambung/gagal */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body request tidak valid." }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const role = (body.role ?? "").trim();
  const skills = (body.skills ?? []).map((s) => s.trim()).filter(Boolean);
  const baseUrl = (body.apiBaseUrl ?? "").trim().replace(/\/+$/, "");
  const apiKey = (body.apiKey ?? "").trim();
  const model = (body.model ?? "").trim();
  const fallback = generateAgentMd({ name, role, skills });

  if (!name || !role) {
    return NextResponse.json({ ok: false, error: "Isi nama dan jabatan dulu.", source: "template", content: fallback });
  }
  if (!baseUrl || !model) {
    return NextResponse.json({ ok: true, source: "template", content: fallback });
  }

  const messages = [
    {
      role: "system",
      content:
        "Kamu penulis dokumen SDM untuk kantor AI. Balas HANYA markdown, tanpa penjelasan pembuka/penutup.",
    },
    {
      role: "user",
      content: `Tulis file agent.md untuk pegawai AI berikut.

Nama: ${name}
Jabatan: ${role}
Skills: ${skills.join(", ") || "(belum diisi, tentukan sendiri yang paling relevan)"}

Format wajib, urutan heading persis seperti ini:
# agent.md — ${name}

## Peran
## Kepribadian
## Gaya Bicara Saat Rapat
## SOP Kerja
## Batasan Peran
## AI Skills

Aturan: masing-masing 2–4 poin pendek Bahasa Indonesia, spesifik ke jabatan ${role}, praktis dan bisa dieksekusi. Jangan mengarang nama orang lain.`,
    },
  ];

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 900 }),
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`API merespons ${res.status}. ${raw.slice(0, 160)}`);
    const data = parseCompletion(raw) as {
      choices?: { message?: { content?: string; reasoning?: string } }[];
    };
    const msg = data.choices?.[0]?.message;
    const content = (msg?.content || msg?.reasoning || "").trim();
    if (!content) throw new Error("Model mengembalikan teks kosong.");
    return NextResponse.json({ ok: true, source: "ai", content });
  } catch (error) {
    return NextResponse.json({
      ok: true,
      source: "template",
      content: fallback,
      warning: error instanceof Error ? error.message : "Generate AI gagal.",
    });
  }
}
