"use client";

import { useEffect, useState } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { IkonLanding, type NamaIkon } from "./ikon-landing";

const TAHAP = [
  TEKS.MASUK_TAHAP_1,
  TEKS.MASUK_TAHAP_2,
  TEKS.MASUK_TAHAP_3,
  TEKS.MASUK_TAHAP_4,
] as const;

const PIHAK: { ikon: NamaIkon; nama: string }[] = [
  { ikon: "tps", nama: TEKS.PERAN_PETUGAS },
  { ikon: "truk", nama: TEKS.PERAN_PENGANGKUT },
  { ikon: "timbang", nama: TEKS.PERAN_PENERIMA },
];

const STATUS = ["Draf", "Diangkut", "Ditutup", "Ditutup"] as const;

const KAWASAN: { ikon: NamaIkon; teks: string }[] = [
  { ikon: "pasar", teks: TEKS.LANDING_KAWASAN_1 },
  { ikon: "makan", teks: TEKS.LANDING_KAWASAN_2 },
  { ikon: "kuliner", teks: TEKS.LANDING_KAWASAN_3 },
  { ikon: "apartemen", teks: TEKS.LANDING_KAWASAN_4 },
];

/**
 * Peragaan MVP di panel kanan halaman masuk: satu serah bergerak dari catat → angkut → tutup,
 * lalu tiga laporan terisi dari catatan yang sama. Berputar otomatis; berhenti saat disorot kursor.
 */
export function VisualMvp() {
  const [tahap, setTahap] = useState(0);
  const [jeda, setJeda] = useState(false);

  useEffect(() => {
    if (jeda) return;
    const reduksi = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduksi) {
      setTahap(3);
      return;
    }
    const id = window.setInterval(() => setTahap((t) => (t + 1) % TAHAP.length), 3200);
    return () => window.clearInterval(id);
  }, [jeda]);

  const selesai = tahap >= 3;

  return (
    <div
      className="flex flex-col gap-6"
      onMouseEnter={() => setJeda(true)}
      onMouseLeave={() => setJeda(false)}
    >
      <div className="relative mx-auto w-full max-w-md pb-10 pt-6">
        {/* Kartu utama */}
        <div className="group rounded-3xl bg-white p-5 shadow-[0_30px_80px_rgba(10,25,80,0.35)] transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_40px_90px_rgba(10,25,80,0.45)]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-semibold text-tinta">SRH-0142</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors duration-500 ${
                tahap >= 2
                  ? "bg-status-selesai-latar text-status-selesai"
                  : tahap === 1
                    ? "bg-status-angkut-latar text-status-angkut"
                    : "bg-status-draf-latar text-status-draf"
              }`}
            >
              {STATUS[tahap]}
            </span>
          </div>

          <ol className="mt-4 flex flex-col gap-2">
            {PIHAK.map((p, i) => {
              const selesaiBaris = tahap > i || selesai;
              const aktif = tahap === i && !selesai;
              return (
                <li
                  key={p.nama}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-all duration-500 ${
                    aktif
                      ? "border-aksi-garis bg-aksi-latar shadow-[0_6px_18px_rgba(36,87,197,0.15)]"
                      : "border-garis-halus bg-white"
                  }`}
                >
                  <IkonLanding nama={p.ikon} className="h-7 w-7 shrink-0" />
                  <span className="flex-1 text-sm font-medium text-tinta">{p.nama}</span>
                  <span
                    aria-hidden="true"
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-all duration-500 ${
                      selesaiBaris
                        ? "scale-100 bg-status-selesai text-white"
                        : aktif
                          ? "animate-pulse bg-aksi text-white"
                          : "bg-latar text-tinta-redup"
                    }`}
                  >
                    {selesaiBaris ? "✓" : i + 1}
                  </span>
                </li>
              );
            })}
          </ol>

          {/* Tiga laporan terisi dari catatan yang sama */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {PIHAK.map((p, i) => (
              <div key={p.nama} className="rounded-2xl bg-latar p-3">
                <p className="truncate text-[11px] text-tinta-redup">{p.nama}</p>
                <p
                  className={`mt-1 font-mono text-sm font-semibold transition-all duration-700 ${
                    selesai ? "text-tinta opacity-100" : "text-garis opacity-70"
                  }`}
                  style={{ transitionDelay: selesai ? `${i * 120}ms` : "0ms" }}
                >
                  {selesai ? "1.240 kg" : "— kg"}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-aksi transition-all duration-1000 ease-out"
                    style={{
                      width: selesai ? "100%" : "0%",
                      transitionDelay: selesai ? `${i * 150}ms` : "0ms",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Kartu aturan: muncul saat pengangkut memindai */}
        <div className="ikon-melayang pointer-events-none absolute -left-4 bottom-0 w-64 sm:-left-10">
          <div
            className={`flex items-start gap-3 rounded-2xl bg-white p-3 shadow-[0_16px_40px_rgba(10,25,80,0.30)] transition-all duration-500 ${
              tahap === 1 ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
            }`}
          >
            <IkonLanding nama="aturan" className="mt-0.5 h-6 w-6 shrink-0" />
            <div>
              <p className="text-xs font-medium leading-snug text-tinta">{TEKS.MASUK_TOLAK}</p>
              <p className="mt-0.5 text-[11px] text-tinta-redup">{TEKS.MASUK_TOLAK_PASAL}</p>
            </div>
          </div>
        </div>

        {/* Kartu rantai catatan: muncul saat serah ditutup */}
        <div className="ikon-melayang pointer-events-none absolute -right-3 top-0 sm:-right-8">
          <div
            className={`flex items-center gap-2 rounded-2xl bg-white px-3 py-2.5 shadow-[0_16px_40px_rgba(10,25,80,0.30)] transition-all duration-500 ${
              tahap >= 2 ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
            }`}
          >
            <IkonLanding nama="rantai" className="h-5 w-5" />
            <span className="font-mono text-[11px] text-tinta">sha256 · a41f…9c2e</span>
          </div>
        </div>
      </div>

      {/* Keterangan tahap + indikator */}
      <div className="flex flex-col items-center gap-3 text-center">
        <p key={tahap} className="hero-masuk min-h-6 text-sm font-medium text-white">
          {TAHAP[tahap]}
        </p>
        <div className="flex items-center gap-2">
          {TAHAP.map((t, i) => (
            <button
              key={t}
              type="button"
              aria-label={t}
              onClick={() => setTahap(i)}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === tahap ? "w-8 bg-white" : "w-3 bg-white/35 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      </div>

      <ul className="flex flex-wrap items-center justify-center gap-2">
        {KAWASAN.map((k) => (
          <li
            key={k.teks}
            className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-white/15 transition-colors duration-300 hover:bg-white/20"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white">
              <IkonLanding nama={k.ikon} className="h-3.5 w-3.5" />
            </span>
            {k.teks}
          </li>
        ))}
      </ul>
    </div>
  );
}
