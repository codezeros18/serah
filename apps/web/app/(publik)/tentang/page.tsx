import Link from "next/link";
import { AtribusiBMKG, Kartu } from "@serah/ui";
import { TEKS } from "@serah/kontrak/teks";

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
    <div className="flex min-h-dvh flex-col bg-latar">
      {/* Header Navigasi */}
      <header className="border-b border-garis-halus bg-kertas px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight text-tinta">
            {TEKS.APP_NAMA}
          </Link>
          <nav aria-label="Navigasi Utama" className="flex items-center gap-4 sm:gap-6">
            <Link href="/tentang" className="text-sm font-semibold text-tinta">
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
              {TEKS.TENTANG_JUDUL}
            </h1>
          </div>

          {/* 10 Batasan Sistem */}
          <section className="flex flex-col gap-4" aria-labelledby="batasan-judul">
            <h2 id="batasan-judul" className="text-2xl font-bold text-tinta">
              {TEKS.TENTANG_BATASAN_JUDUL}
            </h2>
            <ol className="flex flex-col gap-3">
              {DAFTAR_BATASAN.map((batasan, index) => (
                <li key={index}>
                  <Kartu className="flex items-start gap-4 border border-garis-halus bg-kertas p-4 shadow-sm">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-garis bg-latar text-xs font-bold text-tinta">
                      {index + 1}
                    </span>
                    <p className="text-base text-tinta">{batasan}</p>
                  </Kartu>
                </li>
              ))}
            </ol>
          </section>

          {/* Penjelasan AI */}
          <section className="flex flex-col gap-3" aria-labelledby="ai-judul">
            <h2 id="ai-judul" className="text-2xl font-bold text-tinta">
              {TEKS.AI_LABEL}
            </h2>
            <Kartu className="border border-garis-halus bg-kertas p-6 shadow-sm">
              <p className="text-base leading-relaxed text-tinta">{TEKS.TENTANG_AI}</p>
            </Kartu>
          </section>

          {/* Atribusi BMKG */}
          <section className="flex flex-col gap-3" aria-label="Atribusi Cuaca">
            <Kartu className="border border-garis-halus bg-kertas p-6 shadow-sm">
              <AtribusiBMKG />
            </Kartu>
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
