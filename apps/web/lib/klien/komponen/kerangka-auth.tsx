import Link from "next/link";
import { Poppins } from "next/font/google";
import type { ReactNode } from "react";
import { TEKS } from "@serah/kontrak/teks";
import { LogoSerah } from "./logo-serah";
import { VisualMvp } from "./visual-mvp";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });

/**
 * Kerangka halaman masuk & daftar: kiri formulir, kanan panel biru berisi peragaan MVP.
 * Hanya judul/sub panel kanan dan isi formulir yang berbeda antarhalaman.
 */
export function KerangkaAuth({
  visualJudul,
  visualSub,
  children,
}: {
  visualJudul: string;
  visualSub: string;
  children: ReactNode;
}) {
  return (
    <div className={`${poppins.className} min-h-dvh bg-kertas p-3 text-tinta sm:p-4`}>
      <div className="grid min-h-[calc(100dvh-1.5rem)] gap-4 sm:min-h-[calc(100dvh-2rem)] lg:grid-cols-2">
        <main className="flex flex-col px-4 py-6 sm:px-10 lg:px-14">
          <div className="flex items-center justify-between">
            <Link href="/" className="group inline-block" aria-label={TEKS.APP_NAMA}>
              <LogoSerah ukuran="md" />
            </Link>
            <Link
              href="/"
              className="rounded-lg px-3 py-2 text-sm font-medium text-tinta-redup transition-colors duration-200 hover:bg-aksi-latar hover:text-aksi"
            >
              ← {TEKS.MASUK_KE_BERANDA}
            </Link>
          </div>

          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-7 py-10">
            {children}
          </div>

          <p className="text-center text-xs text-tinta-redup">{TEKS.KAKI_HAK_CIPTA}</p>
        </main>

        <aside
          aria-hidden="true"
          className="relative hidden overflow-hidden rounded-3xl p-10 lg:flex lg:flex-col lg:justify-center xl:p-14"
          style={{ background: "linear-gradient(155deg, #3469de 0%, #2457c5 45%, #173a8a 100%)" }}
        >
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 700 900"
            preserveAspectRatio="xMidYMid slice"
            fill="none"
          >
            {[180, 300, 430, 560].map((r) => (
              <circle key={r} cx="350" cy="470" r={r} stroke="white" strokeOpacity="0.10" />
            ))}
          </svg>
          <div className="ikon-melayang pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="ikon-melayang pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-sky-300/20 blur-3xl" />

          <div className="relative flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <h2 className="text-3xl font-semibold leading-tight tracking-[-0.025em] text-white xl:text-4xl [text-wrap:balance]">
                {visualJudul}
              </h2>
              <p className="max-w-lg text-sm leading-relaxed text-white/75">{visualSub}</p>
            </div>
            <VisualMvp />
          </div>
        </aside>
      </div>
    </div>
  );
}

export const KELAS_INPUT =
  "h-12 w-full rounded-xl border border-garis-halus bg-kertas px-4 text-sm text-tinta shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 placeholder:text-garis hover:border-garis focus:border-aksi focus:outline-none focus:ring-4 focus:ring-aksi/15";
