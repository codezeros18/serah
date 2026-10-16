"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { z } from "zod";
import type { LaporanKeluaran, RingkasanKeluaran } from "@serah/kontrak";
import type { Aliran } from "@serah/kontrak/enum";
import { TEKS, isi } from "@serah/kontrak/teks";
import { KUNCI_ALIRAN_PENDEK, LencanaAliran, LencanaStatus } from "@serah/ui";
import { formatGramKeKg } from "@/lib/klien/angka";
import { deretHarian, jumlahTotal, mutuPemilahan, perubahanPersen, persen } from "@/lib/klien/statistik";
import { LegendaIkon } from "@/lib/klien/komponen/legenda-ikon";
import {
  BarisMetrik,
  BilahSegmen,
  ChipDelta,
  Gauge,
  GrafikArea,
  KartuViz,
  StripKpi,
  WARNA_ALIRAN,
  type Segmen,
} from "@/lib/klien/komponen/viz";

type Ringkasan = z.infer<typeof RingkasanKeluaran>;
type Laporan = z.infer<typeof LaporanKeluaran>;

const kg = (g: number) => isi("UMUM_KG", { nilai: formatGramKeKg(g) });

function hariIniWib(): number {
  const h = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", day: "2-digit" }).format(new Date());
  return Number(h);
}

