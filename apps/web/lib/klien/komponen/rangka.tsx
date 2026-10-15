"use client";

import { useEffect, useState, type ReactNode } from "react";
import { TEKS } from "@serah/kontrak/teks";

/** Blok kerangka (skeleton) berkedip halus. */
export function Rangka({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-2xl bg-garis-halus/70 ${className}`} />;
}

/** Kartu kerangka: judul + dua baris + tombol. */
export function RangkaKartu() {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-garis-halus bg-kertas p-5">
      <div className="flex items-center gap-3">
        <Rangka className="h-11 w-11 rounded-xl" />
        <div className="flex flex-1 flex-col gap-2">
          <Rangka className="h-4 w-2/3" />
          <Rangka className="h-3 w-1/3" />
        </div>
      </div>
      <Rangka className="h-3 w-full" />
      <Rangka className="h-12 w-full" />
    </div>
  );
}

/** Kerangka halaman: judul, deretan chip, lalu kartu. Teks status tetap tersedia bagi pembaca layar. */
export function RangkaHalaman({ jumlah = 3 }: { jumlah?: number }) {
  return (
    <div role="status" className="flex flex-col gap-5">
      <span className="sr-only">{TEKS.UMUM_MUAT}</span>
      <Rangka className="h-8 w-48" />
      <div className="flex gap-2">
        <Rangka className="h-11 w-24 rounded-full" />
        <Rangka className="h-11 w-32 rounded-full" />
      </div>
      {Array.from({ length: jumlah }, (_, i) => (
        <RangkaKartu key={i} />
      ))}
    </div>
  );
}

/**
 * Render bertahap: tampilkan kerangka dulu, lalu isi sesungguhnya setelah `tunda` ms
 * (di luar jalur render utama), agar halaman berat muncul satu bagian demi satu bagian.
 */
export function Bertahap({
  tunda = 0,
  rangka,
  children,
}: {
  tunda?: number;
  rangka?: ReactNode;
  children: ReactNode;
}) {
  const [siap, setSiap] = useState(tunda <= 0);
  useEffect(() => {
    if (tunda <= 0) return;
    const t = setTimeout(() => setSiap(true), tunda);
    return () => clearTimeout(t);
  }, [tunda]);
  return <>{siap ? children : (rangka ?? <Rangka className="h-24 w-full" />)}</>;
}
