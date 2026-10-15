"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import type { Tps } from "@serah/kontrak";
import { TEKS } from "@serah/kontrak/teks";
import { BannerGalat, Tombol } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { useKawasanSaya } from "@/lib/klien/kawasan-saya";

function KontenCetak() {
  const searchParams = useSearchParams();
  const tpsIdFilter = searchParams.get("id");

  const { kawasan, galat: galatKawasan } = useKawasanSaya();
  const [daftarTps, setDaftarTps] = useState<Tps[]>([]);
  const [sedangMuat, setSedangMuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  const muat = useCallback(async () => {
    if (!kawasan) return;
    setSedangMuat(true);
    setGalat(null);
    const r = await panggil("GET", "/api/tps", { kueri: { kawasanId: kawasan.id } });
    setSedangMuat(false);
    if (r.ok) {
      const data = tpsIdFilter ? r.data.tps.filter((t) => t.id === tpsIdFilter) : r.data.tps;
      setDaftarTps(data.filter((t) => t.aktif));
    } else {
      setGalat(r.pesan);
    }
  }, [kawasan, tpsIdFilter]);

  useEffect(() => {
    void muat();
  }, [muat]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/kawasan/tps"
            className="inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-kontrol border-2 border-garis bg-kertas px-5 text-base font-semibold text-tinta"
          >
            {TEKS.UMUM_KEMBALI}
          </Link>
          <h1 className="text-xl font-bold">{TEKS.TPS_CETAK_QR}</h1>
        </div>
        <Tombol onClick={() => window.print()}>{TEKS.TPS_CETAK_QR}</Tombol>
      </div>

      {galatKawasan ? <BannerGalat pesan={galatKawasan} /> : null}
      {galat ? <BannerGalat pesan={galat} /> : null}
      {sedangMuat ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}

      <div className="grid grid-cols-1 gap-8 print:grid-cols-1 print:gap-12">
        {daftarTps.map((tps) => (
          <div
            key={tps.id}
            className="flex flex-col items-center justify-center rounded-kartu border-2 border-dashed border-garis bg-white p-8 text-center break-inside-avoid print:h-[45vh] print:border-black"
          >
            <div className="mb-4">
              <h2 className="text-2xl font-bold print:text-3xl">{tps.nama}</h2>
              <p className="font-mono text-lg font-semibold text-tinta-redup print:text-black">
                {tps.kode}
              </p>
              {kawasan ? (
                <p className="text-sm text-tinta-redup print:text-black">{kawasan.nama}</p>
              ) : null}
            </div>

            <img
              src={`/api/tps/${tps.id}/qr?format=svg&v=${tps.qrVersi}`}
              alt={`${tps.nama} - ${tps.kode}`}
              className="h-64 w-64 print:h-72 print:w-72"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HalamanCetakTps() {
  return (
    <Suspense fallback={<p role="status">{TEKS.UMUM_MUAT}</p>}>
      <KontenCetak />
    </Suspense>
  );
}
