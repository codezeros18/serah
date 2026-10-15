"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";
import type { PihakLaporan } from "@serah/kontrak/enum";
import type { LaporanKeluaran } from "@serah/kontrak";
import { TEKS, isi } from "@serah/kontrak/teks";
import { BannerGalat, Kosong, LencanaAliran, Tabel, Tombol, KUNCI_STATUS, type KolomTabel } from "@serah/ui";
import { panggil } from "../api";
import { formatGramKeKg } from "../angka";
import { unduhBerkas } from "../unduh";
import { TombolBerhak } from "./tombol-berhak";

type Laporan = z.infer<typeof LaporanKeluaran>;
type Baris = Laporan["baris"][number];

const JUDUL: Record<PihakLaporan, "LAPORAN_KAWASAN" | "LAPORAN_PENGANGKUT" | "LAPORAN_PENERIMA"> = {
  kawasan: "LAPORAN_KAWASAN",
  pengangkut: "LAPORAN_PENGANGKUT",
  penerima: "LAPORAN_PENERIMA",
};

const kg = (g: number) => formatGramKeKg(g);

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
  if (!data) return <p role="status" className="text-base">{TEKS.UMUM_MUAT}</p>;

  const kolom: KolomTabel<Baris>[] = [
    { kunci: "tgl", judul: TEKS.KOL_TANGGAL, sel: (b) => b.tanggalWib },
    {
      kunci: "kode",
      judul: TEKS.KOL_KODE_SERAH,
      sel: (b) => (
        <Link href={`/serah/${b.kodeSerah}`} className="font-mono underline">
          {b.kodeSerah}
        </Link>
      ),
    },
    { kunci: "aliran", judul: TEKS.KOL_ALIRAN, sel: (b) => <LencanaAliran aliran={b.aliran} pendek /> },
    { kunci: "tps", judul: TEKS.KOL_BERAT_TPS, angka: true, sel: (b) => kg(b.beratTpsG) },
    { kunci: "terima", judul: TEKS.KOL_BERAT_DITERIMA, angka: true, sel: (b) => kg(b.beratDiterimaG) },
    { kunci: "tolak", judul: TEKS.KOL_BERAT_DITOLAK, angka: true, sel: (b) => kg(b.beratDitolakG) },
    { kunci: "alasan", judul: TEKS.KOL_ALASAN, sel: (b) => (b.alasanTolak ? TEKS[`ALASAN_${b.alasanTolak}`] : "—") },
    { kunci: "lokasi", judul: TEKS.KOL_LOKASI, sel: (b) => `${b.tpsKode} · ${b.kawasanNama}` },
    { kunci: "angkut", judul: TEKS.KOL_PENGANGKUT, sel: (b) => b.pengangkutNama ?? "—" },
    { kunci: "plat", judul: TEKS.KOL_PLAT, sel: (b) => b.plat ?? "—" },
    { kunci: "tujuan", judul: TEKS.KOL_TUJUAN, sel: (b) => b.penerimaNama ?? "—" },
    { kunci: "status", judul: TEKS.KOL_STATUS, sel: (b) => TEKS[KUNCI_STATUS[b.status]] },
    { kunci: "sidik", judul: TEKS.KOL_SIDIK, sel: (b) => <span className="font-mono">{b.sidikEvent.slice(0, 8)}</span> },
  ];

  return (
    <div className="flex flex-col gap-4" data-testid={`laporan-${pihak}`}>
      <h2 className="text-lg font-bold">{TEKS[JUDUL[pihak]]}</h2>
      {data.baris.length === 0 ? (
        <Kosong teks={TEKS.K_KOSONG_BULAN} />
      ) : (
        <>
          <Tabel keterangan={TEKS[JUDUL[pihak]]} kolom={kolom} baris={data.baris} kunciBaris={(b) => `${b.kodeSerah}-${b.aliran}`} />
          <div data-testid="total-laporan" className="flex flex-col gap-2">
            <h3 className="text-base font-bold">{TEKS.LAPORAN_TOTAL}</h3>
            <ul className="flex flex-col gap-1">
              {data.total.map((t) => (
                <li key={t.aliran} data-aliran-total={t.aliran} className="flex flex-wrap items-center gap-3">
                  <LencanaAliran aliran={t.aliran} pendek />
                  <span>{`${TEKS.KOL_BERAT_TPS}: ${isi("UMUM_KG", { nilai: kg(t.beratTpsG) })}`}</span>
                  <span>{`${TEKS.KOL_BERAT_DITERIMA}: ${isi("UMUM_KG", { nilai: kg(t.beratDiterimaG) })}`}</span>
                  <span>{`${TEKS.KOL_BERAT_DITOLAK}: ${isi("UMUM_KG", { nilai: kg(t.beratDitolakG) })}`}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      <div className="flex flex-wrap items-start gap-3">
        <Tombol varian="sekunder" data-ekspor="csv" onClick={() => void unduh("csv")}>
          {TEKS.EKSPOR_CSV}
        </Tombol>
        <TombolBerhak kunci="ekspor.pdf" onLanjut={() => void unduh("pdf")}>
          {TEKS.EKSPOR_PDF}
        </TombolBerhak>
      </div>
      {pesanUnduh ? <BannerGalat pesan={pesanUnduh} /> : null}
    </div>
  );
}
