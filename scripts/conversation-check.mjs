// Jalankan: node scripts/conversation-check.mjs
// Verifikasi bahwa balasan AI untuk obrolan pantry ditafsirkan benar:
// AJAK → invite, DIAM → pass, [SELESAI] → leave, sisanya reply.
import assert from "node:assert/strict";

/** salinan aturan di app/api/agent/chat/route.ts — jaga keduanya sinkron */
function interpret(content, colleagues, agentName) {
  let action = "reply";
  const parsed = /^\s*AJAK\s*:\s*(.+)$/i.exec(content.split("\n")[0] ?? "");
  if (parsed) {
    const wanted = parsed[1].trim().toLowerCase();
    const target = colleagues.find((c) => c.name.toLowerCase() === wanted);
    if (target && target.name !== agentName) return { action: "invite", invite: target.name, content: "" };
    // mengajak diri sendiri = tidak sah, anggap diam
    return { action: "pass", content: "" };
  }
  if (/^\s*(DIAM|PASIF|TIDAK)\b/i.test(content)) return { action: "pass", content: "" };
  if (/^\s*(\[?(SELESAI|TUTUP|AKHIRI)\]?)\b/i.test(content) || /sudah selesai,?\s*(makasih|terima kasih)/i.test(content)) {
    action = "leave";
  }
  const text = content.replace(/^\s*\[?(SELESAI|TUTUP|AKHIRI)\]?\s*[-:—]?\s*/i, "").trim();
  if (!text) return { action: "pass", content: "" };
  return { action, content: text };
}

const peers = [
  { name: "Budi", role: "Backend" },
  { name: "Sari", role: "QA" },
];

assert.deepEqual(interpret("AJAK: Budi\nHai Bud, sudah makan?", peers, "Sari"), {
  action: "invite",
  invite: "Budi",
  content: "",
});
assert.equal(interpret("AJAK: Budi", peers, "Budi").action, "pass", "tidak boleh mengajak diri sendiri");
assert.deepEqual(interpret("DIAM", peers, "Sari"), { action: "pass", content: "" });
assert.deepEqual(interpret("[SELESAI] Makasih ya, balik kerja dulu.", peers, "Sari"), {
  action: "leave",
  content: "Makasih ya, balik kerja dulu.",
});
assert.deepEqual(interpret("Kopi di pantry makin enak.", peers, "Sari"), {
  action: "reply",
  content: "Kopi di pantry makin enak.",
});

console.log("ok — tafsir balasan obrolan (ajak / diam / selesai / jawab) sesuai");
