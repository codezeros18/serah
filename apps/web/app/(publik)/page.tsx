import Link from "next/link";
import { Kartu } from "@serah/ui";
import { TEKS } from "@serah/kontrak/teks";

const FITUR_SOROTAN = [
  { judul: TEKS.LANDING_L1_JUDUL, isi: TEKS.LANDING_L1_ISI },
  { judul: TEKS.LANDING_L2_JUDUL, isi: TEKS.LANDING_L2_ISI },
  { judul: TEKS.LANDING_L3_JUDUL, isi: TEKS.LANDING_L3_ISI },
  { judul: TEKS.LANDING_L4_JUDUL, isi: TEKS.LANDING_L4_ISI },
  { judul: TEKS.LANDING_L5_JUDUL, isi: TEKS.LANDING_L5_ISI },
] as const;

export default function HalamanLanding() {
  return (
    <div className="flex min-h-dvh flex-col bg-latar">
      {/* Header Navigasi */}
      <header className="border-b border-garis-halus bg-kertas px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight text-tinta">
            {TEKS.APP_NAMA}
          </Link>
          <nav aria-label="Navigasi Utama" className="flex items-center gap-4 sm:gap-6">
            <Link href="/tentang" className="text-sm font-semibold text-tinta-redup hover:text-tinta">
              {TEKS.TENTANG_JUDUL}
            </Link>
            <Link href="/harga" className="text-sm font-semibold text-tinta-redup hover:text-tinta">
              {TEKS.HRG_JUDUL}
            </Link>
            <Link href="/demo" className="text-sm font-semibold text-tinta-redup hover:text-tinta">
              {TEKS.LANDING_CTA_DEMO}
            </Link>
            <Link
              href="/masuk"
              className="inline-flex min-h-10 items-center justify-center rounded-kontrol border border-garis bg-kertas px-4 py-2 text-sm font-semibold text-tinta hover:bg-latar"
            >
              {TEKS.MASUK_JUDUL}
            </Link>
          </nav>
        </div>
      </header>

      {/* Konten Utama */}
      <main className="flex-1">
        {/* Bagian Hero */}
        <section className="border-b border-garis-halus bg-kertas px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="hero-judul">
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center">
            <span className="rounded-kontrol border border-garis bg-latar px-3 py-1 text-xs font-semibold text-tinta">
              {TEKS.APP_NAMA}
            </span>
            <h1 id="hero-judul" className="text-4xl font-extrabold tracking-tight text-tinta sm:text-5xl lg:text-6xl">
              {TEKS.LANDING_JUDUL}
            </h1>
            <p className="max-w-2xl text-lg text-tinta-redup sm:text-xl">
              {TEKS.LANDING_SUB}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Link
                href="/mulai"
                className="inline-flex min-h-12 items-center justify-center rounded-kontrol bg-aksi px-6 py-3 text-base font-bold text-aksi-teks hover:bg-aksi/90"
              >
                {TEKS.LANDING_CTA}
              </Link>
              <Link
                href="/demo"
                className="inline-flex min-h-12 items-center justify-center rounded-kontrol border border-garis bg-kertas px-6 py-3 text-base font-bold text-tinta hover:bg-latar"
              >
                {TEKS.LANDING_CTA_DEMO}
              </Link>
              <Link
                href="/harga"
                className="inline-flex min-h-12 items-center justify-center px-4 py-3 text-base font-semibold text-tinta-redup underline hover:text-tinta"
              >
                {TEKS.HRG_JUDUL}
              </Link>
            </div>
          </div>
        </section>

        {/* 5 Sorotan Fitur */}
        <section className="px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="fitur-judul">
          <div className="mx-auto max-w-6xl">
            <h2 id="fitur-judul" className="sr-only">
              {TEKS.LANDING_JUDUL}
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {FITUR_SOROTAN.map((fitur, i) => (
                <Kartu
                  key={i}
                  className="flex flex-col gap-3 border border-garis-halus bg-kertas p-6 shadow-sm"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-garis bg-latar text-sm font-bold text-tinta">
                    {i + 1}
                  </span>
                  <h3 className="text-xl font-bold text-tinta">{fitur.judul}</h3>
                  <p className="text-sm leading-relaxed text-tinta-redup">{fitur.isi}</p>
                </Kartu>
              ))}
            </div>
          </div>
        </section>

        {/* Dasar Regulasi & Batasan */}
        <section className="border-t border-garis-halus bg-kertas px-4 py-12 sm:px-6" aria-labelledby="regulasi-judul">
          <div className="mx-auto flex max-w-4xl flex-col gap-4 text-center">
            <h2 id="regulasi-judul" className="text-sm font-semibold text-tinta">
              {TEKS.LANDING_DASAR}
            </h2>
            <p className="text-xs text-tinta-redup">{TEKS.LANDING_BUKAN_PORTAL}</p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-garis-halus bg-kertas px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-tinta-redup">{TEKS.KAKI_HAK_CIPTA}</p>
          <nav aria-label="Navigasi Kaki" className="flex flex-wrap items-center gap-6 text-sm text-tinta-redup">
            <Link href="/tentang" className="hover:text-tinta">
              {TEKS.TENTANG_JUDUL}
            </Link>
            <Link href="/harga" className="hover:text-tinta">
              {TEKS.HRG_JUDUL}
            </Link>
            <Link href="/privasi" className="hover:text-tinta">
              {TEKS.PRIV_JUDUL}
            </Link>
            <Link href="/syarat" className="hover:text-tinta">
              {TEKS.SYR_JUDUL}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
