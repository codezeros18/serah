"use client";

import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";
import type { LaporanKeluaran, RingkasanKeluaran } from "@serah/kontrak";
import { TEKS, isi } from "@serah/kontrak/teks";
import { AtribusiBMKG, BannerGalat, LencanaAliran, PanelAturan, Tabel, type KolomTabel } from "@serah/ui";
import { panggil } from "@/lib/klien/api";
import { formatGramKeKg } from "@/lib/klien/angka";
import { useKawasanSaya } from "@/lib/klien/kawasan-saya";
import dynamic from "next/dynamic";
import { InfoTip } from "@/lib/klien/komponen/info-tip";
import { Bertahap, Rangka, RangkaHalaman } from "@/lib/klien/komponen/rangka";

const PeriksaRantai = dynamic(() => import("@/lib/klien/komponen/periksa-rantai").then((m) => m.PeriksaRantai), {
  ssr: false,
  loading: () => <Rangka className="h-24 w-full" />,
});
import { periodeSekarangWib } from "@/lib/klien/periode";
import { periodeSebelum } from "@/lib/klien/statistik";
import { DasborKawasan } from "./dasbor-kawasan";

type Ringkasan = z.infer<typeof RingkasanKeluaran>;
type LaporanData = z.infer<typeof LaporanKeluaran>;
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
  const [sebelumnya, setSebelumnya] = useState<Ringkasan | null>(null);
  const [baris, setBaris] = useState<LaporanData["baris"] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  const muat = useCallback(async () => {
    if (!kawasan) return;
    setGalat(null);
    const h = await panggil("GET", "/api/kawasan/[id]/ringkasan", { params: { id: kawasan.id }, kueri: { periode: periodeSekarangWib() } });
    if (h.ok) setData(h.data);
    else setGalat(h.pesan);
    // Pelengkap dasbor (tidak menggagalkan halaman bila gagal): bulan lalu + baris laporan bulan ini.
    void panggil("GET", "/api/kawasan/[id]/ringkasan", { params: { id: kawasan.id }, kueri: { periode: periodeSebelum(periodeSekarangWib()) } }).then((r) => {
      if (r.ok) setSebelumnya(r.data);
    });
    void panggil("GET", "/api/laporan/[pihak]", { params: { pihak: "kawasan" }, kueri: { periode: periodeSekarangWib(), kawasanId: kawasan.id } }).then((r) => {
      if (r.ok) setBaris(r.data.baris);
    });
  }, [kawasan]);

  useEffect(() => {
    void muat();
  }, [muat]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-tinta">{TEKS.K1_JUDUL}</h1>
            <InfoTip judul={TEKS.K1_JUDUL} isi={TEKS.INFO_K1} />
          </div>
          {kawasan ? <p className="text-sm font-medium text-tinta-redup">{kawasan.nama}</p> : null}
        </div>
      </div>

      {galatKawasan ? <BannerGalat pesan={galatKawasan} /> : null}
      {galat ? <BannerGalat pesan={galat} onCoba={() => void muat()} /> : null}
      {!data && !galat ? <RangkaHalaman jumlah={2} /> : null}

      {data ? (
        <>
          <DasborKawasan periode={periodeSekarangWib()} data={data} sebelumnya={sebelumnya} baris={baris} />

          <Bertahap tunda={60} rangka={<Rangka className="h-48 w-full" />}>
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold tracking-tight text-tinta">{TEKS.K1_NERACA}</h2>
              <TabelNeraca judul={TEKS.K1_HARI_INI} total={data.hariIni} />
              <Bertahap tunda={120} rangka={<Rangka className="h-48 w-full" />}>
                <TabelNeraca judul={TEKS.K1_BULAN_INI} total={data.bulanIni} />
              </Bertahap>
            </div>
          </Bertahap>

          {data.prioritas.length > 0 ? (
            <section className="flex flex-col gap-3 rounded-kartu border border-garis-halus bg-kertas p-4 shadow-xs" aria-labelledby="k1-prioritas">
              <h2 id="k1-prioritas" className="text-lg font-bold tracking-tight text-tinta">
                {TEKS.K1_PRIORITAS}
              </h2>
              <div className="flex flex-col gap-2">
                {data.prioritas.map((p) => (
                  <PanelAturan key={p.tpsId} aksi="PRIORITAS" kode="R10" teks={p.teks} />
                ))}
              </div>
              <AtribusiBMKG />
            </section>
          ) : null}

          {data.peringatan.length > 0 ? (
            <section className="flex flex-col gap-3 rounded-kartu border border-garis-halus bg-kertas p-4 shadow-xs" aria-labelledby="k1-peringatan">
              <h2 id="k1-peringatan" className="text-lg font-bold tracking-tight text-tinta">
                {TEKS.K1_PERINGATAN}
              </h2>
              <div className="flex flex-col gap-2">
                {data.peringatan.map((p, i) => (
                  <PanelAturan key={`${p.kode}-${i}`} aksi={p.aksi} kode={p.kode} teks={p.teks} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {kawasan ? (
        <Bertahap tunda={240} rangka={<Rangka className="h-24 w-full" />}>
          <section className="rounded-kartu border border-garis-halus bg-kertas p-4 shadow-xs">
            <PeriksaRantai kawasanId={kawasan.id} />
          </section>
        </Bertahap>
      ) : null}
    </div>
  );
}
