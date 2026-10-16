"use client";

import { useEffect, useId, useRef } from "react";
import type { Aliran } from "@serah/kontrak/enum";
import { TEKS, isi } from "@serah/kontrak/teks";
import { LencanaAliran } from "@serah/ui";
import { formatGramKeKg } from "../angka";

export type AksiLembar = "TERIMA" | "SEBAGIAN" | "TOLAK";

export type BarisLembar = { aliran: Aliran; diterimaG: number; ditolakG: number };

const GAYA: Record<AksiLembar, { bulat: string; ikon: string; judul: () => string; tombol: string }> = {
  TERIMA: {
    bulat: "bg-status-selesai-latar text-status-selesai",
    ikon: "✓",
    judul: () => TEKS.P1_TERIMA,
    tombol: "bg-aksi hover:bg-aksi-hover shadow-[0_8px_20px_rgba(36,87,197,0.28)]",
  },
  SEBAGIAN: {
    bulat: "bg-status-sebagian-latar text-status-sebagian",
    ikon: "½",
    judul: () => TEKS.P1_TOLAK_SEBAGIAN,
    tombol: "bg-aksi hover:bg-aksi-hover shadow-[0_8px_20px_rgba(36,87,197,0.28)]",
  },
  TOLAK: {
    bulat: "bg-status-tolak-latar text-status-tolak",
    ikon: "✕",
    judul: () => TEKS.P1_TOLAK,
    tombol: "bg-tinta hover:bg-black shadow-[0_8px_20px_rgba(15,23,42,0.28)]",
  },
};

/**
 * Lembar konfirmasi (bottom sheet di HP, kartu tengah di layar lebar) untuk menutup serah:
 * ringkasan terima / sebagian / tolak sebelum benar-benar dikirim. Memakai <dialog> asli
 * (fokus terkurung, Esc menutup).
 */
export function LembarKonfirmasi({
  terbuka,
  aksi,
  kode,
  beratTiketG,
  baris,
  sibuk,
  onKonfirmasi,
  onTutup,
}: {
  terbuka: boolean;
  aksi: AksiLembar;
  kode: string;
  beratTiketG: number | null;
  baris: readonly BarisLembar[];
  sibuk: boolean;
  onKonfirmasi: () => void;
  onTutup: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const idJudul = useId();
  const g = GAYA[aksi];

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (terbuka && !d.open) d.showModal();
    if (!terbuka && d.open) d.close();
  }, [terbuka]);

  const totalDiterima = baris.reduce((j, b) => j + b.diterimaG, 0);
  const totalDitolak = baris.reduce((j, b) => j + b.ditolakG, 0);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idJudul}
      onClose={onTutup}
      className="lembar gulir-halus max-h-[92dvh] overflow-y-auto m-0 mt-auto w-full max-w-none rounded-t-[2rem] border-0 bg-kertas p-0 text-tinta shadow-[0_-20px_60px_rgba(15,23,42,0.25)] backdrop:bg-tinta/40 backdrop:backdrop-blur-sm sm:m-auto sm:max-w-md sm:rounded-[2rem]"
    >
      <div className="flex flex-col gap-5 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <span aria-hidden="true" className="mx-auto h-1.5 w-10 rounded-full bg-garis-halus sm:hidden" />

        <div className="flex items-center gap-4">
          <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl font-semibold ${g.bulat}`}>
            {g.ikon}
          </span>
          <div className="min-w-0">
            <h2 id={idJudul} className="text-xl font-semibold tracking-tight text-tinta">
              {g.judul()}
            </h2>
            <p className="font-mono text-sm text-tinta-redup">{kode}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-latar p-3">
            <p className="text-xs text-tinta-redup">{TEKS.K1_DITERIMA}</p>
            <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-tinta">
              {isi("UMUM_KG", { nilai: formatGramKeKg(totalDiterima) })}
            </p>
          </div>
          <div className="rounded-2xl bg-latar p-3">
            <p className="text-xs text-tinta-redup">{TEKS.K1_DITOLAK}</p>
            <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-tinta">
              {isi("UMUM_KG", { nilai: formatGramKeKg(totalDitolak) })}
            </p>
          </div>
        </div>

        <ul className="flex flex-col gap-2">
          {baris.map((b) => (
            <li key={b.aliran} className="flex items-center justify-between gap-3 rounded-2xl border border-garis-halus px-3 py-2.5">
              <LencanaAliran aliran={b.aliran} pendek />
              <span className="font-mono text-sm tabular-nums text-tinta">
                {isi("UMUM_KG", { nilai: formatGramKeKg(b.diterimaG) })}
                {b.ditolakG > 0 ? (
                  <span className="text-tinta-redup"> · −{formatGramKeKg(b.ditolakG)}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>

        {beratTiketG !== null ? (
          <p className="text-center text-xs text-tinta-redup">
            {isi("UMUM_KG", { nilai: formatGramKeKg(beratTiketG) })} · {TEKS.P1_FOTO_TIKET}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onTutup}
            disabled={sibuk}
            className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-garis-halus bg-kertas text-base font-medium text-tinta transition-all duration-200 hover:border-aksi-garis hover:bg-aksi-latar hover:text-aksi disabled:opacity-50"
          >
            {TEKS.UMUM_KEMBALI}
          </button>
          <button
            type="button"
            onClick={onKonfirmasi}
            disabled={sibuk}
            className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl text-base font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-60 ${g.tombol}`}
          >
            {sibuk ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
            {sibuk ? TEKS.UMUM_MUAT : TEKS.UMUM_KONFIRMASI}
          </button>
        </div>
      </div>
    </dialog>
  );
}