/** Carousel wawasan: berputar otomatis, bisa diketuk. */
function Wawasan({ daftar }: { daftar: readonly string[] }) {
  const [i, setI] = useState(0);
  const [jeda, setJeda] = useState(false);
  useEffect(() => {
    if (jeda || daftar.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % daftar.length), 6000);
    return () => clearInterval(t);
  }, [jeda, daftar.length]);
  const idx = Math.min(i, Math.max(0, daftar.length - 1));
  return (
    <div className="flex h-full flex-col justify-between gap-5" onMouseEnter={() => setJeda(true)} onMouseLeave={() => setJeda(false)}>
      <div className="flex flex-col gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-aksi-latar text-aksi">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
            <path d="M4 17 9 11l3.500 3.500L20 6M15 6h5v5" stroke="currentColor" strokeWidth="1.900" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p key={idx} className="hero-masuk text-base font-medium leading-relaxed text-tinta">
          {daftar[idx]}
        </p>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {daftar.map((_, n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n + 1}`}
              onClick={() => setI(n)}
              className={`h-1.5 rounded-full transition-all duration-300 ${n === idx ? "w-5 bg-aksi" : "w-1.5 bg-garis hover:bg-aksi-garis"}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-1">
          {(["‹", "›"] as const).map((t, n) => (
            <button
              key={t}
              type="button"
              aria-label={n === 0 ? "‹" : "›"}
              onClick={() => setI((x) => (x + (n === 0 ? -1 : 1) + daftar.length) % daftar.length)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-latar text-lg text-tinta transition-colors hover:bg-aksi-latar hover:text-aksi"
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Dasbor pengelola: mutu pemilahan, tren harian, komposisi aliran, tindakan, serah terbaru, wawasan. */
export function DasborKawasan({
  periode,
  data,
  sebelumnya,
  baris,
}: {
  periode: string;
  data: Ringkasan;
  sebelumnya: Ringkasan | null;
  baris: Laporan["baris"] | null;
}) {
  const sekarang = jumlahTotal(data.bulanIni);
  const lalu = sebelumnya ? jumlahTotal(sebelumnya.bulanIni) : null;
  const mutu = mutuPemilahan(data.bulanIni);
  const mutuLalu = sebelumnya ? mutuPemilahan(sebelumnya.bulanIni) : null;
  const deltaMutu = mutu !== null && mutuLalu !== null ? Math.round((mutu - mutuLalu) * 10) / 10 : null;

  const segmen: Segmen[] = data.bulanIni.map((t) => ({
    kunci: t.aliran,
    label: TEKS[KUNCI_ALIRAN_PENDEK[t.aliran]],
    nilai: t.beratTpsG,
    warna: WARNA_ALIRAN[t.aliran],
    teksNilai: kg(t.beratTpsG),
  }));

  const tren = useMemo(
    () =>
      baris
        ? deretHarian(baris, periode, hariIniWib()).map((d) => ({
            label: `${d.hari}`,
            nilai: d.tpsG,
            nilai2: d.diterimaG,
          }))
        : [],
    [baris, periode],
  );

  const terbaru = useMemo(() => {
    if (!baris) return [];
    const per = new Map<string, { kode: string; tanggal: string; tps: string; status: Laporan["baris"][number]["status"]; aliran: Aliran[] }>();
    for (const b of baris) {
      const ada = per.get(b.kodeSerah);
      if (ada) {
        if (!ada.aliran.includes(b.aliran)) ada.aliran.push(b.aliran);
      } else {
        per.set(b.kodeSerah, { kode: b.kodeSerah, tanggal: b.tanggalWib, tps: b.tpsKode, status: b.status, aliran: [b.aliran] });
      }
    }
    return [...per.values()].sort((a, b) => (a.tanggal === b.tanggal ? b.kode.localeCompare(a.kode) : b.tanggal.localeCompare(a.tanggal))).slice(0, 6);
  }, [baris]);

  const wawasan = useMemo(() => {
    const w: string[] = [];
    if (deltaMutu !== null) {
      if (deltaMutu > 0) w.push(isi("INSIGHT_MUTU_NAIK", { poin: deltaMutu.toLocaleString("id-ID") }));
      else if (deltaMutu < 0) w.push(isi("INSIGHT_MUTU_TURUN", { poin: Math.abs(deltaMutu).toLocaleString("id-ID") }));
      else w.push(TEKS.INSIGHT_MUTU_TETAP);
    }
    const terbanyak = [...data.bulanIni].sort((a, b) => b.beratTpsG - a.beratTpsG)[0];
    if (terbanyak && terbanyak.beratTpsG > 0) {
      w.push(
        isi("INSIGHT_TERBANYAK", {
          aliran: TEKS[KUNCI_ALIRAN_PENDEK[terbanyak.aliran]],
          persen: persen(terbanyak.beratTpsG, sekarang.tps).toLocaleString("id-ID"),
        }),
      );
    }
    w.push(sekarang.ditolak > 0 ? isi("INSIGHT_DITOLAK", { berat: formatGramKeKg(sekarang.ditolak) }) : TEKS.INSIGHT_BERSIH);
    return w;
  }, [data.bulanIni, deltaMutu, sekarang.ditolak, sekarang.tps]);

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {/* Mutu pemilahan */}
      <KartuViz judul="Mutu pemilahan" info={{ judul: "Mutu pemilahan", isi: TEKS.INFO_MUTU }} className="lg:col-span-4">
        <Gauge
          nilai={mutu}
          label={TEKS.K1_BULAN_INI}
          subteks={
            <span className="inline-flex items-center gap-2 text-xs text-tinta-redup">
              <ChipDelta nilai={deltaMutu} satuan=" poin" />
              vs bulan lalu
            </span>
          }
        />
        <div className="flex flex-col">
          <BarisMetrik
            label={TEKS.K1_DICATAT}
            delta={<ChipDelta nilai={lalu ? perubahanPersen(sekarang.tps, lalu.tps) : null} />}
            nilai={kg(sekarang.tps)}
          />
          <BarisMetrik
            label={TEKS.K1_DITERIMA}
            delta={<ChipDelta nilai={lalu ? perubahanPersen(sekarang.diterima, lalu.diterima) : null} />}
            nilai={kg(sekarang.diterima)}
            nada={sekarang.diterima > 0 ? "baik" : "netral"}
          />
          <BarisMetrik
            label={TEKS.K1_DITOLAK}
            delta={<ChipDelta nilai={lalu ? perubahanPersen(sekarang.ditolak, lalu.ditolak) : null} baikJikaNaik={false} />}
            nilai={kg(sekarang.ditolak)}
            nada={sekarang.ditolak > 0 ? "waspada" : "netral"}
          />
        </div>
      </KartuViz>

      <div className="flex flex-col gap-4 lg:col-span-8">
        {/* Tindakan */}
        <KartuViz
          judul="Perlu tindakan"
          kanan={
            data.menungguSetuju > 0 ? (
              <Link
                href="/kawasan/setujui"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-aksi px-3.5 text-xs font-medium text-white shadow-[0_6px_16px_rgba(36,87,197,0.28)] transition-all hover:-translate-y-0.5 hover:bg-aksi-hover"
              >
                {TEKS.UMUM_LIHAT_DETAIL}
                <span aria-hidden="true">→</span>
              </Link>
            ) : null
          }
        >
          <StripKpi
            item={[
              { kunci: "setuju", label: TEKS.K1_MENUNGGU_SETUJU, nilai: data.menungguSetuju, nada: data.menungguSetuju > 0 ? "aksi" : "netral", testId: "menunggu-setuju" },
              { kunci: "gantung", label: TEKS.K1_MENGGANTUNG, nilai: data.menggantung, nada: data.menggantung > 0 ? "waspada" : "netral", testId: "menggantung" },
              { kunci: "prioritas", label: TEKS.K1_PRIORITAS, nilai: data.prioritas.length, nada: data.prioritas.length > 0 ? "waspada" : "netral" },
              { kunci: "peringatan", label: TEKS.K1_PERINGATAN, nilai: data.peringatan.length, nada: data.peringatan.length > 0 ? "buruk" : "netral" },
            ]}
          />
        </KartuViz>

        {/* Tren harian */}
        <KartuViz judul="Tren harian" info={{ judul: "Tren harian", isi: TEKS.INFO_TREN }}>
          {baris ? (
            <GrafikArea data={tren} format={kg} label1={TEKS.K1_DICATAT} label2={TEKS.K1_DITERIMA} />
          ) : (
            <div className="h-56 animate-pulse rounded-2xl bg-latar" aria-hidden="true" />
          )}
        </KartuViz>
      </div>

      {/* Komposisi aliran */}
      <KartuViz judul="Komposisi aliran" info={{ judul: "Komposisi aliran", isi: TEKS.INFO_KOMPOSISI }} kanan={<LegendaIkon bagian="aliran" />} className="lg:col-span-4">
        <BilahSegmen segmen={segmen} />
      </KartuViz>

      {/* Serah terbaru */}
      <KartuViz judul="Serah terbaru" kanan={<LegendaIkon />} className="lg:col-span-5">
        {terbaru.length === 0 ? (
          <p className="rounded-2xl bg-latar px-4 py-6 text-center text-sm text-tinta-redup">{TEKS.K_KOSONG_BULAN}</p>
        ) : (
          <ul className="flex flex-col">
            {terbaru.map((s) => (
              <li key={s.kode} className="border-t border-garis-halus/70 first:border-t-0">
                <Link
                  href={`/serah/${s.kode}`}
                  className="group flex items-center gap-3 rounded-xl px-1 py-3 transition-colors hover:bg-aksi-latar/40"
                >
                  <span className="flex -space-x-2">
                    {s.aliran.slice(0, 4).map((a) => (
                      <LencanaAliran key={a} aliran={a} pendek ikon />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-xs font-medium text-tinta">{s.kode}</span>
                    <span className="block truncate text-xs text-tinta-redup">
                      {s.tanggal} · {s.tps}
                    </span>
                  </span>
                  <LencanaStatus status={s.status} ikon />
                  <span aria-hidden="true" className="text-tinta-redup transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-aksi">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </KartuViz>

      {/* Wawasan */}
      <KartuViz judul="Wawasan" className="lg:col-span-3">
        <Wawasan daftar={wawasan} />
      </KartuViz>
    </div>
  );
}
