// Jalankan: node scripts/self-check.mjs
// Verifikasi kecil bahwa aturan kantor bersama dan batas memori tidak melenceng.
import assert from "node:assert/strict";

const { pickActivity, ACTIVITY_ROLL, OFFICE_ACTIVITIES, walkDuration } = await import("../lib/office-dynamics.ts");

const total = ACTIVITY_ROLL.reduce((s, [, w]) => s + w, 0);
assert.ok(Math.abs(total - 1) < 0.02, `bobot aktivitas harus ~1, dapat ${total}`);

for (const r of [0, 0.1, 0.5, 0.99]) {
  assert.ok(OFFICE_ACTIVITIES.includes(pickActivity(r)), `roll ${r} harus mengembalikan kode valid`);
}
assert.equal(walkDuration(0, 0, 0, 0), 0.45, "durasi jalan minimum 0.45 s");
assert.equal(walkDuration(0, 0, 100, 0), 7, "durasi jalan maksimum 7 s");

const mem = await import("../lib/agent-memory.ts");
const LIM = mem.LIMITS;
assert.ok(LIM.events <= 300 && LIM.chats <= 120 && LIM.lessons <= 12, "batas memori tidak boleh naik diam-diam");

// payload terburuk harus tetap jauh di bawah budget browser (~5 MB)
const worst = {
  events: Array.from({ length: LIM.events }, () => ({ at: 1, kind: "info", text: "x".repeat(160) })),
  chats: Array.from({ length: LIM.chats }, () => ({ at: 1, from: "a", name: "A", kind: "chat", text: "x".repeat(240) })),
};
const bytes = JSON.stringify(worst).length;
assert.ok(bytes < 200_000, `memori terburuk ${bytes} byte, seharusnya < 200 KB`);

console.log(`ok — aktivitas, durasi jalan, dan memori (${bytes} byte maksimum) sesuai`);
