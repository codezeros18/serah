"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";
import type { PihakLaporan } from "@serah/kontrak/enum";
import type { LaporanKeluaran } from "@serah/kontrak";
import { TEKS, isi } from "@serah/kontrak/teks";
import { BannerGalat, Kosong, LencanaAliran, LencanaStatus, Tabel, type KolomTabel } from "@serah/ui";
import { panggil } from "../api";
import { formatGramKeKg } from "../angka";
import { unduhBerkas } from "../unduh";
import { Rangka } from "./rangka";
import { TombolBerhak } from "./tombol-berhak";

type Laporan = z.infer<typeof LaporanKeluaran>;
type Baris = Laporan["baris"][number];

const JUDUL: Record<PihakLaporan, "LAPORAN_KAWASAN" | "LAPORAN_PENGANGKUT" | "LAPORAN_PENERIMA"> = {
  kawasan: "LAPORAN_KAWASAN",
  pengangkut: "LAPORAN_PENGANGKUT",
  penerima: "LAPORAN_PENERIMA",
};

const kg = (g: number) => formatGramKeKg(g);

const KELAS_AKSI =
  "inline-flex min-h-11 items-center gap-2 rounded-2xl border border-garis-halus bg-white/80 px-4 text-sm font-medium text-tinta shadow-[0_2px_8px_rgba(15,23,42,0.05)] backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-aksi-garis hover:bg-aksi-latar hover:text-aksi active:translate-y-0 active:scale-[0.98]";

