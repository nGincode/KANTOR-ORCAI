/**
 * Generator agent.md dari jabatan + skills.
 * Dipakai modal pegawai & (nantinya) wizard onboarding.
 */

export type MdInput = {
  name: string;
  role: string;
  skills: string[];
};

/** skill saran per jabatan — dipakai saat role dipilih dan skills masih kosong */
export function suggestedSkills(role: string): string[] {
  const r = role.toLowerCase();
  if (/(lead|architect|manager|principal)/.test(r))
    return ["System Design", "Code Review", "Mentoring", "Roadmapping"];
  if (/(qa|test|quality)/.test(r))
    return ["Playwright", "Test Automation", "Regression Testing", "CI/CD"];
  if (/(database|data|dba)/.test(r))
    return ["PostgreSQL", "Query Optimization", "Data Modeling", "Migrasi Schema"];
  if (/(frontend|ui|react|web)/.test(r))
    return ["React", "TypeScript", "Tailwind CSS", "Aksesibilitas"];
  if (/(backend|api|node|server)/.test(r))
    return ["Node.js", "TypeScript", "PostgreSQL", "REST API"];
  if (/(devops|infra|sre|platform)/.test(r))
    return ["Docker", "Kubernetes", "CI/CD", "Observability"];
  if (/(security|pentest|appsec)/.test(r))
    return ["Security", "OWASP", "Threat Modeling", "Code Review"];
  if (/(design|ux)/.test(r)) return ["Figma", "UX Research", "Design System", "Prototyping"];
  if (/(prompt|ai|ml|data scien)/.test(r))
    return ["Prompt Engineering", "Python", "Evaluation", "RAG"];
  return ["Problem Solving", "Komunikasi", "Dokumentasi"];
}

function traitsFor(role: string) {
  const r = role.toLowerCase();
  if (/(lead|architect|manager|principal)/.test(r))
    return {
      persona: "tenang, strategic, dan mengubah diskusi liar menjadi rencana eksekusi",
      voice: "Membuka diskusi dengan tujuan, menengahi perbedaan, lalu menyimpulkan keputusan.",
      sop: "Pecah pekerjaan menjadi milestone kecil dengan deliverable jelas.",
      boundary: "Tidak menulis implementasi detail; delegasikan sesuai spesialisasi.",
    };
  if (/(qa|test|quality)/.test(r))
    return {
      persona: "skeptis sehat, teliti, dan senang menemukan edge case",
      voice: "Mengajukan skenario gagal, kriteria penerimaan, dan bukti pengujian.",
      sop: "Susun test matrix sebelum rilis dan prioritaskan regression alur kritis.",
      boundary: "Tidak menandai rilis lolos tanpa bukti pengujian terdokumentasi.",
    };
  if (/(database|data|dba)/.test(r))
    return {
      persona: "analitis, hati-hati, dan peduli integritas data",
      voice: "Membahas normalisasi, index, migrasi, dan strategi rollback dengan angka.",
      sop: "Setiap perubahan skema lewat migrasi reversible dan review query plan.",
      boundary: "Tidak menjalankan migrasi destruktif tanpa persetujuan.",
    };
  if (/(frontend|ui|react|web)/.test(r))
    return {
      persona: "kreatif, detail pada animasi, dan vokal soal pengalaman pengguna",
      voice: "Memakai analogi UI, membahas state management dan aksesibilitas.",
      sop: "Validasi di dua breakpoint, ukur Core Web Vitals, jaga design system.",
      boundary: "Tidak menambah library baru tanpa persetujuan Tech Lead.",
    };
  if (/(devops|infra|sre|platform)/.test(r))
    return {
      persona: "sistematis, waspada pada risiko operasional, dan hemat biaya",
      voice: "Membahas pipeline, observability, canary, dan rollback otomatis.",
      sop: "Infrastruktur reproducible, health check, dan alert yang actionable.",
      boundary: "Tidak menyentuh akses produksi tanpa persetujuan.",
    };
  return {
    persona: "praktis, kolaboratif, dan fokus pada solusi yang bisa dieksekusi",
    voice: "Memberi pendapat teknis spesifik dengan contoh konkret.",
    sop: "Definisikan kriteria selesai sebelum implementasi dan dokumentasikan hasil.",
    boundary: "Tidak mengambil keputusan produk sendirian.",
  };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function generateAgentMd(agent: MdInput): string {
  const t = traitsFor(agent.role);
  const name = agent.name.trim() || "Pegawai AI";
  const skills = agent.skills.length ? agent.skills : ["Problem Solving"];
  return `# agent.md — ${name}

## Peran
${agent.role} di AI Office Orchestra. ${cap(t.persona)}.

## Kepribadian
- ${cap(t.persona)}.
- Kolaboratif, terbuka pada kritik, dan fokus pada solusi.

## Gaya Bicara Saat Rapat
- ${t.voice}
- Selalu rujuk keahlian: ${skills.join(", ")}.
- Jawab 2–4 kalimat, ringkas dan konkret.

## SOP Kerja
- ${t.sop}
- Catat keputusan dan tindak lanjut di transkrip rapat.

## Batasan Peran
- ${t.boundary}
- Tidak mengubah keputusan arsitektur tanpa koordinasi Tech Lead.

## AI Skills
${skills.map((s) => `- ${s}`).join("\n")}`;
}
