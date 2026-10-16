"use client";

import { useEffect, useRef, useState } from "react";
import { TEKS, isi } from "@serah/kontrak/teks";
import { BannerGalat, Tombol } from "@serah/ui";
import { panggil } from "../api";

type Hasil = { utuh: boolean; teks: string };

/** Tombol periksa rantai satu kawasan; hasilnya tampil di modal tengah (T_RANTAI_UTUH / T_RANTAI_PATAH). */
export function PeriksaRantai({ kawasanId, ringkas = false }: { kawasanId: string; ringkas?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [buka, setBuka] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (buka && !d.open) d.showModal();
    if (!buka && d.open) d.close();
  }, [buka]);

  async function periksa() {
    setHasil(null);
    setGalat(null);
    setSibuk(true);
    setBuka(true);
    const h = await panggil("GET", "/api/rantai/verifikasi", { kueri: { kawasanId } });
    setSibuk(false);
    if (!h.ok) {
      setGalat(h.pesan);
      return;
    }
    setHasil({
      utuh: h.data.utuh,
      teks: h.data.utuh
        ? isi("T_RANTAI_UTUH", { jumlah: h.data.jumlah })
        : isi("T_RANTAI_PATAH", { urutan: h.data.patahDiUrutan ?? 1 }),
    });
  }

  const tutup = () => setBuka(false);

  return (
    <div className="flex flex-col gap-2">
      {ringkas ? (
        <button
          type="button"
          disabled={sibuk}
          onClick={() => void periksa()}
          data-aksi="periksa-rantai"
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-garis-halus bg-white/80 px-4 text-sm font-medium text-tinta shadow-[0_2px_8px_rgba(15,23,42,0.05)] backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-aksi-garis hover:bg-aksi-latar hover:text-aksi disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
            <path d="M12 3.500 19 6.500v5.200c0 4.300-2.900 7.200-7 8.800-4.100-1.600-7-4.500-7-8.800V6.500l7-3Z" stroke="currentColor" strokeWidth="1.900" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {TEKS.RANTAI_JUDUL}
        </button>
      ) : (
        <Tombol varian="sekunder" disabled={sibuk} onClick={() => void periksa()} data-aksi="periksa-rantai">
          {TEKS.RANTAI_PERIKSA}
        </Tombol>
      )}

      <dialog
        ref={ref}
        onClose={tutup}
        onClick={(e) => {
          if (e.target === ref.current) tutup();
        }}
        aria-label={TEKS.RANTAI_JUDUL}
        className="dropdown-masuk m-auto w-[min(24rem,calc(100vw-2rem))] rounded-[2rem] border-0 bg-kertas p-0 text-tinta shadow-[0_30px_90px_rgba(15,23,42,0.30)] backdrop:bg-tinta/40 backdrop:backdrop-blur-sm"
      >
        <div className="relative flex flex-col items-center gap-5 px-6 pb-8 pt-10 text-center">
          <button
            type="button"
            onClick={tutup}
            aria-label={TEKS.UMUM_TUTUP}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-latar text-tinta-redup transition-colors duration-200 hover:bg-aksi-latar hover:text-aksi active:scale-95"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          {sibuk ? (
            <div role="status" className="flex flex-col items-center gap-4 py-4">
              <span className="h-12 w-12 animate-spin rounded-full border-[3px] border-aksi border-t-transparent" />
              <p className="text-sm text-tinta-redup">{TEKS.UMUM_MUAT}</p>
            </div>
          ) : null}

          {galat ? <BannerGalat pesan={galat} /> : null}

          {hasil ? (
            <>
              <span
                className={`relative flex h-24 w-24 items-center justify-center rounded-full ${
                  hasil.utuh ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-0 rounded-full ${hasil.utuh ? "bg-emerald-400/20" : "bg-amber-400/20"} animate-ping`}
                  style={{ animationIterationCount: 2 }}
                />
                {hasil.utuh ? (
                  <svg viewBox="0 0 24 24" width="52" height="52" fill="none" aria-hidden="true" className="relative">
                    <path className="gambar-centang" d="m5 12.500 4.500 4.500L19 7" stroke="currentColor" strokeWidth="2.600" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="48" height="48" fill="none" aria-hidden="true" className="relative">
                    <path d="M12 4.500 20.500 19h-17L12 4.500Z" stroke="currentColor" strokeWidth="1.900" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12 10v4M12 16.800v.01" stroke="currentColor" strokeWidth="2.100" strokeLinecap="round" />
                  </svg>
                )}
              </span>

              <div role="status" data-testid="hasil-rantai" data-utuh={hasil.utuh} className="flex flex-col gap-2">
                <h3 className="text-xl font-semibold tracking-tight text-tinta">
                  {hasil.utuh ? TEKS.RANTAI_HASIL_UTUH : TEKS.RANTAI_HASIL_PATAH}
                </h3>
                <p className="text-sm leading-relaxed text-tinta-redup">{hasil.teks}</p>
              </div>
            </>
          ) : null}
        </div>
      </dialog>
    </div>
  );
}
