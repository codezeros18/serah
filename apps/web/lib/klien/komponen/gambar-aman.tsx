"use client";

import { useState, type ReactNode } from "react";
import { IkonNav, type NamaIkonNav } from "./ikon-nav";

/**
 * Gambar dengan keadaan gagal yang rapi: bila berkas tidak termuat, tampil kartu kosong beraksen ikon
 * (bukan ikon gambar rusak + teks alt mentah dari peramban).
 */
export function GambarAman({
  src,
  alt,
  teksKosong,
  ikon = "laporan",
  aksi,
  className = "",
  kelasKosong = "h-44",
}: {
  src: string;
  alt: string;
  teksKosong: string;
  ikon?: NamaIkonNav;
  aksi?: ReactNode;
  /** Kelas untuk <img> saat berhasil. */
  className?: string;
  /** Tinggi/ukuran kartu saat gagal. */
  kelasKosong?: string;
}) {
  const [gagal, setGagal] = useState(false);
  if (gagal) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-garis-halus bg-latar/60 px-4 text-center ${kelasKosong}`}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-garis shadow-[0_2px_8px_rgba(15,23,42,0.06)]">
          <IkonNav nama={ikon} className="h-6 w-6" />
        </span>
        <p className="max-w-xs text-xs leading-relaxed text-tinta-redup">{teksKosong}</p>
        {aksi}
      </div>
    );
  }
  return (
    <img src={src} alt={alt} onError={() => setGagal(true)} className={className} />
  );
}
