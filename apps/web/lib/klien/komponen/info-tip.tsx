"use client";

import { useEffect, useId, useRef, useState } from "react";
import { TEKS } from "@serah/kontrak/teks";

/**
 * Ikon "i" kecil: ketuk untuk melihat penjelasan fitur. Menjaga layar tetap ringkas —
 * teks panjang dipindah ke sini, bukan ditampilkan terus.
 */
export function InfoTip({
  judul,
  isi,
  rata = "kiri",
}: {
  judul: string;
  isi: string;
  rata?: "kiri" | "kanan";
}) {
  const [buka, setBuka] = useState(false);
  const akar = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!buka) return;
    const luar = (e: PointerEvent) => {
      if (akar.current && !akar.current.contains(e.target as Node)) setBuka(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBuka(false);
    };
    document.addEventListener("pointerdown", luar);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", luar);
      document.removeEventListener("keydown", esc);
    };
  }, [buka]);

  return (
    <span ref={akar} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={`${TEKS.UMUM_INFO}: ${judul}`}
        aria-expanded={buka}
        aria-controls={id}
        onClick={() => setBuka((b) => !b)}
        className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-all duration-200 ${
          buka
            ? "border-aksi bg-aksi text-white"
            : "border-garis-halus bg-latar text-tinta-redup hover:border-aksi-garis hover:bg-aksi-latar hover:text-aksi"
        }`}
      >
        <span aria-hidden="true" className="font-serif italic">
          i
        </span>
      </button>
      {buka ? (
        <span
          id={id}
          role="note"
          className={`dropdown-masuk absolute top-full z-50 mt-2 w-[min(18rem,78vw)] rounded-2xl border border-garis-halus bg-white p-3.5 text-left shadow-[0_20px_50px_rgba(15,23,42,0.18)] ${
            rata === "kiri" ? "left-0 origin-top-left" : "right-0 origin-top-right"
          }`}
        >
          <span className="block text-sm font-semibold text-tinta">{judul}</span>
          <span className="mt-1 block text-sm leading-relaxed text-tinta-redup">{isi}</span>
        </span>
      ) : null}
    </span>
  );
}
