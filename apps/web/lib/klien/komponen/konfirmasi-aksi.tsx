"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { TEKS, isi } from "@serah/kontrak/teks";

/**
 * Tingkat konfirmasi (dipilih sesuai risiko & kondisi lapangan):
 * - "biasa": ringkasan + dua tombol terpisah (Batal / Konfirmasi). Untuk aksi yang bisa diulang.
 * - "tahan": tombol harus DITAHAN sampai penuh. Untuk aksi berdampak; tidak butuh keyboard,
 *            aman dari sentuhan tak sengaja (tangan basah/bersarung).
 * - "ketik": ketik kode pendek. Untuk aksi tak terpulihkan di desktop.
 */
export type TingkatKonfirmasi = "biasa" | "tahan" | "ketik";

const DURASI_TAHAN_MS = 1200;

function TombolTahan({
  label,
  bahaya,
  sibuk,
  onSelesai,
}: {
  label: string;
  bahaya: boolean;
  sibuk: boolean;
  onSelesai: () => void;
}) {
  const [progres, setProgres] = useState(0);
  const mulai = useRef<number | null>(null);
  const bingkai = useRef<number | null>(null);
  const selesai = useRef(false);

  const hentikan = useCallback(() => {
    mulai.current = null;
    if (bingkai.current !== null) cancelAnimationFrame(bingkai.current);
    bingkai.current = null;
    if (!selesai.current) setProgres(0);
  }, []);

  const langkah = useCallback(
    (t: number) => {
      if (mulai.current === null) return;
      const p = Math.min(1, (t - mulai.current) / DURASI_TAHAN_MS);
      setProgres(p);
      if (p >= 1) {
        selesai.current = true;
        mulai.current = null;
        onSelesai();
        return;
      }
      bingkai.current = requestAnimationFrame(langkah);
    },
    [onSelesai],
  );

  const mulaiTahan = useCallback(() => {
    if (sibuk || mulai.current !== null) return;
    selesai.current = false;
    mulai.current = performance.now();
    bingkai.current = requestAnimationFrame(langkah);
  }, [langkah, sibuk]);

  useEffect(() => () => hentikan(), [hentikan]);

  return (
    <button
      type="button"
      disabled={sibuk}
      aria-label={`${label}. ${TEKS.KONF_TAHAN}`}
      onPointerDown={mulaiTahan}
      onPointerUp={hentikan}
      onPointerLeave={hentikan}
      onPointerCancel={hentikan}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          mulaiTahan();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") hentikan();
      }}
      style={{ touchAction: "none" }}
      className={`relative flex min-h-14 w-full select-none items-center justify-center overflow-hidden rounded-2xl text-base font-semibold text-white transition-transform duration-150 active:scale-[0.99] disabled:opacity-60 ${
        bahaya ? "bg-tinta" : "bg-aksi"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 ${bahaya ? "bg-status-tolak" : "bg-aksi-hover"}`}
        style={{ width: `${progres * 100}%` }}
      />
      <span className="relative flex items-center gap-2">
        {sibuk ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {sibuk ? TEKS.UMUM_MUAT : progres > 0 ? label : `${label} · ${TEKS.KONF_TAHAN_PENDEK}`}
      </span>
    </button>
  );
}

