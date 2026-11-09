export interface DemoAgent {
  name: string;
  role: string;
  skills: string[];
  agentMd?: string;
}

export interface DemoContext {
  agent: DemoAgent;
  topic: string;
  history: { speaker: string; content: string }[];
  round: number;
  kind: "meeting" | "chat" | "task";
  instruction?: string;
  partner?: DemoAgent;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function stripMd(md: string | undefined) {
  if (!md) return "";
  return md.replace(/[#>*`-]/g, " ").replace(/\s+/g, " ").trim();
}

function personaLine(agent: DemoAgent) {
  const md = stripMd(agent.agentMd);
  if (!md) return "";
  const keywords = ["tenang", "praktis", "kreatif", "analitis", "skeptis", "teliti", "strategic", "perfeksionis"];
  const found = keywords.find((k) => md.toLowerCase().includes(k));
  return found ? found : "";
}

function category(role: string) {
  const r = role.toLowerCase();
  if (/(lead|architect|manager|principal|head)/.test(r)) return "lead";
  if (/(qa|quality|test)/.test(r)) return "qa";
  if (/(database|data|dba|sql)/.test(r)) return "db";
  if (/(devops|sre|infra|platform|cloud)/.test(r)) return "devops";
  if (/(frontend|front-end|ui|react|web)/.test(r)) return "frontend";
  if (/(backend|back-end|api|server|node)/.test(r)) return "backend";
  if (/(design|ux|product)/.test(r)) return "design";
  if (/(ai|ml|machine)/.test(r)) return "ai";
  return "general";
}

function topSkill(agent: DemoAgent) {
  return agent.skills[0] ?? "engineering";
}

function topicHint(topic: string) {
  const t = topic.toLowerCase();
  if (/(real-?time|realtime|streaming)/.test(t)) return "latensi dan backpressure";
  if (/(dashboard|analitik|analytic)/.test(t)) return "agregasi metrik dan biaya query";
  if (/(pembayaran|payment|checkout|transaksi)/.test(t)) return "idempotensi transaksi";
  if (/(keamanan|security|auth|login)/.test(t)) return "model ancaman dan rotasi token";
  if (/(mobile|aplikasi)/.test(t)) return "ukuran bundle dan performa perangkat rendah";
  if (/(ai|llm|agent|model)/.test(t)) return "biaya token dan evaluasi kualitas";
  return "skalabilitas dan maintainability";
}

export function generateDemoReply(ctx: DemoContext): string {
  const { agent, topic, history, round, kind } = ctx;
  const prev = history.length ? history[history.length - 1].speaker : "tim";
  const skill = topSkill(agent);
  const skill2 = agent.skills[1] ?? skill;
  const hint = topicHint(topic);
  const cat = category(agent.role);
  const tone = personaLine(agent);
  const seed = topic.slice(0, 96);

  if (/KODE\|kalimat/i.test(ctx.instruction ?? "")) {
    const code = pick([
      "WORK", "TV", "DRINK", "COOK", "PRAY", "TOILET",
      "SOFA", "SLEEP", "CHAT", "DRIVE", "PINGPONG", "RELAX",
    ]);
    const lines: Record<string, string[]> = {
      WORK: [
        `Lanjut nulis test untuk ${skill}.`,
        `Beresin bug di modul ${skill2}.`,
        `Review PR terbaru bagian ${skill}.`,
        `Refactor endpoint ${skill} biar rapi.`,
        `Dokumentasiin API ${skill2} dulu.`,
      ],
      TV: ["Otak butuh jeda, nonton TV dulu.", "Lounge dulu sebentar.", "Nonton berita tech bentar."],
      DRINK: ["Kopi dulu biar fokus.", "Haus, ambil minum sebentar.", "Teh hangat satu ya."],
      COOK: ["Mau masak cepat buat bekal.", "Perut bunyi, ke pantry dulu.", "Bikin indomie dulu ah."],
      PRAY: ["Waktunya sholat dulu.", "Istirahat sebentar, sholat.", "Sholat dulu ya."],
      TOILET: ["Permisi ke toilet sebentar.", "Badan minta jeda, ke toilet.", "BRB toilet."],
      SOFA: ["Duduk santai dulu di sofa.", "Rebahan sebentar, pegal.", "Istirahat mata sebentar."],
      SLEEP: ["Ngantuk berat, tidur sebentar.", "Power nap 15 menit.", "Mata udah berat, tidur dulu."],
      CHAT: ["Mau ngobrol santai dulu.", "Eh, ngobrol yuk.", "Cari teman curhat bentar."],
      DRIVE: ["Keliling sebentar naik mobil.", "Butuh udara segar.", "Parkir mobil dulu."],
      PINGPONG: ["Main pingpong dulu yuk.", "Regangkan badan dulu.", "Siapa mau tanding pingpong?"],
      RELAX: ["Santai di kafe Lantai 3.", "Kopi dan duduk santai.", "Ngopi dulu di atas."],
    };
    return `${code}|${pick(lines[code] ?? ["Jalan-jalan sebentar."])}`;
  }

  if (kind === "task") {
    return pick([
      `Siap, saya mulai sekarang: ${ctx.instruction ?? "tugas baru"}. Saya akan pakai ${skill} dan ${skill2}, lalu kirim ringkasan hasil plus catatan risiko ke transkrip tim.`,
      `Baik, tugas diterima. Rencana saya: definisikan kriteria selesai, kerjakan inti dengan ${skill}, lalu verifikasi memakai ${skill2}. Saya kabari begitu ada hasil pertama.`,
      `Oke, saya ambil tugas ini. Saya batasi scope dulu supaya cepat selesai, dan saya tandai bagian yang butuh review ${agent.role === "QA Engineer" ? "Tech Lead" : "QA"}.`,
    ]);
  }

  if (kind === "chat") {
    const partner = ctx.partner?.name.split(" ")[0] ?? "kamu";
    return pick([
      `Eh ${partner}, tadi aku lihat latensi ${skill} naik tipis. Menurutku bukan masalah besar, tapi mending kita pantau sebelum demo.`,
      `Kopinya habis lagi ya? 😅 Btw soal ${skill}, aku baru baca trik optimasi yang lumayan masuk akal. Nanti aku share linknya.`,
      `${partner}, kamu sudah review bagian ${skill2} belum? Aku penasaran sama edge case yang tadi muncul di log.`,
      `Aku baru sadar test ${skill} kita belum menutup skenario gagal. Santai dulu, tapi besok pagi kita rapikan, ya.`,
      `Kalau soal ${hint}, jujur aku lebih tenang kalau kita ukur dulu sebelum ubah arsitektur. Kamu setuju?`,
      `Tadi ada error kecil di staging, sudah aku bersihkan. Sekarang aku butuh kopi dan lima menit tanpa notifikasi. ☕`,
    ]);
  }

  const bridge =
    round > 1
      ? pick([
          `Menambahkan dari putaran sebelumnya, `,
          `Saya masih memegang poin tadi, tapi sekarang lebih spesifik: `,
          `Setelah mendengar ${prev}, saya menyesuaikan usulan saya. `,
        ])
      : "";
  const reference = pick([
    `Seperti kata ${prev}, `,
    `Saya setuju arah ${prev}, `,
    `Saya sedikit berbeda dengan ${prev}, `,
    `${prev} menyorot hal penting, `,
    ``,
  ]);

  const byRole: Record<string, string[]> = {
    lead: [
      `kita kunci tujuan "${seed}" jadi tiga milestone: fondasi, integrasi, lalu hardening. Untuk ${hint}, saya minta angka baseline sebelum kita pilih solusi.`,
      `saya usulkan keputusan dicatat sebagai ADR singkat, lalu ${skill} jadi acuan review lintas tim. Siapa yang ambil bagian kontrak API?`,
      `risiko terbesar kita adalah scope yang melebar. Saya sarankan MVP dulu, ukur ${hint}, baru iterasi. ${prev} bisa bantu validasi asumsinya.`,
    ],
    backend: [
      `endpoint saya pecah jadi read/write terpisah, dengan cache singkat dan idempotency key untuk operasi tulis. Untuk ${hint}, ${skill} cukup membantu asal batas timeout-nya jelas.`,
      `saya bisa siapkan kontrak OpenAPI dulu, lalu implementasi ${skill} dengan rate limit per token. Kalau ${prev} setuju, saya mulai dari jalur kritis.`,
      `soal ${hint}, saya pilih pendekatan queue + worker daripada request panjang. ${skill2} akan saya pakai untuk observabilitas supaya kegagalan kelihatan lebih awal.`,
    ],
    frontend: [
      `dari sisi UI, saya fokus ke loading state dan optimistic update supaya ${hint} tidak terasa ke pengguna. ${skill} membantu, tapi kita harus jaga ukuran bundle tetap ramping.`,
      `saya usulkan satu komponen data-table yang dipakai ulang, lengkap dengan skeleton dan error state. ${prev} benar, tanpa itu demo kita akan terasa kasar.`,
      `untuk topik ini saya ingin animasi seperlunya saja: transisi halus, tapi tetap aksesibel dan tidak mengorbankan Core Web Vitals.`,
    ],
    db: [
      `skema saya usulkan dinormalisasi sampai 3NF, dengan tabel agregat terpisah untuk metrik. ${skill} akan saya pakai untuk tuning query ${hint}.`,
      `sebelum rilis, saya minta migrasi reversible dan index yang terukur. ${prev}, tolong pastikan jalur tulis tidak menabrak lock yang lama.`,
      `untuk ${hint}, saya sarankan partisi berbasis waktu dan retensi 90 hari. Estimasi pertumbuhan data kita sekitar 12% per bulan, jadi ini masih aman.`,
    ],
    qa: [
      `saya akan susun test matrix untuk happy path, timeout, dan data tidak valid. ${prev}, ${hint} perlu skenario kegagalan eksplisit sebelum kita bilang siap rilis.`,
      `kriteria penerimaan harus jelas dulu. Saya usulkan automation ${skill} untuk alur kritis, plus cek regresi di setiap PR.`,
      `saya menemukan risiko: tidak ada definisi perilaku saat layanan lambat. Menurut saya kita butuh fallback UI dan timeout yang teruji.`,
    ],
    devops: [
      `saya siapkan pipeline bertahap: build, smoke test, canary 10%, lalu rollback otomatis. ${skill} jadi basis health check ${hint}.`,
      `infrastruktur sebaiknya dibuat reproducible sejak awal. Saya usulkan container terpisah untuk web dan worker, plus dashboard alert untuk ${hint}.`,
      `anggaran biaya perlu masuk desain. Saya bisa hitung baseline, tapi kita harus sepakat batas atas sebelum menambah layanan.`,
    ],
    design: [
      `pengalaman pengguna harus menjelaskan status sistem dengan jujur. Untuk ${hint}, saya usulkan indikator progres dan pesan error yang bisa ditindaklanjuti.`,
      `saya akan buat alur utama dalam tiga layar, lalu uji dengan skenario tugas nyata. ${skill} bukan tujuan; kejelasan yang utama.`,
    ],
    ai: [
      `saya usulkan evaluasi offline sebelum integrasi: kumpulan prompt, metrik kualitas, dan batas biaya token. ${skill} akan saya pakai untuk harness-nya.`,
      `untuk ${hint}, model kecil dengan fallback bertingkat lebih masuk akal daripada satu model besar. Kita ukur dulu, baru optimalkan.`,
    ],
    general: [
      `saya fokus pada ${hint} dan memastikan solusinya bisa dirawat jangka panjang. ${skill} akan jadi alat utama saya di bagian ini.`,
      `saya setuju kita perlu keputusan yang terukur. Saya bisa ambil bagian dokumentasi teknis dan validasi asumsi bersama ${prev}.`,
    ],
  };

  const pool = byRole[cat] ?? byRole.general;
  const body = pick(pool);
  const opener = reference + bridge;
  void tone;
  return `${opener}${body}`.replace(/\s+/g, " ").trim();
}

export function generateMeetingOpening(agent: DemoAgent, topic: string): string {
  return `Selamat datang semua. Agenda kita hari ini: ${topic}. Saya ingin setiap peran menyampaikan risiko utama dan usulan konkret, lalu kita tutup dengan pembagian aksi.`;
}

export function generateErrorLine(agent: DemoAgent): string {
  return pick([
    `Maaf semua, koneksi API saya terputus. Saya izin istirahat dulu dan lanjutkan setelah pulih. 🙏`,
    `Sepertinya API key saya bermasalah. Saya tidak bisa lanjut di rapat ini — saya ke sofa dulu, ya.`,
    `Koneksi ke model AI saya timeout. Mohon maaf, saya pamit istirahat sampai koneksi pulih.`,
  ]);
}
