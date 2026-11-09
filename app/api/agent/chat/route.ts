import { NextResponse } from "next/server";
import { parseCompletion } from "@/lib/chat-json";
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
  project?: string;
  leaderName?: string;
  /** rekan satu kantor, supaya AI tahu siapa saja yang bisa diajak ngobrol */
  colleagues?: { name: string; role: string }[];
  /** signed in: demo answers are not allowed, a missing key is an error */
  live?: boolean;
  test?: boolean;
}

function buildSystemPrompt(
  agent: NonNullable<ChatBody["agent"]>,
  colleagues?: { name: string; role: string }[],
  project?: string,
) {
  const roster = (colleagues ?? [])
    .filter((c) => c.name.trim() && c.name !== agent.name)
    .map((c) => `- ${c.name} (${c.role})`)
    .join("\n");
  const peers = roster
    ? `\n\n## Rekan Satu Kantor\nKamu tahu siapa saja yang bekerja di kantor ini:\n${roster}\nSebut nama mereka saat relevan. Jangan mengarang pegawai di luar daftar ini.`
    : "";
  const projSection = project ? `\n\n## Project Kantor Saat Ini\nProject utama: "${project}". Hubungkan diskusi dan pekerjaan dengan konteks project ini.` : "";
  return `${agent.agentMd}\n\n## AI Skills\n${(agent.skills ?? []).map((s) => `- ${s}`).join("\n")}${peers}${projSection}

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
    data = parseCompletion(raw);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Respons API tidak dikenali.");
  }

  const message = (data as { choices?: { message?: { content?: string; reasoning?: string } }[] })?.choices?.[0]
    ?.message;
  // reasoning models may put everything in `reasoning` and leave content empty
  const content = (message?.content || message?.reasoning || "").trim();
  if (!content) throw new Error("API mengembalikan respons kosong.");
  return content;
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
    if (isDemo && body.live) {
      return NextResponse.json({
        ok: false,
        simulated: false,
        error: "API key belum dipasang untuk pegawai ini.",
      });
    }
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
    // a signed-in owner asked for real AI: refuse instead of faking an answer
    if (body.live) {
      return NextResponse.json(
        { ok: false, simulated: false, error: `API key ${agent.name} belum dipasang.` },
        { status: 400 },
      );
    }
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
    if (body.kind === "chat") {
      const actionRule = body.partnerName
        ? `Kamu sudah duduk berdua. Balas ucapan ${body.partnerName} (maksimal 2 kalimat). Kalau percakapan sudah tuntas dan wajar untuk berhenti, mulai balasanmu dengan [SELESAI].`
        : `Pilih SATU aksi sebelum bicara. Baris pertama WAJIB salah satu dari:
- AJAK: <nama rekan>   → kamu yang memulai percakapan dengan rekan itu
- DIAM                  → belum mau bicara
- MULAI                 → kamu mulai bicara dengan rekan di dekatmu
Baris berikutnya (kecuali DIAM) adalah kalimat pertamamu, maksimal 2 kalimat. Topik BEBAS: pekerjaan, kopi, makanan, film, olahraga, hobi, cuaca, cerita lucu — apa saja yang wajar dibicarakan teman kantor.`;
      const colleagueList = (body.colleagues ?? [])
        .filter((c) => c.name !== agent.name)
        .map((c) => `- ${c.name} (${c.role})`)
        .join("\n");
      instruction = `Kamu sedang mengobrol santai bersama rekan di kantor (${body.topic || "santai"}). Transkrip:\n${historyText || "(belum ada)"}\n\n${actionRule}\n\nRekan yang bisa diajak:\n${colleagueList || "(tidak ada)"}`;
    } else if (body.kind === "meeting") {
      const isLeader = Boolean(body.leaderName && agent.name.toLowerCase().includes(body.leaderName.toLowerCase()));
      if (isLeader) {
        instruction = `Kamu PEMIMPIN RAPAT untuk topik: "${body.topic}".\nProject: "${body.project || "SaaS Kantor"}".\nTranskrip sejauh ini:\n${historyText || "(belum ada)"}\n\nTugasmu: Pimpin diskusi. Jika solusi/keputusan sudah tercapai atau semua peserta sudah berkontribusi, tutup rapat dengan kesimpulan tegas dan akhiri dengan kata [SELESAI]. Jika belum, ajukan pertanyaan atau arahkan peserta lain. Maksimal 3 kalimat Bahasa Indonesia.`;
      } else {
        instruction = `Rapat topik: "${body.topic}" (Project: "${body.project || "SaaS Kantor"}"), dipimpin oleh ${body.leaderName || "Leader"}.\nTranskrip sejauh ini:\n${historyText || "(belum ada)"}\n\nTulis giliran bicaramu sebagai ${agent.name} (${agent.role}). Berikan opini atau solusi teknis spesifik, tanggapi rekan lain secara konstruktif. Maksimal 3 kalimat Bahasa Indonesia.`;
      }
    } else if (/KODE\|kalimat/i.test(body.instruction ?? "")) {
      // mode hidup otomatis: jawab "KODE|kalimat" — kode menentukan aksi,
      // kalimatnya jadi balon percakapan
      instruction = `${body.instruction}\nBalas TEPAT satu baris dengan format KODE|kalimat, tanpa penjelasan tambahan. Kalimatnya wajib ada.`;
    } else {
      instruction = `Atasan memberi tugas: "${body.instruction ?? body.topic}". Transkrip:\n${historyText || "(belum ada)"}\n\nKonfirmasi tugas dengan rencana singkat, maksimal 2 kalimat.`;
    }

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: buildSystemPrompt(agent, body.colleagues, body.project) },
    ];
    if (historyText) {
      messages.push({ role: "user", content: `Konteks transkrip:\n${historyText}` });
    }
    messages.push({ role: "user", content: instruction });

    let content = (await callOpenAICompatible(agent, messages)).trim();

    // obrolan pantry: model boleh memilih diam atau mengajak rekan lain bicara
    let action: "reply" | "leave" = "reply";
    if (body.kind === "chat" && !body.partnerName) {
      const parsed = /^\s*AJAK\s*:\s*(.+)$/i.exec(content.split("\n")[0] ?? "");
      if (parsed) {
        const wanted = parsed[1].trim().toLowerCase();
        const target = (body.colleagues ?? []).find((c) => c.name.toLowerCase() === wanted);
        if (target && target.name !== agent.name) {
          return NextResponse.json({ ok: true, simulated: false, action: "invite", invite: target.name, content: "" });
        }
        // mengajak diri sendiri = tidak sah, perlakukan sebagai diam
        return NextResponse.json({ ok: true, simulated: false, action: "pass", content: "" });
      }
      if (/^\s*(DIAM|PASIF|TIDAK)\b/i.test(content)) {
        return NextResponse.json({ ok: true, simulated: false, action: "pass", content: "" });
      }
    }
    if (/^\s*(\[?(SELESAI|TUTUP|AKHIRI)\]?)\b/i.test(content) || /sudah selesai,?\s*(makasih|terima kasih)/i.test(content)) {
      action = "leave";
    }
    content = content.replace(/^\s*\[?(SELESAI|TUTUP|AKHIRI)\]?\s*[-:—]?\s*/i, "").trim();
    if (!content) {
      return NextResponse.json({ ok: true, simulated: false, action: "pass", content: "" });
    }
    return NextResponse.json({ ok: true, simulated: false, action, content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Permintaan API gagal.";
    return NextResponse.json({ ok: false, simulated: false, error: message });
  }
}
