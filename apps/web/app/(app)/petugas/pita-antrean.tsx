"use client";

import { TEKS, isi } from "@serah/kontrak/teks";
import { Kartu, Tombol } from "@serah/ui";
import { antreanBersama } from "@/lib/klien/antrean/bersama";
import { useAntrean } from "@/lib/klien/antrean/pakai-antrean";

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
        <Kartu
          role="status"
          data-pita="offline"
          className="flex items-center gap-3 rounded-kartu border-2 border-peringatan-garis bg-peringatan-latar p-3.5 text-peringatan shadow-sm"
        >
          <span aria-hidden="true" className="text-xl font-black">
            ▲
          </span>
          <p className="text-base font-bold tracking-wide">{TEKS.G_OFFLINE}</p>
        </Kartu>
      ) : null}
      {keadaan.menunggu > 0 ? (
        <Kartu
          role="status"
          data-pita="antrean"
          className="flex items-center gap-3 rounded-kartu border-2 border-aksi-garis bg-aksi-latar p-3.5 text-aksi shadow-sm"
        >
          <span aria-hidden="true" className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-aksi" />
          <p className="text-base font-bold tabular-nums">{isi("G_ANTREAN", { jumlah: keadaan.menunggu })}</p>
        </Kartu>
      ) : null}
      {keadaan.menunggu === 0 && baruTerkirim ? (
        <Kartu
          role="status"
          data-pita="terkirim"
          className="flex items-center justify-between gap-3 rounded-kartu border-2 border-status-selesai bg-status-selesai-latar p-3.5 text-status-selesai shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="text-lg font-black">
              ✓
            </span>
            <p className="text-base font-bold">{TEKS.G_ANTREAN_TERKIRIM}</p>
          </div>
          <Tombol
            varian="sekunder"
            className="min-h-12 border-2 border-status-selesai bg-kertas font-bold hover:bg-status-selesai-latar active:scale-[0.98] transition-all"
            onClick={tutupTerkirim}
          >
            {TEKS.UMUM_TUTUP}
          </Tombol>
        </Kartu>
      ) : null}
      {keadaan.ditolak > 0 ? (
        <Kartu
          role="alert"
          data-pita="ditolak"
          className="flex items-center justify-between gap-3 rounded-kartu border-2 border-status-tolak bg-status-tolak-latar p-3.5 text-status-tolak shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="text-lg font-black">
              !
            </span>
            <p className="text-base font-bold">{TEKS.G_SINKRON_TOLAK}</p>
          </div>
          <Tombol
            varian="sekunder"
            className="min-h-12 border-2 border-status-tolak bg-kertas font-bold hover:bg-status-tolak-latar active:scale-[0.98] transition-all"
            onClick={() => void lepaskanDitolak()}
          >
            {TEKS.UMUM_TUTUP}
          </Tombol>
        </Kartu>
      ) : null}
    </div>
  );
}
