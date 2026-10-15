import type { AksiAturan, KodeAturan } from "@serah/kontrak/enum";
import { TEKS, isi } from "@serah/kontrak/teks";

const JUDUL: Record<AksiAturan, string> = {
  TOLAK: TEKS.ATURAN_JUDUL_TOLAK,
  PERINGATAN: TEKS.ATURAN_JUDUL_PERINGATAN,
  PRIORITAS: TEKS.ATURAN_JUDUL_PRIORITAS,
  STATUS: TEKS.ATURAN_JUDUL_PERINGATAN,
};

function Kunci() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="currentColor">
      <path d="M17 9V7a5 5 0 0 0-10 0v2H5v12h14V9h-2Zm-8 0V7a3 3 0 0 1 6 0v2H9Z" />
    </svg>
  );
}

function Segitiga() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="currentColor">
      <path d="M12 2 1 21h22L12 2Zm1 15h-2v-2h2v2Zm0-4h-2V9h2v4Z" />
    </svg>
  );
}

/**
 * Panel aturan berpasal. Menyebut kode aturan dan teks §M; tidak pernah menyatakan
 * seseorang bersalah. PRIORITAS selalu disertai catatan R10_CATATAN.
 */
export function PanelAturan({
  aksi,
  kode,
  teks,
  sumber,
}: {
  aksi: AksiAturan;
  kode: KodeAturan;
  teks: string;
  sumber?: string;
}) {
  const tolak = aksi === "TOLAK";
  const gaya = tolak
    ? "border-4 border-tolak bg-tolak-latar text-tinta"
    : "border-l-8 border-peringatan-garis bg-peringatan-latar text-tinta";
  return (
    <section
      role={tolak ? "alert" : "note"}
      data-aturan={kode}
      data-aksi={aksi}
      className={`rounded-kartu p-4 ${gaya}`}
    >
      <h3 className="flex items-center gap-2 text-base font-bold">
        {tolak ? <Kunci /> : <Segitiga />}
        <span>{JUDUL[aksi]}</span>
        <span className="ml-auto rounded-kontrol border border-current px-2 text-sm">{`R-${kode.slice(1)}`}</span>
      </h3>
      <p className="mt-2 text-base">{teks}</p>
      {sumber ? <p className="mt-2 text-sm text-tinta-redup">{isi("ATURAN_RUJUKAN", { sumber })}</p> : null}
      {aksi === "PRIORITAS" ? <p className="mt-2 text-sm font-semibold">{TEKS.R10_CATATAN}</p> : null}
      {tolak ? <p className="mt-2 text-sm text-tinta-redup">{TEKS.ATURAN_BUKAN_NASIHAT}</p> : null}
    </section>
  );
}
