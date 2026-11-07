import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Office Orchestra — Simulator Kantor AI 3D",
  description:
    "Kantor virtual 3D interaktif: pegawai AI berjalan melewati pintu ruangan, duduk, rapat, ngobrol, sholat, dan istirahat saat API error.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
