"use client";

import { useState } from "react";
import { TEKS, isi } from "@serah/kontrak/teks";
import { BannerGalat, Kartu, Tombol } from "@serah/ui";
import { panggil } from "../api";

/** Tombol periksa rantai satu kawasan + hasilnya (T_RANTAI_UTUH / T_RANTAI_PATAH). */
export function PeriksaRantai({ kawasanId }: { kawasanId: string }) {
  const [sibuk, setSibuk] = useState(false);
  const [hasil, setHasil] = useState<{ utuh: boolean; teks: string } | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  async function periksa() {
    setSibuk(true);
    setGalat(null);
    const h = await panggil("GET", "/api/rantai/verifikasi", { kueri: { kawasanId } });
    setSibuk(false);
    if (!h.ok) {
      setGalat(h.pesan);
      return;
    }
    setHasil({
      utuh: h.data.utuh,
      teks: h.data.utuh
        ? isi("T_RANTAI_UTUH", { jumlah: h.data.jumlah })
        : isi("T_RANTAI_PATAH", { urutan: h.data.patahDiUrutan ?? 1 }),
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Tombol varian="sekunder" disabled={sibuk} onClick={() => void periksa()} data-aksi="periksa-rantai">
        {TEKS.RANTAI_PERIKSA}
      </Tombol>
      {galat ? <BannerGalat pesan={galat} /> : null}
      {hasil ? (
        <Kartu role="status" data-testid="hasil-rantai" data-utuh={hasil.utuh}>
          <p className="text-base font-semibold">{hasil.teks}</p>
        </Kartu>
      ) : null}
    </div>
  );
}
