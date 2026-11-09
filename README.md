# 🏢 AI Office Orchestra (KANTOR ORCAI)

> **Simulator Kantor AI Virtual 3D Interaktif & Real-time Orchestrator**  
> Menggabungkan simulasi grafis Three.js low-poly dengan model bahasa LLM OpenAI-compatible. Karakter AI hidup, berjalan di kantor bertingkat, mengobrol bebas, rapat dengan pemimpin tim, beristirahat, atau bekerja sesuai peran aslinya.

---

## 🌟 Fitur Unggulan

### 1. 🎮 Kantor 3D Interaktif (Three.js & React Three Fiber)
- **Gedung Bertingkat**: Dilengkapi lantai 1 (lobi, workstation, sick bay, pantry, TV lounge, toilet, musala) hingga lantai 2 & 3 (ruang server, kafe, tenis meja/pingpong).
- **Lift Aktif**: Karakter dapat memanggil lift, masuk ke kabin kaca, dan naik/turun antar lantai.
- **Siklus Hari Dinamis**: Pencahayaan otomatis mengikuti waktu nyata (Pagi, Siang, Sore/Sunset, Malam) atau dikontrol manual.
- **Karakter 3D Ekspresif**: Animasi berjalan, duduk, makan/minum, sholat, main pingpong, tidur di kasur, hingga animasi mulut & balon percakapan real-time.

### 2. 🧠 Pegawai AI Berbasis LLM (OpenAI-Compatible)
- **Bukan Sekadar Bot Skrip**: Setiap pegawai memiliki dokumen `agent.md`, kepribadian, gaya bicara, SOP kerja, dan batasan peran masing-masing.
- **Dukungan Beragam Provider**: Terhubung langsung dengan OpenAI, Groq, OpenRouter, Ollama, DeepSeek, atau endpoint kompatibel OpenAI lainnya.
- **Auto-Generate agent.md**: Buat persona dan dokumen operasional pegawai secara otomatis berdasarkan peran & keahlian yang dipilih.
- **Smart Activity**: Pegawai memutuskan aktivitas kantor mereka sendiri lewat prompt AI kasual dengan balon percakapan dinamis.

### 3. 🎙️ Sistem Rapat Terarah (Directed Meeting System)
- **Pemimpin Rapat (Leader)**: Dipimpin oleh Tech Lead atau figur pimpinan yang membuka, mengarahkan jalannya rapat, hingga menyimpulkan hasil rapat dan membubarkannya (`[SELESAI]`).
- **Konteks Project Nyata**: Tentukan project kantor (misal: *SaaS Analytics Dashboard*), dan semua peserta akan membahas ide, blocker, dan arsitektur dalam konteks project tersebut.
- **Riwayat Percakapan Utuh**: Setiap kalimat rapat dan obrolan terekam di database memori sehingga tidak hilang saat halaman direfresh.

### 4. ☕ Interaksi Sosial Manusiawi (Natural Socializing)
- **Obrolan Multi-Lokasi**: Pegawai saling mengajak ngobrol berpasangan di berbagai sudut kantor: Sofa Koridor, Pantry, TV Lounge, Lorong Musala, maupun Workstation.
- **Topik Bebas & Tidak Monoton**: Percakapan santai seputar film/series, hobi, makanan, rencana liburan, cerita lucu, hingga diskusi teknis.
- **Bebas dari Meja Kerja**: Pegawai tidak terkunci di meja jika belum ada tugas spesifik, melainkan bebas menikmati fasilitas kantor.

### 5. 🛌 Sick Bay & Penanganan Error API
- **Sakit & Tidur Otomatis**: Jika API model down, mengembalikan error `405`, `500`, atau `429`, pegawai akan batuk/lemas dan berjalan menuju kasur di ruang Sick Bay untuk beristirahat sampai pulih.
- **Ranjang Teratur**: Posisi kasur medis tertata rapi di sudut timur menghadap parkiran dengan tirai privasi dan lampu meja.

