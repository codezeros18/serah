import type { Metadata } from "next";
import type { ReactNode } from "react";
import { TEKS } from "@serah/kontrak/teks";
import "./globals.css";

export const metadata: Metadata = {
  title: TEKS.APP_NAMA,
  description: TEKS.APP_DESKRIPSI,
};

export default function TataLetakAkar({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
