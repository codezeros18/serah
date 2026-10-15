import Link from "next/link";
import { Kartu } from "@serah/ui";
import { TEKS } from "@serah/kontrak/teks";

const DAFTAR_SYARAT = [
  TEKS.SYR_1,
  TEKS.SYR_2,
  TEKS.SYR_3,
  TEKS.SYR_4,
  TEKS.SYR_5,
  TEKS.SYR_6,
] as const;

export default function HalamanSyarat() {
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
      <main className="flex-1 px-4 py-12 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-tinta sm:text-4xl">
              {TEKS.SYR_JUDUL}
            </h1>
          </div>

          {/* 6 Poin Syarat Layanan */}
          <section className="flex flex-col gap-4" aria-labelledby="syarat-poin-judul">
            <h2 id="syarat-poin-judul" className="sr-only">
              {TEKS.SYR_JUDUL}
            </h2>
            <ol className="flex flex-col gap-4">
              {DAFTAR_SYARAT.map((syarat, index) => (
                <li key={index}>
                  <Kartu className="flex items-start gap-4 border border-garis-halus bg-kertas p-6 shadow-sm">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-garis bg-latar text-xs font-bold text-tinta">
                      {index + 1}
                    </span>
                    <p className="text-base leading-relaxed text-tinta">{syarat}</p>
                  </Kartu>
                </li>
              ))}
            </ol>
          </section>
        </div>
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
