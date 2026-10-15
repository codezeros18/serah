"use client";

import type { ReactNode } from "react";
import { TEKS, isi } from "@serah/kontrak/teks";
import { antreanBersama } from "@/lib/klien/antrean/bersama";
import { useAntrean } from "@/lib/klien/antrean/pakai-antrean";

function Awan({ coret = false }: { coret?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
      <path
        d="M7 18.500a4 4 0 0 1-.6-7.950A5.500 5.500 0 0 1 17 9.500a4.500 4.500 0 0 1 .500 9H7Z"
        stroke="currentColor"
        strokeWidth="1.800"
        strokeLinejoin="round"
      />
      {coret ? <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.800" strokeLinecap="round" /> : null}
    </svg>
  );
}

function Pita({
  data,
  role,
  nada,
  ikon,
  judul,
  teks,
  aksi,
}: {
  data: string;
  role: "status" | "alert";
  nada: "peringatan" | "aksi" | "selesai" | "tolak";
  ikon: ReactNode;
  judul: string;
  teks: string;
  aksi?: ReactNode;
}) {
  const kelas = {
    peringatan: "bg-peringatan-latar text-peringatan ring-peringatan-garis/30",
    aksi: "bg-aksi-latar text-aksi ring-aksi-garis",
    selesai: "bg-status-selesai-latar text-status-selesai ring-status-selesai/25",
    tolak: "bg-status-tolak-latar text-status-tolak ring-status-tolak/25",
  }[nada];
  return (
    <div
      role={role}
      data-pita={data}
      className="flex items-center gap-3 rounded-2xl border border-garis-halus bg-kertas p-3 shadow-[0_4px_20px_rgba(15,23,42,0.04)]"
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${kelas}`}>{ikon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight text-tinta">{judul}</p>
        <p className="mt-0.5 text-xs leading-snug text-tinta-redup">{teks}</p>
      </div>
      {aksi}
    </div>
  );
}

const KELAS_TOMBOL =
  "inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-latar px-3.5 text-xs font-medium text-tinta transition-all duration-200 hover:bg-aksi-latar hover:text-aksi active:scale-[0.98]";

/** Pita keadaan sambungan & antrean: G_OFFLINE, G_ANTREAN, G_ANTREAN_TERKIRIM, G_SINKRON_TOLAK. */
export function PitaAntrean() {
  const { keadaan, online, baruTerkirim, tutupTerkirim, segarkan } = useAntrean();

  async function lepaskanDitolak() {
    const a = antreanBersama();
    for (const x of await a.daftar()) if (x.status === "DITOLAK") await a.lepaskan(x.idempotencyKey);
    segarkan();
  }

  return (
    <div className="flex flex-col gap-2" data-testid="pita-antrean">
      {!online ? (
        <Pita
          data="offline"
          role="status"
          nada="peringatan"
          ikon={<Awan coret />}
          judul={TEKS.SYNC_OFFLINE_JUDUL}
          teks={TEKS.G_OFFLINE}
        />
      ) : null}
      {keadaan.menunggu > 0 ? (
        <Pita
          data="antrean"
          role="status"
          nada="aksi"
          ikon={
            <span className="relative flex h-6 w-6 items-center justify-center">
              <span className="absolute h-6 w-6 animate-ping rounded-full bg-aksi/20" aria-hidden="true" />
              <Awan />
            </span>
          }
          judul={TEKS.SYNC_ANTREAN_JUDUL}
          teks={isi("G_ANTREAN", { jumlah: keadaan.menunggu })}
        />
      ) : null}
      {keadaan.menunggu === 0 && baruTerkirim ? (
        <Pita
          data="terkirim"
          role="status"
          nada="selesai"
          ikon={<span className="text-lg font-semibold">✓</span>}
          judul={TEKS.SYNC_TERKIRIM_JUDUL}
          teks={TEKS.G_ANTREAN_TERKIRIM}
          aksi={
            <button type="button" className={KELAS_TOMBOL} onClick={tutupTerkirim}>
              {TEKS.UMUM_TUTUP}
            </button>
          }
        />
      ) : null}
      {keadaan.ditolak > 0 ? (
        <Pita
          data="ditolak"
          role="alert"
          nada="tolak"
          ikon={<span className="text-lg font-semibold">!</span>}
          judul={TEKS.SYNC_DITOLAK_JUDUL}
          teks={TEKS.G_SINKRON_TOLAK}
          aksi={
            <button type="button" className={KELAS_TOMBOL} onClick={() => void lepaskanDitolak()}>
              {TEKS.UMUM_TUTUP}
            </button>
          }
        />
      ) : null}
    </div>
  );
}
