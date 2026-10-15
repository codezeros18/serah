import Link from "next/link";
import { TEKS } from "@serah/kontrak/teks";
import { Kartu } from "@serah/ui";
import { LogoSerah } from "@/lib/klien/komponen/logo-serah";

export default function HalamanHarga() {
  return (
    <div className="flex min-h-dvh flex-col bg-latar text-tinta">
      {/* Header Publik */}
      <header className="sticky top-0 z-30 border-b border-garis-halus bg-kertas/95 backdrop-blur px-4 py-3 sm:px-6 shadow-xs">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="group flex items-center gap-2" aria-label={TEKS.APP_NAMA}>
            <LogoSerah ukuran="sm" />
          </Link>
          <div className="flex items-center gap-4 sm:gap-6">
            <Link
              href="/tentang"
              className="text-sm font-semibold text-tinta-redup hover:text-aksi transition-colors"
            >
              {TEKS.TENTANG_JUDUL}
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
          </div>
        </div>
      </header>

      {/* Konten Utama */}
      <main className="flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto flex max-w-6xl flex-col gap-10">
          {/* Header Judul */}
          <div className="flex flex-col gap-3 text-center">
            <div className="inline-flex items-center justify-center">
              <span className="rounded-full border border-aksi/25 bg-aksi-latar px-3.5 py-1 text-xs font-bold text-aksi shadow-xs">
                {TEKS.HRG_JUDUL} &amp; Paket Layanan
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-tinta sm:text-4xl md:text-5xl [text-wrap:balance]">
              {TEKS.LANDING_JUDUL}
            </h1>
            <p className="mx-auto max-w-2xl text-base text-tinta-redup [text-wrap:balance]">
              {TEKS.HRG_SELALU_GRATIS}
            </p>
          </div>

          {/* 3 Tier Cards (Gratis, Mandiri, Mitra) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-stretch">
            {/* 1. Tier Gratis (Dasar) */}
            <Kartu className="flex flex-col justify-between gap-6 border border-garis-halus bg-kertas p-6 shadow-sm hover:border-garis transition-all">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="rounded-kontrol border border-garis bg-latar px-3 py-1 text-xs font-bold text-tinta">
                    Gratis
                  </span>
                  <span className="text-xs font-medium text-tinta-redup">Evaluasi</span>
                </div>
                <div>
                  <h2 className="text-2xl font-black text-tinta">Rp 0</h2>
                  <p className="text-xs text-tinta-redup mt-1">{TEKS.PERAN_PENGELOLA}</p>
                </div>
                <p className="text-sm text-tinta-redup leading-relaxed">
                  {TEKS.HRG_SELALU_GRATIS}
                </p>

                <div className="border-t border-garis-halus pt-4 flex flex-col gap-2.5 text-sm text-tinta">
                  <div className="flex items-center gap-2">
                    <span className="text-aliran-hijau font-bold" aria-hidden="true">✔</span>
                    <span>{TEKS.T1_JUDUL}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-aliran-hijau font-bold" aria-hidden="true">✔</span>
                    <span>{TEKS.T2_JUDUL}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-aliran-hijau font-bold" aria-hidden="true">✔</span>
                    <span>{TEKS.K1_JUDUL}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-aliran-hijau font-bold" aria-hidden="true">✔</span>
                    <span>{TEKS.EKSPOR_CSV}</span>
                  </div>
                </div>
              </div>

              <Link
                href="/daftar"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-kontrol border-2 border-garis bg-kertas px-5 py-3 text-center text-sm font-bold text-tinta hover:bg-latar hover:border-tinta transition-all active:scale-[0.98]"
              >
                {TEKS.DAFTAR_JUDUL}
              </Link>
            </Kartu>

            {/* 2. Tier Mandiri (Pengelola Kawasan - DIREKOMENDASIKAN) */}
            <Kartu className="relative flex flex-col justify-between gap-6 rounded-kartu border-2 border-aksi bg-kertas p-6 shadow-md ring-2 ring-aksi/15 transition-all">
              {/* Badge Rekomendasi */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-aksi px-4 py-1 text-xs font-black tracking-wide text-aksi-teks shadow-sm">
                  Pilihan Utama
                </span>
              </div>

              <div className="flex flex-col gap-4 pt-2">
                <div className="flex items-center justify-between">
                  <span className="rounded-kontrol bg-aksi-latar px-3 py-1 text-xs font-bold text-aksi border border-aksi/20">
                    Mandiri
                  </span>
                  <span className="text-xs font-bold text-aksi">14 Hari Bebas Biaya</span>
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-tinta leading-tight">
                    {TEKS.HRG_KAWASAN}
                  </h2>
                  <p className="text-xs text-tinta-redup mt-1">{TEKS.PERAN_PENGELOLA}</p>
                </div>
                <p className="text-sm text-tinta-redup leading-relaxed">
                  {TEKS.HRG_KAWASAN_DETAIL}
                </p>

                <div className="border-t border-garis-halus pt-4 flex flex-col gap-2.5 text-sm text-tinta">
                  <div className="flex items-center gap-2">
                    <span className="text-aksi font-bold" aria-hidden="true">✔</span>
                    <span className="font-semibold">{TEKS.EKSPOR_PDF}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-aksi font-bold" aria-hidden="true">✔</span>
                    <span>{TEKS.AI_LABEL}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-aksi font-bold" aria-hidden="true">✔</span>
                    <span>{TEKS.ATURAN_JUDUL_PRIORITAS}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-aksi font-bold" aria-hidden="true">✔</span>
                    <span>{TEKS.K3_JUDUL}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-aksi font-bold" aria-hidden="true">✔</span>
                    <span>{TEKS.AGT_JUDUL}</span>
                  </div>
                </div>
              </div>

              <Link
                href="/mulai"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-kontrol bg-aksi px-5 py-3 text-center text-sm font-bold text-aksi-teks shadow-sm hover:bg-aksi-hover hover:shadow transition-all active:scale-[0.98]"
              >
                {TEKS.LANDING_CTA}
              </Link>
            </Kartu>

            {/* 3. Tier Mitra (Pengangkut & Penerima) */}
            <Kartu className="flex flex-col justify-between gap-6 border border-garis-halus bg-kertas p-6 shadow-sm hover:border-garis transition-all">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="rounded-kontrol border border-garis bg-latar px-3 py-1 text-xs font-bold text-tinta">
                    Mitra
                  </span>
                  <span className="text-xs font-medium text-aliran-hijau font-semibold">Selalu Bebas Biaya</span>
                </div>
                <div>
                  <h2 className="text-2xl font-black text-tinta">Rp 0</h2>
                  <p className="text-xs text-tinta-redup mt-1">
                    {TEKS.PERAN_PENGANGKUT} &amp; {TEKS.PERAN_PENERIMA}
                  </p>
                </div>
                <p className="text-sm text-tinta-redup leading-relaxed">
                  {TEKS.HRG_MITRA}
                </p>

                <div className="border-t border-garis-halus pt-4 flex flex-col gap-2.5 text-sm text-tinta">
                  <div className="flex items-center gap-2">
                    <span className="text-aliran-hijau font-bold" aria-hidden="true">✔</span>
                    <span>{TEKS.A2_PINDAI} &amp; {TEKS.P1_PINDAI}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-aliran-hijau font-bold" aria-hidden="true">✔</span>
                    <span>{TEKS.P1_FOTO_TIKET}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-aliran-hijau font-bold" aria-hidden="true">✔</span>
                    <span>{TEKS.TGA_JUDUL}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-aliran-hijau font-bold" aria-hidden="true">✔</span>
                    <span>{TEKS.IZN_JUDUL}</span>
                  </div>
                </div>
              </div>

              <Link
                href="/daftar"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-kontrol border-2 border-aksi bg-kertas px-5 py-3 text-center text-sm font-bold text-aksi hover:bg-aksi-latar/40 transition-all active:scale-[0.98]"
              >
                {TEKS.DAFTAR_JUDUL}
              </Link>
            </Kartu>
          </div>

          {/* Jaminan Keterbukaan & Regulasi */}
          <div className="rounded-kartu border border-garis-halus bg-kertas p-6 shadow-xs text-center">
            <p className="text-sm text-tinta-redup leading-relaxed max-w-3xl mx-auto">
              <strong className="text-tinta font-semibold">{TEKS.APP_NAMA}: </strong>
              {TEKS.HRG_SELALU_GRATIS}
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-garis-halus bg-kertas px-4 py-8 sm:px-6 mt-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-tinta-redup">{TEKS.KAKI_HAK_CIPTA}</p>
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
