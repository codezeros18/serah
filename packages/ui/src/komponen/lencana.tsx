import type { ReactNode } from "react";
import type { Aliran, StatusSerah } from "@serah/kontrak/enum";
import { TEKS } from "@serah/kontrak/teks";
import { GAYA_STATUS, KELAS_ALIRAN, KUNCI_ALIRAN, KUNCI_ALIRAN_PENDEK, KUNCI_STATUS } from "../aliran";

/** Glif aliran: bentuk berbeda per aliran agar tidak bergantung pada warna saja. */
const GLIF_ALIRAN: Record<Aliran, ReactNode> = {
  // daun
  HIJAU: <path d="M6 18c0-7 4-11 12-12 0 8-4 12-11 12M6 18l5-5" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />,
  // panah daur ulang
  KUNING: (
    <>
      <path d="M7 10.500 9.500 6h5M14.500 6l2.500 4.500M17 13.500 14.500 18h-5M9.500 18 7 13.500" strokeWidth="1.900" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  // segitiga peringatan (B3)
  MERAH: <path d="M12 5 20 18.500H4L12 5Zm0 5.500v3.500m0 2.500v.01" strokeWidth="1.900" strokeLinecap="round" strokeLinejoin="round" />,
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
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-[0_2px_8px_rgba(15,23,42,0.12)] ring-2 ring-white ${KELAS_ALIRAN[aliran]}`}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" aria-hidden="true">
          {GLIF_ALIRAN[aliran]}
        </svg>
        <span className="sr-only">{TEKS[kunci]}</span>
      </span>
    );
  }
  return (
    <span
      data-aliran={aliran}
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${KELAS_ALIRAN[aliran]}`}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" aria-hidden="true">
        {GLIF_ALIRAN[aliran]}
      </svg>
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
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${gaya.kelas}`}
    >
      <span aria-hidden="true">{gaya.ikon}</span>
      {TEKS[KUNCI_STATUS[status]]}
    </span>
  );
}