function IkonUnduh() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M12 4v10m0 0-4-4m4 4 4-4M5 19h14" stroke="currentColor" strokeWidth="1.900" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Tiga laporan memakai komponen dan rute yang sama; hanya `pihak` yang berbeda (BLUEPRINT §L.4). */
export function TabelLaporan({ pihak, periode, kawasanId }: { pihak: PihakLaporan; periode: string; kawasanId?: string }) {
  const [data, setData] = useState<Laporan | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [pesanUnduh, setPesanUnduh] = useState<string | null>(null);

  const muat = useCallback(async () => {
    setGalat(null);
    const h = await panggil("GET", "/api/laporan/[pihak]", {
      params: { pihak },
      kueri: { periode, ...(kawasanId ? { kawasanId } : {}) },
    });
    if (h.ok) setData(h.data);
    else setGalat(h.pesan);
  }, [pihak, periode, kawasanId]);

  useEffect(() => {
    setData(null);
    void muat();
  }, [muat]);

  async function unduh(format: "csv" | "pdf") {
    setPesanUnduh(null);
    const h = await unduhBerkas("/api/laporan/[pihak]/ekspor", {
      params: { pihak },
      kueri: { periode, format, ...(kawasanId ? { kawasanId } : {}) },
      namaCadangan: `laporan-${pihak}-${periode}.${format}`,
    });
    if (!h.ok) setPesanUnduh(h.pesan);
  }

  if (galat) return <BannerGalat pesan={galat} onCoba={() => void muat()} />;
  if (!data)
    return (
      <div role="status" className="flex flex-col gap-3">
        <span className="sr-only">{TEKS.UMUM_MUAT}</span>
        <Rangka className="h-12 w-full" />
        <Rangka className="h-64 w-full rounded-3xl" />
      </div>
    );

  const kolom: KolomTabel<Baris>[] = [
    { kunci: "tgl", judul: TEKS.KOL_TANGGAL, sel: (b) => <span className="tabular-nums">{b.tanggalWib}</span> },
    {
      kunci: "kode",
      judul: TEKS.KOL_KODE_SERAH,
      sel: (b) => (
        <Link
          href={`/serah/${b.kodeSerah}`}
          className="rounded-lg bg-latar px-2 py-1 font-mono text-xs font-medium text-aksi transition-colors hover:bg-aksi-latar"
        >
          {b.kodeSerah}
        </Link>
      ),
    },
    { kunci: "aliran", judul: TEKS.KOL_ALIRAN, sel: (b) => <LencanaAliran aliran={b.aliran} pendek ikon /> },
    { kunci: "tps", judul: TEKS.KOL_BERAT_TPS, angka: true, sel: (b) => kg(b.beratTpsG) },
    { kunci: "terima", judul: TEKS.KOL_BERAT_DITERIMA, angka: true, sel: (b) => kg(b.beratDiterimaG) },
    { kunci: "tolak", judul: TEKS.KOL_BERAT_DITOLAK, angka: true, sel: (b) => kg(b.beratDitolakG) },
    { kunci: "alasan", judul: TEKS.KOL_ALASAN, sel: (b) => (b.alasanTolak ? TEKS[`ALASAN_${b.alasanTolak}`] : "—") },
    { kunci: "lokasi", judul: TEKS.KOL_LOKASI, sel: (b) => `${b.tpsKode} · ${b.kawasanNama}` },
    { kunci: "angkut", judul: TEKS.KOL_PENGANGKUT, sel: (b) => b.pengangkutNama ?? "—" },
    { kunci: "plat", judul: TEKS.KOL_PLAT, sel: (b) => b.plat ?? "—" },
    { kunci: "tujuan", judul: TEKS.KOL_TUJUAN, sel: (b) => b.penerimaNama ?? "—" },
    { kunci: "status", judul: TEKS.KOL_STATUS, sel: (b) => <LencanaStatus status={b.status} ikon /> },
    { kunci: "sidik", judul: TEKS.KOL_SIDIK, sel: (b) => <span className="font-mono text-xs text-tinta-redup">{b.sidikEvent.slice(0, 8)}</span> },
  ];

  return (
    <div className="flex flex-col gap-5" data-testid={`laporan-${pihak}`}>
      {/* Judul + aksi unduh di atas */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-tinta">{TEKS[JUDUL[pihak]]}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" data-ekspor="csv" onClick={() => void unduh("csv")} className={KELAS_AKSI}>
            <IkonUnduh />
            {TEKS.EKSPOR_CSV}
          </button>
          <TombolBerhak kunci="ekspor.pdf" onLanjut={() => void unduh("pdf")} className={KELAS_AKSI}>
            <IkonUnduh />
            {TEKS.EKSPOR_PDF}
          </TombolBerhak>
        </div>
      </div>
      {pesanUnduh ? <BannerGalat pesan={pesanUnduh} /> : null}

      {data.baris.length === 0 ? (
        <Kosong teks={TEKS.K_KOSONG_BULAN} />
      ) : (
        <>
          <Tabel keterangan={TEKS[JUDUL[pihak]]} kolom={kolom} baris={data.baris} kunciBaris={(b) => `${b.kodeSerah}-${b.aliran}`} />

          <section
            data-testid="total-laporan"
            className="flex flex-col gap-4 rounded-3xl border border-white/70 bg-gradient-to-br from-white to-aksi-latar/50 p-5 shadow-[0_12px_40px_rgba(36,87,197,0.08)] ring-1 ring-garis-halus/60"
          >
            <h3 className="text-base font-semibold tracking-tight text-tinta">{TEKS.LAPORAN_TOTAL}</h3>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {data.total.map((t) => (
                <li
                  key={t.aliran}
                  data-aliran-total={t.aliran}
                  className="flex flex-col gap-3 rounded-2xl bg-white/80 p-4 shadow-[0_4px_16px_rgba(15,23,42,0.05)] ring-1 ring-garis-halus/70 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(36,87,197,0.10)]"
                >
                  <LencanaAliran aliran={t.aliran} pendek />
                  <dl className="grid grid-cols-3 gap-2 text-xs">
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-tinta-redup">{TEKS.K1_DICATAT}</dt>
                      <dd className="font-mono text-sm font-semibold tabular-nums text-tinta">{isi("UMUM_KG", { nilai: kg(t.beratTpsG) })}</dd>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-tinta-redup">{TEKS.K1_DITERIMA}</dt>
                      <dd className="font-mono text-sm font-semibold tabular-nums text-tinta">{isi("UMUM_KG", { nilai: kg(t.beratDiterimaG) })}</dd>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-tinta-redup">{TEKS.K1_DITOLAK}</dt>
                      <dd className="font-mono text-sm font-semibold tabular-nums text-tinta">{isi("UMUM_KG", { nilai: kg(t.beratDitolakG) })}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
