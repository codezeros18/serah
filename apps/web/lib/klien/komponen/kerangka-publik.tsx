import Link from "next/link";
import { Poppins } from "next/font/google";
import type { ReactNode } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { LogoSerah } from "./logo-serah";
import { NavbarGlass } from "./navbar-glass";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });

/**
 * Kerangka halaman publik non-beranda (privasi, syarat): navbar kaca sticky dan footer
 * yang sama dengan beranda, font Poppins, latar putih.
 */
export function KerangkaPublik({ children }: { children: ReactNode }) {
  return (
    <div className={`${poppins.className} flex min-h-dvh flex-col bg-kertas text-tinta`}>
      <NavbarGlass />

      <main className="flex-1 px-4 pb-20 pt-12 sm:px-6 sm:pt-16">{children}</main>

      <footer className="border-t border-garis-halus px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-3">
            <LogoSerah ukuran="sm" />
            <span className="text-xs text-tinta-redup">{TEKS.KAKI_HAK_CIPTA}</span>
          </div>
          <nav
            aria-label="Navigasi kaki"
            className="flex flex-wrap items-center gap-6 text-sm text-tinta-redup"
          >
            <Link href="/#tentang" className="transition-colors duration-200 hover:text-aksi">
              {TEKS.LANDING_NAV_TENTANG}
            </Link>
            <Link href="/#harga" className="transition-colors duration-200 hover:text-aksi">
              {TEKS.HRG_JUDUL}
            </Link>
            <Link href="/privasi" className="transition-colors duration-200 hover:text-aksi">
              {TEKS.PRIV_JUDUL}
            </Link>
            <Link href="/syarat" className="transition-colors duration-200 hover:text-aksi">
              {TEKS.SYR_JUDUL}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
