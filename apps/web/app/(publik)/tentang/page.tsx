import Link from "next/link";
import { AtribusiBMKG, Kartu } from "@serah/ui";
import { TEKS } from "@serah/kontrak/teks";
import { LogoSerah } from "@/lib/klien/komponen/logo-serah";

const DAFTAR_BATASAN = [
  TEKS.TENTANG_BATASAN_1,
  TEKS.TENTANG_BATASAN_2,
  TEKS.TENTANG_BATASAN_3,
  TEKS.TENTANG_BATASAN_4,
  TEKS.TENTANG_BATASAN_5,
  TEKS.TENTANG_BATASAN_6,
  TEKS.TENTANG_BATASAN_7,
  TEKS.TENTANG_BATASAN_8,
  TEKS.TENTANG_BATASAN_9,
  TEKS.TENTANG_BATASAN_10,
] as const;

export default function HalamanTentang() {
  return (
    <div className="flex min-h-dvh flex-col bg-latar text-tinta">
      {/* Header Navigasi Publik */}
      <header className="sticky top-0 z-30 border-b border-garis-halus bg-kertas/95 backdrop-blur px-4 py-3 sm:px-6 shadow-xs">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="group flex items-center gap-2" aria-label={TEKS.APP_NAMA}>
            <LogoSerah ukuran="sm" />
          </Link>
          <nav aria-label="Navigasi Utama" className="flex items-center gap-4 sm:gap-7">
            <Link href="/tentang" className="text-sm font-bold text-aksi border-b-2 border-aksi pb-0.5">
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
                Transparansi &amp; Batasan Sistem
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-tinta sm:text-4xl [text-wrap:balance]">
              {TEKS.TENTANG_JUDUL}
            </h1>
            <p className="text-base text-tinta-redup leading-relaxed max-w-2xl">
              {TEKS.APP_DESKRIPSI}
            </p>
          </div>

          {/* 10 Batasan Sistem */}
          <section className="flex flex-col gap-5" aria-labelledby="batasan-judul">
            <div className="border-b border-garis-halus pb-3">
              <h2 id="batasan-judul" className="text-2xl font-bold text-tinta">
                {TEKS.TENTANG_BATASAN_JUDUL}
              </h2>
            </div>
            <ol className="flex flex-col gap-3">
              {DAFTAR_BATASAN.map((batasan, index) => (
                <li key={index}>
                  <Kartu className="flex items-start gap-4 border border-garis-halus bg-kertas p-4 shadow-xs hover:border-aksi-garis hover:shadow-sm transition-all duration-150">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-aksi/25 bg-aksi-latar text-xs font-black text-aksi shadow-2xs">
                      {index + 1}
                    </span>
                    <p className="pt-0.5 text-base font-medium text-tinta leading-relaxed">{batasan}</p>
                  </Kartu>
                </li>
              ))}
            </ol>
          </section>

          {/* Penjelasan AI */}
          <section className="flex flex-col gap-3" aria-labelledby="ai-judul">
            <div className="border-b border-garis-halus pb-2">
              <h2 id="ai-judul" className="text-xl font-bold text-tinta">
                {TEKS.AI_LABEL}
              </h2>
            </div>
            <Kartu className="flex flex-col gap-3 border-l-4 border-l-aksi border-garis-halus bg-kertas p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="rounded-kontrol bg-aksi/10 px-2.5 py-0.5 text-xs font-bold text-aksi">
                  Anthropic Claude
                </span>
                <span className="text-xs text-tinta-redup">Model AI Pengenal Teks</span>
              </div>
              <p className="text-base leading-relaxed text-tinta">{TEKS.TENTANG_AI}</p>
            </Kartu>
          </section>

          {/* Atribusi BMKG */}
          <section className="flex flex-col gap-3" aria-label="Atribusi Cuaca">
            <div className="border-b border-garis-halus pb-2">
              <h2 className="text-xl font-bold text-tinta">
                Integrasi Cuaca
              </h2>
            </div>
            <Kartu className="flex flex-col gap-3 border border-garis-halus bg-kertas p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="rounded-kontrol bg-latar px-2.5 py-0.5 text-xs font-bold text-tinta">
                  BMKG
                </span>
                <span className="text-xs text-tinta-redup">Nowcast &amp; Prakiraan Resmi</span>
              </div>
              <AtribusiBMKG />
              <p className="text-xs text-tinta-redup">{TEKS.R10_CATATAN}</p>
            </Kartu>
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
