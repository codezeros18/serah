"use client";

import { TEKS } from "@serah/kontrak/teks";
import { periodeSah } from "../periode";

/** Pemilih bulan (YYYY-MM). Nilai tak sah tidak diteruskan. */
export function PilihPeriode({ nilai, onUbah }: { nilai: string; onUbah: (p: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="periode" className="text-base font-semibold">
        {TEKS.UMUM_PERIODE}
      </label>
      <input
        id="periode"
        type="month"
        value={nilai}
        onChange={(e) => {
          if (periodeSah(e.target.value)) onUbah(e.target.value);
        }}
        className="min-h-12 rounded-kontrol border-2 border-garis bg-kertas px-3 text-base"
      />
    </div>
  );
}
