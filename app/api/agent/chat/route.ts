import { NextResponse } from "next/server";
import { generateDemoReply, type DemoAgent } from "@/lib/demo-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatBody {
  agent?: {
    name: string;
    role: string;
    skills: string[];
    agentMd: string;
    apiBaseUrl: string;
    apiKey: string;
    model: string;
    demoMode: boolean;
  };
  history?: { speaker: string; content: string }[];
  topic?: string;
  round?: number;
  kind?: "meeting" | "chat" | "task";
  instruction?: string;
  partnerName?: string;
  test?: boolean;
}

function buildSystemPrompt(agent: NonNullable<ChatBody["agent"]>) {
  return `${agent.agentMd}

## AI Skills
${(agent.skills ?? []).map((s) => `- ${s}`).join("\n")}

## Aturan Output
Kamu adalah ${agent.name}, ${agent.role} di sebuah kantor teknologi.
- Selalu jawab dalam Bahasa Indonesia yang natural dan profesional.
- Maksimal 3 kalimat pendek agar bisa ditampilkan di balon percakapan.
- Tetap dalam peran; jangan mengaku sebagai asisten AI generik.
- Berikan pendapat teknis yang spesifik dan bisa dieksekusi.`;
}

async function callOpenAICompatible(
  agent: NonNullable<ChatBody["agent"]>,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  maxTokens = 260,
) {
  const baseUrl = agent.apiBaseUrl.trim().replace(/\/+$/, "");
  if (!baseUrl) throw new Error("API Base URL kosong.");
  if (!agent.model?.trim()) throw new Error("Nama model belum diisi.");

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${agent.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: agent.model.trim(),
      messages,
      temperature: 0.75,
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(25000),
    cache: "no-store",
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`API merespons ${res.status}. ${raw.slice(0, 200)}`);
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Respons API bukan JSON valid.");
  }

  const content = (data as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content;
  if (!content || !content.trim()) throw new Error("API mengembalikan respons kosong.");
  return content.trim();
}

export async function POST(request: Request) {
  let body: ChatBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body request tidak valid." }, { status: 400 });
  }

  const agent = body.agent;
  if (!agent) {
    return NextResponse.json({ ok: false, error: "Data agen tidak dikirim." }, { status: 400 });
  }

  const isDemo = !!agent.demoMode || !agent.apiKey?.trim();
  const demoAgent: DemoAgent = {
    name: agent.name,
    role: agent.role,
    skills: agent.skills ?? [],
    agentMd: agent.agentMd,
  };

  if (body.test) {
    if (isDemo) {
      await new Promise((r) => setTimeout(r, 700));
      return NextResponse.json({
        ok: true,
        simulated: true,
        message: "Mode demo aktif — koneksi disimulasikan dan siap dipakai.",
      });
    }
    try {
      await callOpenAICompatible(agent, [
        { role: "system", content: buildSystemPrompt(agent) },
        { role: "user", content: "Balas hanya dengan kata: siap" },
      ], 8);
      return NextResponse.json({ ok: true, simulated: false, message: "Koneksi API berhasil." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Koneksi gagal.";
      return NextResponse.json({ ok: false, simulated: false, error: message });
    }
  }

  if (isDemo) {
    await new Promise((r) => setTimeout(r, 450 + Math.random() * 650));
    const content = generateDemoReply({
      agent: demoAgent,
      topic: body.topic ?? "prioritas minggu ini",
      history: body.history ?? [],
      round: body.round ?? 1,
      kind: body.kind ?? "meeting",
      instruction: body.instruction,
      partner: body.partnerName
        ? { name: body.partnerName, role: "", skills: [] }
        : undefined,
    });
    return NextResponse.json({ ok: true, simulated: true, content });
  }

  try {
    const history = body.history ?? [];
    const historyText = history
      .slice(-10)
      .map((h) => `${h.speaker}: ${h.content}`)
      .join("\n");

    let instruction = "";
    if (body.kind === "meeting") {
      instruction = `Rapat dengan topik: "${body.topic}". Putaran ${body.round ?? 1}.\nTranskrip sejauh ini:\n${historyText || "(belum ada)"}\n\nTulis giliran bicaramu sebagai ${agent.name}. Beri pendapat teknis spesifik, boleh menanggapi peserta lain, maksimal 3 kalimat.`;
    } else if (body.kind === "chat") {
      instruction = `Kamu sedang ngobrol santai di pantry dengan ${body.partnerName ?? "rekan kerja"}. Transkrip:\n${historyText || "(belum ada)"}\n\nTulis satu balasan santai (maksimal 2 kalimat) tentang pekerjaan, kopi, bug, atau teknologi.`;
    } else {
      instruction = `Atasan memberi tugas: "${body.instruction ?? body.topic}". Transkrip:\n${historyText || "(belum ada)"}\n\nKonfirmasi tugas dengan rencana singkat, maksimal 2 kalimat.`;
    }

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: buildSystemPrompt(agent) },
    ];
    if (historyText) {
      messages.push({ role: "user", content: `Konteks transkrip:\n${historyText}` });
    }
    messages.push({ role: "user", content: instruction });

    const content = await callOpenAICompatible(agent, messages);
    return NextResponse.json({ ok: true, simulated: false, content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Permintaan API gagal.";
    return NextResponse.json({ ok: false, simulated: false, error: message });
  }
}