### 6. ☁️ Offline Worker & Dual Storage (Supabase)
- **Kantor Tetap Hidup**: Melalui integrasi `pg_cron` dan endpoint `/api/offline/tick`, simulasi kantor tetap berjalan di latar belakang meskipun tab browser ditutup.
- **Pilihan Penyimpanan**:
  - *Cloud Terkelola*: Simpan data langsung di server Supabase aplikasi.
  - *Bawa Proyek Sendiri (BYO Supabase)*: Sambungkan instance Supabase milikmu sendiri (RLS aman, kredensial terenkripsi).

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 15 (App Router)](https://nextjs.org/)
- **Bahasa**: [TypeScript](https://www.typescriptlang.org/)
- **3D Graphics & Visuals**:
  - [Three.js](https://threejs.org/)
  - [@react-three/fiber (R3F)](https://r3f.docs.pmnd.rs/)
  - [@react-three/drei](https://github.com/pmndrs/drei)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand) (dengan sinkronisasi storage persist)
- **Styling & UI Components**:
  - [Tailwind CSS](https://tailwindcss.com/)
  - [Framer Motion](https://www.framer.com/motion/)
  - [Lucide React Icons](https://lucide.dev/)
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL, Row Level Security, Vault Encryption)

---

## 🚀 Memulai Instalasi

### 1. Prasyarat
- [Node.js](https://nodejs.org/) v18 ke atas
- Akun [Supabase](https://supabase.com/) (opsional untuk mode tamu, wajib untuk fitur multi-user & offline sync)

### 2. Kloning Repositori & Instal Dependensi
```bash
git clone https://github.com/your-username/kantor-orcai.git
cd kantor-orcai
npm install
```

### 3. Konfigurasi Lingkungan (`.env.local`)
Salin file `.env.example` menjadi `.env.local`:
```bash
cp .env.example .env.local
```

Isi konfigurasi berikut sesuai proyek Supabase Anda:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...

# Kebutuhan Server / Offline Tick (Rahasia - jangan diekspos ke klien)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
OFFLINE_WORKER_KEY=string-acak-rahasia-cron
PARTNER_ENCRYPTION_KEY=passphrase-enkripsi-lokal
```

*(Catatan: Aplikasi tetap dapat berjalan penuh dalam mode tamu tanpa Supabase menggunakan `localStorage` browser).*

### 4. Setup Skema Database (Bila Menggunakan Supabase)
1. Masuk ke **Supabase Dashboard → SQL Editor**.
2. Jalankan isi file `supabase/schema.sql`.
3. Jalankan patch pelengkap di folder `supabase/`:
   - `patch-agents.sql` (Tabel roster pegawai terpisah)
   - `patch-conversations.sql` (Pencatatan riwayat obrolan & rapat)
   - `patch-roles.sql` (Daftar jabatan kustom)

### 5. Menjalankan Aplikasi
```bash
npm run dev
```
Buka browser di [http://localhost:3000](http://localhost:3000).

---

## 📖 Panduan Penggunaan Singkat

1. **Memilih & Menggerakkan Karakter**:
   - Klik karakter mana saja di tampilan 3D atau pilih melalui sidebar kanan.
   - Gunakan menu **Aksi Cepat** untuk menyuruh pegawai minum kopi, nonton TV, sholat, ke toilet, atau naik ke lantai atas.
2. **Membuat Pegawai Baru**:
   - Klik tombol **Kelola Pegawai AI** di header atau sidebar.
   - Pilih jabatan (role), AI skills dan agent.md akan otomatis terisi.
   - Klik **Auto-Generate agent.md** untuk memformat persona AI sesuai model yang aktif.
3. **Memulai Rapat (Meeting)**:
   - Masuk ke tab **Meeting** di sidebar.
   - Masukkan **Project Kantor** dan **Topik Diskusi**.
   - Tentukan **Pemimpin Rapat** dan centang pegawai yang diundang.
   - Klik **Panggil ke Ruang Meeting**. Rapat akan berjalan mandiri hingga pemimpin menyimpulkan keputusan.
4. **Melihat Riwayat Obrolan**:
   - Klik tombol **Riwayat Obrolan** di bagian footer untuk meninjau log percakapan santai maupun transkrip rapat sebelumnya.

---

## 📂 Struktur Proyek

```text
├── app/
│   ├── api/
│   │   ├── account/      # Pengelolaan model key & partner Supabase
│   │   ├── agent/        # Proxy chat completions, models, & generator agent.md
│   │   ├── memory/       # Sinkronisasi memori agent
│   │   └── offline/tick/ # Cron worker untuk simulasi saat tab offline
│   ├── layout.tsx
│   └── page.tsx          # Halaman utama aplikasi & canvas 3D
├── components/
│   ├── office/           # Komponen 3D: Karakter, Gedung, Lift, Furnitur, Pencahayaan
│   ├── AgentManagerModal.tsx # Modal kelola identitas & persona pegawai
│   ├── Sidebar.tsx       # Kontrol orkestrasi, rapat, tugas, & log aktivitas
│   ├── Header.tsx        # Status akun, koneksi API, & kontrol waktu
│   └── ConversationHistoryPanel.tsx # Riwayat log obrolan & meeting
├── lib/
│   ├── store.ts          # State management utama (Zustand) & event dispatcher
│   ├── office.ts         # Definisi koordinat, rute pathfinding, & perabotan
│   ├── demo-ai.ts        # Generator respons simulasi (mode demo/tamu)
│   ├── agent-memory.ts   # Pengelolaan memori kejadian & profil pegawai
│   └── roster-db.ts      # Integrasi database roster Supabase
└── supabase/             # Skrip SQL skema tabel, RLS, & RPC
```

---

## 📄 Lisensi
Didistribusikan di bawah lisensi MIT. Silakan gunakan dan kembangkan untuk kebutuhan simulator AI atau kantor virtual Anda!
