import type { ReactNode } from "react";

/** Ikon dekoratif halaman landing. Semuanya SVG buatan sendiri, aria-hidden, tanpa aset eksternal. */

export type NamaIkon =
  | "tps"
  | "truk"
  | "timbang"
  | "qr"
  | "laporan"
  | "hujan"
  | "daur"
  | "aturan"
  | "rantai"
  | "kamera"
  | "pasar"
  | "makan"
  | "kuliner"
  | "apartemen"
  | "centang";

function Dasar({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

const GAMBAR: Record<NamaIkon, ReactNode> = {
  // Empat wadah warna aliran
  tps: (
    <>
      <rect x="3" y="12" width="6" height="14" rx="1.6" fill="#15803d" />
      <rect x="10" y="9" width="6" height="17" rx="1.6" fill="#facc15" />
      <rect x="17" y="12" width="6" height="14" rx="1.6" fill="#b91c1c" />
      <rect x="24" y="10" width="5" height="16" rx="1.6" fill="#4b5563" />
      <rect x="2" y="26" width="28" height="2" rx="1" fill="#0f172a" opacity="0.15" />
    </>
  ),
  truk: (
    <>
      <rect x="2" y="9" width="17" height="12" rx="2" fill="#2457c5" />
      <path d="M19 13h5l4 4v4h-9v-8Z" fill="#1b439c" />
      <circle cx="9" cy="23" r="3" fill="#0f172a" />
      <circle cx="9" cy="23" r="1.1" fill="#fff" />
      <circle cx="23" cy="23" r="3" fill="#0f172a" />
      <circle cx="23" cy="23" r="1.1" fill="#fff" />
      <rect x="5" y="12" width="9" height="2.4" rx="1.2" fill="#fff" opacity="0.85" />
    </>
  ),
  timbang: (
    <>
      <path d="M16 5v20" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 25h18" stroke="#0f172a" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M6 9h20" stroke="#2457c5" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M3.5 17 6 9l2.5 8a2.6 2.6 0 0 1-5 0Z" fill="#0f766e" />
      <path d="M23.5 17 26 9l2.5 8a2.6 2.6 0 0 1-5 0Z" fill="#0f766e" />
      <circle cx="16" cy="5" r="2" fill="#2457c5" />
    </>
  ),
  qr: (
    <>
      <rect x="4" y="4" width="10" height="10" rx="2.4" fill="#0f172a" />
      <rect x="7" y="7" width="4" height="4" rx="1" fill="#fff" />
      <rect x="18" y="4" width="10" height="10" rx="2.4" fill="#0f172a" />
      <rect x="21" y="7" width="4" height="4" rx="1" fill="#fff" />
      <rect x="4" y="18" width="10" height="10" rx="2.4" fill="#0f172a" />
      <rect x="7" y="21" width="4" height="4" rx="1" fill="#fff" />
      <rect x="18" y="18" width="4.5" height="4.5" rx="1.2" fill="#2457c5" />
      <rect x="24" y="24" width="4" height="4" rx="1" fill="#2457c5" />
      <rect x="24" y="18" width="4" height="4" rx="1" fill="#0f172a" />
    </>
  ),
  laporan: (
    <>
      <rect x="6" y="3" width="20" height="26" rx="3.5" fill="#eff6ff" stroke="#2457c5" strokeWidth="2" />
      <rect x="10" y="9" width="12" height="2.4" rx="1.2" fill="#2457c5" />
      <rect x="10" y="14" width="12" height="2.4" rx="1.2" fill="#93b4ee" />
      <rect x="10" y="19" width="7" height="2.4" rx="1.2" fill="#93b4ee" />
      <circle cx="22" cy="23" r="4.5" fill="#0f766e" />
      <path d="m19.8 23 1.6 1.6 3-3.2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  hujan: (
    <>
      <path
        d="M9 20a5.5 5.5 0 0 1-.6-10.96A7.5 7.5 0 0 1 22.9 10.5 5 5 0 0 1 23 20H9Z"
        fill="#bfdbfe"
        stroke="#2457c5"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="m11 23.5-1.6 4M16.5 23.5l-1.6 4M22 23.5l-1.6 4" stroke="#2457c5" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  daur: (
    <>
      <path d="M16 4.5 21 13h-4.2L14 8.2 11.6 12.4 9.2 10.9 16 4.5Z" fill="#15803d" />
      <path d="m26.6 19.4-5.2 8.1-2.4-4.3 4-.1-1.7-4.6 2.7-1.2 2.6 2.1Z" fill="#0f766e" />
      <path d="m5.4 19.4 5.4 8.1h4.6v-3.2l-4.6.1 1.9-4.2-2.6-1.5-4.7.7Z" fill="#facc15" />
    </>
  ),
  aturan: (
    <>
      <path d="M16 3.5 26 7v8.2c0 6-4.2 10.4-10 13.3C10.2 25.600 6 21.200 6 15.200V7l10-3.500Z" fill="#2457c5" />
      <path d="m11.4 15.800 3.3 3.300 6-6.400" stroke="#fff" strokeWidth="2.600" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  rantai: (
    <>
      <rect x="3" y="12" width="12" height="8" rx="4" stroke="#2457c5" strokeWidth="2.600" />
      <rect x="17" y="12" width="12" height="8" rx="4" stroke="#0f766e" strokeWidth="2.600" />
      <rect x="11" y="14.600" width="10" height="2.800" rx="1.400" fill="#0f172a" />
    </>
  ),
  kamera: (
    <>
      <path d="M11 7h10l1.600 3H27a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2h4.400L11 7Z" fill="#0f172a" />
      <circle cx="16" cy="17.500" r="5" fill="#fff" />
      <circle cx="16" cy="17.500" r="2.600" fill="#2457c5" />
    </>
  ),
  pasar: (
    <>
      <path d="M4 12 6.500 5h19L28 12H4Z" fill="#b91c1c" />
      <path d="M4 12h6a3 3 0 0 1-6 0Zm6 0h6a3 3 0 0 1-6 0Zm6 0h6a3 3 0 0 1-6 0Zm6 0h6a3 3 0 0 1-6 0Z" fill="#fff" stroke="#b91c1c" strokeWidth="1.200" />
      <rect x="6" y="16" width="20" height="11" rx="1.500" fill="#fef3c7" />
      <rect x="13" y="19" width="6" height="8" rx="1" fill="#92400e" />
    </>
  ),
  makan: (
    <>
      <path d="M9 4v9a3 3 0 0 0 6 0V4M12 4v24" stroke="#0f172a" strokeWidth="2.400" strokeLinecap="round" />
      <path d="M22 28V4c-3 2-4.500 6-4.500 10 0 2 1 3 2.500 3h2" stroke="#2457c5" strokeWidth="2.400" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  kuliner: (
    <>
      <path d="M4 17h24a12 12 0 0 1-24 0Z" fill="#facc15" />
      <path d="M10 13c0-2.500 2-2.500 2-5M16 13c0-2.500 2-2.500 2-5M22 13c0-2.500 2-2.500 2-5" stroke="#b45309" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  apartemen: (
    <>
      <rect x="5" y="4" width="14" height="24" rx="2" fill="#2457c5" />
      <rect x="19" y="12" width="8" height="16" rx="2" fill="#1b439c" />
      <path d="M9 9h2m4 0h2M9 14h2m4 0h2M9 19h2m4 0h2" stroke="#fff" strokeWidth="2.200" strokeLinecap="round" />
      <rect x="10.500" y="22" width="3" height="6" rx="1" fill="#fff" />
    </>
  ),
  centang: (
    <>
      <circle cx="16" cy="16" r="12" fill="#0f766e" />
      <path d="m10.500 16.500 3.800 3.800 7.200-8" stroke="#fff" strokeWidth="2.800" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
};

export function IkonLanding({ nama, className = "" }: { nama: NamaIkon; className?: string }) {
  return (
    <span className={`inline-block ${className}`}>
      <Dasar>{GAMBAR[nama]}</Dasar>
    </span>
  );
}

/** Lencana bulat putih berbayang tempat ikon mengorbit di sekitar hero. */
export function LencanaIkon({
  nama,
  className = "",
  ukuran = 60,
}: {
  nama: NamaIkon;
  className?: string;
  ukuran?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className={`ikon-melayang absolute flex items-center justify-center rounded-full border border-garis-halus bg-kertas shadow-[0_6px_18px_rgba(15,23,42,0.08)] ${className}`}
      style={{ width: ukuran, height: ukuran }}
    >
      <IkonLanding nama={nama} className="h-[52%] w-[52%]" />
    </span>
  );
}
