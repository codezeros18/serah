import type { ReactNode } from "react";
import type { Aliran, StatusSerah } from "@serah/kontrak/enum";
import { TEKS } from "@serah/kontrak/teks";
import {
  GAYA_STATUS,
  KELAS_ALIRAN_LEMBUT,
  KUNCI_ALIRAN,
  KUNCI_ALIRAN_PENDEK,
  KUNCI_STATUS,
  WARNA_GLIF_ALIRAN,
} from "../aliran";

/** Glif aliran: bentuk berbeda per aliran agar tidak bergantung pada warna saja. */
const GLIF_ALIRAN: Record<Aliran, ReactNode> = {
  // daun
  HIJAU: <path d="M6 18c0-7 4-11 12-12 0 8-4 12-11 12M6 18l5-5" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />,
  // dua panah melingkar (daur ulang)
  KUNING: (
    <path
      d="M20 12a8 8 0 0 1-13.700 5.600M4 12a8 8 0 0 1 13.700-5.600M18 3v4h-4M6 21v-4h4"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  // tabung kimia (B3)
  MERAH: (
    <path
      d="M10 3h4M11 3v6l-5 9a2 2 0 0 0 1.700 3h8.600a2 2 0 0 0 1.700-3l-5-9V3M8.500 15h7"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  // tong
  ABU: <path d="M6 8h12m-9 0V6h6v2m-8 0 .8 10h6.400L16 8M10.500 11v4.500m3-4.500v4.500" strokeWidth="1.900" strokeLinecap="round" strokeLinejoin="round" />,
};

/**
 * Warna aliran selalu berpasangan dengan label teks atau (varian `ikon`) bentuk glif + nama
 * yang dibaca pembaca layar.
 */
export function LencanaAliran({
  aliran,
  pendek = false,
  ikon = false,
}: {
  aliran: Aliran;
  pendek?: boolean;
  /** Hanya ikon bulat (teks tetap untuk pembaca layar dan tooltip). */
  ikon?: boolean;
}) {
  const kunci = pendek ? KUNCI_ALIRAN_PENDEK[aliran] : KUNCI_ALIRAN[aliran];
  if (ikon) {
    return (
      <span
        data-aliran={aliran}
        title={TEKS[kunci]}
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${KELAS_ALIRAN_LEMBUT[aliran]}`}
      >
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" aria-hidden="true" className={WARNA_GLIF_ALIRAN[aliran]}>
          {GLIF_ALIRAN[aliran]}
        </svg>
        <span className="sr-only">{TEKS[kunci]}</span>
      </span>
    );
  }
  return (
    <span
      data-aliran={aliran}
      className={`inline-flex min-h-8 items-center gap-2 rounded-full py-1 pl-1.5 pr-3 text-xs font-semibold ${KELAS_ALIRAN_LEMBUT[aliran]}`}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-[0_1px_2px_rgba(15,23,42,0.12)]">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" aria-hidden="true" className={WARNA_GLIF_ALIRAN[aliran]}>
          {GLIF_ALIRAN[aliran]}
        </svg>
      </span>
      {TEKS[kunci]}
    </span>
  );
}

/** Status serah. Tidak memakai merah; ikon teks membedakan selain warna. */
export function LencanaStatus({ status, ikon = false }: { status: StatusSerah; ikon?: boolean }) {
  const gaya = GAYA_STATUS[status];
  if (ikon) {
    return (
      <span
        data-status={status}
        title={TEKS[KUNCI_STATUS[status]]}
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${gaya.kelas}`}
      >
        <span aria-hidden="true">{gaya.ikon}</span>
        <span className="sr-only">{TEKS[KUNCI_STATUS[status]]}</span>
      </span>
    );
  }
  return (
    <span
      data-status={status}
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${gaya.kelas}`}
    >
      <span aria-hidden="true">{gaya.ikon}</span>
      {TEKS[KUNCI_STATUS[status]]}
    </span>
  );
}
