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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-tinta">{TEKS.K1_JUDUL}</h1>
          {kawasan ? <p className="text-sm font-medium text-tinta-redup">{kawasan.nama}</p> : null}
        </div>
      </div>

      {galatKawasan ? <BannerGalat pesan={galatKawasan} /> : null}
      {galat ? <BannerGalat pesan={galat} onCoba={() => void muat()} /> : null}
      {!data && !galat ? <p role="status">{TEKS.UMUM_MUAT}</p> : null}

      {data ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Kartu
              data-testid="menunggu-setuju"
              className={`flex flex-col justify-between gap-4 border border-t-4 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)] ${
                data.menungguSetuju > 0
                  ? "border-garis-halus border-t-aksi bg-gradient-to-b from-blue-50/40 to-kertas shadow-sm"
                  : "border-garis-halus border-t-slate-300"
              }`}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-tinta-redup">
                    {TEKS.K1_MENUNGGU_SETUJU}
                  </span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-aksi-latar text-xs font-semibold text-aksi">
                    !
                  </span>
                </div>
                <p className="text-4xl sm:text-5xl font-semibold tracking-tight tabular-nums text-tinta">
                  {data.menungguSetuju}
                </p>
              </div>
              <div className="pt-2 border-t border-garis-halus/60">
                <Link
                  href="/kawasan/setujui"
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-kontrol bg-aksi px-4 py-2 text-xs font-bold text-white shadow-xs transition-all duration-150 hover:bg-aksi-hover hover:shadow-sm active:scale-[0.98]"
                >
                  <span>{TEKS.UMUM_LIHAT_DETAIL}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </Kartu>

            <Kartu
              data-testid="menggantung"
              className={`flex flex-col justify-between gap-4 border border-t-4 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)] ${
                data.menggantung > 0
                  ? "border-garis-halus border-t-amber-500 bg-gradient-to-b from-amber-50/40 to-kertas shadow-sm"
                  : "border-garis-halus border-t-slate-300"
              }`}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-tinta-redup">
                    {TEKS.K1_MENGGANTUNG}
                  </span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-800">
                    ⏱
                  </span>
                </div>
                <p className="text-4xl sm:text-5xl font-semibold tracking-tight tabular-nums text-tinta">
                  {data.menggantung}
                </p>
              </div>
              <div className="pt-2 border-t border-garis-halus/60 text-xs font-medium text-tinta-redup">
                {TEKS.STATUS_MENGGANTUNG}
              </div>
            </Kartu>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-bold tracking-tight text-tinta">{TEKS.K1_NERACA}</h2>
            <TabelNeraca judul={TEKS.K1_HARI_INI} total={data.hariIni} />
            <TabelNeraca judul={TEKS.K1_BULAN_INI} total={data.bulanIni} />
          </div>

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
        <section className="rounded-kartu border border-garis-halus bg-kertas p-4 shadow-xs">
          <PeriksaRantai kawasanId={kawasan.id} />
        </section>
      ) : null}
    </div>
  );
}