/** Lembar konfirmasi aksi (bottom sheet di HP). Tutup lewat ikon X di kanan atas atau Esc. */
export function KonfirmasiAksi({
  terbuka,
  judul,
  tingkat = "biasa",
  bahaya = false,
  kode,
  labelKonfirmasi,
  sibuk = false,
  onKonfirmasi,
  onTutup,
  children,
}: {
  terbuka: boolean;
  judul: string;
  tingkat?: TingkatKonfirmasi;
  /** Aksi menghilangkan/menonaktifkan sesuatu: warna gelap + ikon peringatan. */
  bahaya?: boolean;
  /** Kode yang harus diketik (tingkat "ketik"). */
  kode?: string;
  labelKonfirmasi: string;
  sibuk?: boolean;
  onKonfirmasi: () => void;
  onTutup: () => void;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const idJudul = useId();
  const [ketikan, setKetikan] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (terbuka && !d.open) d.showModal();
    if (!terbuka && d.open) d.close();
    if (!terbuka) setKetikan("");
  }, [terbuka]);

  const cocok = tingkat !== "ketik" || (kode !== undefined && ketikan.trim().toUpperCase() === kode.toUpperCase());

  return (
    <dialog
      ref={ref}
      aria-labelledby={idJudul}
      onClose={onTutup}
      className="lembar gulir-halus max-h-[92dvh] overflow-y-auto m-0 mt-auto w-full max-w-none rounded-t-[2rem] border-0 bg-kertas p-0 text-tinta shadow-[0_-20px_60px_rgba(15,23,42,0.25)] backdrop:bg-tinta/40 backdrop:backdrop-blur-sm sm:m-auto sm:max-w-md sm:rounded-[2rem]"
    >
      <div className="flex flex-col gap-5 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <span aria-hidden="true" className="mx-auto h-1.5 w-10 rounded-full bg-garis-halus sm:hidden" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-semibold ${
                bahaya ? "bg-peringatan-latar text-peringatan" : "bg-aksi-latar text-aksi"
              }`}
            >
              {bahaya ? "!" : "?"}
            </span>
            <div className="min-w-0">
              <h2 id={idJudul} className="text-lg font-semibold leading-snug tracking-tight text-tinta">
                {judul}
              </h2>
              <p className="text-xs text-tinta-redup">{TEKS.KONF_PERIKSA}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onTutup}
            aria-label={TEKS.UMUM_TUTUP}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-latar text-tinta-redup transition-colors duration-200 hover:bg-aksi-latar hover:text-aksi active:scale-95"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {children ? <div className="rounded-2xl bg-latar p-4 text-sm leading-relaxed text-tinta">{children}</div> : null}

        {tingkat === "ketik" && kode ? (
          <label className="flex flex-col gap-2 text-sm font-medium text-tinta">
            {isi("KONF_KETIK", { kode })}
            <input
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              value={ketikan}
              onChange={(e) => setKetikan(e.target.value)}
              className="min-h-14 rounded-2xl border border-garis-halus bg-kertas px-4 text-center font-mono text-xl font-semibold uppercase tracking-[0.3em] text-tinta transition-all focus:border-aksi focus:outline-none focus:ring-4 focus:ring-aksi/15"
            />
          </label>
        ) : null}

        {tingkat === "tahan" ? (
          <div className="flex flex-col gap-3">
            <TombolTahan label={labelKonfirmasi} bahaya={bahaya} sibuk={sibuk} onSelesai={onKonfirmasi} />
            <button
              type="button"
              onClick={onTutup}
              disabled={sibuk}
              autoFocus
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-garis-halus bg-kertas text-base font-medium text-tinta transition-all duration-200 hover:border-aksi-garis hover:bg-aksi-latar hover:text-aksi disabled:opacity-50"
            >
              {TEKS.UMUM_BATAL}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onTutup}
              disabled={sibuk}
              autoFocus
              className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-garis-halus bg-kertas text-base font-medium text-tinta transition-all duration-200 hover:border-aksi-garis hover:bg-aksi-latar hover:text-aksi disabled:opacity-50"
            >
              {TEKS.UMUM_BATAL}
            </button>
            <button
              type="button"
              onClick={onKonfirmasi}
              disabled={sibuk || !cocok}
              className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl text-base font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0 ${
                bahaya ? "bg-tinta hover:bg-black" : "bg-aksi hover:bg-aksi-hover shadow-[0_8px_20px_rgba(36,87,197,0.28)]"
              }`}
            >
              {sibuk ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
              {sibuk ? TEKS.UMUM_MUAT : labelKonfirmasi}
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
