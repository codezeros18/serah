"use client";

import { TEKS, isi } from "@serah/kontrak/teks";
import { IkonLanding } from "@/lib/klien/komponen/ikon-landing";
import type { TpsTerpilih } from "./tps-terpilih";

/** TPS terpilih: kartu kaca ringkas; tombol ikon QR untuk memindai ulang (nama tombol tetap T1_PINDAI). */
export function KartuTps({ tps, onGanti }: { tps: TpsTerpilih; onGanti: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-3xl bg-white/80 p-3.5 shadow-[0_8px_30px_rgba(15,23,42,0.05)] ring-1 ring-garis-halus/70 backdrop-blur">
      <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-aksi-latar">
        <IkonLanding nama="tps" className="h-7 w-7" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-sm font-semibold tracking-wide text-tinta">{tps.kode}</p>
        <p className="truncate text-xs text-tinta-redup">{tps.namaKawasan}</p>
        <span className="sr-only" data-testid="tps-terpilih">
          {isi("T1_TPS_TERPILIH", { kode_tps: tps.kode, nama_kawasan: tps.namaKawasan })}
        </span>
      </div>
      <button
        type="button"
        onClick={onGanti}
        aria-label={TEKS.T1_PINDAI}
        title={TEKS.T1_PINDAI}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-latar text-tinta transition-all duration-200 hover:bg-aksi-latar hover:text-aksi active:scale-95"
      >
        <IkonLanding nama="qr" className="h-6 w-6" />
      </button>
    </div>
  );
}
