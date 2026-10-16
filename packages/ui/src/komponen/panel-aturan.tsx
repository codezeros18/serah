import type { ReactNode } from "react";
import type { AksiAturan, KodeAturan } from "@serah/kontrak/enum";
import { TEKS, isi } from "@serah/kontrak/teks";

const JUDUL: Record<AksiAturan, string> = {
  TOLAK: TEKS.ATURAN_JUDUL_TOLAK,
  PERINGATAN: TEKS.ATURAN_JUDUL_PERINGATAN,
  PRIORITAS: TEKS.ATURAN_JUDUL_PRIORITAS,
  STATUS: TEKS.ATURAN_JUDUL_PERINGATAN,
};

const P = { strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function Ikon({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor">
      {children}
    </svg>
  );
}

const IKON: Record<"kunci" | "peringatan" | "bendera", ReactNode> = {
  kunci: (
    <Ikon>
      <rect {...P} x="5.500" y="10.500" width="13" height="9.500" rx="2.500" />
      <path {...P} d="M8.500 10.500V8a3.500 3.500 0 0 1 7 0v2.500" />
    </Ikon>
  ),
  peringatan: (
    <Ikon>
      <path {...P} d="M12 4.500 20.500 19h-17L12 4.500Z" />
      <path {...P} d="M12 10v4M12 16.800v.01" />
    </Ikon>
  ),
  bendera: (
    <Ikon>
      <path {...P} d="M6 21V4.500M6 5h10.500l-1.800 3.500 1.800 3.500H6" />
    </Ikon>
  ),
};

/**
 * Panel aturan berpasal. Menyebut kode aturan dan teks §M; tidak pernah menyatakan
 * seseorang bersalah. PRIORITAS selalu disertai catatan R10_CATATAN.
 * TOLAK memakai garis tebal gelap + ikon kunci (tanda non-warna); lainnya kartu lembut beraksen kuning.
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
  const prioritas = aksi === "PRIORITAS";
  const gaya = tolak
    ? "border-[3px] border-tolak bg-white shadow-[0_12px_32px_rgba(15,23,42,0.10)]"
    : "border border-amber-200/80 bg-gradient-to-br from-amber-50/80 to-white shadow-[0_4px_16px_rgba(180,83,9,0.07)]";
  const ikonTile = tolak ? "bg-tinta text-white" : "bg-amber-100 text-amber-700";
  return (
    <section
      role={tolak ? "alert" : "note"}
      data-aturan={kode}
      data-aksi={aksi}
      className={`flex gap-3.5 rounded-2xl p-4 text-tinta ${gaya}`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ikonTile}`}>
        {tolak ? IKON.kunci : prioritas ? IKON.bendera : IKON.peringatan}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="flex items-center justify-between gap-2 text-sm font-semibold leading-tight">
          <span>{JUDUL[aksi]}</span>
          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-tinta-redup ring-1 ring-garis-halus">
            {`R-${kode.slice(1)}`}
          </span>
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed">{teks}</p>
        {sumber ? <p className="mt-2 text-xs text-tinta-redup">{isi("ATURAN_RUJUKAN", { sumber })}</p> : null}
        {prioritas ? <p className="mt-2 text-xs font-medium text-amber-800">{TEKS.R10_CATATAN}</p> : null}
        {tolak ? <p className="mt-2 text-xs text-tinta-redup">{TEKS.ATURAN_BUKAN_NASIHAT}</p> : null}
      </div>
    </section>
  );
}
