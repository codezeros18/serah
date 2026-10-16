"use client";

import { useEffect, useId, useRef, useState } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { periodeSah, periodeSekarangWib } from "../periode";

const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"] as const;
const BULAN_PANJANG = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

function pecah(p: string): { tahun: number; bulan: number } {
  const [t, b] = p.split("-");
  return { tahun: Number(t), bulan: Number(b) };
}

const susun = (tahun: number, bulan: number) => `${tahun}-${String(bulan).padStart(2, "0")}`;

function Panah({ arah }: { arah: "kiri" | "kanan" }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path
        d={arah === "kiri" ? "m14.500 6-6 6 6 6" : "m9.500 6 6 6-6 6"}
        stroke="currentColor"
        strokeWidth="2.100"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Pemilih bulan (YYYY-MM) bergaya SERAH: kisi bulan, ganti tahun, pintasan "Bulan ini"/"Bulan lalu". */
export function PilihPeriode({ nilai, onUbah }: { nilai: string; onUbah: (p: string) => void }) {
  const sekarang = periodeSekarangWib();
  const { tahun: tahunSkrg, bulan: bulanSkrg } = pecah(sekarang);
  const aktif = periodeSah(nilai) ? pecah(nilai) : { tahun: tahunSkrg, bulan: bulanSkrg };

  const [buka, setBuka] = useState(false);
  const [tahunTampil, setTahunTampil] = useState(aktif.tahun);
  const akar = useRef<HTMLDivElement>(null);
  const idDaftar = useId();

  useEffect(() => {
    if (buka) setTahunTampil(aktif.tahun);
  }, [buka]);

  useEffect(() => {
    if (!buka) return;
    const luar = (e: PointerEvent) => {
      if (akar.current && !akar.current.contains(e.target as Node)) setBuka(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBuka(false);
    };
    document.addEventListener("pointerdown", luar);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", luar);
      document.removeEventListener("keydown", esc);
    };
  }, [buka]);

  function pilih(tahun: number, bulan: number) {
    const p = susun(tahun, bulan);
    if (periodeSah(p)) onUbah(p);
    setBuka(false);
  }

  const lalu = bulanSkrg === 1 ? { t: tahunSkrg - 1, b: 12 } : { t: tahunSkrg, b: bulanSkrg - 1 };
  const sudahMasaDepan = (tahun: number, bulan: number) => tahun > tahunSkrg || (tahun === tahunSkrg && bulan > bulanSkrg);

  return (
    <div ref={akar} className="relative flex w-full max-w-xs flex-col gap-2">
      <label htmlFor="periode" className="text-sm font-medium text-tinta">
        {TEKS.UMUM_PERIODE}
      </label>

      <button
        id="periode"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={buka}
        aria-controls={idDaftar}
        onClick={() => setBuka((b) => !b)}
        className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border bg-kertas px-4 text-left text-base text-tinta shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:border-garis focus:outline-none focus-visible:ring-4 focus-visible:ring-aksi/15 ${
          buka ? "border-aksi ring-4 ring-aksi/15" : "border-garis-halus"
        }`}
      >
        <span className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-aksi-latar text-aksi">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
              <rect x="4" y="5.500" width="16" height="14.500" rx="3" stroke="currentColor" strokeWidth="1.800" />
              <path d="M8 3.500v4M16 3.500v4M4 10.500h16" stroke="currentColor" strokeWidth="1.800" strokeLinecap="round" />
            </svg>
          </span>
          <span className="font-medium">
            {BULAN_PANJANG[aktif.bulan - 1]} {aktif.tahun}
          </span>
        </span>
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          aria-hidden="true"
          className={`shrink-0 text-tinta-redup transition-transform duration-200 ${buka ? "rotate-180 text-aksi" : ""}`}
        >
          <path d="m6 9.500 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {buka ? <div aria-hidden="true" onClick={() => setBuka(false)} className="fixed inset-0 z-40 bg-tinta/30 backdrop-blur-sm sm:hidden" /> : null}

      {buka ? (
        <div
          id={idDaftar}
          role="dialog"
          aria-label={TEKS.UMUM_PERIODE}
          className="dropdown-masuk z-50 border border-garis-halus bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.18)] max-sm:fixed max-sm:inset-x-3 max-sm:bottom-3 max-sm:rounded-3xl sm:absolute sm:left-0 sm:top-full sm:mt-2 sm:w-[19rem] sm:origin-top-left sm:rounded-3xl"
        >
          {/* Tahun */}
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              aria-label={String(tahunTampil - 1)}
              onClick={() => setTahunTampil((t) => t - 1)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-latar text-tinta transition-colors hover:bg-aksi-latar hover:text-aksi active:scale-95"
            >
              <Panah arah="kiri" />
            </button>
            <span className="text-base font-semibold tabular-nums text-tinta">{tahunTampil}</span>
            <button
              type="button"
              aria-label={String(tahunTampil + 1)}
              onClick={() => setTahunTampil((t) => t + 1)}
              disabled={tahunTampil >= tahunSkrg}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-latar text-tinta transition-colors hover:bg-aksi-latar hover:text-aksi active:scale-95 disabled:opacity-40 disabled:hover:bg-latar disabled:hover:text-tinta"
            >
              <Panah arah="kanan" />
            </button>
          </div>

          {/* Kisi bulan */}
          <div className="grid grid-cols-3 gap-2">
            {BULAN_PENDEK.map((nama, i) => {
              const bulan = i + 1;
              const dipilih = tahunTampil === aktif.tahun && bulan === aktif.bulan;
              const iniBulan = tahunTampil === tahunSkrg && bulan === bulanSkrg;
              const mati = sudahMasaDepan(tahunTampil, bulan);
              return (
                <button
                  key={nama}
                  type="button"
                  disabled={mati}
                  aria-pressed={dipilih}
                  aria-label={`${BULAN_PANJANG[i]} ${tahunTampil}`}
                  onClick={() => pilih(tahunTampil, bulan)}
                  className={`relative flex min-h-12 items-center justify-center rounded-2xl text-sm font-medium transition-all duration-150 active:scale-95 ${
                    dipilih
                      ? "bg-tinta text-white shadow-[0_8px_20px_rgba(15,23,42,0.2)]"
                      : mati
                        ? "cursor-not-allowed text-garis"
                        : "bg-latar text-tinta hover:bg-aksi-latar hover:text-aksi"
                  }`}
                >
                  {nama}
                  {iniBulan && !dipilih ? (
                    <span aria-hidden="true" className="absolute bottom-1.5 h-1 w-1 rounded-full bg-aksi" />
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Pintasan */}
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-garis-halus pt-3">
            <button
              type="button"
              onClick={() => pilih(lalu.t, lalu.b)}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-garis-halus bg-kertas text-sm font-medium text-tinta transition-all hover:border-aksi-garis hover:bg-aksi-latar hover:text-aksi"
            >
              Bulan lalu
            </button>
            <button
              type="button"
              onClick={() => pilih(tahunSkrg, bulanSkrg)}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-aksi text-sm font-medium text-white shadow-[0_8px_20px_rgba(36,87,197,0.28)] transition-all hover:-translate-y-0.5 hover:bg-aksi-hover"
            >
              Bulan ini
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
