import Link from "next/link";
import { Kartu } from "@serah/ui";
import { TEKS } from "@serah/kontrak/teks";
import { LogoSerah } from "@/lib/klien/komponen/logo-serah";

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
    <div className="flex min-h-dvh flex-col bg-latar text-tinta">
      {/* Header Navigasi Publik */}
      <header className="sticky top-0 z-30 border-b border-garis-halus bg-kertas/95 backdrop-blur px-4 py-3 sm:px-6 shadow-xs">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="group flex items-center gap-2" aria-label={TEKS.APP_NAMA}>
            <LogoSerah ukuran="sm" />
          </Link>
          <nav aria-label="Navigasi Utama" className="flex items-center gap-4 sm:gap-7">
            <Link
              href="/tentang"
              className="text-sm font-semibold text-tinta-redup hover:text-aksi transition-colors"
            >
              {TEKS.TENTANG_JUDUL}
            </Link>
            <Link
              href="/harga"
              className="text-sm font-semibold text-tinta-redup hover:text-aksi transition-colors"
            >
              {TEKS.HRG_JUDUL}
            </Link>
            <Link
              href="/demo"
              className="text-sm font-semibold text-tinta-redup hover:text-aksi transition-colors"
            >
              {TEKS.LANDING_CTA_DEMO}
            </Link>
            <Link
              href="/masuk"
              className="inline-flex min-h-10 items-center justify-center rounded-kontrol border border-garis bg-kertas px-4 py-2 text-sm font-bold text-tinta hover:border-aksi hover:text-aksi hover:bg-aksi-latar/40 transition-all shadow-xs"
            >
              {TEKS.MASUK_JUDUL}
            </Link>
          </nav>
        </div>
      </header>

      {/* Konten Utama */}
      <main className="flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto flex max-w-4xl flex-col gap-10">
          <div className="flex flex-col gap-3 text-center sm:text-left">
            <div className="inline-flex items-center sm:justify-start justify-center">
              <span className="rounded-full border border-aksi/25 bg-aksi-latar px-3.5 py-1 text-xs font-bold text-aksi shadow-xs">
                Ketentuan Hukum &amp; Layanan
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-tinta sm:text-4xl [text-wrap:balance]">
              {TEKS.SYR_JUDUL}
            </h1>
            <p className="text-base text-tinta-redup leading-relaxed max-w-2xl">
              {TEKS.APP_DESKRIPSI}
            </p>
          </div>

          {/* 6 Poin Syarat Layanan */}
          <section className="flex flex-col gap-4" aria-labelledby="syarat-poin-judul">
            <h2 id="syarat-poin-judul" className="sr-only">
              {TEKS.SYR_JUDUL}
            </h2>
            <ol className="flex flex-col gap-4">
              {DAFTAR_SYARAT.map((syarat, index) => (
                <li key={index}>
                  <Kartu className="flex items-start gap-4 border border-garis-halus bg-kertas p-6 shadow-xs hover:border-aksi-garis hover:shadow-sm transition-all duration-150">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-aksi/25 bg-aksi-latar text-xs font-black text-aksi shadow-2xs">
                      {index + 1}
                    </span>
                    <p className="pt-0.5 text-base leading-relaxed font-medium text-tinta">{syarat}</p>
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
          <div className="flex items-center gap-3">
            <LogoSerah ukuran="sm" />
            <span className="text-xs text-tinta-redup">| {TEKS.KAKI_HAK_CIPTA}</span>
          </div>
          <nav aria-label="Navigasi Kaki" className="flex flex-wrap items-center gap-6 text-sm text-tinta-redup">
            <Link href="/tentang" className="hover:text-aksi transition-colors">
              {TEKS.TENTANG_JUDUL}
            </Link>
            <Link href="/harga" className="hover:text-aksi transition-colors">
              {TEKS.HRG_JUDUL}
            </Link>
            <Link href="/privasi" className="hover:text-aksi transition-colors">
              {TEKS.PRIV_JUDUL}
            </Link>
            <Link href="/syarat" className="hover:text-aksi transition-colors">
              {TEKS.SYR_JUDUL}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
