"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";
import type { RingkasanKeluaran } from "@serah/kontrak";
import { TEKS, isi } from "@serah/kontrak/teks";
import { AtribusiBMKG, BannerGalat, Kartu, LencanaAliran, PanelAturan, Tabel, type KolomTabel } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { formatGramKeKg } from "@/lib/klien/angka";
import { useKawasanSaya } from "@/lib/klien/kawasan-saya";
import { PeriksaRantai } from "@/lib/klien/komponen/periksa-rantai";
import { periodeSekarangWib } from "@/lib/klien/periode";

type Ringkasan = z.infer<typeof RingkasanKeluaran>;
type Total = Ringkasan["hariIni"][number];

const kg = (g: number) => isi("UMUM_KG", { nilai: formatGramKeKg(g) });

function TabelNeraca({ judul, total }: { judul: string; total: readonly Total[] }) {
  const kolom: KolomTabel<Total>[] = [
    { kunci: "aliran", judul: TEKS.KOL_ALIRAN, sel: (t) => <LencanaAliran aliran={t.aliran} pendek /> },
    { kunci: "dicatat", judul: TEKS.K1_DICATAT, angka: true, sel: (t) => kg(t.beratTpsG) },
    { kunci: "diterima", judul: TEKS.K1_DITERIMA, angka: true, sel: (t) => kg(t.beratDiterimaG) },
    { kunci: "ditolak", judul: TEKS.K1_DITOLAK, angka: true, sel: (t) => kg(t.beratDitolakG) },
  ];
  return (
    <section className="flex flex-col gap-2" aria-label={judul}>
      <h3 className="text-base font-bold">{judul}</h3>
      <Tabel keterangan={`${TEKS.K1_NERACA} — ${judul}`} kolom={kolom} baris={total} kunciBaris={(t) => t.aliran} />
    </section>
  );
}

/** K1 (§L.3): neraca hari ini & bulan ini, menunggu persetujuan, menggantung, TPS prioritas, peringatan, periksa rantai. */
export function RingkasanKawasan() {
  const { kawasan, galat: galatKawasan } = useKawasanSaya();
  const [data, setData] = useState<Ringkasan | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  const muat = useCallback(async () => {
    if (!kawasan) return;
    setGalat(null);
    const h = await panggil("GET", "/api/kawasan/[id]/ringkasan", { params: { id: kawasan.id }, kueri: { periode: periodeSekarangWib() } });
    if (h.ok) setData(h.data);
    else setGalat(h.pesan);
  }, [kawasan]);

  useEffect(() => {
    void muat();
  }, [muat]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{TEKS.K1_JUDUL}</h1>
      {galatKawasan ? <BannerGalat pesan={galatKawasan} /> : null}
      {galat ? <BannerGalat pesan={galat} onCoba={() => void muat()} /> : null}
      {!data && !galat ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}

      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Kartu data-testid="menunggu-setuju" className="flex flex-col gap-2">
              <p className="text-3xl font-bold">{data.menungguSetuju}</p>
              <p className="text-base">{TEKS.K1_MENUNGGU_SETUJU}</p>
              <Link href="/kawasan/setujui" className="inline-flex min-h-12 items-center underline">
                {TEKS.UMUM_LIHAT_DETAIL}
              </Link>
            </Kartu>
            <Kartu data-testid="menggantung" className="flex flex-col gap-2">
              <p className="text-3xl font-bold">{data.menggantung}</p>
              <p className="text-base">{TEKS.K1_MENGGANTUNG}</p>
            </Kartu>
          </div>

          <h2 className="text-lg font-bold">{TEKS.K1_NERACA}</h2>
          <TabelNeraca judul={TEKS.K1_HARI_INI} total={data.hariIni} />
          <TabelNeraca judul={TEKS.K1_BULAN_INI} total={data.bulanIni} />

          {data.prioritas.length > 0 ? (
            <section className="flex flex-col gap-2" aria-labelledby="k1-prioritas">
              <h2 id="k1-prioritas" className="text-lg font-bold">
                {TEKS.K1_PRIORITAS}
              </h2>
              {data.prioritas.map((p) => (
                <PanelAturan key={p.tpsId} aksi="PRIORITAS" kode="R10" teks={p.teks} />
              ))}
              <AtribusiBMKG />
            </section>
          ) : null}

          {data.peringatan.length > 0 ? (
            <section className="flex flex-col gap-2" aria-labelledby="k1-peringatan">
              <h2 id="k1-peringatan" className="text-lg font-bold">
                {TEKS.K1_PERINGATAN}
              </h2>
              {data.peringatan.map((p, i) => (
                <PanelAturan key={`${p.kode}-${i}`} aksi={p.aksi} kode={p.kode} teks={p.teks} />
              ))}
            </section>
          ) : null}
        </>
      ) : null}

      {kawasan ? <PeriksaRantai kawasanId={kawasan.id} /> : null}
    </div>
  );
}
