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
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{TEKS.K3_JUDUL}</h1>
      <p className="text-base">{TEKS.K3_PENJELASAN}</p>
      <PilihPeriode nilai={periode} onUbah={setPeriode} />
      {galatKawasan ? <BannerGalat pesan={galatKawasan} /> : null}
      {galat ? <BannerGalat pesan={galat} onCoba={() => void muat()} /> : null}
      {!data && !galat ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}
      {data ? (
        <>
          <p className="text-base font-semibold" data-testid="diterima-vs">
            {isi("K3_DITERIMA_VS", { diterima: formatGramKeKg(data.kuning.diterimaG), ditolak: formatGramKeKg(data.kuning.ditolakG) })}
          </p>
          {data.alasan.length === 0 ? (
            <Kosong teks={TEKS.K_KOSONG_TOLAK} />
          ) : (
            <Tabel keterangan={TEKS.K3_JUDUL} kolom={kolom} baris={data.alasan} kunciBaris={(b) => b.alasan} />
          )}
          <p className="text-sm" data-testid="selisih-penjelasan">
            {TEKS.K3_SELISIH_PENJELASAN}
          </p>
          {data.sumberHarga ? (
            <p className="text-sm" data-testid="sumber-harga">
              {isi("K3_SUMBER_HARGA", { sumber: data.sumberHarga.sumber, tanggal: data.sumberHarga.tanggal })}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
