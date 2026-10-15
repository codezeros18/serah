"use client";

import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";
import type { DitolakKeluaran } from "@serah/kontrak";
import { TEKS, isi } from "@serah/kontrak/teks";
import { BannerGalat, Kosong, Tabel, type KolomTabel } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { formatGramKeKg } from "@/lib/klien/angka";
import { useKawasanSaya } from "@/lib/klien/kawasan-saya";
import { PilihPeriode } from "@/lib/klien/komponen/pilih-periode";
import { periodeSekarangWib } from "@/lib/klien/periode";

type Ditolak = z.infer<typeof DitolakKeluaran>;
type BarisAlasan = Ditolak["alasan"][number];

const rupiah = (n: number) => `Rp${new Intl.NumberFormat("id-ID").format(n)}`;

/** K3 (§L.3): kg KUNING ditolak per alasan baku, jumlah serah, perkiraan selisih nilai + sumber harga. */
export function PenyebabDitolak() {
  const { kawasan, galat: galatKawasan } = useKawasanSaya();
  const [periode, setPeriode] = useState(periodeSekarangWib);
  const [data, setData] = useState<Ditolak | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  const muat = useCallback(async () => {
    if (!kawasan) return;
    setGalat(null);
    const h = await panggil("GET", "/api/kawasan/[id]/ditolak", { params: { id: kawasan.id }, kueri: { periode } });
    if (h.ok) setData(h.data);
    else setGalat(h.pesan);
  }, [kawasan, periode]);

  useEffect(() => {
    void muat();
  }, [muat]);

  const kolom: KolomTabel<BarisAlasan>[] = [
    { kunci: "alasan", judul: TEKS.K3_KOLOM_ALASAN, sel: (b) => TEKS[`ALASAN_${b.alasan}`] },
    { kunci: "kg", judul: TEKS.K3_KOLOM_KG, angka: true, sel: (b) => isi("UMUM_KG", { nilai: formatGramKeKg(b.ditolakG) }) },
    { kunci: "serah", judul: TEKS.K3_KOLOM_SERAH, angka: true, sel: (b) => b.jumlahSerah },
    { kunci: "selisih", judul: TEKS.K3_KOLOM_SELISIH, angka: true, sel: (b) => (b.selisihIdr === null ? "—" : rupiah(b.selisihIdr)) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-garis-halus pb-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-tinta">{TEKS.K3_JUDUL}</h1>
          <p className="text-sm font-medium text-tinta-redup">{TEKS.K3_PENJELASAN}</p>
        </div>
      </div>

      <div className="max-w-xs">
        <PilihPeriode nilai={periode} onUbah={setPeriode} />
      </div>

      {galatKawasan ? <BannerGalat pesan={galatKawasan} /> : null}
      {galat ? <BannerGalat pesan={galat} onCoba={() => void muat()} /> : null}
      {!data && !galat ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}

      {data ? (
        <>
          <div className="rounded-kartu border border-garis-halus bg-kertas p-5 shadow-xs">
            <p className="text-base font-bold text-tinta" data-testid="diterima-vs">
              {isi("K3_DITERIMA_VS", { diterima: formatGramKeKg(data.kuning.diterimaG), ditolak: formatGramKeKg(data.kuning.ditolakG) })}
            </p>
          </div>

          {data.alasan.length === 0 ? (
            <Kosong teks={TEKS.K_KOSONG_TOLAK} />
          ) : (
            <div className="flex flex-col gap-2">
              <Tabel keterangan={TEKS.K3_JUDUL} kolom={kolom} baris={data.alasan} kunciBaris={(b) => b.alasan} />
            </div>
          )}

          <div className="flex flex-col gap-2 rounded-kartu border border-garis-halus bg-latar/40 p-4 text-tinta-redup">
            <p className="text-sm leading-relaxed" data-testid="selisih-penjelasan">
              {TEKS.K3_SELISIH_PENJELASAN}
            </p>
            {data.sumberHarga ? (
              <p className="text-xs font-medium text-tinta-redup" data-testid="sumber-harga">
                {isi("K3_SUMBER_HARGA", { sumber: data.sumberHarga.sumber, tanggal: data.sumberHarga.tanggal })}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
