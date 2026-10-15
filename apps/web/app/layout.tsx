import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { DaftarkanSw } from "@/lib/klien/komponen/daftarkan-sw";
import "./globals.css";

export const metadata: Metadata = {
  title: TEKS.APP_NAMA,
  description: TEKS.APP_DESKRIPSI,
  applicationName: TEKS.APP_NAMA,
  manifest: "/manifest.webmanifest",
  icons: { icon: "/ikon/ikon.svg", apple: "/ikon/ikon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#2457c5",
  width: "device-width",
  initialScale: 1,
};

export default async function TataLetakAkar({ children }: { children: ReactNode }) {
  // CSP ber-nonce (proxy.ts) hanya berlaku pada render dinamis: semua halaman dirender per permintaan (S26-2).
  await connection();
  return (
    <html lang="id">
      <body className="min-h-dvh antialiased">
        {children}
        <DaftarkanSw />
      </body>
    </html>
  );
}
