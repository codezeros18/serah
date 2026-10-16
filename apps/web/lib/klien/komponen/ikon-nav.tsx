import type { ReactNode } from "react";

/** Ikon garis untuk navigasi aplikasi (24px, stroke mengikuti currentColor). */
export type NamaIkonNav =
  | "beranda"
  | "serah"
  | "truk"
  | "laporan"
  | "lonceng"
  | "akun"
  | "tps"
  | "ditolak"
  | "kontrak"
  | "keluar"
  | "admin"
  | "unduh"
  | "perisai"
  | "sampah"
  | "buku"
  | "daya"
  | "tambah"
  | "chevron";

const J = { strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const GAMBAR: Record<NamaIkonNav, ReactNode> = {
  beranda: (
    <>
      <path {...J} d="M4 11.2 12 4.5l8 6.7V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1v-7.8Z" />
    </>
  ),
  serah: (
    <>
      <path {...J} d="M5 8h13m0 0-3.5-3.5M18 8l-3.5 3.5" />
      <path {...J} d="M19 16H6m0 0 3.5 3.5M6 16l3.5-3.5" />
    </>
  ),
  truk: (
    <>
      <path {...J} d="M3 7.5A1.5 1.5 0 0 1 4.5 6h9A1.5 1.5 0 0 1 15 7.5V16H3V7.5Z" />
      <path {...J} d="M15 10h3.2l2.8 3v3h-6v-6Z" />
      <circle {...J} cx="7.5" cy="17.5" r="1.8" />
      <circle {...J} cx="17.5" cy="17.5" r="1.8" />
    </>
  ),
  laporan: (
    <>
      <path {...J} d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7.5 3.5" />
      <path {...J} d="M14 3.5V8h4M9 13h6M9 16.5h4" />
    </>
  ),
  lonceng: (
    <>
      <path {...J} d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15l1.5-2Z" />
      <path {...J} d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  akun: (
    <>
      <circle {...J} cx="12" cy="8.5" r="3.5" />
      <path {...J} d="M5 20c.8-3.6 3.7-5.5 7-5.5s6.200 1.900 7 5.500" />
    </>
  ),
  tps: (
    <>
      <rect {...J} x="4" y="10" width="4.5" height="10" rx="1.200" />
      <rect {...J} x="9.800" y="6" width="4.500" height="14" rx="1.200" />
      <rect {...J} x="15.500" y="9" width="4.500" height="11" rx="1.200" />
    </>
  ),
  ditolak: (
    <>
      <circle {...J} cx="12" cy="12" r="8.500" />
      <path {...J} d="M8.800 8.800l6.400 6.400M15.200 8.800l-6.400 6.400" />
    </>
  ),
  kontrak: (
    <>
      <path {...J} d="M8 3.500h8A1.500 1.500 0 0 1 17.500 5v14a1.500 1.500 0 0 1-1.500 1.500H8A1.500 1.500 0 0 1 6.500 19V5A1.500 1.500 0 0 1 8 3.500Z" />
      <path {...J} d="m9.500 12 1.700 1.700 3.300-3.600" />
    </>
  ),
  keluar: (
    <>
      <path {...J} d="M10 4.500H6.500A1.500 1.500 0 0 0 5 6v12a1.500 1.500 0 0 0 1.500 1.500H10" />
      <path {...J} d="M15 8l4 4-4 4M19 12H9.500" />
    </>
  ),
  unduh: (
    <>
      <path {...J} d="M12 4v10m0 0-4-4m4 4 4-4M5 19h14" />
    </>
  ),
  perisai: (
    <>
      <path {...J} d="M12 3.500 19 6.500v5.200c0 4.300-2.900 7.200-7 8.800-4.100-1.600-7-4.500-7-8.800V6.500l7-3Z" />
    </>
  ),
  sampah: (
    <>
      <path {...J} d="M5 7h14M10 4h4M8 7l.8 12h6.400L16 7M10.500 11v5m3-5v5" />
    </>
  ),
  buku: (
    <>
      <path {...J} d="M5 5.500A1.500 1.500 0 0 1 6.500 4H19v14H6.500A1.500 1.500 0 0 0 5 19.500V5.500ZM5 19.500A1.500 1.500 0 0 0 6.500 21H19" />
    </>
  ),
  daya: (
    <>
      <path {...J} d="M12 3.500v8M7.200 6.800a7.500 7.500 0 1 0 9.600 0" />
    </>
  ),
  tambah: (
    <>
      <path {...J} d="M12 5v14M5 12h14" />
    </>
  ),
  chevron: (
    <>
      <path {...J} d="m9.500 6 6 6-6 6" />
    </>
  ),
  admin: (
    <>
      <path {...J} d="M12 3.500 19 6.500v5.200c0 4.300-2.900 7.200-7 8.800-4.100-1.600-7-4.500-7-8.800V6.500l7-3Z" />
      <path {...J} d="m9.200 12 2 2 3.600-4" />
    </>
  ),
};

export function IkonNav({ nama, className = "h-6 w-6" }: { nama: NamaIkonNav; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" focusable="false" className={className}>
      {GAMBAR[nama]}
    </svg>
  );
}
