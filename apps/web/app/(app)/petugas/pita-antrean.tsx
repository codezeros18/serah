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
        <Kartu role="status" data-pita="offline">
          <p className="text-base font-semibold">{TEKS.G_OFFLINE}</p>
        </Kartu>
      ) : null}
      {keadaan.menunggu > 0 ? (
        <Kartu role="status" data-pita="antrean">
          <p className="text-base">{isi("G_ANTREAN", { jumlah: keadaan.menunggu })}</p>
        </Kartu>
      ) : null}
      {keadaan.menunggu === 0 && baruTerkirim ? (
        <Kartu role="status" data-pita="terkirim" className="flex items-center justify-between gap-3">
          <p className="text-base">{TEKS.G_ANTREAN_TERKIRIM}</p>
          <Tombol varian="sekunder" onClick={tutupTerkirim}>
            {TEKS.UMUM_TUTUP}
          </Tombol>
        </Kartu>
      ) : null}
      {keadaan.ditolak > 0 ? (
        <Kartu role="alert" data-pita="ditolak" className="flex items-center justify-between gap-3">
          <p className="text-base">{TEKS.G_SINKRON_TOLAK}</p>
          <Tombol varian="sekunder" onClick={() => void lepaskanDitolak()}>
            {TEKS.UMUM_TUTUP}
          </Tombol>
        </Kartu>
      ) : null}
    </div>
  );
}
