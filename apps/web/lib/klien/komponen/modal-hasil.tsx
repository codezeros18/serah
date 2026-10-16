"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { TEKS } from "@serah/kontrak/teks";

export type JenisHasil = "sukses" | "gagal" | "offline";

export type HasilAksi = {
  jenis: JenisHasil;
  pesan: string;
  /** Judul pendek; bawaan menurut jenis. */
  judul?: string;
  /** Tutup otomatis setelah n ms (bawaan: sukses 2200, lainnya tidak). */
  otomatisMs?: number;
  /** Bila ada, muncul tombol "Coba lagi". */
  onCoba?: () => void;
  /** Untuk pengujian: dipasang pada isi hasil. */
  testId?: string;
};

const JUDUL: Record<JenisHasil, string> = {
  sukses: TEKS.HASIL_BERHASIL,
  gagal: TEKS.HASIL_GAGAL,
  offline: TEKS.HASIL_OFFLINE,
};

function Ikon({ jenis }: { jenis: JenisHasil }) {
  if (jenis === "sukses") {
    return (
      <svg viewBox="0 0 24 24" width="52" height="52" fill="none" aria-hidden="true" className="relative">
        <path className="gambar-centang" d="m5 12.500 4.500 4.500L19 7" stroke="currentColor" strokeWidth="2.600" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (jenis === "offline") {
    return (
      <svg viewBox="0 0 24 24" width="48" height="48" fill="none" aria-hidden="true" className="relative">
        <path d="M3.500 9.200a12 12 0 0 1 17 0M6.600 12.400a7.600 7.600 0 0 1 10.800 0M9.800 15.600a3 3 0 0 1 4.400 0" stroke="currentColor" strokeWidth="1.900" strokeLinecap="round" />
        <circle cx="12" cy="18.700" r="1.100" fill="currentColor" />
        <path d="M4 4l16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" aria-hidden="true" className="relative">
      <path d="M12 4.500 20.500 19h-17L12 4.500Z" stroke="currentColor" strokeWidth="1.900" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 10v4M12 16.800v.01" stroke="currentColor" strokeWidth="2.100" strokeLinecap="round" />
    </svg>
  );
}

const WARNA: Record<JenisHasil, { lingkaran: string; denyut: string }> = {
  sukses: { lingkaran: "bg-emerald-50 text-emerald-600", denyut: "bg-emerald-400/20" },
  gagal: { lingkaran: "bg-amber-50 text-amber-600", denyut: "bg-amber-400/20" },
  offline: { lingkaran: "bg-slate-100 text-slate-600", denyut: "bg-slate-400/20" },
};

/** Modal tengah untuk hasil sebuah aksi. Dipakai lewat useModalHasil(). */
export function ModalHasil({ hasil, onTutup }: { hasil: HasilAksi | null; onTutup: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (hasil && !d.open) d.showModal();
    if (!hasil && d.open) d.close();
  }, [hasil]);

  useEffect(() => {
    if (!hasil) return;
    const ms = hasil.otomatisMs ?? (hasil.jenis === "sukses" ? 2200 : 0);
    if (ms <= 0) return;
    const t = setTimeout(onTutup, ms);
    return () => clearTimeout(t);
  }, [hasil, onTutup]);

  const jenis = hasil?.jenis ?? "gagal";
  const w = WARNA[jenis];
  return (
    <dialog
      ref={ref}
      onClose={onTutup}
      onClick={(e) => {
        if (e.target === ref.current) onTutup();
      }}
      aria-label={hasil ? (hasil.judul ?? JUDUL[hasil.jenis]) : TEKS.HASIL_GAGAL}
      className="dropdown-masuk m-auto w-[min(22rem,calc(100vw-2rem))] rounded-[2rem] border-0 bg-kertas p-0 text-tinta shadow-[0_30px_90px_rgba(15,23,42,0.30)] backdrop:bg-tinta/40 backdrop:backdrop-blur-sm"
    >
      {hasil ? (
        <div className="relative flex flex-col items-center gap-5 px-6 pb-6 pt-9 text-center">
          <button
            type="button"
            onClick={onTutup}
            aria-label={TEKS.UMUM_TUTUP}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-latar text-tinta-redup transition-colors duration-200 hover:bg-aksi-latar hover:text-aksi active:scale-95"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          <span className={`relative flex h-24 w-24 items-center justify-center rounded-full ${w.lingkaran}`}>
            <span aria-hidden="true" className={`absolute inset-0 animate-ping rounded-full ${w.denyut}`} style={{ animationIterationCount: 2 }} />
            <Ikon jenis={hasil.jenis} />
          </span>

          <div role={hasil.jenis === "sukses" ? "status" : "alert"} className="flex flex-col gap-1.5">
            <h3 className="text-xl font-semibold tracking-tight text-tinta">{hasil.judul ?? JUDUL[hasil.jenis]}</h3>
            <p data-testid={hasil.testId} className="text-sm leading-relaxed text-tinta-redup">{hasil.pesan}</p>
          </div>

          {hasil.jenis !== "sukses" ? (
            <div className="grid w-full gap-2">
              {hasil.onCoba ? (
                <button
                  type="button"
                  onClick={() => {
                    const coba = hasil.onCoba;
                    onTutup();
                    coba?.();
                  }}
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-aksi text-sm font-semibold text-white shadow-[0_8px_20px_rgba(36,87,197,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-aksi-hover"
                >
                  {TEKS.UMUM_COBA_LAGI}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onTutup}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-garis-halus bg-kertas text-sm font-medium text-tinta transition-all duration-200 hover:border-aksi-garis hover:bg-aksi-latar hover:text-aksi"
              >
                {TEKS.UMUM_TUTUP}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}

/**
 * Hook: `const { tampil, galat, modal } = useModalHasil()`; render `{modal}` sekali di komponen.
 * `galat(pesan, onCoba)` memilih jenis offline bila pesannya G_OFFLINE.
 */
export function useModalHasil(): {
  tampil: (h: HasilAksi) => void;
  sukses: (pesan: string, opsi?: Partial<HasilAksi>) => void;
  galat: (pesan: string, onCoba?: () => void) => void;
  modal: ReactNode;
} {
  const [hasil, setHasil] = useState<HasilAksi | null>(null);
  const tutup = useCallback(() => setHasil(null), []);
  const tampil = useCallback((h: HasilAksi) => setHasil(h), []);
  const sukses = useCallback((pesan: string, opsi?: Partial<HasilAksi>) => setHasil({ jenis: "sukses", pesan, ...opsi }), []);
  const galat = useCallback(
    (pesan: string, onCoba?: () => void) =>
      setHasil({ jenis: pesan === TEKS.G_OFFLINE ? "offline" : "gagal", pesan, ...(onCoba ? { onCoba } : {}) }),
    [],
  );
  return { tampil, sukses, galat, modal: <ModalHasil hasil={hasil} onTutup={tutup} /> };
}
